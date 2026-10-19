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
}

export function Money({ value, className = "", sign, compact, tone, hidden }: Props) {
  const f = useMoneyFormat();
  const color = tone ? (value > 0 ? "text-pos" : value < 0 ? "text-neg" : "") : "";
  return (
    <span className={`num whitespace-nowrap ${color} ${className}`}>
      {hidden ? "S/ •••••" : formatMoney(value, { ...f, sign, compact })}
    </span>
  );
}

export function useFormat() {
  const f = useMoneyFormat();
  return (v: number, o: { sign?: boolean; compact?: boolean } = {}) => formatMoney(v, { ...f, ...o });
}
