"use client";

import { useUI } from "@/lib/store/ui";

export function Toaster() {
  const toasts = useUI((s) => s.toasts);
  const dismiss = useUI((s) => s.dismiss);
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-24 z-[60] mx-auto flex max-w-lg flex-col gap-2 px-4" aria-live="polite">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`pointer-events-auto flex animate-pop items-center gap-3 rounded-2xl px-4 py-3 shadow-xl ${t.tone === "warn" ? "bg-warn text-white" : "bg-ink text-bg"}`}
        >
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold">{t.title}</div>
            {t.body && <div className="truncate text-xs opacity-80">{t.body}</div>}
          </div>
          {t.action && (
            <button
              className="tap shrink-0 rounded-lg bg-white/15 px-3 py-1.5 text-xs font-semibold"
              onClick={() => {
                t.action!.run();
                dismiss(t.id);
              }}
            >
              {t.action.label}
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
