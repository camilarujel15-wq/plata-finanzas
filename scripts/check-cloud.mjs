// Verifica que la app puede hablar con Supabase usando la configuración de .env.production.
// No crea usuarios ni datos: solo consulta tablas (RLS debe devolver 0 filas sin sesión) y la configuración de Auth.
import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";

const env = Object.fromEntries(
  fs.readFileSync(".env.production", "utf8").split("\n").filter((l) => l && !l.startsWith("#")).map((l) => l.split("=")),
);
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const key = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const sb = createClient(url, key);

let ok = true;
for (const t of ["accounts", "categories", "transactions", "budgets", "goals", "goal_contributions", "category_rules", "budget_alerts"]) {
  const r = await sb.from(t).select("id").limit(1);
  const pass = !r.error && Array.isArray(r.data) && r.data.length === 0;
  ok &&= pass;
  console.log(`${pass ? "✔" : "✘"} ${t}: ${r.error ? r.error.message : `${r.data.length} filas visibles sin sesión`}`);
}
const s = await fetch(`${url}/auth/v1/settings`, { headers: { apikey: key } }).then((r) => r.json());
console.log(`Auth email habilitado: ${s.external?.email}, confirmación de correo desactivada: ${s.mailer_autoconfirm}`);
if (!ok) process.exit(1);
