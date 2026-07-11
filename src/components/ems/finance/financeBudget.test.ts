import { describe, it } from "node:test";
import assert from "node:assert";
import { buildBudgetLines, budgetTotals } from "./financeBudget";

describe("financeBudget — orçado × realizado", () => {
  const lines = buildBudgetLines(
    [{ category: "Vestuário", teto: 300 }, { category: "Operacional", teto: 1000 }],
    { Vestuário: 459, Operacional: 800, Esporte: 187 },
  );
  const vest = lines.find((l) => l.category === "Vestuário")!;
  const esp = lines.find((l) => l.category === "Esporte")!;

  it("Vestuário teto 300 com 459 gastos → 153% e estouro", () => {
    assert.equal(Math.round(vest.usoPct * 100), 153);
    assert.equal(vest.saldo, -159);
    assert.equal(vest.estourou, true);
  });
  it("Operacional dentro do teto → não estourou", () => {
    assert.equal(lines.find((l) => l.category === "Operacional")!.estourou, false);
  });
  it("categoria sem teto = não orçada", () => assert.equal(esp.orcada, false));
  it("resumo conta 1 estouro", () => assert.equal(budgetTotals(lines).estouros, 1));
});
