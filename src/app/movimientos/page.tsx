"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight, Search, X } from "lucide-react";
import { useStore } from "@/lib/store/store";
import { useAccounts, useBaseTransactions, useCategories, useTransactions } from "@/lib/store/selectors";
import { PageHeader, Empty } from "@/components/ui/bits";
import { Money } from "@/components/ui/Money";
import { TxRow } from "@/components/tx/TxRow";
import { addMonths, currentPeriod, dayLabel, periodLabel, periodOf } from "@/lib/domain/dates";
import { normalize } from "@/lib/domain/text";
import type { Transaction, TxType } from "@/lib/domain/types";

export default function Movimientos() {
  const params = useSearchParams();
  const router = useRouter();
  const s = useStore();
  const txs = useTransactions();
  const baseTxs = useBaseTransactions();
  const baseAmount = useMemo(() => new Map(baseTxs.map((t) => [t.id, t.amount])), [baseTxs]);
  const accounts = useAccounts(true);
  const categories = useCategories();
  const [period, setPeriod] = useState<string | "all">(currentPeriod());
  const [q, setQ] = useState("");
  const [type, setType] = useState<TxType | "all">("all");
  const accountId = params.get("account");
  const categoryId = params.get("category");
  const tag = params.get("tag");

  const catMap = useMemo(() => new Map(s.categories.map((c) => [c.id, c])), [s.categories]);
  const accMap = useMemo(() => new Map(s.accounts.map((a) => [a.id, a])), [s.accounts]);

  const filtered = useMemo(() => {
    const nq = normalize(q);
    return txs.filter((t) => {
      if (period !== "all" && periodOf(t.date) !== period) return false;
      if (type !== "all" && t.type !== type) return false;
      if (accountId && t.accountId !== accountId && t.toAccountId !== accountId) return false;
      if (categoryId && t.categoryId !== categoryId) return false;
      if (tag && !t.tags.includes(tag)) return false;
      if (nq) {
        const hay = normalize(`${t.merchant ?? ""} ${t.note ?? ""} ${catMap.get(t.categoryId ?? "")?.name ?? ""} ${t.tags.join(" ")} ${(t.amount / 100).toFixed(2)}`);
        if (!hay.includes(nq)) return false;
      }
      return true;
    });
  }, [txs, period, type, accountId, categoryId, tag, q, catMap]);

  const groups = useMemo(() => {
    const m = new Map<string, Transaction[]>();
    for (const t of filtered) m.set(t.date, [...(m.get(t.date) ?? []), t]);
    return [...m.entries()];
  }, [filtered]);

  const totals = useMemo(
    () =>
      filtered.reduce(
        (a, t) => {
          const v = baseAmount.get(t.id) ?? t.amount;
          return t.type === "income" ? { ...a, inc: a.inc + v } : t.type === "expense" ? { ...a, exp: a.exp + v } : a;
        },
        { inc: 0, exp: 0 },
      ),
    [filtered, baseAmount],
  );

  const clearParam = (k: string) => {
    const p = new URLSearchParams(params.toString());
    p.delete(k);
    router.replace(`/movimientos${p.size ? `?${p}` : ""}`);
  };
  const hide = !!s.settings.hideAmounts;

  return (
    <div>
      <PageHeader title="Movimientos" />

      <div className="flex items-center justify-between">
        <button aria-label="Mes anterior" className="tap rounded-full p-2 text-muted" onClick={() => setPeriod((p) => addMonths(p === "all" ? currentPeriod() : p, -1))}>
          <ChevronLeft size={20} />
        </button>
        <button className="text-sm font-semibold" onClick={() => setPeriod((p) => (p === "all" ? currentPeriod() : "all"))}>
          {period === "all" ? "Todo el historial" : periodLabel(period)}
        </button>
        <button aria-label="Mes siguiente" className="tap rounded-full p-2 text-muted disabled:opacity-30" disabled={period === "all" || period >= currentPeriod()} onClick={() => setPeriod((p) => addMonths(p as string, 1))}>
          <ChevronRight size={20} />
        </button>
      </div>

      <div className="mt-2 grid grid-cols-2 gap-2">
        <div className="card px-3 py-2">
          <div className="text-[11px] text-muted">Ingresos</div>
          <Money value={totals.inc} hidden={hide} className="font-semibold text-pos" />
        </div>
        <div className="card px-3 py-2">
          <div className="text-[11px] text-muted">Gastos</div>
          <Money value={totals.exp} hidden={hide} className="font-semibold text-neg" />
        </div>
      </div>

      <div className="relative mt-3">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
        <input className="input pl-9" placeholder="Buscar comercio, nota, etiqueta, monto…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      <div className="-mx-4 mt-2 flex gap-2 overflow-x-auto px-4 no-scrollbar">
        {(["all", "expense", "income", "transfer"] as const).map((t) => (
          <button key={t} className={`chip ${type === t ? "chip-on" : ""}`} onClick={() => setType(t)}>
            {{ all: "Todos", expense: "Gastos", income: "Ingresos", transfer: "Transferencias" }[t]}
          </button>
        ))}
        {accountId && (
          <button className="chip chip-on" onClick={() => clearParam("account")}>
            {accounts.find((a) => a.id === accountId)?.name} <X size={12} />
          </button>
        )}
        {categoryId && (
          <button className="chip chip-on" onClick={() => clearParam("category")}>
            {categories.find((c) => c.id === categoryId)?.name ?? "Categoría"} <X size={12} />
          </button>
        )}
        {tag && (
          <button className="chip chip-on" onClick={() => clearParam("tag")}>
            #{tag} <X size={12} />
          </button>
        )}
      </div>

      <div className="mt-3 space-y-3">
        {groups.length === 0 && <Empty icon="🔍" title="Sin movimientos" body="Cambia los filtros o registra uno con el botón +." />}
        {groups.map(([date, list]) => {
          const net = list.reduce((a, t) => a + (t.type === "income" ? baseAmount.get(t.id) ?? t.amount : t.type === "expense" ? -(baseAmount.get(t.id) ?? t.amount) : 0), 0);
          return (
            <section key={date}>
              <div className="mb-1 flex items-center justify-between px-1 text-xs font-medium text-muted">
                <span>{dayLabel(date)}</span>
                <Money value={net} sign hidden={hide} />
              </div>
              <div className="card divide-y divide-line/60">
                {list.map((t) => (
                  <TxRow key={t.id} tx={t} categories={catMap} accounts={accMap} hidden={hide} />
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
