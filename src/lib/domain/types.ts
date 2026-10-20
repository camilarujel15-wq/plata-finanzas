/**
 * Modelo de dominio. Los montos SIEMPRE se guardan en unidades menores (céntimos)
 * como enteros para evitar errores de punto flotante.
 */

export type ID = string;
/** Fecha calendario local en formato YYYY-MM-DD. */
export type ISODate = string;
/** Periodo mensual YYYY-MM. */
export type Period = string;

export type AccountType = "checking" | "savings" | "credit_card" | "wallet" | "cash" | "investment" | "receivable";
/** Monedas soportadas. Cada cuenta tiene la suya; los totales se convierten a la moneda principal. */
export type Currency = "PEN" | "USD";
export type InvestmentKind = "property" | "education" | "funds" | "business" | "other";
export type TxType = "expense" | "income" | "transfer";
export type TransferKind = "internal" | "card_payment" | "savings" | "investment" | "loan" | "repayment";
export type CategoryKind = "expense" | "income";
export type TxSource = "manual" | "text" | "voice" | "import" | "ocr" | "widget";

/** Campos comunes para sincronización offline-first (last-write-wins). */
export interface Syncable {
  id: ID;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
}

export interface Account extends Syncable {
  name: string;
  type: AccountType;
  /** Para tarjetas de crédito, el saldo inicial es negativo (deuda). */
  initialBalance: number;
  currency: string;
  color: string;
  icon: string;
  creditLimit?: number | null;
  archived: boolean;
  sortOrder: number;
  /** Inversiones: tipo (terreno, educación…). */
  investmentKind?: InvestmentKind | null;
  /** Inversiones: costo total a pagar (p. ej. precio del terreno) para mostrar % pagado. */
  targetAmount?: number | null;
  /** Inversiones: valor actual estimado (si se omite, se usa lo aportado). */
  marketValue?: number | null;
  /** Por cobrar: fecha en que prometieron pagar. */
  dueDate?: ISODate | null;
  /** Nota libre (concepto de la deuda, número de lote, etc.). */
  note?: string | null;
}

export interface Category extends Syncable {
  /** Clave estable de las categorías predeterminadas (p. ej. "food"); permite deduplicar entre dispositivos. */
  key?: string | null;
  name: string;
  kind: CategoryKind;
  icon: string;
  color: string;
  isDefault: boolean;
  archived: boolean;
  sortOrder: number;
}

export interface Transaction extends Syncable {
  type: TxType;
  /** Siempre positivo; el signo lo da `type`. */
  amount: number;
  accountId: ID;
  /** Solo transferencias. */
  toAccountId?: ID | null;
  transferKind?: TransferKind | null;
  /** Transferencias entre monedas: monto recibido en la moneda de la cuenta destino. */
  toAmount?: number | null;
  /** Nulo en transferencias. */
  categoryId?: ID | null;
  date: ISODate;
  note?: string;
  merchant?: string;
  tags: string[];
  source: TxSource;
  importId?: ID | null;
  /** Huella para deduplicar importaciones. */
  importHash?: string | null;
}

export interface Budget extends Syncable {
  categoryId: ID;
  /** Monto mensual. */
  amount: number;
  thresholds: number[];
}

export interface Goal extends Syncable {
  name: string;
  targetAmount: number;
  targetDate?: ISODate | null;
  icon: string;
  color: string;
  accountId?: ID | null;
  archived: boolean;
}

export interface GoalContribution extends Syncable {
  goalId: ID;
  /** Negativo = retiro. */
  amount: number;
  date: ISODate;
  note?: string;
}

/** Regla aprendida: texto normalizado (comercio/palabra) → categoría. */
export interface CategoryRule extends Syncable {
  pattern: string;
  categoryId: ID;
  hits: number;
  origin: "user" | "system";
}

/** Registro de alertas ya emitidas para no repetirlas. */
export interface BudgetAlert extends Syncable {
  budgetId: ID;
  period: Period;
  threshold: number;
}

export interface Settings {
  currency: string;
  locale: string;
  displayName: string;
  defaultAccountId?: ID | null;
  lastAccountId?: ID | null;
  onboarded: boolean;
  /** Oculta montos en pantalla (modo privacidad en lugares públicos). */
  hideAmounts?: boolean;
  /** Soles por 1 dólar (p. ej. 3.75). */
  usdRate?: number;
  usdRateUpdatedAt?: string | null;
  /** Bloqueo de la app con PIN (hash) y biometría. */
  lock?: { pinHash: string; salt: string; pinLength: number; biometric: boolean; graceSeconds: number } | null;
  /** Categorías fijadas en el widget (si no, las 4 más usadas). */
  widgetFavorites?: string[];
}

export const ACCOUNT_TYPE_LABEL: Record<AccountType, string> = {
  checking: "Cuenta bancaria",
  savings: "Cuenta de ahorros",
  credit_card: "Tarjeta de crédito",
  wallet: "Wallet digital",
  cash: "Efectivo",
  investment: "Inversión",
  receivable: "Me deben",
};

export const INVESTMENT_KIND_LABEL: Record<InvestmentKind, { label: string; icon: string }> = {
  property: { label: "Terreno / inmueble", icon: "🏡" },
  education: { label: "Educación / cursos", icon: "🎓" },
  funds: { label: "Fondos / acciones", icon: "📈" },
  business: { label: "Negocio", icon: "🏪" },
  other: { label: "Otra", icon: "💎" },
};

export const CURRENCY_LABEL: Record<Currency, string> = { PEN: "Soles (S/)", USD: "Dólares (US$)" };

/** Cuentas de dinero disponible: aparecen en el registro rápido y el widget. */
export const isSpendable = (t: AccountType) => t !== "investment" && t !== "receivable";

export const TRANSFER_KIND_LABEL: Record<TransferKind, string> = {
  internal: "Movimiento interno",
  card_payment: "Pago de tarjeta",
  savings: "A ahorros",
  investment: "Aporte a inversión",
  loan: "Préstamo",
  repayment: "Cobro de deuda",
};
