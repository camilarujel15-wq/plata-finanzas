"use client";

import { AppIcon } from "@/components/ui/AppIcon";
import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { useStore } from "@/lib/store/store";
import { useAccounts, useCategories, useFx, useSpendableAccounts } from "@/lib/store/selectors";
import { EmojiPicker, Empty, PageHeader, Segmented } from "@/components/ui/bits";
import { Money } from "@/components/ui/Money";
import { MoneyInput } from "@/components/ui/MoneyInput";
import { Sheet } from "@/components/ui/Sheet";
import { EMOJIS } from "@/lib/domain/defaults";
import { toBase } from "@/lib/domain/fx";
import type { RecurringItem, TxType } from "@/lib/domain/types";

const KIND_LABEL: Record<TxType, string> = { expense: "Gasto fijo", income: "Ingreso fijo", transfer: "Aporte / cuota" };

/** Gastos e ingresos que se repiten cada mes: alimentan la proyección de "Mi mes". */
export default function GastosFijos() {
  const s = useStore();
  const fx = useFx();
  const accounts = useAccounts(true);
  const [editing, setEditing] = useState<Partial<RecurringItem> | null>(null);
  const items = useMemo(() => (s.recurring ?? []).filter((r) => !r.deletedAt).sort((a, b) => a.dayOfMonth - b.dayOfMonth), [s.recurring]);
  const cur = (id: string) => accounts.find((a) => a.id === id)?.currency ?? fx.base;
  const totalOut = items.filter((r) => r.active && r.type !== "income").reduce((a, r) => a + toBase(r.amount, cur(r.accountId), fx), 0);
  const totalIn = items.filter((r) => r.active && r.type === "income").reduce((a, r) => a + toBase(r.amount, cur(r.accountId), fx), 0);
  const hide = !!s.settings.hideAmounts;

  return (
    <div>
      <PageHeader
        title="Gastos fijos"
        back="/mi-mes/"
        action={
          <button className="btn-primary px-3 py-2" onClick={() => setEditing({ type: "expense", dayOfMonth: 5 })}>
            <Plus size={16} /> Nuevo
          </button>
        }
      />

      {items.length > 0 && (
        <div className="card grid grid-cols-2 gap-3 p-4">
          <div>
            <div className="text-xs text-muted">Salen cada mes</div>
            <Money value={totalOut} hidden={hide} className="text-lg font-semibold text-neg" />
          </div>
          <div>
            <div className="text-xs text-muted">Entran cada mes</div>
            <Money value={totalIn} hidden={hide} className="text-lg font-semibold text-pos" />
          </div>
          {totalIn > 0 && (
            <div className="col-span-2 text-xs text-muted">
              Tus fijos se llevan el <b className="text-ink">{Math.round((totalOut / totalIn) * 100)}%</b> de tus ingresos fijos.
            </div>
          )}
        </div>
      )}

      <p className="mt-3 px-1 text-xs leading-relaxed text-muted">
        Los pagos de tus <b>tarjetas de crédito</b> se calculan solos a partir de tus compras: no necesitas agregarlos aquí.
      </p>

      {!items.length && (
        <div className="mt-3">
          <Empty icon="i:calendar" title="Sin gastos fijos" body="Alquiler, luz, agua, internet, celular, suscripciones, cuota del terreno y también tu sueldo." action={<button className="btn-primary" onClick={() => setEditing({ type: "expense", dayOfMonth: 5 })}>Agregar el primero</button>} />
        </div>
      )}

      <div className="mt-3 card divide-y divide-line/60">
        {items.map((r) => (
          <button key={r.id} onClick={() => setEditing(r)} className={`flex w-full items-center gap-3 px-4 py-3 text-left ${r.active ? "" : "opacity-50"}`}>
            <span className="flex h-[42px] w-[42px] shrink-0 flex-col items-center justify-center rounded-full bg-surface-2 leading-none">
              <AppIcon icon={r.icon} size={17} className="text-ink/80" />
              <span className="mt-0.5 text-[9px] font-semibold text-muted">día {r.dayOfMonth}</span>
            </span>
            <div className="min-w-0 flex-1">
              <div className="truncate font-semibold">{r.name}</div>
              <div className="truncate text-xs text-muted">
                {KIND_LABEL[r.type]} · {accounts.find((a) => a.id === r.accountId)?.name ?? "?"}
                {!r.active && " · pausado"}
              </div>
            </div>
            <Money value={r.type === "income" ? r.amount : -r.amount} sign={r.type === "income"} hidden={hide} currency={cur(r.accountId)} className={`font-semibold ${r.type === "income" ? "text-pos" : ""}`} />
          </button>
        ))}
      </div>

      {editing && <RecurringForm initial={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

function RecurringForm({ initial, onClose }: { initial: Partial<RecurringItem>; onClose: () => void }) {
  const s = useStore();
  const spendable = useSpendableAccounts();
  const all = useAccounts();
  const [r, setR] = useState<Partial<RecurringItem>>({
    icon: initial.type === "income" ? "i:briefcase" : "i:receipt",
    active: true,
    accountId: s.settings.defaultAccountId ?? spendable[0]?.id,
    ...initial,
  });
  const cats = useCategories(r.type === "income" ? "income" : "expense");
  const investments = all.filter((a) => a.type === "investment");
  const acc = all.find((a) => a.id === r.accountId);
  const ok = r.name?.trim() && r.amount && r.amount > 0 && r.accountId && r.dayOfMonth && (r.type !== "transfer" || r.toAccountId);

  return (
    <Sheet
      open
      onClose={onClose}
      title={initial.id ? "Editar fijo" : "Nuevo fijo"}
      footer={
        <div className="flex gap-2">
          {initial.id && (
            <button className="btn-danger" onClick={() => { s.deleteRecurring(initial.id!); onClose(); }}>
              Eliminar
            </button>
          )}
          <button className="btn-primary flex-1" disabled={!ok} onClick={() => { s.upsertRecurring({ ...(r as RecurringItem), name: r.name!.trim() }); onClose(); }}>
            Guardar
          </button>
        </div>
      }
    >
      <div className="grid gap-4">
        <Segmented
          value={r.type ?? "expense"}
          onChange={(type) => setR({ ...r, type, categoryId: null, toAccountId: null, icon: type === "income" ? "i:briefcase" : type === "transfer" ? "i:property" : "i:receipt" })}
          options={[
            { value: "expense", label: "Gasto" },
            { value: "income", label: "Ingreso" },
            { value: "transfer", label: "Aporte" },
          ]}
        />
        <div>
          <label className="label" htmlFor="r-name">Nombre</label>
          <input
            id="r-name"
            className="input"
            placeholder={r.type === "income" ? "Sueldo, alquiler que cobro…" : r.type === "transfer" ? "Cuota terreno, ahorro mensual…" : "Luz, internet, celular, Netflix…"}
            value={r.name ?? ""}
            onChange={(e) => setR({ ...r, name: e.target.value })}
          />
        </div>
        <div className="grid grid-cols-[1fr_110px] gap-3">
          <div>
            <label className="label" htmlFor="r-amount">Monto aprox.</label>
            <MoneyInput id="r-amount" value={r.amount ?? null} onChange={(v) => setR({ ...r, amount: v ?? 0 })} currency={acc?.currency} />
          </div>
          <div>
            <label className="label" htmlFor="r-day">Día del mes</label>
            <input
              id="r-day"
              className="input num text-center"
              inputMode="numeric"
              value={r.dayOfMonth ?? ""}
              onChange={(e) => {
                const n = Math.max(1, Math.min(31, Number(e.target.value.replace(/\D/g, "")) || 1));
                setR({ ...r, dayOfMonth: n });
              }}
            />
          </div>
        </div>
        <div>
          <div className="label">{r.type === "income" ? "Entra a" : "Se paga con"}</div>
          <div className="flex flex-wrap gap-2">
            {spendable.map((a) => (
              <button key={a.id} className={`chip ${r.accountId === a.id ? "chip-on" : ""}`} onClick={() => setR({ ...r, accountId: a.id })}>
                <AppIcon icon={a.icon} size={15} className="shrink-0" /> {a.name}
              </button>
            ))}
          </div>
        </div>
        {r.type === "transfer" ? (
          <div>
            <div className="label">Hacia (inversión)</div>
            {investments.length ? (
              <div className="flex flex-wrap gap-2">
                {investments.map((a) => (
                  <button key={a.id} className={`chip ${r.toAccountId === a.id ? "chip-on" : ""}`} onClick={() => setR({ ...r, toAccountId: a.id, name: r.name || `Cuota ${a.name}`, icon: a.icon })}>
                    <AppIcon icon={a.icon} size={15} className="shrink-0" /> {a.name}
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted">Primero crea la inversión en Más → Inversiones.</p>
            )}
          </div>
        ) : (
          <div>
            <div className="label">Categoría</div>
            <div className="flex flex-wrap gap-2">
              {cats.map((c) => (
                <button key={c.id} className={`chip ${r.categoryId === c.id ? "chip-on" : ""}`} onClick={() => setR({ ...r, categoryId: c.id, icon: initial.id ? r.icon : c.icon })}>
                  <AppIcon icon={c.icon} size={15} className="shrink-0" /> {c.name}
                </button>
              ))}
            </div>
          </div>
        )}
        <div>
          <div className="label">Ícono</div>
          <EmojiPicker value={r.icon!} onChange={(icon) => setR({ ...r, icon })} />
        </div>
        {initial.id && (
          <Segmented
            value={r.active ? "on" : "off"}
            onChange={(v) => setR({ ...r, active: v === "on" })}
            options={[
              { value: "on", label: "Activo" },
              { value: "off", label: "Pausado" },
            ]}
          />
        )}
      </div>
    </Sheet>
  );
}
