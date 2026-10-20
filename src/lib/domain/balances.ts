import type { Account, Goal, GoalContribution, ISODate, Transaction } from "./types";
import { toBase, type Fx } from "./fx";

export const alive = <T extends { deletedAt?: string | null }>(xs: T[]) => xs.filter((x) => !x.deletedAt);

/** Efecto de una transacción sobre el saldo de una cuenta. */
export function txDelta(tx: Transaction, accountId: string): number {
  if (tx.type === "expense") return tx.accountId === accountId ? -tx.amount : 0;
  if (tx.type === "income") return tx.accountId === accountId ? tx.amount : 0;
  let d = 0;
  if (tx.accountId === accountId) d -= tx.amount;
  if (tx.toAccountId === accountId) d += tx.toAmount ?? tx.amount;
  return d;
}

/**
 * Saldos calculados a partir de los movimientos (nunca se guardan): imposibles de "descuadrar".
 * Si se pasa `until`, calcula el saldo al cierre de esa fecha.
 */
export function accountBalances(
  accounts: Account[],
  transactions: Transaction[],
  until?: ISODate,
): Map<string, number> {
  const out = new Map<string, number>();
  for (const a of accounts) out.set(a.id, a.initialBalance);
  for (const tx of transactions) {
    if (tx.deletedAt) continue;
    if (until && tx.date > until) continue;
    if (out.has(tx.accountId)) out.set(tx.accountId, out.get(tx.accountId)! + txDelta(tx, tx.accountId));
    if (tx.type === "transfer" && tx.toAccountId && out.has(tx.toAccountId)) {
      out.set(tx.toAccountId, out.get(tx.toAccountId)! + (tx.toAmount ?? tx.amount));
    }
  }
  return out;
}

export function goalSaved(goalId: string, contributions: GoalContribution[]): number {
  return contributions.reduce((s, c) => (c.goalId === goalId && !c.deletedAt ? s + c.amount : s), 0);
}

export interface Position {
  /** Dinero líquido: bancos, ahorros, wallets y efectivo (en moneda principal). */
  assets: number;
  /** Inversiones (terreno, cursos, fondos…): valor actual o lo aportado. */
  investments: number;
  /** Lo que otras personas te deben. */
  receivables: number;
  /** Deuda en tarjetas (positivo). */
  debt: number;
  /** Patrimonio neto = líquido + inversiones + por cobrar − deuda. */
  netWorth: number;
  /** Dinero apartado para metas (sobres virtuales). */
  reserved: number;
  /**
   * "Disponible real": lo que realmente puedes gastar hoy =
   * líquido − deuda de tarjetas − apartado para metas. Las inversiones y lo que te deben no cuentan.
   */
  available: number;
}

export function position(
  accounts: Account[],
  balances: Map<string, number>,
  goals: Goal[],
  contributions: GoalContribution[],
  fx: Fx = { base: "PEN", usdRate: 3.75 },
): Position {
  let assets = 0;
  let investments = 0;
  let receivables = 0;
  let debt = 0;
  for (const a of accounts) {
    if (a.deletedAt || a.archived) continue;
    const b = toBase(balances.get(a.id) ?? 0, a.currency, fx);
    if (a.type === "credit_card") debt += Math.max(0, -b);
    else if (a.type === "investment") investments += a.marketValue != null ? toBase(a.marketValue, a.currency, fx) : b;
    else if (a.type === "receivable") receivables += Math.max(0, b);
    else assets += b;
  }
  const reserved = goals
    .filter((g) => !g.deletedAt && !g.archived)
    .reduce((s, g) => s + Math.max(0, goalSaved(g.id, contributions)), 0);
  const liquidNet = assets - debt;
  return { assets, investments, receivables, debt, netWorth: liquidNet + investments + receivables, reserved, available: liquidNet - reserved };
}
