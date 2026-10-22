"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import { BottomNav } from "./BottomNav";
import { Toaster } from "./Toaster";
import { QuickAdd } from "@/components/quick-add/QuickAdd";
import { useStore } from "@/lib/store/store";
import { useUI } from "@/lib/store/ui";
import { syncNow } from "@/lib/sync/engine";
import { getSupabase } from "@/lib/sync/supabase";
import { isNative, syncStatusBar } from "@/lib/native/platform";
import { startWidgetBridge } from "@/lib/native/widget";
import { listenDeepLinks } from "@/lib/native/deeplinks";
import { LockScreen } from "@/components/security/LockScreen";

export function AppShell({ children }: { children: ReactNode }) {
  const hydrated = useStore((s) => s.hydrated);
  const outbox = useStore((s) => s.outbox.length);
  const hasAccounts = useStore((s) => s.accounts.some((a) => !a.deletedAt));
  const params = useSearchParams();
  const openQuickAdd = useUI((s) => s.openQuickAdd);
  const toast = useUI((s) => s.toast);
  const lockCfg = useStore((s) => s.settings.lock);
  const [locked, setLocked] = useState<boolean | null>(null);
  const hiddenAt = useRef<number | null>(null);

  // Bloqueo: al abrir y al volver a la app tras el tiempo de gracia.
  useEffect(() => {
    if (!hydrated) return;
    setLocked((l) => (l === null ? !!useStore.getState().settings.lock : l));
  }, [hydrated]);
  useEffect(() => {
    const onVis = () => {
      const cfg = useStore.getState().settings.lock;
      if (document.visibilityState === "hidden") hiddenAt.current = Date.now();
      else if (cfg && hiddenAt.current && Date.now() - hiddenAt.current >= cfg.graceSeconds * 1000) setLocked(true);
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  // Web: service worker (PWA). En la app nativa los archivos ya vienen empaquetados.
  useEffect(() => {
    if (!isNative() && "serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
    syncStatusBar();
  }, []);

  // App nativa: widget (snapshot + cola de movimientos) y enlaces plata://
  useEffect(() => {
    if (!hydrated) return;
    const stopWidget = startWidgetBridge((n) =>
      toast({ title: `${n} ${n === 1 ? "movimiento" : "movimientos"} desde el widget`, body: "Ya están en tu historial.", tone: "success" }),
    );
    const stopLinks = listenDeepLinks((a) => openQuickAdd({ autoVoice: a === "voice" }));
    return () => {
      stopWidget();
      stopLinks();
    };
  }, [hydrated, toast, openQuickAdd]);

  // Atajos web (manifest) y Web Share Target: /?add=expense, /?voice=1, /?text=...
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

  // Respaldo en la nube: al abrir, al volver a la app y al recuperar conexión.
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

  useEffect(() => {
    if (!hydrated || !outbox || !getSupabase()) return;
    const t = setTimeout(() => navigator.onLine && syncNow().catch(() => {}), 1500);
    return () => clearTimeout(t);
  }, [hydrated, outbox]);

  if (!hydrated || locked === null) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-bg">
        <div className="h-10 w-10 animate-pulse rounded-full bg-brand/20" />
      </div>
    );
  }

  if (locked && lockCfg) return <LockScreen onUnlock={() => setLocked(false)} />;

  return (
    <>
      <main className="mx-auto min-h-dvh max-w-lg overflow-x-clip px-5 pb-32">{children}</main>
      {hasAccounts && <BottomNav />}
      <QuickAdd />
      <Toaster />
    </>
  );
}
