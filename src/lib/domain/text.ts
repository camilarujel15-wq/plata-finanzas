/** Minúsculas, sin tildes, sin signos; espacios colapsados. */
export function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9ñ&\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** ¿`phrase` aparece en `text` como palabra(s) completa(s)? Ambos normalizados. */
export function hasPhrase(text: string, phrase: string): boolean {
  if (!phrase) return false;
  return ` ${text} `.includes(` ${phrase} `);
}

export function removePhrase(text: string, phrase: string): string {
  return ` ${text} `.replace(` ${phrase} `, " ").replace(/\s+/g, " ").trim();
}

const BANK_NOISE = new Set([
  "compra", "compras", "pos", "pago", "pagos", "cargo", "consumo", "visa", "mastercard", "mc", "debito", "credito",
  "tarjeta", "tarj", "trx", "op", "operacion", "nro", "ref", "lima", "pe", "per", "peru", "sac", "saa", "eirl", "srl",
  "sa", "www", "com", "pen", "usd", "s", "cta", "deb", "aut", "web", "en", "de", "la", "el",
]);

/**
 * Clave de comercio a partir de una descripción bancaria ruidosa:
 * "COMPRA POS PLAZA VEA 0123 LIMA PE" → "plaza vea".
 */
export function merchantKey(description: string): string {
  const words = normalize(description)
    .split(" ")
    .filter((w) => w.length > 1 && !/^\d+$/.test(w) && !BANK_NOISE.has(w));
  return words.slice(0, 3).join(" ");
}

export function titleCase(s: string): string {
  return s.replace(/\b\p{L}/gu, (c) => c.toUpperCase());
}
