"use client";

import Link from "next/link";
import { useState } from "react";
import { Archive, Plus } from "lucide-react";
import { useStore } from "@/lib/store/store";
import { useAccounts, useBalances, usePosition } from "@/lib/store/selectors";
import { IconBubble, PageHeader, Progress } from "@/components/ui/bits";
import { Money } from "@/components/ui/Money";
import { AccountForm } from "@/components/accounts/AccountForm";
import { ACCOUNT_TYPE_LABEL, isSpendable, type Account, type AccountType } from "@/lib/domain/types";

const ORDER: AccountType[] = ["checking", "savings", "wallet", "cash", "credit_card"];

export default function Cuentas() {
  const accounts = useAccounts();
  const archived = useAccounts(true).filter((a) => a.archived && isSpendable(a.type));
  const balances = useBalances();
  const pos = usePosition();
  const hide = !!useStore((s) => s.settings.hideAmounts);
  const [editing, setEditing] = useState<Partial<Account> | null>(null);

  return (
    <div>
      <PageHeader
        title="Cuentas"
        back="/mas"
        action={
          <button className="btn-primary px-3 py-2" onClick={() => setEditing({ type: "checking" })}>
            <Plus size={16} /> Nueva
          </button>
        }
      />

      <div className="card grid grid-cols-2 gap-3 p-4">
        <div>
          <div className="text-xs text-muted">Activos</div>
          <Money value={pos.assets} hidden={hide} className="text-lg font-semibold" />
        </div>
        <div>
          <div className="text-xs text-muted">Deuda tarjetas</div>
          <Money value={-pos.debt} hidden={hide} className="text-lg font-semibold text-neg" />
        </div>
        <div className="col-span-2 border-t border-line/60 pt-3">
          <div className="text-xs text-muted">Patrimonio neto (incluye inversiones y lo que te deben)</div>
          <Money value={pos.netWorth} hidden={hide} className="text-2xl font-bold" />
        </div>
      </div>

      {ORDER.map((type) => {
        const list = accounts.filter((a) => a.type === type);
        if (!list.length) return null;
        return (
          <section key={type} className="mt-5">
            <h2 className="mb-2 px-1 text-sm font-semibold text-muted">{ACCOUNT_TYPE_LABEL[type]}</h2>
            <div className="card divide-y divide-line/60">
              {list.map((a) => {
                const b = balances.get(a.id) ?? 0;
                return (
                  <div key={a.id} className="flex items-center gap-3 px-3 py-3">
                    <button onClick={() => setEditing(a)} className="tap flex min-w-0 flex-1 items-center gap-3 text-left">
                      <IconBubble icon={a.icon} color={a.color} />
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-medium">{a.name}</div>
                        {a.type === "credit_card" && a.creditLimit ? (
                          <div className="mt-1">
                            <Progress value={Math.max(0, -b) / a.creditLimit} />
                            <div className="mt-1 text-[11px] text-muted">
                              Disponible <Money value={a.creditLimit + Math.min(0, b)} hidden={hide} currency={a.currency} />
                            </div>
                          </div>
                        ) : (
                          <div className="text-xs text-muted">{a.currency === "USD" ? "🇺🇸 Dólares" : "Toca para editar"}</div>
                        )}
                      </div>
                    </button>
                    <Link href={`/movimientos/?account=${a.id}`} className="text-right">
                      <Money value={b} hidden={hide} currency={a.currency} className={`font-semibold ${b < 0 ? "text-neg" : ""}`} />
                      <div className="text-[11px] text-brand">Movimientos</div>
                    </Link>
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}

      {archived.length > 0 && (
        <section className="mt-5">
          <h2 className="mb-2 flex items-center gap-1 px-1 text-sm font-semibold text-muted">
            <Archive size={14} /> Archivadas
          </h2>
          <div className="card divide-y divide-line/60 opacity-70">
            {archived.map((a) => (
              <button key={a.id} onClick={() => setEditing(a)} className="flex w-full items-center gap-3 px-3 py-3 text-left">
                <IconBubble icon={a.icon} color={a.color} size={32} />
                <span className="flex-1">{a.name}</span>
                <Money value={balances.get(a.id) ?? 0} hidden={hide} currency={a.currency} />
              </button>
            ))}
          </div>
        </section>
      )}

      {editing && <AccountForm initial={editing} mode="account" onClose={() => setEditing(null)} />}
    </div>
  );
}
