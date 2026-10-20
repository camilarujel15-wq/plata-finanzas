"use client";

import { Delete, Fingerprint } from "lucide-react";
import { haptic } from "@/lib/native/platform";

/** Teclado de PIN reutilizado por la pantalla de bloqueo y la configuración. */
export function PinPad({
  value,
  onChange,
  length = 4,
  dark,
  onBiometric,
  error,
}: {
  value: string;
  onChange: (v: string) => void;
  length?: number;
  dark?: boolean;
  onBiometric?: () => void;
  error?: boolean;
}) {
  const press = (k: string) => {
    haptic();
    if (k === "del") onChange(value.slice(0, -1));
    else if (value.length < length) onChange(value + k);
  };
  const keyCls = dark ? "bg-white/[0.07] text-white active:bg-white/15" : "bg-surface-2 text-ink active:bg-line";

  return (
    <div className="flex flex-col items-center">
      <div className={`mb-8 flex gap-4 ${error ? "animate-shake" : ""}`}>
        {Array.from({ length }, (_, i) => (
          <span
            key={i}
            className={`h-3.5 w-3.5 rounded-full transition ${i < value.length ? (error ? "bg-rose-400" : "bg-emerald-400 scale-110") : dark ? "bg-white/20" : "bg-line"}`}
          />
        ))}
      </div>
      <div className="grid w-full max-w-[300px] grid-cols-3 gap-3">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((k) => (
          <button key={k} onClick={() => press(k)} className={`num flex aspect-[1.25] items-center justify-center rounded-[22px] text-[26px] font-semibold transition active:scale-95 ${keyCls}`}>
            {k}
          </button>
        ))}
        {onBiometric ? (
          <button aria-label="Usar huella o rostro" onClick={onBiometric} className={`flex aspect-[1.25] items-center justify-center rounded-[22px] transition active:scale-95 ${dark ? "text-emerald-300" : "text-brand-strong"}`}>
            <Fingerprint size={30} />
          </button>
        ) : (
          <span />
        )}
        <button onClick={() => press("0")} className={`num flex aspect-[1.25] items-center justify-center rounded-[22px] text-[26px] font-semibold transition active:scale-95 ${keyCls}`}>
          0
        </button>
        <button aria-label="Borrar" onClick={() => press("del")} className={`flex aspect-[1.25] items-center justify-center rounded-[22px] transition active:scale-95 ${dark ? "text-white/70" : "text-muted"}`}>
          <Delete size={26} />
        </button>
      </div>
    </div>
  );
}
