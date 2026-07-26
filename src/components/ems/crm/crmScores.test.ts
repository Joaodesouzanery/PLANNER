import { describe, it } from "node:test";
import assert from "node:assert";
import { scoreCustomer, type ScoreInput } from "./crmScores.ts";

const today = "2026-07-25";

describe("crmScores — scoreCustomer", () => {
  // Cliente saudável, recorrente, engajado e crescendo.
  const conab = scoreCustomer({
    id: "conab", nome: "CONAB", recorrente: true, today,
    ongoing: 1500, monthly: 1500, ltv: 30000, sinceDate: "2025-01-25",
    lastInteraction: "2026-07-20", interactions90d: 3, nextActionDate: null,
    openDeals: 2, openDealsValue: 15000, wonDeals: 1, lostDeals: 0,
    onboardingCompleteness: 1, revenue3m: [1000, 1200, 1500],
  } as ScoreInput);

  it("CONAB: health 100 / green", () => {
    assert.equal(conab.healthScore, 100);
    assert.equal(conab.health, "green");
  });
  it("CONAB: churn 0, engagement 100 (cap), tendência up", () => {
    assert.equal(conab.churnRisk, 0);
    assert.equal(conab.engagement, 100);
    assert.equal(conab.revenueTrend, "up");
  });
  it("CONAB: propensão 100 (cap), tempo de casa 18 meses", () => {
    assert.equal(conab.expansionPropensity, 100);
    assert.equal(conab.tenureMonths, 18);
  });
  it("CONAB: oferta = upsell", () => assert.equal(conab.nextOffer?.tipo, "upsell"));

  // Cliente em risco: recorrência perdida, sumido, follow-up vencido, onboarding pela metade, receita caindo.
  const risco = scoreCustomer({
    id: "risco", nome: "RISCO", recorrente: true, today,
    ongoing: 0, monthly: 0, ltv: 12000, sinceDate: "2026-05-25",
    lastInteraction: "2026-03-27", interactions90d: 0, nextActionDate: "2026-07-01",
    openDeals: 0, wonDeals: 0, lostDeals: 1,
    onboardingCompleteness: 0.5, revenue3m: [2000, 1000, 0],
  } as ScoreInput);

  it("RISCO: health 0 / red", () => {
    assert.equal(risco.healthScore, 0);
    assert.equal(risco.health, "red");
  });
  it("RISCO: churn 90 (30 recência + 15 vencido + 25 recorrência + 20 queda)", () => {
    assert.equal(risco.churnRisk, 90);
  });
  it("RISCO: engagement 0, propensão 0", () => {
    assert.equal(risco.engagement, 0);
    assert.equal(risco.expansionPropensity, 0);
  });
  it("RISCO: oferta = retenção", () => assert.equal(risco.nextOffer?.tipo, "retencao"));

  // Cliente pontual saudável que já fechou negócio → candidato a virar recorrente.
  const pontual = scoreCustomer({
    id: "pont", nome: "PONTUAL", recorrente: false, today,
    ongoing: 0, monthly: 0, ltv: 8000, sinceDate: null,
    lastInteraction: "2026-06-15", interactions90d: 1, nextActionDate: null,
    openDeals: 0, wonDeals: 1, lostDeals: 0,
    onboardingCompleteness: null,
  } as ScoreInput);

  it("PONTUAL: health 90 / green (só -10 de recência 40d)", () => {
    assert.equal(pontual.healthScore, 90);
    assert.equal(pontual.health, "green");
  });
  it("PONTUAL: engagement 30, propensão 37, tendência flat", () => {
    assert.equal(pontual.engagement, 30);
    assert.equal(pontual.expansionPropensity, 37);
    assert.equal(pontual.revenueTrend, "flat");
  });
  it("PONTUAL: oferta = recorrência; tempo de casa null (sem sinceDate)", () => {
    assert.equal(pontual.nextOffer?.tipo, "recorrencia");
    assert.equal(pontual.tenureMonths, null);
  });
});
