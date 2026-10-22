"use client";

import { AppIcon } from "@/components/ui/AppIcon";
import { useState } from "react";
import { useStore } from "@/lib/store/store";
import { useUI } from "@/lib/store/ui";
import { useBalances, useSpendableAccounts } from "@/lib/store/selectors";
import { today } from "@/lib/domain/dates";
import { EmojiPicker, Segmented, SwatchPicker } from "@/components/ui/bits";
import { Money } from "@/components/ui/Money";
import { MoneyInput } from "@/components/ui/MoneyInput";
import { Sheet } from "@/components/ui/Sheet";
import { ACCOUNT_TYPE_ICON, EMOJIS, PALETTE } from "@/lib/domain/defaults";
import { ACCOUNT_TYPE_LABEL, INVESTMENT_KIND_LABEL, countsForAvailable, type Account, type AccountType, type Currency, type InvestmentKind } from "@/lib/domain/types";

export type AccountMode = "account" | "investment" | "receivable";

const SPENDABLE: AccountType[] = ["checking", "savings", "credit_card", "wallet", "cash"];

const TITLES: Record<AccountMode, [string, string]> = {
  account: ["Nueva cuenta", "Editar cuenta"],
  investment: ["Nueva inversión", "Editar inversión"],
  receivable: ["Nueva deuda a cobrar", "Editar deuda"],
};

