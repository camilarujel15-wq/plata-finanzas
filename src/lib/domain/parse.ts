import type { Account, Category, CategoryRule, ISODate, TransferKind, TxType } from "./types";
import { addDays, parseISODate, toISODate, today } from "./dates";
import { hasPhrase, normalize, removePhrase, titleCase } from "./text";
import { suggestCategory } from "./categorize";

/**
 * Intérprete de lenguaje natural para captura por texto o voz.
 *   "Gasté 18 soles en almuerzo"      → gasto 18.00, Alimentación, hoy
 *   "Pagué 120 soles de internet"     → gasto 120.00, Servicios
 *   "ayer 25 taxi con yape"           → gasto 25.00, Transporte, ayer, cuenta Yape
 *   "me pagaron 2500 de sueldo"       → ingreso 2500.00, Sueldo
 *   "pasé 300 de bcp a ahorros"       → transferencia BCP → Ahorros
 *   "pagué la tarjeta 800 desde bcp"  → pago de tarjeta
 */
export interface ParsedEntry {
  type: TxType;
  amount: number | null;
  date: ISODate;
  accountId: string | null;
  toAccountId: string | null;
  transferKind: TransferKind | null;
  categoryId: string | null;
  description: string;
  /** Qué campos se detectaron en el texto (para resaltarlos en la UI). */
  detected: { amount: boolean; date: boolean; account: boolean; category: boolean; type: boolean };
}

interface Ctx {
  accounts: Pick<Account, "id" | "name" | "type" | "archived" | "deletedAt">[];
  categories: Category[];
  rules: CategoryRule[];
  now?: ISODate;
}

const INCOME_VERBS = [
  "me pagaron", "me depositaron", "me transfirieron", "me yapearon", "me plinearon", "recibi", "cobre", "gane",
  "ingreso", "ingresaron", "deposito de", "me llego", "me cayo",
];
const TRANSFER_VERBS = ["transferi", "pase", "movi", "traspase", "mande a", "transferencia", "retire"];
const EXPENSE_VERBS = ["gaste", "pague", "compre", "pago", "gasto", "compra", "consumi", "me cobraron", "invite"];
const CARD_PAYMENT = ["pague la tarjeta", "pago de tarjeta", "pague tarjeta", "pago tarjeta", "pague la visa", "pague mi tarjeta"];

const WEEKDAYS = ["domingo", "lunes", "martes", "miercoles", "jueves", "viernes", "sabado"];
const STOPWORDS = new Set([
  "en", "de", "del", "por", "el", "la", "los", "las", "un", "una", "con", "para", "al", "a", "y", "mi", "mis", "que",
  "hoy", "soles", "sol", "s", "lucas", "luca", "pen", "dolares", "desde", "hacia", "unos", "unas", "como", "me", "se",
]);

const TYPE_ALIASES: Record<string, Account["type"]> = {
  efectivo: "cash",
  cash: "cash",
  tarjeta: "credit_card",
  "tarjeta de credito": "credit_card",
  credito: "credit_card",
  visa: "credit_card",
  ahorros: "savings",
};

function parseAmountToken(text: string): { cents: number; raw: string } | null {
  // Número con decimales opcionales y multiplicador "mil" / "k".
  const m = text.match(/(?:s\/\s*)?(\d{1,3}(?:[.,]\d{3})+|\d+)(?:[.,](\d{1,2}))?\s*(mil|k)?\b/i);
  if (!m) return null;
  const intPart = Number(m[1].replace(/[.,]/g, ""));
  const dec = m[2] ? Number(m[2].padEnd(2, "0")) : 0;
  let cents = intPart * 100 + dec;
  if (m[3]) cents *= 1000;
  return cents > 0 ? { cents, raw: m[0] } : null;
}

function parseDate(t: string, now: ISODate): { date: ISODate; phrase: string } | null {
  if (hasPhrase(t, "anteayer") || hasPhrase(t, "antes de ayer")) {
    return { date: addDays(now, -2), phrase: hasPhrase(t, "anteayer") ? "anteayer" : "antes de ayer" };
  }
  if (hasPhrase(t, "ayer")) return { date: addDays(now, -1), phrase: "ayer" };
  if (hasPhrase(t, "hoy")) return { date: now, phrase: "hoy" };
  for (let i = 0; i < WEEKDAYS.length; i++) {
    const w = WEEKDAYS[i];
    const phrase = hasPhrase(t, `el ${w}`) ? `el ${w}` : hasPhrase(t, w) ? w : null;
    if (!phrase) continue;
    const d = parseISODate(now);
    let back = (d.getDay() - i + 7) % 7;
    if (back === 0) back = 7; // "el lunes" dicho un lunes = el lunes pasado
    return { date: addDays(now, -back), phrase };
  }
  // dd/mm o dd-mm (normalize convierte "/" en espacio → "15 10"); se busca en el original.
  return null;
}

