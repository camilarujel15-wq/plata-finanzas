import type { Account, Budget, Goal, GoalContribution, RecurringItem, Transaction } from "../domain/types";
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

  const acc = (name: string, type: Account["type"], initialBalance: number, icon: string, color: string, i: number, creditLimit: number | null = null, extra: Partial<Account> = {}): Account => ({
    ...base, id: uid(), name, type, initialBalance, icon, color, currency: "PEN", archived: false, sortOrder: i, creditLimit, ...extra,
  });
  const bcp = acc("BCP Sueldo", "checking", 180000, "🏦", "#2563eb", 0);
  const aho = acc("Ahorros", "savings", 450000, "🐷", "#db2777", 1);
  const yape = acc("Yape", "wallet", 0, "📱", "#7c3aed", 2, null, { linkedAccountId: bcp.id });
  const cash = acc("Efectivo", "cash", 8000, "💵", "#16a34a", 3);
  const visa = acc("Visa Interbank", "credit_card", -65000, "💳", "#0f172a", 4, 800000, { closingDay: 20, dueDay: 15, tea: 62 });
  const usd = acc("Ahorros dólares", "savings", 120000, "💵", "#0891b2", 5, null, { currency: "USD" });
  const terreno = acc("Terreno Lurín", "investment", 600000, "🏡", "#6366f1", 6, null, { investmentKind: "property", targetAmount: 4500000, note: "Lote 14 · cuota mensual" });
  const curso = acc("Diplomado Data", "investment", 0, "🎓", "#8b5cf6", 7, null, { investmentKind: "education", targetAmount: 320000 });
  const juan = acc("Juan", "receivable", 15000, "👤", "#f59e0b", 8, null, { note: "Mitad de la cena de cumpleaños", dueDate: addDays(today(), 10) });
  const lucia = acc("Lucía", "receivable", 0, "👩", "#ec4899", 9, null, { note: "Préstamo para pasajes", dueDate: addDays(today(), -5) });
  const accounts = [bcp, aho, yape, cash, visa, usd, terreno, curso, juan, lucia];

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
    if (dom === 3) add({ type: "transfer", amount: 75000, accountId: bcp.id, toAccountId: terreno.id, transferKind: "investment", date, note: "Cuota terreno" });
    if (dom === 8 && d > 60) add({ type: "transfer", amount: 40000, accountId: bcp.id, toAccountId: curso.id, transferKind: "investment", date, note: "Cuota diplomado" });
    const n = Math.floor(rnd() * 3);
    for (let i = 0; i < n; i++) {
      const [key, merchant, min, max, accs] = pick(daily);
      add({ type: "expense", amount: Math.round((min + rnd() * (max - min)) / 10) * 10, accountId: pick(accs).id, categoryId: cat(key), date, merchant });
    }
    if (dom % 9 === 0) add({ type: "expense", amount: 4500, accountId: yape.id, categoryId: cat("pets"), date, merchant: "Croquetas Max" });
  }

  add({ type: "expense", amount: 189900, accountId: visa.id, categoryId: cat("shopping"), date: addDays(today(), -40), merchant: "Laptop Ripley", installments: 12, installmentRate: 62 });
  add({ type: "expense", amount: 45000, accountId: visa.id, categoryId: cat("travel"), date: addDays(today(), -12), merchant: "Pasajes Cusco", installments: 3, installmentRate: 0 });
  add({ type: "transfer", amount: 30000, accountId: yape.id, toAccountId: lucia.id, transferKind: "loan", date: addDays(today(), -20), note: "Préstamo a Lucía" });
  add({ type: "transfer", amount: 10000, accountId: lucia.id, toAccountId: yape.id, transferKind: "repayment", date: addDays(today(), -6), note: "Abono Lucía" });

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

  const rec = (name: string, type: RecurringItem["type"], amount: number, dayOfMonth: number, icon: string, accountId: string, extra: Partial<RecurringItem> = {}): RecurringItem => ({
    ...base, id: uid(), name, type, amount, dayOfMonth, icon, accountId, active: true, categoryId: null, toAccountId: null, ...extra,
  });
  const recurring: RecurringItem[] = [
    rec("Sueldo", "income", 520000, 1, "💼", bcp.id, { categoryId: cat("salary") }),
    rec("Alquiler", "expense", 150000, 1, "🏠", bcp.id, { categoryId: cat("home") }),
    rec("Cuota terreno", "transfer", 75000, 3, "🏡", bcp.id, { toAccountId: terreno.id }),
    rec("Internet Movistar", "expense", 11990, 5, "📶", bcp.id, { categoryId: cat("utilities") }),
    rec("Netflix", "expense", 4490, 5, "🎬", visa.id, { categoryId: cat("subscriptions") }),
    rec("Luz del Sur", "expense", 11000, 12, "💡", bcp.id, { categoryId: cat("utilities") }),
    rec("Celular Claro", "expense", 6990, 22, "📱", bcp.id, { categoryId: cat("utilities") }),
  ];

  return { accounts, categories, transactions, budgets, goals: [trip, fund], contributions, rules: [], alerts: [], recurring };
}
