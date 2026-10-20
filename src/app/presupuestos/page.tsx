"use client";

import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { useStore } from "@/lib/store/store";
import { useBaseTransactions, useCategories } from "@/lib/store/selectors";
import { Empty, IconBubble, PageHeader, Progress } from "@/components/ui/bits";
import { Money } from "@/components/ui/Money";
import { MoneyInput } from "@/components/ui/MoneyInput";
import { Sheet } from "@/components/ui/Sheet";
import { addMonths, currentPeriod, daysInPeriod, periodLabel, today } from "@/lib/domain/dates";
import { budgetStatus, spentInCategory } from "@/lib/domain/budgets";

export default function Presupuestos() {
  const s = useStore();
  const txs = useBaseTransactions();
  const cats = useCategories("expense");
  const period = currentPeriod();
  const [editing, setEditing] = useState<string | null>(null);
  const hide = !!s.settings.hideAmounts;

  const rows = useMemo(
    () => s.budgets.filter((b) => !b.deletedAt).map((b) => budgetStatus(b, txs, period)).sort((a, b) => b.ratio - a.ratio),
    [s.budgets, txs, period],
  );
  const total = rows.reduce((a, r) => ({ budget: a.budget + r.budget.amount, spent: a.spent + r.spent }), { budget: 0, spent: 0 });
  const elapsed = Number(today().slice(8, 10)) / daysInPeriod(period);

  return (
    <div>
      <PageHeader
        title="Presupuestos"
        back="/mas"
        subtitle={periodLabel(period)}
        action={
          <button className="btn-primary px-3 py-2" onClick={() => setEditing("")}>
            <Plus size={16} /> Nuevo
          </button>
        }
      />

      {rows.length > 0 && (
        <div className="card p-4">
          <div className="flex justify-between text-sm">
            <span className="text-muted">Gastado</span>
            <span>
              <Money value={total.spent} hidden={hide} className="font-semibold" /> / <Money value={total.budget} hidden={hide} />
            </span>
          </div>
          <div className="relative mt-2">
            <Progress className="h-3" value={total.budget ? total.spent / total.budget : 0} />
            {/* Marcador de "dónde deberías ir" según los días transcurridos */}
            <div className="absolute -top-1 h-5 w-0.5 rounded bg-ink/60" style={{ left: `${elapsed * 100}%` }} title="Hoy" />
          </div>
          <div className="mt-1 text-xs text-muted">La línea marca cuánto del mes ha pasado ({Math.round(elapsed * 100)}%).</div>
        </div>
      )}

      {!rows.length && (
        <Empty icon="📊" title="Sin presupuestos" body="Define cuánto quieres gastar al mes por categoría. Te avisamos al 50%, 80% y 100%." action={<button className="btn-primary" onClick={() => setEditing("")}>Crear presupuesto</button>} />
      )}

      <div className="mt-3 card divide-y divide-line/60">
        {rows.map((r) => {
          const c = cats.find((x) => x.id === r.budget.categoryId) ?? s.categories.find((x) => x.id === r.budget.categoryId);
          return (
            <button key={r.budget.id} className="tap block w-full px-4 py-3 text-left" onClick={() => setEditing(r.budget.categoryId)}>
              <div className="flex items-center gap-3">
                <IconBubble icon={c?.icon ?? "❔"} color={c?.color ?? "#999"} size={34} />
                <div className="min-w-0 flex-1">
                  <div className="flex justify-between text-sm">
                    <span className="font-medium">{c?.name}</span>
                    <span className={`num text-xs ${r.level === "over" ? "font-semibold text-neg" : r.level === "warn" ? "text-warn" : "text-muted"}`}>
                      {Math.round(r.ratio * 100)}%
                    </span>
                  </div>
                  <Progress className="mt-1.5" value={r.ratio} />
                  <div className="mt-1 flex justify-between text-[11px] text-muted">
                    <span><Money value={r.spent} hidden={hide} /> de <Money value={r.budget.amount} hidden={hide} /></span>
                    <span>{r.remaining >= 0 ? <>Quedan <Money value={r.remaining} hidden={hide} /></> : <>Excedido <Money value={-r.remaining} hidden={hide} /></>}</span>
                  </div>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {editing !== null && <BudgetSheet categoryId={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

function BudgetSheet({ categoryId, onClose }: { categoryId: string; onClose: () => void }) {
  const s = useStore();
  const cats = useCategories("expense");
  const txs = useBaseTransactions();
  const existing = s.budgets.find((b) => !b.deletedAt && b.categoryId === categoryId);
  const [cat, setCat] = useState(categoryId || cats[0]?.id);
  const [amount, setAmount] = useState<number | null>(existing?.amount ?? null);
  // Sugerencia: promedio de los últimos 3 meses.
  const p = currentPeriod();
  const avg = Math.round([1, 2, 3].reduce((a, i) => a + spentInCategory(txs, cat, addMonths(p, -i)), 0) / 3);

  return (
    <Sheet
      open
      onClose={onClose}
      title={existing ? "Editar presupuesto" : "Nuevo presupuesto"}
      footer={
        <div className="flex gap-2">
          {existing && <button className="btn-danger" onClick={() => { s.deleteBudget(existing.id); onClose(); }}>Eliminar</button>}
          <button className="btn-primary flex-1" disabled={!amount} onClick={() => { s.upsertBudget(cat, amount!); onClose(); }}>Guardar</button>
        </div>
      }
    >
      {!categoryId && (
        <div className="mb-4">
          <div className="label">Categoría</div>
          <div className="flex flex-wrap gap-2">
            {cats.map((c) => (
              <button key={c.id} className={`chip ${cat === c.id ? "chip-on" : ""}`} onClick={() => setCat(c.id)}>
                {c.icon} {c.name}
              </button>
            ))}
          </div>
        </div>
      )}
      <label className="label">Límite mensual</label>
      <MoneyInput value={amount} onChange={setAmount} autoFocus={!!categoryId} />
      {avg > 0 && (
        <button className="mt-2 text-sm text-brand" onClick={() => setAmount(Math.ceil(avg / 1000) * 1000)}>
          Tu promedio de 3 meses: <Money value={avg} /> — usar
        </button>
      )}
      <p className="mt-3 text-xs text-muted">Recibirás avisos al alcanzar 50%, 80% y 100% del límite.</p>
    </Sheet>
  );
}
