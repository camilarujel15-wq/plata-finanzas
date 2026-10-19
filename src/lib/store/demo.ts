import type { Account, Budget, Goal, GoalContribution, Transaction } from "../domain/types";
import type { FinanceData } from "./store";
import { seedCategories } from "../domain/defaults";
import { addDays, today } from "../domain/dates";
import { nowISO, uid } from "../domain/ids";

/** Datos de ejemplo realistas (≈4 meses) para explorar la app sin cargar nada. */
export function buildDemoData(): FinanceData {
  const now = nowISO();
  const base = { createdAt: now, updatedAt: now };
  const categories = seedCategories();
  const cat = (key: string) => categories.find((c) => c.key === key)!.id;

  const acc = (name: string, type: Account["type"], initialBalance: number, icon: string, color: string, i: number, creditLimit: number | null = null): Account => ({
    ...base, id: uid(), name, type, initialBalance, icon, color, currency: "PEN", archived: false, sortOrder: i, creditLimit,
  });
  const bcp = acc("BCP Sueldo", "checking", 180000, "🏦", "#2563eb", 0);
  const aho = acc("Ahorros", "savings", 450000, "🐷", "#db2777", 1);
  const yape = acc("Yape", "wallet", 12000, "📱", "#7c3aed", 2);
  const cash = acc("Efectivo", "cash", 8000, "💵", "#16a34a", 3);
  const visa = acc("Visa Interbank", "credit_card", -65000, "💳", "#0f172a", 4, 800000);
  const accounts = [bcp, aho, yape, cash, visa];

  // PRNG determinista para que la demo sea estable.
  let seed = 42;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
  const pick = <T,>(xs: T[]) => xs[Math.floor(rnd() * xs.length)];

  const transactions: Transaction[] = [];
  const add = (t: Omit<Transaction, "id" | "createdAt" | "updatedAt" | "tags" | "source"> & { tags?: string[] }) =>
    transactions.push({ ...base, id: uid(), tags: [], source: "manual", ...t });

  const daily: [string, string, number, number, Account[]][] = [
    ["food", "Almuerzo", 1500, 2800, [yape, cash, bcp]],
    ["food", "Café", 800, 1600, [yape, visa]],
    ["food", "Plaza Vea", 6000, 18000, [visa, bcp]],
    ["transport", "Uber", 1200, 3200, [visa]],
    ["transport", "Metropolitano", 300, 600, [cash]],
    ["fun", "Cineplanet", 2500, 6000, [visa]],
    ["shopping", "Falabella", 8000, 25000, [visa]],
    ["health", "Inkafarma", 2000, 7000, [bcp, yape]],
  ];
  const start = addDays(today(), -120);
  for (let d = 0; d <= 120; d++) {
    const date = addDays(start, d);
    const dom = Number(date.slice(8, 10));
    if (dom === 1) {
      add({ type: "income", amount: 520000, accountId: bcp.id, categoryId: cat("salary"), date, merchant: "Sueldo" });
      add({ type: "expense", amount: 150000, accountId: bcp.id, categoryId: cat("home"), date, merchant: "Alquiler" });
      add({ type: "transfer", amount: 60000, accountId: bcp.id, toAccountId: aho.id, transferKind: "savings", date, note: "Ahorro del mes" });
    }
    if (dom === 5) {
      add({ type: "expense", amount: 11990, accountId: bcp.id, categoryId: cat("utilities"), date, merchant: "Movistar Internet" });
      add({ type: "expense", amount: 4490, accountId: visa.id, categoryId: cat("subscriptions"), date, merchant: "Netflix" });
      add({ type: "expense", amount: 2690, accountId: visa.id, categoryId: cat("subscriptions"), date, merchant: "Spotify" });
    }
    if (dom === 12) add({ type: "expense", amount: 9500 + Math.round(rnd() * 3000), accountId: bcp.id, categoryId: cat("utilities"), date, merchant: "Luz del Sur" });
    if (dom === 15) {
      add({ type: "transfer", amount: 120000, accountId: bcp.id, toAccountId: visa.id, transferKind: "card_payment", date, note: "Pago tarjeta" });
      if (rnd() > 0.5) add({ type: "income", amount: 80000 + Math.round(rnd() * 60000), accountId: bcp.id, categoryId: cat("freelance"), date, merchant: "Proyecto freelance" });
    }
    if (dom === 20) add({ type: "transfer", amount: 10000, accountId: bcp.id, toAccountId: yape.id, transferKind: "internal", date, note: "Recarga Yape" });
    const n = Math.floor(rnd() * 3);
    for (let i = 0; i < n; i++) {
      const [key, merchant, min, max, accs] = pick(daily);
      add({ type: "expense", amount: Math.round((min + rnd() * (max - min)) / 10) * 10, accountId: pick(accs).id, categoryId: cat(key), date, merchant });
    }
    if (dom % 9 === 0) add({ type: "expense", amount: 4500, accountId: yape.id, categoryId: cat("pets"), date, merchant: "Croquetas Max" });
  }

  const budgets: Budget[] = [
    { ...base, id: uid(), categoryId: cat("food"), amount: 90000, thresholds: [50, 80, 100] },
    { ...base, id: uid(), categoryId: cat("transport"), amount: 30000, thresholds: [50, 80, 100] },
    { ...base, id: uid(), categoryId: cat("fun"), amount: 15000, thresholds: [50, 80, 100] },
    { ...base, id: uid(), categoryId: cat("shopping"), amount: 60000, thresholds: [50, 80, 100] },
  ];

  const trip: Goal = { ...base, id: uid(), name: "Viaje a Cusco", targetAmount: 350000, targetDate: addDays(today(), 150), icon: "🏔️", color: "#f97316", archived: false, accountId: aho.id };
  const fund: Goal = { ...base, id: uid(), name: "Fondo de emergencia", targetAmount: 1500000, targetDate: null, icon: "🛡️", color: "#0891b2", archived: false, accountId: aho.id };
  const contributions: GoalContribution[] = [
    { ...base, id: uid(), goalId: trip.id, amount: 80000, date: addDays(today(), -60) },
    { ...base, id: uid(), goalId: trip.id, amount: 60000, date: addDays(today(), -20) },
    { ...base, id: uid(), goalId: fund.id, amount: 300000, date: addDays(today(), -90) },
  ];

  return { accounts, categories, transactions, budgets, goals: [trip, fund], contributions, rules: [], alerts: [] };
}
