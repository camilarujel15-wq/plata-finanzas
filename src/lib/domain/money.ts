const formatters = new Map<string, Intl.NumberFormat>();

function fmt(currency: string, locale: string, compact: boolean) {
  const key = `${currency}|${locale}|${compact}`;
  let f = formatters.get(key);
  if (!f) {
    f = new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      notation: compact ? "compact" : "standard",
      minimumFractionDigits: compact ? 0 : 2,
      maximumFractionDigits: compact ? 1 : 2,
    });
    formatters.set(key, f);
  }
  return f;
}

/** Formatea céntimos → "S/ 1,234.50". */
export function formatMoney(
  cents: number,
  opts: { currency?: string; locale?: string; compact?: boolean; sign?: boolean } = {},
): string {
  const { currency = "PEN", locale = "es-PE", compact = false, sign = false } = opts;
  const s = fmt(currency, locale, compact).format(Math.abs(cents) / 100).replace("USD", "US$");
  if (cents < 0) return `−${s}`;
  if (sign && cents > 0) return `+${s}`;
  return s;
}

/** Convierte texto del usuario ("1,234.5", "18", "18,50") a céntimos. */
export function parseAmount(input: string): number | null {
  let s = input.trim().replace(/[^\d.,-]/g, "");
  if (!s) return null;
  const lastComma = s.lastIndexOf(",");
  const lastDot = s.lastIndexOf(".");
  if (lastComma > -1 && lastDot > -1) {
    // El último separador es el decimal.
    if (lastComma > lastDot) s = s.replace(/\./g, "").replace(",", ".");
    else s = s.replace(/,/g, "");
  } else if (lastComma > -1) {
    // "18,50" → decimal; "1,234" → miles.
    const decimals = s.length - lastComma - 1;
    s = decimals === 3 ? s.replace(/,/g, "") : s.replace(/,/g, ".");
  }
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 100);
}

export function centsToInput(cents: number): string {
  return (cents / 100).toFixed(2).replace(/\.00$/, "");
}
