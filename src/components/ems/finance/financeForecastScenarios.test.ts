import { describe, it } from "node:test";
import assert from "node:assert";
import { summarizeForecastByMonthScenarios } from "./financeForecast";

// Constrói um dia do forecast (só os campos que o summarizador lê).
const day = (date: string, c: number, e: number, o: number, income = 0, expense = 0): any => ({
  date, income, expense, transferIn: 0, transferOut: 0, balance: e, conservative: c, expected: e, optimistic: o, events: [],
});

// Série fake: 2 dias de jan + 1 de fev. Fechamento do mês = último dia; income/expense = soma do mês.
const series: any = {
  startDate: "2026-01-01", endDate: "2026-02-28", openingBalance: 100,
  days: [
    day("2026-01-15", 90, 110, 130, 50, 30),
    day("2026-01-31", 80, 120, 160, 40, 20),
    day("2026-02-28", 70, 130, 190, 10, 5),
  ],
  minimumBalance: 0, minimumBalanceDate: null, firstNegativeDate: null,
};

describe("summarizeForecastByMonthScenarios — preserva os 3 cenários por mês", () => {
  const rows = summarizeForecastByMonthScenarios(series);

  it("retorna um mês por período", () => assert.equal(rows.length, 2));

  it("janeiro: saldos = fechamento do último dia (31)", () => {
    const jan = rows.find((r) => r.month === "2026-01")!;
    assert.equal(jan.conservative, 80);
    assert.equal(jan.expected, 120);
    assert.equal(jan.optimistic, 160);
  });

  it("janeiro: income/expense são SOMA do mês", () => {
    const jan = rows.find((r) => r.month === "2026-01")!;
    assert.equal(jan.income, 90); // 50 + 40
    assert.equal(jan.expense, 50); // 30 + 20
  });

  it("fevereiro: fechamento do único dia", () => {
    const fev = rows.find((r) => r.month === "2026-02")!;
    assert.equal(fev.conservative, 70);
    assert.equal(fev.expected, 130);
    assert.equal(fev.optimistic, 190);
    assert.equal(fev.income, 10);
  });

  it("otimista ≥ esperado ≥ conservador em todo mês", () => {
    for (const r of rows) assert.ok(r.optimistic >= r.expected && r.expected >= r.conservative);
  });
});
