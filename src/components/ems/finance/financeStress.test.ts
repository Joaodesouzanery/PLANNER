import { describe, it } from "node:test";
import assert from "node:assert";
import { runwayShock, stressScenario } from "./financeStress";
import type { CfoMetrics } from "./financeCfo";

const cfo = (over: Partial<CfoMetrics> = {}): CfoMetrics => ({
  saldoDisponivel: 9400, saldoLiquidoImposto: 9400, faturamentoMensal: 8250, despesaMensal: 3352,
  impostoMensal: 495, receitaLiquida: 7755, sobraMensal: 4403, taxaPoupanca: 0.57, burnMensal: 3352,
  runwayMeses: 2.8, impostoARecolher: 0, reservaAlvo: 20112, reservaAtual: 0, reservaPct: 0,
  aReceberVencido: 0, aReceberVencidoRows: [], ...over,
});

const row = (o: any) => ({
  id: o.id, date: o.date, type: o.type, amount: o.amount, category: null, description: "x",
  sourceId: null, accountId: null, sourceType: "transaction", paid: o.paid ?? true, realized: true, projected: false, synthetic: false,
});

const settings = { tax_rate: 6, reserve_months: 6, cdi_monthly_liquid: 0.9 };
const TODAY = "2026-07-11";

describe("financeStress — runwayShock", () => {
  it("sobra positiva e sem déficit → fôlego infinito", () => assert.equal(runwayShock(cfo(), 0), Infinity));
  it("perda maior que a sobra → fôlego finito = saldo líq / déficit", () => {
    const r = runwayShock(cfo(), 6000); // déficit 6000−4403 = 1597
    assert.equal(Math.round(r * 10) / 10, Math.round((9400 / 1597) * 10) / 10);
    assert.ok(r > 0 && r !== Infinity);
  });
});

describe("financeStress — cenário renda −70%", () => {
  const rows: any[] = [row({ id: "op", date: "2026-06-20", type: "income", amount: 10000 })];
  const expected = { income: 8250, expense: 3352, fixo: 1100, variavel: 2252, anual: 0 };
  const s = stressScenario(rows, expected, settings, 0, TODAY, { rendaPct: 0.7 });

  it("perda de renda = 70% de 8.250 = 5.775", () => assert.equal(s.perdaRendaMensal, 5775));
  it("sobra base positiva vira negativa no choque", () => {
    assert.ok(s.sobraBase > 0);
    assert.ok(s.sobraChoque < 0);
  });
  it("runway base infinito, choque finito", () => {
    assert.equal(s.runwayBase, Infinity);
    assert.ok(s.runwayChoque !== Infinity && s.runwayChoque > 0);
  });
  it("veredito não é 'aguenta'", () => assert.notEqual(s.veredito, "aguenta"));
});
