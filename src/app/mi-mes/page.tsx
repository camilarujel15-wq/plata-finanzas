"use client";

import { AppIcon } from "@/components/ui/AppIcon";
import Link from "next/link";
import { CalendarClock, Check, Settings2 } from "lucide-react";
import { useStore } from "@/lib/store/store";
import { useUI } from "@/lib/store/ui";
import { useForecast } from "@/lib/store/selectors";
import { Empty, PageHeader, Section } from "@/components/ui/bits";
import { Money, useFormat } from "@/components/ui/Money";
import { daysBetween, periodLabel, today } from "@/lib/domain/dates";
import type { Bill } from "@/lib/domain/plan";

const TONE: Record<string, string> = {
  good: "bg-pos/10 text-pos",
  warn: "bg-warn/10 text-warn",
  bad: "bg-neg/10 text-neg",
  info: "bg-surface-2 text-ink",
};

/** ¿Llego a fin de mes? Disponible − fijos pendientes + ingresos por recibir − gasto variable estimado. */
export default function MiMes() {
  const hide = !!useStore((s) => s.settings.hideAmounts);
  const fmt = useFormat();
  const f = useForecast(fmt);
  const ok = f.projectedEnd >= 0;
  const t = today();

  return (
    <div>
      <PageHeader
        title="Mi mes"
        subtitle={periodLabel(t.slice(0, 7))}
        back="/"
        action={
          <Link href="/gastos-fijos/" className="btn-ghost px-3 py-2 text-sm">
            <Settings2 size={16} /> Fijos
          </Link>
        }
      />

      <section className="hero p-5">
        <div className="text-[13px] text-white/75">
          {ok ? "Llegas a fin de mes con" : "A fin de mes te faltarían"}
        </div>
        <Money value={Math.abs(f.projectedEnd)} hidden={hide} className={`mt-2 block text-[34px] font-semibold leading-tight `} />
        <div className="mt-4 text-[13px] text-white/80">
          Para llegar puedes gastar hasta <Money value={f.safePerDay} hidden={hide} className="font-semibold text-white" /> por día en lo variable
          <span className="text-white/50"> · hoy vas a {fmt(f.variableDaily)}/día</span>
        </div>
      </section>

      {/* Cómo se calcula */}
      <section className="card mt-4 divide-y divide-line/60 text-sm">
        <Line label="Disponible para gastar hoy" value={f.available} hide={hide} />
        <Line label="Gastos fijos por pagar" value={-f.pendingOut} hide={hide} />
        <Line label="Ingresos fijos por recibir" value={f.pendingIn} hide={hide} />
        <Line label={`Gasto variable estimado (${f.daysLeft} días × ${fmt(f.variableDaily)})`} value={-f.variableRest} hide={hide} />
        <Line label="Proyección a fin de mes" value={f.projectedEnd} hide={hide} strong />
      </section>

      <Section title="Cómo vas">
        <div className="grid grid-cols-[minmax(0,1fr)] gap-2">
          {f.comments.map((c, i) => (
            <div key={i} className={`flex items-start gap-3 rounded-2xl px-4 py-3 text-sm leading-snug ${TONE[c.tone]}`}>
              <AppIcon icon={c.icon} size={18} className="mt-0.5 shrink-0" />
              <span className="text-ink">{c.text}</span>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Pagos del mes" action={<Link href="/gastos-fijos/" className="link">Gestionar</Link>}>
        {f.bills.length === 0 ? (
          <Empty
            icon="i:calendar"
            title="Agrega tus gastos fijos"
            body="Alquiler, luz, internet, celular, cuota del terreno, sueldo… Así sabrás si llegas a fin de mes."
            action={<Link href="/gastos-fijos/" className="btn-primary">Agregar gastos fijos</Link>}
          />
        ) : (
          <div className="card divide-y divide-line/60 overflow-hidden">
            {f.bills.map((b) => (
              <BillRow key={b.id} bill={b} hide={hide} today={t} />
            ))}
          </div>
        )}
      </Section>

      {f.cards.length > 0 && (
        <Section title="Tarjetas de crédito">
          <div className="grid grid-cols-[minmax(0,1fr)] gap-3">
            {f.cards.map(({ card, schedule }) => (
              <div key={card.id} className="card p-4 text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-semibold">
                    <AppIcon icon={card.icon} size={15} className="shrink-0" /> {card.name}
                  </span>
                  {!card.closingDay && <Link href="/cuentas/" className="link">Configura cierre y pago ›</Link>}
                </div>
                {schedule.nextDue ? (
                  <div className="mt-2 rounded-2xl bg-surface-2 px-3 py-2.5">
                    <div className="text-xs text-muted">Pago total para no pagar intereses</div>
                    <div className="flex items-baseline justify-between">
                      <Money value={schedule.nextDue.remaining} hidden={hide} currency={card.currency} className="text-lg font-semibold" />
                      <span className="text-xs font-semibold text-muted">vence {schedule.nextDue.due.slice(8, 10)}/{schedule.nextDue.due.slice(5, 7)}</span>
                    </div>
                  </div>
                ) : (
                  <p className="mt-2 text-xs text-pos">No tienes estados de cuenta pendientes.</p>
                )}
                <div className="mt-3 grid grid-cols-3 gap-2 text-[11px] text-muted">
                  <div>
                    Ciclo actual
                    <Money value={schedule.statements.find((s) => s.closing >= t)?.remaining ?? 0} hidden={hide} currency={card.currency} className="block text-sm font-semibold text-ink" />
                  </div>
                  <div>
                    Cuotas futuras
                    <Money value={schedule.deferredPrincipal} hidden={hide} currency={card.currency} className="block text-sm font-semibold text-ink" />
                  </div>
                  <div>
                    Intereses por pagar
                    <Money value={schedule.futureInterest} hidden={hide} currency={card.currency} className={`block text-sm font-semibold ${schedule.futureInterest ? "text-warn" : "text-ink"}`} />
                  </div>
                </div>
                <UpcomingStatements statements={schedule.statements.filter((s) => s.closing >= t).slice(0, 4)} currency={card.currency} hide={hide} />
              </div>
            ))}
          </div>
        </Section>
      )}
    </div>
  );
}

function Line({ label, value, hide, strong }: { label: string; value: number; hide: boolean; strong?: boolean }) {
  return (
    <div className={`flex items-center justify-between gap-3 px-4 py-3 ${strong ? "bg-surface-2/60" : ""}`}>
      <span className={strong ? "font-semibold" : "text-muted"}>{label}</span>
      <Money value={value} hidden={hide} sign={!strong} tone={strong} className={strong ? "text-base font-semibold" : "font-semibold"} />
    </div>
  );
}

function BillRow({ bill: b, hide, today: t }: { bill: Bill; hide: boolean; today: string }) {
  const open = useUI((u) => u.openQuickAdd);
  const d = daysBetween(t, b.due);
  const status =
    b.status === "paid" ? (
      <span className="inline-flex items-center gap-1 text-pos"><Check size={12} /> Pagado</span>
    ) : b.status === "overdue" ? (
      <span className="text-neg">Venció hace {-d} {-d === 1 ? "día" : "días"}</span>
    ) : (
      <span className={d <= 3 ? "text-warn" : "text-muted"}>{d === 0 ? "Vence hoy" : d === 1 ? "Vence mañana" : `En ${d} días`}</span>
    );
  const pay = () => {
    if (b.kind === "card" && b.cardId) open({ type: "transfer", toAccountId: b.cardId, amount: b.nativeAmount, note: b.name });
    else if (b.item)
      open({
        type: b.item.type,
        fromAccountId: b.item.accountId,
        toAccountId: b.item.toAccountId ?? undefined,
        categoryId: b.item.categoryId ?? undefined,
        amount: b.item.amount,
        note: b.item.name,
        recurringId: b.item.id,
      });
  };
  return (
    <div className={`flex items-center gap-3 px-4 py-3 ${b.status === "paid" ? "opacity-60" : ""}`}>
      <span className="flex h-[42px] w-[42px] shrink-0 flex-col items-center justify-center rounded-full bg-surface-2 leading-none">
        <AppIcon icon={b.icon} size={17} className="text-ink/80" />
        <span className="mt-0.5 text-[9px] font-semibold text-muted">{b.due.slice(8, 10)}/{b.due.slice(5, 7)}</span>
      </span>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[15px] font-semibold">{b.name}</div>
        <div className="truncate text-xs font-medium">
          {status}
          {!b.affectsForecast && b.status !== "paid" && <span className="text-muted"> · ya descontado</span>}
        </div>
      </div>
      <div className="text-right">
        <Money value={b.kind === "income" ? b.amount : -b.amount} sign={b.kind === "income"} hidden={hide} className={`text-[15px] font-semibold ${b.kind === "income" ? "text-pos" : ""}`} />
        {b.status !== "paid" && (
          <button onClick={pay} className="mt-0.5 block w-full text-right text-[11px] font-semibold text-brand">
            {b.kind === "income" ? "Registrar" : "Pagar"} ›
          </button>
        )}
      </div>
    </div>
  );
}

function UpcomingStatements({ statements, currency, hide }: { statements: { closing: string; due: string; charged: number; interest: number }[]; currency: string; hide: boolean }) {
  if (!statements.length) return null;
  return (
    <div className="mt-3 border-t border-line/60 pt-3">
      <div className="mb-1.5 flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-muted">
        <CalendarClock size={12} /> Próximos pagos
      </div>
      {statements.map((s) => (
        <div key={s.closing} className="flex justify-between py-0.5 text-xs">
          <span className="text-muted">Vence {s.due.slice(8, 10)}/{s.due.slice(5, 7)}</span>
          <span>
            <Money value={s.charged} hidden={hide} currency={currency} className="font-semibold" />
            {s.interest > 0 && <span className="text-warn"> (incl. {(s.interest / 100).toFixed(2)} int.)</span>}
          </span>
        </div>
      ))}
    </div>
  );
}
