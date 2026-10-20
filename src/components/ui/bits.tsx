"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { ChevronLeft } from "lucide-react";

export function PageHeader({ title, back, action, subtitle }: { title: string; back?: string; action?: ReactNode; subtitle?: ReactNode }) {
  return (
    <header className="pt-safe sticky top-0 z-20 -mx-5 mb-4 bg-bg/80 px-5 backdrop-blur-xl">
      <div className="flex min-h-16 items-center gap-3 pt-2">
        {back && (
          <Link href={back} aria-label="Volver" className="tap -ml-1 flex h-10 w-10 items-center justify-center rounded-full bg-surface shadow-card">
            <ChevronLeft size={20} />
          </Link>
        )}
        <div className="min-w-0 flex-1">
          {subtitle && <div className="text-xs font-medium text-muted">{subtitle}</div>}
          <h1 className="truncate text-[26px] font-bold leading-tight tracking-tight">{title}</h1>
        </div>
        {action}
      </div>
    </header>
  );
}

export function Progress({ value, color, className = "" }: { value: number; color?: string; className?: string }) {
  const pct = Math.max(0, Math.min(1, value)) * 100;
  const auto =
    value >= 1
      ? "linear-gradient(90deg,#fb7185,#e5484d)"
      : value >= 0.8
        ? "linear-gradient(90deg,#fcd34d,#f59e0b)"
        : "linear-gradient(90deg,#6ee7b7,#10b981)";
  return (
    <div className={`h-2 overflow-hidden rounded-full bg-surface-2 ${className}`} role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
      <div className="h-full rounded-full transition-[width] duration-700 ease-out" style={{ width: `${pct}%`, background: color ?? auto }} />
    </div>
  );
}

export function Empty({ icon, title, body, action }: { icon: string; title: string; body?: string; action?: ReactNode }) {
  return (
    <div className="card flex flex-col items-center px-6 py-10 text-center">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-[22px] bg-surface-2 text-3xl">{icon}</div>
      <div className="text-[17px] font-semibold">{title}</div>
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
    <div className={`flex rounded-2xl bg-surface-2 p-1 ${className}`} role="tablist">
      {options.map((o) => (
        <button
          key={o.value}
          role="tab"
          aria-selected={o.value === value}
          onClick={() => onChange(o.value)}
          className={`flex-1 rounded-xl px-3 py-2 text-sm font-semibold transition-all duration-200 ${o.value === value ? "bg-surface text-ink shadow-card" : "text-muted"}`}
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
        <h2 className="text-[17px] font-bold tracking-tight">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

/** Emoji dentro de un "squircle" teñido con el color de la categoría o cuenta. */
export function IconBubble({ icon, color, size = 42 }: { icon: string; color: string; size?: number }) {
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center"
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.34,
        background: `linear-gradient(145deg, ${color}2e, ${color}14)`,
        boxShadow: `inset 0 0 0 1px ${color}22`,
        fontSize: size * 0.5,
      }}
      aria-hidden
    >
      {icon}
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
          className={`tap h-9 w-9 rounded-full ring-offset-2 ring-offset-surface transition ${value === c ? "scale-110 ring-2 ring-ink" : ""}`}
          style={{ background: c }}
        />
      ))}
    </div>
  );
}

export function EmojiPicker({ value, options, onChange }: { value: string; options: string[]; onChange: (v: string) => void }) {
  return (
    <div className="grid grid-cols-8 gap-1.5">
      {options.map((e) => (
        <button
          key={e}
          type="button"
          onClick={() => onChange(e)}
          className={`tap flex aspect-square items-center justify-center rounded-2xl text-xl transition ${value === e ? "bg-brand/15 ring-2 ring-brand" : "bg-surface-2"}`}
        >
          {e}
        </button>
      ))}
    </div>
  );
}
