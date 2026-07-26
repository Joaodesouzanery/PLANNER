import { describe, it } from "node:test";
import assert from "node:assert";
import { towerKpis, towerGroups, type TowerCustomer } from "./crmTower.ts";

const today = "2026-07-25";
const rows: TowerCustomer[] = [
  { id: "a", nome: "A", segment: "SaaS", tier: "A", stage: "active", health: "green", healthScore: 90, churnRisk: 10, recencyDias: 10, recorrente: true, ongoing: 2000, nextActionDate: "2026-07-28", priority: "high" },   // prox SLA (3d)
  { id: "b", nome: "B", segment: "SaaS", tier: "B", stage: "active", health: "yellow", healthScore: 55, churnRisk: 50, recencyDias: 50, recorrente: true, ongoing: 1000, nextActionDate: "2026-07-20", priority: "medium" }, // fora do SLA
  { id: "c", nome: "C", segment: "Agro", tier: "A", stage: "risk", health: "red", healthScore: 20, churnRisk: 90, recencyDias: 120, recorrente: true, ongoing: 1500, nextActionDate: null, priority: "high" },
  { id: "d", nome: "D", segment: "Consultoria", tier: "C", stage: "active", health: "green", healthScore: 85, churnRisk: 5, recencyDias: null, recorrente: false, ongoing: 500, nextActionDate: null, priority: "low" },
];

describe("crmTower — towerKpis", () => {
  const k = towerKpis(rows, today);
  it("carteira: total 4, MRR 5000, 1 risco / 1 atenção / 2 ativos", () => {
    assert.equal(k.total, 4);
    assert.equal(k.mrr, 5000);
    assert.equal(k.emRisco, 1);
    assert.equal(k.atencao, 1);
    assert.equal(k.ativos, 2);
  });
  it("SLA: 2 com próxima ação, 1 fora, 1 vencendo → adherence 0.5", () => {
    assert.equal(k.comProximaAcao, 2);
    assert.equal(k.foraSla, 1);
    assert.equal(k.proxSla, 1);
    assert.equal(k.slaAdherence, 0.5);
  });
  it("resposta média = (10+50+120)/3 = 60 (D null ignorado)", () => assert.equal(k.avgResponseDias, 60));
  it("MRR em risco = 1500 (só o crítico C)", () => assert.equal(k.mrrEmRisco, 1500));
  it("churn risk médio dos recorrentes (10+50+90)/3 = 50", () => assert.equal(k.churnRiskMedio, 50));
  it("prioridade alta = 2 (A e C)", () => assert.equal(k.prioridadeAlta, 2));
});

describe("crmTower — towerGroups", () => {
  const g = towerGroups(rows, "segment", today);
  it("3 grupos, ordenados por MRR desc (SaaS 3000, Agro 1500, Consultoria 500)", () => {
    assert.equal(g.length, 3);
    assert.deepEqual(g.map((x) => x.chave), ["SaaS", "Agro", "Consultoria"]);
    assert.equal(g[0].mrr, 3000);
  });
  it("SaaS: 2 clientes, 1 fora do SLA, adherence 0.5, avgHealth 73 (round de 72.5)", () => {
    assert.equal(g[0].count, 2);
    assert.equal(g[0].foraSla, 1);
    assert.equal(g[0].slaAdherence, 0.5);
    assert.equal(g[0].avgHealth, 73);
  });
  it("Agro: 1 em risco, sem próxima ação → adherence 1 (default)", () => {
    const agro = g.find((x) => x.chave === "Agro")!;
    assert.equal(agro.emRisco, 1);
    assert.equal(agro.comProximaAcao, 0);
    assert.equal(agro.slaAdherence, 1);
  });
});
