import type { AccountType, Category, CategoryKind } from "./types";
import { nowISO, uid } from "./ids";

export interface CategorySeed {
  key: string;
  name: string;
  kind: CategoryKind;
  icon: string;
  color: string;
}

export const DEFAULT_CATEGORIES: CategorySeed[] = [
  { key: "food", name: "Alimentación", kind: "expense", icon: "🍽️", color: "#f97316" },
  { key: "transport", name: "Transporte", kind: "expense", icon: "🚕", color: "#0ea5e9" },
  { key: "home", name: "Hogar", kind: "expense", icon: "🏠", color: "#8b5cf6" },
  { key: "health", name: "Salud", kind: "expense", icon: "💊", color: "#ef4444" },
  { key: "education", name: "Educación", kind: "expense", icon: "🎓", color: "#6366f1" },
  { key: "fun", name: "Entretenimiento", kind: "expense", icon: "🎬", color: "#ec4899" },
  { key: "utilities", name: "Servicios", kind: "expense", icon: "💡", color: "#eab308" },
  { key: "subscriptions", name: "Suscripciones", kind: "expense", icon: "🔁", color: "#14b8a6" },
  { key: "shopping", name: "Compras", kind: "expense", icon: "🛍️", color: "#d946ef" },
  { key: "travel", name: "Viajes", kind: "expense", icon: "✈️", color: "#06b6d4" },
  { key: "pets", name: "Mascotas", kind: "expense", icon: "🐾", color: "#a16207" },
  { key: "other", name: "Otros", kind: "expense", icon: "📦", color: "#64748b" },
  { key: "salary", name: "Sueldo", kind: "income", icon: "💼", color: "#16a34a" },
  { key: "freelance", name: "Freelance", kind: "income", icon: "🧑‍💻", color: "#059669" },
  { key: "sales", name: "Ventas", kind: "income", icon: "🏷️", color: "#65a30d" },
  { key: "refunds", name: "Reembolsos", kind: "income", icon: "↩️", color: "#0d9488" },
  { key: "interest", name: "Intereses", kind: "income", icon: "📈", color: "#15803d" },
  { key: "other_income", name: "Otros ingresos", kind: "income", icon: "➕", color: "#4d7c0f" },
];

export function seedCategories(): Category[] {
  const now = nowISO();
  return DEFAULT_CATEGORIES.map((c, i) => ({
    id: uid(),
    ...c,
    isDefault: true,
    archived: false,
    sortOrder: i,
    createdAt: now,
    updatedAt: now,
  }));
}

export interface AccountPreset {
  name: string;
  type: AccountType;
  icon: string;
  color: string;
}

/** Atajos de onboarding pensados para Perú (editables). */
export const ACCOUNT_PRESETS: AccountPreset[] = [
  { name: "Efectivo", type: "cash", icon: "💵", color: "#16a34a" },
  { name: "Cuenta sueldo", type: "checking", icon: "🏦", color: "#2563eb" },
  { name: "Ahorros", type: "savings", icon: "🐷", color: "#db2777" },
  { name: "Yape", type: "wallet", icon: "📱", color: "#7c3aed" },
  { name: "Plin", type: "wallet", icon: "📲", color: "#0891b2" },
  { name: "Tarjeta de crédito", type: "credit_card", icon: "💳", color: "#0f172a" },
];

export const ACCOUNT_TYPE_ICON: Record<AccountType, string> = {
  checking: "🏦",
  savings: "🐷",
  credit_card: "💳",
  wallet: "📱",
  cash: "💵",
  investment: "📈",
  receivable: "🤝",
};

export const PALETTE = [
  "#16a34a", "#2563eb", "#7c3aed", "#db2777", "#f97316",
  "#eab308", "#0891b2", "#ef4444", "#0f172a", "#64748b",
];

export const EMOJIS = [
  "🏦", "🐷", "💳", "📱", "💵", "💰", "🪙", "💼", "🏠", "🚗",
  "✈️", "🎓", "🎁", "💍", "🏖️", "📈", "🛡️", "🎮", "🐾", "❤️",
  "🍽️", "☕", "🛒", "⛽", "🎬", "💡", "📚", "👶", "🏋️", "🧾",
  "🏡", "🤝", "👤", "👩", "👨", "👵", "🧑‍💼", "💵", "💶", "🇺🇸",
];
