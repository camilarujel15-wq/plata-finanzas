"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { IconBubble, PageHeader } from "@/components/ui/bits";
import { useStore } from "@/lib/store/store";
import { isCloudEnabled } from "@/lib/sync/supabase";

const items = [
  { href: "/cuentas/", icon: "🏦", color: "#2563eb", title: "Cuentas", body: "Bancos, ahorros, tarjetas, wallets y efectivo" },
  { href: "/inversiones/", icon: "📈", color: "#6366f1", title: "Inversiones", body: "Terreno en cuotas, cursos, fondos, negocio" },
  { href: "/me-deben/", icon: "🤝", color: "#f59e0b", title: "Me deben", body: "Quién te debe, cuánto y cuándo paga" },
  { href: "/metas/", icon: "🎯", color: "#f97316", title: "Metas de ahorro", body: "Objetivos, fechas y aportes" },
  { href: "/presupuestos/", icon: "📊", color: "#8b5cf6", title: "Presupuestos", body: "Límites mensuales con alertas 50/80/100%" },
  { href: "/categorias/", icon: "🏷️", color: "#ec4899", title: "Categorías y reglas", body: "Personaliza y revisa lo que la app aprendió" },
  { href: "/importar/", icon: "📥", color: "#0891b2", title: "Importar extracto o Notion", body: "CSV del banco o exportación de Notion" },
  { href: "/ajustes/", icon: "☁️", color: "#10b981", title: "Respaldo, widget y ajustes", body: "Nube, widget de inicio, exportar, privacidad" },
];

export default function Mas() {
  const pending = useStore((s) => s.outbox.length);
  return (
    <div>
      <PageHeader title="Más" />
      <div className="card divide-y divide-line/60">
        {items.map((i) => (
          <Link key={i.href} href={i.href} className="tap flex items-center gap-3 px-4 py-3.5">
            <IconBubble icon={i.icon} color={i.color} />
            <div className="min-w-0 flex-1">
              <div className="font-semibold">{i.title}</div>
              <div className="truncate text-xs text-muted">{i.body}</div>
            </div>
            <ChevronRight size={18} className="text-muted" />
          </Link>
        ))}
      </div>
      <p className="mt-4 text-center text-xs text-muted">
        {isCloudEnabled() ? (pending ? `${pending} cambios por respaldar` : "Respaldo al día") : "Modo local: tus datos viven solo en este dispositivo"}
      </p>
    </div>
  );
}
