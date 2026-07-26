import { describe, it } from "node:test";
import assert from "node:assert";
import { activeIncomeContracts, mrrHeadline, recurringTotal, mrrDeltas, type RecurringTx } from "./financeMrr";

// Recorrentes de entrada; Compizzo tem prazo (2ª parcela) → não conta no MRR.
const txns: RecurringTx[] = [
  { id: "conab", amount: 1500, type: "income", is_recurring: true, recurrence_interval: "monthly", recurrence_end_date: null, date: "2026-01-10" },
  { id: "raoni", amount: 1500, type: "income", is_recurring: true, recurrence_interval: "monthly", recurrence_end_date: null, date: "2026-01-10" },
  { id: "iris", amount: 2000, type: "income", is_recurring: true, recurrence_interval: "monthly", recurrence_end_date: null, date: "2026-02-08" },
  { id: "circle", amount: 2000, type: "income", is_recurring: true, recurrence_interval: "monthly", recurrence_end_date: null, date: "2026-03-01" },
  { id: "compizzo", amount: 1250, type: "income", is_recurring: true, recurrence_interval: "monthly", recurrence_end_date: "2026-08-31", date: "2026-07-17" },
  { id: "gasto", amount: 800, type: "expense", is_recurring: true, recurrence_interval: "monthly", recurrence_end_date: null, date: "2026-07-11" },
];

describe("financeMrr", () => {
  const cur = activeIncomeContracts(txns, "2026-07");
  it("MRR verdadeiro = recorrentes sem prazo = 7.000 (exclui Compizzo)", () => assert.equal(mrrHeadline(cur), 7000));
  it("receita recorrente total do mês = 8.250 (Compizzo ainda ativo)", () => assert.equal(recurringTotal(cur), 8250));
  it("ignora despesas", () => assert.equal(cur.find((c) => c.id === "gasto"), undefined));

  it("progresso das metas: 7.000/10.000 = 70%, 7.000/50.000 = 14%", () => {
    assert.equal(Math.round((7000 / 10000) * 100), 70);
    assert.equal(Math.round((7000 / 50000) * 100), 14);
  });

  it("churn: desativar um contrato de 1.500 → MRR líquido −1.500", () => {
    const d = mrrDeltas([{ id: "x", monthly: 1500 }], []);
    assert.equal(d.churn, 1500);
    assert.equal(d.liquido, -1500);
  });
  it("novos: contrato novo de 2.000 → líquido +2.000", () => {
    const d = mrrDeltas([], [{ id: "y", monthly: 2000 }]);
    assert.equal(d.novos, 2000);
    assert.equal(d.liquido, 2000);
  });
});
