import { describe, expect, it } from "vitest";
import { accountBalances, position } from "./balances";
import { convert, normalizeTransactions, toBase } from "./fx";
import { monthTotals } from "./reports";
import type { Account, Transaction } from "./types";

const base = { createdAt: "", updatedAt: "", archived: false, color: "#000", icon: "x", sortOrder: 0 };
const acc = (id: string, type: Account["type"], currency: string, initialBalance: number, extra: Partial<Account> = {}): Account => ({
  ...base, id, name: id, type, currency, initialBalance, ...extra,
});
const tx = (t: Partial<Transaction> & Pick<Transaction, "type" | "amount" | "accountId">): Transaction => ({
  id: Math.random().toString(36), createdAt: "", updatedAt: "", date: "2026-10-10", tags: [], source: "manual", ...t,
});
const fx = { base: "PEN", usdRate: 3.75 };

describe("monedas", () => {
  it("convierte a la moneda principal", () => {
    expect(toBase(10000, "USD", fx)).toBe(37500);
    expect(toBase(37500, "PEN", { base: "USD", usdRate: 3.75 })).toBe(10000);
    expect(convert(37500, "PEN", "USD", fx)).toBe(10000);
  });

  it("transferencia entre monedas usa el monto recibido", () => {
    const accounts = [acc("bcp", "checking", "PEN", 100000), acc("usd", "savings", "USD", 0)];
    const b = accountBalances(accounts, [tx({ type: "transfer", amount: 37000, accountId: "bcp", toAccountId: "usd", toAmount: 10000 })]);
    expect(b.get("bcp")).toBe(63000);
    expect(b.get("usd")).toBe(10000);
  });

  it("totales del mes suman soles y dólares convertidos", () => {
    const accounts = [acc("bcp", "checking", "PEN", 0), acc("usd", "savings", "USD", 0)];
    const txs = [tx({ type: "income", amount: 100000, accountId: "bcp" }), tx({ type: "income", amount: 20000, accountId: "usd" })];
    expect(monthTotals(normalizeTransactions(txs, accounts, fx), "2026-10").income).toBe(175000);
  });
});

describe("inversiones y por cobrar", () => {
  it("suman al patrimonio pero no al disponible", () => {
    const accounts = [
      acc("bcp", "checking", "PEN", 500000),
      acc("usd", "savings", "USD", 100000),
      acc("terreno", "investment", "PEN", 0, { targetAmount: 5000000 }),
      acc("curso", "investment", "PEN", 0, { marketValue: 0 }),
      acc("juan", "receivable", "PEN", 20000),
      acc("visa", "credit_card", "PEN", -30000),
    ];
    const txs = [
      tx({ type: "transfer", amount: 150000, accountId: "bcp", toAccountId: "terreno", transferKind: "investment" }),
      tx({ type: "transfer", amount: 80000, accountId: "bcp", toAccountId: "curso", transferKind: "investment" }),
      tx({ type: "transfer", amount: 5000, accountId: "juan", toAccountId: "bcp", transferKind: "repayment" }),
    ];
    const p = position(accounts, accountBalances(accounts, txs), [], [], fx);
    // líquido: bcp 500000-150000-80000+5000 = 275000 ; usd 100000*3.75 = 375000
    expect(p.assets).toBe(650000);
    expect(p.investments).toBe(150000); // curso con valor actual 0 no suma
    expect(p.receivables).toBe(15000);
    expect(p.debt).toBe(30000);
    // disponible = solo cuentas para gastar (bcp) − tarjeta; los ahorros en dólares no cuentan
    expect(p.spendable).toBe(275000);
    expect(p.available).toBe(245000);
    expect(p.netWorth).toBe(650000 - 30000 + 150000 + 15000);
  });
});

describe("cuentas para gastar y billeteras vinculadas", () => {
  it("Yape vinculado a BCP no duplica el dinero", () => {
    const accounts = [acc("bcp", "checking", "PEN", 100000), acc("yape", "wallet", "PEN", 50000, { linkedAccountId: "bcp" })];
    const txs = [
      tx({ type: "expense", amount: 2000, accountId: "yape" }),
      tx({ type: "transfer", amount: 10000, accountId: "bcp", toAccountId: "yape" }), // "recarga": no cambia nada
    ];
    const b = accountBalances(accounts, txs);
    expect(b.get("bcp")).toBe(98000);
    expect(b.get("yape")).toBe(98000); // muestra el saldo de su banco
    const p = position(accounts, b, [], [], fx);
    expect(p.assets).toBe(98000);
    expect(p.available).toBe(98000);
  });

  it("se puede elegir qué cuentas cuentan para gastar y qué metas se descuentan", () => {
    const accounts = [
      acc("bcp", "checking", "PEN", 100000),
      acc("aho", "savings", "PEN", 500000),
      acc("aho2", "savings", "PEN", 70000, { includeInAvailable: true }),
      acc("cash", "cash", "PEN", 20000, { includeInAvailable: false }),
    ];
    const goal = (id: string, accountId: string | null) => ({ id, name: id, targetAmount: 1, icon: "", color: "", archived: false, accountId, createdAt: "", updatedAt: "" });
    const contrib = (goalId: string, amount: number) => ({ id: goalId + "c", goalId, amount, date: "2026-10-01", createdAt: "", updatedAt: "" });
    const p = position(accounts, accountBalances(accounts, []), [goal("viaje", "aho"), goal("laptop", "bcp")], [contrib("viaje", 300000), contrib("laptop", 10000)], fx);
    expect(p.spendable).toBe(170000);
    expect(p.available).toBe(160000); // solo se descuenta la meta guardada en BCP
    expect(p.netWorth).toBe(690000);
  });
});
