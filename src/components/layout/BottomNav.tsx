"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRef } from "react";
import { BarChart3, Home, LayoutGrid, ListOrdered, Plus } from "lucide-react";
import { useUI } from "@/lib/store/ui";
import { haptic } from "@/lib/native/platform";

const items = [
  { href: "/", label: "Inicio", icon: Home },
  { href: "/movimientos/", label: "Movimientos", icon: ListOrdered },
  null,
  { href: "/reportes/", label: "Reportes", icon: BarChart3 },
  { href: "/mas/", label: "Más", icon: LayoutGrid },
];

/** Barra flotante con el botón de registro al centro (toque: gasto · mantener: dictar). */
export function BottomNav() {
  const path = usePathname();
  const open = useUI((s) => s.openQuickAdd);
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressed = useRef(false);
  const active = (href: string) => (href === "/" ? path === "/" : path.startsWith(href.replace(/\/$/, "")));

  return (
    <nav className="pb-safe pointer-events-none fixed inset-x-0 bottom-0 z-40 px-4">
      <div className="pointer-events-auto mx-auto grid max-w-md grid-cols-5 items-center rounded-[26px] bg-surface/90 px-1.5 py-1.5 shadow-float ring-1 ring-line/60 backdrop-blur-xl">
        {items.map((it) =>
          it ? (
            <Link
              key={it.href}
              href={it.href}
              onClick={() => haptic()}
              className={`tap flex flex-col items-center gap-0.5 rounded-2xl py-1.5 text-[10.5px] font-semibold transition ${active(it.href) ? "text-ink" : "text-muted"}`}
            >
              <span className={`flex h-8 w-12 items-center justify-center rounded-full transition ${active(it.href) ? "bg-brand/15 text-brand-strong" : ""}`}>
                <it.icon size={21} strokeWidth={active(it.href) ? 2.4 : 1.9} />
              </span>
              {it.label}
            </Link>
          ) : (
            <div key="fab" className="flex justify-center">
              <button
                aria-label="Registrar movimiento (mantén presionado para dictar)"
                onPointerDown={() => {
                  longPressed.current = false;
                  pressTimer.current = setTimeout(() => {
                    longPressed.current = true;
                    haptic("success");
                    open({ autoVoice: true });
                  }, 450);
                }}
                onPointerUp={() => pressTimer.current && clearTimeout(pressTimer.current)}
                onPointerLeave={() => pressTimer.current && clearTimeout(pressTimer.current)}
                onClick={() => {
                  if (longPressed.current) return;
                  haptic();
                  open();
                }}
                onContextMenu={(e) => e.preventDefault()}
                className="tap -mt-7 flex h-[60px] w-[60px] items-center justify-center rounded-[22px] bg-gradient-to-br from-emerald-300 via-emerald-400 to-emerald-600 text-brand-ink shadow-glow ring-4 ring-bg"
              >
                <Plus size={30} strokeWidth={2.6} />
              </button>
            </div>
          ),
        )}
      </div>
    </nav>
  );
}
