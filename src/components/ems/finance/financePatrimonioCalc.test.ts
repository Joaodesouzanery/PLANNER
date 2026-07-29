import { describe, it } from "node:test";
import assert from "node:assert";
import { computeNetWorth, investimentosPrincipal } from "./financePatrimonioCalc";

describe("financePatrimonioCalc — computeNetWorth", () => {
  it("compõe ativos/passivos/PL", () => {
    const r = computeNetWorth({ caixa: 1000, investimentos: 500, ativosManuais: 200, passivosAuto: 300, passivosManuais: 100 });
    assert.equal(r.ativos, 1700);
    assert.equal(r.passivos, 400);
    assert.equal(r.patrimonioLiquido, 1300);
  });

  it("sem investimentos nem itens = caixa − passivos (não regride)", () => {
    const r = computeNetWorth({ caixa: 800, investimentos: 0, ativosManuais: 0, passivosAuto: 0, passivosManuais: 0 });
    assert.equal(r.ativos, 800);
    assert.equal(r.patrimonioLiquido, 800);
  });

  it("PL pode ficar negativo", () => {
    const r = computeNetWorth({ caixa: 100, investimentos: 0, ativosManuais: 0, passivosAuto: 500, passivosManuais: 0 });
    assert.equal(r.patrimonioLiquido, -400);
  });
});

describe("financePatrimonioCalc — investimentosPrincipal", () => {
  it("soma opening_balance só de savings/investment", () => {
    const accounts = [
      { account_type: "checking", opening_balance: 9999 }, // ignorado (líquido, já no caixa)
      { account_type: "savings", opening_balance: 1000 },
      { account_type: "investment", opening_balance: "2500" }, // string coage p/ número
      { account_type: "credit_card", opening_balance: -300 }, // ignorado
    ];
    assert.equal(investimentosPrincipal(accounts), 3500);
  });

  it("opening ausente conta 0 (não quebra)", () => {
    assert.equal(investimentosPrincipal([{ account_type: "investment" }, { account_type: "savings", opening_balance: null }]), 0);
  });
});
