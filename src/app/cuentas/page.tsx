"use client";

import Link from "next/link";
import { useState } from "react";
import { Archive, Plus } from "lucide-react";
import { useStore } from "@/lib/store/store";
import { useAccounts, useBalances, usePosition } from "@/lib/store/selectors";
import { useUI } from "@/lib/store/ui";
import { EmojiPicker, IconBubble, PageHeader, Progress, Segmented, SwatchPicker } from "@/components/ui/bits";
import { Money } from "@/components/ui/Money";
import { MoneyInput } from "@/components/ui/MoneyInput";
import { Sheet } from "@/components/ui/Sheet";
import { ACCOUNT_TYPE_ICON, EMOJIS, PALETTE } from "@/lib/domain/defaults";
import { ACCOUNT_TYPE_LABEL, type Account, type AccountType } from "@/lib/domain/types";

const ORDER: AccountType[] = ["checking", "savings", "wallet", "cash", "credit_card"];

export default function Cuentas() {
  const accounts = useAccounts();
  const archived = useAccounts(true).filter((a) => a.archived);
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
          <div className="text-xs text-muted">Patrimonio neto</div>
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
                              Disponible <Money value={a.creditLimit + Math.min(0, b)} hidden={hide} />
                            </div>
                          </div>
                        ) : (
                          <div className="text-xs text-muted">Toca para editar</div>
                        )}
                      </div>
                    </button>
                    <Link href={`/movimientos?account=${a.id}`} className="text-right">
                      <Money value={b} hidden={hide} className={`font-semibold ${b < 0 ? "text-neg" : ""}`} />
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
                <Money value={balances.get(a.id) ?? 0} hidden={hide} />
              </button>
            ))}
          </div>
        </section>
      )}

      {editing && <AccountForm initial={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

function AccountForm({ initial, onClose }: { initial: Partial<Account>; onClose: () => void }) {
  const s = useStore();
  const toast = useUI((u) => u.toast);
  const balances = useBalances();
  const [a, setA] = useState<Partial<Account>>({
    color: PALETTE[1],
    icon: ACCOUNT_TYPE_ICON[initial.type ?? "checking"],
    initialBalance: 0,
    ...initial,
  });
  const isCard = a.type === "credit_card";
  const isNew = !initial.id;
  // Para tarjetas el usuario ingresa la deuda en positivo.
  const [opening, setOpening] = useState<number | null>(initial.initialBalance ? Math.abs(initial.initialBalance) : null);
  const current = initial.id ? balances.get(initial.id) ?? 0 : null;

  const save = () => {
    if (!a.name?.trim()) return;
    const ib = isCard ? -Math.abs(opening ?? 0) : opening ?? 0;
    s.upsertAccount({ ...(a as Account), name: a.name.trim(), initialBalance: ib });
    onClose();
  };

  return (
    <Sheet
      open
      onClose={onClose}
      title={isNew ? "Nueva cuenta" : "Editar cuenta"}
      footer={
        <div className="flex gap-2">
          {!isNew && (
            <button
              className="btn-danger"
              onClick={() => {
                if (a.archived) s.upsertAccount({ ...(a as Account), archived: false });
                else {
                  s.deleteAccount(a.id!);
                  toast({ title: "Cuenta archivada", body: "Su historial se conserva." });
                }
                onClose();
              }}
            >
              {a.archived ? "Restaurar" : "Archivar"}
            </button>
          )}
          <button className="btn-primary flex-1" onClick={save} disabled={!a.name?.trim()}>
            Guardar
          </button>
        </div>
      }
    >
      <div className="grid gap-4">
        <div>
          <label className="label" htmlFor="acc-name">Nombre</label>
          <input id="acc-name" className="input" placeholder="BCP Sueldo, Yape, Visa Interbank…" value={a.name ?? ""} onChange={(e) => setA({ ...a, name: e.target.value })} autoFocus={isNew} />
        </div>
        <div>
          <div className="label">Tipo</div>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(ACCOUNT_TYPE_LABEL) as AccountType[]).map((t) => (
              <button key={t} className={`chip ${a.type === t ? "chip-on" : ""}`} onClick={() => setA({ ...a, type: t, icon: isNew ? ACCOUNT_TYPE_ICON[t] : a.icon })}>
                {ACCOUNT_TYPE_ICON[t]} {ACCOUNT_TYPE_LABEL[t]}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="label" htmlFor="acc-bal">{isCard ? "Deuda inicial" : "Saldo inicial"}</label>
          <MoneyInput id="acc-bal" value={opening} onChange={setOpening} />
          {current !== null && (
            <p className="mt-1 text-xs text-muted">
              Saldo actual calculado: <Money value={current} />. Cambiar el saldo inicial recalcula todo el historial.
            </p>
          )}
        </div>
        {isCard && (
          <div>
            <label className="label" htmlFor="acc-limit">Línea de crédito</label>
            <MoneyInput id="acc-limit" value={a.creditLimit ?? null} onChange={(v) => setA({ ...a, creditLimit: v })} />
          </div>
        )}
        <div>
          <div className="label">Color</div>
          <SwatchPicker value={a.color!} options={PALETTE} onChange={(color) => setA({ ...a, color })} />
        </div>
        <div>
          <div className="label">Ícono</div>
          <EmojiPicker value={a.icon!} options={EMOJIS} onChange={(icon) => setA({ ...a, icon })} />
        </div>
        {!isNew && (
          <Segmented
            value={s.settings.defaultAccountId === a.id ? "yes" : "no"}
            onChange={(v) => s.setSettings({ defaultAccountId: v === "yes" ? a.id : null })}
            options={[
              { value: "no", label: "Normal" },
              { value: "yes", label: "Predeterminada" },
            ]}
          />
        )}
      </div>
    </Sheet>
  );
}
