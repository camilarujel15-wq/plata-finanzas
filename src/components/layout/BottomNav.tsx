"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRef } from "react";
import { BarChart3, Home, LayoutGrid, ListOrdered, Plus } from "lucide-react";
import { useUI } from "@/lib/store/ui";

const items = [
  { href: "/", label: "Inicio", icon: Home },
  { href: "/movimientos", label: "Movimientos", icon: ListOrdered },
  null,
  { href: "/reportes", label: "Reportes", icon: BarChart3 },
  { href: "/mas", label: "Más", icon: LayoutGrid },
];

export function BottomNav() {
  const path = usePathname();
  const open = useUI((s) => s.openQuickAdd);
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressed = useRef(false);

  return (
    <nav className="pb-safe fixed inset-x-0 bottom-0 z-40 border-t border-line/70 bg-surface/90 backdrop-blur-lg">
      <div className="mx-auto grid max-w-lg grid-cols-5 items-end px-2 pt-1.5">
        {items.map((it) =>
          it ? (
            <Link
              key={it.href}
              href={it.href}
              className={`tap flex flex-col items-center gap-0.5 py-1 text-[11px] ${path === it.href ? "font-semibold text-brand" : "text-muted"}`}
            >
              <it.icon size={22} strokeWidth={path === it.href ? 2.4 : 1.8} />
              {it.label}
            </Link>
          ) : (
            <div key="fab" className="flex justify-center">
              {/* Toque: nuevo gasto. Mantener presionado: dictar por voz. */}
              <button
                aria-label="Registrar movimiento (mantén presionado para dictar)"
                onPointerDown={() => {
                  longPressed.current = false;
                  pressTimer.current = setTimeout(() => {
                    longPressed.current = true;
                    navigator.vibrate?.(15);
                    open({ autoVoice: true });
                  }, 450);
                }}
                onPointerUp={() => pressTimer.current && clearTimeout(pressTimer.current)}
                onPointerLeave={() => pressTimer.current && clearTimeout(pressTimer.current)}
                onClick={() => !longPressed.current && open()}
                onContextMenu={(e) => e.preventDefault()}
                className="tap -mt-6 flex h-14 w-14 items-center justify-center rounded-full bg-brand text-brand-ink shadow-lg shadow-brand/30"
              >
                <Plus size={28} strokeWidth={2.6} />
              </button>
            </div>
          ),
        )}
      </div>
    </nav>
  );
}
