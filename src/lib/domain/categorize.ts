import type { Category, CategoryKind, CategoryRule } from "./types";
import { hasPhrase, merchantKey, normalize } from "./text";
import { nowISO, uid } from "./ids";

/** Diccionario base (Perú / español). La clave es `Category.key`. */
export const KEYWORDS: Record<string, string[]> = {
  food: [
    "almuerzo", "almorce", "desayuno", "cena", "comida", "menu", "restaurante", "restaurant", "pollo", "polleria",
    "cafe", "cafeteria", "starbucks", "kfc", "mcdonalds", "bembos", "pizza", "pizzeria", "rappi", "pedidosya",
    "mercado", "supermercado", "plaza vea", "tottus", "wong", "metro", "vivanda", "makro", "mass", "tambo", "oxxo",
    "panaderia", "pan", "bodega", "snack", "chifa", "ceviche", "cevicheria", "hamburguesa", "sushi", "helado",
    "fruta", "verduras", "lonche", "cerveza", "bebidas", "agua mineral", "frutas", "abarrotes", "delivery",
  ],
  transport: [
    "taxi", "uber", "cabify", "didi", "indriver", "indrive", "bus", "combi", "metropolitano", "pasaje", "pasajes",
    "gasolina", "combustible", "grifo", "primax", "repsol", "pecsa", "peaje", "estacionamiento", "cochera",
    "colectivo", "tren", "linea 1", "mototaxi", "corredor", "bici", "scooter", "llanta", "mecanico", "soat",
  ],
  home: [
    "alquiler", "renta", "mantenimiento", "sodimac", "promart", "mueble", "muebles", "limpieza", "condominio",
    "ferreteria", "decoracion", "lavanderia", "detergente", "hogar",
  ],
  health: [
    "farmacia", "inkafarma", "mifarma", "botica", "boticas", "clinica", "doctor", "medico", "consulta", "dentista",
    "medicina", "medicinas", "pastillas", "laboratorio", "eps", "seguro de salud", "oftalmologo", "terapia", "psicologo",
    "gimnasio", "gym", "smart fit", "bodytech",
  ],
  education: [
    "curso", "cursos", "universidad", "colegio", "matricula", "pension", "libro", "libros", "udemy", "platzi",
    "coursera", "clases", "academia", "taller", "diplomado", "maestria", "utiles",
  ],
  fun: [
    "cine", "cineplanet", "cinemark", "concierto", "bar", "discoteca", "juego", "juegos", "steam", "playstation",
    "xbox", "nintendo", "salida", "teleticket", "joinnus", "entradas", "karaoke", "bowling", "fiesta", "tragos",
  ],
  utilities: [
    "luz", "agua", "internet", "telefono", "celular", "movistar", "claro", "entel", "bitel", "enel", "luz del sur",
    "sedapal", "gas", "calidda", "recarga", "cable", "wifi", "plan de datos",
  ],
  subscriptions: [
    "netflix", "spotify", "disney", "hbo", "max", "prime video", "amazon prime", "youtube premium", "icloud",
    "google one", "chatgpt", "suscripcion", "apple music", "crunchyroll", "paramount", "canva", "notion", "adobe",
  ],
  shopping: [
    "ropa", "zapatillas", "zapatos", "saga", "falabella", "ripley", "oechsle", "h&m", "zara", "amazon", "aliexpress",
    "mercado libre", "regalo", "regalos", "tienda", "polo", "casaca", "temu", "shein", "plaza", "mall", "celular nuevo",
  ],
  travel: [
    "vuelo", "vuelos", "hotel", "airbnb", "latam", "sky airline", "jetsmart", "booking", "hospedaje", "viaje",
    "pasaje aereo", "cruz del sur", "oltursa", "tour", "excursion",
  ],
  pets: ["veterinaria", "veterinario", "mascota", "perro", "gato", "croquetas", "petshop", "vacuna del perro"],
  salary: [
    "sueldo", "salario", "planilla", "haberes", "quincena", "remuneracion", "gratificacion", "cts", "pago de sueldo",
  ],
  freelance: ["freelance", "proyecto", "honorarios", "recibo por honorarios", "cliente", "consultoria"],
  sales: ["venta", "vendi", "ventas"],
  refunds: ["reembolso", "devolucion", "reintegro", "me devolvieron"],
  interest: ["intereses", "interes", "rendimiento", "dividendo", "dividendos"],
};

export interface Suggestion {
  categoryId: string;
  confidence: number;
  reason: "rule" | "keyword";
  matched: string;
}

/**
 * Sugiere categoría: 1) reglas aprendidas del usuario (prioridad, frase más larga y más usada),
 * 2) diccionario de palabras clave. Devuelve null si no hay señal suficiente.
 */
export function suggestCategory(
  text: string,
  kind: CategoryKind,
  categories: Category[],
  rules: CategoryRule[],
): Suggestion | null {
  const t = normalize(text);
  if (!t) return null;
  const usable = new Map(
    categories.filter((c) => !c.deletedAt && !c.archived && c.kind === kind).map((c) => [c.id, c]),
  );

  let best: { rule: CategoryRule; score: number } | null = null;
  for (const r of rules) {
    if (r.deletedAt || !usable.has(r.categoryId) || !hasPhrase(t, r.pattern)) continue;
    const score = r.pattern.length * 10 + Math.min(r.hits, 50);
    if (!best || score > best.score) best = { rule: r, score };
  }
  if (best) {
    return {
      categoryId: best.rule.categoryId,
      confidence: Math.min(0.99, 0.75 + best.rule.hits * 0.05),
      reason: "rule",
      matched: best.rule.pattern,
    };
  }

  const byKey = new Map([...usable.values()].filter((c) => c.key).map((c) => [c.key!, c]));
  let kw: { id: string; word: string } | null = null;
  for (const [key, words] of Object.entries(KEYWORDS)) {
    const cat = byKey.get(key);
    if (!cat) continue;
    for (const w of words) {
      if (hasPhrase(t, w) && (!kw || w.length > kw.word.length)) kw = { id: cat.id, word: w };
    }
  }
  // Nombres de categorías personalizadas también funcionan como palabra clave.
  for (const c of usable.values()) {
    const n = normalize(c.name);
    if (hasPhrase(t, n) && (!kw || n.length > kw.word.length)) kw = { id: c.id, word: n };
  }
  return kw ? { categoryId: kw.id, confidence: 0.6, reason: "keyword", matched: kw.word } : null;
}

/**
 * Aprendizaje por corrección: cuando el usuario elige/corrige una categoría para un texto,
 * se crea o refuerza la regla `comercio → categoría`. Devuelve la lista actualizada.
 */
export function learnRule(
  rules: CategoryRule[],
  text: string,
  categoryId: string,
): { rules: CategoryRule[]; changed: CategoryRule | null } {
  const pattern = merchantKey(text);
  if (pattern.length < 3) return { rules, changed: null };
  const now = nowISO();
  const existing = rules.find((r) => !r.deletedAt && r.pattern === pattern);
  if (existing) {
    const changed: CategoryRule =
      existing.categoryId === categoryId
        ? { ...existing, hits: existing.hits + 1, updatedAt: now }
        : { ...existing, categoryId, hits: 1, origin: "user", updatedAt: now };
    return { rules: rules.map((r) => (r.id === existing.id ? changed : r)), changed };
  }
  const changed: CategoryRule = {
    id: uid(),
    pattern,
    categoryId,
    hits: 1,
    origin: "user",
    createdAt: now,
    updatedAt: now,
  };
  return { rules: [...rules, changed], changed };
}
