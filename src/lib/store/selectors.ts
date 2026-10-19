"use client";

import { useMemo } from "react";
import { useStore } from "./store";
import { accountBalances, position } from "../domain/balances";
import type { Category } from "../domain/types";

export function useAccounts(includeArchived = false) {
  const accounts = useStore((s) => s.accounts);
  return useMemo(
    () =>
      accounts
        .filter((a) => !a.deletedAt && (includeArchived || !a.archived))
        .sort((a, b) => a.sortOrder - b.sortOrder),
    [accounts, includeArchived],
  );
}

export function useCategories(kind?: Category["kind"]) {
  const categories = useStore((s) => s.categories);
  return useMemo(
    () =>
      categories
        .filter((c) => !c.deletedAt && !c.archived && (!kind || c.kind === kind))
        .sort((a, b) => a.sortOrder - b.sortOrder),
    [categories, kind],
  );
}

export function useTransactions() {
  const txs = useStore((s) => s.transactions);
  return useMemo(
    () =>
      txs
        .filter((t) => !t.deletedAt)
        .sort((a, b) => (a.date === b.date ? b.createdAt.localeCompare(a.createdAt) : b.date.localeCompare(a.date))),
    [txs],
  );
}

export function useBalances() {
  const accounts = useStore((s) => s.accounts);
  const txs = useStore((s) => s.transactions);
  return useMemo(() => accountBalances(accounts, txs), [accounts, txs]);
}

export function usePosition() {
  const accounts = useStore((s) => s.accounts);
  const goals = useStore((s) => s.goals);
  const contributions = useStore((s) => s.contributions);
  const balances = useBalances();
  return useMemo(() => position(accounts, balances, goals, contributions), [accounts, balances, goals, contributions]);
}

/**
 * Categorías ordenadas por uso en los últimos 90 días: las que más usas aparecen primero
 * en el registro rápido (menos toques, menos scroll).
 */
export function useCategoriesByFrequency(kind: Category["kind"]) {
  const cats = useCategories(kind);
  const txs = useStore((s) => s.transactions);
  return useMemo(() => {
    const since = new Date(Date.now() - 90 * 86_400_000).toISOString().slice(0, 10);
    const freq = new Map<string, number>();
    for (const t of txs) {
      if (t.deletedAt || !t.categoryId || t.date < since) continue;
      freq.set(t.categoryId, (freq.get(t.categoryId) ?? 0) + 1);
    }
    return [...cats].sort((a, b) => (freq.get(b.id) ?? 0) - (freq.get(a.id) ?? 0) || a.sortOrder - b.sortOrder);
  }, [cats, txs]);
}

export function useMoneyFormat() {
  const { currency, locale } = useStore((s) => s.settings);
  return { currency, locale };
}
