"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, CalendarDays, Check, Delete, Mic, Sparkles, StickyNote, Trash2 } from "lucide-react";
import { Sheet } from "@/components/ui/Sheet";
import { IconBubble, Segmented } from "@/components/ui/bits";
import { useFormat } from "@/components/ui/Money";
import { useUI } from "@/lib/store/ui";
import { useStore } from "@/lib/store/store";
import { useAccounts, useBalances, useCategoriesByFrequency } from "@/lib/store/selectors";
import { parseEntry } from "@/lib/domain/parse";
import { suggestCategory } from "@/lib/domain/categorize";
import { addDays, dayLabel, today } from "@/lib/domain/dates";
import { centsToInput } from "@/lib/domain/money";
import { TRANSFER_KIND_LABEL, type TransferKind, type TxSource, type TxType } from "@/lib/domain/types";
import { useSpeech } from "./useSpeech";

const MAX_DIGITS = 9;

/**
 * Registro rápido. Flujo de 3 toques para un gasto:
 *   1) botón "+"  2) monto en el teclado  3) tocar la categoría → se guarda.
 * La cuenta viene preseleccionada (la última usada). Todo lo demás es opcional.
 */
export function QuickAdd() {
  const qa = useUI((s) => s.quickAdd);
  const close = useUI((s) => s.closeQuickAdd);
  return qa.open ? <QuickAddInner key={qa.editId ?? "new"} onClose={close} /> : null;
}

