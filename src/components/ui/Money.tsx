"use client";

import { formatMoney } from "@/lib/domain/money";
import { useMoneyFormat } from "@/lib/store/selectors";

interface Props {
  value: number;
  className?: string;
  sign?: boolean;
  compact?: boolean;
  /** Colorea según el signo (verde/rojo). */
  tone?: boolean;
  hidden?: boolean;
  /** Moneda del monto (por defecto la principal). */
  currency?: string;
}

export function Money({ value, className = "", sign, compact, tone, hidden, currency }: Props) {
  const f = useMoneyFormat();
  const color = tone ? (value > 0 ? "text-pos" : value < 0 ? "text-neg" : "") : "";
  return (
    <span className={`num whitespace-nowrap ${color} ${className}`}>
      {hidden ? `${symbol(currency ?? f.currency)} •••••` : formatMoney(value, { ...f, currency: currency ?? f.currency, sign, compact })}
    </span>
  );
}

export const symbol = (c: string) => (c === "USD" ? "US$" : "S/");

export function useFormat() {
  const f = useMoneyFormat();
  return (v: number, o: { sign?: boolean; compact?: boolean; currency?: string } = {}) => formatMoney(v, { ...f, ...o, currency: o.currency ?? f.currency });
}
