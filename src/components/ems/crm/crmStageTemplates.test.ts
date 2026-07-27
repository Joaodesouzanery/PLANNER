import { describe, it } from "node:test";
import assert from "node:assert";
import { suggestTemplate, STAGE_TEMPLATES, DEFAULT_TEMPLATE_KEY } from "./crmStageTemplates";

describe("crmStageTemplates — suggestTemplate", () => {
  it("cai no funil padrão sem segmento", () => {
    assert.equal(suggestTemplate(undefined).key, DEFAULT_TEMPLATE_KEY);
    assert.equal(suggestTemplate("").key, DEFAULT_TEMPLATE_KEY);
    assert.equal(suggestTemplate("segmento-desconhecido").key, DEFAULT_TEMPLATE_KEY);
  });

  it("sugere por segmento (inclui substring nos dois sentidos)", () => {
    assert.equal(suggestTemplate("consultoria").key, "consultoria");
    assert.equal(suggestTemplate("SaaS").key, "saas");
    assert.equal(suggestTemplate("agronegócio").key, "agro-obra"); // seg inclui a hint "agro"
    assert.equal(suggestTemplate("construção").key, "agro-obra");
  });

  it("todo template tem keys únicas e order_index sequencial", () => {
    for (const t of STAGE_TEMPLATES) {
      const keys = t.stages.map((s) => s.key);
      assert.equal(new Set(keys).size, keys.length, `keys duplicadas em ${t.key}`);
      t.stages.forEach((s, i) => assert.equal(s.order_index, i, `order_index fora de sequência em ${t.key}`));
      assert.ok(t.stages.some((s) => s.outcome === "won"), `${t.key} sem etapa de ganho`);
    }
  });
});
