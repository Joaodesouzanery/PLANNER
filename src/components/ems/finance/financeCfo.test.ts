import { describe, it } from "node:test";
import assert from "node:assert";
import { computeCfo } from "./financeCfo";

const settings = { tax_rate: 6, reserve_months: 6, cdi_monthly_liquid: 0.9 };
const TODAY = "2026-07-11";

// Fase 0 — despesa esperada em 3 baldes.
describe("financeCfo — despesa em 3 baldes", () => {
  const m = computeCfo([], settings, 0, TODAY, { income: 8250, expense: 3870, fixo: 1100, variavel: 2270, anual: 500 });

  it("burn = fixo + variável (não conta o balde anual)", () => assert.equal(m.burnMensal, 3370));
  it("reserva-alvo = reserve_months × burn", () => assert.equal(m.reservaAlvo, 20220));
  it("despesa mensal = total dos 3 baldes", () => assert.equal(m.despesaMensal, 3870));
  it("sobra = receita líquida − despesa total (8250 − 495 imposto − 3870)", () =>
    assert.equal(Math.round(m.sobraMensal), 3885));

  it("sem baldes → burn cai para a despesa total (compat)", () => {
    const m2 = computeCfo([], settings, 0, TODAY, { income: 8250, expense: 3352 });
    assert.equal(m2.burnMensal, 3352);
  });
});
