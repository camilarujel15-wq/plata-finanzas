import type { Budget, Category, Goal, GoalContribution, Transaction } from "./types";
import { addMonths, daysBetween, daysInPeriod, periodOf, today } from "./dates";
import { monthTotals, projectMonthExpense, spendingByCategory } from "./reports";
import { budgetStatus } from "./budgets";
import { goalSaved } from "./balances";

export interface Insight {
  id: string;
  icon: string;
  title: string;
  body: string;
  tone: "info" | "good" | "warn";
  href?: string;
}

interface Input {
  transactions: Transaction[];
  categories: Category[];
  budgets: Budget[];
  goals: Goal[];
  contributions: GoalContribution[];
  fmt: (cents: number) => string;
  now?: string;
}

/**
 * Motor de recomendaciones basado en reglas (determinista, sin costo, funciona offline).
 * Se ordenan por relevancia y se muestran máximo 3 para no generar ruido.
 */
export function buildInsights({ transactions, categories, budgets, goals, contributions, fmt, now = today() }: Input): Insight[] {
  const live = transactions.filter((t) => !t.deletedAt);
  const out: (Insight & { score: number })[] = [];
  const period = periodOf(now);
  const prev = addMonths(period, -1);
  const day = Number(now.slice(8, 10));
  const days = daysInPeriod(period);

  // 1. Racha de registro: el problema original es registrar cada 2-3 semanas.
  const last = live.reduce<string | null>((m, t) => (!m || t.createdAt > m ? t.createdAt : m), null);
  if (last) {
    const gap = daysBetween(last.slice(0, 10), now);
    if (gap >= 2) {
      out.push({
        id: "gap", score: 90, tone: "warn", icon: "⏰",
        title: `Llevas ${gap} días sin registrar`,
        body: "Importa tu extracto o dicta lo que recuerdes: toma menos de un minuto.",
        href: "/importar",
      });
    }
  }

  // 2. Proyección de gasto vs. ingresos.
  const cur = monthTotals(live, period);
  const prevT = monthTotals(live, prev);
  if (day >= 5 && cur.expense > 0) {
    const proj = projectMonthExpense(cur.expense, day, days);
    const income = Math.max(cur.income, prevT.income);
    if (income > 0 && proj > income) {
      out.push({
        id: "proj", score: 85, tone: "warn", icon: "📉",
        title: `A este ritmo gastarás ${fmt(proj)} este mes`,
        body: `Eso supera tus ingresos (${fmt(income)}). Reduce ${fmt(Math.ceil((proj - income) / Math.max(1, days - day)))} por día para cerrar en azul.`,
      });
    } else if (income > 0) {
      const rate = (income - proj) / income;
      if (rate >= 0.2) {
        out.push({
          id: "rate", score: 40, tone: "good", icon: "🌱",
          title: `Vas a ahorrar ~${Math.round(rate * 100)}% este mes`,
          body: "Buen ritmo. Mueve ese excedente a una meta antes de que se gaste.",
          href: "/metas",
        });
      }
    }
  }

  // 3. Categoría que más creció vs. mes anterior (comparando a la misma fecha).
  const curCats = spendingByCategory(live.filter((t) => Number(t.date.slice(8, 10)) <= day), categories, [period]);
  const prevCats = spendingByCategory(live.filter((t) => Number(t.date.slice(8, 10)) <= day), categories, [prev]);
  let worst: { name: string; icon: string; pct: number; diff: number } | null = null;
  for (const c of curCats) {
    const p = prevCats.find((x) => x.categoryId === c.categoryId);
    if (!p || p.amount < 3000) continue;
    const diff = c.amount - p.amount;
    const pct = diff / p.amount;
    if (pct > 0.25 && diff > 5000 && (!worst || diff > worst.diff)) worst = { name: c.name, icon: c.icon, pct, diff };
  }
  if (worst) {
    out.push({
      id: "growth", score: 70, tone: "warn", icon: worst.icon,
      title: `${worst.name}: +${Math.round(worst.pct * 100)}% vs. el mes pasado`,
      body: `Llevas ${fmt(worst.diff)} más que a esta altura del mes anterior.`,
      href: "/reportes",
    });
  }

  // 4. Suscripciones: costo anualizado (suele sorprender).
  const subs = categories.find((c) => c.key === "subscriptions");
  if (subs) {
    const monthly = spendingByCategory(live, categories, [prev]).find((c) => c.categoryId === subs.id)?.amount ?? 0;
    if (monthly >= 3000) {
      out.push({
        id: "subs", score: 35, tone: "info", icon: "🔁",
        title: `Tus suscripciones cuestan ${fmt(monthly * 12)} al año`,
        body: "¿Usas todas? Cancelar una sola puede financiar una meta.",
        href: `/movimientos?category=${subs.id}`,
      });
    }
  }

  // 5. Presupuestos en riesgo.
  for (const b of budgets.filter((x) => !x.deletedAt)) {
    const st = budgetStatus(b, live, period);
    const expected = day / days;
    if (st.ratio >= 1 || st.ratio - expected > 0.25) {
      const cat = categories.find((c) => c.id === b.categoryId);
      out.push({
        id: `budget-${b.id}`, score: st.ratio >= 1 ? 80 : 60, tone: "warn", icon: cat?.icon ?? "📊",
        title: st.ratio >= 1 ? `Presupuesto de ${cat?.name} agotado` : `${cat?.name} va más rápido que el mes`,
        body: st.ratio >= 1
          ? `Te pasaste por ${fmt(-st.remaining)}.`
          : `Usaste ${Math.round(st.ratio * 100)}% y solo ha pasado ${Math.round(expected * 100)}% del mes.`,
        href: "/presupuestos",
      });
    }
  }

  // 6. Metas: aporte mensual necesario.
  for (const g of goals.filter((x) => !x.deletedAt && !x.archived && x.targetDate)) {
    const saved = goalSaved(g.id, contributions);
    const left = g.targetAmount - saved;
    const months = Math.max(1, Math.round(daysBetween(now, g.targetDate!) / 30));
    if (left > 0) {
      out.push({
        id: `goal-${g.id}`, score: 30, tone: "info", icon: g.icon,
        title: `${g.name}: aparta ${fmt(Math.ceil(left / months))} al mes`,
        body: `Así llegas a ${fmt(g.targetAmount)} a tiempo (${months} ${months === 1 ? "mes" : "meses"}).`,
        href: "/metas",
      });
    }
  }

  return out.sort((a, b) => b.score - a.score).slice(0, 3).map(({ score: _s, ...i }) => i);
}
