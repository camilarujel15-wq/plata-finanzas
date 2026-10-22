"use client";

import { AlertTriangle, CheckCircle2, Info } from "lucide-react";
import { useUI } from "@/lib/store/ui";

export function Toaster() {
  const toasts = useUI((s) => s.toasts);
  const dismiss = useUI((s) => s.dismiss);
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-24 z-[60] mx-auto flex max-w-lg flex-col gap-2 px-4" aria-live="polite">
      {toasts.map((t) => {
        const Icon = t.tone === "warn" ? AlertTriangle : t.tone === "success" ? CheckCircle2 : Info;
        return (
          <div key={t.id} className="pointer-events-auto flex animate-pop items-center gap-3 rounded-xl bg-ink px-4 py-3 text-white shadow-float">
            <Icon size={18} className={t.tone === "warn" ? "text-amber-300" : "text-white/80"} />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium">{t.title}</div>
              {t.body && <div className="truncate text-xs text-white/60">{t.body}</div>}
            </div>
            {t.action && (
              <button
                className="tap shrink-0 px-1 text-sm font-semibold text-white"
                onClick={() => {
                  t.action!.run();
                  dismiss(t.id);
                }}
              >
                {t.action.label}
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
