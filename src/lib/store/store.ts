"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type {
  Account,
  Budget,
  BudgetAlert,
  Category,
  CategoryRule,
  Goal,
  GoalContribution,
  RecurringItem,
  Settings,
  Syncable,
  Transaction,
} from "../domain/types";
import { seedCategories } from "../domain/defaults";
import { nowISO, uid } from "../domain/ids";
import { learnRule } from "../domain/categorize";
import { budgetStatus, pendingAlert } from "../domain/budgets";
import { periodOf } from "../domain/dates";
import { idbStorage } from "./idb-storage";

/** Colecciones sincronizables (cada una mapea a una tabla en Supabase). */
export interface FinanceData {
  accounts: Account[];
  categories: Category[];
  transactions: Transaction[];
  budgets: Budget[];
  goals: Goal[];
  contributions: GoalContribution[];
  rules: CategoryRule[];
  alerts: BudgetAlert[];
  recurring: RecurringItem[];
}

export type Collection = keyof FinanceData;
export const COLLECTIONS: Collection[] = [
  "accounts",
  "categories",
  "transactions",
  "budgets",
  "goals",
  "contributions",
  "rules",
  "alerts",
  "recurring",
];

export interface OutboxItem {
  c: Collection;
  id: string;
}

export interface Notice {
  kind: "budget";
  title: string;
  body: string;
}

type NewTx = Omit<Transaction, keyof Syncable | "tags" | "source"> &
  Partial<Pick<Transaction, "tags" | "source" | "id">>;

interface Actions {
  // Movimientos
  addTransaction(input: NewTx): { tx: Transaction; notices: Notice[] };
  updateTransaction(id: string, patch: Partial<Transaction>): { notices: Notice[] };
  deleteTransaction(id: string): void;
  restoreTransaction(id: string): void;
  importTransactions(txs: NewTx[], learn: { text: string; categoryId: string }[]): number;
  // Catálogos
  upsertAccount(a: Partial<Account> & Pick<Account, "name" | "type">): Account;
  deleteAccount(id: string): void;
  upsertCategory(c: Partial<Category> & Pick<Category, "name" | "kind">): Category;
  deleteCategory(id: string): void;
  upsertBudget(categoryId: string, amount: number): void;
  deleteBudget(id: string): void;
  upsertGoal(g: Partial<Goal> & Pick<Goal, "name" | "targetAmount">): Goal;
  deleteGoal(id: string): void;
  addContribution(goalId: string, amount: number, note?: string): void;
  deleteContribution(id: string): void;
  deleteRule(id: string): void;
  upsertRecurring(r: Partial<RecurringItem> & Pick<RecurringItem, "name" | "type" | "amount" | "accountId" | "dayOfMonth">): RecurringItem;
  deleteRecurring(id: string): void;
  // Ajustes y datos
  setSettings(patch: Partial<Settings>): void;
  replaceAll(data: FinanceData, settings?: Partial<Settings>): void;
  mergeRemote(c: Collection, rows: Syncable[]): void;
  ackOutbox(items: OutboxItem[]): void;
  markAllDirty(): void;
  setLastPulledAt(v: string | null): void;
}

export interface State extends FinanceData {
  settings: Settings;
  outbox: OutboxItem[];
  lastPulledAt: string | null;
  hydrated: boolean;
}

const initialSettings: Settings = {
  currency: "PEN",
  locale: "es-PE",
  displayName: "",
  defaultAccountId: null,
  lastAccountId: null,
  onboarded: false,
};

const emptyData = (): FinanceData => ({
  accounts: [],
  categories: seedCategories(),
  transactions: [],
  budgets: [],
  goals: [],
  contributions: [],
  rules: [],
  alerts: [],
  recurring: [],
});

function stamp<T extends Syncable>(row: Omit<T, keyof Syncable> & Partial<Syncable>): T {
  const now = nowISO();
  return { ...row, id: row.id ?? uid(), createdAt: row.createdAt ?? now, updatedAt: now } as T;
}

