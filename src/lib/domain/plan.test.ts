import { describe, expect, it } from "vitest";
import { addClosings, cardSchedule, closingFor, dueFor, installmentPlan } from "./card";
import { forecastMonth } from "./plan";
import type { Account, RecurringItem, Transaction } from "./types";

const card: Account = {
  id: "visa", name: "Visa", type: "credit_card", currency: "PEN", initialBalance: 0, color: "", icon: "💳",
  archived: false, sortOrder: 0, createdAt: "2026-09-01T00:00:00Z", updatedAt: "", closingDay: 20, dueDay: 15, tea: 60,
};
const tx = (t: Partial<Transaction> & Pick<Transaction, "type" | "amount" | "accountId" | "date">): Transaction => ({
  id: Math.random().toString(36), createdAt: "", updatedAt: "", tags: [], source: "manual", ...t,
});

describe("tarjeta de crédito", () => {
  it("ciclos de facturación y fecha de pago", () => {
    expect(closingFor("2026-10-05", 20)).toBe("2026-10-20");
    expect(closingFor("2026-10-20", 20)).toBe("2026-10-20");
    expect(closingFor("2026-10-21", 20)).toBe("2026-11-20");
    expect(closingFor("2026-02-10", 31)).toBe("2026-02-28");
    expect(addClosings("2026-11-20", 3, 20)).toBe("2027-02-20");
    expect(dueFor("2026-10-20", { dueDay: 15 })).toBe("2026-11-15");
    expect(dueFor("2026-10-05", { dueDay: 28 })).toBe("2026-10-28");
    expect(dueFor("2026-10-20", { dueDay: null })).toBe("2026-11-14"); // +25 días
  });

  it("cuotas con TEA (sistema francés) y sin intereses", () => {
    const p = installmentPlan(120000, 12, 60);
    // i = 1.6^(1/12) − 1 ≈ 3.9944 % mensual
    expect(p.cuota).toBe(12782);
    expect(p.interest).toBe(p.cuota * 12 - 120000);
    expect(installmentPlan(120000, 6, 0)).toEqual({ cuota: 20000, total: 120000, interest: 0 });
  });

  it("calendario: contado vence el mes siguiente, cuotas se difieren y los pagos se aplican a lo más antiguo", () => {
    const txs = [
      tx({ type: "expense", amount: 30000, accountId: "visa", date: "2026-09-25" }), // cierre 20/10 → paga 15/11
      tx({ type: "expense", amount: 60000, accountId: "visa", date: "2026-10-02", installments: 3, installmentRate: 0 }),
      tx({ type: "transfer", amount: 10000, accountId: "bcp", toAccountId: "visa", date: "2026-10-30" }),
    ];
    const s = cardSchedule(card, txs, "2026-11-05");
    expect(s.statements.map((x) => [x.closing, x.due, x.charged, x.remaining])).toEqual([
      ["2026-10-20", "2026-11-15", 50000, 40000],
      ["2026-11-20", "2026-12-15", 20000, 20000],
      ["2026-12-20", "2027-01-15", 20000, 20000],
    ]);
    expect(s.nextDue?.remaining).toBe(40000);
    expect(s.currentDebt).toBe(60000); // estado de octubre + ciclo en curso (noviembre)
    expect(s.deferredPrincipal).toBe(20000);
  });
});

describe("proyección de fin de mes", () => {
  const bcp: Account = { ...card, id: "bcp", name: "BCP", type: "checking", closingDay: null, dueDay: null, tea: null, initialBalance: 0 };
  const item = (p: Partial<RecurringItem>): RecurringItem => ({
    id: Math.random().toString(36), name: "x", type: "expense", amount: 0, accountId: "bcp", dayOfMonth: 1, icon: "🧾", active: true, createdAt: "", updatedAt: "", ...p,
  });
  const fmt = (c: number) => `S/${c / 100}`;

  it("resta fijos pendientes, suma ingresos por recibir y proyecta el gasto variable", () => {
    const luz = item({ name: "Luz", amount: 12000, dayOfMonth: 25 });
    const internet = item({ name: "Internet", amount: 10000, dayOfMonth: 5 });
    const sueldo = item({ name: "Sueldo", type: "income", amount: 500000, dayOfMonth: 30 });
    const txs = [
      tx({ type: "expense", amount: 10000, accountId: "bcp", date: "2026-10-05", recurringId: internet.id }),
      tx({ type: "expense", amount: 20000, accountId: "bcp", date: "2026-10-08" }), // variable
    ];
    const f = forecastMonth({
      accounts: [bcp], categories: [], transactions: txs, baseTransactions: txs, recurring: [luz, internet, sueldo],
      available: 100000, fx: { base: "PEN", usdRate: 3.75 }, fmt, today: "2026-10-10",
    });
    expect(f.bills.map((b) => [b.name, b.status])).toEqual([["Internet", "paid"], ["Luz", "pending"], ["Sueldo", "pending"]]);
    expect(f.pendingOut).toBe(12000);
    expect(f.pendingIn).toBe(500000);
    expect(f.variableDaily).toBe(2000); // 200 soles en 10 días
    expect(f.daysLeft).toBe(22);
    expect(f.projectedEnd).toBe(100000 - 12000 + 500000 - 2000 * 22);
    expect(f.comments[0].tone).toBe("good");
  });
});
