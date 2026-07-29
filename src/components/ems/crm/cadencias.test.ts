import { describe, it } from "node:test";
import assert from "node:assert";
import { gerarAtividades, isFilaDoDia, type CadenciaPasso } from "./cadencias";

const NOW = "2026-07-27T00:00:00.000Z";

describe("cadencias — gerarAtividades", () => {
  it("gera uma atividade por passo com data = hoje + dia_offset, ordenado", () => {
    const passos: CadenciaPasso[] = [
      { passo_n: 2, canal: "email", dia_offset: 2 },
      { passo_n: 1, canal: "whatsapp", dia_offset: 0 },
      { passo_n: 3, canal: "ligacao", dia_offset: 5 },
    ];
    const out = gerarAtividades("d1", "cad1", passos, NOW);
    assert.equal(out.length, 3);
    assert.deepEqual(out.map((a) => a.passo_n), [1, 2, 3]); // ordenado por passo_n
    assert.equal(out[0].data_prevista, "2026-07-27"); // +0
    assert.equal(out[1].data_prevista, "2026-07-29"); // +2
    assert.equal(out[2].data_prevista, "2026-08-01"); // +5
    assert.equal(out[0].tipo, "whatsapp");
    assert.equal(out[0].status, "pendente");
    assert.equal(out[0].deal_id, "d1");
  });
});

describe("cadencias — isFilaDoDia", () => {
  it("pendente com data <= hoje entra; futura ou feito não", () => {
    assert.equal(isFilaDoDia({ status: "pendente", data_prevista: "2026-07-27" }, NOW), true);
    assert.equal(isFilaDoDia({ status: "pendente", data_prevista: "2026-07-20" }, NOW), true); // atrasada
    assert.equal(isFilaDoDia({ status: "pendente", data_prevista: "2026-07-30" }, NOW), false); // futura
    assert.equal(isFilaDoDia({ status: "feito", data_prevista: "2026-07-27" }, NOW), false); // já feito
    assert.equal(isFilaDoDia({ status: "pendente", data_prevista: null }, NOW), false);
  });
});
