"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { HandCoins, Plus } from "lucide-react";
import { useStore } from "@/lib/store/store";
import { useUI } from "@/lib/store/ui";
import { useAccounts, useBalances, usePosition } from "@/lib/store/selectors";
import { Empty, IconBubble, PageHeader, Section } from "@/components/ui/bits";
import { Money } from "@/components/ui/Money";
import { AccountForm } from "@/components/accounts/AccountForm";
import { dayLabel, daysBetween, today } from "@/lib/domain/dates";
import type { Account } from "@/lib/domain/types";

/** Cuentas por cobrar: quién te debe, cuánto, desde cuándo y cuándo prometió pagar. */
export default function MeDeben() {
  const all = useAccounts(true);
  const balances = useBalances();
  const pos = usePosition();
  const hide = !!useStore((s) => s.settings.hideAmounts);
  const openQuickAdd = useUI((u) => u.openQuickAdd);
  const [editing, setEditing] = useState<Partial<Account> | null>(null);

  const people = useMemo(() => all.filter((a) => a.type === "receivable" && !a.archived), [all]);
  const pending = people.filter((a) => (balances.get(a.id) ?? 0) > 0).sort((a, b) => (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999"));
  const settled = [...people.filter((a) => (balances.get(a.id) ?? 0) <= 0), ...all.filter((a) => a.type === "receivable" && a.archived)];

  return (
    <div>
      <PageHeader
        title="Me deben"
        back="/mas/"
        action={
          <button className="btn-primary px-3 py-2" onClick={() => setEditing({})}>
            <Plus size={16} /> Nueva
          </button>
        }
      />

      <section className="hero p-5">
        <div className="text-[11px] font-semibold tracking-wide text-amber-200">TE DEBEN EN TOTAL</div>
        <Money value={pos.receivables} hidden={hide} className="mt-2 block text-[34px] font-extrabold leading-none" />
        <p className="mt-3 text-xs text-white/60">
          {pending.length} {pending.length === 1 ? "persona" : "personas"} · Cuenta en tu patrimonio, no en tu disponible.
        </p>
      </section>

      {!people.length && (
        <div className="mt-4">
          <Empty
            icon="🤝"
            title="¿Alguien te debe dinero?"
            body="Registra a quién le prestaste o por quién pagaste. Cuando te pague, toca “Me pagó” y el dinero vuelve a tu cuenta."
            action={<button className="btn-primary" onClick={() => setEditing({})}>Registrar deuda</button>}
          />
        </div>
      )}

      <div className="mt-4 grid gap-3">
        {pending.map((a) => {
          const owed = balances.get(a.id) ?? 0;
          const overdue = a.dueDate && a.dueDate < today();
          return (
            <div key={a.id} className="card p-4">
              <Link href={`/me-deben/detalle/?id=${a.id}`} className="flex w-full items-center gap-3 text-left">
                <IconBubble icon={a.icon} color={a.color} size={46} />
                <div className="min-w-0 flex-1">
                  <div className="truncate font-bold">{a.name}</div>
                  <div className="truncate text-xs text-muted">{a.note || "Sin concepto"}</div>
                  {a.dueDate && (
                    <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold ${overdue ? "bg-neg/12 text-neg" : "bg-surface-2 text-muted"}`}>
                      {overdue ? `Venció hace ${daysBetween(a.dueDate, today())} días` : `Paga ${dayLabel(a.dueDate).toLowerCase()}`}
                    </span>
                  )}
                </div>
                <div className="text-right">
                  <Money value={owed} hidden={hide} currency={a.currency} className="text-lg font-extrabold" />
                  <div className="text-[11px] font-semibold text-brand-strong">Ver historial ›</div>
                </div>
              </Link>
              <div className="mt-3 flex gap-2">
                <button className="btn-primary flex-1 py-2.5" onClick={() => openQuickAdd({ type: "transfer", fromAccountId: a.id })}>
                  <HandCoins size={16} /> Me pagó
                </button>
                <button className="btn-ghost py-2.5" onClick={() => openQuickAdd({ type: "transfer", toAccountId: a.id })}>
                  Le presté más
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {settled.length > 0 && (
        <Section title="Saldadas y archivadas">
          <div className="card divide-y divide-line/60">
            {settled.map((a) => (
              <Link key={a.id} href={`/me-deben/detalle/?id=${a.id}`} className="flex w-full items-center gap-3 px-4 py-3 text-left opacity-75">
                <IconBubble icon={a.icon} color={a.color} size={34} />
                <span className="min-w-0 flex-1 truncate font-medium">
                  {a.name}
                  {a.note && <span className="text-xs text-muted"> · {a.note}</span>}
                </span>
                <span className="text-xs font-semibold text-pos">{a.archived ? "🗄️ Archivada" : "✓ Saldado"}</span>
              </Link>
            ))}
          </div>
        </Section>
      )}

      {editing && <AccountForm initial={editing} mode="receivable" onClose={() => setEditing(null)} />}
    </div>
  );
}
