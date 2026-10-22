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
  { key: "food", name: "Alimentación", kind: "expense", icon: "🍽️", color: "#B4532A" },
  { key: "transport", name: "Transporte", kind: "expense", icon: "🚕", color: "#2F5D8A" },
  { key: "home", name: "Hogar", kind: "expense", icon: "🏠", color: "#6B5B95" },
  { key: "health", name: "Salud", kind: "expense", icon: "💊", color: "#B83B3B" },
  { key: "education", name: "Educación", kind: "expense", icon: "🎓", color: "#4A5A9A" },
  { key: "fun", name: "Entretenimiento", kind: "expense", icon: "🎬", color: "#A0457A" },
  { key: "utilities", name: "Servicios", kind: "expense", icon: "💡", color: "#9A7B1C" },
  { key: "subscriptions", name: "Suscripciones", kind: "expense", icon: "🔁", color: "#2E7D74" },
  { key: "shopping", name: "Compras", kind: "expense", icon: "🛍️", color: "#8E4B9A" },
  { key: "travel", name: "Viajes", kind: "expense", icon: "✈️", color: "#2B7A99" },
  { key: "pets", name: "Mascotas", kind: "expense", icon: "🐾", color: "#7A5C3A" },
  { key: "other", name: "Otros", kind: "expense", icon: "📦", color: "#6B7280" },
  { key: "salary", name: "Sueldo", kind: "income", icon: "💼", color: "#0E7A55" },
  { key: "freelance", name: "Freelance", kind: "income", icon: "🧑‍💻", color: "#2E7D74" },
  { key: "sales", name: "Ventas", kind: "income", icon: "🏷️", color: "#5B7A2E" },
  { key: "refunds", name: "Reembolsos", kind: "income", icon: "↩️", color: "#2E6B7D" },
  { key: "interest", name: "Intereses", kind: "income", icon: "📈", color: "#0E5A48" },
  { key: "other_income", name: "Otros ingresos", kind: "income", icon: "➕", color: "#4B6B3A" },
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
  { name: "Efectivo", type: "cash", icon: "💵", color: "#2F7A55" },
  { name: "Cuenta sueldo", type: "checking", icon: "🏦", color: "#2F5D8A" },
  { name: "Ahorros", type: "savings", icon: "🐷", color: "#8A4B6B" },
  { name: "Yape", type: "wallet", icon: "📱", color: "#6B4BA0" },
  { name: "Plin", type: "wallet", icon: "📲", color: "#2B7A99" },
  { name: "Tarjeta de crédito", type: "credit_card", icon: "💳", color: "#374151" },
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
  "#0E5A48", "#2F5D8A", "#6B4BA0", "#8A4B6B", "#B4532A",
  "#9A7B1C", "#2B7A99", "#B83B3B", "#374151", "#6B7280",
];

export const EMOJIS = [
  "🏦", "🐷", "💳", "📱", "💵", "💰", "🪙", "💼", "🏠", "🚗",
  "✈️", "🎓", "🎁", "💍", "🏖️", "📈", "🛡️", "🎮", "🐾", "❤️",
  "🍽️", "☕", "🛒", "⛽", "🎬", "💡", "📚", "👶", "🏋️", "🧾",
  "🏡", "🤝", "👤", "👩", "👨", "👵", "🧑‍💼", "💵", "💶", "🇺🇸",
];
