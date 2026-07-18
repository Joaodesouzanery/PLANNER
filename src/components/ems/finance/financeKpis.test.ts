import { describe, it } from "node:test";
import assert from "node:assert";
import { computeKpis, type KpiInputs } from "./financeKpis";

const base: KpiInputs = {
  receitaBruta: 45000, receitaLiquida: 42300, margemBruta: 0.81, margemEbitda: 0.385, margemLiquida: 0.366,
  custosFixos: 18000, margemContribuicaoPct: 0.6,
  monthlyIncome: [6000, 6000, 7000, 7500, 8000, 8250, 8250, 8250, 8250, 8250, 8250, 8250, 9000], // 13 meses
  mrr: 7000, mrrPrev: 6500, expansao: 800, churn: 300,
  nClientesRecorrentes: 4, novosClientesMes: 2, custoComercialMes: 1000,
  receitaRecebidaMes: 8250, nEntradasMes: 5, aReceber: 2750, aReceberVencido: 1500,
  saldoDisponivel: 4995, despesaMensal: 3352, runwayMeses: 1.4,
};

describe("financeKpis", () => {
  const k = computeKpis(base);

  it("ARR = MRR × 12 = 84.000", () => assert.equal(k.arr, 84000));
  it("NRR = (6500 + 800 − 300)/6500 ≈ 1.077", () => assert.equal(Math.round(k.nrr! * 1000) / 1000, 1.077));
  it("churn rate = 300/6500 ≈ 4,6%", () => assert.equal(Math.round(k.churnRate! * 1000) / 10, 4.6));
  it("ARPU = 7000/4 = 1.750", () => assert.equal(k.arpu, 1750));
  it("LTV = ARPU / churn rate", () => assert.equal(Math.round(k.ltv!), Math.round(1750 / (300 / 6500))));
  it("CAC = custo comercial / novos clientes = 500", () => assert.equal(k.cac, 500));
  it("LTV/CAC = LTV / 500", () => assert.ok(k.ltvCac! > 1));
  it("crescimento MoM = (9000−8250)/8250 ≈ 9,1%", () => assert.equal(Math.round(k.crescimentoMoM! * 1000) / 10, 9.1));
  it("crescimento YoY = (9000−6000)/6000 = 50%", () => assert.equal(k.crescimentoYoY, 0.5));
  it("ponto de equilíbrio = custos fixos / margem contribuição = 30.000", () => assert.equal(k.pontoEquilibrio, 30000));
  it("DSO = (2750/42300)×30 ≈ 2 dias", () => assert.equal(Math.round(k.dso!), 2));
  it("inadimplência = 1500/(8250+1500) ≈ 15,4%", () => assert.equal(Math.round(k.inadimplencia! * 1000) / 10, 15.4));

  it("CAC null quando não há custo comercial marcado", () => {
    assert.equal(computeKpis({ ...base, custoComercialMes: 0 }).cac, null);
  });
});
