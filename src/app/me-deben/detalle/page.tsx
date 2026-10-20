"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowDownLeft, ArrowUpRight, HandCoins, Pencil, Plus } from "lucide-react";
import { useStore } from "@/lib/store/store";
import { useUI } from "@/lib/store/ui";
import { useBalances, useTransactions } from "@/lib/store/selectors";
import { Empty, IconBubble, PageHeader } from "@/components/ui/bits";
import { Money } from "@/components/ui/Money";
import { AccountForm } from "@/components/accounts/AccountForm";
import { dayLabel, daysBetween, today } from "@/lib/domain/dates";

interface Item {
  id: string;
  txId?: string;
  date: string;
  sortKey: string;
  title: string;
  subtitle: string;
  amount: number; // + préstamo (aumenta lo que te deben) · − devolución
  balance: number; // lo que te debía después de este movimiento
}

/** Historial de una persona: cada préstamo suma y cada devolución resta; se ve cuánto debe tras cada uno. */
export default function DetalleDeuda() {
  const id = useSearchParams().get("id") ?? "";
  const s = useStore();
  const txs = useTransactions();
  const balances = useBalances();
  const openQuickAdd = useUI((u) => u.openQuickAdd);
  const [editing, setEditing] = useState(false);
  const person = s.accounts.find((a) => a.id === id && !a.deletedAt);
  const accName = useMemo(() => new Map(s.accounts.map((a) => [a.id, a.name])), [s.accounts]);
  const hide = !!s.settings.hideAmounts;

  const items = useMemo(() => {
    if (!person) return [];
    const raw: Omit<Item, "balance">[] = [];
    if (person.initialBalance) {
      raw.push({
        id: "initial",
        date: person.createdAt.slice(0, 10),
        sortKey: `${person.createdAt.slice(0, 10)}0`,
        title: person.note || "Deuda registrada",
        subtitle: "Monto inicial",
        amount: person.initialBalance,
      });
    }
    for (const t of txs) {
      if (t.type !== "transfer") continue;
      if (t.toAccountId === person.id) {
        raw.push({
          id: t.id, txId: t.id, date: t.date, sortKey: `${t.date}1${t.createdAt}`,
          title: t.merchant || t.note || "Préstamo",
          subtitle: `Préstamo · desde ${accName.get(t.accountId) ?? "?"}`,
          amount: t.toAmount ?? t.amount,
        });
      } else if (t.accountId === person.id) {
        raw.push({
          id: t.id, txId: t.id, date: t.date, sortKey: `${t.date}1${t.createdAt}`,
          title: t.merchant || t.note || "Te devolvió",
          subtitle: `Devolución · a ${accName.get(t.toAccountId ?? "") ?? "?"}`,
          amount: -t.amount,
        });
      }
    }
    raw.sort((a, b) => a.sortKey.localeCompare(b.sortKey));
    let run = 0;
    return raw.map((r) => ({ ...r, balance: (run += r.amount) })).reverse();
  }, [person, txs, accName]);

  if (!person) {
    return (
      <div>
        <PageHeader title="Me deben" back="/me-deben/" />
        <Empty icon="🤷" title="No encontramos a esta persona" />
      </div>
    );
  }

  const owed = balances.get(person.id) ?? 0;
  const lent = items.filter((i) => i.amount > 0).reduce((a, i) => a + i.amount, 0);
  const repaid = -items.filter((i) => i.amount < 0).reduce((a, i) => a + i.amount, 0);
  const overdue = person.dueDate && person.dueDate < today() && owed > 0;

  return (
    <div>
      <PageHeader
        title={person.name}
        back="/me-deben/"
        action={
          <button aria-label="Editar" onClick={() => setEditing(true)} className="tap flex h-10 w-10 items-center justify-center rounded-full bg-surface shadow-card">
            <Pencil size={17} />
          </button>
        }
      />

      <section className="hero p-5">
        <div className="flex items-center gap-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 text-2xl">{person.icon}</span>
          <div className="min-w-0">
            <div className="text-[11px] font-semibold tracking-wide text-amber-200">{owed > 0 ? "AÚN TE DEBE" : "SALDADO"}</div>
            <Money value={Math.max(0, owed)} hidden={hide} currency={person.currency} className="block text-[32px] font-extrabold leading-none" />
          </div>
        </div>
        {person.note && <p className="mt-3 text-sm text-white/70">{person.note}</p>}
        <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
          <div className="rounded-2xl bg-white/[0.07] px-3 py-2.5 ring-1 ring-white/[0.08]">
            <div className="text-white/55">Le prestaste</div>
            <Money value={lent} hidden={hide} currency={person.currency} className="text-[15px] font-bold" />
          </div>
          <div className="rounded-2xl bg-white/[0.07] px-3 py-2.5 ring-1 ring-white/[0.08]">
            <div className="text-white/55">Te devolvió</div>
            <Money value={repaid} hidden={hide} currency={person.currency} className="text-[15px] font-bold text-emerald-200" />
          </div>
        </div>
        {person.dueDate && owed > 0 && (
          <div className={`mt-3 rounded-2xl px-3 py-2 text-xs font-semibold ${overdue ? "bg-rose-400/15 text-rose-200" : "bg-white/[0.07] text-white/70"}`}>
            {overdue ? `⚠️ Venció hace ${daysBetween(person.dueDate, today())} días` : `📅 Prometió pagar ${dayLabel(person.dueDate).toLowerCase()}`}
          </div>
        )}
      </section>

      <div className="mt-4 flex gap-2">
        <button className="btn-primary flex-1" onClick={() => openQuickAdd({ type: "transfer", fromAccountId: person.id })} disabled={owed <= 0}>
          <HandCoins size={17} /> Me pagó
        </button>
        <button className="btn-ghost flex-1" onClick={() => openQuickAdd({ type: "transfer", toAccountId: person.id })}>
          <Plus size={17} /> Le presté más
        </button>
      </div>

      <h2 className="mb-3 mt-7 px-1 text-[17px] font-bold tracking-tight">Historial</h2>
      {items.length === 0 ? (
        <Empty icon="📜" title="Sin movimientos" body="Los préstamos y devoluciones aparecerán aquí." />
      ) : (
        <div className="card divide-y divide-line/60 overflow-hidden">
          {items.map((i) => (
            <button
              key={i.id}
              disabled={!i.txId}
              onClick={() => i.txId && openQuickAdd({ editId: i.txId })}
              className="flex w-full items-center gap-3 px-4 py-3 text-left transition active:bg-surface-2"
            >
              <span className={`flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-[14px] ${i.amount > 0 ? "bg-warn/12 text-warn" : "bg-pos/12 text-pos"}`}>
                {i.amount > 0 ? <ArrowUpRight size={19} strokeWidth={2.4} /> : <ArrowDownLeft size={19} strokeWidth={2.4} />}
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[15px] font-semibold">{i.title}</div>
                <div className="truncate text-xs text-muted">
                  {dayLabel(i.date)} · {i.subtitle}
                </div>
              </div>
              <div className="text-right">
                <Money value={i.amount} sign hidden={hide} currency={person.currency} className={`text-[15px] font-bold ${i.amount < 0 ? "text-pos" : ""}`} />
                <div className="text-[11px] text-muted">
                  Debe <Money value={i.balance} hidden={hide} currency={person.currency} />
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
      <p className="mt-3 px-1 text-xs text-muted">＋ préstamo (aumenta lo que te debe) · − devolución. Toca un movimiento para corregirlo.</p>

      {editing && <AccountForm initial={person} mode="receivable" onClose={() => setEditing(false)} />}
    </div>
  );
}
