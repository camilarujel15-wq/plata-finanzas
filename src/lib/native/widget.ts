"use client";

import { registerPlugin } from "@capacitor/core";
import { App } from "@capacitor/app";
import type { State } from "../store/store";
import { useStore } from "../store/store";
import { accountBalances, position } from "../domain/balances";
import { DEFAULT_USD_RATE } from "../domain/fx";
import { isSpendable } from "../domain/types";
import { isNative } from "./platform";

interface PendingItem {
  id: string;
  type: "expense" | "income";
  amount: number;
  accountId: string;
  categoryId: string;
  date: string;
  createdAt: string;
  note?: string;
}

interface PlataWidgetPlugin {
  setSnapshot(opts: { json: string }): Promise<void>;
  drainPending(): Promise<{ items: PendingItem[] }>;
  requestPin(): Promise<{ supported: boolean; installed: boolean }>;
}

const PlataWidget = registerPlugin<PlataWidgetPlugin>("PlataWidget");

/** Categorías más usadas en 90 días (las primeras 4 aparecen en el widget). */
function byFrequency(s: State, kind: "expense" | "income") {
  const since = new Date(Date.now() - 90 * 86_400_000).toISOString().slice(0, 10);
  const freq = new Map<string, number>();
  for (const t of s.transactions) {
    if (!t.deletedAt && t.categoryId && t.date >= since) freq.set(t.categoryId, (freq.get(t.categoryId) ?? 0) + 1);
  }
  return s.categories
    .filter((c) => !c.deletedAt && !c.archived && c.kind === kind)
    .sort((a, b) => (freq.get(b.id) ?? 0) - (freq.get(a.id) ?? 0) || a.sortOrder - b.sortOrder)
    .map((c) => ({ id: c.id, name: c.name, icon: c.icon, color: c.color }));
}

/** Lo que el widget muestra. Se recalcula cada vez que cambian los datos. */
function buildSnapshot(s: State) {
  // Cuentas de más a menos usadas (90 días), igual que en el registro de la app.
  const since = new Date(Date.now() - 90 * 86_400_000).toISOString().slice(0, 10);
  const accFreq = new Map<string, number>();
  for (const t of s.transactions) if (!t.deletedAt && t.date >= since) accFreq.set(t.accountId, (accFreq.get(t.accountId) ?? 0) + 1);
  const accounts = s.accounts
    .filter((a) => !a.deletedAt && !a.archived && isSpendable(a.type))
    .sort((a, b) => (accFreq.get(b.id) ?? 0) - (accFreq.get(a.id) ?? 0) || a.sortOrder - b.sortOrder);
  const fx = { base: s.settings.currency, usdRate: s.settings.usdRate ?? DEFAULT_USD_RATE };
  const pos = position(s.accounts, accountBalances(s.accounts, s.transactions), s.goals, s.contributions, fx);
  const expense = byFrequency(s, "expense");
  const favorites = s.settings.widgetFavorites?.length
    ? s.settings.widgetFavorites.map((id) => expense.find((c) => c.id === id)).filter(Boolean)
    : expense.slice(0, 4);
  return {
    currency: s.settings.currency,
    usdRate: fx.usdRate,
    available: pos.available,
    // Con bloqueo activo el widget nunca muestra el saldo.
    hide: !!s.settings.hideAmounts || !!s.settings.lock,
    accounts: accounts.map((a) => ({ id: a.id, name: a.name, icon: a.icon, currency: a.currency })),
    defaultAccountId: s.settings.defaultAccountId ?? null,
    lastAccountId: s.settings.lastAccountId ?? null,
    favorites: favorites.slice(0, 4),
    categories: expense,
    incomeCategories: byFrequency(s, "income"),
    updatedAt: new Date().toISOString(),
  };
}

/** Importa lo registrado desde el widget mientras la app estaba cerrada. */
export async function drainWidgetQueue(): Promise<number> {
  if (!isNative()) return 0;
  const { items } = await PlataWidget.drainPending();
  const st = useStore.getState();
  let n = 0;
  for (const it of items ?? []) {
    if (st.transactions.some((t) => t.id === it.id)) continue;
    st.addTransaction({
      id: it.id,
      type: it.type,
      amount: Number(it.amount),
      accountId: it.accountId,
      categoryId: it.categoryId,
      date: it.date,
      merchant: it.note?.trim() || undefined,
      source: "widget",
    });
    n++;
  }
  return n;
}

export async function requestPinWidget() {
  if (!isNative()) return { supported: false, installed: false };
  return PlataWidget.requestPin();
}

let timer: ReturnType<typeof setTimeout> | null = null;
let lastJson = "";

/** Conecta el store con el widget: snapshot al cambiar datos y vaciado de la cola al volver a la app. */
export function startWidgetBridge(onImported: (n: number) => void) {
  if (!isNative()) return () => {};
  const push = () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      const json = JSON.stringify({ ...buildSnapshot(useStore.getState()), updatedAt: undefined });
      if (json === lastJson) return;
      lastJson = json;
      PlataWidget.setSnapshot({ json }).catch(() => {});
    }, 400);
  };
  const drain = () => drainWidgetQueue().then((n) => n && onImported(n)).catch(() => {});
  drain().then(push);
  const unsub = useStore.subscribe(push);
  const sub = App.addListener("resume", drain);
  return () => {
    unsub();
    sub.then((h) => h.remove());
  };
}
