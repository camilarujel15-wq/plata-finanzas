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

/** Barra inferior fija con el botón de registro al centro (toque: gasto · mantener: dictar). */
export function BottomNav() {
  const path = usePathname();
  const open = useUI((s) => s.openQuickAdd);
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressed = useRef(false);
  const active = (href: string) => (href === "/" ? path === "/" : path.startsWith(href.replace(/\/$/, "")));

  return (
    <nav className="pb-safe fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface">
      <div className="mx-auto grid max-w-lg grid-cols-5 items-center px-2 pt-1.5">
        {items.map((it) =>
          it ? (
            <Link
              key={it.href}
              href={it.href}
              onClick={() => haptic()}
              className={`tap flex flex-col items-center gap-1 py-1 text-[11px] font-medium ${active(it.href) ? "text-brand" : "text-muted"}`}
            >
              <it.icon size={22} strokeWidth={active(it.href) ? 2.2 : 1.7} />
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
                className="-mt-5 flex h-14 w-14 items-center justify-center rounded-full bg-brand text-white shadow-float ring-4 ring-bg transition active:scale-95"
              >
                <Plus size={26} strokeWidth={2.2} />
              </button>
            </div>
          ),
        )}
      </div>
    </nav>
  );
}
