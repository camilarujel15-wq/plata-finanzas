"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { ACCOUNT_PRESETS } from "@/lib/domain/defaults";
import { useStore } from "@/lib/store/store";
import { buildDemoData } from "@/lib/store/demo";
import { MoneyInput } from "@/components/ui/MoneyInput";

/** Primer uso: en menos de un minuto quedan creadas las cuentas reales con su saldo actual. */
export function Onboarding() {
  const s = useStore();
  const [name, setName] = useState(s.settings.displayName);
  const [picked, setPicked] = useState<Record<string, number | null>>({ Efectivo: null });

  const toggle = (n: string) =>
    setPicked((p) => {
      const copy = { ...p };
      if (n in copy) delete copy[n];
      else copy[n] = null;
      return copy;
    });

  const start = () => {
    ACCOUNT_PRESETS.filter((p) => p.name in picked).forEach((p, i) => {
      const bal = picked[p.name] ?? 0;
      s.upsertAccount({ ...p, sortOrder: i, initialBalance: p.type === "credit_card" ? -Math.abs(bal) : bal });
    });
    s.setSettings({ displayName: name.trim(), onboarded: true });
  };

  return (
    <div className="pt-safe pb-8">
      <div className="pt-10 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-brand text-3xl text-brand-ink shadow-lg shadow-brand/30">S/</div>
        <h1 className="mt-4 text-2xl font-bold tracking-tight">Tus finanzas en segundos</h1>
        <p className="mx-auto mt-2 max-w-xs text-sm text-muted">Registra un gasto en 3 toques y conoce cuánto tienes realmente disponible. Sin hojas de cálculo.</p>
      </div>

      <div className="mt-8">
        <label className="label" htmlFor="name">¿Cómo te llamas?</label>
        <input id="name" className="input" placeholder="Tu nombre" value={name} onChange={(e) => setName(e.target.value)} />
      </div>

      <div className="mt-6">
        <div className="label">¿Qué cuentas usas? (saldo actual)</div>
        <div className="grid gap-2">
          {ACCOUNT_PRESETS.map((p) => {
            const on = p.name in picked;
            return (
              <div key={p.name} className={`card p-3 transition ${on ? "border-brand ring-1 ring-brand/30" : ""}`}>
                <button className="flex w-full items-center gap-3 text-left" onClick={() => toggle(p.name)}>
                  <span className="text-2xl">{p.icon}</span>
                  <span className="flex-1 font-medium">{p.name}</span>
                  <span className={`flex h-6 w-6 items-center justify-center rounded-full border ${on ? "border-brand bg-brand text-brand-ink" : "border-line"}`}>
                    {on && <Check size={14} />}
                  </span>
                </button>
                {on && (
                  <div className="mt-2">
                    <MoneyInput
                      value={picked[p.name]}
                      onChange={(v) => setPicked((x) => ({ ...x, [p.name]: v }))}
                      placeholder={p.type === "credit_card" ? "Deuda actual" : "Saldo actual"}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <p className="mt-2 text-xs text-muted">Podrás renombrarlas (BCP, Interbank, BBVA…) y añadir más después.</p>
      </div>

      <button className="btn-primary mt-6 w-full py-4 text-base" disabled={!Object.keys(picked).length} onClick={start}>
        Empezar
      </button>
      <button
        className="btn-ghost mt-2 w-full"
        onClick={() => s.replaceAll(buildDemoData(), { displayName: name.trim(), onboarded: true })}
      >
        Explorar con datos de ejemplo
      </button>
    </div>
  );
}
