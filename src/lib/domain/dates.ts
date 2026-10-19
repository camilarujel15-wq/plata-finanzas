import type { ISODate, Period } from "./types";

const pad = (n: number) => String(n).padStart(2, "0");

export function toISODate(d: Date): ISODate {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function today(): ISODate {
  return toISODate(new Date());
}

export function parseISODate(s: ISODate): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(s: ISODate, n: number): ISODate {
  const d = parseISODate(s);
  d.setDate(d.getDate() + n);
  return toISODate(d);
}

export function periodOf(s: ISODate): Period {
  return s.slice(0, 7);
}

export function currentPeriod(): Period {
  return periodOf(today());
}

export function addMonths(p: Period, n: number): Period {
  const [y, m] = p.split("-").map(Number);
  const d = new Date(y, m - 1 + n, 1);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}

/** Lista de N periodos terminando en `end` (inclusive), del más antiguo al más reciente. */
export function lastPeriods(end: Period, n: number): Period[] {
  return Array.from({ length: n }, (_, i) => addMonths(end, i - n + 1));
}

export function daysInPeriod(p: Period): number {
  const [y, m] = p.split("-").map(Number);
  return new Date(y, m, 0).getDate();
}

export function endOfPeriod(p: Period): ISODate {
  return `${p}-${pad(daysInPeriod(p))}`;
}

export function periodLabel(p: Period, style: "long" | "short" = "long", locale = "es-PE"): string {
  const [y, m] = p.split("-").map(Number);
  const s = new Intl.DateTimeFormat(locale, {
    month: style === "long" ? "long" : "short",
    year: style === "long" ? "numeric" : undefined,
  }).format(new Date(y, m - 1, 1));
  return s.charAt(0).toUpperCase() + s.slice(1).replace(".", "");
}

export function dayLabel(s: ISODate, locale = "es-PE"): string {
  const t = today();
  if (s === t) return "Hoy";
  if (s === addDays(t, -1)) return "Ayer";
  const d = parseISODate(s);
  const sameYear = d.getFullYear() === new Date().getFullYear();
  const out = new Intl.DateTimeFormat(locale, {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: sameYear ? undefined : "numeric",
  }).format(d);
  return out.charAt(0).toUpperCase() + out.slice(1);
}

export function daysBetween(a: ISODate, b: ISODate): number {
  return Math.round((parseISODate(b).getTime() - parseISODate(a).getTime()) / 86_400_000);
}
