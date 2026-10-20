"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useStore } from "@/lib/store/store";
import { useBaseTransactions, useFx } from "@/lib/store/selectors";
import { PageHeader, Progress, Section, Segmented, IconBubble, Empty } from "@/components/ui/bits";
import { Money } from "@/components/ui/Money";
import { IncomeExpenseBars } from "@/components/charts/IncomeExpenseBars";
import { CashflowArea, CategoryDonut, NetWorthLine, TrendLine } from "@/components/charts/Charts";
import { addMonths, currentPeriod, lastPeriods, periodLabel } from "@/lib/domain/dates";
import { dailyCashflow, monthlySeries, netWorthSeries, spendingByCategory } from "@/lib/domain/reports";

type Range = "1" | "3" | "6" | "12";

export default function Reportes() {
  const s = useStore();
  const txs = useBaseTransactions();
  const fx = useFx();
  const [range, setRange] = useState<Range>("1");
  const [kind, setKind] = useState<"expense" | "income">("expense");
  const [cfPeriod, setCfPeriod] = useState(currentPeriod());
  const end = currentPeriod();
  const months = Number(range);
  const hide = !!s.settings.hideAmounts;

  const periods = useMemo(() => lastPeriods(end, months), [end, months]);
  const slices = useMemo(() => spendingByCategory(txs, s.categories, periods, kind), [txs, s.categories, periods, kind]);
  const total = slices.reduce((a, x) => a + x.amount, 0);
  const series = useMemo(() => monthlySeries(txs, end, Math.max(6, months)), [txs, end, months]);
  const cash = useMemo(() => dailyCashflow(txs, cfPeriod), [txs, cfPeriod]);
  const nw = useMemo(() => netWorthSeries(s.accounts, s.transactions, end, Math.max(6, months), fx), [s.accounts, s.transactions, end, months, fx]);

  const avgExpense = series.reduce((a, r) => a + r.expense, 0) / Math.max(1, series.filter((r) => r.expense > 0).length);
  const avgIncome = series.reduce((a, r) => a + r.income, 0) / Math.max(1, series.filter((r) => r.income > 0).length);

  if (!txs.length) {
    return (
      <div>
        <PageHeader title="Reportes" />
        <Empty icon="📊" title="Aún no hay datos" body="Registra movimientos o importa tu extracto para ver tus reportes." action={<Link className="btn-primary" href="/importar">Importar extracto</Link>} />
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Reportes" />

      <Segmented
        value={range}
        onChange={setRange}
        options={[
          { value: "1", label: "Mes" },
          { value: "3", label: "3M" },
          { value: "6", label: "6M" },
          { value: "12", label: "12M" },
        ]}
      />

      <Section title={`Por categoría · ${months === 1 ? periodLabel(end) : `últimos ${months} meses`}`}>
        <div className="card p-4">
          <Segmented
            className="mb-2"
            value={kind}
            onChange={setKind}
            options={[
              { value: "expense", label: "Gastos" },
              { value: "income", label: "Ingresos" },
            ]}
          />
          {slices.length ? (
            <>
              <CategoryDonut data={slices} total={total} />
              <ul className="mt-2 divide-y divide-line/60">
                {slices.map((c) => (
                  <li key={c.categoryId}>
                    <Link href={`/movimientos?category=${c.categoryId}`} className="tap flex items-center gap-3 py-2.5">
                      <IconBubble icon={c.icon} color={c.color} size={34} />
                      <div className="min-w-0 flex-1">
                        <div className="flex justify-between text-sm">
                          <span className="truncate font-medium">{c.name}</span>
                          <Money value={c.amount} hidden={hide} className="font-semibold" />
                        </div>
                        <div className="mt-1 flex items-center gap-2">
                          <Progress value={c.share} color={c.color} className="h-1.5 flex-1" />
                          <span className="num w-10 text-right text-[11px] text-muted">{Math.round(c.share * 100)}%</span>
                        </div>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="py-8 text-center text-sm text-muted">Sin datos en este periodo.</p>
          )}
        </div>
      </Section>

      <Section title="Ingresos vs. gastos">
        <div className="card p-3">
          <IncomeExpenseBars data={series} />
          <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-muted">
            <div>Ingreso promedio <Money value={Math.round(avgIncome)} hidden={hide} className="block text-sm font-semibold text-pos" /></div>
            <div>Gasto promedio <Money value={Math.round(avgExpense)} hidden={hide} className="block text-sm font-semibold text-neg" /></div>
          </div>
        </div>
      </Section>

      <Section title="Tendencia de gasto">
        <div className="card p-3">
          <TrendLine data={series} />
        </div>
      </Section>

      <Section
        title={`Flujo de caja · ${periodLabel(cfPeriod)}`}
        action={
          <div className="flex gap-1 text-xs">
            <button className="chip px-2 py-0.5" onClick={() => setCfPeriod((p) => addMonths(p, -1))}>‹</button>
            <button className="chip px-2 py-0.5" disabled={cfPeriod >= end} onClick={() => setCfPeriod((p) => addMonths(p, 1))}>›</button>
          </div>
        }
      >
        <div className="card p-3">
          <CashflowArea data={cash} />
          <p className="px-1 text-xs text-muted">Ingresos menos gastos acumulados día a día. Si la curva baja de cero, gastaste más de lo que entró.</p>
        </div>
      </Section>

      <Section title="Evolución patrimonial">
        <div className="card p-3">
          <NetWorthLine data={nw} />
          <div className="mt-1 flex justify-between px-1 text-xs text-muted">
            <span>Variación en el periodo</span>
            <Money value={nw[nw.length - 1].netWorth - nw[0].netWorth} sign tone hidden={hide} className="font-semibold" />
          </div>
        </div>
      </Section>
    </div>
  );
}
