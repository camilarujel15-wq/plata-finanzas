"use client";

import { useEffect, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import { BottomNav } from "./BottomNav";
import { Toaster } from "./Toaster";
import { QuickAdd } from "@/components/quick-add/QuickAdd";
import { useStore } from "@/lib/store/store";
import { useUI } from "@/lib/store/ui";
import { syncNow } from "@/lib/sync/engine";
import { getSupabase } from "@/lib/sync/supabase";

export function AppShell({ children }: { children: ReactNode }) {
  const hydrated = useStore((s) => s.hydrated);
  const outbox = useStore((s) => s.outbox.length);
  const params = useSearchParams();
  const openQuickAdd = useUI((s) => s.openQuickAdd);

  // Service worker (PWA instalable + offline).
  useEffect(() => {
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);

  // Atajos del ícono de la app (manifest shortcuts) y Web Share Target: /?add=expense, /?voice=1, /?text=...
  useEffect(() => {
    if (!hydrated) return;
    const add = params.get("add");
    const voice = params.get("voice");
    const text = params.get("text");
    if (add || voice || text) {
      openQuickAdd({ type: add === "income" ? "income" : "expense", autoVoice: voice === "1", text: text ?? undefined });
      window.history.replaceState(null, "", window.location.pathname);
    }
  }, [hydrated, params, openQuickAdd]);

  // Sincronización: al abrir, al volver a la app y al recuperar conexión.
  useEffect(() => {
    if (!hydrated || !getSupabase()) return;
    const run = () => navigator.onLine && syncNow().catch((e) => console.warn("sync", e));
    run();
    const onVis = () => document.visibilityState === "visible" && run();
    window.addEventListener("online", run);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.removeEventListener("online", run);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [hydrated]);

  // Sube cambios poco después de cada registro.
  useEffect(() => {
    if (!hydrated || !outbox || !getSupabase()) return;
    const t = setTimeout(() => navigator.onLine && syncNow().catch(() => {}), 1500);
    return () => clearTimeout(t);
  }, [hydrated, outbox]);

  if (!hydrated) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <div className="h-10 w-10 animate-pulse rounded-2xl bg-brand/30" />
      </div>
    );
  }

  return (
    <>
      <main className="mx-auto min-h-dvh max-w-lg px-4 pb-32">{children}</main>
      <BottomNav />
      <QuickAdd />
      <Toaster />
    </>
  );
}
