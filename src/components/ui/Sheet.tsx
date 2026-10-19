"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";

interface Props {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  /** Altura máxima del panel. */
  tall?: boolean;
}

/** Bottom sheet accesible: se cierra con Esc, tocando el fondo o arrastrando hacia abajo. */
export function Sheet({ open, onClose, title, children, footer, tall }: Props) {
  const panel = useRef<HTMLDivElement>(null);
  const startY = useRef<number | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" role="dialog" aria-modal="true">
      <button aria-label="Cerrar" className="absolute inset-0 animate-fade-in bg-black/40 backdrop-blur-[2px]" onClick={onClose} />
      <div
        ref={panel}
        className={`relative flex w-full max-w-lg animate-sheet-up flex-col rounded-t-3xl bg-surface shadow-2xl ${tall ? "max-h-[94dvh]" : "max-h-[88dvh]"}`}
      >
        <div
          className="flex shrink-0 cursor-grab touch-none items-center justify-between px-5 pb-2 pt-3"
          onPointerDown={(e) => (startY.current = e.clientY)}
          onPointerMove={(e) => {
            if (startY.current === null || !panel.current) return;
            const dy = Math.max(0, e.clientY - startY.current);
            panel.current.style.transform = `translateY(${dy}px)`;
          }}
          onPointerUp={(e) => {
            if (startY.current !== null && e.clientY - startY.current > 90) onClose();
            if (panel.current) panel.current.style.transform = "";
            startY.current = null;
          }}
        >
          <div className="absolute left-1/2 top-2 h-1 w-10 -translate-x-1/2 rounded-full bg-line" />
          <div className="mt-2 text-base font-semibold">{title}</div>
          <button aria-label="Cerrar" onClick={onClose} className="tap mt-2 rounded-full bg-surface-2 p-1.5 text-muted">
            <X size={18} />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-4">{children}</div>
        {footer && <div className="pb-safe shrink-0 border-t border-line/70 px-5 pt-3">{footer}</div>}
      </div>
    </div>
  );
}
