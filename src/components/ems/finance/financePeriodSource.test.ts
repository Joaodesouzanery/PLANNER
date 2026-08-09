import { describe, it } from "node:test";
import assert from "node:assert";
import { buildPeriodSource, dedupeEquivalent, effectiveDate, entryKey, isRealized, isSyntheticId } from "./financePeriodSource";


describe("financePeriodSource — helpers", () => {
  it("effectiveDate usa due_date quando houver", () => {
    assert.equal(effectiveDate({ date: "2026-07-10", due_date: "2026-07-20" }), "2026-07-20");
    assert.equal(effectiveDate({ date: "2026-07-10" }), "2026-07-10");
  });
  it("isRealized: não-planejado e data <= hoje", () => {
    assert.equal(isRealized({ date: "2026-07-01" }, "2026-07-10"), true);
    assert.equal(isRealized({ date: "2026-07-20" }, "2026-07-10"), false); // futura
    assert.equal(isRealized({ status: "planned", date: "2026-07-01" }, "2026-07-10"), false);
  });
  it("isSyntheticId reconhece ocorrências de recorrência", () => {
    assert.equal(isSyntheticId("abc-r3"), true);
    assert.equal(isSyntheticId("abc-future-2"), true);
    assert.equal(isSyntheticId("abc"), false);
  });
});

describe("financePeriodSource — buildPeriodSource (dedup)", () => {
  it("dedup por (origem,data,tipo): mantém a de maior score (pago > realizado > não-sintético)", () => {
    // Uma recorrência materializada (real, pago) + a ocorrência sintética prevista, MESMO source|data|tipo.
    const dash = [
      { id: "mat-1", source_id: "rec1", type: "expense", amount: 100, date: "2026-07-05", status: "reconciled", description: "Aluguel" },
    ];
    const events = [
      { id: "rec1-r0", sourceId: "rec1", kind: "expense", amount: 100, date: "2026-07-05", status: "pending", sourceType: "recurring", description: "Aluguel" },
    ];
    const rows = buildPeriodSource(dash, events);
    // Só uma linha para (rec1|2026-07-05|expense) — a real materializada (não conta 2×).
    const doAluguel = rows.filter((r) => r.sourceId === "rec1" && r.date === "2026-07-05" && r.type === "expense");
    assert.equal(doAluguel.length, 1);
    assert.equal(doAluguel[0].paid, true);
    assert.equal(doAluguel[0].realized, true);
  });

  it("datas DIFERENTES da mesma origem NÃO deduplicam (paga adiantada/atrasada conta 2×) — comportamento atual", () => {
    const dash = [{ id: "mat-1", source_id: "rec1", type: "expense", amount: 100, date: "2026-07-03", status: "reconciled", description: "x" }];
    const events = [{ id: "rec1-r0", sourceId: "rec1", kind: "expense", amount: 100, date: "2026-07-05", status: "pending", sourceType: "recurring", description: "x" }];
    const rows = buildPeriodSource(dash, events);
    // 2 linhas (datas diferentes) — documenta o risco de dupla contagem quando paga fora da data prevista.
    assert.equal(rows.filter((r) => r.sourceId === "rec1").length, 2);
  });

  it("exclui cenários e linhas sem sourceId ficam avulsas", () => {
    const events = [
      { id: "cen-1", sourceId: "s1", kind: "income", amount: 500, date: "2026-07-01", isScenario: true, sourceType: "scenario", description: "cenário" },
      { id: "ev-2", sourceId: null, kind: "income", amount: 200, date: "2026-07-02", sourceType: "plan", description: "avulso" },
    ];
    const rows = buildPeriodSource([], events);
    assert.ok(!rows.some((r) => r.id === "cen-1")); // cenário fora
    assert.equal(rows.filter((r) => r.description === "avulso").length, 1); // avulso entra
  });
});
