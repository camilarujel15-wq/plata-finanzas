"use client";

import { useState } from "react";
import { Check, CloudDownload, Sparkles } from "lucide-react";
import { ACCOUNT_PRESETS } from "@/lib/domain/defaults";
import { useStore } from "@/lib/store/store";
import { buildDemoData } from "@/lib/store/demo";
import { MoneyInput } from "@/components/ui/MoneyInput";
import { Sheet } from "@/components/ui/Sheet";
import { CloudLogin } from "@/components/cloud/CloudLogin";
import { isCloudEnabled } from "@/lib/sync/supabase";

/** Primer uso: bienvenida → cuentas con saldo actual. O restaurar desde la nube en un celular nuevo. */
export function Onboarding() {
  const s = useStore();
  const [step, setStep] = useState<"welcome" | "setup">("welcome");
  const [restore, setRestore] = useState(false);
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

  if (step === "welcome") {
    return (
      <div className="fixed inset-0 z-30 flex flex-col overflow-hidden bg-[#0b1220] text-white">
        <div className="pointer-events-none absolute -left-24 -top-24 h-80 w-80 rounded-full bg-emerald-400/25 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 -right-24 h-96 w-96 rounded-full bg-indigo-500/25 blur-3xl" />

        <div className="pt-safe relative flex flex-1 flex-col items-center justify-center px-8 text-center">
          {/* Collage de emojis flotantes */}
          <div className="relative mb-10 h-44 w-64">
            {[
              ["🍽️", "left-2 top-6 rotate-[-8deg]"],
              ["🚕", "right-4 top-0 rotate-[10deg]"],
              ["🐷", "left-20 top-[72px] scale-125"],
              ["💳", "right-0 bottom-4 rotate-[-6deg]"],
              ["🎯", "left-0 bottom-0 rotate-[6deg]"],
            ].map(([e, pos], i) => (
              <div
                key={e}
                className={`absolute flex h-16 w-16 animate-rise items-center justify-center rounded-[22px] bg-white/[0.08] text-3xl ring-1 ring-white/10 backdrop-blur ${pos}`}
                style={{ animationDelay: `${i * 70}ms` }}
              >
                {e}
              </div>
            ))}
          </div>
          <h1 className="text-[34px] font-extrabold leading-[1.1] tracking-tight">
            Tu dinero,
            <br />
            <span className="bg-gradient-to-r from-emerald-200 to-emerald-400 bg-clip-text text-transparent">claro en segundos.</span>
          </h1>
          <p className="mt-4 max-w-xs text-[15px] leading-relaxed text-white/65">
            Registra un gasto en 3 toques, por voz o desde el widget. Sin hojas de cálculo.
          </p>
        </div>

        <div className="pb-safe relative grid gap-2.5 px-6 pb-4">
          <button className="btn-primary py-4 text-base" onClick={() => setStep("setup")}>
            <Sparkles size={18} /> Empezar
          </button>
          {isCloudEnabled() && (
            <button className="btn bg-white/10 py-4 text-white ring-1 ring-white/15" onClick={() => setRestore(true)}>
              <CloudDownload size={18} /> Ya uso Plata: restaurar mis datos
            </button>
          )}
          <button className="py-2 text-sm font-medium text-white/55" onClick={() => s.replaceAll(buildDemoData(), { onboarded: true })}>
            Explorar con datos de ejemplo
          </button>
        </div>

        <Sheet open={restore} onClose={() => setRestore(false)} title="Restaurar mis datos">
          <CloudLogin initialMode="signin" onDone={() => s.setSettings({ onboarded: true })} />
        </Sheet>
      </div>
    );
  }

  return (
    <div className="pt-safe animate-rise pb-8">
      <div className="pt-8">
        <div className="text-sm font-semibold text-brand-strong">Paso 1 de 1</div>
        <h1 className="mt-1 text-[28px] font-extrabold leading-tight tracking-tight">Cuéntanos de ti</h1>
        <p className="mt-1 text-sm text-muted">Toma menos de un minuto.</p>
      </div>

      <div className="mt-6">
        <label className="label" htmlFor="name">¿Cómo te llamas?</label>
        <input id="name" className="input" placeholder="Tu nombre" value={name} onChange={(e) => setName(e.target.value)} />
      </div>

      <div className="mt-6">
        <div className="label">¿Qué cuentas usas? · saldo de hoy</div>
        <div className="grid gap-2.5">
          {ACCOUNT_PRESETS.map((p) => {
            const on = p.name in picked;
            return (
              <div key={p.name} className={`card p-3.5 transition ${on ? "ring-2 ring-brand" : ""}`}>
                <button className="flex w-full items-center gap-3 text-left" onClick={() => toggle(p.name)}>
                  <span className="flex h-11 w-11 items-center justify-center rounded-2xl text-2xl" style={{ background: `${p.color}1f` }}>
                    {p.icon}
                  </span>
                  <span className="flex-1 font-semibold">{p.name}</span>
                  <span className={`flex h-6 w-6 items-center justify-center rounded-full transition ${on ? "bg-brand text-brand-ink" : "ring-2 ring-line"}`}>
                    {on && <Check size={14} strokeWidth={3} />}
                  </span>
                </button>
                {on && (
                  <div className="mt-3 animate-rise">
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
        <p className="mt-3 text-xs text-muted">Luego podrás renombrarlas (BCP, Interbank, BBVA…) y añadir más.</p>
      </div>

      <button className="btn-primary mt-6 w-full py-4 text-base" disabled={!Object.keys(picked).length} onClick={start}>
        Listo, empezar
      </button>
      <button className="mt-2 w-full py-3 text-sm font-medium text-muted" onClick={() => setStep("welcome")}>
        Volver
      </button>
    </div>
  );
}
