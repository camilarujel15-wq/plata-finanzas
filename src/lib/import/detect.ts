import type { Category, CategoryRule, ISODate, Transaction, TxType } from "../domain/types";
import { normalize } from "../domain/text";
import { suggestCategory } from "../domain/categorize";
import { toISODate } from "../domain/dates";

/** Mapeo de columnas detectado (índices). */
export interface ColumnMap {
  date: number | null;
  description: number | null;
  amount: number | null;
  debit: number | null;
  credit: number | null;
  category: number | null;
  type: number | null;
  account: number | null;
}

export const COLUMN_LABEL: Record<keyof ColumnMap, string> = {
  date: "Fecha",
  description: "Descripción",
  amount: "Monto (con signo)",
  debit: "Cargo / Egreso",
  credit: "Abono / Ingreso",
  category: "Categoría",
  type: "Tipo",
  account: "Cuenta",
};

const HEADER_HINTS: Record<keyof ColumnMap, string[]> = {
  date: ["fecha", "date", "f operacion", "fecha operacion", "fecha de operacion", "fecha proceso", "dia"],
  description: [
    "descripcion", "concepto", "detalle", "glosa", "comercio", "movimiento", "referencia", "name", "nombre",
    "descripcion operacion", "description", "establecimiento",
  ],
  amount: ["monto", "importe", "amount", "valor", "total", "monto pen", "importe s"],
  debit: ["cargo", "cargos", "debe", "retiro", "retiros", "egreso", "egresos", "debito", "salida"],
  credit: ["abono", "abonos", "haber", "deposito", "depositos", "ingreso", "ingresos", "credito", "entrada"],
  category: ["categoria", "category", "rubro", "tipo de gasto"],
  type: ["tipo", "type", "tipo movimiento", "clase"],
  account: ["cuenta", "account", "medio de pago", "metodo de pago", "banco"],
};

const MONTHS: Record<string, number> = {
  ene: 1, enero: 1, jan: 1, january: 1, feb: 2, febrero: 2, february: 2, mar: 3, marzo: 3, march: 3,
  abr: 4, abril: 4, apr: 4, april: 4, may: 5, mayo: 5, jun: 6, junio: 6, june: 6, jul: 7, julio: 7, july: 7,
  ago: 8, agosto: 8, aug: 8, august: 8, set: 9, sep: 9, sept: 9, setiembre: 9, septiembre: 9, september: 9,
  oct: 10, octubre: 10, october: 10, nov: 11, noviembre: 11, november: 11, dic: 12, diciembre: 12, dec: 12, december: 12,
};

/** Acepta dd/mm/yyyy, yyyy-mm-dd, "October 5, 2026" (Notion) y "5 de octubre de 2026". */
export function parseLooseDate(raw: string): ISODate | null {
  const s = raw.trim();
  if (!s) return null;
  let m = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (m) return mk(+m[1], +m[2], +m[3]);
  m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})/);
  if (m) return mk(m[3].length === 2 ? 2000 + +m[3] : +m[3], +m[2], +m[1]);
  const n = normalize(s);
  m = n.match(/^([a-z]+) (\d{1,2}) (\d{4})/); // october 5 2026
  if (m && MONTHS[m[1]]) return mk(+m[3], MONTHS[m[1]], +m[2]);
  m = n.match(/^(\d{1,2}) (?:de )?([a-z]+)(?: (?:de |del )?(\d{4}))?/); // 5 de octubre de 2026 / 05 oct
  if (m && MONTHS[m[2]]) return mk(m[3] ? +m[3] : new Date().getFullYear(), MONTHS[m[2]], +m[1]);
  return null;
}

function mk(y: number, mo: number, d: number): ISODate | null {
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  const date = new Date(y, mo - 1, d);
  return date.getMonth() === mo - 1 ? toISODate(date) : null;
}

/** "S/ -1,234.50", "(18.50)", "1.234,50", "-18" → céntimos con signo. */
export function parseSignedAmount(raw: string): number | null {
  let s = raw.trim();
  if (!s) return null;
  let neg = false;
  if (/^\(.*\)$/.test(s)) {
    neg = true;
    s = s.slice(1, -1);
  }
  if (s.includes("-")) neg = true;
  s = s.replace(/[^\d.,]/g, "");
  if (!s) return null;
  const lc = s.lastIndexOf(",");
  const ld = s.lastIndexOf(".");
  if (lc > ld) s = s.replace(/\./g, "").replace(",", ".");
  else s = s.replace(/,/g, "");
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  const cents = Math.round(n * 100);
  return neg ? -cents : cents;
}

function scoreHeader(cell: string, hints: string[]): number {
  const n = normalize(cell);
  if (!n) return 0;
  let best = 0;
  for (const h of hints) {
    if (n === h) best = Math.max(best, 3);
    else if (n.startsWith(h) || n.includes(` ${h}`) || n.includes(h)) best = Math.max(best, 1 + h.length / 20);
  }
  return best;
}

/** Encuentra la fila de encabezados (los extractos suelen traer líneas de título antes). */
export function findHeaderRow(rows: string[][]): number {
  let best = 0;
  let bestScore = -1;
  for (let i = 0; i < Math.min(rows.length, 15); i++) {
    const score = rows[i].reduce(
      (s, cell) => s + Math.max(...Object.values(HEADER_HINTS).map((h) => scoreHeader(cell, h))),
      0,
    );
    if (score > bestScore) {
      bestScore = score;
      best = i;
    }
  }
  return best;
}

