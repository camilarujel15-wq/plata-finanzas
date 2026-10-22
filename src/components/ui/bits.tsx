"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { ChevronLeft } from "lucide-react";
import { AppIcon, ICON_CHOICES } from "./AppIcon";

export function PageHeader({ title, back, action, subtitle }: { title: string; back?: string; action?: ReactNode; subtitle?: ReactNode }) {
  return (
    <header className="pt-safe sticky top-0 z-20 -mx-5 mb-4 border-b border-line/0 bg-bg px-5">
      <div className="flex min-h-14 items-center gap-2 pt-1">
        {back && (
          <Link href={back} aria-label="Volver" className="tap -ml-2 flex h-10 w-10 items-center justify-center rounded-full text-ink">
            <ChevronLeft size={22} strokeWidth={2} />
          </Link>
        )}
        <div className="min-w-0 flex-1">
          {subtitle && <div className="text-xs text-muted">{subtitle}</div>}
          <h1 className="truncate text-[22px] font-semibold leading-tight tracking-tight">{title}</h1>
        </div>
        {action}
      </div>
    </header>
  );
}

export function Progress({ value, color, className = "" }: { value: number; color?: string; className?: string }) {
  const pct = Math.max(0, Math.min(1, value)) * 100;
  const auto = value >= 1 ? "rgb(var(--neg))" : value >= 0.8 ? "rgb(var(--warn))" : "rgb(var(--brand))";
  return (
    <div className={`h-1.5 overflow-hidden rounded-full bg-surface-2 ${className}`} role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
      <div className="h-full rounded-full transition-[width] duration-500 ease-out" style={{ width: `${pct}%`, background: color ?? auto }} />
    </div>
  );
}

export function Empty({ icon, title, body, action }: { icon: string; title: string; body?: string; action?: ReactNode }) {
  return (
    <div className="card flex flex-col items-center px-6 py-10 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-brand-soft text-brand">
        <AppIcon icon={icon} size={26} />
      </div>
      <div className="text-base font-semibold">{title}</div>
      {body && <p className="mt-1.5 max-w-xs text-sm leading-relaxed text-muted">{body}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  className = "",
}: {
  value: T;
  options: { value: T; label: ReactNode }[];
  onChange: (v: T) => void;
  className?: string;
}) {
  return (
    <div className={`flex rounded-xl bg-surface-2 p-1 ${className}`} role="tablist">
      {options.map((o) => (
        <button
          key={o.value}
          role="tab"
          aria-selected={o.value === value}
          onClick={() => onChange(o.value)}
          className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${o.value === value ? "bg-surface text-ink shadow-card ring-1 ring-line" : "text-muted"}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Section({ title, action, children, className = "" }: { title: string; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`mt-7 ${className}`}>
      <div className="mb-3 flex items-end justify-between px-1">
        <h2 className="text-[15px] font-semibold">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

/** Ícono de línea dentro de un círculo tenue con el color de la categoría o cuenta. */
export function IconBubble({ icon, color, size = 40 }: { icon: string; color: string; size?: number }) {
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-full"
      // Se atenúa cualquier color (incluidos los vivos de versiones anteriores) para mantener una estética sobria.
      style={{ width: size, height: size, background: `color-mix(in srgb, ${color} 10%, white)`, color: `color-mix(in srgb, ${color} 72%, #1f2937)` }}
      aria-hidden
    >
      <AppIcon icon={icon} size={Math.round(size * 0.46)} />
    </span>
  );
}

export function SwatchPicker({ value, options, onChange }: { value: string; options: string[]; onChange: (v: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2.5">
      {options.map((c) => (
        <button
          key={c}
          type="button"
          aria-label={`Color ${c}`}
          onClick={() => onChange(c)}
          className={`tap h-8 w-8 rounded-full ring-offset-2 ring-offset-surface transition ${value === c ? "ring-2 ring-ink" : ""}`}
          style={{ background: c }}
        />
      ))}
    </div>
  );
}

/** Selector de ícono (íconos de línea). Se mantiene el nombre por compatibilidad. */
export function EmojiPicker({ value, onChange }: { value: string; options?: string[]; onChange: (v: string) => void }) {
  return (
    <div className="grid grid-cols-8 gap-1.5">
      {ICON_CHOICES.map((k) => (
        <button
          key={k}
          type="button"
          aria-label={k.slice(2)}
          onClick={() => onChange(k)}
          className={`tap flex aspect-square items-center justify-center rounded-xl border ${value === k ? "border-brand bg-brand-soft text-brand" : "border-line bg-surface text-ink/80"}`}
        >
          <AppIcon icon={k} size={18} />
        </button>
      ))}
    </div>
  );
}
