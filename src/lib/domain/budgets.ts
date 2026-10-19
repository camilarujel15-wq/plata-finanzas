import type { Budget, BudgetAlert, Period, Transaction } from "./types";
import { periodOf } from "./dates";

export interface BudgetStatus {
  budget: Budget;
  spent: number;
  remaining: number;
  ratio: number;
  level: "ok" | "half" | "warn" | "over";
}

export function spentInCategory(transactions: Transaction[], categoryId: string, period: Period): number {
  return transactions.reduce(
    (s, t) =>
      !t.deletedAt && t.type === "expense" && t.categoryId === categoryId && periodOf(t.date) === period
        ? s + t.amount
        : s,
    0,
  );
}

export function levelFor(ratio: number): BudgetStatus["level"] {
  if (ratio >= 1) return "over";
  if (ratio >= 0.8) return "warn";
  if (ratio >= 0.5) return "half";
  return "ok";
}

export function budgetStatus(budget: Budget, transactions: Transaction[], period: Period): BudgetStatus {
  const spent = spentInCategory(transactions, budget.categoryId, period);
  const ratio = budget.amount > 0 ? spent / budget.amount : 0;
  return { budget, spent, remaining: budget.amount - spent, ratio, level: levelFor(ratio) };
}

/**
 * Umbrales recién cruzados (50/80/100) que aún no se notificaron en el periodo.
 * Devuelve solo el más alto para no saturar al usuario con 3 avisos a la vez.
 */
export function pendingAlert(
  status: BudgetStatus,
  period: Period,
  sent: BudgetAlert[],
): number | null {
  const pct = status.ratio * 100;
  const already = new Set(
    sent.filter((a) => !a.deletedAt && a.budgetId === status.budget.id && a.period === period).map((a) => a.threshold),
  );
  const crossed = [...status.budget.thresholds].sort((a, b) => b - a).find((t) => pct >= t);
  if (crossed === undefined || already.has(crossed)) return null;
  // Si ya se avisó un umbral mayor, no avisar uno menor.
  if ([...already].some((t) => t > crossed)) return null;
  return crossed;
}
