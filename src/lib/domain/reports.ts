import type { Account, Category, Period, Transaction } from "./types";
import { accountBalances } from "./balances";
import { toBase, type Fx } from "./fx";
import { daysInPeriod, endOfPeriod, lastPeriods, periodOf } from "./dates";

export interface MonthTotals {
  period: Period;
  income: number;
  expense: number;
  net: number;
}

const live = (txs: Transaction[]) => txs.filter((t) => !t.deletedAt);

export function monthTotals(transactions: Transaction[], period: Period): MonthTotals {
  let income = 0;
  let expense = 0;
  for (const t of live(transactions)) {
    if (periodOf(t.date) !== period) continue;
    if (t.type === "income") income += t.amount;
    else if (t.type === "expense") expense += t.amount;
  }
  return { period, income, expense, net: income - expense };
}

export function monthlySeries(transactions: Transaction[], end: Period, months: number): MonthTotals[] {
  const map = new Map(lastPeriods(end, months).map((p) => [p, { period: p, income: 0, expense: 0, net: 0 }]));
  for (const t of live(transactions)) {
    const row = map.get(periodOf(t.date));
    if (!row) continue;
    if (t.type === "income") row.income += t.amount;
    else if (t.type === "expense") row.expense += t.amount;
  }
  for (const r of map.values()) r.net = r.income - r.expense;
  return [...map.values()];
}

export interface CategorySlice {
  categoryId: string;
  name: string;
  icon: string;
  color: string;
  amount: number;
  share: number;
  count: number;
}

export function spendingByCategory(
  transactions: Transaction[],
  categories: Category[],
  periods: Period[],
  kind: "expense" | "income" = "expense",
): CategorySlice[] {
  const set = new Set(periods);
  const byId = new Map(categories.map((c) => [c.id, c]));
  const acc = new Map<string, { amount: number; count: number }>();
  let total = 0;
  for (const t of live(transactions)) {
    if (t.type !== kind || !set.has(periodOf(t.date))) continue;
    const k = t.categoryId ?? "none";
    const cur = acc.get(k) ?? { amount: 0, count: 0 };
    cur.amount += t.amount;
    cur.count += 1;
    acc.set(k, cur);
    total += t.amount;
  }
  return [...acc.entries()]
    .map(([id, v]) => {
      const c = byId.get(id);
      return {
        categoryId: id,
        name: c?.name ?? "Sin categoría",
        icon: c?.icon ?? "❔",
        color: c?.color ?? "#94a3b8",
        amount: v.amount,
        count: v.count,
        share: total ? v.amount / total : 0,
      };
    })
    .sort((a, b) => b.amount - a.amount);
}

/** Flujo de caja diario acumulado dentro de un mes. */
export function dailyCashflow(transactions: Transaction[], period: Period) {
  const days = daysInPeriod(period);
  const rows = Array.from({ length: days }, (_, i) => ({ day: i + 1, income: 0, expense: 0, cumulative: 0 }));
  for (const t of live(transactions)) {
    if (periodOf(t.date) !== period) continue;
    const r = rows[Number(t.date.slice(8, 10)) - 1];
    if (t.type === "income") r.income += t.amount;
    else if (t.type === "expense") r.expense += t.amount;
  }
  let run = 0;
  for (const r of rows) {
    run += r.income - r.expense;
    r.cumulative = run;
  }
  return rows;
}

/** Patrimonio neto al cierre de cada mes. */
export function netWorthSeries(accounts: Account[], transactions: Transaction[], end: Period, months: number, fx: Fx = { base: "PEN", usdRate: 3.75 }) {
  const active = accounts.filter((a) => !a.deletedAt);
  return lastPeriods(end, months).map((p) => {
    const b = accountBalances(active, transactions, endOfPeriod(p));
    let assets = 0;
    let debt = 0;
    for (const a of active) {
      const v = toBase(b.get(a.id) ?? 0, a.currency, fx);
      if (a.type === "credit_card") debt += Math.max(0, -v);
      else assets += v;
    }
    return { period: p, assets, debt, netWorth: assets - debt };
  });
}

/** Proyección lineal del gasto del mes según el ritmo actual. */
export function projectMonthExpense(spentSoFar: number, dayOfMonth: number, days: number): number {
  if (dayOfMonth <= 0) return spentSoFar;
  return Math.round((spentSoFar / dayOfMonth) * days);
}
