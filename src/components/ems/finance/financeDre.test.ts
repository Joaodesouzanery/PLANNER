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

describe("financeDre — pró-labore (= Lucro da empresa)", () => {
  it("sem pró-labore: prolabore 0 e lucroEmpresa = lucroLiquido (nada muda)", () => {
    assert.equal(d.prolabore, 0);
    assert.equal(d.lucroEmpresa, d.lucroLiquido);
  });
  it("pró-labore mensal subtrai do lucro líquido", () => {
    const dp = computeDre(rows, "2026-07-01", "2026-07-31", { taxRate: 6, prolabore: 4500 });
    assert.equal(dp.prolabore, 4500);
    assert.equal(dp.lucroEmpresa, 15500 - 4500);
  });
  it("escala pelo nº de meses do período (trimestre = 3× o pró-labore mensal)", () => {
    const dp = computeDre(rows, "2026-07-01", "2026-07-31", { taxRate: 6, prolabore: 4500, periodMonths: 3 });
    assert.equal(dp.prolabore, 13500);
    assert.equal(dp.lucroEmpresa, 15500 - 13500);
  });
  it("pró-labore negativo é pisado em 0", () => {
    const dp = computeDre(rows, "2026-07-01", "2026-07-31", { taxRate: 6, prolabore: -100 });
    assert.equal(dp.prolabore, 0);
  });
  it("pró-labore LANÇADO como despesa não conta 2× (é ignorado nas despesas)", () => {
    const r2 = [
      row({ id: "inc", date: "2026-08-05", type: "income", amount: 10000 }),
      row({ id: "pl", date: "2026-08-10", type: "expense", amount: 4500, category: "Pró-labore" }),
    ];
    const dp = computeDre(r2, "2026-08-01", "2026-08-31", { taxRate: 6, prolabore: 4500 });
    assert.equal(dp.despesaOperacional, 0); // a despesa "Pró-labore" foi ignorada
    assert.equal(dp.lucroLiquido, 10000 - 600); // só a dedução de 6%
    assert.equal(dp.lucroEmpresa, 9400 - 4500); // pró-labore subtraído UMA vez
  });
});

describe("financeDre — dedução com piso da estimativa (não é mais tudo-ou-nada)", () => {
  const inc = (m: string) => row({ id: `i${m}`, date: `2026-${m}-05`, type: "income", amount: 10000 });
  it("imposto lançado parcial → usa o piso da estimativa (6%)", () => {
    const r2 = [inc("07"), row({ id: "imp", date: "2026-07-10", type: "expense", amount: 200, category: "Simples Nacional" })];
    const dp = computeDre(r2, "2026-07-01", "2026-07-31", { taxRate: 6 });
    assert.equal(dp.deducoes, 600); // max(200 lançado, 600 estimado)
    assert.equal(dp.deducoesEstimada, true);
  });
  it("imposto real acima da estimativa → usa o real", () => {
    const r2 = [inc("07"), row({ id: "imp", date: "2026-07-10", type: "expense", amount: 900, category: "Simples Nacional" })];
    const dp = computeDre(r2, "2026-07-01", "2026-07-31", { taxRate: 6 });
    assert.equal(dp.deducoes, 900);
    assert.equal(dp.deducoesEstimada, false);
  });
});

describe("financeDre — receita financeira e D&A", () => {
  it("rendimento (income de juros) não infla receita bruta e vira resultado financeiro positivo", () => {
    const r2 = [
      row({ id: "v", date: "2026-07-05", type: "income", amount: 10000, category: "Vendas" }),
      row({ id: "j", date: "2026-07-06", type: "income", amount: 300, category: "Juros recebidos" }),
    ];
    const dp = computeDre(r2, "2026-07-01", "2026-07-31", { taxRate: 6 });
    assert.equal(dp.receitaBruta, 10000); // rendimento fica fora da receita bruta
    assert.equal(dp.resultadoFinanceiro, 300); // e entra POSITIVO no resultado financeiro
  });
  it("D&A manual escala pelo nº de meses do período", () => {
    const dp = computeDre([row({ id: "i", date: "2026-03-05", type: "income", amount: 5000 })], "2026-01-01", "2026-12-31", { dAndAManual: 100, periodMonths: 3 });
    assert.equal(dp.depreciacaoAmortizacao, 300);
  });
});
