"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { PageHeader } from "@/components/ui/bits";
import { useStore } from "@/lib/store/store";
import { isCloudEnabled } from "@/lib/sync/supabase";

const items = [
  { href: "/cuentas", icon: "🏦", title: "Cuentas", body: "Bancos, ahorros, tarjetas, wallets y efectivo" },
  { href: "/metas", icon: "🎯", title: "Metas de ahorro", body: "Objetivos, fechas y aportes" },
  { href: "/presupuestos", icon: "📊", title: "Presupuestos", body: "Límites mensuales con alertas 50/80/100%" },
  { href: "/categorias", icon: "🏷️", title: "Categorías y reglas", body: "Personaliza y revisa lo que la app aprendió" },
  { href: "/importar", icon: "📥", title: "Importar extracto o Notion", body: "CSV del banco o exportación de Notion" },
  { href: "/ajustes", icon: "⚙️", title: "Ajustes y respaldo", body: "Sincronización, exportar datos, privacidad" },
];

export default function Mas() {
  const pending = useStore((s) => s.outbox.length);
  return (
    <div>
      <PageHeader title="Más" />
      <div className="card divide-y divide-line/60">
        {items.map((i) => (
          <Link key={i.href} href={i.href} className="tap flex items-center gap-3 px-4 py-3.5">
            <span className="text-2xl">{i.icon}</span>
            <div className="min-w-0 flex-1">
              <div className="font-medium">{i.title}</div>
              <div className="truncate text-xs text-muted">{i.body}</div>
            </div>
            <ChevronRight size={18} className="text-muted" />
          </Link>
        ))}
      </div>
      <p className="mt-4 text-center text-xs text-muted">
        {isCloudEnabled() ? (pending ? `${pending} cambios por sincronizar` : "Todo sincronizado") : "Modo local: tus datos viven solo en este dispositivo"}
      </p>
    </div>
  );
}
