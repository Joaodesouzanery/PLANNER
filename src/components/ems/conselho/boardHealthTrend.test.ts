import { describe, it } from "node:test";
import assert from "node:assert";
import { biggestDrop, overallDelta, type HealthSnapshot } from "./boardHealthTrend";

const snap = (o: number, f: number, r: number, g: number, c: number): HealthSnapshot => ({
  snapshot_date: "2026-07-27", overall_score: o, financial_score: f, risk_score: r, governance_score: g, compliance_score: c,
});

describe("boardHealthTrend — biggestDrop", () => {
  it("acha a dimensão que mais caiu", () => {
    const prev = snap(80, 80, 70, 90, 85);
    const curr = snap(75, 60, 75, 85, 85); // fin −20, risk +5, gov −5, comp 0
    const d = biggestDrop(prev, curr)!;
    assert.equal(d.key, "financial_score");
    assert.equal(d.label, "Financeiro");
    assert.equal(d.delta, -20);
    assert.equal(d.from, 80);
    assert.equal(d.to, 60);
  });
  it("null quando nada piorou (tudo igual ou subiu)", () => {
    assert.equal(biggestDrop(snap(80, 80, 80, 80, 80), snap(90, 85, 80, 82, 88)), null);
  });
  it("null sem os dois snapshots", () => {
    assert.equal(biggestDrop(undefined, snap(80, 80, 80, 80, 80)), null);
  });
});

describe("boardHealthTrend — overallDelta", () => {
  it("curr − prev", () => assert.equal(overallDelta(snap(80, 0, 0, 0, 0), snap(72, 0, 0, 0, 0)), -8));
  it("0 sem par", () => assert.equal(overallDelta(undefined, snap(80, 0, 0, 0, 0)), 0));
});
