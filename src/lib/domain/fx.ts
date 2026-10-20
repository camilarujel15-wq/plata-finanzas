import type { Account, Transaction } from "./types";

/** Tasas de cambio: cuántas unidades de la moneda principal vale 1 unidad de cada moneda. */
export interface Fx {
  base: string;
  /** Soles por 1 dólar. */
  usdRate: number;
}

export const DEFAULT_USD_RATE = 3.75;

/** Convierte céntimos de `currency` a céntimos de la moneda principal. */
export function toBase(cents: number, currency: string, fx: Fx): number {
  if (currency === fx.base) return cents;
  if (fx.base === "PEN" && currency === "USD") return Math.round(cents * fx.usdRate);
  if (fx.base === "USD" && currency === "PEN") return Math.round(cents / fx.usdRate);
  return cents;
}

/** Conversión entre dos monedas cualesquiera (para sugerir el monto recibido en una transferencia). */
export function convert(cents: number, from: string, to: string, fx: Fx): number {
  if (from === to) return cents;
  const inPen = from === "USD" ? cents * fx.usdRate : cents;
  return Math.round(to === "USD" ? inPen / fx.usdRate : inPen);
}

/**
 * Copia de los movimientos con montos expresados en la moneda principal.
 * Los reportes, presupuestos e insights trabajan sobre esta vista para poder sumar soles y dólares.
 */
export function normalizeTransactions(txs: Transaction[], accounts: Account[], fx: Fx): Transaction[] {
  const cur = new Map(accounts.map((a) => [a.id, a.currency]));
  return txs.map((t) => {
    const c = cur.get(t.accountId) ?? fx.base;
    return c === fx.base ? t : { ...t, amount: toBase(t.amount, c, fx) };
  });
}

/** Tipo de cambio de referencia (fuente pública gratuita). Devuelve null si no hay conexión. */
export async function fetchUsdRate(): Promise<number | null> {
  try {
    const r = await fetch("https://open.er-api.com/v6/latest/USD");
    const j = (await r.json()) as { rates?: Record<string, number> };
    const pen = j.rates?.PEN;
    return pen && pen > 1 && pen < 10 ? Math.round(pen * 1000) / 1000 : null;
  } catch {
    return null;
  }
}
