import { describe, it } from "node:test";
import assert from "node:assert";
import { configAsOf, configSumOverMonths, monthsBetween, type ConfigRow } from "./configTimeline";

// Pró-labore: 2.310 a partir de hoje (jul/2026) → 3.500 a partir de jan/2027.
const rows: ConfigRow[] = [
  { key: "prolabore", value: 2310, effective_date: "2026-07-01" },
  { key: "prolabore", value: 3500, effective_date: "2027-01-01" },
  { key: "tax_rate", value: 6, effective_date: "2026-01-01" },
];

describe("configAsOf — vigência as-of mês", () => {
  it("antes da 1ª vigência → null (usa fallback)", () => assert.equal(configAsOf(rows, "prolabore", "2026-05"), null));
  it("mês da 1ª vigência", () => assert.equal(configAsOf(rows, "prolabore", "2026-07"), 2310));
  it("meses seguintes mantêm o valor", () => assert.equal(configAsOf(rows, "prolabore", "2026-11"), 2310));
  it("dezembro/2026 ainda 2.310", () => assert.equal(configAsOf(rows, "prolabore", "2026-12"), 2310));
  it("janeiro/2027 troca pra 3.500 (mês exato)", () => assert.equal(configAsOf(rows, "prolabore", "2027-01"), 3500));
  it("depois de jan/27 mantém 3.500", () => assert.equal(configAsOf(rows, "prolabore", "2027-06"), 3500));
  it("key desconhecida → null", () => assert.equal(configAsOf(rows, "foo", "2027-06"), null));
  it("tax_rate independente", () => assert.equal(configAsOf(rows, "tax_rate", "2026-12"), 6));
});

describe("monthsBetween", () => {
  it("intervalo inclusivo", () => assert.deepEqual(monthsBetween("2026-11", "2027-02"), ["2026-11", "2026-12", "2027-01", "2027-02"]));
  it("mesmo mês", () => assert.deepEqual(monthsBetween("2026-07", "2026-07"), ["2026-07"]));
  it("fim antes do início → vazio", () => assert.deepEqual(monthsBetween("2027-02", "2026-11"), []));
});

describe("configSumOverMonths — total do pró-labore no período (DRE)", () => {
  it("período todo em 2.310 (3 meses)", () => assert.equal(configSumOverMonths(rows, "prolabore", "2026-07", "2026-09"), 6930));
  it("período que atravessa a virada: nov/26..fev/27 = 2310×2 (nov,dez) + 3500×2 (jan,fev)", () =>
    assert.equal(configSumOverMonths(rows, "prolabore", "2026-11", "2027-02"), 2310 * 2 + 3500 * 2));
  it("mês antes da vigência usa fallback", () =>
    assert.equal(configSumOverMonths(rows, "prolabore", "2026-06", "2026-07", 0), 0 + 2310));
});
