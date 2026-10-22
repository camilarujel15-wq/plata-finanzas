"use client";

import Link from "next/link";
import { useMemo } from "react";
import { ArrowLeftRight, ChevronRight, Eye, EyeOff, Mic, Minus, Plus } from "lucide-react";
import { AppIcon } from "@/components/ui/AppIcon";
import { useStore } from "@/lib/store/store";
import { useUI } from "@/lib/store/ui";
import { useAccounts, useBalances, useBaseTransactions, useForecast, usePosition, useSpendableAccounts, useTransactions } from "@/lib/store/selectors";
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
import { countsForAvailable } from "@/lib/domain/types";

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
  const forecast = useForecast(fmt);

  if (!allAccounts.length) return <Onboarding />;

  // Ritmo diario sugerido: presupuesto restante (o ingreso neto) repartido en los días que faltan.
  const day = Number(today().slice(8, 10));
  const daysLeft = daysInPeriod(period) - day + 1;
  // Gasto diario seguro: disponible − fijos pendientes + ingresos por recibir, repartido en los días que faltan.
  const perDay = forecast.safePerDay;
  const savingsRate = month.income > 0 ? (month.income - month.expense) / month.income : null;

  const name = s.settings.displayName.trim();
  const initial = name ? name.charAt(0).toUpperCase() : "P";
  const nextBill = forecast.bills.find((b) => b.status !== "paid" && b.kind !== "income");
  const ok = forecast.projectedEnd >= 0;
  const forSpending = accounts.filter((a) => countsForAvailable(a) && !a.linkedAccountId);

  return (
    <div className="pt-safe">
      <header className="flex items-center gap-3 pb-3 pt-4">
        <Link href="/ajustes/" className="tap flex h-10 w-10 items-center justify-center rounded-full bg-brand-soft text-[15px] font-semibold text-brand">
          {initial}
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-[17px] font-semibold">Hola{name ? `, ${name}` : ""}</h1>
          <div className="text-xs text-muted">{periodLabel(period)}</div>
        </div>
        <button
          aria-label={hide ? "Mostrar montos" : "Ocultar montos"}
          onClick={() => s.setSettings({ hideAmounts: !hide })}
          className="tap flex h-10 w-10 items-center justify-center rounded-full text-muted"
        >
          {hide ? <EyeOff size={20} /> : <Eye size={20} />}
        </button>
      </header>

      {/* Saldo disponible: la única cifra grande */}
      <section className="hero p-5">
        <div className="flex items-center justify-between text-[13px] text-white/75">
          <span>Disponible para gastar</span>
          <Link href="/cuentas/" className="flex items-center gap-0.5 text-white/75">
            Cuentas <ChevronRight size={14} />
          </Link>
        </div>
        <Money value={pos.available} hidden={hide} className="mt-1 block text-[34px] font-semibold leading-tight tracking-tight" />
        <div className="mt-1 text-[13px] text-white/75">
          {perDay > 0 ? (
            <>
              Puedes gastar <Money value={perDay} hidden={hide} className="font-semibold text-white" /> al día · {daysLeft} días restantes
            </>
          ) : (
            "Sin margen para gastos variables este mes"
          )}
        </div>
        <div className="mt-4 flex items-center justify-between border-t border-white/15 pt-3 text-xs text-white/70">
          <span className="min-w-0 truncate">
            Patrimonio <Money value={pos.netWorth} hidden={hide} compact className="font-medium text-white" />
          </span>
          {pos.spendableDebt > 0 && (
            <span className="shrink-0">
              Tarjetas <Money value={-pos.spendableDebt} hidden={hide} compact className="font-medium text-white" />
            </span>
          )}
        </div>
      </section>

      {/* Acciones rápidas */}
      <div className="mt-4 grid grid-cols-4 gap-2">
        {[
          { label: "Gasto", icon: Minus, run: () => openQuickAdd({ type: "expense" }) },
          { label: "Ingreso", icon: Plus, run: () => openQuickAdd({ type: "income" }) },
          { label: "Transferir", icon: ArrowLeftRight, run: () => openQuickAdd({ type: "transfer" }) },
          { label: "Dictar", icon: Mic, run: () => openQuickAdd({ autoVoice: true }) },
        ].map((a) => (
          <button key={a.label} onClick={a.run} className="tap flex flex-col items-center gap-1.5 text-xs font-medium text-ink">
            <span className="flex h-12 w-12 items-center justify-center rounded-full border border-line bg-surface text-brand">
              <a.icon size={20} strokeWidth={1.9} />
            </span>
            {a.label}
          </button>
        ))}
      </div>

      {/* Fin de mes */}
      <Link href="/mi-mes/" className="tap card mt-5 block p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-xs text-muted">{ok ? "Llegas a fin de mes con" : "A fin de mes te faltarían"}</div>
            <Money value={Math.abs(forecast.projectedEnd)} hidden={hide} className={`text-xl font-semibold ${ok ? "text-ink" : "text-neg"}`} />
          </div>
          <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${ok ? "bg-brand-soft text-brand" : "bg-neg/10 text-neg"}`}>
            {ok ? "Vas bien" : "Atención"}
          </span>
        </div>
        {nextBill ? (
          <div className="mt-3 flex min-w-0 items-center gap-2 border-t border-line pt-3 text-[13px]">
            <AppIcon icon={nextBill.icon} size={16} className="shrink-0 text-muted" />
            <span className="min-w-0 flex-1 truncate text-muted">
              {nextBill.name} · vence {nextBill.due.slice(8, 10)}/{nextBill.due.slice(5, 7)}
            </span>
            <Money value={nextBill.amount} hidden={hide} className="shrink-0 font-medium" />
          </div>
        ) : (
          !forecast.bills.length && <div className="mt-3 border-t border-line pt-3 text-[13px] text-muted">Agrega tus gastos fijos para proyectar tu mes.</div>
        )}
      </Link>

      {/* Resumen del mes */}
      <section className="card mt-3 p-4">
        <div className="grid grid-cols-2 divide-x divide-line">
          <div className="pr-4">
            <div className="text-xs text-muted">Ingresos del mes</div>
            <Money value={month.income} hidden={hide} className="text-base font-semibold text-pos" />
          </div>
          <div className="pl-4">
            <div className="text-xs text-muted">Gastos del mes</div>
            <Money value={month.expense} hidden={hide} className="text-base font-semibold" />
          </div>
        </div>
        <div className="mt-3 flex items-center justify-between border-t border-line pt-3 text-[13px]">
          <span className="text-muted">Ahorro neto</span>
          <span>
            <Money value={month.net} hidden={hide} tone className="font-semibold" />
            {savingsRate !== null && <span className="ml-1.5 text-xs text-muted">({Math.round(savingsRate * 100)}%)</span>}
          </span>
        </div>
      </section>

      {insights.length > 0 && (
        <Section title="Recomendaciones">
          <div className="card divide-y divide-line">
            {insights.map((i) => {
              const color = i.tone === "warn" ? "text-warn bg-warn/10" : i.tone === "good" ? "text-pos bg-pos/10" : "text-brand bg-brand-soft";
              const body = (
                <div className="flex gap-3 px-4 py-3">
                  <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${color}`}>
                    <AppIcon icon={i.icon} size={17} />
                  </span>
                  <div className="min-w-0">
                    <div className="text-sm font-medium leading-snug">{i.title}</div>
                    <div className="mt-0.5 text-xs leading-relaxed text-muted">{i.body}</div>
                  </div>
                </div>
              );
              return i.href ? (
                <Link key={i.id} href={i.href} className="tap block">
                  {body}
                </Link>
              ) : (
                <div key={i.id}>{body}</div>
              );
            })}
          </div>
        </Section>
      )}

      <Section title="Cuentas para gastar" action={<Link href="/cuentas/" className="link">Ver todas</Link>}>
        <div className="card divide-y divide-line">
          {forSpending.map((a) => {
            const b = balances.get(a.id) ?? 0;
            return (
              <Link key={a.id} href={`/movimientos/?account=${a.id}`} className="tap flex items-center gap-3 px-4 py-3">
                <IconBubble icon={a.icon} color={a.color} size={36} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{a.name}</div>
                  {a.type === "credit_card" && a.creditLimit ? (
                    <Progress className="mt-1.5 max-w-[160px]" value={Math.max(0, -b) / a.creditLimit} />
                  ) : null}
                </div>
                <Money value={b} hidden={hide} currency={a.currency} className={`text-sm font-semibold ${b < 0 ? "text-neg" : ""}`} />
              </Link>
            );
          })}
        </div>
      </Section>

      {(pos.investments > 0 || pos.receivables > 0 || allAccounts.some((a) => a.type === "investment" || a.type === "receivable")) && (
        <div className="mt-3 grid grid-cols-2 gap-3">
          <Link href="/inversiones/" className="tap card p-4">
            <div className="flex items-center gap-2 text-xs text-muted">
              <AppIcon icon="i:trend" size={15} /> Inversiones
            </div>
            <Money value={pos.investments} hidden={hide} compact className="mt-1 block text-base font-semibold" />
          </Link>
          <Link href="/me-deben/" className="tap card p-4">
            <div className="flex items-center gap-2 text-xs text-muted">
              <AppIcon icon="i:handshake" size={15} /> Me deben
            </div>
            <Money value={pos.receivables} hidden={hide} compact className="mt-1 block text-base font-semibold" />
          </Link>
        </div>
      )}

      <Section title="Evolución" action={<Link href="/reportes/" className="link">Reportes</Link>}>
        <div className="card p-4">
          <div className="mb-1 flex gap-4 text-xs text-muted">
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-brand" /> Ingresos</span>
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[#C7CCD4]" /> Gastos</span>
          </div>
          <IncomeExpenseBars data={series} height={150} showAxis={false} />
        </div>
      </Section>

      {budgets.length > 0 && (
        <Section title="Presupuestos" action={<Link href="/presupuestos/" className="link">Gestionar</Link>}>
          <div className="card divide-y divide-line">
            {budgets.slice(0, 4).map((b) => {
              const c = catMap.get(b.budget.categoryId);
              return (
                <div key={b.budget.id} className="px-4 py-3">
                  <div className="flex items-baseline justify-between gap-2 text-sm">
                    <span className="flex min-w-0 items-center gap-2 truncate font-medium">
                      <AppIcon icon={c?.icon} size={16} className="shrink-0 text-muted" /> {c?.name}
                    </span>
                    <span className="num shrink-0 text-xs text-muted">
                      <Money value={b.spent} hidden={hide} className="font-medium text-ink" /> de <Money value={b.budget.amount} hidden={hide} compact />
                    </span>
                  </div>
                  <Progress className="mt-2" value={b.ratio} />
                </div>
              );
            })}
          </div>
        </Section>
      )}

      <Section title="Metas de ahorro" action={<Link href="/metas/" className="link">{goals.length ? "Ver" : "Crear"}</Link>}>
        {goals.length ? (
          <div className="card divide-y divide-line">
            {goals.slice(0, 4).map((g) => {
              const saved = goalSaved(g.id, s.contributions);
              const pct = Math.min(1, saved / g.targetAmount);
              return (
                <Link key={g.id} href="/metas/" className="tap block px-4 py-3">
                  <div className="flex items-center justify-between gap-2 text-sm">
                    <span className="flex min-w-0 items-center gap-2 truncate font-medium">
                      <AppIcon icon={g.icon} size={16} className="shrink-0 text-muted" /> {g.name}
                    </span>
                    <span className="shrink-0 text-xs text-muted">
                      {Math.round(pct * 100)}% · <Money value={saved} hidden={hide} compact />
                    </span>
                  </div>
                  <Progress className="mt-2" value={pct} color="rgb(var(--brand))" />
                </Link>
              );
            })}
          </div>
        ) : (
          <Link href="/metas/" className="tap card flex items-center gap-3 px-4 py-3.5 text-sm">
            <IconBubble icon="i:target" color="#0E5A48" size={36} />
            <span className="flex-1">Crea tu primera meta: viaje, fondo de emergencia, laptop…</span>
            <ChevronRight size={18} className="text-muted" />
          </Link>
        )}
      </Section>

      <Section title="Últimos movimientos" action={<Link href="/movimientos/" className="link">Ver todos</Link>}>
        {txs.length ? (
          <div className="card divide-y divide-line overflow-hidden">
            {txs.slice(0, 6).map((t) => (
              <TxRow key={t.id} tx={t} categories={catMap} accounts={accMap} hidden={hide} />
            ))}
          </div>
        ) : (
          <Empty icon="i:zap" title="Registra tu primer gasto" body="Toca + , escribe el monto y toca la categoría. Listo." />
        )}
      </Section>
    </div>
  );
}
