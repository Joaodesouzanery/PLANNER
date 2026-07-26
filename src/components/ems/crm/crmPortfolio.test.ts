import { describe, it } from "node:test";
import assert from "node:assert";
import { crmPortfolio, type PortfolioCustomer } from "./crmPortfolio.ts";
import type { NbaItem } from "./buildNextBestActions.ts";

const customers: PortfolioCustomer[] = [
  { id: "iris", nome: "IRIS", recorrente: true, health: "green", ongoing: 2000 },
  { id: "circle", nome: "CIRCLE", recorrente: true, health: "yellow", ongoing: 2000 },
  { id: "conab", nome: "CONAB", recorrente: true, health: "red", ongoing: 1500 },
  { id: "raoni", nome: "RAONI", recorrente: true, health: "green", ongoing: 1500 },
];
const deals = [
  { value: 10000, probability: 40, stage: "proposta" },
  { value: 5000, probability: 80, stage: "proposta" },
  { value: 9999, probability: 100, stage: "ganho" },
];
const nba: NbaItem[] = [
  { id: "es:conab", tipo: "esfriando", severidade: "red", customerId: "conab", customerName: "CONAB", titulo: "..." },
  { id: "fu:1", tipo: "follow_up", severidade: "yellow", customerId: "iris", customerName: "IRIS", titulo: "..." },
  { id: "fu:2", tipo: "follow_up", severidade: "red", customerId: "circle", customerName: "CIRCLE", titulo: "..." },
];

describe("crmPortfolio", () => {
  const p = crmPortfolio(customers, deals, nba);
  it("MRR = Σ ongoing = 7.000", () => assert.equal(p.mrr, 7000));
  it("saúde: 1 em risco, 1 atenção, 2 ativos", () => {
    assert.equal(p.emRisco, 1);
    assert.equal(p.atencao, 1);
    assert.equal(p.ativos, 2);
  });
  it("concentração top-1 ≈ 28,6% (2000/7000)", () => assert.equal(Math.round(p.top1Share * 1000) / 10, 28.6));
  it("deals abertos = 2, forecast ponderado = 8.000", () => {
    assert.equal(p.dealsAbertos, 2);
    assert.equal(p.forecast, 8000);
  });
  it("conta esfriando e follow-ups vencidos da fila NBA", () => {
    assert.equal(p.esfriandoCount, 1);
    assert.equal(p.followUpsVencidos, 2);
  });
});
