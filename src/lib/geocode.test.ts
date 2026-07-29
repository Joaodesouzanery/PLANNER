import { describe, it } from "node:test";
import assert from "node:assert";
import { expandRecurringTransactions } from "./geocode";

// Cast leve: a função só lê id/date/is_recurring/recurrence_interval/recurrence_end_date.
const tx = (o: any): any => ({ is_recurring: true, recurrence_interval: "monthly", ...o });
const synthDates = (rows: any[], sourceId: string) =>
  rows.filter((r) => r.source_id === sourceId && r.is_projected).map((r) => r.date).sort();

describe("geocode — expandRecurringTransactions", () => {
  it("mensal com clamp de fim de mês (31 → 28/31/30)", () => {
    const out = expandRecurringTransactions([tx({ id: "t1", date: "2026-01-31" })], new Date(2026, 2, 31)); // até 31/mar
    const d = synthDates(out, "t1");
    assert.deepEqual(d, ["2026-02-28", "2026-03-31"]); // fev clampa p/ 28, mar volta p/ 31
  });

  it("respeita recurrence_end_date (não expande além do término)", () => {
    const out = expandRecurringTransactions(
      [tx({ id: "t2", date: "2026-01-15", recurrence_end_date: "2026-03-01" })],
      new Date(2026, 11, 31), // horizonte longo
    );
    assert.deepEqual(synthDates(out, "t2"), ["2026-02-15"]); // 15/mar já passa do fim (01/mar)
  });

  it("semanal soma 7 dias", () => {
    const out = expandRecurringTransactions([tx({ id: "t3", date: "2026-07-01", recurrence_interval: "weekly" })], new Date(2026, 6, 20));
    assert.deepEqual(synthDates(out, "t3"), ["2026-07-08", "2026-07-15"]);
  });

  it("mantém o original e marca as ocorrências como projetadas com source_id", () => {
    const out = expandRecurringTransactions([tx({ id: "t4", date: "2026-06-10" })], new Date(2026, 7, 10));
    assert.ok(out.some((r) => r.id === "t4" && !r.is_projected)); // original preservado
    assert.ok(out.every((r) => (r.is_projected ? r.source_id === "t4" && r.is_recurring === false : true)));
  });

  it("não-recorrente passa reto", () => {
    const out = expandRecurringTransactions([{ id: "n1", date: "2026-07-01", is_recurring: false } as any], new Date(2026, 11, 31));
    assert.equal(out.length, 1);
  });
});
