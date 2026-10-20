"use client";

import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { useStore } from "@/lib/store/store";
import { useUI } from "@/lib/store/ui";
import { Section, Segmented } from "@/components/ui/bits";
import { DEFAULT_USD_RATE, fetchUsdRate } from "@/lib/domain/fx";

/** Moneda principal y tipo de cambio usado para sumar cuentas en soles y dólares. */
export function CurrencySection() {
  const s = useStore();
  const toast = useUI((u) => u.toast);
  const rate = s.settings.usdRate ?? DEFAULT_USD_RATE;
  const [text, setText] = useState(String(rate));
  const [busy, setBusy] = useState(false);

  const commit = (v: string) => {
    const n = Number(v.replace(",", "."));
    if (n > 1 && n < 10) s.setSettings({ usdRate: n, usdRateUpdatedAt: new Date().toISOString() });
    else setText(String(rate));
  };

  return (
    <Section title="Monedas">
      <div className="card grid gap-4 p-4 text-sm">
        <div>
          <div className="label">Moneda principal (totales y reportes)</div>
          <Segmented
            value={s.settings.currency}
            onChange={(currency) => s.setSettings({ currency })}
            options={[
              { value: "PEN", label: "🇵🇪 Soles" },
              { value: "USD", label: "🇺🇸 Dólares" },
            ]}
          />
        </div>
        <div>
          <label className="label" htmlFor="fx">Tipo de cambio · soles por US$ 1</label>
          <div className="flex gap-2">
            <input
              id="fx"
              className="input num"
              inputMode="decimal"
              value={text}
              onChange={(e) => setText(e.target.value)}
              onBlur={(e) => commit(e.target.value)}
            />
            <button
              className="btn-ghost shrink-0 px-4"
              disabled={busy}
              aria-label="Actualizar tipo de cambio"
              onClick={async () => {
                setBusy(true);
                const r = await fetchUsdRate();
                setBusy(false);
                if (!r) return toast({ title: "Sin conexión", body: "Escribe el tipo de cambio a mano.", tone: "warn" });
                setText(String(r));
                s.setSettings({ usdRate: r, usdRateUpdatedAt: new Date().toISOString() });
                toast({ title: `Tipo de cambio: S/ ${r}`, tone: "success" }, 2500);
              }}
            >
              <RefreshCw size={16} className={busy ? "animate-spin" : ""} /> Actualizar
            </button>
          </div>
          <p className="mt-2 text-xs leading-relaxed text-muted">
            Cada cuenta guarda su dinero en su propia moneda. Este valor solo se usa para sumar todo en tu disponible, patrimonio y reportes.
            {s.settings.usdRateUpdatedAt && ` Actualizado: ${new Date(s.settings.usdRateUpdatedAt).toLocaleDateString("es-PE")}.`}
          </p>
        </div>
      </div>
    </Section>
  );
}
