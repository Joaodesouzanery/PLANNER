import { describe, it } from "node:test";
import assert from "node:assert";
import { computeExpansao, type ExpansaoDeal, type ExpansaoModulo, type ExpansaoCliente } from "./expansaoBoard";

const modulos: ExpansaoModulo[] = [
  { id: "med", name: "Medição", tipo: "aquisicao" },
  { id: "equip", name: "Equipamentos", tipo: "aquisicao" },
  { id: "fin", name: "Financeiro", tipo: "aquisicao" },
  { id: "eco", name: "Economia", tipo: "retencao" },
];
const clientes: ExpansaoCliente[] = [
  { id: "c1", nome: "IRIS" },
  { id: "c2", nome: "CIRCLE" },
  { id: "c3", nome: "CONAB" }, // sem deal ganho
];

describe("expansaoBoard — computeExpansao", () => {
  it("lista contas landed com ativos/abertos e ordena por prova", () => {
    const deals: ExpansaoDeal[] = [
      { customer_id: "c1", modulo_id: "med", status_outcome: "won" }, // IRIS ganhou Medição
      { customer_id: "c1", modulo_id: "equip", status_outcome: "won" }, // + Equipamentos → prova 2
      { customer_id: "c2", modulo_id: "med", status_outcome: "won" }, // CIRCLE só Medição → prova 1
      { customer_id: "c2", modulo_id: "fin", status_outcome: "lost" }, // perdido não conta
      { customer_id: "c3", modulo_id: "med", status_outcome: null }, // aberto, não ganho → não landed
    ];
    const rows = computeExpansao(clientes, deals, modulos);
    assert.equal(rows.length, 2); // c3 fora (não landed)
    // c1 primeiro (prova 2)
    assert.equal(rows[0].cliente.id, "c1");
    assert.equal(rows[0].provaScore, 2);
    assert.deepEqual(rows[0].abertos.map((m) => m.id), ["fin"]); // só Financeiro aberto
    // c2 depois (prova 1), abertos = equip + fin
    assert.equal(rows[1].cliente.id, "c2");
    assert.equal(rows[1].provaScore, 1);
    assert.deepEqual(rows[1].abertos.map((m) => m.id).sort(), ["equip", "fin"]);
  });

  it("só ganhar módulo de retenção não conta como landed", () => {
    const deals: ExpansaoDeal[] = [{ customer_id: "c1", modulo_id: "eco", status_outcome: "won" }];
    assert.equal(computeExpansao(clientes, deals, modulos).length, 0);
  });

  it("sem módulos de aquisição → vazio", () => {
    assert.equal(computeExpansao(clientes, [], [{ id: "eco", name: "Economia", tipo: "retencao" }]).length, 0);
  });
});
