"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { CategorySlice } from "@/lib/domain/reports";
import { periodLabel } from "@/lib/domain/dates";
import { useFormat } from "@/components/ui/Money";
import { useThemeColors } from "./useThemeColors";

function useTooltipStyle() {
  const c = useThemeColors();
  return { c, style: { background: c.surface, border: `1px solid ${c.line}`, borderRadius: 12, fontSize: 12, color: c.ink } };
}

export function CategoryDonut({ data, total }: { data: CategorySlice[]; total: number }) {
  const fmt = useFormat();
  const { c, style } = useTooltipStyle();
  // Más de 7 porciones es ilegible: el resto se agrupa en "Otros".
  const top = data.slice(0, 6);
  const rest = data.slice(6).reduce((s, x) => s + x.amount, 0);
  const rows = [...top, ...(rest ? [{ categoryId: "rest", name: "Resto", icon: "", color: c.muted, amount: rest, share: 0, count: 0 }] : [])];
  return (
    <div className="relative">
      <ResponsiveContainer width="100%" height={220}>
        <PieChart>
          <Pie isAnimationActive={false} data={rows} dataKey="amount" nameKey="name" innerRadius={68} outerRadius={96} paddingAngle={2} stroke={c.surface} strokeWidth={2}>
            {rows.map((r) => (
              <Cell key={r.categoryId} fill={r.color} />
            ))}
          </Pie>
          <Tooltip contentStyle={style} formatter={(v: number) => fmt(v)} />
        </PieChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <div className="text-xs text-muted">Total</div>
        <div className="num text-xl font-bold">{fmt(total, { compact: total > 1_000_000 })}</div>
      </div>
    </div>
  );
}

export function CashflowArea({ data }: { data: { day: number; cumulative: number }[] }) {
  const fmt = useFormat();
  const { c, style } = useTooltipStyle();
  const rows = data.map((d) => ({ day: d.day, v: d.cumulative / 100 }));
  return (
    <ResponsiveContainer width="100%" height={200}>
      <AreaChart data={rows} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="cf" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={c.brand} stopOpacity={0.35} />
            <stop offset="100%" stopColor={c.brand} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} stroke={c.line} strokeDasharray="3 3" />
        <XAxis dataKey="day" tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: c.muted }} interval={4} />
        <YAxis width={44} tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: c.muted }} tickFormatter={(v: number) => fmt(v * 100, { compact: true }).replace("S/", "").trim()} />
        <ReferenceLine y={0} stroke={c.muted} />
        <Tooltip contentStyle={style} labelFormatter={(d) => `Día ${d}`} formatter={(v: number) => [fmt(Math.round(v * 100)), "Acumulado"]} />
        <Area isAnimationActive={false} type="monotone" dataKey="v" stroke={c.brand} strokeWidth={2} fill="url(#cf)" />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function NetWorthLine({ data }: { data: { period: string; netWorth: number; debt: number }[] }) {
  const fmt = useFormat();
  const { c, style } = useTooltipStyle();
  const rows = data.map((d) => ({ label: periodLabel(d.period, "short"), nw: d.netWorth / 100, debt: d.debt / 100 }));
  return (
    <ResponsiveContainer width="100%" height={200}>
      <LineChart data={rows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke={c.line} strokeDasharray="3 3" />
        <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: c.muted }} />
        <YAxis width={44} tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: c.muted }} tickFormatter={(v: number) => fmt(v * 100, { compact: true }).replace("S/", "").trim()} />
        <Tooltip contentStyle={style} formatter={(v: number, n) => [fmt(Math.round(v * 100)), n === "nw" ? "Patrimonio" : "Deuda TC"]} />
        <Line isAnimationActive={false} type="monotone" dataKey="nw" stroke={c.brand} strokeWidth={2.5} dot={{ r: 3 }} />
        <Line isAnimationActive={false} type="monotone" dataKey="debt" stroke={c.neg} strokeWidth={1.5} strokeDasharray="4 3" dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function TrendLine({ data }: { data: { period: string; expense: number }[] }) {
  const fmt = useFormat();
  const { c, style } = useTooltipStyle();
  const rows = data.map((d) => ({ label: periodLabel(d.period, "short"), v: d.expense / 100 }));
  const avg = rows.reduce((s, r) => s + r.v, 0) / Math.max(1, rows.length);
  return (
    <ResponsiveContainer width="100%" height={180}>
      <AreaChart data={rows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke={c.line} strokeDasharray="3 3" />
        <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: c.muted }} />
        <YAxis width={44} tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: c.muted }} tickFormatter={(v: number) => fmt(v * 100, { compact: true }).replace("S/", "").trim()} />
        <ReferenceLine y={avg} stroke={c.muted} strokeDasharray="4 3" label={{ value: "prom.", fill: c.muted, fontSize: 10, position: "insideTopRight" }} />
        <Tooltip contentStyle={style} formatter={(v: number) => [fmt(Math.round(v * 100)), "Gasto"]} />
        <Area isAnimationActive={false} type="monotone" dataKey="v" stroke={c.neg} strokeWidth={2} fill={c.neg} fillOpacity={0.12} />
      </AreaChart>
    </ResponsiveContainer>
  );
}
