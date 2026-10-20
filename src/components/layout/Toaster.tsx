"use client";

import { AlertTriangle, CheckCircle2, Info } from "lucide-react";
import { useUI } from "@/lib/store/ui";

export function Toaster() {
  const toasts = useUI((s) => s.toasts);
  const dismiss = useUI((s) => s.dismiss);
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-28 z-[60] mx-auto flex max-w-lg flex-col gap-2 px-4" aria-live="polite">
      {toasts.map((t) => {
        const Icon = t.tone === "warn" ? AlertTriangle : t.tone === "success" ? CheckCircle2 : Info;
        return (
          <div key={t.id} className="pointer-events-auto flex animate-pop items-center gap-3 rounded-[20px] bg-[#0b1220]/95 px-4 py-3 text-white shadow-float ring-1 ring-white/10 backdrop-blur">
            <Icon size={20} className={t.tone === "warn" ? "text-amber-300" : "text-emerald-300"} />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold">{t.title}</div>
              {t.body && <div className="truncate text-xs text-white/65">{t.body}</div>}
            </div>
            {t.action && (
              <button
                className="tap shrink-0 rounded-xl bg-white/12 px-3 py-1.5 text-xs font-bold text-emerald-300"
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
