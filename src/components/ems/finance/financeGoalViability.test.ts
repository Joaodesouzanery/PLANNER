import { describe, it } from "node:test";
import assert from "node:assert";
import { goalViability } from "./financeGoalViability";

// Carro: alvo 200.000, atual 5.000, prazo mar/2028, sobra 4.403, hoje jul/2026.
describe("financeGoalViability — carro", () => {
  const v = goalViability(200000, 5000, "2028-03-01", 4403, "2026-07-11");

  it("~20 meses até o prazo", () => assert.equal(v.mesesRestantes, 20));
  it("aporte necessário ≈ R$ 9.750/mês", () => assert.equal(Math.round(v.aporteNecessario), 9750));
  it("inviável no ritmo atual (aporte >> sobra×1,5)", () => assert.equal(v.verdict, "unfeasible"));
  it("progresso no prazo entre 40% e 55%", () => assert.ok(v.progressoNoPrazo > 0.4 && v.progressoNoPrazo < 0.55));
  it("data projetada existe no ritmo da sobra", () => assert.ok(v.dataProjetada && v.dataProjetada > "2026-07"));
});

describe("financeGoalViability — vereditos", () => {
  it("on-track quando o aporte cabe na sobra", () => {
    assert.equal(goalViability(12000, 0, "2027-07-01", 2000, "2026-07-01").verdict, "on-track"); // 1000/mês ≤ 2000
  });
  it("stretch quando cabe até sobra×1,5", () => {
    assert.equal(goalViability(30000, 0, "2027-07-01", 2000, "2026-07-01").verdict, "stretch"); // 2500/mês ≤ 3000
  });
  it("prazo vencido → aporte = tudo agora", () => {
    const v = goalViability(1000, 0, "2026-01-01", 500, "2026-07-01");
    assert.equal(v.mesesRestantes, 0);
    assert.equal(v.aporteNecessario, 1000);
  });
});