function parseNumericDate(original: string, now: ISODate): { date: ISODate; raw: string } | null {
  const m = original.match(/\b(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?\b/);
  if (!m) return null;
  const day = Number(m[1]);
  const month = Number(m[2]);
  if (day < 1 || day > 31 || month < 1 || month > 12) return null;
  const cur = parseISODate(now);
  let year = m[3] ? Number(m[3].length === 2 ? `20${m[3]}` : m[3]) : cur.getFullYear();
  let d = new Date(year, month - 1, day);
  if (!m[3] && d > cur) d = new Date(--year, month - 1, day);
  return { date: toISODate(d), raw: m[0] };
}

function findAccounts(t: string, accounts: Ctx["accounts"]) {
  const usable = accounts.filter((a) => !a.deletedAt && !a.archived);
  const hits: { id: string; index: number; phrase: string }[] = [];
  for (const a of usable) {
    const n = normalize(a.name);
    const idx = ` ${t} `.indexOf(` ${n} `);
    if (n && idx >= 0) hits.push({ id: a.id, index: idx, phrase: n });
  }
  // Alias genéricos ("efectivo", "tarjeta") si no hay coincidencia por nombre.
  for (const [alias, type] of Object.entries(TYPE_ALIASES)) {
    const idx = ` ${t} `.indexOf(` ${alias} `);
    if (idx < 0 || hits.some((h) => h.phrase.includes(alias) || alias.includes(h.phrase))) continue;
    const a = usable.find((x) => x.type === type);
    if (a && !hits.some((h) => h.id === a.id)) hits.push({ id: a.id, index: idx, phrase: alias });
  }
  // Frases más largas primero para evitar dobles coincidencias, luego por posición.
  hits.sort((a, b) => b.phrase.length - a.phrase.length);
  const kept: typeof hits = [];
  for (const h of hits) {
    if (!kept.some((k) => h.index >= k.index && h.index < k.index + k.phrase.length + 1)) kept.push(h);
  }
  return kept.sort((a, b) => a.index - b.index);
}

export function parseEntry(input: string, ctx: Ctx): ParsedEntry {
  const now = ctx.now ?? today();
  const numericDate = parseNumericDate(input, now);
  const original = numericDate ? input.replace(numericDate.raw, " ") : input;
  let t = normalize(original.replace(/s\//gi, " soles "));

  const detected = { amount: false, date: !!numericDate, account: false, category: false, type: false };

  // Tipo
  let type: TxType = "expense";
  let transferKind: TransferKind | null = null;
  const cardPhrase = CARD_PAYMENT.find((p) => hasPhrase(t, p));
  if (cardPhrase) {
    type = "transfer";
    transferKind = "card_payment";
    t = removePhrase(t, cardPhrase);
    detected.type = true;
  } else {
    const inc = INCOME_VERBS.find((v) => hasPhrase(t, v));
    const trf = TRANSFER_VERBS.find((v) => hasPhrase(t, v));
    const exp = EXPENSE_VERBS.find((v) => hasPhrase(t, v));
    if (inc) {
      type = "income";
      t = removePhrase(t, inc);
      detected.type = true;
    } else if (trf) {
      type = "transfer";
      transferKind = "internal";
      t = removePhrase(t, trf);
      detected.type = true;
    } else if (exp) {
      t = removePhrase(t, exp);
      detected.type = true;
    }
  }

  // Monto
  let amount: number | null = null;
  const amt = parseAmountToken(original.replace(/s\//gi, " "));
  if (amt) {
    amount = amt.cents;
    detected.amount = true;
    const rawNorm = normalize(amt.raw);
    t = removePhrase(t, rawNorm);
  }

  // Fecha
  let date = numericDate?.date ?? now;
  const rel = parseDate(t, now);
  if (rel && !numericDate) {
    date = rel.date;
    detected.date = true;
    t = removePhrase(t, rel.phrase);
  }

  // Cuentas
  let accountId: string | null = null;
  let toAccountId: string | null = null;
  const accs = findAccounts(t, ctx.accounts);
  if (type === "transfer") {
    if (transferKind === "card_payment") {
      const card = accs.find((h) => ctx.accounts.find((a) => a.id === h.id)?.type === "credit_card");
      const from = accs.find((h) => h.id !== card?.id);
      toAccountId = card?.id ?? ctx.accounts.find((a) => a.type === "credit_card" && !a.archived && !a.deletedAt)?.id ?? null;
      accountId = from?.id ?? null;
    } else {
      accountId = accs[0]?.id ?? null;
      toAccountId = accs[1]?.id ?? null;
      const toCard = ctx.accounts.find((a) => a.id === toAccountId)?.type === "credit_card";
      const toSavings = ctx.accounts.find((a) => a.id === toAccountId)?.type === "savings";
      if (toCard) transferKind = "card_payment";
      else if (toSavings) transferKind = "savings";
    }
  } else if (accs[0]) {
    accountId = accs[0].id;
  }
  for (const h of accs) t = removePhrase(t, h.phrase);
  detected.account = !!accountId || !!toAccountId;

  const description = t
    .split(" ")
    .filter((w) => w && !STOPWORDS.has(w) && !/^\d+$/.test(w))
    .join(" ");

  let categoryId: string | null = null;
  if (type !== "transfer") {
    const s = suggestCategory(description || normalize(input), type, ctx.categories, ctx.rules);
    if (s) {
      categoryId = s.categoryId;
      detected.category = true;
    }
    // "sueldo" sin verbo de ingreso → es ingreso.
    if (!s && type === "expense") {
      const inc = suggestCategory(description, "income", ctx.categories, ctx.rules);
      if (inc && inc.reason === "keyword") {
        type = "income";
        categoryId = inc.categoryId;
        detected.category = true;
      }
    }
  }

  return {
    type,
    amount,
    date,
    accountId,
    toAccountId,
    transferKind,
    categoryId,
    description: description ? titleCase(description) : "",
    detected,
  };
}
