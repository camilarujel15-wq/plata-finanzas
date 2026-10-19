"use client";

import Link from "next/link";
import { useMemo } from "react";
import { ChevronRight, Eye, EyeOff, Mic, Sparkles } from "lucide-react";
import { useStore } from "@/lib/store/store";
import { useUI } from "@/lib/store/ui";
import { useAccounts, useBalances, usePosition, useTransactions } from "@/lib/store/selectors";
import { Money, useFormat } from "@/components/ui/Money";
import { Empty, IconBubble, Progress, Section } from "@/components/ui/bits";
import { TxRow } from "@/components/tx/TxRow";
import { IncomeExpenseBars } from "@/components/charts/IncomeExpenseBars";
import { Onboarding } from "@/components/dashboard/Onboarding";
import { currentPeriod, daysInPeriod, periodLabel, today } from "@/lib/domain/dates";
import { monthTotals, monthlySeries } from "@/lib/domain/reports";
import { budgetStatus } from "@/lib/domain/budgets";
import { goalSaved } from "@/lib/domain/balances";
import { buildInsights } from "@/lib/domain/insights";

export default function Dashboard() {
  const s = useStore();
  const hide = !!s.settings.hideAmounts;
  const openQuickAdd = useUI((u) => u.openQuickAdd);
  const accounts = useAccounts();
  const balances = useBalances();
  const pos = usePosition();
  const txs = useTransactions();
  const fmt = useFormat();
  const period = currentPeriod();

  const month = useMemo(() => monthTotals(txs, period), [txs, period]);
  const series = useMemo(() => monthlySeries(txs, period, 6), [txs, period]);
  const catMap = useMemo(() => new Map(s.categories.map((c) => [c.id, c])), [s.categories]);
  const accMap = useMemo(() => new Map(s.accounts.map((a) => [a.id, a])), [s.accounts]);
  const budgets = useMemo(
    () =>
      s.budgets
        .filter((b) => !b.deletedAt)
        .map((b) => budgetStatus(b, txs, period))
        .sort((a, b) => b.ratio - a.ratio),
    [s.budgets, txs, period],
  );
  const insights = useMemo(
    () => buildInsights({ transactions: txs, categories: s.categories, budgets: s.budgets, goals: s.goals, contributions: s.contributions, fmt }),
    [txs, s.categories, s.budgets, s.goals, s.contributions, fmt],
  );
  const goals = s.goals.filter((g) => !g.deletedAt && !g.archived);

  if (!accounts.length) return <Onboarding />;

  // Ritmo diario sugerido: presupuesto restante (o ingreso neto) repartido en los días que faltan.
  const day = Number(today().slice(8, 10));
  const daysLeft = daysInPeriod(period) - day + 1;
  const budgetLeft = budgets.reduce((a, b) => a + Math.max(0, b.remaining), 0);
  const pool = budgets.length ? budgetLeft : Math.min(pos.available, month.income - month.expense);
  const perDay = pool > 0 ? Math.floor(pool / daysLeft) : 0;
  const savingsRate = month.income > 0 ? (month.income - month.expense) / month.income : null;

  return (
    <div className="pt-safe">
      <header className="flex h-14 items-center justify-between">
        <div>
          <div className="text-xs text-muted">{periodLabel(period)}</div>
          <h1 className="text-xl font-bold tracking-tight">Hola{s.settings.displayName ? `, ${s.settings.displayName}` : ""} 👋</h1>
        </div>
        <button
          aria-label={hide ? "Mostrar montos" : "Ocultar montos"}
          onClick={() => s.setSettings({ hideAmounts: !hide })}
          className="tap rounded-full bg-surface p-2.5 text-muted shadow-sm"
        >
          {hide ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </header>

      {/* Disponible real */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-600 to-emerald-800 p-5 text-white shadow-lg shadow-emerald-900/20">
        <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10" />
        <div className="text-sm text-white/80">Disponible real</div>
        <Money value={pos.available} hidden={hide} className="mt-1 block text-4xl font-bold tracking-tight" />
        <div className="mt-1 text-xs text-white/70">Activos − deuda de tarjetas − apartado para metas</div>
        <div className="mt-4 grid grid-cols-3 gap-2 text-xs">
          <div>
            <div className="text-white/70">Patrimonio</div>
            <Money value={pos.netWorth} hidden={hide} compact className="text-sm font-semibold" />
          </div>
          <div>
            <div className="text-white/70">Deuda TC</div>
            <Money value={pos.debt} hidden={hide} compact className="text-sm font-semibold" />
          </div>
          <div>
            <div className="text-white/70">En metas</div>
            <Money value={pos.reserved} hidden={hide} compact className="text-sm font-semibold" />
          </div>
        </div>
      </section>

      {/* Captura por texto/voz directamente desde el inicio */}
      <div className="mt-3 flex gap-2">
        <button onClick={() => openQuickAdd()} className="tap card flex flex-1 items-center gap-2 px-4 py-3 text-left text-sm text-muted">
          <Sparkles size={16} className="text-brand" /> ¿Qué gastaste? “18 almuerzo”
        </button>
        <button aria-label="Dictar gasto" onClick={() => openQuickAdd({ autoVoice: true })} className="tap card px-4 text-brand">
          <Mic size={20} />
        </button>
      </div>

      {/* Resumen del mes */}
      <div className="mt-3 grid grid-cols-3 gap-2">
        <Stat label="Ingresos" value={month.income} hide={hide} className="text-pos" />
        <Stat label="Gastos" value={month.expense} hide={hide} className="text-neg" />
        <Stat
          label="Ahorro neto"
          value={month.net}
          hide={hide}
          foot={savingsRate !== null ? `${Math.round(savingsRate * 100)}% de ingresos` : undefined}
        />
      </div>

      {perDay > 0 && (
        <div className="card mt-3 flex items-center gap-3 px-4 py-3">
          <span className="text-2xl">🧭</span>
          <div className="text-sm">
            Puedes gastar <Money value={perDay} hidden={hide} className="font-semibold" /> por día
            <div className="text-xs text-muted">
              durante los {daysLeft} días que quedan {budgets.length ? "según tus presupuestos" : "sin gastar más de lo que ingresó"}
            </div>
          </div>
        </div>
      )}

      {insights.length > 0 && (
        <Section title="Para ti">
          <div className="-mx-4 flex snap-x gap-2 overflow-x-auto px-4 no-scrollbar">
            {insights.map((i) => {
              const body = (
                <>
                  <div className="text-xl">{i.icon}</div>
                  <div className="mt-1 text-sm font-semibold leading-snug">{i.title}</div>
                  <div className="mt-1 text-xs text-muted">{i.body}</div>
                </>
              );
              const cls = `card w-64 shrink-0 snap-start p-4 ${i.tone === "warn" ? "border-warn/40" : i.tone === "good" ? "border-pos/40" : ""}`;
              return i.href ? (
                <Link key={i.id} href={i.href} className={`tap ${cls}`}>
                  {body}
                </Link>
              ) : (
                <div key={i.id} className={cls}>
                  {body}
                </div>
              );
            })}
          </div>
        </Section>
      )}

      <Section title="Cuentas" action={<Link href="/cuentas" className="text-xs font-medium text-brand">Ver todas</Link>}>
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 no-scrollbar">
          {accounts.map((a) => (
            <Link key={a.id} href={`/movimientos?account=${a.id}`} className="tap card w-40 shrink-0 p-3">
              <div className="flex items-center gap-2">
                <IconBubble icon={a.icon} color={a.color} size={30} />
                <span className="truncate text-sm font-medium">{a.name}</span>
              </div>
              <Money value={balances.get(a.id) ?? 0} hidden={hide} className="mt-2 block text-lg font-semibold" tone={a.type === "credit_card"} />
              {a.type === "credit_card" && a.creditLimit ? (
                <Progress className="mt-2" value={Math.max(0, -(balances.get(a.id) ?? 0)) / a.creditLimit} />
              ) : null}
            </Link>
          ))}
        </div>
      </Section>

      <Section title="Evolución mensual" action={<Link href="/reportes" className="text-xs font-medium text-brand">Reportes</Link>}>
        <div className="card p-3">
          <IncomeExpenseBars data={series} height={160} showAxis={false} />
        </div>
      </Section>

      {budgets.length > 0 && (
        <Section title="Presupuestos del mes" action={<Link href="/presupuestos" className="text-xs font-medium text-brand">Gestionar</Link>}>
          <div className="card divide-y divide-line/60">
            {budgets.slice(0, 4).map((b) => {
              const c = catMap.get(b.budget.categoryId);
              return (
                <div key={b.budget.id} className="px-4 py-3">
                  <div className="flex items-center justify-between text-sm">
                    <span>
                      {c?.icon} {c?.name}
                    </span>
                    <span className="num text-xs text-muted">
                      <Money value={b.spent} hidden={hide} /> / <Money value={b.budget.amount} hidden={hide} />
                    </span>
                  </div>
                  <Progress className="mt-2" value={b.ratio} />
                </div>
              );
            })}
          </div>
        </Section>
      )}

      <Section title="Metas de ahorro" action={<Link href="/metas" className="text-xs font-medium text-brand">{goals.length ? "Ver" : "Crear"}</Link>}>
        {goals.length ? (
          <div className="grid grid-cols-2 gap-2">
            {goals.slice(0, 4).map((g) => {
              const saved = goalSaved(g.id, s.contributions);
              return (
                <Link key={g.id} href="/metas" className="tap card p-3">
                  <div className="text-2xl">{g.icon}</div>
                  <div className="mt-1 truncate text-sm font-medium">{g.name}</div>
                  <div className="num text-xs text-muted">{Math.round((saved / g.targetAmount) * 100)}% · <Money value={saved} hidden={hide} compact /></div>
                  <Progress className="mt-2" value={saved / g.targetAmount} color={g.color} />
                </Link>
              );
            })}
          </div>
        ) : (
          <Link href="/metas" className="tap card flex items-center gap-3 px-4 py-3 text-sm">
            <span className="text-2xl">🎯</span>
            <span className="flex-1">Crea tu primera meta: viaje, fondo de emergencia, laptop…</span>
            <ChevronRight size={18} className="text-muted" />
          </Link>
        )}
      </Section>

      <Section title="Últimos movimientos" action={<Link href="/movimientos" className="text-xs font-medium text-brand">Ver todos</Link>}>
        {txs.length ? (
          <div className="card divide-y divide-line/60">
            {txs.slice(0, 6).map((t) => (
              <TxRow key={t.id} tx={t} categories={catMap} accounts={accMap} hidden={hide} />
            ))}
          </div>
        ) : (
          <Empty icon="⚡" title="Registra tu primer gasto" body="Toca + , escribe el monto y toca la categoría. Listo." />
        )}
      </Section>
    </div>
  );
}

function Stat({ label, value, hide, className = "", foot }: { label: string; value: number; hide: boolean; className?: string; foot?: string }) {
  return (
    <div className="card px-3 py-2.5">
      <div className="text-[11px] text-muted">{label}</div>
      <Money value={value} hidden={hide} compact className={`text-base font-semibold ${className}`} />
      {foot && <div className="text-[10px] text-muted">{foot}</div>}
    </div>
  );
}
