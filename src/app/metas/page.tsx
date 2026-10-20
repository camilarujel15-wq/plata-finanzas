"use client";

import { useState } from "react";
import { Minus, Plus } from "lucide-react";
import { useStore } from "@/lib/store/store";
import { useSpendableAccounts } from "@/lib/store/selectors";
import { PageHeader, Progress, Empty, EmojiPicker, SwatchPicker } from "@/components/ui/bits";
import { Money, useFormat } from "@/components/ui/Money";
import { MoneyInput } from "@/components/ui/MoneyInput";
import { Sheet } from "@/components/ui/Sheet";
import { goalSaved } from "@/lib/domain/balances";
import { daysBetween, dayLabel, today } from "@/lib/domain/dates";
import { EMOJIS, PALETTE } from "@/lib/domain/defaults";
import type { Goal } from "@/lib/domain/types";

export default function Metas() {
  const s = useStore();
  const fmt = useFormat();
  const goals = s.goals.filter((g) => !g.deletedAt && !g.archived);
  const [editing, setEditing] = useState<Partial<Goal> | null>(null);
  const [contrib, setContrib] = useState<{ goal: Goal; sign: 1 | -1 } | null>(null);
  const hide = !!s.settings.hideAmounts;

  return (
    <div>
      <PageHeader
        title="Metas de ahorro"
        back="/mas"
        action={
          <button className="btn-primary px-3 py-2" onClick={() => setEditing({})}>
            <Plus size={16} /> Nueva
          </button>
        }
      />
      <p className="mb-3 px-1 text-xs text-muted">
        Lo que apartas para una meta se descuenta de tu <b>Disponible real</b>, aunque el dinero siga en tu cuenta. Así no lo gastas por accidente.
      </p>

      {!goals.length && <Empty icon="🎯" title="Sin metas aún" body="Un viaje, un fondo de emergencia o una laptop. Ponle monto y fecha." action={<button className="btn-primary" onClick={() => setEditing({})}>Crear meta</button>} />}

      <div className="grid gap-3">
        {goals.map((g) => {
          const saved = goalSaved(g.id, s.contributions);
          const pct = g.targetAmount ? saved / g.targetAmount : 0;
          const daysLeft = g.targetDate ? daysBetween(today(), g.targetDate) : null;
          const monthly = daysLeft && daysLeft > 0 ? Math.ceil(Math.max(0, g.targetAmount - saved) / Math.max(1, daysLeft / 30)) : null;
          const history = s.contributions.filter((c) => c.goalId === g.id && !c.deletedAt).sort((a, b) => b.date.localeCompare(a.date));
          return (
            <div key={g.id} className="card p-4">
              <button className="flex w-full items-start gap-3 text-left" onClick={() => setEditing(g)}>
                <span className="text-3xl">{g.icon}</span>
                <div className="min-w-0 flex-1">
                  <div className="font-semibold">{g.name}</div>
                  <div className="text-xs text-muted">
                    {g.targetDate ? (daysLeft! > 0 ? `${daysLeft} días · hasta ${dayLabel(g.targetDate)}` : "Fecha cumplida") : "Sin fecha límite"}
                  </div>
                </div>
                <div className="num text-right text-lg font-bold" style={{ color: g.color }}>
                  {Math.round(pct * 100)}%
                </div>
              </button>
              <Progress className="mt-3 h-3" value={pct} color={g.color} />
              <div className="mt-2 flex justify-between text-sm">
                <Money value={saved} hidden={hide} className="font-semibold" />
                <span className="text-muted">
                  de <Money value={g.targetAmount} hidden={hide} />
                </span>
              </div>
              {monthly !== null && monthly > 0 && <div className="mt-1 text-xs text-muted">Aparta {fmt(monthly)} al mes para llegar a tiempo.</div>}
              {pct >= 1 && <div className="mt-1 text-xs font-medium text-pos">🎉 ¡Meta cumplida!</div>}
              <div className="mt-3 flex gap-2">
                <button className="btn-primary flex-1 py-2.5" onClick={() => setContrib({ goal: g, sign: 1 })}>
                  <Plus size={16} /> Aportar
                </button>
                <button className="btn-ghost py-2.5" onClick={() => setContrib({ goal: g, sign: -1 })} aria-label="Retirar">
                  <Minus size={16} /> Retirar
                </button>
              </div>
              {history.length > 0 && (
                <details className="mt-3 text-sm">
                  <summary className="cursor-pointer text-xs text-muted">Historial de aportes ({history.length})</summary>
                  <ul className="mt-2 divide-y divide-line/60">
                    {history.map((c) => (
                      <li key={c.id} className="flex items-center justify-between py-1.5">
                        <span className="text-xs text-muted">{dayLabel(c.date)} {c.note && `· ${c.note}`}</span>
                        <span className="flex items-center gap-2">
                          <Money value={c.amount} sign tone hidden={hide} className="text-sm" />
                          <button className="text-xs text-muted" onClick={() => s.deleteContribution(c.id)} aria-label="Eliminar aporte">✕</button>
                        </span>
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </div>
          );
        })}
      </div>

      {editing && <GoalForm initial={editing} onClose={() => setEditing(null)} />}
      {contrib && <ContributionSheet goal={contrib.goal} sign={contrib.sign} onClose={() => setContrib(null)} />}
    </div>
  );
}

function GoalForm({ initial, onClose }: { initial: Partial<Goal>; onClose: () => void }) {
  const s = useStore();
  const accounts = useSpendableAccounts();
  const firstSavings = accounts.find((a) => a.type === "savings")?.id ?? null;
  const [g, setG] = useState<Partial<Goal>>({ icon: "🎯", color: PALETTE[4], accountId: initial.id ? null : firstSavings, ...initial });
  const ok = g.name?.trim() && g.targetAmount && g.targetAmount > 0;
  return (
    <Sheet
      open
      onClose={onClose}
      title={initial.id ? "Editar meta" : "Nueva meta"}
      footer={
        <div className="flex gap-2">
          {initial.id && (
            <button className="btn-danger" onClick={() => { s.deleteGoal(initial.id!); onClose(); }}>
              Eliminar
            </button>
          )}
          <button className="btn-primary flex-1" disabled={!ok} onClick={() => { s.upsertGoal(g as Goal); onClose(); }}>
            Guardar
          </button>
        </div>
      }
    >
      <div className="grid gap-4">
        <div>
          <label className="label" htmlFor="g-name">Nombre</label>
          <input id="g-name" className="input" placeholder="Viaje a Cusco" value={g.name ?? ""} onChange={(e) => setG({ ...g, name: e.target.value })} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label" htmlFor="g-amt">Monto objetivo</label>
            <MoneyInput id="g-amt" value={g.targetAmount ?? null} onChange={(v) => setG({ ...g, targetAmount: v ?? 0 })} />
          </div>
          <div>
            <label className="label" htmlFor="g-date">Fecha objetivo</label>
            <input id="g-date" type="date" className="input" min={today()} value={g.targetDate ?? ""} onChange={(e) => setG({ ...g, targetDate: e.target.value || null })} />
          </div>
        </div>
        <div>
          <div className="label">¿Dónde guardas este dinero?</div>
          <div className="flex flex-wrap gap-2">
            {accounts.filter((a) => !a.linkedAccountId).map((a) => (
              <button key={a.id} className={`chip ${g.accountId === a.id ? "chip-on" : ""}`} onClick={() => setG({ ...g, accountId: a.id })}>
                {a.icon} {a.name}
              </button>
            ))}
            <button className={`chip ${!g.accountId ? "chip-on" : ""}`} onClick={() => setG({ ...g, accountId: null })}>
              Sin cuenta
            </button>
          </div>
          <p className="mt-1.5 text-xs text-muted">Si está en una cuenta “para gastar” (o sin cuenta), lo apartado se descuenta de tu disponible.</p>
        </div>
        <div>
          <div className="label">Color</div>
          <SwatchPicker value={g.color!} options={PALETTE} onChange={(color) => setG({ ...g, color })} />
        </div>
        <div>
          <div className="label">Ícono</div>
          <EmojiPicker value={g.icon!} options={EMOJIS} onChange={(icon) => setG({ ...g, icon })} />
        </div>
      </div>
    </Sheet>
  );
}

function ContributionSheet({ goal, sign, onClose }: { goal: Goal; sign: 1 | -1; onClose: () => void }) {
  const s = useStore();
  const [amount, setAmount] = useState<number | null>(null);
  const [note, setNote] = useState("");
  const quick = [5000, 10000, 20000, 50000];
  return (
    <Sheet
      open
      onClose={onClose}
      title={`${sign > 0 ? "Aportar a" : "Retirar de"} ${goal.name}`}
      footer={
        <button className="btn-primary w-full" disabled={!amount} onClick={() => { s.addContribution(goal.id, sign * (amount ?? 0), note.trim() || undefined); onClose(); }}>
          Confirmar
        </button>
      }
    >
      <div className="grid gap-3">
        <MoneyInput value={amount} onChange={setAmount} autoFocus />
        <div className="flex gap-2">
          {quick.map((q) => (
            <button key={q} className={`chip flex-1 justify-center ${amount === q ? "chip-on" : ""}`} onClick={() => setAmount(q)}>
              <Money value={q} compact />
            </button>
          ))}
        </div>
        <input className="input" placeholder="Nota (opcional)" value={note} onChange={(e) => setNote(e.target.value)} />
      </div>
    </Sheet>
  );
}
