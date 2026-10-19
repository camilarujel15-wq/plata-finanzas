import { describe, expect, it } from "vitest";
import Papa from "papaparse";
import { buildRows, detectColumns, findHeaderRow, parseLooseDate, parseSignedAmount } from "./detect";
import { seedCategories } from "../domain/defaults";

const cats = seedCategories();

describe("import", () => {
  it("fechas y montos sueltos", () => {
    expect(parseLooseDate("05/10/2026")).toBe("2026-10-05");
    expect(parseLooseDate("October 5, 2026")).toBe("2026-10-05");
    expect(parseLooseDate("5 de octubre de 2026")).toBe("2026-10-05");
    expect(parseSignedAmount("S/ -1,234.50")).toBe(-123450);
    expect(parseSignedAmount("(18.50)")).toBe(-1850);
    expect(parseSignedAmount("1.234,50")).toBe(123450);
  });

  it("extracto bancario con título y columnas cargo/abono", () => {
    const csv = `Movimientos de cuenta 191-xxxx
Fecha,Descripción operación,Cargo,Abono,Saldo
02/10/2026,COMPRA POS PLAZA VEA 0123,85.40,,1200.00
03/10/2026,PAGO DE HABERES EMPRESA SAC,,3500.00,4700.00
04/10/2026,NETFLIX.COM,44.90,,4655.10`;
    const rows = Papa.parse<string[]>(csv, { skipEmptyLines: true }).data;
    const h = findHeaderRow(rows);
    expect(h).toBe(1);
    const map = detectColumns(rows[h], rows.slice(h + 1));
    expect(map).toMatchObject({ date: 0, description: 1, debit: 2, credit: 3 });
    const out = buildRows(rows.slice(h + 1), map, { categories: cats, rules: [], existing: [] });
    expect(out.rows.map((r) => [r.type, r.amount, cats.find((c) => c.id === r.categoryId)?.key])).toEqual([
      ["expense", 8540, "food"],
      ["income", 350000, "salary"],
      ["expense", 4490, "subscriptions"],
    ]);
  });

  it("exportación de Notion con categoría y tipo", () => {
    const csv = `Name,Monto,Categoría,Fecha,Tipo
Almuerzo,18,Alimentación,"October 5, 2026",Gasto
Sueldo,3500,Sueldo,"October 1, 2026",Ingreso`;
    const rows = Papa.parse<string[]>(csv, { skipEmptyLines: true }).data;
    const map = detectColumns(rows[0], rows.slice(1));
    const out = buildRows(rows.slice(1), map, { categories: cats, rules: [], existing: [] });
    expect(out.rows[0]).toMatchObject({ type: "expense", amount: 1800, confidence: 1, date: "2026-10-05" });
    expect(out.rows[1]).toMatchObject({ type: "income", amount: 350000 });
  });
});
