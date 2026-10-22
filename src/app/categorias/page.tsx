"use client";

import { AppIcon } from "@/components/ui/AppIcon";
import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { useStore } from "@/lib/store/store";
import { useCategories } from "@/lib/store/selectors";
import { EmojiPicker, IconBubble, PageHeader, Section, Segmented, SwatchPicker } from "@/components/ui/bits";
import { Sheet } from "@/components/ui/Sheet";
import { EMOJIS, PALETTE } from "@/lib/domain/defaults";
import type { Category, CategoryKind } from "@/lib/domain/types";

export default function Categorias() {
  const s = useStore();
  const [kind, setKind] = useState<CategoryKind>("expense");
  const cats = useCategories(kind);
  const [editing, setEditing] = useState<Partial<Category> | null>(null);
  const rules = s.rules.filter((r) => !r.deletedAt).sort((a, b) => b.hits - a.hits);
  const catMap = new Map(s.categories.map((c) => [c.id, c]));

  return (
    <div>
      <PageHeader
        title="Categorías"
        back="/mas"
        action={
          <button className="btn-primary px-3 py-2" onClick={() => setEditing({ kind })}>
            <Plus size={16} /> Nueva
          </button>
        }
      />
      <Segmented value={kind} onChange={setKind} options={[{ value: "expense", label: "Gastos" }, { value: "income", label: "Ingresos" }]} />
      <div className="mt-3 grid grid-cols-3 gap-2">
        {cats.map((c) => (
          <button key={c.id} onClick={() => setEditing(c)} className="tap card flex flex-col items-center gap-1.5 px-2 py-3 text-xs">
            <IconBubble icon={c.icon} color={c.color} />
            <span className="line-clamp-1">{c.name}</span>
          </button>
        ))}
      </div>

      <Section title="Lo que la app aprendió">
        {rules.length ? (
          <div className="card divide-y divide-line/60">
            {rules.map((r) => {
              const c = catMap.get(r.categoryId);
              return (
                <div key={r.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                  <span className="min-w-0 flex-1 truncate">“{r.pattern}”</span>
                  <span className="shrink-0 text-muted">→ {c?.name}</span>
                  <span className="num w-8 text-right text-xs text-muted">×{r.hits}</span>
                  <button aria-label="Olvidar regla" className="tap text-muted" onClick={() => s.deleteRule(r.id)}>
                    <Trash2 size={14} />
                  </button>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="card px-4 py-3 text-sm text-muted">
            Cuando registras o corriges un movimiento con comercio (ej. “Tambo”), la app recuerda su categoría y la sugiere la próxima vez.
          </p>
        )}
      </Section>

      {editing && <CategoryForm initial={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

function CategoryForm({ initial, onClose }: { initial: Partial<Category>; onClose: () => void }) {
  const s = useStore();
  const [c, setC] = useState<Partial<Category>>({ icon: "i:tag", color: PALETTE[9], ...initial });
  return (
    <Sheet
      open
      onClose={onClose}
      title={initial.id ? "Editar categoría" : "Nueva categoría"}
      footer={
        <div className="flex gap-2">
          {initial.id && (
            <button className="btn-danger" onClick={() => { s.deleteCategory(initial.id!); onClose(); }}>
              Archivar
            </button>
          )}
          <button className="btn-primary flex-1" disabled={!c.name?.trim()} onClick={() => { s.upsertCategory({ ...(c as Category), name: c.name!.trim() }); onClose(); }}>
            Guardar
          </button>
        </div>
      }
    >
      <div className="grid gap-4">
        <div>
          <label className="label" htmlFor="c-name">Nombre</label>
          <input id="c-name" className="input" value={c.name ?? ""} onChange={(e) => setC({ ...c, name: e.target.value })} placeholder="Gimnasio, Bebé, Regalos…" />
        </div>
        {!initial.id && (
          <Segmented value={c.kind ?? "expense"} onChange={(kind) => setC({ ...c, kind })} options={[{ value: "expense", label: "Gasto" }, { value: "income", label: "Ingreso" }]} />
        )}
        <div>
          <div className="label">Color</div>
          <SwatchPicker value={c.color!} options={PALETTE} onChange={(color) => setC({ ...c, color })} />
        </div>
        <div>
          <div className="label">Ícono</div>
          <EmojiPicker value={c.icon!} options={EMOJIS} onChange={(icon) => setC({ ...c, icon })} />
        </div>
      </div>
    </Sheet>
  );
}
