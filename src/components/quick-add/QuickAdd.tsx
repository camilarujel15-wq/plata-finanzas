"use client";

import { AppIcon } from "@/components/ui/AppIcon";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, CalendarDays, Check, Delete, Mic, Sparkles, StickyNote, Trash2 } from "lucide-react";
import { Sheet } from "@/components/ui/Sheet";
import { IconBubble, Segmented } from "@/components/ui/bits";
import { useFormat } from "@/components/ui/Money";
import { useUI } from "@/lib/store/ui";
import { useStore } from "@/lib/store/store";
import { useAccounts, useBalances, useCategoriesByFrequency, useFx, useSpendableAccounts } from "@/lib/store/selectors";
import { convert } from "@/lib/domain/fx";
import { DEFAULT_CLOSING_DAY, closingFor, dueFor, installmentPlan } from "@/lib/domain/card";
import type { Account } from "@/lib/domain/types";
import { symbol } from "@/components/ui/Money";
import { MoneyInput } from "@/components/ui/MoneyInput";
import { parseEntry } from "@/lib/domain/parse";
import { suggestCategory } from "@/lib/domain/categorize";
import { addDays, dayLabel, today } from "@/lib/domain/dates";
import { centsToInput } from "@/lib/domain/money";
import { TRANSFER_KIND_LABEL, type TransferKind, type TxSource, type TxType } from "@/lib/domain/types";
import { useSpeech } from "./useSpeech";
import { haptic } from "@/lib/native/platform";

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
  const allAccounts = useAccounts();
  const accounts = useSpendableAccounts();
  const fx = useFx();
  const balances = useBalances();
  const fmt = useFormat();
  const editing = qa.editId ? store.transactions.find((t) => t.id === qa.editId) : undefined;

  const defaultAccount =
    allAccounts.find((a) => a.id === qa.fromAccountId)?.id ??
    accounts.find((a) => a.id === store.settings.lastAccountId)?.id ??
    accounts.find((a) => a.id === store.settings.defaultAccountId)?.id ??
    accounts[0]?.id ??
    null;

  const [type, setType] = useState<TxType>(editing?.type ?? qa.type);
  const [digits, setDigits] = useState(editing ? centsToInput(editing.amount) : qa.amount ? centsToInput(qa.amount) : "");
  const [accountId, setAccountId] = useState<string | null>(editing?.accountId ?? defaultAccount);
  const [toAccountId, setToAccountId] = useState<string | null>(
    editing?.toAccountId ?? qa.toAccountId ?? accounts.find((a) => a.id !== defaultAccount)?.id ?? null,
  );
  const [categoryId, setCategoryId] = useState<string | null>(editing?.categoryId ?? qa.categoryId ?? null);
  const [date, setDate] = useState(editing?.date ?? today());
  const [note, setNote] = useState(editing?.merchant || editing?.note || qa.note || "");
  const recurringId = editing?.recurringId ?? qa.recurringId ?? null;
  const [installments, setInstallments] = useState<number>(editing?.installments ?? 1);
  const [interestFree, setInterestFree] = useState<boolean>(editing?.installmentRate === 0);
  const [teaText, setTeaText] = useState<string>(editing?.installmentRate ? String(editing.installmentRate) : "");
  const [tags, setTags] = useState(editing?.tags.join(", ") ?? "");
  const [details, setDetails] = useState(Boolean(editing) || Boolean(qa.toAccountId) || Boolean(qa.fromAccountId));
  const [text, setText] = useState(qa.text ?? "");
  const [source, setSource] = useState<TxSource>(editing?.source ?? "manual");
  const [showAllCats, setShowAllCats] = useState(false);
  const [textMode, setTextMode] = useState(Boolean(qa.text));
  const [shake, setShake] = useState(false);
  // Teclado del monto: abierto al empezar un registro nuevo; se oculta al elegir cuenta o categoría.
  const [padOpen, setPadOpen] = useState(!editing && !qa.amount && !qa.text && !qa.autoVoice);
  const choose = useCallback(<T,>(fn: (v: T) => void) => (v: T) => {
    setPadOpen(false);
    fn(v);
  }, []);
  const textRef = useRef<HTMLInputElement>(null);

  const cats = useCategoriesByFrequency(type === "income" ? "income" : "expense");
  const visibleCats = showAllCats ? cats : cats.slice(0, 7);
  const amount = Math.round(Number(digits || "0") * 100);

  const suggestion = useMemo(
    () => (note && type !== "transfer" ? suggestCategory(note, type, store.categories, store.rules) : null),
    [note, type, store.categories, store.rules],
  );

  const kindFor = useCallback(
    (to?: { type: string } | null): TransferKind =>
      to?.type === "credit_card" ? "card_payment" : to?.type === "savings" ? "savings" : to?.type === "investment" ? "investment" : to?.type === "receivable" ? "loan" : "internal",
    [],
  );
  const fromAcc = allAccounts.find((a) => a.id === accountId);
  const toAcc = allAccounts.find((a) => a.id === toAccountId);
  const currency = fromAcc?.currency ?? fx.base;
  const crossCurrency = type === "transfer" && !!toAcc && toAcc.currency !== currency;
  const [toAmountOverride, setToAmountOverride] = useState<number | null>(editing?.toAmount ?? null);
  const transferKind: TransferKind = useMemo(() => {
    if (fromAcc?.type === "receivable") return "repayment";
    const to = allAccounts.find((a) => a.id === toAccountId);
    return kindFor(to);
  }, [allAccounts, toAccountId, fromAcc, kindFor]);

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
        setPadOpen(true);
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
      const src = allAccounts.find((a) => a.id === acc);
      const dst = allAccounts.find((a) => a.id === to);
      const kind: TransferKind | null = t === "transfer" ? (src?.type === "receivable" ? "repayment" : kindFor(dst)) : null;
      const toAmount =
        t === "transfer" && src && dst && src.currency !== dst.currency ? toAmountOverride ?? convert(amt, src.currency, dst.currency, fx) : null;
      const payload = {
        type: t,
        amount: amt,
        accountId: acc,
        toAccountId: t === "transfer" ? to : null,
        transferKind: kind,
        toAmount,
        categoryId: t === "transfer" ? null : cat,
        date: over.date ?? date,
        merchant: n || undefined,
        note: undefined,
        tags: tags.split(",").map((x) => x.trim().replace(/^#/, "")).filter(Boolean),
        source: over.source ?? source,
        recurringId,
        ...(t === "expense" && src?.type === "credit_card" && installments > 1
          ? { installments, installmentRate: interestFree ? 0 : Number(teaText.replace(",", ".")) || src.tea || 0 }
          : { installments: null, installmentRate: null }),
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
            : catObj?.name ?? "";
        toast({
          title: `${t === "income" ? "Ingreso" : t === "transfer" ? "Transferencia" : "Gasto"} ${fmt(amt, { currency: src?.currency })}`,
          body: `${label} · ${dayLabel(payload.date)}`,
          tone: "success",
          action: { label: "Deshacer", run: () => store.deleteTransaction(res.tx.id) },
        });
      }
      haptic(notices.length ? "warn" : "success");
      for (const n2 of notices) toast({ title: n2.title, body: n2.body, tone: "warn" }, 7000);
      onClose();
    },
    [type, amount, accountId, toAccountId, categoryId, note, tags, date, source, editing, store, allAccounts, kindFor, toAmountOverride, fx, toast, fmt, onClose, recurringId, installments, interestFree, teaText],
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
      setPadOpen(true);
    }
  };

  const title = editing ? "Editar movimiento" : type === "income" ? "Nuevo ingreso" : type === "transfer" ? "Transferir" : "Nuevo gasto";
  const selectedCat = cats.find((c) => c.id === categoryId);

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
              className="btn-danger px-4"
              aria-label="Eliminar"
              onClick={() => {
                store.deleteTransaction(editing.id);
                haptic("warn");
                toast({ title: "Movimiento eliminado", action: { label: "Deshacer", run: () => store.restoreTransaction(editing.id) } });
                onClose();
              }}
            >
              <Trash2 size={18} />
            </button>
          )}
          <button className="btn-primary flex-1 py-4 text-base" onClick={() => save()} disabled={!amount}>
            <Check size={19} strokeWidth={2.6} /> {editing ? "Guardar cambios" : "Guardar"}
          </button>
        </div>
      }
    >
      <div className="flex items-center gap-2">
        <Segmented
          className="flex-1"
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
        {speech.supported && (
          <button
            type="button"
            aria-label={speech.listening ? "Detener dictado" : "Dictar"}
            onClick={() => (speech.listening ? speech.stop() : speech.start())}
            className={`tap flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${speech.listening ? "animate-pulse bg-neg text-white" : "bg-brand text-white"}`}
          >
            <Mic size={19} />
          </button>
        )}
      </div>

      {/* Monto: protagonista */}
      <div className={`mt-2 flex flex-col items-center ${shake ? "animate-shake" : ""}`}>
        <div className="flex h-4 items-center gap-1.5 text-xs font-semibold text-muted">
          {selectedCat ? (
            <>
              <AppIcon icon={selectedCat.icon} size={14} /> {selectedCat.name} · {dayLabel(date)}
            </>
          ) : (
            dayLabel(date)
          )}
        </div>
        <button
          type="button"
          aria-label="Monto"
          onClick={() => setPadOpen(true)}
          className={`num mt-1 flex items-start border-b-2 px-3 pb-1 text-[42px] font-semibold leading-none tracking-tight transition-colors ${padOpen ? "border-brand" : "border-transparent"} ${type === "income" ? "text-pos" : ""} ${shake ? "text-neg" : ""}`}
        >
          <span className="mr-1.5 mt-1.5 text-2xl font-semibold text-muted">{symbol(currency)}</span>
          {digits || "0"}
          {padOpen && <span className="ml-0.5 mt-1 h-9 w-0.5 animate-pulse bg-brand" aria-hidden />}
        </button>
        {!padOpen && !digits && <div className="mt-1 text-[11px] text-muted">Toca el monto para escribirlo</div>}
        {note && type !== "transfer" && <div className="mt-2 max-w-full truncate rounded-full bg-surface-2 px-3 py-1 text-xs font-medium text-muted">{note}</div>}
      </div>

      {/* Captura inteligente por texto */}
      {textMode && (
        <form
          className="mt-3 flex animate-rise items-center gap-2 rounded-2xl bg-surface-2 py-1 pl-4 pr-1 ring-brand/30 focus-within:ring-2"
          onSubmit={(e) => {
            e.preventDefault();
            applyText(text, "text", true);
          }}
        >
          <Sparkles size={16} className="shrink-0 text-brand" />
          <input
            ref={textRef}
            autoFocus={!qa.text}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="18 almuerzo yape · ayer 25 taxi"
            className="min-w-0 flex-1 bg-transparent py-2.5 text-sm font-medium outline-none placeholder:font-normal placeholder:text-muted/80"
            enterKeyHint="done"
            aria-label="Registro por texto"
          />
          <button className="tap rounded-xl bg-ink px-3 py-2 text-xs font-semibold text-bg">OK</button>
        </form>
      )}

      {/* Cuentas */}
      <div className="mt-3">
        <div className="label">{type === "transfer" ? "Desde" : type === "income" ? "A la cuenta" : "Pagado con"}</div>
        <AccountGrid value={accountId} onChange={choose(setAccountId)} balances={balances} fmt={fmt} includeAll={type === "transfer"} role="from" />
      </div>

      {type === "expense" && fromAcc?.type === "credit_card" && (
        <CardPlan
          card={fromAcc}
          amount={amount}
          date={date}
          installments={installments}
          setInstallments={setInstallments}
          interestFree={interestFree}
          setInterestFree={setInterestFree}
          teaText={teaText}
          setTeaText={setTeaText}
          fmt={(v) => fmt(v, { currency: fromAcc.currency })}
        />
      )}

      {type === "transfer" ? (
        <div className="mt-4">
          <div className="label flex items-center gap-1">
            <ArrowRight size={12} /> Hacia · <span className="normal-case tracking-normal text-brand">{TRANSFER_KIND_LABEL[transferKind]}</span>
          </div>
          <AccountGrid value={toAccountId} onChange={choose(setToAccountId)} balances={balances} fmt={fmt} exclude={accountId} includeAll role="to" />
          {crossCurrency && toAcc && (
            <div className="mt-3 animate-rise rounded-2xl bg-surface-2 p-3">
              <div className="label mb-1.5">Llega a {toAcc.name} ({symbol(toAcc.currency)})</div>
              <MoneyInput
                value={toAmountOverride ?? convert(amount, currency, toAcc.currency, fx)}
                onChange={setToAmountOverride}
                currency={toAcc.currency}
              />
              <p className="mt-1.5 text-[11px] text-muted">Tipo de cambio: S/ {fx.usdRate} por US$ 1. Corrige el monto si tu banco usó otro.</p>
            </div>
          )}
        </div>
      ) : (
        <div className="mt-3">
          <div className="label flex items-center justify-between">
            <span>{editing ? "Categoría" : amount ? "Toca para guardar" : "Categoría"}</span>
            {suggestion && suggestion.categoryId !== categoryId && (
              <button className="normal-case tracking-normal text-brand" onClick={() => onCategoryTap(suggestion.categoryId)}>
                Sugerida: {store.categories.find((c) => c.id === suggestion.categoryId)?.name}
              </button>
            )}
          </div>
          <div className="grid grid-cols-4 gap-2">
            {visibleCats.map((c) => (
              <button
                key={c.id}
                onClick={() => {
                  setPadOpen(false);
                  onCategoryTap(c.id);
                }}
                className={`tap flex flex-col items-center gap-0.5 rounded-xl px-0.5 py-1.5 text-[10.5px] font-semibold leading-tight transition ${categoryId === c.id ? "bg-brand-soft text-brand ring-1 ring-brand" : "bg-surface-2/80 text-ink"}`}
              >
                <IconBubble icon={c.icon} color={c.color} size={28} />
                <span className="line-clamp-1 w-full text-center">{c.name}</span>
              </button>
            ))}
            {cats.length > 7 && (
              <button onClick={() => { setPadOpen(false); setShowAllCats((v) => !v); }} className="tap flex flex-col items-center justify-center gap-0.5 rounded-xl bg-surface-2/80 py-1.5 text-[10.5px] font-medium text-muted">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-surface text-base">{showAllCats ? "−" : "⋯"}</span>
                {showAllCats ? "Menos" : "Más"}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Detalles opcionales */}
      <div className="-mx-5 mt-3 flex gap-2 overflow-x-auto px-5 no-scrollbar">
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
        <button className={`chip ${details ? "chip-on" : ""}`} onClick={() => { setPadOpen(false); setDetails((v) => !v); }}>
          <StickyNote size={14} /> Nota
        </button>
        <button className={`chip ${textMode ? "chip-on" : ""}`} onClick={() => setTextMode((v) => !v)}>
          <Sparkles size={14} /> Escribir
        </button>
      </div>
      {details && (
        <div className="mt-3 grid animate-rise gap-2">
          <input
            className="input"
            placeholder={
              toAcc?.type === "receivable" && type === "transfer"
                ? "Concepto del préstamo (ej. pasajes a Cusco)"
                : fromAcc?.type === "receivable" && type === "transfer"
                  ? "Nota (ej. primera cuota)"
                  : toAcc?.type === "investment" && type === "transfer"
                    ? "Nota (ej. cuota 13 de 48)"
                    : "Nota o comercio (ej. Tambo, Uber)"
            }
            value={note}
            onFocus={() => setPadOpen(false)}
            onChange={(e) => setNote(e.target.value)}
          />
          <input className="input" placeholder="Etiquetas: viaje, trabajo" value={tags} onFocus={() => setPadOpen(false)} onChange={(e) => setTags(e.target.value)} />
        </div>
      )}

      {/* Teclado numérico: aparece al tocar el monto */}
      {padOpen && (
        <div className="sticky bottom-0 z-10 -mx-5 mt-3 animate-rise border-t border-line bg-surface px-5 pb-1 pt-2" aria-label="Teclado numérico">
          <div className="grid grid-cols-3 gap-1">
            {["1", "2", "3", "4", "5", "6", "7", "8", "9", ".", "0", "del"].map((k) => (
              <button
                key={k}
                onClick={() => {
                  haptic();
                  press(k);
                }}
                onContextMenu={(e) => {
                  if (k === "del") {
                    e.preventDefault();
                    setDigits("");
                  }
                }}
                aria-label={k === "del" ? "Borrar" : k}
                className="num flex h-11 items-center justify-center rounded-xl text-[22px] font-medium transition active:bg-surface-2"
              >
                {k === "del" ? <Delete size={22} className="text-muted" /> : k}
              </button>
            ))}
          </div>
          <button onClick={() => setPadOpen(false)} className="btn-ghost mt-1 w-full py-2.5 text-sm">
            Listo
          </button>
        </div>
      )}
    </Sheet>
  );
}

/**
 * Cuentas en cuadrícula, como las categorías, ordenadas de más a menos usadas (90 días).
 * Hasta 4 cuentas: una fila; 5 a 8: dos filas; más de 8: las 7 más usadas + "Más".
 */
function AccountGrid({
  value,
  onChange,
  balances,
  fmt,
  exclude,
  includeAll,
  role,
}: {
  value: string | null;
  onChange: (id: string) => void;
  balances: Map<string, number>;
  fmt: (v: number, o?: { compact?: boolean; currency?: string }) => string;
  exclude?: string | null;
  includeAll?: boolean;
  role: "from" | "to";
}) {
  const all = useAccounts();
  const spendable = useSpendableAccounts();
  const txs = useStore((s) => s.transactions);
  const [showAll, setShowAll] = useState(false);
  const accounts = useMemo(() => {
    const since = new Date(Date.now() - 90 * 86_400_000).toISOString().slice(0, 10);
    const freq = new Map<string, number>();
    for (const t of txs) {
      if (t.deletedAt || t.date < since) continue;
      const id = role === "to" ? t.toAccountId : t.accountId;
      if (id) freq.set(id, (freq.get(id) ?? 0) + 1);
    }
    return (includeAll ? all : spendable)
      .filter((a) => a.id !== exclude)
      .sort((a, b) => (freq.get(b.id) ?? 0) - (freq.get(a.id) ?? 0) || a.sortOrder - b.sortOrder);
  }, [all, spendable, includeAll, exclude, txs, role]);

  if (!accounts.length) return <p className="text-sm text-muted">Crea una cuenta en Más → Cuentas.</p>;
  const overflow = accounts.length > 8;
  let visible = overflow && !showAll ? accounts.slice(0, 7) : accounts;
  // La cuenta elegida siempre visible, aunque esté entre las menos usadas.
  if (value && !visible.some((a) => a.id === value)) {
    const sel = accounts.find((a) => a.id === value);
    if (sel) visible = [...visible.slice(0, visible.length - 1), sel];
  }
  const cols = accounts.length <= 4 ? accounts.length : 4;
  const colClass = ["grid-cols-1", "grid-cols-2", "grid-cols-3", "grid-cols-4"][Math.max(1, cols) - 1];

  return (
    <div className={`grid ${colClass} gap-2`}>
      {visible.map((a) => {
        const on = value === a.id;
        return (
          <button
            key={a.id}
            onClick={() => onChange(a.id)}
            className={`tap flex min-w-0 flex-col items-center gap-0.5 rounded-xl px-1 py-1.5 text-[10.5px] font-semibold leading-tight ${on ? "bg-brand-soft text-brand ring-1 ring-brand" : "bg-surface-2/80 text-ink"}`}
          >
            <IconBubble icon={a.icon} color={a.color} size={26} />
            <span className="line-clamp-1 w-full text-center">{a.name}</span>
            <span className={`num w-full truncate text-center text-[10px] font-normal ${on ? "text-brand/80" : "text-muted"}`}>
              {fmt(balances.get(a.id) ?? 0, { compact: true, currency: a.currency })}
            </span>
          </button>
        );
      })}
      {overflow && (
        <button onClick={() => setShowAll((v) => !v)} className="tap flex flex-col items-center justify-center gap-0.5 rounded-xl bg-surface-2/80 py-1.5 text-[10.5px] font-medium text-muted">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-surface text-base">{showAll ? "−" : "⋯"}</span>
          {showAll ? "Menos" : `+${accounts.length - 7}`}
        </button>
      )}
    </div>
  );
}

/** Tarjeta de crédito: pago total (sin intereses) o en cuotas, con la cuota y los intereses calculados. */
function CardPlan({
  card,
  amount,
  date,
  installments,
  setInstallments,
  interestFree,
  setInterestFree,
  teaText,
  setTeaText,
  fmt,
}: {
  card: Account;
  amount: number;
  date: string;
  installments: number;
  setInstallments: (n: number) => void;
  interestFree: boolean;
  setInterestFree: (v: boolean) => void;
  teaText: string;
  setTeaText: (v: string) => void;
  fmt: (v: number) => string;
}) {
  const closingDay = card.closingDay ?? DEFAULT_CLOSING_DAY;
  const firstDue = dueFor(closingFor(date, closingDay), card);
  const tea = interestFree ? 0 : Number(teaText.replace(",", ".")) || card.tea || 0;
  const plan = installmentPlan(amount, installments, tea);
  const ddmm = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;
  return (
    <div className="mt-3 rounded-2xl bg-surface-2/70 p-3">
      <div className="label mb-1.5">¿Cómo lo pagarás?</div>
      <div className="flex gap-2">
        <button className={`chip flex-1 justify-center ${installments === 1 ? "chip-on" : ""}`} onClick={() => setInstallments(1)}>
          Pago total
        </button>
        <button className={`chip flex-1 justify-center ${installments > 1 ? "chip-on" : ""}`} onClick={() => installments === 1 && setInstallments(3)}>
          En cuotas
        </button>
      </div>
      {installments === 1 ? (
        <p className="mt-2 text-xs text-muted">
          Sin intereses si pagas el total del estado de cuenta antes del <b className="text-ink">{ddmm(firstDue)}</b>
          {!card.closingDay && " (configura el cierre y pago de tu tarjeta en Cuentas)"}.
        </p>
      ) : (
        <div className="mt-2 grid gap-2">
          <div className="-mx-3 flex gap-1.5 overflow-x-auto px-3 no-scrollbar">
            {[2, 3, 6, 9, 12, 18, 24, 36].map((n) => (
              <button key={n} className={`chip shrink-0 px-3 ${installments === n ? "chip-on" : ""}`} onClick={() => setInstallments(n)}>
                {n}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <button className={`chip ${interestFree ? "chip-on" : ""}`} onClick={() => setInterestFree(!interestFree)}>
              {interestFree ? "✓ " : ""}Sin intereses (promo)
            </button>
            {!interestFree && (
              <label className="flex flex-1 items-center gap-1.5 rounded-full bg-surface px-3 py-1.5 text-sm ring-1 ring-line">
                <span className="text-xs text-muted">TEA</span>
                <input
                  className="num w-full bg-transparent text-right outline-none"
                  inputMode="decimal"
                  placeholder={card.tea ? String(card.tea) : "ej. 65"}
                  value={teaText}
                  onChange={(e) => setTeaText(e.target.value)}
                />
                <span className="text-xs text-muted">%</span>
              </label>
            )}
          </div>
          {amount > 0 && (
            <p className="text-xs leading-relaxed text-muted">
              <b className="text-ink">{installments} cuotas de {fmt(plan.cuota)}</b>
              {plan.interest > 0 ? (
                <>
                  {" "}· pagarás <b className="text-warn">{fmt(plan.interest)} de intereses</b> (total {fmt(plan.total)})
                </>
              ) : (
                " · sin intereses"
              )}
              . La 1.ª cuota vence el {ddmm(firstDue)}.
              {!interestFree && !tea && " Escribe la TEA para calcular intereses."}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
