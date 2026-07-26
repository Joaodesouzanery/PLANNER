import { describe, it } from "node:test";
import assert from "node:assert";
import { buildCustomer360, diasSemContato, CLOSED_STAGES, type CustomerSpine } from "./crm360.ts";

const spine: CustomerSpine = { id: "conab", nome: "CONAB", recorrente: true, stage: "ativo", health: "green" };

const contacts = [
  { id: "c1", name: "João (CONAB)", customer_id: "conab" },
  { id: "c2", name: "Maria (CONAB)", customer_id: "conab" },
  { id: "c3", name: "Outro", customer_id: "outro" }, // não é do CONAB
];
const deals = [
  { id: "d1", title: "Expansão", value: 10000, probability: 40, stage: "proposta", customer_id: "conab" },
  { id: "d2", title: "Upsell", value: 5000, probability: 80, stage: "proposta", customer_id: "conab" },
  { id: "d3", title: "Ganho", value: 9999, probability: 100, stage: "ganho", customer_id: "conab" }, // fechado
  { id: "d4", title: "De outro", value: 1, probability: 50, stage: "novo", customer_id: "outro" },
];
const routines = [{ id: "r1", name: "CONAB mensal", customer_id: "conab" }, { id: "r2", name: "Outra", customer_id: "outro" }];
const interactions = [
  { id: "i1", contact_id: "c1", type: "call", description: "liguei", date: "2026-07-10" },
  { id: "i2", contact_id: "c2", type: "meeting", description: "reunião", date: "2026-07-20" },
  { id: "i3", contact_id: "c3", type: "call", description: "outro cliente", date: "2026-07-22" },
];

describe("crm360 — buildCustomer360", () => {
  const c = buildCustomer360(spine, { monthly: 1500, ongoing: 1500 }, contacts, deals, routines, interactions);

  it("filtra contatos do cliente (2)", () => assert.equal(c.contatos.length, 2));
  it("filtra deals do cliente (3, sendo 2 abertos)", () => {
    assert.equal(c.deals.length, 3);
    assert.equal(c.dealsAbertos, 2);
  });
  it("forecast ponderado só dos abertos = 10000×0.4 + 5000×0.8 = 8000", () => assert.equal(c.forecastPonderado, 8000));
  it("interações só dos contatos do cliente, desc por data (última = 20/07)", () => {
    assert.equal(c.interacoes.length, 2);
    assert.equal(c.ultimaInteracao, "2026-07-20");
  });
  it("rotinas do cliente (1)", () => assert.equal(c.rotinas.length, 1));
  it("dias sem contato", () => assert.equal(diasSemContato(c, "2026-07-25"), 5));
});

describe("crm360 — vocabulário de fechado (ganha/perdida do modal de Projetos)", () => {
  it("CLOSED_STAGES cobre ganha/ganho/perdida/perdido", () => {
    for (const s of ["ganha", "ganho", "perdida", "perdido", "won", "lost"]) assert.ok(CLOSED_STAGES.has(s), s);
  });
  it("deal 'ganha' (grafia de Projetos) NÃO conta como aberto", () => {
    const d = buildCustomer360(spine, { monthly: 0, ongoing: 0 }, [], [
      { id: "x", title: "Fechado em Projetos", value: 5000, probability: 100, stage: "ganha", customer_id: "conab" },
      { id: "y", title: "Aberto", value: 4000, probability: 50, stage: "proposta", customer_id: "conab" },
    ], [], []);
    assert.equal(d.dealsAbertos, 1);
    assert.equal(d.forecastPonderado, 2000); // só o aberto: 4000×0.5
  });
});
