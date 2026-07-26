import { describe, it } from "node:test";
import assert from "node:assert";
import { resolveSegment, campaignPerformance, groupCount, type SegCustomer } from "./crmCampaigns";

const customers: SegCustomer[] = [
  { id: "a", health: "red", tier: "A", segment: "SaaS", recorrente: true, ongoing: 1000 },
  { id: "b", health: "green", tier: "B", segment: "Consultoria", recorrente: true, ongoing: 500 },
  { id: "c", health: "red", tier: "A", segment: "Agro", recorrente: false, ongoing: 0 },
];

describe("crmCampaigns — resolveSegment", () => {
  it("filtro composto (red + recorrente + minMrr 100) → só 'a'", () => {
    assert.deepEqual(resolveSegment(customers, { health: ["red"], recorrente: true, minMrr: 100 }), ["a"]);
  });
  it("filtro por tier A → 'a' e 'c'", () => {
    assert.deepEqual(resolveSegment(customers, { tier: ["A"] }), ["a", "c"]);
  });
  it("sem filtro → todos", () => {
    assert.deepEqual(resolveSegment(customers, {}), ["a", "b", "c"]);
  });
  it("arrays vazios são ignorados (não filtram)", () => {
    assert.deepEqual(resolveSegment(customers, { health: [], tier: [] }), ["a", "b", "c"]);
  });
});

describe("crmCampaigns — campaignPerformance", () => {
  const p = campaignPerformance([
    { offer_status: "sent", predicted_revenue: 1000 },
    { offer_status: "opened", predicted_revenue: 2000 },
    { offer_status: "responded", predicted_revenue: 3000 },
    { offer_status: "converted", predicted_revenue: 4000 },
    { offer_status: "pending", predicted_revenue: 500 },
  ]);
  it("funil: 4 enviados, 3 abertos, 2 responderam, 1 converteu", () => {
    assert.equal(p.enviados, 4);
    assert.equal(p.abertos, 3);
    assert.equal(p.responderam, 2);
    assert.equal(p.converteram, 1);
  });
  it("taxas: resposta 0.5, conversão 0.25", () => {
    assert.equal(p.taxaResposta, 0.5);
    assert.equal(p.taxaConversao, 0.25);
  });
  it("receita: projetada 10500, realizada 4000 (só convertidos)", () => {
    assert.equal(p.receitaProjetada, 10500);
    assert.equal(p.receitaRealizada, 4000);
  });
  it("porStatus conta cada faixa", () => {
    assert.equal(p.porStatus.pending, 1);
    assert.equal(p.porStatus.converted, 1);
  });
});

describe("crmCampaigns — groupCount", () => {
  it("agrupa por chave desc", () => {
    assert.deepEqual(groupCount(customers, (c) => c.tier), [{ label: "A", value: 2 }, { label: "B", value: 1 }]);
  });
  it("vazio vira '—'", () => {
    assert.deepEqual(groupCount([{ tier: null }, { tier: "A" }], (x) => x.tier), [{ label: "—", value: 1 }, { label: "A", value: 1 }]);
  });
});
