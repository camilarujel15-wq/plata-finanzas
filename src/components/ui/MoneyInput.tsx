"use client";

import { useEffect, useState } from "react";
import { centsToInput, parseAmount } from "@/lib/domain/money";

/** Input de monto con teclado decimal nativo; emite céntimos. */
export function MoneyInput({
  value,
  onChange,
  placeholder = "0.00",
  autoFocus,
  allowNegative,
  id,
  currency = "PEN",
}: {
  value: number | null;
  onChange: (cents: number | null) => void;
  placeholder?: string;
  autoFocus?: boolean;
  allowNegative?: boolean;
  id?: string;
  currency?: string;
}) {
  const [text, setText] = useState(value ? centsToInput(value) : "");
  useEffect(() => {
    if ((parseAmount(text) ?? null) !== value) setText(value ? centsToInput(value) : "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-muted">{currency === "USD" ? "US$" : "S/"}</span>
      <input
        id={id}
        className={`input num ${currency === "USD" ? "pl-14" : "pl-11"}`}
        inputMode="decimal"
        autoFocus={autoFocus}
        placeholder={placeholder}
        value={text}
        onChange={(e) => {
          const raw = allowNegative ? e.target.value : e.target.value.replace("-", "");
          setText(raw);
          const cents = parseAmount(raw);
          onChange(cents === null ? null : raw.trim().startsWith("-") ? -Math.abs(cents) : cents);
        }}
      />
    </div>
  );
}
