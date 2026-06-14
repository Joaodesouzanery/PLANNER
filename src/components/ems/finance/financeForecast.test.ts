import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildForecastSeries, createImportFingerprint, getUpcomingPayables, parseFinanceCsv } from "./financeForecast.ts";
import type { ForecastEvent } from "./financeTypes.ts";

const event = (partial: Partial<ForecastEvent>): ForecastEvent => ({
  id: partial.id || crypto.randomUUID(),
  date: "2026-06-15",
  description: "Evento",
  amount: 100,
  kind: "expense",
  accountId: "account-a",
  entityId: "entity-a",
  sourceType: "transaction",
  status: "planned",
  ...partial,
});

describe("finance forecast", () => {
  it("keeps transfers neutral when both sides are consolidated", () => {
    const series = buildForecastSeries({
      startDate: "2026-06-14",
      days: 3,
      openingBalance: 1000,
      events: [
        event({ id: "out", kind: "transfer_out", amount: 300, accountId: "a" }),
        event({ id: "in", kind: "transfer_in", amount: 300, accountId: "b" }),
      ],
    });
    assert.equal(series.days[1].balance, 1000);
  });

  it("projects conservative, expected and optimistic scenarios", () => {
    const series = buildForecastSeries({
      startDate: "2026-06-14",
      days: 3,
      openingBalance: 1000,
      events: [
        event({ kind: "income", amount: 1000, isScenario: true, confidence: "medium", sourceType: "project" }),
        event({ kind: "expense", amount: 200, isScenario: true, confidence: "medium", sourceType: "project" }),
      ],
    });
    const day = series.days[1];
    assert.equal(day.balance, 1000);
    assert.equal(day.conservative, 800);
    assert.equal(day.expected, 1480);
    assert.equal(day.optimistic, 1880);
  });

  it("finds the first negative day and the minimum balance", () => {
    const series = buildForecastSeries({
      startDate: "2026-06-14",
      days: 4,
      openingBalance: 100,
      events: [event({ date: "2026-06-16", amount: 150 })],
    });
    assert.equal(series.firstNegativeDate, "2026-06-16");
    assert.equal(series.minimumBalance, -50);
  });

  it("classifies future and overdue payables", () => {
    const payables = getUpcomingPayables([
      event({ id: "late", date: "2026-06-13" }),
      event({ id: "soon", date: "2026-06-18" }),
      event({ id: "paid", date: "2026-06-17", status: "reconciled" }),
    ], "2026-06-14", 15);
    assert.deepEqual(payables.map((item) => item.status), ["overdue", "soon"]);
  });

  it("parses CSV and creates stable duplicate fingerprints", () => {
    const rows = parseFinanceCsv("Data;Descrição;Valor;Tipo;Categoria\n15/06/2026;Internet;120,50;Saída;Serviços");
    assert.deepEqual({ date: rows[0].date, description: rows[0].description, amount: rows[0].amount, type: rows[0].type }, { date: "2026-06-15", description: "Internet", amount: 120.5, type: "expense" });
    assert.equal(rows[0].import_fingerprint, createImportFingerprint(rows[0]));
  });
});