export function detectColumns(header: string[], sample: string[][]): ColumnMap {
  const map: ColumnMap = {
    date: null, description: null, amount: null, debit: null, credit: null, category: null, type: null, account: null,
  };
  const taken = new Set<number>();
  const order: (keyof ColumnMap)[] = ["date", "category", "type", "account", "debit", "credit", "amount", "description"];
  for (const key of order) {
    let bestIdx: number | null = null;
    let bestScore = 0;
    header.forEach((h, i) => {
      if (taken.has(i)) return;
      const sc = scoreHeader(h, HEADER_HINTS[key]);
      if (sc > bestScore) {
        bestScore = sc;
        bestIdx = i;
      }
    });
    if (bestIdx !== null) {
      map[key] = bestIdx;
      taken.add(bestIdx);
    }
  }
  // Si hay "monto" no necesitamos debe/haber, y viceversa.
  if (map.amount !== null && map.debit !== null && map.credit === null) map.debit = null;

  // Respaldo por contenido.
  const cols = header.length;
  const valueRatio = (i: number, fn: (v: string) => unknown) =>
    sample.filter((r) => r[i] && fn(r[i]) !== null).length / Math.max(1, sample.filter((r) => r[i]).length);
  if (map.date === null) {
    for (let i = 0; i < cols; i++) if (!taken.has(i) && valueRatio(i, parseLooseDate) > 0.8) { map.date = i; taken.add(i); break; }
  }
  if (map.amount === null && map.debit === null && map.credit === null) {
    for (let i = 0; i < cols; i++) {
      if (taken.has(i)) continue;
      if (valueRatio(i, (v) => (/[a-z]{3,}/i.test(v) ? null : parseSignedAmount(v))) > 0.8) { map.amount = i; taken.add(i); break; }
    }
  }
  if (map.description === null) {
    let longest = -1;
    for (let i = 0; i < cols; i++) {
      if (taken.has(i)) continue;
      const avg = sample.reduce((s, r) => s + (r[i]?.length ?? 0), 0) / Math.max(1, sample.length);
      if (avg > longest) { longest = avg; map.description = i; }
    }
  }
  return map;
}

export interface ImportRow {
  index: number;
  include: boolean;
  date: ISODate;
  description: string;
  amount: number;
  type: TxType;
  categoryId: string | null;
  confidence: number;
  accountName?: string;
  duplicate: boolean;
  hash: string;
}

export function importHash(date: string, amount: number, type: string, description: string) {
  return `${date}|${amount}|${type}|${normalize(description).slice(0, 40)}`;
}

const INCOME_TYPE = ["ingreso", "income", "abono", "entrada", "deposito"];

export function buildRows(
  rows: string[][],
  map: ColumnMap,
  ctx: { categories: Category[]; rules: CategoryRule[]; existing: Transaction[]; forceType?: "expense" | "income" | null },
): { rows: ImportRow[]; skipped: number } {
  const known = new Set(ctx.existing.filter((t) => !t.deletedAt && t.importHash).map((t) => t.importHash!));
  const loose = new Set(ctx.existing.filter((t) => !t.deletedAt).map((t) => `${t.date}|${t.amount}|${t.type}`));
  const catByName = new Map(ctx.categories.filter((c) => !c.deletedAt).map((c) => [normalize(c.name), c]));
  const out: ImportRow[] = [];
  let skipped = 0;
  rows.forEach((r, index) => {
    const get = (i: number | null) => (i === null ? "" : (r[i] ?? "").trim());
    const date = parseLooseDate(get(map.date));
    let signed: number | null = null;
    if (map.amount !== null) signed = parseSignedAmount(get(map.amount));
    if ((signed === null || signed === 0) && (map.debit !== null || map.credit !== null)) {
      const d = parseSignedAmount(get(map.debit));
      const c = parseSignedAmount(get(map.credit));
      if (c) signed = Math.abs(c);
      else if (d) signed = -Math.abs(d);
    }
    if (!date || signed === null || signed === 0) {
      skipped++;
      return;
    }
    const typeCell = normalize(get(map.type));
    let type: TxType = signed < 0 ? "expense" : "income";
    if (typeCell) type = INCOME_TYPE.some((w) => typeCell.includes(w)) ? "income" : typeCell.includes("transfer") ? "transfer" : "expense";
    if (type === "transfer") type = signed < 0 ? "expense" : "income"; // las transferencias se revisan manualmente
    // Bases de Notion separadas (una de gastos y otra de ingresos) traen montos positivos sin columna "Tipo".
    if (ctx.forceType) type = ctx.forceType;
    const amount = Math.abs(signed);
    const description = get(map.description) || "(sin descripción)";

    let categoryId: string | null = null;
    let confidence = 0;
    const named = catByName.get(normalize(get(map.category)));
    if (named && named.kind === type) {
      categoryId = named.id;
      confidence = 1;
    } else {
      const s = suggestCategory(description, type, ctx.categories, ctx.rules);
      if (s) {
        categoryId = s.categoryId;
        confidence = s.confidence;
      }
    }
    const hash = importHash(date, amount, type, description);
    const duplicate = known.has(hash) || loose.has(`${date}|${amount}|${type}`);
    out.push({
      index,
      include: !duplicate,
      date,
      description,
      amount,
      type,
      categoryId,
      confidence,
      accountName: get(map.account) || undefined,
      duplicate,
      hash,
    });
  });
  return { rows: out, skipped };
}
