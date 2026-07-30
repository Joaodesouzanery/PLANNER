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

describe("financeCfo — imposto a recolher (regex do 'das')", () => {
  const row = (o: any): any => ({
    id: o.id, date: o.date, type: o.type, amount: o.amount, category: o.category ?? null,
    description: o.description ?? "x", sourceId: null, accountId: null, sourceType: "transaction",
    paid: true, realized: true, projected: false, synthetic: false,
  });
  const exp = { income: 0, expense: 0 };

  it("'das' minúsculo (contração) NÃO conta como imposto pago", () => {
    const rows = [
      row({ id: "inc", type: "income", amount: 10000, date: "2026-07-01" }),
      row({ id: "luz", type: "expense", amount: 500, date: "2026-07-02", description: "Conta de luz das lojas" }),
    ];
    const m = computeCfo(rows, settings, 0, TODAY, exp);
    // imposto a recolher = 10000*6% − 0 (a despesa "das lojas" não é imposto) = 600
    assert.equal(m.impostoARecolher, 600);
  });

  it("acrônimo DAS em maiúsculas conta como imposto pago", () => {
    const rows = [
      row({ id: "inc", type: "income", amount: 10000, date: "2026-07-01" }),
      row({ id: "das", type: "expense", amount: 400, date: "2026-07-03", category: "Contador / Fiscal", description: "DAS 07/2026" }),
    ];
    const m = computeCfo(rows, settings, 0, TODAY, exp);
    assert.equal(m.impostoARecolher, 200); // 600 devido − 400 pago
  });
});
