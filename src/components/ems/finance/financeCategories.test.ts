import { describe, it } from "node:test";
import assert from "node:assert";
import { canonicalCategory, categoryScope, catalogDreLine, FINANCE_CATEGORIES } from "./financeCategories";

describe("financeCategories — canonicalCategory", () => {
  it("colapsa duplicatas de texto livre via alias (sem acento / caixa)", () => {
    assert.equal(canonicalCategory("Café"), "Comida fora");
    assert.equal(canonicalCategory("cafe"), "Comida fora");
    assert.equal(canonicalCategory("gasolina"), "Transporte");
    assert.equal(canonicalCategory("Gasolina"), "Transporte");
    assert.equal(canonicalCategory("Alimentacao"), "Alimentação (casa)");
    assert.equal(canonicalCategory("Alimentação"), "Alimentação (casa)");
  });

  it("nome do catálogo passa reto (mesmo com acento/caixa diferentes)", () => {
    assert.equal(canonicalCategory("Comida fora"), "Comida fora");
    assert.equal(canonicalCategory("saúde / esporte"), "Saúde / Esporte");
    assert.equal(canonicalCategory("VESTUÁRIO"), "Vestuário");
  });

  it("categoria legada desconhecida passa reto; nulo/vazio vira null", () => {
    assert.equal(canonicalCategory("Algo Bem Específico 123"), "Algo Bem Específico 123");
    assert.equal(canonicalCategory(null), null);
    assert.equal(canonicalCategory(""), null);
    assert.equal(canonicalCategory(undefined), null);
  });
});

describe("financeCategories — escopo e linha DRE", () => {
  it("categoryScope classifica PF × PJ (e null p/ legado)", () => {
    assert.equal(categoryScope("Lazer / Social"), "PF");
    assert.equal(categoryScope("gasolina"), "PF"); // via alias → Transporte
    assert.equal(categoryScope("Infra / COGS"), "PJ");
    assert.equal(categoryScope("supabase"), "PJ"); // via alias → Infra / COGS
    assert.equal(categoryScope("categoria inexistente"), null);
  });

  it("catalogDreLine dá a linha sugerida das categorias PJ", () => {
    assert.equal(catalogDreLine("Infra / COGS"), "custo");
    assert.equal(catalogDreLine("Equipamento"), "depreciacao");
    assert.equal(catalogDreLine("Receita — Cliente"), "receita");
    assert.equal(catalogDreLine("Lazer / Social"), undefined); // PF não tem linha
  });

  it("todo item do catálogo tem name/scope/type", () => {
    for (const c of FINANCE_CATEGORIES) {
      assert.ok(c.name && (c.scope === "PF" || c.scope === "PJ"));
      assert.ok(["income", "expense", "transfer"].includes(c.type));
    }
  });
});
