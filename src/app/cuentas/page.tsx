"use client";

import Link from "next/link";
import { useState } from "react";
import { Archive, ChevronRight, Link2, Plus } from "lucide-react";
import { useStore } from "@/lib/store/store";
import { useAccounts, useBalances, usePosition } from "@/lib/store/selectors";
import { IconBubble, PageHeader, Progress, Section } from "@/components/ui/bits";
import { Money } from "@/components/ui/Money";
import { AccountForm } from "@/components/accounts/AccountForm";
import { ACCOUNT_TYPE_LABEL, countsForAvailable, isSpendable, type Account, type AccountType } from "@/lib/domain/types";

const ORDER: AccountType[] = ["checking", "savings", "wallet", "cash", "credit_card"];

export default function Cuentas() {
  const s = useStore();
  const all = useAccounts(true);
  const accounts = all.filter((a) => !a.archived && isSpendable(a.type));
  const archived = all.filter((a) => a.archived);
  const balances = useBalances();
  const pos = usePosition();
  const hide = !!s.settings.hideAmounts;
  const [editing, setEditing] = useState<Partial<Account> | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const byId = new Map(all.map((a) => [a.id, a]));

  return (
    <div>
      <PageHeader
        title="Cuentas"
        back="/mas/"
        action={
          <button className="btn-primary px-3 py-2" onClick={() => setEditing({ type: "checking" })}>
            <Plus size={16} /> Nueva
          </button>
        }
      />

      {/* Resumen completo: aquí sí se ve todo tu dinero */}
      <section className="card p-4">
        <div className="text-xs font-medium text-muted">Disponible para gastar</div>
        <Money value={pos.available} hidden={hide} className="text-[28px] font-extrabold tracking-tight" />
        <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-line/70 pt-3 text-sm">
          <Row label="Cuentas para gastar" value={pos.spendable} hide={hide} />
          <Row label="Ahorros y otras" value={pos.assets - pos.spendable} hide={hide} />
          <Row label="Deuda de tarjetas" value={-pos.debt} hide={hide} neg />
          <Row label="Apartado en metas" value={pos.reserved} hide={hide} />
          <Link href="/inversiones/"><Row label="Inversiones ›" value={pos.investments} hide={hide} /></Link>
          <Link href="/me-deben/"><Row label="Me deben ›" value={pos.receivables} hide={hide} /></Link>
        </div>
        <div className="mt-3 flex items-baseline justify-between rounded-2xl bg-surface-2 px-3 py-2.5">
          <span className="text-xs font-semibold text-muted">Patrimonio neto</span>
          <Money value={pos.netWorth} hidden={hide} className="text-lg font-bold" />
        </div>
      </section>

      <p className="mt-3 px-1 text-xs leading-relaxed text-muted">
        Activa <b>“Para gastar”</b> en las cuentas cuyo dinero usas en el día a día. Solo esas forman tu disponible en la pantalla de inicio.
      </p>

      {ORDER.map((type) => {
        const list = accounts.filter((a) => a.type === type);
        if (!list.length) return null;
        return (
          <section key={type} className="mt-5">
            <h2 className="mb-2 px-1 text-sm font-semibold text-muted">{ACCOUNT_TYPE_LABEL[type]}</h2>
            <div className="card divide-y divide-line/60">
              {list.map((a) => {
                const b = balances.get(a.id) ?? 0;
                const linked = a.linkedAccountId ? byId.get(a.linkedAccountId) : undefined;
                const on = countsForAvailable(a);
                return (
                  <div key={a.id} className="px-3 py-3">
                    <div className="flex items-center gap-3">
                      <button onClick={() => setEditing(a)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                        <IconBubble icon={a.icon} color={a.color} />
                        <div className="min-w-0 flex-1">
                          <div className="truncate font-semibold">{a.name}</div>
                          <div className="flex items-center gap-1 truncate text-xs text-muted">
                            {linked ? (
                              <>
                                <Link2 size={12} /> Usa el saldo de {linked.name}
                              </>
                            ) : a.currency === "USD" ? (
                              "🇺🇸 Dólares"
                            ) : (
                              "Toca para editar"
                            )}
                          </div>
                        </div>
                      </button>
                      <Link href={`/movimientos/?account=${a.id}`} className="text-right">
                        <Money value={b} hidden={hide} currency={a.currency} className={`font-bold ${b < 0 ? "text-neg" : linked ? "text-muted" : ""}`} />
                        <div className="text-[11px] font-medium text-brand-strong">Movimientos</div>
                      </Link>
                    </div>
                    {a.type === "credit_card" && a.creditLimit ? (
                      <div className="mt-2 pl-[54px]">
                        <Progress value={Math.max(0, -b) / a.creditLimit} />
                        <div className="mt-1 text-[11px] text-muted">
                          Disponible en la tarjeta <Money value={a.creditLimit + Math.min(0, b)} hidden={hide} currency={a.currency} />
                        </div>
                      </div>
                    ) : null}
                    {!linked && (
                      <div className="mt-2 pl-[54px]">
                        <button
                          onClick={() => s.upsertAccount({ ...a, includeInAvailable: !on })}
                          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold transition ${on ? "bg-pos/12 text-pos" : "bg-surface-2 text-muted"}`}
                        >
                          <span className={`h-2 w-2 rounded-full ${on ? "bg-pos" : "bg-muted/50"}`} />
                          {on ? "Para gastar" : "No se usa para gastar"}
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}

      {archived.length > 0 && (
        <Section title="Archivadas" action={<button className="link" onClick={() => setShowArchived((v) => !v)}>{showArchived ? "Ocultar" : `Ver (${archived.length})`}</button>}>
          {showArchived && (
            <>
              <p className="mb-2 px-1 text-xs text-muted">Conservan su historial y no aparecen en ningún total. Tócalas para restaurarlas.</p>
              <div className="card divide-y divide-line/60 opacity-80">
                {archived.map((a) => (
                  <button key={a.id} onClick={() => setEditing(a)} className="flex w-full items-center gap-3 px-3 py-3 text-left">
                    <Archive size={16} className="text-muted" />
                    <IconBubble icon={a.icon} color={a.color} size={32} />
                    <span className="min-w-0 flex-1 truncate">
                      {a.name} <span className="text-xs text-muted">· {ACCOUNT_TYPE_LABEL[a.type]}</span>
                    </span>
                    <ChevronRight size={16} className="text-muted" />
                  </button>
                ))}
              </div>
            </>
          )}
        </Section>
      )}

      {editing && (
        <AccountForm
          initial={editing}
          mode={editing.type === "investment" ? "investment" : editing.type === "receivable" ? "receivable" : "account"}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}

function Row({ label, value, hide, neg }: { label: string; value: number; hide: boolean; neg?: boolean }) {
  return (
    <div>
      <div className="text-[11px] font-medium text-muted">{label}</div>
      <Money value={value} hidden={hide} compact className={`font-bold ${neg && value < 0 ? "text-neg" : ""}`} />
    </div>
  );
}
