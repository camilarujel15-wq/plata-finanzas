"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { MonthTotals } from "@/lib/domain/reports";
import { periodLabel } from "@/lib/domain/dates";
import { useFormat } from "@/components/ui/Money";
import { useThemeColors } from "./useThemeColors";

export function IncomeExpenseBars({ data, height = 180, showAxis = true }: { data: MonthTotals[]; height?: number; showAxis?: boolean }) {
  const fmt = useFormat();
  const c = useThemeColors();
  const rows = data.map((d) => ({ ...d, label: periodLabel(d.period, "short"), income: d.income / 100, expense: d.expense / 100 }));
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={rows} barGap={2} margin={{ top: 8, right: 0, left: 0, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke={c.line} strokeDasharray="3 3" />
        <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: c.muted }} />
        {showAxis && (
          <YAxis width={44} tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: c.muted }} tickFormatter={(v: number) => fmt(v * 100, { compact: true }).replace("S/", "").trim()} />
        )}
        <Tooltip
          cursor={{ fill: c["surface-2"] }}
          contentStyle={{ background: c.surface, border: `1px solid ${c.line}`, borderRadius: 12, fontSize: 12, color: c.ink }}
          formatter={(v: number, name) => [fmt(Math.round(v * 100)), name === "income" ? "Ingresos" : "Gastos"]}
        />
        <Bar isAnimationActive={false} dataKey="income" fill={c.pos} radius={[4, 4, 0, 0]} maxBarSize={18} />
        <Bar isAnimationActive={false} dataKey="expense" fill={c.neg} fillOpacity={0.85} radius={[4, 4, 0, 0]} maxBarSize={18} />
      </BarChart>
    </ResponsiveContainer>
  );
}
