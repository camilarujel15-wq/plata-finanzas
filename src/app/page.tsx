"use client";

import Link from "next/link";
import { useMemo } from "react";
import { ArrowDownLeft, ArrowUpRight, ChevronRight, Eye, EyeOff, Mic, Sparkles } from "lucide-react";
import { useStore } from "@/lib/store/store";
import { useUI } from "@/lib/store/ui";
import { useAccounts, useBalances, useBaseTransactions, usePosition, useSpendableAccounts, useTransactions } from "@/lib/store/selectors";
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
  const allAccounts = useAccounts();
  const accounts = useSpendableAccounts();
  const balances = useBalances();
  const pos = usePosition();
  const txs = useTransactions();
  const baseTxs = useBaseTransactions();
  const fmt = useFormat();
  const period = currentPeriod();

  const month = useMemo(() => monthTotals(baseTxs, period), [baseTxs, period]);
  const series = useMemo(() => monthlySeries(baseTxs, period, 6), [baseTxs, period]);
  const catMap = useMemo(() => new Map(s.categories.map((c) => [c.id, c])), [s.categories]);
  const accMap = useMemo(() => new Map(s.accounts.map((a) => [a.id, a])), [s.accounts]);
  const budgets = useMemo(
    () =>
      s.budgets
        .filter((b) => !b.deletedAt)
        .map((b) => budgetStatus(b, baseTxs, period))
        .sort((a, b) => b.ratio - a.ratio),
    [s.budgets, baseTxs, period],
  );
  const insights = useMemo(
    () => buildInsights({ transactions: baseTxs, categories: s.categories, budgets: s.budgets, goals: s.goals, contributions: s.contributions, fmt }),
    [baseTxs, s.categories, s.budgets, s.goals, s.contributions, fmt],
  );
  const goals = s.goals.filter((g) => !g.deletedAt && !g.archived);

  if (!allAccounts.length) return <Onboarding />;

  // Ritmo diario sugerido: presupuesto restante (o ingreso neto) repartido en los días que faltan.
  const day = Number(today().slice(8, 10));
  const daysLeft = daysInPeriod(period) - day + 1;
  const budgetLeft = budgets.reduce((a, b) => a + Math.max(0, b.remaining), 0);
  const pool = budgets.length ? budgetLeft : Math.min(pos.available, month.income - month.expense);
  const perDay = pool > 0 ? Math.floor(pool / daysLeft) : 0;
  const savingsRate = month.income > 0 ? (month.income - month.expense) / month.income : null;

  const initial = s.settings.displayName.trim() ? s.settings.displayName.trim().charAt(0).toUpperCase() : "🙂";

  return (
    <div className="pt-safe">
      <header className="flex items-center gap-3 pb-4 pt-4">
        <Link href="/ajustes/" className="tap flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-emerald-300 to-emerald-600 text-base font-bold text-brand-ink shadow-glow">
          {initial}
        </Link>
        <div className="min-w-0 flex-1">
          <div className="text-xs font-medium text-muted">{periodLabel(period)}</div>
          <h1 className="truncate text-xl font-bold tracking-tight">Hola{s.settings.displayName ? `, ${s.settings.displayName}` : ""} 👋</h1>
        </div>
        <button
          aria-label={hide ? "Mostrar montos" : "Ocultar montos"}
          onClick={() => s.setSettings({ hideAmounts: !hide })}
          className="tap flex h-11 w-11 items-center justify-center rounded-full bg-surface text-muted shadow-card"
        >
          {hide ? <EyeOff size={19} /> : <Eye size={19} />}
        </button>
      </header>

      {/* Disponible real */}
      <section className="hero animate-rise p-5 pb-4">
        <div className="flex items-center justify-between">
          <span className="rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-semibold tracking-wide text-emerald-200 ring-1 ring-white/10">DISPONIBLE REAL</span>
          <span className="text-[11px] text-white/50">activos − deudas − metas</span>
        </div>
        <Money value={pos.available} hidden={hide} className="mt-3 block text-[40px] font-extrabold leading-none tracking-tight" />
        <div className="mt-5 grid grid-cols-3 gap-2">
          {[
            { label: "Patrimonio", value: pos.netWorth },
            { label: "Deuda TC", value: pos.debt },
            { label: "En metas", value: pos.reserved },
          ].map((x) => (
            <div key={x.label} className="rounded-2xl bg-white/[0.07] px-3 py-2.5 ring-1 ring-white/[0.08]">
              <div className="text-[10.5px] font-medium text-white/55">{x.label}</div>
              <Money value={x.value} hidden={hide} compact className="text-[15px] font-bold" />
            </div>
          ))}
        </div>
        {perDay > 0 && (
          <div className="mt-3 flex items-center gap-2 rounded-2xl bg-emerald-400/10 px-3 py-2.5 text-[13px] ring-1 ring-emerald-300/20">
            <span className="text-lg">🧭</span>
            <span className="text-white/80">
              Hoy puedes gastar <Money value={perDay} hidden={hide} className="font-bold text-emerald-200" />
              <span className="text-white/50"> · {daysLeft} días restantes</span>
            </span>
          </div>
        )}
      </section>

      {/* Captura por texto/voz desde el inicio */}
      <div className="mt-4 flex gap-2">
        <button onClick={() => openQuickAdd()} className="tap card flex flex-1 items-center gap-3 px-4 py-3.5 text-left">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand/12 text-brand-strong">
            <Sparkles size={17} />
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-semibold">¿Qué gastaste?</span>
            <span className="block truncate text-xs text-muted">“18 almuerzo yape”</span>
          </span>
        </button>
        <button
          aria-label="Dictar gasto"
          onClick={() => openQuickAdd({ autoVoice: true })}
          className="tap flex w-[60px] items-center justify-center rounded-[22px] bg-gradient-to-br from-emerald-300 to-emerald-500 text-brand-ink shadow-glow"
        >
          <Mic size={22} />
        </button>
      </div>

      {/* Resumen del mes */}
      <section className="card mt-4 p-4">
        <div className="grid grid-cols-2 gap-3">
          <Flow label="Ingresos" value={month.income} hide={hide} up />
          <Flow label="Gastos" value={month.expense} hide={hide} />
        </div>
        <div className="mt-4 flex items-center justify-between border-t border-line/70 pt-3">
          <div>
            <div className="text-xs font-medium text-muted">Ahorro neto del mes</div>
            <Money value={month.net} hidden={hide} tone className="text-lg font-bold" />
          </div>
          {savingsRate !== null && (
            <div className={`rounded-full px-3 py-1 text-xs font-bold ${savingsRate >= 0.2 ? "bg-pos/12 text-pos" : savingsRate >= 0 ? "bg-warn/12 text-warn" : "bg-neg/12 text-neg"}`}>
              {Math.round(savingsRate * 100)}% ahorrado
            </div>
          )}
        </div>
      </section>

      {insights.length > 0 && (
        <Section title="Para ti">
          <div className="-mx-5 flex snap-x gap-3 overflow-x-auto px-5 pb-1 no-scrollbar">
            {insights.map((i) => {
              const tint = i.tone === "warn" ? "from-amber-400/15" : i.tone === "good" ? "from-emerald-400/15" : "from-indigo-400/15";
              const body = (
                <>
                  <div className={`flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br ${tint} to-transparent text-2xl`}>{i.icon}</div>
                  <div className="mt-3 text-[15px] font-bold leading-snug">{i.title}</div>
                  <div className="mt-1 text-xs leading-relaxed text-muted">{i.body}</div>
                </>
              );
              return i.href ? (
                <Link key={i.id} href={i.href} className="tap card w-[260px] shrink-0 snap-start p-4">
                  {body}
                </Link>
              ) : (
                <div key={i.id} className="card w-[260px] shrink-0 snap-start p-4">
                  {body}
                </div>
              );
            })}
          </div>
        </Section>
      )}

      <Section title="Cuentas" action={<Link href="/cuentas/" className="link">Ver todas</Link>}>
        <div className="-mx-5 flex gap-3 overflow-x-auto px-5 pb-1 no-scrollbar">
          {accounts.map((a) => (
            <Link key={a.id} href={`/movimientos/?account=${a.id}`} className="tap card relative w-[156px] shrink-0 overflow-hidden p-3.5">
              <div className="absolute inset-x-0 top-0 h-1" style={{ background: a.color }} />
              <IconBubble icon={a.icon} color={a.color} size={36} />
              <div className="mt-3 truncate text-[13px] font-medium text-muted">{a.name}</div>
              <Money value={balances.get(a.id) ?? 0} hidden={hide} currency={a.currency} className={`block text-[17px] font-bold ${(balances.get(a.id) ?? 0) < 0 ? "text-neg" : ""}`} />
              {a.type === "credit_card" && a.creditLimit ? (
                <Progress className="mt-2 h-1.5" value={Math.max(0, -(balances.get(a.id) ?? 0)) / a.creditLimit} />
              ) : null}
            </Link>
          ))}
        </div>
      </Section>

      {(pos.investments > 0 || pos.receivables > 0 || allAccounts.some((a) => a.type === "investment" || a.type === "receivable")) && (
        <div className="mt-4 grid grid-cols-2 gap-3">
          <Link href="/inversiones/" className="tap card p-4">
            <IconBubble icon="📈" color="#6366f1" size={38} />
            <div className="mt-3 text-xs font-medium text-muted">Inversiones</div>
            <Money value={pos.investments} hidden={hide} compact className="text-[17px] font-bold" />
          </Link>
          <Link href="/me-deben/" className="tap card p-4">
            <IconBubble icon="🤝" color="#f59e0b" size={38} />
            <div className="mt-3 text-xs font-medium text-muted">Me deben</div>
            <Money value={pos.receivables} hidden={hide} compact className="text-[17px] font-bold" />
          </Link>
        </div>
      )}

      <Section title="Evolución" action={<Link href="/reportes/" className="link">Reportes</Link>}>
        <div className="card p-4">
          <div className="mb-1 flex gap-4 text-xs font-medium text-muted">
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-pos" /> Ingresos</span>
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-neg" /> Gastos</span>
          </div>
          <IncomeExpenseBars data={series} height={150} showAxis={false} />
        </div>
      </Section>

      {budgets.length > 0 && (
        <Section title="Presupuestos" action={<Link href="/presupuestos/" className="link">Gestionar</Link>}>
          <div className="card divide-y divide-line/60">
            {budgets.slice(0, 4).map((b) => {
              const c = catMap.get(b.budget.categoryId);
              return (
                <div key={b.budget.id} className="flex items-center gap-3 px-4 py-3.5">
                  <IconBubble icon={c?.icon ?? "❔"} color={c?.color ?? "#94a3b8"} size={38} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2 text-sm">
                      <span className="truncate font-semibold">{c?.name}</span>
                      <span className="num shrink-0 text-xs text-muted">
                        <Money value={b.spent} hidden={hide} className="font-semibold text-ink" /> / <Money value={b.budget.amount} hidden={hide} compact />
                      </span>
                    </div>
                    <Progress className="mt-2" value={b.ratio} />
                  </div>
                </div>
              );
            })}
          </div>
        </Section>
      )}

      <Section title="Metas de ahorro" action={<Link href="/metas/" className="link">{goals.length ? "Ver" : "Crear"}</Link>}>
        {goals.length ? (
          <div className="grid grid-cols-2 gap-3">
            {goals.slice(0, 4).map((g) => {
              const saved = goalSaved(g.id, s.contributions);
              const pct = Math.min(1, saved / g.targetAmount);
              return (
                <Link key={g.id} href="/metas/" className="tap card p-4">
                  <div className="flex items-start justify-between">
                    <IconBubble icon={g.icon} color={g.color} size={40} />
                    <Ring value={pct} color={g.color} />
                  </div>
                  <div className="mt-3 truncate text-sm font-semibold">{g.name}</div>
                  <div className="num text-xs text-muted"><Money value={saved} hidden={hide} compact /> de <Money value={g.targetAmount} hidden={hide} compact /></div>
                </Link>
              );
            })}
          </div>
        ) : (
          <Link href="/metas/" className="tap card flex items-center gap-3 px-4 py-4 text-sm">
            <IconBubble icon="🎯" color="#f97316" />
            <span className="flex-1 font-medium">Crea tu primera meta: viaje, fondo de emergencia, laptop…</span>
            <ChevronRight size={18} className="text-muted" />
          </Link>
        )}
      </Section>

      <Section title="Últimos movimientos" action={<Link href="/movimientos/" className="link">Ver todos</Link>}>
        {txs.length ? (
          <div className="card divide-y divide-line/60 overflow-hidden">
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

function Flow({ label, value, hide, up }: { label: string; value: number; hide: boolean; up?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <span className={`flex h-10 w-10 items-center justify-center rounded-2xl ${up ? "bg-pos/12 text-pos" : "bg-neg/12 text-neg"}`}>
        {up ? <ArrowDownLeft size={19} strokeWidth={2.4} /> : <ArrowUpRight size={19} strokeWidth={2.4} />}
      </span>
      <div className="min-w-0">
        <div className="text-xs font-medium text-muted">{label}</div>
        <Money value={value} hidden={hide} compact className="text-[17px] font-bold" />
      </div>
    </div>
  );
}

function Ring({ value, color }: { value: number; color: string }) {
  const r = 15;
  const c = 2 * Math.PI * r;
  return (
    <svg width="40" height="40" viewBox="0 0 40 40" className="-rotate-90" aria-label={`${Math.round(value * 100)}%`}>
      <circle cx="20" cy="20" r={r} fill="none" stroke="currentColor" strokeWidth="4" className="text-surface-2" />
      <circle cx="20" cy="20" r={r} fill="none" stroke={color} strokeWidth="4" strokeLinecap="round" strokeDasharray={`${c * value} ${c}`} />
      <text x="20" y="20" textAnchor="middle" dominantBaseline="central" transform="rotate(90 20 20)" className="fill-ink text-[9px] font-bold">
        {Math.round(value * 100)}%
      </text>
    </svg>
  );
}
