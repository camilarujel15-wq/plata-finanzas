"use client";

import type { Syncable } from "../domain/types";
import { COLLECTIONS, useStore, type Collection, type OutboxItem } from "../store/store";
import { getSupabase } from "./supabase";

/** Colección local → tabla de Postgres. */
export const TABLE: Record<Collection, string> = {
  accounts: "accounts",
  categories: "categories",
  transactions: "transactions",
  budgets: "budgets",
  goals: "goals",
  contributions: "goal_contributions",
  rules: "category_rules",
  alerts: "budget_alerts",
};

const snake = (s: string) => s.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
const camel = (s: string) => s.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());

export function toRow(obj: object, userId: string): Record<string, unknown> {
  const out: Record<string, unknown> = { user_id: userId };
  for (const [k, v] of Object.entries(obj)) out[snake(k)] = v === undefined ? null : v;
  return out;
}

export function fromRow<T extends Syncable>(row: Record<string, unknown>): T {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    if (k === "user_id") continue;
    // numeric/bigint de Postgres pueden llegar como string.
    out[camel(k)] = typeof v === "string" && /^(amount|initial_balance|target_amount|credit_limit|market_value|to_amount)$/.test(k) ? Number(v) : v;
  }
  return out as T;
}

// Orden que respeta las claves foráneas al subir.
const PUSH_ORDER: Collection[] = ["accounts", "categories", "goals", "budgets", "transactions", "contributions", "rules", "alerts"];

let running: Promise<void> | null = null;

/**
 * Sincronización offline-first:
 *  1. push: sube la cola local (outbox) con upsert idempotente por id.
 *  2. pull: baja cambios remotos desde `lastPulledAt` y los fusiona (last-write-wins).
 * Las bajas son lógicas (`deleted_at`) para que se propaguen entre dispositivos.
 */
export function syncNow(): Promise<void> {
  if (running) return running;
  running = (async () => {
    const sb = getSupabase();
    if (!sb) return;
    const { data: auth } = await sb.auth.getUser();
    const userId = auth.user?.id;
    if (!userId) return;

    const startedAt = new Date().toISOString();
    const state = useStore.getState();

    // PULL primero en el primer login para unificar categorías por defecto antes de subir.
    await pull(userId, state.lastPulledAt);

    const outbox = useStore.getState().outbox;
    for (const c of PUSH_ORDER) {
      const items = outbox.filter((o) => o.c === c);
      if (!items.length) continue;
      const list = useStore.getState()[c] as Syncable[];
      const rows = items
        .map((i) => list.find((r) => r.id === i.id))
        .filter((r): r is Syncable => !!r)
        .map((r) => toRow(r, userId));
      for (let i = 0; i < rows.length; i += 500) {
        const chunk = rows.slice(i, i + 500);
        const { error } = await sb.from(TABLE[c]).upsert(chunk, { onConflict: "id" });
        if (error) throw error;
      }
      useStore.getState().ackOutbox(items as OutboxItem[]);
    }
    useStore.getState().setLastPulledAt(startedAt);
  })().finally(() => {
    running = null;
  });
  return running;
}

async function pull(userId: string, since: string | null) {
  const sb = getSupabase()!;
  for (const c of COLLECTIONS) {
    let q = sb.from(TABLE[c]).select("*").eq("user_id", userId);
    // Margen de 2 min por desfase de relojes entre dispositivos (los duplicados se resuelven por LWW).
    if (since) q = q.gt("updated_at", new Date(new Date(since).getTime() - 120_000).toISOString());
    const { data, error } = await q.limit(10000);
    if (error) throw error;
    if (data?.length) useStore.getState().mergeRemote(c, data.map((r) => fromRow(r)));
  }
}
