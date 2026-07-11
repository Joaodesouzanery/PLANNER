import { describe, it } from "node:test";
import assert from "node:assert";
import { buildAlerts } from "./financeAlerts";
import type { CfoMetrics } from "./financeCfo";

const baseCfo = (over: Partial<CfoMetrics> = {}): CfoMetrics => ({
  saldoDisponivel: 4995, saldoLiquidoImposto: 4665, faturamentoMensal: 8250, despesaMensal: 3352,
  impostoMensal: 495, receitaLiquida: 7755, sobraMensal: 4403, taxaPoupanca: 0.57, burnMensal: 3352,
  runwayMeses: 1.4, impostoARecolher: 330, reservaAlvo: 20112, reservaAtual: 0, reservaPct: 0,
  aReceberVencido: 1500, aReceberVencidoRows: [{ id: "conab", description: "Pagamento CONAB", amount: 1500, date: "2026-07-10", type: "income", paid: false } as any],
  ...over,
});

describe("financeAlerts", () => {
  const alerts = buildAlerts({ cfo: baseCfo(), reservaAlvo: 20112 });
  const keys = alerts.map((a) => a.key);

  it("dispara CONAB vencido (high)", () => {
    const a = alerts.find((x) => x.key === "receber:conab");
    assert.ok(a && a.severity === "high");
  });
  it("dispara reserva abaixo do alvo", () => assert.ok(keys.includes("reserva:baixa")));
  it("ordena por severidade (high primeiro)", () => assert.equal(alerts[0].severity, "high"));
  it("sem duplicados", () => assert.equal(keys.length, new Set(keys).size));

  it("ao quitar o CONAB (sem vencidos), o alerta some", () => {
    const a2 = buildAlerts({ cfo: baseCfo({ aReceberVencido: 0, aReceberVencidoRows: [] }), reservaAlvo: 20112 });
    assert.equal(a2.find((x) => x.key.startsWith("receber:")), undefined);
  });

  it("orçamento estourado e concentração alta viram alerta", () => {
    const a3 = buildAlerts({ cfo: baseCfo({ aReceberVencidoRows: [] }), reservaAlvo: 20112, budgetEstouros: [{ category: "Vestuário", saldo: -159 }], concentracaoTop1: 0.48 });
    assert.ok(a3.some((x) => x.key === "orcamento:Vestuário"));
    assert.ok(a3.some((x) => x.key === "concentracao:alta"));
  });
});
