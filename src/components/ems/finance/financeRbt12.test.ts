import { describe, it } from "node:test";
import assert from "node:assert";
import { rbt12Status } from "./financeRbt12";

const meses = (arr: number[]) => arr.map((income) => ({ income }));

describe("financeRbt12", () => {
  it("sem limite configurado → não vigia (null)", () => {
    assert.equal(rbt12Status(meses(Array(12).fill(8250)), null, 80, 8250), null);
  });

  it("12 meses de 8.250 = RBT12 99.000 (~99k anualizado)", () => {
    const r = rbt12Status(meses(Array(12).fill(8250)), 4800000, 80, 8250)!;
    assert.equal(r.rbt12, 99000);
    assert.equal(r.alert, false); // longe do teto de 4,8M
  });

  it("acima de alert_pct do limite → alerta", () => {
    const r = rbt12Status(meses(Array(12).fill(8250)), 108000, 80, 8250)!;
    assert.ok(r.pct > 0.9 && r.alert === true);
  });

  it("projeta os meses até cruzar no ritmo do MRR", () => {
    // janela com ramp-up (3 meses zerados) some conforme entra 8.250/mês.
    const r = rbt12Status(meses([0, 0, 0, ...Array(9).fill(8250)]), 90000, 80, 8250)!;
    assert.equal(r.rbt12, 74250);
    assert.equal(r.mesesAteCruzar, 2); // 74250 → 82500 → 90750 > 90000
  });
});
