"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { useStore } from "@/lib/store/store";
import { useUI } from "@/lib/store/ui";
import { useAccounts, useBalances, usePosition } from "@/lib/store/selectors";
import { Empty, IconBubble, PageHeader, Progress } from "@/components/ui/bits";
import { Money } from "@/components/ui/Money";
import { AccountForm } from "@/components/accounts/AccountForm";
import { INVESTMENT_KIND_LABEL, type Account } from "@/lib/domain/types";

/** Inversiones: terreno en cuotas, cursos, fondos… Cada aporte es una transferencia desde una cuenta. */
export default function Inversiones() {
  const all = useAccounts(true);
  const balances = useBalances();
  const pos = usePosition();
  const hide = !!useStore((s) => s.settings.hideAmounts);
  const openQuickAdd = useUI((u) => u.openQuickAdd);
  const [editing, setEditing] = useState<Partial<Account> | null>(null);
  const list = useMemo(() => all.filter((a) => a.type === "investment" && !a.archived), [all]);
  const archived = all.filter((a) => a.type === "investment" && a.archived);

  return (
    <div>
      <PageHeader
        title="Inversiones"
        back="/mas/"
        action={
          <button className="btn-primary px-3 py-2" onClick={() => setEditing({})}>
            <Plus size={16} /> Nueva
          </button>
        }
      />

      <section className="hero p-5">
        <div className="text-[11px] font-semibold tracking-wide text-emerald-200">VALOR DE TUS INVERSIONES</div>
        <Money value={pos.investments} hidden={hide} className="mt-2 block text-[34px] font-extrabold leading-none" />
        <p className="mt-3 text-xs leading-relaxed text-white/60">Suma a tu patrimonio, pero no a tu disponible: es dinero que no puedes gastar hoy.</p>
      </section>

      {!list.length && (
        <div className="mt-4">
          <Empty
            icon="🏡"
            title="Registra tus inversiones"
            body="Cuotas de un terreno, un diplomado, fondos mutuos o tu negocio. Cada pago que hagas se suma como aporte."
            action={<button className="btn-primary" onClick={() => setEditing({})}>Agregar inversión</button>}
          />
        </div>
      )}

      <div className="mt-4 grid gap-3">
        {list.map((a) => {
          const paid = balances.get(a.id) ?? 0;
          const pct = a.targetAmount ? paid / a.targetAmount : null;
          const gain = a.marketValue != null ? a.marketValue - paid : null;
          return (
            <div key={a.id} className="card p-4">
              <button className="flex w-full items-start gap-3 text-left" onClick={() => setEditing(a)}>
                <IconBubble icon={a.icon} color={a.color} size={46} />
                <div className="min-w-0 flex-1">
                  <div className="truncate font-bold">{a.name}</div>
                  <div className="truncate text-xs text-muted">
                    {INVESTMENT_KIND_LABEL[a.investmentKind ?? "other"].label}
                    {a.note ? ` · ${a.note}` : ""}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[11px] font-medium text-muted">Aportado</div>
                  <Money value={paid} hidden={hide} currency={a.currency} className="font-bold" />
                </div>
              </button>
              {pct !== null && (
                <div className="mt-3">
                  <Progress className="h-2.5" value={pct} color={a.color} />
                  <div className="mt-1.5 flex flex-wrap justify-between gap-x-3 gap-y-0.5 text-xs text-muted">
                    <span>{Math.round(pct * 100)}% pagado</span>
                    <span>
                      Falta <Money value={Math.max(0, a.targetAmount! - paid)} hidden={hide} currency={a.currency} className="font-semibold text-ink" /> de{" "}
                      <Money value={a.targetAmount!} hidden={hide} currency={a.currency} compact />
                    </span>
                  </div>
                </div>
              )}
              {gain !== null && (
                <div className="mt-2 text-xs text-muted">
                  Valor actual <Money value={a.marketValue!} hidden={hide} currency={a.currency} className="font-semibold text-ink" /> ·{" "}
                  <Money value={gain} sign tone hidden={hide} currency={a.currency} className="font-semibold" />
                </div>
              )}
              <div className="mt-3 flex gap-2">
                <button className="btn-primary flex-1 py-2.5" onClick={() => openQuickAdd({ type: "transfer", toAccountId: a.id })}>
                  <Plus size={16} /> Registrar aporte / cuota
                </button>
                <Link href={`/movimientos/?account=${a.id}`} className="btn-ghost py-2.5">
                  Historial
                </Link>
              </div>
            </div>
          );
        })}
      </div>

      {archived.length > 0 && <p className="mt-4 px-1 text-xs text-muted">{archived.length} inversión(es) archivada(s).</p>}
      {editing && <AccountForm initial={editing} mode="investment" onClose={() => setEditing(null)} />}
    </div>
  );
}