function upsert<T extends Syncable>(list: T[], row: T): T[] {
  const i = list.findIndex((x) => x.id === row.id);
  if (i === -1) return [...list, row];
  const copy = list.slice();
  copy[i] = row;
  return copy;
}

function enqueue(outbox: OutboxItem[], c: Collection, id: string): OutboxItem[] {
  return outbox.some((o) => o.c === c && o.id === id) ? outbox : [...outbox, { c, id }];
}

const learnText = (t: Pick<Transaction, "merchant" | "note">) => t.merchant || t.note || "";

export const useStore = create<State & Actions>()(
  persist(
    (set, get) => {
      /** Calcula avisos de presupuesto tras registrar un gasto y deja constancia para no repetirlos. */
      function checkBudget(tx: Transaction): Notice[] {
        if (tx.type !== "expense" || !tx.categoryId) return [];
        const s = get();
        const budget = s.budgets.find((b) => !b.deletedAt && b.categoryId === tx.categoryId);
        if (!budget) return [];
        const period = periodOf(tx.date);
        const status = budgetStatus(budget, s.transactions, period);
        const threshold = pendingAlert(status, period, s.alerts);
        if (threshold === null) return [];
        const alert = stamp<BudgetAlert>({ budgetId: budget.id, period, threshold });
        set((st) => ({ alerts: [...st.alerts, alert], outbox: enqueue(st.outbox, "alerts", alert.id) }));
        const cat = s.categories.find((c) => c.id === tx.categoryId);
        const pct = Math.round(status.ratio * 100);
        return [
          {
            kind: "budget",
            title:
              threshold >= 100
                ? `${cat?.icon ?? ""} Superaste el presupuesto de ${cat?.name}`
                : `${cat?.icon ?? ""} ${cat?.name}: ${pct}% del presupuesto`,
            body:
              threshold >= 100
                ? "Considera mover dinero de otra categoría o ajustar el límite."
                : threshold >= 80
                  ? "Vas rápido este mes. Revisa antes de tu próxima compra."
                  : "Vas a la mitad de tu presupuesto.",
          },
        ];
      }

      function teach(text: string, categoryId: string) {
        if (!text) return;
        const { rules, changed } = learnRule(get().rules, text, categoryId);
        if (changed) set((st) => ({ rules, outbox: enqueue(st.outbox, "rules", changed.id) }));
      }

      return {
        ...emptyData(),
        settings: initialSettings,
        outbox: [],
        lastPulledAt: null,
        hydrated: false,

        addTransaction(input) {
          const tx = stamp<Transaction>({ tags: [], source: "manual", ...input });
          set((s) => ({
            transactions: [...s.transactions, tx],
            outbox: enqueue(s.outbox, "transactions", tx.id),
            settings: { ...s.settings, lastAccountId: tx.accountId },
          }));
          if (tx.categoryId && tx.type !== "transfer") teach(learnText(tx), tx.categoryId);
          return { tx, notices: checkBudget(tx) };
        },

        updateTransaction(id, patch) {
          const prev = get().transactions.find((t) => t.id === id);
          if (!prev) return { notices: [] };
          const tx: Transaction = { ...prev, ...patch, updatedAt: nowISO() };
          set((s) => ({ transactions: upsert(s.transactions, tx), outbox: enqueue(s.outbox, "transactions", id) }));
          // Aprendizaje: el usuario corrigió la categoría.
          if (tx.categoryId && tx.categoryId !== prev.categoryId) teach(learnText(tx), tx.categoryId);
          return { notices: checkBudget(tx) };
        },

        deleteTransaction(id) {
          set((s) => ({
            transactions: s.transactions.map((t) => (t.id === id ? { ...t, deletedAt: nowISO(), updatedAt: nowISO() } : t)),
            outbox: enqueue(s.outbox, "transactions", id),
          }));
        },

        restoreTransaction(id) {
          set((s) => ({
            transactions: s.transactions.map((t) => (t.id === id ? { ...t, deletedAt: null, updatedAt: nowISO() } : t)),
            outbox: enqueue(s.outbox, "transactions", id),
          }));
        },

        importTransactions(inputs, learn) {
          const importId = uid();
          const rows = inputs.map((i) => stamp<Transaction>({ tags: [], ...i, source: "import", importId }));
          set((s) => ({
            transactions: [...s.transactions, ...rows],
            outbox: rows.reduce((o, r) => enqueue(o, "transactions", r.id), s.outbox),
          }));
          for (const l of learn) teach(l.text, l.categoryId);
          return rows.length;
        },

        upsertAccount(a) {
          const prev = a.id ? get().accounts.find((x) => x.id === a.id) : undefined;
          const row = stamp<Account>({
            currency: get().settings.currency,
            initialBalance: 0,
            color: "#2563eb",
            icon: "🏦",
            archived: false,
            sortOrder: get().accounts.length,
            creditLimit: null,
            ...prev,
            ...a,
          });
          set((s) => ({
            accounts: upsert(s.accounts, row),
            outbox: enqueue(s.outbox, "accounts", row.id),
            settings: s.settings.defaultAccountId ? s.settings : { ...s.settings, defaultAccountId: row.id },
          }));
          return row;
        },

        deleteAccount(id) {
          const used = get().transactions.some((t) => !t.deletedAt && (t.accountId === id || t.toAccountId === id));
          set((s) => ({
            // Con movimientos se archiva (conserva historial); sin movimientos se elimina.
            accounts: s.accounts.map((a) =>
              a.id === id ? { ...a, ...(used ? { archived: true } : { deletedAt: nowISO() }), updatedAt: nowISO() } : a,
            ),
            outbox: enqueue(s.outbox, "accounts", id),
            settings: {
              ...s.settings,
              defaultAccountId: s.settings.defaultAccountId === id ? null : s.settings.defaultAccountId,
              lastAccountId: s.settings.lastAccountId === id ? null : s.settings.lastAccountId,
            },
          }));
        },

        upsertCategory(c) {
          const prev = c.id ? get().categories.find((x) => x.id === c.id) : undefined;
          const row = stamp<Category>({
            icon: "🏷️",
            color: "#64748b",
            isDefault: false,
            archived: false,
            sortOrder: get().categories.length,
            ...prev,
            ...c,
          });
          set((s) => ({ categories: upsert(s.categories, row), outbox: enqueue(s.outbox, "categories", row.id) }));
          return row;
        },

        deleteCategory(id) {
          set((s) => ({
            categories: s.categories.map((c) => (c.id === id ? { ...c, archived: true, updatedAt: nowISO() } : c)),
            outbox: enqueue(s.outbox, "categories", id),
          }));
        },

        upsertBudget(categoryId, amount) {
          const prev = get().budgets.find((b) => !b.deletedAt && b.categoryId === categoryId);
          const row = stamp<Budget>({ thresholds: [50, 80, 100], ...prev, categoryId, amount });
          set((s) => ({ budgets: upsert(s.budgets, row), outbox: enqueue(s.outbox, "budgets", row.id) }));
        },

        deleteBudget(id) {
          set((s) => ({
            budgets: s.budgets.map((b) => (b.id === id ? { ...b, deletedAt: nowISO(), updatedAt: nowISO() } : b)),
            outbox: enqueue(s.outbox, "budgets", id),
          }));
        },

        upsertGoal(g) {
          const prev = g.id ? get().goals.find((x) => x.id === g.id) : undefined;
          const row = stamp<Goal>({ icon: "🎯", color: "#16a34a", archived: false, targetDate: null, accountId: null, ...prev, ...g });
          set((s) => ({ goals: upsert(s.goals, row), outbox: enqueue(s.outbox, "goals", row.id) }));
          return row;
        },

        deleteGoal(id) {
          set((s) => ({
            goals: s.goals.map((g) => (g.id === id ? { ...g, deletedAt: nowISO(), updatedAt: nowISO() } : g)),
            outbox: enqueue(s.outbox, "goals", id),
          }));
        },

        addContribution(goalId, amount, note) {
          const row = stamp<GoalContribution>({ goalId, amount, note, date: new Date().toISOString().slice(0, 10) });
          set((s) => ({ contributions: [...s.contributions, row], outbox: enqueue(s.outbox, "contributions", row.id) }));
        },

        deleteContribution(id) {
          set((s) => ({
            contributions: s.contributions.map((c) => (c.id === id ? { ...c, deletedAt: nowISO(), updatedAt: nowISO() } : c)),
            outbox: enqueue(s.outbox, "contributions", id),
          }));
        },

        deleteRule(id) {
          set((s) => ({
            rules: s.rules.map((r) => (r.id === id ? { ...r, deletedAt: nowISO(), updatedAt: nowISO() } : r)),
            outbox: enqueue(s.outbox, "rules", id),
          }));
        },

        upsertRecurring(r) {
          const prev = r.id ? get().recurring.find((x) => x.id === r.id) : undefined;
          const row = stamp<RecurringItem>({ icon: "🧾", active: true, categoryId: null, toAccountId: null, ...prev, ...r });
          set((s) => ({ recurring: upsert(s.recurring, row), outbox: enqueue(s.outbox, "recurring", row.id) }));
          return row;
        },

        deleteRecurring(id) {
          set((s) => ({
            recurring: s.recurring.map((r) => (r.id === id ? { ...r, deletedAt: nowISO(), updatedAt: nowISO() } : r)),
            outbox: enqueue(s.outbox, "recurring", id),
          }));
        },

        setSettings(patch) {
          set((s) => ({ settings: { ...s.settings, ...patch } }));
        },

        replaceAll(data, settings) {
          set((s) => ({
            ...data,
            settings: { ...s.settings, ...settings },
            outbox: COLLECTIONS.flatMap((c) => data[c].map((r) => ({ c, id: r.id }))),
            lastPulledAt: null,
          }));
        },

        mergeRemote(c, rows) {
          set((s) => {
            let list = s[c] as Syncable[];
            let transactions = s.transactions;
            let budgets = s.budgets;
            let outbox = s.outbox;
            for (const remote of rows) {
              // Categorías predeterminadas creadas en otro dispositivo: unificar por `key`.
              if (c === "categories") {
                const r = remote as Category;
                const dup = (list as Category[]).find((l) => r.key && l.key === r.key && l.id !== r.id);
                if (dup) {
                  transactions = transactions.map((t) => (t.categoryId === dup.id ? { ...t, categoryId: r.id, updatedAt: nowISO() } : t));
                  budgets = budgets.map((b) => (b.categoryId === dup.id ? { ...b, categoryId: r.id, updatedAt: nowISO() } : b));
                  list = list.filter((l) => l.id !== dup.id);
                  outbox = outbox.filter((o) => !(o.c === "categories" && o.id === dup.id));
                  for (const t of transactions) if (t.categoryId === r.id) outbox = enqueue(outbox, "transactions", t.id);
                  for (const b of budgets) if (b.categoryId === r.id) outbox = enqueue(outbox, "budgets", b.id);
                }
              }
              const local = list.find((l) => l.id === remote.id);
              // Last-write-wins por updatedAt.
              if (!local || local.updatedAt <= remote.updatedAt) {
                list = upsert(list, remote);
                outbox = outbox.filter((o) => !(o.c === c && o.id === remote.id));
              }
            }
            return { [c]: list, transactions: c === "transactions" ? (list as Transaction[]) : transactions, budgets: c === "budgets" ? (list as Budget[]) : budgets, outbox } as Partial<State>;
          });
        },

        ackOutbox(items) {
          set((s) => ({ outbox: s.outbox.filter((o) => !items.some((i) => i.c === o.c && i.id === o.id)) }));
        },

        markAllDirty() {
          set((s) => ({ outbox: COLLECTIONS.flatMap((c) => s[c].map((r) => ({ c, id: r.id }))) }));
        },

        setLastPulledAt(v) {
          set({ lastPulledAt: v });
        },
      };
    },
    {
      name: "plata-v1",
      version: 1,
      storage: createJSONStorage(() => idbStorage),
      partialize: ({ hydrated: _h, ...rest }) => rest as unknown as State & Actions,
      onRehydrateStorage: () => () => useStore.setState({ hydrated: true }),
    },
  ),
);
