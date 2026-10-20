"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";

interface Props {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  tall?: boolean;
}

/** Hoja inferior: se cierra con Esc/atrás, tocando el fondo o arrastrando hacia abajo. */
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
      <button aria-label="Cerrar" className="absolute inset-0 animate-fade-in bg-[#0b1220]/50 backdrop-blur-[3px]" onClick={onClose} />
      <div
        ref={panel}
        className={`relative flex w-full max-w-lg animate-sheet-up flex-col rounded-t-[30px] bg-surface shadow-float transition-transform ${tall ? "max-h-[95dvh]" : "max-h-[90dvh]"}`}
      >
        <div
          className="flex shrink-0 cursor-grab touch-none items-center justify-between px-5 pb-1 pt-3"
          onPointerDown={(e) => (startY.current = e.clientY)}
          onPointerMove={(e) => {
            if (startY.current === null || !panel.current) return;
            panel.current.style.transform = `translateY(${Math.max(0, e.clientY - startY.current)}px)`;
          }}
          onPointerUp={(e) => {
            if (startY.current !== null && e.clientY - startY.current > 90) onClose();
            if (panel.current) panel.current.style.transform = "";
            startY.current = null;
          }}
        >
          <div className="absolute left-1/2 top-2 h-1.5 w-11 -translate-x-1/2 rounded-full bg-line" />
          <div className="mt-1.5 text-lg font-bold tracking-tight">{title}</div>
          <button aria-label="Cerrar" onClick={onClose} className="tap mt-1.5 flex h-9 w-9 items-center justify-center rounded-full bg-surface-2 text-muted">
            <X size={18} />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-3 pt-2">{children}</div>
        {footer && <div className="pb-safe shrink-0 px-5 pt-3">{footer}</div>}
      </div>
    </div>
  );
}
