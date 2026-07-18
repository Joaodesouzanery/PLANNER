import { describe, it } from "node:test";
import assert from "node:assert";
import { computeDre, mapCategoryToDreLine } from "./financeDre";

const row = (o: any) => ({
  id: o.id, date: o.date, type: o.type, amount: o.amount, category: o.category ?? null,
  description: "x", sourceId: null, accountId: null, sourceType: "transaction",
  paid: o.paid ?? true, realized: true, projected: false, synthetic: false,
});

// Exemplo do aceite (mês jul/2026).
const rows: any[] = [
  row({ id: "r", date: "2026-07-05", type: "income", amount: 45000 }),
  row({ id: "imp", date: "2026-07-10", type: "expense", amount: 2700, category: "Simples Nacional" }),
  row({ id: "cst", date: "2026-07-10", type: "expense", amount: 8000, category: "Insumos" }),
  row({ id: "op", date: "2026-07-10", type: "expense", amount: 18000, category: "Aluguel" }),
  row({ id: "dep", date: "2026-07-10", type: "expense", amount: 500, category: "Depreciação de equipamentos" }),
  row({ id: "fin", date: "2026-07-10", type: "expense", amount: 300, category: "Juros bancários" }),
];

describe("financeDre — mapeamento categoria → linha", () => {
  it("heurística: Simples→deducao, Insumos→custo, Juros→financeiro, Depreciação→depreciacao, resto→despesa", () => {
    assert.equal(mapCategoryToDreLine("Simples Nacional"), "deducao");
    assert.equal(mapCategoryToDreLine("Insumos"), "custo");
    assert.equal(mapCategoryToDreLine("Juros bancários"), "resultado_financeiro");
    assert.equal(mapCategoryToDreLine("Depreciação de equipamentos"), "depreciacao");
    assert.equal(mapCategoryToDreLine("Aluguel"), "despesa_operacional");
  });
  it("override vence a heurística", () => {
    assert.equal(mapCategoryToDreLine("Aluguel", { Aluguel: "custo" }), "custo");
  });
  it("override do bucket 'Sem categoria' funciona (categoria nula)", () => {
    assert.equal(mapCategoryToDreLine(null, { "Sem categoria": "custo" }), "custo");
    assert.equal(mapCategoryToDreLine(null), "despesa_operacional");
  });
});

describe("financeDre — DRE + EBITDA", () => {
  const d = computeDre(rows, "2026-07-01", "2026-07-31", { taxRate: 6 });
  it("receita líquida = 42.300", () => assert.equal(d.receitaLiquida, 42300));
  it("lucro bruto = 34.300", () => assert.equal(d.lucroBruto, 34300));
  it("EBITDA = 16.300 e margem ≈ 38,5%", () => {
    assert.equal(d.ebitda, 16300);
    assert.equal(Math.round(d.margemEbitda * 1000) / 10, 38.5);
  });
  it("lucro líquido = 15.500 (após D&A 500 e financeiro 300)", () => assert.equal(d.lucroLiquido, 15500));
  it("usa impostos reais (não estima) quando há linha de dedução", () => {
    assert.equal(d.deducoes, 2700);
    assert.equal(d.deducoesEstimada, false);
  });
  it("sem linha de imposto → estima pela alíquota", () => {
    const semImposto = rows.filter((r) => r.id !== "imp");
    const d2 = computeDre(semImposto, "2026-07-01", "2026-07-31", { taxRate: 6 });
    assert.equal(d2.deducoes, 45000 * 0.06);
    assert.equal(d2.deducoesEstimada, true);
  });
});
