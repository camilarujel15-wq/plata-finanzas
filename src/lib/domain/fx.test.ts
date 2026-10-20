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
    expect(p.available).toBe(620000);
    expect(p.netWorth).toBe(650000 - 30000 + 150000 + 15000);
  });
});
