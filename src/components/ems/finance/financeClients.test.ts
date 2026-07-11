import { describe, it } from "node:test";
import assert from "node:assert";
import { clientConcentration, impactoSeSair, type ClientRevenue } from "./financeClients";

// Fase 1 — dados atuais: Σ run-rate = 8.250; Compizzo é pontual (não conta pro MRR).
const clients: ClientRevenue[] = [
  { id: "iris", nome: "IRIS", recorrente: true, monthly: 2000, ongoing: 2000 },
  { id: "circle", nome: "CIRCLE", recorrente: true, monthly: 2000, ongoing: 2000 },
  { id: "conab", nome: "CONAB", recorrente: true, monthly: 1500, ongoing: 1500 },
  { id: "raoni", nome: "RAONI", recorrente: true, monthly: 1500, ongoing: 1500 },
  { id: "compizzo", nome: "Compizzo", recorrente: false, monthly: 1250, ongoing: 0 },
];

describe("financeClients — concentração", () => {
  const c = clientConcentration(clients);
  it("receita total = 8.250", () => assert.equal(c.total, 8250));
  it("maior cliente ≈ 24%", () => assert.equal(Number(c.top1Share.toFixed(3)), 0.242));
  it("top-2 ≈ 48%", () => assert.equal(Number(c.top2Share.toFixed(3)), 0.485));
  it("ordena do maior pro menor (IRIS/CIRCLE no topo)", () => assert.equal(c.ranked[0].monthly, 2000));
  it("HHI entre 0 e 1", () => assert.ok(c.hhi > 0 && c.hhi < 1));
});

describe("financeClients — impacto se o maior cliente sair", () => {
  // MRR = ongoing total = 7.000 (sem Compizzo). Sobra 4.403, saldo líq 4.665.
  it("MRR cai de 7.000 para 5.000 se IRIS (2.000) sair", () => {
    const imp = impactoSeSair(2000, 7000, 4403, 4665);
    assert.equal(imp.mrrPos, 5000);
    assert.equal(imp.novaSobra, 2403); // ainda positiva → sem queima de reserva
    assert.equal(imp.runwaySeSair, Infinity);
  });
});
