import { describe, it } from "node:test";
import assert from "node:assert";
import { buildBudgetLines, budgetTotals, suggestTetos } from "./financeBudget";

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

describe("financeBudget — suggestTetos (média do histórico)", () => {
  const months = ["2026-04", "2026-05", "2026-06"];
  const samples = [
    { category: "Lazer / Social", amount: 900, month: "2026-04" },
    { category: "Lazer / Social", amount: 900, month: "2026-05" },
    { category: "Lazer / Social", amount: 900, month: "2026-06" },
    { category: "Comida fora", amount: 300, month: "2026-05" }, // só 1 mês → média /3
    { category: "Fora da janela", amount: 5000, month: "2026-01" }, // ignorado (mês fora)
  ];

  it("média dos 3 meses com corte de 5%, arredondado p/ 10", () => {
    const out = suggestTetos(samples, months);
    const lazer = out.find((t) => t.category === "Lazer / Social")!;
    assert.equal(lazer.teto, 860); // 900*0.95=855 → round(85.5)=86 → 860
  });
  it("categoria que só apareceu 1 mês tem a média diluída pela janela", () => {
    const out = suggestTetos(samples, months);
    const comida = out.find((t) => t.category === "Comida fora")!;
    assert.equal(comida.teto, 100); // (300/3)=100 → *0.95=95 → round(9.5)=10 → 100
  });
  it("ignora meses fora da janela e ordena por teto desc", () => {
    const out = suggestTetos(samples, months);
    assert.ok(!out.some((t) => t.category === "Fora da janela"));
    assert.deepEqual(out.map((t) => t.category), ["Lazer / Social", "Comida fora"]);
  });
});
