import type { Account, Category, ISODate, RecurringItem, Transaction } from "./types";
import { countsForAvailable } from "./types";
import { addDays, daysBetween, daysInPeriod, periodOf } from "./dates";
import { cardSchedule, type CardSchedule } from "./card";
import { toBase, type Fx } from "./fx";
import { normalize } from "./text";

export type BillStatus = "paid" | "pending" | "overdue";

export interface Bill {
  id: string;
  item?: RecurringItem;
  name: string;
  icon: string;
  kind: "expense" | "income" | "transfer" | "card";
  /** Monto en la moneda principal. */
  amount: number;
  /** Monto en la moneda de la cuenta (para registrar el pago). */
  nativeAmount: number;
  currency: string;
  due: ISODate;
  status: BillStatus;
  /** ¿Afecta lo disponible para gastar? (p. ej. el pago de una tarjeta ya descontada no vuelve a restar). */
  affectsForecast: boolean;
  cardId?: string;
  paidTxId?: string;
}

export interface Comment {
  tone: "good" | "warn" | "bad" | "info";
  icon: string;
  text: string;
}

export interface MonthForecast {
  today: ISODate;
  daysLeft: number;
  available: number;
  bills: Bill[];
  pendingOut: number;
  pendingIn: number;
  variableDaily: number;
  variableRest: number;
  /** Disponible proyectado al último día del mes. */
  projectedEnd: number;
  /** Lo que puedes gastar por día en lo variable sin quedarte en rojo. */
  safePerDay: number;
  cards: { card: Account; schedule: CardSchedule }[];
  comments: Comment[];
}

const dueDate = (period: string, day: number) => `${period}-${String(Math.min(day, daysInPeriod(period))).padStart(2, "0")}`;

/** ¿Hay un movimiento de este mes que corresponde a este gasto fijo? */
function findPayment(item: RecurringItem, txs: Transaction[], period: string): Transaction | undefined {
  const inMonth = txs.filter((t) => !t.deletedAt && periodOf(t.date) === period && t.type === item.type);
  const byId = inMonth.find((t) => t.recurringId === item.id);
  if (byId) return byId;
  const name = normalize(item.name);
  return inMonth.find((t) => {
    if (t.recurringId) return false;
    const close = Math.abs(t.amount - item.amount) <= Math.max(500, item.amount * 0.25);
    if (item.type === "transfer") return t.toAccountId === item.toAccountId && close;
    const sameName = !!name && normalize(`${t.merchant ?? ""} ${t.note ?? ""}`).includes(name);
    return (sameName || (t.categoryId && t.categoryId === item.categoryId)) && close;
  });
}

interface Input {
  accounts: Account[];
  categories: Category[];
  /** Movimientos originales (moneda de cada cuenta). */
  transactions: Transaction[];
  /** Movimientos en moneda principal. */
  baseTransactions: Transaction[];
  recurring: RecurringItem[];
  available: number;
  fx: Fx;
  fmt: (cents: number) => string;
  today: ISODate;
}

/**
 * Proyección de fin de mes:
 *   disponible hoy − gastos fijos pendientes + ingresos por recibir − gasto variable estimado
 * El gasto variable estimado usa tu ritmo del mes (o de los últimos 60 días al inicio del mes),
 * excluyendo los gastos fijos para no contarlos dos veces.
 */