/** Formulario único para cuentas, inversiones y deudas por cobrar (todas son "cuentas" con saldo propio). */
export function AccountForm({ initial, mode, onClose }: { initial: Partial<Account>; mode: AccountMode; onClose: () => void }) {
  const s = useStore();
  const toast = useUI((u) => u.toast);
  const balances = useBalances();
  const type: AccountType = mode === "investment" ? "investment" : mode === "receivable" ? "receivable" : (initial.type ?? "checking");
  const [a, setA] = useState<Partial<Account>>({
    color: mode === "receivable" ? "#f59e0b" : mode === "investment" ? "#6366f1" : PALETTE[1],
    icon: mode === "investment" ? INVESTMENT_KIND_LABEL[initial.investmentKind ?? "property"].icon : ACCOUNT_TYPE_ICON[type],
    currency: s.settings.currency,
    investmentKind: mode === "investment" ? "property" : null,
    ...initial,
    type,
  });
  const isCard = a.type === "credit_card";
  const isNew = !initial.id;
  const [opening, setOpening] = useState<number | null>(initial.initialBalance ? Math.abs(initial.initialBalance) : null);
  const current = initial.id ? balances.get(initial.id) ?? 0 : null;
  const cur = (a.currency ?? "PEN") as Currency;
  const spendable = useSpendableAccounts();
  const [lentFrom, setLentFrom] = useState<string>("");

  const save = () => {
    if (!a.name?.trim()) return;
    const ib = isCard ? -Math.abs(opening ?? 0) : opening ?? 0;
    // Préstamo que salió de una cuenta: la deuda nace en 0 y se registra la transferencia (descuenta tu cuenta).
    const lent = isNew && mode === "receivable" && lentFrom && ib > 0;
    const linked = a.type === "wallet" ? a.linkedAccountId || null : null;
    const row = s.upsertAccount({
      ...(a as Account),
      name: a.name.trim(),
      initialBalance: lent || linked ? 0 : ib,
      note: a.note?.trim() || null,
      linkedAccountId: linked,
    });
    if (lent) {
      s.addTransaction({ type: "transfer", transferKind: "loan", amount: ib, accountId: lentFrom, toAccountId: row.id, date: today(), merchant: a.note?.trim() || `Préstamo a ${row.name}` });
    }
    onClose();
  };

  const labels = {
    name: mode === "receivable" ? "¿Quién te debe?" : mode === "investment" ? "Nombre" : "Nombre",
    namePh: mode === "receivable" ? "Ej. Juan, mi hermana, Oficina" : mode === "investment" ? "Ej. Cuota terreno Lurín, Diplomado" : "BCP Sueldo, Yape, Visa Interbank…",
    opening: mode === "receivable" ? "¿Cuánto te debe hoy?" : mode === "investment" ? "Ya aportado hasta hoy" : isCard ? "Deuda inicial" : "Saldo inicial",
  };

  return (
    <Sheet
      open
      onClose={onClose}
      title={TITLES[mode][isNew ? 0 : 1]}
      footer={
        <div className="flex gap-2">
          {!isNew && (
            <button
              className="btn-danger"
              onClick={() => {
                if (a.archived) s.upsertAccount({ ...(a as Account), archived: false });
                else {
                  s.deleteAccount(a.id!);
                  toast({ title: mode === "receivable" ? "Deuda archivada" : "Archivada", body: "Su historial se conserva." });
                }
                onClose();
              }}
            >
              {a.archived ? "Restaurar" : mode === "receivable" ? "Ya me pagó / archivar" : "Archivar"}
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
          <label className="label" htmlFor="acc-name">{labels.name}</label>
          <input id="acc-name" className="input" placeholder={labels.namePh} value={a.name ?? ""} onChange={(e) => setA({ ...a, name: e.target.value })} autoFocus={isNew} />
        </div>

        {mode === "account" && (
          <div>
            <div className="label">Tipo</div>
            <div className="flex flex-wrap gap-2">
              {SPENDABLE.map((t) => (
                <button key={t} className={`chip ${a.type === t ? "chip-on" : ""}`} onClick={() => setA({ ...a, type: t, icon: isNew ? ACCOUNT_TYPE_ICON[t] : a.icon })}>
                  {ACCOUNT_TYPE_ICON[t]} {ACCOUNT_TYPE_LABEL[t]}
                </button>
              ))}
            </div>
          </div>
        )}

        {mode === "investment" && (
          <div>
            <div className="label">Tipo de inversión</div>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(INVESTMENT_KIND_LABEL) as InvestmentKind[]).map((k) => (
                <button key={k} className={`chip ${a.investmentKind === k ? "chip-on" : ""}`} onClick={() => setA({ ...a, investmentKind: k, icon: isNew ? INVESTMENT_KIND_LABEL[k].icon : a.icon })}>
                  {INVESTMENT_KIND_LABEL[k].icon} {INVESTMENT_KIND_LABEL[k].label}
                </button>
              ))}
            </div>
          </div>
        )}

        <div>
          <div className="label">Moneda</div>
          <Segmented
            value={cur}
            onChange={(currency) => setA({ ...a, currency })}
            options={[
              { value: "PEN", label: "🇵🇪 Soles" },
              { value: "USD", label: "🇺🇸 Dólares" },
            ]}
          />
        </div>

        {!(a.type === "wallet" && a.linkedAccountId) && (
          <div>
          <label className="label" htmlFor="acc-bal">{labels.opening}</label>
          <MoneyInput id="acc-bal" value={opening} onChange={setOpening} currency={cur} />
          {current !== null && (
            <p className="mt-1.5 text-xs text-muted">
              {mode === "receivable" ? "Pendiente de cobro" : mode === "investment" ? "Total aportado" : "Saldo actual"}: <Money value={current} currency={cur} className="font-semibold" />
            </p>
          )}
        </div>
        )}

        {a.type === "wallet" && mode === "account" && (
          <div className="rounded-2xl bg-surface-2 p-3">
            <div className="label">¿De dónde sale el dinero de esta billetera?</div>
            <div className="flex flex-wrap gap-2">
              <button className={`chip ${!a.linkedAccountId ? "chip-on" : ""}`} onClick={() => setA({ ...a, linkedAccountId: null })}>
                Tiene saldo propio
              </button>
              {spendable
                .filter((x) => x.id !== a.id && x.type !== "wallet" && x.type !== "credit_card")
                .map((x) => (
                  <button key={x.id} className={`chip ${a.linkedAccountId === x.id ? "chip-on" : ""}`} onClick={() => setA({ ...a, linkedAccountId: x.id, currency: x.currency })}>
                    <AppIcon icon={x.icon} size={15} className="shrink-0" /> {x.name}
                  </button>
                ))}
            </div>
            <p className="mt-2 text-xs leading-relaxed text-muted">
              Yape y Plin usan el saldo de tu cuenta bancaria. Vincúlala: podrás elegir “Yape” al pagar, pero el dinero se descontará de tu banco y no se contará dos veces.
            </p>
          </div>
        )}

        {mode === "account" && !(a.type === "wallet" && a.linkedAccountId) && (
          <div className="flex items-center justify-between gap-3 rounded-2xl bg-surface-2 p-3 text-sm">
            <span>
              <span className="font-semibold">Para gastar</span>
              <span className="block text-xs text-muted">Suma a tu “Disponible para gastar” en el inicio</span>
            </span>
            <button
              role="switch"
              aria-checked={countsForAvailable(a as Account)}
              onClick={() => setA({ ...a, includeInAvailable: !countsForAvailable(a as Account) })}
              className={`relative h-7 w-12 shrink-0 rounded-full transition ${countsForAvailable(a as Account) ? "bg-brand" : "bg-line"}`}
            >
              <span className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all ${countsForAvailable(a as Account) ? "left-[22px]" : "left-0.5"}`} />
            </button>
          </div>
        )}

        {isCard && (
          <div>
            <label className="label" htmlFor="acc-limit">Línea de crédito</label>
            <MoneyInput id="acc-limit" value={a.creditLimit ?? null} onChange={(v) => setA({ ...a, creditLimit: v })} currency={cur} />
          </div>
        )}

        {isCard && (
          <div className="rounded-2xl bg-surface-2 p-3">
            <div className="grid grid-cols-3 gap-2">
              <NumField label="Día de cierre" value={a.closingDay} onChange={(v) => setA({ ...a, closingDay: v })} max={31} placeholder="20" />
              <NumField label="Día de pago" value={a.dueDay} onChange={(v) => setA({ ...a, dueDay: v })} max={31} placeholder="15" />
              <NumField label="TEA %" value={a.tea} onChange={(v) => setA({ ...a, tea: v })} max={300} placeholder="65" decimal />
            </div>
            <p className="mt-2 text-xs leading-relaxed text-muted">
              Están en tu estado de cuenta: “fecha de cierre/facturación” y “último día de pago”. Lo que compras entre dos cierres se paga en la siguiente fecha de pago; si pagas el total, no pagas intereses. La TEA se usa para calcular tus compras en cuotas.
            </p>
          </div>
        )}

        {mode === "investment" && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label" htmlFor="inv-target">Costo total</label>
              <MoneyInput id="inv-target" value={a.targetAmount ?? null} onChange={(v) => setA({ ...a, targetAmount: v })} currency={cur} placeholder="Opcional" />
            </div>
            <div>
              <label className="label" htmlFor="inv-value">Valor actual</label>
              <MoneyInput id="inv-value" value={a.marketValue ?? null} onChange={(v) => setA({ ...a, marketValue: v })} currency={cur} placeholder="Opcional" />
            </div>
            <p className="col-span-2 -mt-1 text-xs text-muted">Costo total: para ver el % pagado (p. ej. precio del terreno). Valor actual: si vale más o menos de lo aportado.</p>
          </div>
        )}

        {mode === "receivable" && isNew && (
          <div>
            <div className="label">¿El dinero salió de una de tus cuentas?</div>
            <div className="flex flex-wrap gap-2">
              <button className={`chip ${!lentFrom ? "chip-on" : ""}`} onClick={() => setLentFrom("")}>No (p. ej. pagué su parte)</button>
              {spendable.filter((x) => x.currency === cur).map((x) => (
                <button key={x.id} className={`chip ${lentFrom === x.id ? "chip-on" : ""}`} onClick={() => setLentFrom(x.id)}>
                  <AppIcon icon={x.icon} size={15} className="shrink-0" /> {x.name}
                </button>
              ))}
            </div>
            {lentFrom && <p className="mt-1.5 text-xs text-muted">Se descontará de esa cuenta como préstamo (no cuenta como gasto).</p>}
          </div>
        )}

        {mode === "receivable" && (
          <div>
            <label className="label" htmlFor="due">¿Cuándo prometió pagarte?</label>
            <input id="due" type="date" className="input" value={a.dueDate ?? ""} onChange={(e) => setA({ ...a, dueDate: e.target.value || null })} />
          </div>
        )}

        {mode !== "account" && (
          <div>
            <label className="label" htmlFor="note">{mode === "receivable" ? "Concepto" : "Nota"}</label>
            <input
              id="note"
              className="input"
              placeholder={mode === "receivable" ? "Ej. Préstamo para su viaje, mitad de la cena" : "Ej. Lote 14, cuota 12 de 48"}
              value={a.note ?? ""}
              onChange={(e) => setA({ ...a, note: e.target.value })}
            />
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
        {!isNew && mode === "account" && (
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

function NumField({ label, value, onChange, max, placeholder, decimal }: { label: string; value?: number | null; onChange: (v: number | null) => void; max: number; placeholder: string; decimal?: boolean }) {
  const [text, setText] = useState(value != null ? String(value) : "");
  return (
    <label className="block">
      <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-muted">{label}</span>
      <input
        className="input num px-3 py-2.5 text-center"
        inputMode={decimal ? "decimal" : "numeric"}
        placeholder={placeholder}
        value={text}
        onChange={(e) => {
          const raw = e.target.value.replace(",", ".").replace(decimal ? /[^\d.]/g : /\D/g, "");
          setText(raw);
          const n = Number(raw);
          if (!raw || !Number.isFinite(n)) return onChange(null);
          onChange(Math.min(max, decimal ? n : Math.max(1, Math.round(n))));
        }}
      />
    </label>
  );
}
