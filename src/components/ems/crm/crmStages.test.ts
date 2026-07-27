import { describe, it } from "node:test";
import assert from "node:assert";
import { resolveStageKey, DEFAULT_STAGES, slugifyStage } from "./crmStages";

describe("crmStages — resolveStageKey", () => {
  it("mantém uma key que já existe", () => {
    assert.equal(resolveStageKey("documento", DEFAULT_STAGES), "documento");
  });

  it("mapeia vocabulário legado do DealKanban antigo", () => {
    assert.equal(resolveStageKey("nova", DEFAULT_STAGES), "lista");
    assert.equal(resolveStageKey("qualificacao", DEFAULT_STAGES), "qualificado");
    assert.equal(resolveStageKey("proposta", DEFAULT_STAGES), "fechamento");
    assert.equal(resolveStageKey("negociacao", DEFAULT_STAGES), "fechamento");
    assert.equal(resolveStageKey("ganha", DEFAULT_STAGES), "cliente");
    assert.equal(resolveStageKey("ganho", DEFAULT_STAGES), "cliente");
    assert.equal(resolveStageKey("perdida", DEFAULT_STAGES), "perdido");
  });

  it("é case-insensitive e ignora espaços", () => {
    assert.equal(resolveStageKey("  GANHA ", DEFAULT_STAGES), "cliente");
  });

  it("cai na primeira etapa da esteira quando desconhecido ou vazio", () => {
    assert.equal(resolveStageKey("xpto-inexistente", DEFAULT_STAGES), "lista");
    assert.equal(resolveStageKey(null, DEFAULT_STAGES), "lista");
    assert.equal(resolveStageKey("", DEFAULT_STAGES), "lista");
  });

  it("não retorna uma key inexistente na lista custom (mapeada mas ausente → primeira)", () => {
    const custom = [
      { key: "novo-lead", title: "Novo lead", order_index: 0, color: "", outcome: null, is_offtrack: false },
      { key: "ganhou", title: "Ganhou", order_index: 1, color: "", outcome: "won" as const, is_offtrack: false },
    ];
    // "ganha" mapeia p/ "cliente", que NÃO existe aqui → primeira on-track
    assert.equal(resolveStageKey("ganha", custom), "novo-lead");
    assert.equal(resolveStageKey("ganhou", custom), "ganhou");
  });
});

describe("crmStages — slugifyStage", () => {
  it("gera slug ASCII estável", () => {
    assert.equal(slugifyStage("Pré-contato"), "pre-contato");
    assert.equal(slugifyStage("Em Fechamento!"), "em-fechamento");
    assert.equal(slugifyStage("   "), "etapa");
  });
});
