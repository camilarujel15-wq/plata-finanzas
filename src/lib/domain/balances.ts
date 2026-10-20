import type { Account, Goal, GoalContribution, ISODate, Transaction } from "./types";
import { toBase, type Fx } from "./fx";
import { countsForAvailable } from "./types";

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
  // Billeteras vinculadas (Yape → BCP): sus movimientos afectan a la cuenta de origen.
  const link = new Map<string, string>();
  for (const a of accounts) {
    if (a.linkedAccountId && a.linkedAccountId !== a.id && accounts.some((x) => x.id === a.linkedAccountId)) link.set(a.id, a.linkedAccountId);
  }
  const target = (id: string) => link.get(id) ?? id;
  for (const a of accounts) out.set(a.id, link.has(a.id) ? 0 : a.initialBalance);
  for (const tx of transactions) {
    if (tx.deletedAt) continue;
    if (until && tx.date > until) continue;
    const from = target(tx.accountId);
    if (out.has(from)) out.set(from, out.get(from)! + txDelta({ ...tx, toAccountId: null }, tx.accountId));
    if (tx.type === "transfer" && tx.toAccountId) {
      const to = target(tx.toAccountId);
      if (out.has(to)) out.set(to, out.get(to)! + (tx.toAmount ?? tx.amount));
    }
  }
  // La billetera muestra el saldo de su cuenta vinculada.
  for (const [w, t] of link) out.set(w, out.get(t) ?? 0);
  return out;
}

/** Id de la cuenta que realmente guarda el dinero (resuelve billeteras vinculadas). */
export function moneyAccountId(accounts: Account[], id: string): string {
  return accounts.find((a) => a.id === id)?.linkedAccountId ?? id;
}

export function goalSaved(goalId: string, contributions: GoalContribution[]): number {
  return contributions.reduce((s, c) => (c.goalId === goalId && !c.deletedAt ? s + c.amount : s), 0);
}

export interface Position {
  /** Dinero líquido: bancos, ahorros, wallets y efectivo (en moneda principal). */
  assets: number;
  /** Parte de lo líquido en cuentas marcadas "para gastar". */
  spendable: number;
  /** Deuda de tarjetas marcadas "para gastar" (se descuenta del disponible). */
  spendableDebt: number;
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
   * "Disponible para gastar" = saldo de las cuentas marcadas para gastar − deuda de esas tarjetas
   * − metas guardadas en esas cuentas. Ahorros, inversiones y lo que te deben no cuentan.
   */
  available: number;
}

export function position(
  accounts: Account[],
  balances: Map<string, number>,
  goals: Goal[],
  contributions: GoalContribution[],
  fx: Fx = { base: "PEN", usdRate: 3.75 },
  /** Deuda actual de cada tarjeta sin cuotas futuras (ver cardSchedule). Si se omite, se usa el saldo completo. */
  cardCurrentDebt?: Map<string, number>,
): Position {
  let assets = 0;
  let spendable = 0;
  let spendableDebt = 0;
  let investments = 0;
  let receivables = 0;
  let debt = 0;
  const byId = new Map(accounts.map((a) => [a.id, a]));
  for (const a of accounts) {
    if (a.deletedAt || a.archived || a.linkedAccountId) continue; // billeteras vinculadas no tienen saldo propio
    const b = toBase(balances.get(a.id) ?? 0, a.currency, fx);
    const forSpending = countsForAvailable(a);
    if (a.type === "credit_card") {
      debt += Math.max(0, -b);
      if (forSpending) spendableDebt += cardCurrentDebt?.has(a.id) ? toBase(Math.max(0, cardCurrentDebt.get(a.id)!), a.currency, fx) : Math.max(0, -b);
    } else if (a.type === "investment") investments += a.marketValue != null ? toBase(a.marketValue, a.currency, fx) : b;
    else if (a.type === "receivable") receivables += Math.max(0, b);
    else {
      assets += b;
      if (forSpending) spendable += b;
    }
  }
  const active = goals.filter((g) => !g.deletedAt && !g.archived);
  const reserved = active.reduce((s, g) => s + Math.max(0, goalSaved(g.id, contributions)), 0);
  // Solo se descuenta lo apartado en metas cuyo dinero está en una cuenta "para gastar" (o sin cuenta asignada).
  const reservedInSpendable = active
    .filter((g) => {
      const acc = g.accountId ? byId.get(g.accountId) : undefined;
      return !acc || countsForAvailable(acc);
    })
    .reduce((s, g) => s + Math.max(0, goalSaved(g.id, contributions)), 0);
  return {
    assets,
    spendable,
    spendableDebt,
    investments,
    receivables,
    debt,
    netWorth: assets - debt + investments + receivables,
    reserved,
    available: spendable - spendableDebt - reservedInSpendable,
  };
}
