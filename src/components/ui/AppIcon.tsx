"use client";

import {
  ArrowLeftRight, Baby, Banknote, Bike, BookOpen, Briefcase, Building2, Bus, CalendarDays, Car, CarTaxiFront, ChartLine,
  CircleAlert, CircleCheck, CircleHelp, Clapperboard, Clock, Coffee, Coins, Compass, CreditCard, DollarSign, Droplet,
  Dumbbell, Euro, Flame, Fuel, Gamepad2, Gem, Gift, GraduationCap, HandCoins, Handshake, Heart, House, Inbox, Info,
  LandPlot, Landmark, Laptop, Lightbulb, Mountain, Music, Package, Palmtree, PawPrint, PiggyBank, Pill, Plane, Plus,
  Receipt, Repeat, Search, Shield, Shirt, ShoppingBag, ShoppingCart, Smartphone, Sprout, Stethoscope, Store, Tag, Target,
  Train, TrendingUp, TriangleAlert, Tv, Undo2, User, UserRound, Utensils, Wallet, Wifi, Zap, type LucideIcon,
} from "lucide-react";

/**
 * Íconos de línea para categorías, cuentas e indicadores.
 * Los datos guardan un emoji (versiones anteriores) o una clave "i:nombre"; ambos se muestran como ícono de línea.
 */
export const ICONS: Record<string, LucideIcon> = {
  utensils: Utensils, coffee: Coffee, cart: ShoppingCart, taxi: CarTaxiFront, car: Car, bus: Bus, train: Train, bike: Bike,
  fuel: Fuel, home: House, property: LandPlot, building: Building2, health: Pill, doctor: Stethoscope, education: GraduationCap,
  book: BookOpen, movie: Clapperboard, tv: Tv, game: Gamepad2, music: Music, light: Lightbulb, water: Droplet, wifi: Wifi,
  phone: Smartphone, gas: Flame, repeat: Repeat, bag: ShoppingBag, shirt: Shirt, plane: Plane, beach: Palmtree,
  mountain: Mountain, pet: PawPrint, gift: Gift, gem: Gem, heart: Heart, baby: Baby, gym: Dumbbell, receipt: Receipt,
  package: Package, tag: Tag, briefcase: Briefcase, laptop: Laptop, store: Store, refund: Undo2, trend: TrendingUp,
  plus: Plus, bank: Landmark, piggy: PiggyBank, card: CreditCard, cash: Banknote, wallet: Wallet, coins: Coins,
  dollar: DollarSign, euro: Euro, handshake: Handshake, user: User, person: UserRound, target: Target, shield: Shield,
  transfer: ArrowLeftRight, calendar: CalendarDays, compass: Compass, check: CircleCheck, alert: TriangleAlert,
  clock: Clock, info: Info, sprout: Sprout, chart: ChartLine, zap: Zap, search: Search, inbox: Inbox, warn: CircleAlert,
  lend: HandCoins, help: CircleHelp,
};

const EMOJI: Record<string, string> = {
  "🍽️": "utensils", "🍽": "utensils", "☕": "coffee", "🛒": "cart", "🚕": "taxi", "🚗": "car", "⛽": "fuel",
  "🏠": "home", "🏡": "property", "💊": "health", "🎓": "education", "📚": "book", "🎬": "movie", "🎮": "game",
  "🎵": "music", "💡": "light", "💧": "water", "📶": "wifi", "📱": "phone", "📲": "phone", "🔁": "repeat",
  "🛍️": "bag", "✈️": "plane", "🏖️": "beach", "🏔️": "mountain", "🐾": "pet", "🎁": "gift", "💍": "gem", "💎": "gem",
  "❤️": "heart", "👶": "baby", "🏋️": "gym", "🧾": "receipt", "📦": "package", "🏷️": "tag", "💼": "briefcase",
  "🧑‍💻": "laptop", "🏪": "store", "↩️": "refund", "📈": "trend", "➕": "plus", "🏦": "bank", "🐷": "piggy",
  "💳": "card", "💵": "cash", "💶": "euro", "💰": "wallet", "🪙": "coins", "🇺🇸": "dollar", "🤝": "handshake",
  "👤": "user", "👩": "person", "👨": "person", "👵": "person", "🧑‍💼": "person", "🎯": "target", "🛡️": "shield",
  "🗓️": "calendar", "🧭": "compass", "✅": "check", "🚨": "alert", "⏰": "clock", "🌱": "sprout", "📉": "chart",
  "⚠️": "alert", "❔": "help",
};

export function resolveIcon(icon?: string | null): LucideIcon | null {
  if (!icon) return null;
  if (icon.startsWith("i:")) return ICONS[icon.slice(2)] ?? null;
  return ICONS[EMOJI[icon] ?? EMOJI[icon.replace(/️/g, "")] ?? ""] ?? null;
}

export function AppIcon({ icon, size = 20, className = "", strokeWidth = 1.8 }: { icon?: string | null; size?: number; className?: string; strokeWidth?: number }) {
  const I = resolveIcon(icon);
  if (I) return <I size={size} strokeWidth={strokeWidth} className={className} aria-hidden />;
  // Emoji personalizado sin equivalente: se muestra tal cual, pequeño.
  return (
    <span className={className} style={{ fontSize: size * 0.9, lineHeight: 1 }} aria-hidden>
      {icon || "•"}
    </span>
  );
}

/** Claves ofrecidas en los selectores de ícono. */
export const ICON_CHOICES = [
  "bank", "piggy", "card", "wallet", "cash", "phone", "coins", "dollar", "briefcase", "laptop", "store", "trend",
  "property", "home", "building", "car", "taxi", "bus", "fuel", "utensils", "coffee", "cart", "bag", "shirt",
  "health", "doctor", "gym", "education", "book", "movie", "tv", "game", "music", "light", "water", "wifi",
  "gas", "repeat", "receipt", "plane", "beach", "mountain", "pet", "baby", "gift", "gem", "heart", "shield",
  "target", "handshake", "user", "person", "tag", "package",
].map((k) => `i:${k}`);
