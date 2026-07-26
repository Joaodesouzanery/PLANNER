import { describe, it } from "node:test";
import assert from "node:assert";
import { mrate, targetFor, monthsTo, reqY, series } from "./retirement";

describe("retirement — targetFor / mrate", () => {
  it("target de 15k/mês a 3,5% = 5.142.857", () => assert.equal(Math.round(targetFor(15000, 3.5)), 5142857));
  it("target de 10k/mês a 4% = 3.000.000", () => assert.equal(targetFor(10000, 4), 3_000_000));
  it("mrate(0) = 0", () => assert.equal(mrate(0), 0));
});

describe("retirement — monthsTo", () => {
  it("linear (r=0): 12k poupando 1k/mês = 12 meses", () => assert.equal(monthsTo(12000, 0, 1000, 0), 12));
  it("já atingido (P0 ≥ alvo) = 0 meses", () => assert.equal(monthsTo(3000, 3000, 1000, 0.01), 0));
  it("inatingível (sem aporte e sem base) = Infinity", () => assert.equal(monthsTo(1000, 0, 0, 0.005), Infinity));
});

describe("retirement — reqY", () => {
  it("linear (r=0): 12k em 12 meses do zero = 1000/mês", () => assert.equal(reqY(12000, 0, 12, 0), 1000));
  it("linear com P0: (24k−12k)/12 = 1000/mês", () => assert.equal(reqY(24000, 12000, 12, 0), 1000));
  it("com juros (r=1%/mês): fator de anuidade 12 meses ≈ 12,6825", () => {
    assert.ok(Math.abs(reqY(12682.503, 0, 12, 0.01) - 1000) < 0.5);
  });
  it("nunca negativo (P0 já cobre)", () => assert.equal(reqY(1000, 5000, 12, 0.01), 0));
});

describe("retirement — series", () => {
  const s = series(1000, 100, 0, 3); // r=0 → soma linear
  it("começa em P0 e cresce Y/mês", () => {
    assert.deepEqual(s.map((p) => p.v), [1000, 1100, 1200, 1300]);
    assert.equal(s[0].m, 0);
    assert.equal(s.length, 4);
  });
});
