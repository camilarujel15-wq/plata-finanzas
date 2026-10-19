import { describe, expect, it } from "vitest";
import { seedCategories } from "./defaults";
import { parseEntry } from "./parse";
import { learnRule, suggestCategory } from "./categorize";
import { accountBalances, position } from "./balances";
import { budgetStatus, pendingAlert } from "./budgets";
import { formatMoney, parseAmount } from "./money";
import { merchantKey } from "./text";
import type { Account, Transaction } from "./types";

const cats = seedCategories();
const cat = (key: string) => cats.find((c) => c.key === key)!.id;
const base = { createdAt: "", updatedAt: "", archived: false, currency: "PEN", color: "#000", icon: "x", sortOrder: 0 };
const accounts: Account[] = [
  { ...base, id: "cash", name: "Efectivo", type: "cash", initialBalance: 10000 },
  { ...base, id: "bcp", name: "BCP", type: "checking", initialBalance: 500000 },
  { ...base, id: "yape", name: "Yape", type: "wallet", initialBalance: 0 },
  { ...base, id: "aho", name: "Ahorros", type: "savings", initialBalance: 0 },
  { ...base, id: "visa", name: "Visa Interbank", type: "credit_card", initialBalance: -20000 },
];
const ctx = { accounts, categories: cats, rules: [], now: "2026-10-19" }; // lunes

describe("parseEntry", () => {
  it("Gasté 18 soles en almuerzo", () => {
    const p = parseEntry("Gasté 18 soles en almuerzo", ctx);
    expect(p).toMatchObject({ type: "expense", amount: 1800, categoryId: cat("food"), date: "2026-10-19" });
  });
  it("Pagué 120 soles de internet", () => {
    const p = parseEntry("Pagué 120 soles de internet", ctx);
    expect(p).toMatchObject({ type: "expense", amount: 12000, categoryId: cat("utilities") });
  });
  it("detecta fecha relativa y cuenta", () => {
    const p = parseEntry("ayer 25.50 taxi con yape", ctx);
    expect(p).toMatchObject({ amount: 2550, date: "2026-10-18", accountId: "yape", categoryId: cat("transport") });
  });
  it("ingresos", () => {
    const p = parseEntry("me pagaron 2,500 de sueldo", ctx);
    expect(p).toMatchObject({ type: "income", amount: 250000, categoryId: cat("salary") });
    expect(parseEntry("2500 sueldo", ctx)).toMatchObject({ type: "income", categoryId: cat("salary") });
  });
  it("transferencias y pago de tarjeta", () => {
    expect(parseEntry("pasé 300 de bcp a ahorros", ctx)).toMatchObject({
      type: "transfer", amount: 30000, accountId: "bcp", toAccountId: "aho", transferKind: "savings",
    });
    expect(parseEntry("pagué la tarjeta 800 desde bcp", ctx)).toMatchObject({
      type: "transfer", amount: 80000, accountId: "bcp", toAccountId: "visa", transferKind: "card_payment",
    });
  });
  it("días de la semana, fecha numérica y 'mil'", () => {
    expect(parseEntry("el sábado 40 cine", ctx).date).toBe("2026-10-17");
    expect(parseEntry("15/10 35 farmacia", ctx)).toMatchObject({ date: "2026-10-15", amount: 3500, categoryId: cat("health") });
    expect(parseEntry("recibí 2 mil de freelance", ctx)).toMatchObject({ amount: 200000, type: "income" });
  });
  it("cuenta por alias de tipo", () => {
    expect(parseEntry("30 menú en efectivo", ctx).accountId).toBe("cash");
    expect(parseEntry("200 zapatillas con tarjeta", ctx).accountId).toBe("visa");
  });
});

describe("categorización con aprendizaje", () => {
  it("las reglas del usuario ganan al diccionario", () => {
    expect(suggestCategory("COMPRA POS TAMBO 0231 LIMA", "expense", cats, [])?.categoryId).toBe(cat("food"));
    const { rules } = learnRule([], "COMPRA POS TAMBO 0231 LIMA", cat("shopping"));
    expect(rules[0].pattern).toBe("tambo");
    expect(suggestCategory("compra pos tambo 9999", "expense", cats, rules)?.categoryId).toBe(cat("shopping"));
  });
  it("merchantKey limpia el ruido bancario", () => {
    expect(merchantKey("COMPRA POS PLAZA VEA 0123 LIMA PE")).toBe("plaza vea");
  });
});

describe("saldos y disponible real", () => {
  const txs: Transaction[] = [
    { id: "1", createdAt: "", updatedAt: "", type: "expense", amount: 5000, accountId: "visa", date: "2026-10-01", tags: [], source: "manual", categoryId: cat("food") },
    { id: "2", createdAt: "", updatedAt: "", type: "transfer", amount: 20000, accountId: "bcp", toAccountId: "visa", transferKind: "card_payment", date: "2026-10-02", tags: [], source: "manual" },
    { id: "3", createdAt: "", updatedAt: "", type: "income", amount: 100000, accountId: "bcp", date: "2026-10-03", tags: [], source: "manual", categoryId: cat("salary") },
    { id: "4", createdAt: "", updatedAt: "", deletedAt: "x", type: "expense", amount: 99999, accountId: "bcp", date: "2026-10-03", tags: [], source: "manual" },
  ];
  it("calcula saldos por cuenta", () => {
    const b = accountBalances(accounts, txs);
    expect(b.get("visa")).toBe(-5000);
    expect(b.get("bcp")).toBe(580000);
  });
  it("disponible = activos − deuda − metas", () => {
    const b = accountBalances(accounts, txs);
    const goal = { id: "g", name: "Viaje", targetAmount: 100000, icon: "", color: "", archived: false, createdAt: "", updatedAt: "" };
    const p = position(accounts, b, [goal], [{ id: "c", goalId: "g", amount: 30000, date: "2026-10-01", createdAt: "", updatedAt: "" }]);
    expect(p).toMatchObject({ assets: 590000, debt: 5000, netWorth: 585000, reserved: 30000, available: 555000 });
  });
});

describe("presupuestos", () => {
  it("alerta solo el umbral más alto no notificado", () => {
    const budget = { id: "b", categoryId: cat("food"), amount: 10000, thresholds: [50, 80, 100], createdAt: "", updatedAt: "" };
    const tx = (amount: number): Transaction => ({ id: String(amount), createdAt: "", updatedAt: "", type: "expense", amount, accountId: "cash", categoryId: cat("food"), date: "2026-10-05", tags: [], source: "manual" });
    const st = budgetStatus(budget, [tx(8500)], "2026-10");
    expect(st.level).toBe("warn");
    expect(pendingAlert(st, "2026-10", [])).toBe(80);
    expect(pendingAlert(st, "2026-10", [{ id: "a", budgetId: "b", period: "2026-10", threshold: 80, createdAt: "", updatedAt: "" }])).toBeNull();
  });
});

describe("dinero", () => {
  it("parsea y formatea", () => {
    expect(parseAmount("18,50")).toBe(1850);
    expect(parseAmount("1,234")).toBe(123400);
    expect(parseAmount("1.234,56")).toBe(123456);
    expect(formatMoney(123450).replace(/\s/g, " ")).toMatch(/S\/ ?1,234\.50/);
  });
});
