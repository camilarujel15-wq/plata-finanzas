"use client";

import { useState } from "react";
import { Cloud, Download, Upload } from "lucide-react";
import { COLLECTIONS, useStore, type FinanceData } from "@/lib/store/store";
import { useUI } from "@/lib/store/ui";
import { PageHeader, Section, Segmented } from "@/components/ui/bits";
import { buildDemoData } from "@/lib/store/demo";
import { seedCategories } from "@/lib/domain/defaults";
import { isCloudEnabled } from "@/lib/sync/supabase";
import { signOut, useCloudUser } from "@/lib/sync/auth";
import { CloudLogin } from "@/components/cloud/CloudLogin";
import { useCategoriesByFrequency } from "@/lib/store/selectors";
import { isNative } from "@/lib/native/platform";
import { requestPinWidget } from "@/lib/native/widget";
import { syncNow } from "@/lib/sync/engine";

function download(name: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = Object.assign(document.createElement("a"), { href: url, download: name });
  a.click();
  URL.revokeObjectURL(url);
}

const csvCell = (v: unknown) => {
  const s = String(v ?? "");
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export default function Ajustes() {
  const s = useStore();
  const toast = useUI((u) => u.toast);

  const exportJson = () => {
    const data = Object.fromEntries(COLLECTIONS.map((c) => [c, s[c]]));
    download(`plata-respaldo-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify({ version: 1, settings: s.settings, data }, null, 2), "application/json");
  };

  const exportCsv = () => {
    const cat = new Map(s.categories.map((c) => [c.id, c.name]));
    const acc = new Map(s.accounts.map((a) => [a.id, a.name]));
    const head = ["Fecha", "Tipo", "Monto", "Categoría", "Cuenta", "Cuenta destino", "Descripción", "Etiquetas"];
    const lines = s.transactions
      .filter((t) => !t.deletedAt)
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((t) =>
        [t.date, { expense: "Gasto", income: "Ingreso", transfer: "Transferencia" }[t.type], (t.amount / 100).toFixed(2), cat.get(t.categoryId ?? "") ?? "", acc.get(t.accountId) ?? "", acc.get(t.toAccountId ?? "") ?? "", t.merchant ?? t.note ?? "", t.tags.join(" ")]
          .map(csvCell)
          .join(","),
      );
    // BOM para que Excel abra bien las tildes.
    download(`plata-movimientos.csv`, "﻿" + [head.join(","), ...lines].join("\n"), "text/csv;charset=utf-8");
  };

  const importJson = async (file: File) => {
    try {
      const parsed = JSON.parse(await file.text()) as { version: number; settings?: object; data: FinanceData };
      if (!parsed.data || !COLLECTIONS.every((c) => Array.isArray(parsed.data[c]))) throw new Error();
      if (!confirm("Esto reemplazará los datos de este dispositivo. ¿Continuar?")) return;
      s.replaceAll(parsed.data, parsed.settings);
      toast({ title: "Respaldo restaurado", tone: "success" });
    } catch {
      toast({ title: "Archivo de respaldo inválido", tone: "warn" });
    }
  };

  return (
    <div>
      <PageHeader title="Ajustes" back="/mas" />

      <Section title="Perfil" className="mt-0">
        <div className="card grid gap-4 p-4">
          <div>
            <label className="label" htmlFor="nm">Nombre</label>
            <input id="nm" className="input" value={s.settings.displayName} onChange={(e) => s.setSettings({ displayName: e.target.value })} />
          </div>
          <div>
            <div className="label">Moneda principal</div>
            <Segmented value={s.settings.currency} onChange={(currency) => s.setSettings({ currency })} options={[{ value: "PEN", label: "Soles (S/)" }, { value: "USD", label: "Dólares ($)" }]} />
          </div>
          <div className="flex items-center justify-between gap-3 text-sm">
            <span>
              Ocultar montos
              <span className="block text-xs text-muted">Para revisar la app en público</span>
            </span>
            <button
              role="switch"
              aria-checked={!!s.settings.hideAmounts}
              onClick={() => s.setSettings({ hideAmounts: !s.settings.hideAmounts })}
              className={`relative h-7 w-12 shrink-0 rounded-full transition ${s.settings.hideAmounts ? "bg-brand" : "bg-line"}`}
            >
              <span className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all ${s.settings.hideAmounts ? "left-[22px]" : "left-0.5"}`} />
            </button>
          </div>
        </div>
      </Section>

      <CloudSection />
      <WidgetSection />

      <Section title="Tus datos">
        <div className="card grid gap-2 p-4">
          <button className="btn-ghost justify-start" onClick={exportCsv}>
            <Download size={16} /> Exportar movimientos (CSV para Excel/Notion)
          </button>
          <button className="btn-ghost justify-start" onClick={exportJson}>
            <Download size={16} /> Descargar respaldo completo (JSON)
          </button>
          <label className="btn-ghost cursor-pointer justify-start">
            <Upload size={16} /> Restaurar respaldo
            <input type="file" accept="application/json,.json" className="hidden" onChange={(e) => e.target.files?.[0] && importJson(e.target.files[0])} />
          </label>
        </div>
      </Section>

      <Section title="Zona de pruebas">
        <div className="card grid gap-2 p-4">
          <button
            className="btn-ghost"
            onClick={() => confirm("¿Reemplazar todo con datos de ejemplo?") && s.replaceAll(buildDemoData(), { onboarded: true })}
          >
            Cargar datos de ejemplo
          </button>
          <button
            className="btn-danger"
            onClick={() => {
              if (!confirm("Se borrarán todos los datos de este dispositivo. Descarga un respaldo antes si lo necesitas. ¿Continuar?")) return;
              s.replaceAll({ accounts: [], categories: seedCategories(), transactions: [], budgets: [], goals: [], contributions: [], rules: [], alerts: [] }, { onboarded: false, defaultAccountId: null, lastAccountId: null });
              toast({ title: "Datos borrados" });
            }}
          >
            Borrar todos los datos locales
          </button>
        </div>
      </Section>
      <p className="mt-8 text-center text-xs text-muted">Plata 1.0 · Tus datos son tuyos</p>
    </div>
  );
}

function CloudSection() {
  const toast = useUI((u) => u.toast);
  const pending = useStore((s) => s.outbox.length);
  const lastPulledAt = useStore((s) => s.lastPulledAt);
  const { user } = useCloudUser();
  const [busy, setBusy] = useState(false);

  if (!isCloudEnabled()) {
    return (
      <Section title="Respaldo en la nube">
        <div className="card p-4 text-sm leading-relaxed text-muted">
          <Cloud size={20} className="mb-2 text-brand-strong" />
          Esta versión aún no tiene la nube configurada: tus datos viven solo en este celular. Descarga un respaldo abajo mientras tanto.
        </div>
      </Section>
    );
  }

  return (
    <Section title="Respaldo en la nube">
      <div className="card grid gap-4 p-4 text-sm">
        {user ? (
          <>
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-pos/12 text-pos">
                <Cloud size={20} />
              </span>
              <div className="min-w-0">
                <div className="truncate font-semibold">{user.email}</div>
                <div className="text-xs text-muted">
                  {pending ? `${pending} cambios por subir` : "Todo respaldado ✓"}
                  {lastPulledAt && ` · ${new Date(lastPulledAt).toLocaleString("es-PE", { dateStyle: "short", timeStyle: "short" })}`}
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                className="btn-primary flex-1"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  try {
                    await syncNow();
                    toast({ title: "Sincronizado", tone: "success" }, 2000);
                  } catch (e) {
                    toast({ title: "Error al sincronizar", body: e instanceof Error ? e.message : "", tone: "warn" });
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                Sincronizar ahora
              </button>
              <button className="btn-ghost" onClick={() => signOut()}>Salir</button>
            </div>
          </>
        ) : (
          <>
            <p className="leading-relaxed text-muted">Crea tu cuenta para que tus datos se respalden solos y puedas recuperarlos si cambias o pierdes el celular.</p>
            <CloudLogin />
          </>
        )}
      </div>
    </Section>
  );
}

function WidgetSection() {
  const s = useStore();
  const toast = useUI((u) => u.toast);
  const cats = useCategoriesByFrequency("expense");
  const favs = s.settings.widgetFavorites ?? [];
  const toggle = (id: string) => {
    const next = favs.includes(id) ? favs.filter((x) => x !== id) : [...favs, id].slice(-4);
    s.setSettings({ widgetFavorites: next });
  };

  return (
    <Section title="Widget de pantalla de inicio">
      <div className="card grid gap-4 p-4 text-sm">
        <div className="hero p-4">
          <div className="text-[11px] font-semibold text-emerald-200">Disponible real</div>
          <div className="text-xl font-extrabold">S/ ••••</div>
          <div className="mt-3 grid grid-cols-5 gap-1.5">
            {[...(favs.length ? favs.map((id) => cats.find((c) => c.id === id)).filter(Boolean) : cats.slice(0, 4)), { id: "voice", icon: "🎙️", name: "Dictar" }].slice(0, 5).map((c) => (
              <div key={c!.id} className="flex flex-col items-center rounded-xl bg-white/10 py-1.5 text-[9px] text-white/80">
                <span className="text-lg">{c!.icon}</span>
                <span className="w-full truncate px-1 text-center">{c!.name}</span>
              </div>
            ))}
          </div>
        </div>
        <p className="leading-relaxed text-muted">
          Toca una categoría en el widget, escribe el monto y listo: se guarda sin abrir la app. Elige hasta 4 (si no eliges, se usan las que más usas):
        </p>
        <div className="flex flex-wrap gap-2">
          {cats.map((c) => (
            <button key={c.id} className={`chip ${favs.includes(c.id) ? "chip-on" : ""}`} onClick={() => toggle(c.id)}>
              {c.icon} {c.name}
            </button>
          ))}
        </div>
        {isNative() ? (
          <button
            className="btn-dark"
            onClick={async () => {
              const r = await requestPinWidget();
              if (!r.supported) toast({ title: "Agrégalo manualmente", body: "Mantén presionada la pantalla de inicio → Widgets → Plata.", tone: "warn" }, 7000);
            }}
          >
            📲 Agregar widget a mi pantalla
          </button>
        ) : (
          <p className="rounded-2xl bg-surface-2 px-4 py-3 text-xs text-muted">El widget está disponible en la app de Android.</p>
        )}
      </div>
    </Section>
  );
}
