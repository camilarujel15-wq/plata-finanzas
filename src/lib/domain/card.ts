import type { Account, ISODate, Transaction } from "./types";
import { parseISODate, toISODate } from "./dates";

/**
 * Tarjetas de crédito (modelo peruano):
 *  - Las compras entre dos fechas de cierre (corte) se facturan en el estado de cuenta de ese cierre.
 *  - El pago vence el día de pago siguiente al cierre (≈25 días después). Pagar el total = sin intereses.
 *  - Las compras en cuotas se reparten: la cuota k llega en el k-ésimo estado de cuenta desde la compra.
 *    Con TEA, la cuota se calcula con el sistema francés: P·i / (1 − (1+i)^−n), i = (1+TEA)^(1/12) − 1.
 */

export const DEFAULT_CLOSING_DAY = 20;
export const DEFAULT_DUE_GAP_DAYS = 25;

export function monthlyRate(teaPercent: number): number {
  return teaPercent > 0 ? Math.pow(1 + teaPercent / 100, 1 / 12) - 1 : 0;
}

/** Cuota mensual en céntimos (sistema francés; sin intereses = monto / n). */
export function installmentAmount(principal: number, n: number, teaPercent: number): number {
  if (n <= 1) return principal;
  const i = monthlyRate(teaPercent);
  if (i === 0) return Math.round(principal / n);
  return Math.round((principal * i) / (1 - Math.pow(1 + i, -n)));
}

export function installmentPlan(principal: number, n: number, teaPercent: number) {
  const cuota = installmentAmount(principal, n, teaPercent);
  const total = n <= 1 ? principal : cuota * n;
  return { cuota, total, interest: total - principal };
}

const clampDay = (y: number, m: number, d: number) => new Date(y, m, Math.min(d, new Date(y, m + 1, 0).getDate()));

/** Fecha de cierre del estado de cuenta que incluye una compra hecha en `date`. */
export function closingFor(date: ISODate, closingDay: number): ISODate {
  const d = parseISODate(date);
  const thisMonth = clampDay(d.getFullYear(), d.getMonth(), closingDay);
  return toISODate(d <= thisMonth ? thisMonth : clampDay(d.getFullYear(), d.getMonth() + 1, closingDay));
}

/** Cierre `k` meses después de un cierre dado. */
export function addClosings(closing: ISODate, k: number, closingDay: number): ISODate {
  const d = parseISODate(closing);
  return toISODate(clampDay(d.getFullYear(), d.getMonth() + k, closingDay));
}

/** Fecha límite de pago de un estado de cuenta. */
export function dueFor(closing: ISODate, card: Pick<Account, "dueDay">): ISODate {
  const c = parseISODate(closing);
  if (!card.dueDay) {
    const d = new Date(c);
    d.setDate(d.getDate() + DEFAULT_DUE_GAP_DAYS);
    return toISODate(d);
  }
  const same = clampDay(c.getFullYear(), c.getMonth(), card.dueDay);
  return toISODate(same > c ? same : clampDay(c.getFullYear(), c.getMonth() + 1, card.dueDay));
}

export interface Statement {
  closing: ISODate;
  due: ISODate;
  /** Total facturado (compras al contado + cuotas que caen en este ciclo). */
  charged: number;
  /** Parte de intereses incluida en `charged`. */
  interest: number;
  paid: number;
  remaining: number;
}

export interface CardSchedule {
  statements: Statement[];
  /** Lo que se debe hoy sin contar cuotas futuras (estados vencidos/por vencer + ciclo actual). */
  currentDebt: number;
  /** Capital de cuotas que se facturarán en ciclos futuros. */
  deferredPrincipal: number;
  /** Intereses aún por pagar en cuotas futuras. */
  futureInterest: number;
  /** El estado de cuenta cerrado más próximo a vencer con saldo pendiente. */
  nextDue: Statement | null;
}

/** Calendario de pagos de una tarjeta a partir de sus movimientos. */
export function cardSchedule(card: Account, txs: Transaction[], today: ISODate): CardSchedule {
  const closingDay = card.closingDay ?? DEFAULT_CLOSING_DAY;
  const map = new Map<ISODate, { charged: number; interest: number }>();
  const add = (closing: ISODate, amount: number, interest = 0) => {
    const cur = map.get(closing) ?? { charged: 0, interest: 0 };
    cur.charged += amount;
    cur.interest += interest;
    map.set(closing, cur);
  };
  // Deuda inicial: se considera facturada en el ciclo en que se registró la tarjeta.
  if (card.initialBalance < 0) add(closingFor((card.createdAt || today).slice(0, 10), closingDay), -card.initialBalance);

  const payments: { date: ISODate; amount: number }[] = [];
  for (const t of txs) {
    if (t.deletedAt) continue;
    if (t.type === "expense" && t.accountId === card.id) {
      const first = closingFor(t.date, closingDay);
      const n = Math.max(1, t.installments ?? 1);
      if (n === 1) add(first, t.amount);
      else {
        const rate = t.installmentRate ?? card.tea ?? 0;
        const { cuota, interest } = installmentPlan(t.amount, n, rate);
        const perInterest = Math.round(interest / n);
        for (let k = 0; k < n; k++) add(addClosings(first, k, closingDay), k === n - 1 ? cuota + (t.amount + interest - cuota * n) : cuota, perInterest);
      }
    } else if (t.type === "transfer" && t.accountId === card.id) {
      add(closingFor(t.date, closingDay), t.amount); // disposición de efectivo / traspaso desde la tarjeta
    } else if (t.type === "income" && t.accountId === card.id) {
      payments.push({ date: t.date, amount: t.amount }); // devoluciones/abonos
    } else if (t.type === "transfer" && t.toAccountId === card.id) {
      payments.push({ date: t.date, amount: t.toAmount ?? t.amount });
    }
  }

  // Los pagos se aplican a los estados más antiguos primero.
  let pool = payments.reduce((s, p) => s + p.amount, 0);
  const statements: Statement[] = [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([closing, v]) => {
      const paid = Math.min(pool, v.charged);
      pool -= paid;
      return { closing, due: dueFor(closing, card), charged: v.charged, interest: v.interest, paid, remaining: v.charged - paid };
    });

  const currentClosing = closingFor(today, closingDay);
  let currentDebt = 0;
  let deferredPrincipal = 0;
  let futureInterest = 0;
  for (const s of statements) {
    if (s.closing <= currentClosing) currentDebt += s.remaining;
    else {
      deferredPrincipal += s.remaining - s.interest;
      futureInterest += s.interest;
    }
  }
  const nextDue = statements.find((s) => s.closing < today && s.remaining > 0) ?? null;
  return { statements, currentDebt, deferredPrincipal, futureInterest, nextDue };
}
