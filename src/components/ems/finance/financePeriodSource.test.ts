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

  it("mesma origem e data, valores diferentes: NÃO colapsa (viagem lança voo+hotel no mesmo dia)", () => {
    const dash = [
      { id: "v1", source_id: "trip9", type: "expense", amount: 3000, date: "2026-09-10", status: "reconciled", description: "Viagem — voo" },
      { id: "v2", source_id: "trip9", type: "expense", amount: 2000, date: "2026-09-10", status: "reconciled", description: "Viagem — hotel" },
      { id: "v3", source_id: "trip9", type: "expense", amount: 1000, date: "2026-09-10", status: "reconciled", description: "Viagem — alimentação" },
    ];
    const rows = buildPeriodSource(dash, []);
    assert.equal(rows.filter((r) => r.sourceId === "trip9").length, 3);
    assert.equal(rows.reduce((a, r) => a + r.amount, 0), 6000);
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

describe("financePeriodSource — dedup semântica (mesma despesa, registros diferentes)", () => {
  const row = (p: Record<string, unknown>) => ({
    id: "x", date: "2026-08-04", type: "expense" as const, amount: 800, category: null,
    description: "Macbook", sourceId: null, accountId: null, sourceType: "transaction",
    paid: false, realized: false, projected: true, synthetic: false, ...p,
  });

  it("entryKey ignora acento, pontuação, ordem e o sufixo de parcela", () => {
    assert.equal(entryKey(row({})), entryKey(row({ description: "MACBOOK (2/10)" })));
    assert.notEqual(entryKey(row({})), entryKey(row({ amount: 801 })));
    assert.notEqual(entryKey(row({})), entryKey(row({ date: "2026-08-05" })));
  });

  it("colapsa 'Macbook' recorrente e 'Macbook (2/10)' do mesmo dia, mantendo a paga", () => {
    const out = dedupeEquivalent([
      row({ id: "a", description: "Macbook", paid: false }),
      row({ id: "b", description: "Macbook (2/10)", paid: true, realized: true }),
    ]);
    assert.equal(out.length, 1);
    assert.equal(out[0].id, "b");
  });

  it("não colapsa gastos iguais em dias diferentes", () => {
    const out = dedupeEquivalent([
      row({ id: "a", description: "Gasolina", amount: 25, date: "2026-07-02" }),
      row({ id: "b", description: "Gasolina", amount: 25, date: "2026-07-22" }),
    ]);
    assert.equal(out.length, 2);
  });

  // Caso real da planilha: 4× "Zigpay" em 17/08 (46, 10, 46, 10). São compras distintas —
  // engoli-las fazia agosto fechar em 6.045 em vez de 6.101.
  it("não colapsa repetições legítimas: mesma descrição crua, ambas reais, no mesmo dia", () => {
    const real = { realized: true, projected: false, paid: true, date: "2026-08-17" };
    const out = dedupeEquivalent([
      row({ ...real, id: "z1", description: "Zigpay", amount: 46 }),
      row({ ...real, id: "z2", description: "Zigpay", amount: 10 }),
      row({ ...real, id: "z3", description: "Zigpay", amount: 46 }),
      row({ ...real, id: "z4", description: "Zigpay", amount: 10 }),
    ]);
    assert.equal(out.length, 4);
    assert.equal(out.reduce((a, r) => a + r.amount, 0), 112);
  });

  // Grupo misto: 2 compras iguais ("Macbook") + 1 variante ("Macbook (2/10)") no mesmo dia/valor.
  // O resultado não pode depender da ordem em que as linhas vieram do banco.
  it("independe da ordem: 2 repetições + 1 variante dão sempre o mesmo total", () => {
    const real = { realized: true, projected: false, date: "2026-08-04", amount: 800 };
    const A = row({ ...real, id: "A", description: "Macbook", paid: false });
    const B = row({ ...real, id: "B", description: "Macbook (2/10)", paid: true });
    const C = row({ ...real, id: "C", description: "Macbook", paid: true });
    const total = (rs: ReturnType<typeof row>[]) => dedupeEquivalent(rs).reduce((a, r) => a + r.amount, 0);
    assert.equal(total([A, B, C]), 1600);
    assert.equal(total([A, C, B]), 1600);
    assert.equal(total([B, A, C]), 1600);
    assert.equal(total([C, B, A]), 1600);
  });

  it("ainda colapsa a recorrência sintética contra a linha real do mesmo dia", () => {
    const out = dedupeEquivalent([
      row({ id: "anc-r3", description: "Zigpay", amount: 46, date: "2026-08-17", synthetic: true }),
      row({ id: "z1", description: "Zigpay", amount: 46, date: "2026-08-17", realized: true, projected: false, paid: true }),
    ]);
    assert.equal(out.length, 1);
    assert.equal(out[0].id, "z1");
  });

  it("buildPeriodSource já aplica a rede de segurança", () => {
    const rows = buildPeriodSource(
      [
        { id: "t1", type: "expense", amount: 800, date: "2026-08-04", status: "reconciled", description: "Macbook" },
        { id: "t2", type: "expense", amount: 800, date: "2026-08-04", status: "reconciled", description: "Macbook (2/10)" },
      ],
      [],
    );
    assert.equal(rows.filter((r) => r.amount === 800).length, 1);
  });
});
