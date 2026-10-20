"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Papa from "papaparse";
import { Check, FileUp, Wand2 } from "lucide-react";
import { useStore } from "@/lib/store/store";
import { useSpendableAccounts as useAccounts, useCategories } from "@/lib/store/selectors";
import { useUI } from "@/lib/store/ui";
import { PageHeader, Segmented } from "@/components/ui/bits";
import { Money } from "@/components/ui/Money";
import { buildRows, COLUMN_LABEL, detectColumns, findHeaderRow, type ColumnMap, type ImportRow } from "@/lib/import/detect";
import { normalize } from "@/lib/domain/text";

type Step = 1 | 2 | 3;

async function readCsv(file: File): Promise<string[][]> {
  const parse = (encoding: string) =>
    new Promise<string[][]>((resolve, reject) =>
      Papa.parse<string[]>(file, { encoding, skipEmptyLines: "greedy", complete: (r) => resolve(r.data), error: reject }),
    );
  const rows = await parse("UTF-8");
  // Muchos bancos exportan en Latin-1: si aparecen caracteres inválidos, reintentar.
  return rows.some((r) => r.some((c) => c.includes("�"))) ? parse("ISO-8859-1") : rows;
}

export default function Importar() {
  const s = useStore();
  const router = useRouter();
  const toast = useUI((u) => u.toast);
  const accounts = useAccounts();
  const expenseCats = useCategories("expense");
  const incomeCats = useCategories("income");
  const [step, setStep] = useState<Step>(1);
  const [fileName, setFileName] = useState("");
  const [raw, setRaw] = useState<string[][]>([]);
  const [headerRow, setHeaderRow] = useState(0);
  const [map, setMap] = useState<ColumnMap | null>(null);
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [skipped, setSkipped] = useState(0);
  const [accountId, setAccountId] = useState(s.settings.defaultAccountId ?? accounts[0]?.id ?? "");
  const [error, setError] = useState("");
  const [forceType, setForceType] = useState<"auto" | "expense" | "income">("auto");

  const header = raw[headerRow] ?? [];
  const body = useMemo(() => raw.slice(headerRow + 1), [raw, headerRow]);

  const onFile = async (file: File) => {
    setError("");
    try {
      const data = await readCsv(file);
      if (data.length < 2) throw new Error("El archivo no tiene filas.");
      const h = findHeaderRow(data);
      setFileName(file.name);
      setRaw(data);
      setHeaderRow(h);
      setMap(detectColumns(data[h], data.slice(h + 1, h + 30)));
      setStep(2);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo leer el archivo.");
    }
  };

  const toPreview = () => {
    if (!map) return;
    const out = buildRows(body, map, { categories: s.categories, rules: s.rules, existing: s.transactions, forceType: forceType === "auto" ? null : forceType });
    setRows(out.rows);
    setSkipped(out.skipped);
    setStep(3);
  };

  const accountFor = (name?: string) => {
    if (!name) return accountId;
    const n = normalize(name);
    return accounts.find((a) => normalize(a.name) === n || n.includes(normalize(a.name)))?.id ?? accountId;
  };

  const confirm = () => {
    const chosen = rows.filter((r) => r.include);
    const n = s.importTransactions(
      chosen.map((r) => ({
        type: r.type,
        amount: r.amount,
        accountId: accountFor(r.accountName),
        categoryId: r.categoryId ?? (r.type === "income" ? incomeCats.find((c) => c.key === "other_income")?.id : expenseCats.find((c) => c.key === "other")?.id) ?? null,
        date: r.date,
        merchant: r.description,
        importHash: r.hash,
      })),
      // Lo que el usuario corrigió a mano se aprende.
      chosen.filter((r) => r.confidence === 0 && r.categoryId).map((r) => ({ text: r.description, categoryId: r.categoryId! })),
    );
    toast({ title: `${n} movimientos importados`, body: fileName, tone: "success" });
    router.push("/movimientos");
  };

  const included = rows.filter((r) => r.include);
  const sum = included.reduce((a, r) => a + (r.type === "income" ? r.amount : -r.amount), 0);
  const uncategorized = included.filter((r) => !r.categoryId).length;

  return (
    <div>
      <PageHeader title="Importar" back="/mas" subtitle={`Paso ${step} de 3`} />

      {step === 1 && (
        <div className="grid gap-3">
          <label className="card tap flex cursor-pointer flex-col items-center gap-2 border-dashed px-6 py-10 text-center">
            <FileUp size={32} className="text-brand" />
            <span className="font-semibold">Sube tu extracto o exportación de Notion</span>
            <span className="text-xs text-muted">CSV (bancos peruanos, Notion, Excel → “Guardar como CSV”)</span>
            <input type="file" accept=".csv,.txt,.tsv,text/csv" className="hidden" onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
          </label>
          {error && <p className="text-sm text-neg">{error}</p>}
          <div className="card p-4 text-sm text-muted">
            <div className="mb-2 font-semibold text-ink">Cómo funciona</div>
            <ol className="list-decimal space-y-1 pl-5">
              <li>Detectamos automáticamente fecha, descripción y montos (o columnas cargo/abono).</li>
              <li>Categorizamos cada fila con tus reglas aprendidas y un diccionario local.</li>
              <li>Marcamos duplicados para que no se registren dos veces.</li>
              <li>Revisas, corriges y confirmas. Tus correcciones se aprenden.</li>
            </ol>
            <p className="mt-3 text-xs">El archivo se procesa en tu dispositivo; no se sube a ningún servidor.</p>
          </div>
        </div>
      )}

      {step === 2 && map && (
        <div className="grid gap-3">
          <div className="card p-4">
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
              <Wand2 size={16} className="text-brand" /> Columnas detectadas en {fileName}
            </div>
            <div className="mb-3">
              <label className="label">Fila de encabezados</label>
              <select className="input" value={headerRow} onChange={(e) => { const h = Number(e.target.value); setHeaderRow(h); setMap(detectColumns(raw[h], raw.slice(h + 1, h + 30))); }}>
                {raw.slice(0, 10).map((r, i) => (
                  <option key={i} value={i}>Fila {i + 1}: {r.slice(0, 4).join(" | ").slice(0, 60)}</option>
                ))}
              </select>
            </div>
            <div className="grid gap-2">
              {(Object.keys(COLUMN_LABEL) as (keyof ColumnMap)[]).map((k) => (
                <div key={k} className="flex items-center gap-2">
                  <span className="w-32 shrink-0 text-xs text-muted">{COLUMN_LABEL[k]}</span>
                  <select
                    className="input py-2 text-sm"
                    value={map[k] ?? ""}
                    onChange={(e) => setMap({ ...map, [k]: e.target.value === "" ? null : Number(e.target.value) })}
                  >
                    <option value="">—</option>
                    {header.map((h, i) => (
                      <option key={i} value={i}>{h || `Columna ${i + 1}`} {body[0]?.[i] ? `(${body[0][i].slice(0, 18)})` : ""}</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          </div>
          <div>
            <div className="label">¿Qué contiene el archivo?</div>
            <Segmented
              value={forceType}
              onChange={setForceType}
              options={[
                { value: "auto", label: "Detectar" },
                { value: "expense", label: "Solo gastos" },
                { value: "income", label: "Solo ingresos" },
              ]}
            />
            <p className="mt-1.5 text-xs text-muted">Si en Notion tienes una tabla de gastos y otra de ingresos, importa cada una eligiendo “Solo gastos” o “Solo ingresos”.</p>
          </div>
          <div>
            <label className="label">Cuenta destino (si el archivo no la indica)</label>
            <select className="input" value={accountId} onChange={(e) => setAccountId(e.target.value)}>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>{a.icon} {a.name} ({a.currency === "USD" ? "US$" : "S/"})</option>
              ))}
            </select>
          </div>
          <button className="btn-primary" disabled={map.date === null || (map.amount === null && map.debit === null && map.credit === null) || !accountId} onClick={toPreview}>
            Previsualizar
          </button>
          {!accounts.length && <p className="text-sm text-neg">Primero crea una cuenta.</p>}
        </div>
      )}

      {step === 3 && (
        <div>
          <div className="card grid grid-cols-3 gap-2 p-3 text-center text-xs">
            <div><div className="num text-lg font-bold">{included.length}</div>a importar</div>
            <div><div className="num text-lg font-bold text-warn">{rows.filter((r) => r.duplicate).length}</div>duplicados</div>
            <div><div className="num text-lg font-bold">{uncategorized}</div>sin categoría</div>
          </div>
          {skipped > 0 && <p className="mt-2 px-1 text-xs text-muted">{skipped} filas ignoradas (sin fecha o monto válido).</p>}
          <div className="mt-3 card divide-y divide-line/60">
            {rows.map((r, i) => {
              const opts = r.type === "income" ? incomeCats : expenseCats;
              return (
                <div key={r.index} className={`flex items-center gap-2 px-3 py-2 ${r.include ? "" : "opacity-45"}`}>
                  <button
                    aria-label={r.include ? "Excluir" : "Incluir"}
                    onClick={() => setRows(rows.map((x, j) => (j === i ? { ...x, include: !x.include } : x)))}
                    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md border ${r.include ? "border-brand bg-brand text-brand-ink" : "border-line"}`}
                  >
                    {r.include && <Check size={14} />}
                  </button>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm">{r.description}</div>
                    <div className="flex items-center gap-1 text-[11px] text-muted">
                      {r.date}
                      {r.duplicate && <span className="rounded bg-warn/15 px-1 text-warn">posible duplicado</span>}
                      {r.confidence > 0 && r.confidence < 1 && <span className="text-brand">✨ auto</span>}
                    </div>
                    <select
                      className="mt-1 w-full rounded-lg border border-line bg-surface px-2 py-1 text-xs"
                      value={r.categoryId ?? ""}
                      onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, categoryId: e.target.value || null, confidence: 0 } : x)))}
                    >
                      <option value="">Sin categoría</option>
                      {opts.map((c) => (
                        <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
                      ))}
                    </select>
                  </div>
                  <Money value={r.type === "income" ? r.amount : -r.amount} className={`text-sm font-semibold ${r.type === "income" ? "text-pos" : ""}`} sign={r.type === "income"} />
                </div>
              );
            })}
          </div>
          <div className="pb-safe sticky bottom-20 mt-3 flex gap-2 bg-bg/90 py-2 backdrop-blur">
            <button className="btn-ghost" onClick={() => setStep(2)}>Atrás</button>
            <button className="btn-primary flex-1" disabled={!included.length} onClick={confirm}>
              Importar {included.length} · <Money value={sum} sign />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
