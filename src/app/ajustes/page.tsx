"use client";

import { useEffect, useState } from "react";
import { Cloud, Download, Upload } from "lucide-react";
import type { User } from "@supabase/supabase-js";
import { COLLECTIONS, useStore, type FinanceData } from "@/lib/store/store";
import { useUI } from "@/lib/store/ui";
import { PageHeader, Section, Segmented } from "@/components/ui/bits";
import { buildDemoData } from "@/lib/store/demo";
import { seedCategories } from "@/lib/domain/defaults";
import { getSupabase, isCloudEnabled } from "@/lib/sync/supabase";
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
          <label className="flex items-center justify-between text-sm">
            <span>
              Ocultar montos
              <span className="block text-xs text-muted">Para revisar la app en público</span>
            </span>
            <input type="checkbox" className="h-5 w-5 accent-[rgb(var(--brand))]" checked={!!s.settings.hideAmounts} onChange={(e) => s.setSettings({ hideAmounts: e.target.checked })} />
          </label>
        </div>
      </Section>

      <CloudSection />

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
      <p className="mt-6 text-center text-xs text-muted">Plata v0.1 · Offline-first · Tus datos son tuyos</p>
    </div>
  );
}

function CloudSection() {
  const toast = useUI((u) => u.toast);
  const pending = useStore((s) => s.outbox.length);
  const lastPulledAt = useStore((s) => s.lastPulledAt);
  const [user, setUser] = useState<User | null>(null);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const sb = getSupabase();

  useEffect(() => {
    if (!sb) return;
    sb.auth.getUser().then(({ data }) => setUser(data.user));
    const { data } = sb.auth.onAuthStateChange((_e, session) => setUser(session?.user ?? null));
    return () => data.subscription.unsubscribe();
  }, [sb]);

  if (!isCloudEnabled() || !sb) {
    return (
      <Section title="Sincronización">
        <div className="card p-4 text-sm text-muted">
          <Cloud size={18} className="mb-1 text-brand" />
          Modo local: los datos se guardan solo en este dispositivo. Configura <code>NEXT_PUBLIC_SUPABASE_URL</code> y{" "}
          <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code> para sincronizar entre dispositivos.
        </div>
      </Section>
    );
  }

  return (
    <Section title="Sincronización">
      <div className="card grid gap-3 p-4 text-sm">
        {user ? (
          <>
            <div>
              Conectada como <b>{user.email}</b>
              <div className="text-xs text-muted">
                {pending ? `${pending} cambios pendientes` : "Todo sincronizado"}
                {lastPulledAt && ` · última vez ${new Date(lastPulledAt).toLocaleString("es-PE")}`}
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
              <button className="btn-ghost" onClick={() => sb.auth.signOut()}>Salir</button>
            </div>
          </>
        ) : (
          <form
            className="grid gap-2"
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              const { error } = await sb.auth.signInWithOtp({ email, options: { emailRedirectTo: `${window.location.origin}/ajustes` } });
              setBusy(false);
              toast(error ? { title: "No se pudo enviar el enlace", body: error.message, tone: "warn" } : { title: "Revisa tu correo", body: "Te enviamos un enlace para entrar.", tone: "success" });
            }}
          >
            <p className="text-muted">Entra con un enlace mágico para respaldar y sincronizar tus datos.</p>
            <input className="input" type="email" required placeholder="tu@correo.com" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
            <button className="btn-primary" disabled={busy}>Enviarme el enlace</button>
          </form>
        )}
      </div>
    </Section>
  );
}
