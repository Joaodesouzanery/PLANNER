import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildRecurringSources,
  computeProjection,
  intervalFactor,
} from "./projectionCalc.ts";

const labels = ["jul/26", "ago/26", "set/26"];

describe("intervalFactor", () => {
  it("returns 1 for monthly intervals", () => {
    assert.equal(intervalFactor("monthly"), 1);
    assert.equal(intervalFactor("mensal"), 1);
    assert.equal(intervalFactor(""), 1);
  });
  it("converts weekly to ~4.345 per month", () => {
    assert.equal(intervalFactor("weekly"), 4.345);
    assert.equal(intervalFactor("semanal"), 4.345);
  });
  it("converts yearly to 1/12 per month", () => {
    assert.equal(intervalFactor("yearly"), 1 / 12);
    assert.equal(intervalFactor("anual"), 1 / 12);
  });
});

describe("buildRecurringSources", () => {
  it("ignores non-recurring transactions", () => {
    const sources = buildRecurringSources([
      { id: "1", amount: 100, type: "income", is_recurring: false },
    ]);
    assert.equal(sources.length, 0);
  });
  it("computes monthly equivalent per interval", () => {
    const sources = buildRecurringSources([
      { id: "a", amount: 3997, type: "income", is_recurring: true, recurrence_interval: "monthly" },
      { id: "b", amount: 100, type: "expense", is_recurring: true, recurrence_interval: "weekly" },
      { id: "c", amount: 1200, type: "expense", is_recurring: true, recurrence_interval: "yearly" },
    ]);
    assert.equal(sources.find((s) => s.id === "a")?.monthlyEquivalent, 3997);
    assert.equal(sources.find((s) => s.id === "b")?.monthlyEquivalent, 434.5);
    assert.equal(sources.find((s) => s.id === "c")?.monthlyEquivalent, 100);
  });
});

describe("computeProjection — recurring income started recently", () => {
  it("does NOT underestimate when last 3 months have zero history", () => {
    const result = computeProjection({
      monthlyData: [
        { month: "abr/26", income: 0, expense: 0, balance: 0 },
        { month: "mai/26", income: 0, expense: 0, balance: 0 },
        { month: "jun/26", income: 0, expense: 0, balance: 0 },
      ],
      recurringTransactions: [
        { id: "salary", amount: 3997, type: "income", is_recurring: true, recurrence_interval: "monthly" },
      ],
      futureMonthLabels: labels,
    });
    const projected = result.rows.filter((r) => r.projected);
    assert.equal(projected.length, 3);
    for (const row of projected) {
      assert.equal(row.income, 3997, `month ${row.month} should project full recurring income`);
    }
    assert.equal(result.breakdown.incomeSourceUsed, "recurring");
    assert.equal(result.breakdown.recurringBaselineIncome, 3997);
    assert.equal(result.breakdown.historicalAverageIncome, 0);
  });

  it("uses historical average when it is greater than recurring baseline", () => {
    const result = computeProjection({
      monthlyData: [
        { month: "abr/26", income: 8000, expense: 0, balance: 8000 },
        { month: "mai/26", income: 9000, expense: 0, balance: 9000 },
        { month: "jun/26", income: 10000, expense: 0, balance: 10000 },
      ],
      recurringTransactions: [
        { id: "salary", amount: 3997, type: "income", is_recurring: true, recurrence_interval: "monthly" },
      ],
      futureMonthLabels: labels,
    });
    assert.equal(result.breakdown.incomeSourceUsed, "historical");
    const projected = result.rows.filter((r) => r.projected);
    assert.equal(projected[0].income, 9000); // average of 8000,9000,10000
  });

  it("falls back to recurring expense baseline when no history exists", () => {
    const result = computeProjection({
      monthlyData: [
        { month: "abr/26", income: 3997, expense: 0, balance: 3997 },
        { month: "mai/26", income: 3997, expense: 0, balance: 3997 },
        { month: "jun/26", income: 3997, expense: 0, balance: 3997 },
      ],
      recurringTransactions: [
        { id: "salary", amount: 3997, type: "income", is_recurring: true, recurrence_interval: "monthly" },
        { id: "rent", amount: 1500, type: "expense", is_recurring: true, recurrence_interval: "monthly" },
        { id: "netflix", amount: 55, type: "expense", is_recurring: true, recurrence_interval: "monthly" },
      ],
      futureMonthLabels: labels,
    });
    const projected = result.rows.filter((r) => r.projected);
    assert.equal(projected[0].expense, 1555);
    assert.equal(projected[0].balance, 3997 - 1555);
    assert.equal(result.breakdown.expenseSourceUsed, "recurring");
  });

  it("returns zero projections when no history and no recurring data", () => {
    const result = computeProjection({
      monthlyData: [],
      recurringTransactions: [],
      futureMonthLabels: labels,
    });
    const projected = result.rows.filter((r) => r.projected);
    assert.equal(projected.length, 3);
    for (const row of projected) {
      assert.equal(row.income, 0);
      assert.equal(row.expense, 0);
      assert.equal(row.balance, 0);
    }
    assert.equal(result.breakdown.incomeSourceUsed, "none");
    assert.equal(result.breakdown.expenseSourceUsed, "none");
  });

  it("includes all 3 future month labels in the projection rows", () => {
    const result = computeProjection({
      monthlyData: [
        { month: "abr/26", income: 1000, expense: 500, balance: 500 },
        { month: "mai/26", income: 1000, expense: 500, balance: 500 },
        { month: "jun/26", income: 1000, expense: 500, balance: 500 },
      ],
      recurringTransactions: [],
      futureMonthLabels: labels,
    });
    assert.deepEqual(
      result.rows.filter((r) => r.projected).map((r) => r.month),
      labels,
    );
  });
});