export function forecastMonth(input: Input): MonthForecast {
  const { accounts, transactions, baseTransactions, recurring, available, fx, fmt, today } = input;
  const period = periodOf(today);
  const day = Number(today.slice(8, 10));
  const daysLeft = daysInPeriod(period) - day + 1;
  const byId = new Map(accounts.map((a) => [a.id, a]));
  const bills: Bill[] = [];

  for (const item of recurring.filter((r) => !r.deletedAt && r.active)) {
    const acc = byId.get(item.accountId);
    if (!acc || acc.deletedAt) continue;
    const due = dueDate(period, item.dayOfMonth);
    const paid = findPayment(item, transactions, period);
    const fromSpendable = countsForAvailable(acc) || !!acc.linkedAccountId;
    bills.push({
      id: item.id,
      item,
      name: item.name,
      icon: item.icon,
      kind: item.type,
      amount: toBase(item.amount, acc.currency, fx),
      nativeAmount: item.amount,
      currency: acc.currency,
      due,
      status: paid ? "paid" : due < today ? "overdue" : "pending",
      // Un gasto pagado con tarjeta "para gastar" ya se descuenta como deuda de la tarjeta al usarla.
      affectsForecast: item.type === "income" ? fromSpendable : fromSpendable && acc.type !== "credit_card",
      paidTxId: paid?.id,
    });
  }

  const cards = accounts
    .filter((a) => a.type === "credit_card" && !a.deletedAt && !a.archived)
    .map((card) => ({ card, schedule: cardSchedule(card, transactions, today) }));
  for (const { card, schedule } of cards) {
    // Estados de cuenta que vencen este mes (o ya vencidos sin pagar).
    for (const s of schedule.statements) {
      if (s.closing >= today || periodOf(s.due) > period) continue;
      if (s.remaining <= 0 && periodOf(s.due) !== period) continue;
      bills.push({
        id: `card-${card.id}-${s.closing}`,
        name: `Pago ${card.name}`,
        icon: card.icon,
        kind: "card",
        amount: toBase(s.remaining > 0 ? s.remaining : s.charged, card.currency, fx),
        nativeAmount: s.remaining > 0 ? s.remaining : s.charged,
        currency: card.currency,
        due: s.due,
        status: s.remaining <= 0 ? "paid" : s.due < today ? "overdue" : "pending",
        // Si la tarjeta cuenta para gastar, su deuda ya está restada del disponible.
        affectsForecast: !countsForAvailable(card),
        cardId: card.id,
      });
    }
  }
  bills.sort((a, b) => a.due.localeCompare(b.due));

  const open = bills.filter((b) => b.status !== "paid" && b.affectsForecast);
  const pendingOut = open.filter((b) => b.kind !== "income").reduce((s, b) => s + b.amount, 0);
  const pendingIn = open.filter((b) => b.kind === "income").reduce((s, b) => s + b.amount, 0);

  // Gasto variable: todo gasto que no es un gasto fijo.
  const fixedCats = new Set(recurring.filter((r) => !r.deletedAt && r.active && r.type === "expense" && r.categoryId).map((r) => r.categoryId!));
  const fixedTx = new Set(bills.map((b) => b.paidTxId).filter(Boolean));
  const isVariable = (t: Transaction) => t.type === "expense" && !t.deletedAt && !t.recurringId && !fixedTx.has(t.id) && !(t.categoryId && fixedCats.has(t.categoryId));
  const monthVar = baseTransactions.filter((t) => isVariable(t) && periodOf(t.date) === period && t.date <= today).reduce((s, t) => s + t.amount, 0);
  const since = addDays(today, -60);
  const last60 = baseTransactions.filter((t) => isVariable(t) && t.date > since && t.date <= today).reduce((s, t) => s + t.amount, 0);
  const variableDaily = day >= 7 ? Math.round(monthVar / day) : Math.round(last60 / 60);
  const variableRest = variableDaily * daysLeft;

  const beforeVariable = available - pendingOut + pendingIn;
  const projectedEnd = beforeVariable - variableRest;
  const safePerDay = Math.max(0, Math.floor(beforeVariable / daysLeft));

  // ───────── Comentarios ─────────
  const comments: Comment[] = [];
  if (projectedEnd >= 0) {
    comments.push({
      tone: "good",
      icon: "✅",
      text: `A tu ritmo actual llegas a fin de mes con ${fmt(projectedEnd)} de sobra, ya contando tus gastos fijos.`,
    });
  } else {
    const cut = Math.ceil(-projectedEnd / daysLeft);
    comments.push({
      tone: "bad",
      icon: "🚨",
      text: `A tu ritmo actual te faltarían ${fmt(-projectedEnd)}. Baja tu gasto diario de ${fmt(variableDaily)} a ${fmt(Math.max(0, variableDaily - cut))} para llegar.`,
    });
  }
  if (pendingOut > 0) {
    comments.push({ tone: "info", icon: "🧾", text: `Te quedan ${fmt(pendingOut)} en gastos fijos por pagar este mes.` });
  }
  const overdue = bills.filter((b) => b.status === "overdue");
  if (overdue.length) {
    comments.push({ tone: "bad", icon: "⏰", text: `Tienes ${overdue.length === 1 ? "un pago vencido" : `${overdue.length} pagos vencidos`}: ${overdue.map((b) => b.name).join(", ")}.` });
  }
  const soon = bills.filter((b) => b.status === "pending" && daysBetween(today, b.due) <= 3);
  for (const b of soon.slice(0, 2)) {
    const d = daysBetween(today, b.due);
    comments.push({ tone: "warn", icon: b.icon, text: `${b.name} vence ${d === 0 ? "hoy" : d === 1 ? "mañana" : `en ${d} días`} (${fmt(b.amount)}).` });
  }
  for (const { card, schedule } of cards) {
    if (schedule.nextDue && schedule.nextDue.remaining > 0) {
      comments.push({
        tone: "info",
        icon: "💳",
        text: `${card.name}: paga ${fmt(toBase(schedule.nextDue.remaining, card.currency, fx))} hasta el ${schedule.nextDue.due.slice(8, 10)}/${schedule.nextDue.due.slice(5, 7)} para no pagar intereses.`,
      });
    }
    if (schedule.futureInterest > 0) {
      comments.push({
        tone: "warn",
        icon: "📈",
        text: `Tus compras en cuotas con ${card.name} aún te costarán ${fmt(toBase(schedule.futureInterest, card.currency, fx))} en intereses.`,
      });
    }
  }
  if (pendingIn > 0) comments.push({ tone: "info", icon: "💼", text: `Aún esperas ${fmt(pendingIn)} en ingresos fijos este mes.` });

  return { today, daysLeft, available, bills, pendingOut, pendingIn, variableDaily, variableRest, projectedEnd, safePerDay, cards, comments };
}
