"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { IconBubble, PageHeader } from "@/components/ui/bits";
import { useStore } from "@/lib/store/store";
import { isCloudEnabled } from "@/lib/sync/supabase";

const items = [
  { href: "/mi-mes/", icon: "i:calendar", color: "#0E5A48", title: "Mi mes", body: "¿Llego a fin de mes? Pagos, tarjetas y consejos" },
  { href: "/gastos-fijos/", icon: "i:receipt", color: "#0E5A48", title: "Gastos fijos", body: "Alquiler, luz, internet, cuotas, sueldo" },
  { href: "/cuentas/", icon: "i:bank", color: "#0E5A48", title: "Cuentas", body: "Bancos, ahorros, tarjetas, wallets y efectivo" },
  { href: "/inversiones/", icon: "i:trend", color: "#0E5A48", title: "Inversiones", body: "Terreno en cuotas, cursos, fondos, negocio" },
  { href: "/me-deben/", icon: "i:handshake", color: "#0E5A48", title: "Me deben", body: "Quién te debe, cuánto y cuándo paga" },
  { href: "/metas/", icon: "i:target", color: "#0E5A48", title: "Metas de ahorro", body: "Objetivos, fechas y aportes" },
  { href: "/presupuestos/", icon: "i:chart", color: "#0E5A48", title: "Presupuestos", body: "Límites mensuales con alertas 50/80/100%" },
  { href: "/categorias/", icon: "i:tag", color: "#0E5A48", title: "Categorías y reglas", body: "Personaliza y revisa lo que la app aprendió" },
  { href: "/importar/", icon: "i:inbox", color: "#0E5A48", title: "Importar extracto o Notion", body: "CSV del banco o exportación de Notion" },
  { href: "/ajustes/", icon: "i:shield", color: "#0E5A48", title: "Respaldo, widget y ajustes", body: "Nube, widget de inicio, exportar, privacidad" },
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