function QuickAddInner({ onClose }: { onClose: () => void }) {
  const qa = useUI((s) => s.quickAdd);
  const toast = useUI((s) => s.toast);
  const store = useStore();
  const accounts = useAccounts();
  const balances = useBalances();
  const fmt = useFormat();
  const editing = qa.editId ? store.transactions.find((t) => t.id === qa.editId) : undefined;

  const defaultAccount =
    accounts.find((a) => a.id === store.settings.lastAccountId)?.id ??
    accounts.find((a) => a.id === store.settings.defaultAccountId)?.id ??
    accounts[0]?.id ??
    null;

  const [type, setType] = useState<TxType>(editing?.type ?? qa.type);
  const [digits, setDigits] = useState(editing ? centsToInput(editing.amount) : "");
  const [accountId, setAccountId] = useState<string | null>(editing?.accountId ?? defaultAccount);
  const [toAccountId, setToAccountId] = useState<string | null>(
    editing?.toAccountId ?? accounts.find((a) => a.id !== defaultAccount)?.id ?? null,
  );
  const [categoryId, setCategoryId] = useState<string | null>(editing?.categoryId ?? null);
  const [date, setDate] = useState(editing?.date ?? today());
  const [note, setNote] = useState(editing?.merchant || editing?.note || "");
  const [tags, setTags] = useState(editing?.tags.join(", ") ?? "");
  const [details, setDetails] = useState(Boolean(editing));
  const [text, setText] = useState(qa.text ?? "");
  const [source, setSource] = useState<TxSource>(editing?.source ?? "manual");
  const [showAllCats, setShowAllCats] = useState(false);
  const [shake, setShake] = useState(false);
  const textRef = useRef<HTMLInputElement>(null);

  const cats = useCategoriesByFrequency(type === "income" ? "income" : "expense");
  const visibleCats = showAllCats ? cats : cats.slice(0, 7);
  const amount = Math.round(Number(digits || "0") * 100);

  const suggestion = useMemo(
    () => (note && type !== "transfer" ? suggestCategory(note, type, store.categories, store.rules) : null),
    [note, type, store.categories, store.rules],
  );

  const transferKind: TransferKind = useMemo(() => {
    const to = accounts.find((a) => a.id === toAccountId);
    if (to?.type === "credit_card") return "card_payment";
    if (to?.type === "savings") return "savings";
    return "internal";
  }, [accounts, toAccountId]);

  const press = useCallback((k: string) => {
    setDigits((d) => {
      if (k === "del") return d.slice(0, -1);
      if (k === ".") return d.includes(".") ? d : (d || "0") + ".";
      const [int, dec] = d.split(".");
      if (dec !== undefined && dec.length >= 2) return d;
      if (dec === undefined && int.replace(/^0/, "").length >= MAX_DIGITS) return d;
      return d === "0" ? k : d + k;
    });
  }, []);

  // Teclado físico (escritorio): números al monto sin enfocar nada.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (el.tagName === "INPUT" || el.tagName === "TEXTAREA") return;
      if (/^[0-9]$/.test(e.key)) press(e.key);
      else if (e.key === "." || e.key === ",") press(".");
      else if (e.key === "Backspace") press("del");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [press]);

  const save = useCallback(
    (over: { categoryId?: string | null; amount?: number; type?: TxType; accountId?: string | null; toAccountId?: string | null; date?: string; note?: string; source?: TxSource } = {}) => {
      const t = over.type ?? type;
      const amt = over.amount ?? amount;
      const acc = over.accountId !== undefined ? over.accountId : accountId;
      const to = over.toAccountId !== undefined ? over.toAccountId : toAccountId;
      const cat = over.categoryId !== undefined ? over.categoryId : categoryId;
      const n = (over.note ?? note).trim();
      if (!amt || amt <= 0) {
        setShake(true);
        setTimeout(() => setShake(false), 400);
        return;
      }
      if (!acc) {
        toast({ title: "Primero crea una cuenta", body: "Ve a Más → Cuentas.", tone: "warn" });
        return;
      }
      if (t === "transfer" && (!to || to === acc)) {
        toast({ title: "Elige cuentas distintas de origen y destino", tone: "warn" });
        return;
      }
      if (t !== "transfer" && !cat) {
        setShake(true);
        setTimeout(() => setShake(false), 400);
        return;
      }
      const kind: TransferKind | null = t === "transfer" ? (to ? accounts.find((a) => a.id === to)?.type === "credit_card" ? "card_payment" : accounts.find((a) => a.id === to)?.type === "savings" ? "savings" : "internal" : transferKind) : null;
      const payload = {
        type: t,
        amount: amt,
        accountId: acc,
        toAccountId: t === "transfer" ? to : null,
        transferKind: kind,
        categoryId: t === "transfer" ? null : cat,
        date: over.date ?? date,
        merchant: n || undefined,
        note: undefined,
        tags: tags.split(",").map((x) => x.trim().replace(/^#/, "")).filter(Boolean),
        source: over.source ?? source,
      };

      let notices;
      if (editing) {
        notices = store.updateTransaction(editing.id, payload).notices;
        toast({ title: "Movimiento actualizado", tone: "success" }, 2500);
      } else {
        const res = store.addTransaction(payload);
        notices = res.notices;
        const catObj = store.categories.find((c) => c.id === payload.categoryId);
        const label =
          t === "transfer"
            ? TRANSFER_KIND_LABEL[kind!]
            : `${catObj?.icon ?? ""} ${catObj?.name ?? ""}`;
        toast({
          title: `${t === "income" ? "Ingreso" : t === "transfer" ? "Transferencia" : "Gasto"} ${fmt(amt)}`,
          body: `${label} · ${dayLabel(payload.date)}`,
          tone: "success",
          action: { label: "Deshacer", run: () => store.deleteTransaction(res.tx.id) },
        });
      }
      for (const n2 of notices) toast({ title: n2.title, body: n2.body, tone: "warn" }, 7000);
      onClose();
    },
    [type, amount, accountId, toAccountId, categoryId, note, tags, date, source, editing, store, accounts, transferKind, toast, fmt, onClose],
  );

  /** Aplica el texto/voz interpretado. Si está completo, guarda directamente. */
  const applyText = useCallback(
    (raw: string, via: TxSource, autoSave: boolean) => {
      if (!raw.trim()) return;
      const p = parseEntry(raw, { accounts, categories: store.categories, rules: store.rules });
      setType(p.type);
      if (p.amount) setDigits(centsToInput(p.amount));
      if (p.accountId) setAccountId(p.accountId);
      if (p.toAccountId) setToAccountId(p.toAccountId);
      if (p.categoryId) setCategoryId(p.categoryId);
      if (p.description) setNote(p.description);
      setDate(p.date);
      setSource(via);
      const complete = p.amount && (p.type === "transfer" ? (p.accountId ?? accountId) && p.toAccountId : p.categoryId);
      if (autoSave && complete && !editing) {
        save({
          type: p.type,
          amount: p.amount!,
          categoryId: p.categoryId,
          accountId: p.accountId ?? accountId,
          toAccountId: p.toAccountId,
          date: p.date,
          note: p.description,
          source: via,
        });
      } else if (p.amount && !p.categoryId && p.type !== "transfer") {
        toast({ title: "¿En qué categoría?", body: "Toca una para guardar.", tone: "default" }, 2500);
      }
    },
    [accounts, store.categories, store.rules, accountId, editing, save, toast],
  );

  const speech = useSpeech((transcript) => {
    setText(transcript);
    applyText(transcript, "voice", true);
  });

  useEffect(() => {
    if (qa.text) applyText(qa.text, "text", false);
    if (qa.autoVoice && speech.supported) speech.start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onCategoryTap = (id: string) => {
    setCategoryId(id);
    // Modo rápido: tocar la categoría guarda (si ya hay monto y no estamos editando).
    if (!editing && amount > 0) save({ categoryId: id });
    else if (!amount) {
      setShake(true);
      setTimeout(() => setShake(false), 400);
    }
  };

  const title = editing ? "Editar movimiento" : "Nuevo movimiento";

  return (
    <Sheet
      open
      onClose={onClose}
      title={title}
      tall
      footer={
        <div className="flex gap-2">
          {editing && (
            <button
              className="btn-danger"
              aria-label="Eliminar"
              onClick={() => {
                store.deleteTransaction(editing.id);
                toast({ title: "Movimiento eliminado", action: { label: "Deshacer", run: () => store.restoreTransaction(editing.id) } });
                onClose();
              }}
            >
              <Trash2 size={18} />
            </button>
          )}
          <button className="btn-primary flex-1 py-3.5 text-base" onClick={() => save()} disabled={!amount}>
            <Check size={18} /> {editing ? "Guardar cambios" : "Guardar"}
          </button>
        </div>
      }
    >
      <Segmented
        value={type}
        onChange={(v) => {
          setType(v);
          setCategoryId(null);
        }}
        options={[
          { value: "expense", label: "Gasto" },
          { value: "income", label: "Ingreso" },
          { value: "transfer", label: "Transferir" },
        ]}
      />

      {/* Captura inteligente por texto o voz */}
      <form
        className="mt-3 flex items-center gap-2 rounded-xl border border-line bg-surface-2/60 px-3 py-1.5"
        onSubmit={(e) => {
          e.preventDefault();
          applyText(text, "text", true);
        }}
      >
        <Sparkles size={16} className="shrink-0 text-brand" />
        <input
          ref={textRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder='Escribe "18 almuerzo yape"'
          className="min-w-0 flex-1 bg-transparent py-1.5 text-sm outline-none placeholder:text-muted/80"
          enterKeyHint="done"
          aria-label="Registro por texto"
        />
        {speech.supported && (
          <button
            type="button"
            aria-label={speech.listening ? "Detener dictado" : "Dictar"}
            onClick={() => (speech.listening ? speech.stop() : speech.start())}
            className={`tap rounded-full p-2 ${speech.listening ? "animate-pulse bg-neg text-white" : "bg-brand/15 text-brand"}`}
          >
            <Mic size={16} />
          </button>
        )}
      </form>
      {speech.listening && <p className="mt-1 text-center text-xs text-muted">Escuchando… di por ejemplo “Gasté 18 soles en almuerzo”</p>}

      {/* Monto */}
      <div className={`mt-4 text-center ${shake ? "animate-[pop_.3s]" : ""}`}>
        <div className={`num text-5xl font-bold tracking-tight ${type === "income" ? "text-pos" : ""} ${shake ? "text-neg" : ""}`}>
          <span className="mr-1 align-top text-2xl font-semibold text-muted">S/</span>
          {digits || "0"}
        </div>
        {note && type !== "transfer" && <div className="mt-1 truncate text-sm text-muted">{note}</div>}
      </div>

      {/* Cuentas */}
      <div className="mt-4">
        <div className="label">{type === "transfer" ? "Desde" : type === "income" ? "A la cuenta" : "Pagado con"}</div>
        <AccountChips value={accountId} onChange={setAccountId} balances={balances} fmt={fmt} />
      </div>

      {type === "transfer" ? (
        <div className="mt-3">
          <div className="label flex items-center gap-1">
            <ArrowRight size={12} /> Hacia · <span className="normal-case text-brand">{TRANSFER_KIND_LABEL[transferKind]}</span>
          </div>
          <AccountChips value={toAccountId} onChange={setToAccountId} balances={balances} fmt={fmt} exclude={accountId} />
        </div>
      ) : (
        <div className="mt-4">
          <div className="label flex items-center justify-between">
            <span>{editing ? "Categoría" : amount ? "Toca una categoría para guardar" : "Categoría"}</span>
            {suggestion && suggestion.categoryId !== categoryId && (
              <button className="normal-case text-brand" onClick={() => onCategoryTap(suggestion.categoryId)}>
                Sugerida: {store.categories.find((c) => c.id === suggestion.categoryId)?.name}
              </button>
            )}
          </div>
          <div className="grid grid-cols-4 gap-2">
            {visibleCats.map((c) => (
              <button
                key={c.id}
                onClick={() => onCategoryTap(c.id)}
                className={`tap flex flex-col items-center gap-1 rounded-2xl border px-1 py-2 text-[11px] leading-tight ${categoryId === c.id ? "border-brand bg-brand/10" : "border-transparent bg-surface-2/70"}`}
              >
                <IconBubble icon={c.icon} color={c.color} size={34} />
                <span className="line-clamp-1 w-full text-center">{c.name}</span>
              </button>
            ))}
            {cats.length > 7 && (
              <button onClick={() => setShowAllCats((v) => !v)} className="tap flex flex-col items-center justify-center gap-1 rounded-2xl bg-surface-2/70 py-2 text-[11px] text-muted">
                <span className="text-xl">{showAllCats ? "−" : "⋯"}</span>
                {showAllCats ? "Menos" : "Más"}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Detalles opcionales */}
      <div className="mt-3 flex gap-2 overflow-x-auto no-scrollbar">
        {[today(), addDays(today(), -1)].map((d) => (
          <button key={d} className={`chip ${date === d ? "chip-on" : ""}`} onClick={() => setDate(d)}>
            {dayLabel(d)}
          </button>
        ))}
        <label className={`chip relative ${date !== today() && date !== addDays(today(), -1) ? "chip-on" : ""}`}>
          <CalendarDays size={14} />
          {date !== today() && date !== addDays(today(), -1) ? dayLabel(date) : "Otra fecha"}
          <input type="date" value={date} max={addDays(today(), 365)} onChange={(e) => e.target.value && setDate(e.target.value)} className="absolute inset-0 opacity-0" aria-label="Fecha" />
        </label>
        <button className={`chip ${details ? "chip-on" : ""}`} onClick={() => setDetails((v) => !v)}>
          <StickyNote size={14} /> Nota
        </button>
      </div>
      {details && (
        <div className="mt-3 grid gap-2">
          <input className="input" placeholder="Nota o comercio (ej. Tambo, Uber)" value={note} onChange={(e) => setNote(e.target.value)} />
          <input className="input" placeholder="Etiquetas: viaje, trabajo" value={tags} onChange={(e) => setTags(e.target.value)} />
        </div>
      )}

      {/* Teclado numérico propio: sin saltos de layout ni teclado del sistema */}
      <div className="mt-4 grid grid-cols-3 gap-2" aria-label="Teclado numérico">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9", ".", "0", "del"].map((k) => (
          <button
            key={k}
            onClick={() => press(k)}
            onContextMenu={(e) => {
              if (k === "del") {
                e.preventDefault();
                setDigits("");
              }
            }}
            aria-label={k === "del" ? "Borrar" : k}
            className="tap num flex h-12 items-center justify-center rounded-xl bg-surface-2 text-xl font-semibold active:bg-line"
          >
            {k === "del" ? <Delete size={20} /> : k}
          </button>
        ))}
      </div>
    </Sheet>
  );
}

function AccountChips({
  value,
  onChange,
  balances,
  fmt,
  exclude,
}: {
  value: string | null;
  onChange: (id: string) => void;
  balances: Map<string, number>;
  fmt: (v: number, o?: { compact?: boolean }) => string;
  exclude?: string | null;
}) {
  const accounts = useAccounts().filter((a) => a.id !== exclude);
  if (!accounts.length) return <p className="text-sm text-muted">Crea una cuenta en Más → Cuentas.</p>;
  return (
    <div className="-mx-5 flex gap-2 overflow-x-auto px-5 no-scrollbar">
      {accounts.map((a) => (
        <button key={a.id} onClick={() => onChange(a.id)} className={`chip ${value === a.id ? "chip-on" : ""}`}>
          <span>{a.icon}</span>
          <span>{a.name}</span>
          <span className="num text-xs text-muted">{fmt(balances.get(a.id) ?? 0, { compact: true })}</span>
        </button>
      ))}
    </div>
  );
}
