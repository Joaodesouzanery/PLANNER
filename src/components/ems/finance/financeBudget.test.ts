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

describe("financeBudget — balde planejado (compra futura)", () => {
  const lines = buildBudgetLines(
    [{ category: "Equip", teto: 5000 }],
    { Equip: 1000 }, // realizado (pago)
    { Equip: 6000 }, // planejado (compra futura injetada)
  );
  const l = lines.find((x) => x.category === "Equip")!;
  it("comprometido = realizado + planejado", () => assert.equal(l.comprometido, 7000));
  it("comprometido % do teto = 140%", () => assert.equal(Math.round(l.comprometidoPct * 100), 140));
  it("realizado/estourou não muda com planejado (aditivo)", () => {
    assert.equal(l.realizado, 1000);
    assert.equal(l.estourou, false); // realizado 1000 < teto 5000
  });
});
