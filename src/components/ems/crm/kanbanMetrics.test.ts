import { describe, it } from "node:test";
import assert from "node:assert";
import { computeKanbanMetrics, type StageEvent, type DealLite } from "./kanbanMetrics";
import { DEFAULT_STAGES } from "./crmStages";

const stages = DEFAULT_STAGES;
const NOW = "2026-07-20T00:00:00.000Z";

describe("kanbanMetrics — computeKanbanMetrics", () => {
  it("conta lead por etapa e valor, mapeando stage legado", () => {
    const deals: DealLite[] = [
      { id: "a", stage: "lista", status_outcome: null, value: 100 },
      { id: "b", stage: "nova", status_outcome: null, value: 50 }, // legado → lista
      { id: "c", stage: "documento", status_outcome: null, value: 200 },
    ];
    const m = computeKanbanMetrics(deals, [], stages, NOW);
    const lista = m.perStage.find((s) => s.key === "lista")!;
    assert.equal(lista.count, 2);
    assert.equal(lista.totalValue, 150);
    assert.equal(m.perStage.find((s) => s.key === "documento")!.count, 1);
    assert.equal(m.totalDeals, 3);
    assert.equal(m.totalValue, 350);
  });

  it("tempo médio por etapa vem dos eventos (entrou → próximo/agora)", () => {
    // deal entra em 'abordado' 10/07, sai (documento) 14/07 → 4 dias em abordado.
    const events: StageEvent[] = [
      { deal_id: "a", from_stage: "lista", to_stage: "abordado", moved_at: "2026-07-10T00:00:00.000Z" },
      { deal_id: "a", from_stage: "abordado", to_stage: "documento", moved_at: "2026-07-14T00:00:00.000Z" },
    ];
    const deals: DealLite[] = [{ id: "a", stage: "documento", status_outcome: null, value: 0 }];
    const m = computeKanbanMetrics(deals, events, stages, NOW);
    assert.equal(m.perStage.find((s) => s.key === "abordado")!.avgDays, 4);
    // 'documento' é o estágio atual (sem próximo evento) → 14/07 até NOW 20/07 = 6 dias.
    assert.equal(m.perStage.find((s) => s.key === "documento")!.avgDays, 6);
  });

  it("gargalo = etapa da esteira com maior tempo médio (ignora offtrack)", () => {
    const events: StageEvent[] = [
      { deal_id: "a", from_stage: null, to_stage: "abordado", moved_at: "2026-07-01T00:00:00.000Z" },
      { deal_id: "a", from_stage: "abordado", to_stage: "documento", moved_at: "2026-07-03T00:00:00.000Z" }, // 2d abordado
      { deal_id: "a", from_stage: "documento", to_stage: "perdido", moved_at: "2026-07-13T00:00:00.000Z" }, // 10d documento
    ];
    const deals: DealLite[] = [{ id: "a", stage: "perdido", status_outcome: "lost", value: 0, close_reason: "Preço" }];
    const m = computeKanbanMetrics(deals, events, stages, NOW);
    assert.equal(m.bottleneck?.key, "documento");
    assert.equal(m.bottleneck?.avgDays, 10);
  });

  it("win rate, ciclo e motivos de perda", () => {
    const events: StageEvent[] = [
      { deal_id: "w", from_stage: null, to_stage: "abordado", moved_at: "2026-07-01T00:00:00.000Z" },
      { deal_id: "w", from_stage: "abordado", to_stage: "cliente", moved_at: "2026-07-09T00:00:00.000Z" }, // ciclo 8d
    ];
    const deals: DealLite[] = [
      { id: "w", stage: "cliente", status_outcome: "won", value: 1000 },
      { id: "l1", stage: "perdido", status_outcome: "lost", value: 0, close_reason: "Preço" },
      { id: "l2", stage: "perdido", status_outcome: "lost", value: 0, close_reason: "Preço" },
      { id: "l3", stage: "perdido", status_outcome: "lost", value: 0, close_reason: null },
      { id: "o", stage: "documento", status_outcome: null, value: 0 },
    ];
    const m = computeKanbanMetrics(deals, events, stages, NOW);
    assert.equal(m.wonCount, 1);
    assert.equal(m.lostCount, 3);
    assert.equal(m.openCount, 1);
    assert.equal(m.winRate, 0.25); // 1 / (1+3)
    assert.equal(m.avgCycleDays, 8);
    assert.deepEqual(m.lostReasons, [
      { reason: "Preço", count: 2 },
      { reason: "Sem motivo", count: 1 },
    ]);
  });

  it("sem eventos: avgDays null, winRate null, sem crash", () => {
    const m = computeKanbanMetrics([{ id: "a", stage: "lista", status_outcome: null, value: 0 }], [], stages, NOW);
    assert.equal(m.perStage.find((s) => s.key === "lista")!.avgDays, null);
    assert.equal(m.winRate, null);
    assert.equal(m.avgCycleDays, null);
    assert.equal(m.bottleneck, null);
  });

  it("valores por outcome, ticket médio, funil de conversão e série mensal", () => {
    const deals: DealLite[] = [
      { id: "won1", stage: "cliente", status_outcome: "won", value: 1000, created_at: "2026-06-05T10:00:00.000Z" },
      { id: "won2", stage: "cliente", status_outcome: "won", value: 3000, created_at: "2026-07-02T10:00:00.000Z" },
      { id: "lost1", stage: "perdido", status_outcome: "lost", value: 500, close_reason: "Preço", created_at: "2026-07-03T10:00:00.000Z" },
      { id: "open1", stage: "documento", status_outcome: null, value: 200, created_at: "2026-07-10T10:00:00.000Z" },
      { id: "open2", stage: "abordado", status_outcome: null, value: 800, created_at: "2026-07-11T10:00:00.000Z" },
    ];
    const events: StageEvent[] = [
      { deal_id: "won1", from_stage: "fechamento", to_stage: "cliente", moved_at: "2026-06-20T00:00:00.000Z" },
      { deal_id: "won2", from_stage: "fechamento", to_stage: "cliente", moved_at: "2026-07-15T00:00:00.000Z" },
    ];
    const m = computeKanbanMetrics(deals, events, stages, NOW);

    assert.equal(m.wonValue, 4000);
    assert.equal(m.lostValue, 500);
    assert.equal(m.openValue, 1000);
    assert.equal(m.ticketMedio, 2000); // 4000 / 2 ganhos

    // Funil (7 etapas on-track). reached: won1/won2 chegam ao fim (idx 6); open1 documento(3); open2 abordado(2).
    assert.equal(m.funnel.length, 7);
    assert.equal(m.funnel[0].reached, 4); // lista: os 4 com etapa on-track
    assert.equal(m.funnel[0].convPct, null);
    assert.equal(m.funnel.find((f) => f.key === "documento")!.reached, 3);
    assert.equal(m.funnel.find((f) => f.key === "documento")!.convPct, 0.75); // 3/4
    assert.equal(m.funnel.find((f) => f.key === "cliente")!.reached, 2);

    // Série mensal (últimos 6 meses, termina em 2026-07).
    assert.equal(m.monthly.length, 6);
    const jul = m.monthly.find((p) => p.month === "2026-07")!;
    const jun = m.monthly.find((p) => p.month === "2026-06")!;
    assert.equal(jul.criados, 4);
    assert.equal(jul.ganhos, 1);
    assert.equal(jul.valorGanho, 3000);
    assert.equal(jun.ganhos, 1);
    assert.equal(jun.valorGanho, 1000);
  });

  it("filtra por módulo (funil por módulo) — deals e eventos", () => {
    const deals: DealLite[] = [
      { id: "a", stage: "documento", status_outcome: null, value: 100, modulo_id: "m1" },
      { id: "b", stage: "lista", status_outcome: null, value: 50, modulo_id: "m2" },
      { id: "c", stage: "cliente", status_outcome: "won", value: 200, modulo_id: "m1" },
    ];
    const events: StageEvent[] = [
      { deal_id: "a", from_stage: null, to_stage: "documento", moved_at: "2026-07-14T00:00:00.000Z" }, // m1
      { deal_id: "b", from_stage: null, to_stage: "lista", moved_at: "2026-07-14T00:00:00.000Z" }, // m2
    ];
    const m1 = computeKanbanMetrics(deals, events, stages, NOW, "m1");
    assert.equal(m1.totalDeals, 2); // a + c
    assert.equal(m1.totalValue, 300);
    assert.equal(m1.wonCount, 1);
    // documento (do m1) tem evento; lista (do m2) foi filtrado fora
    assert.equal(m1.perStage.find((s) => s.key === "documento")!.avgDays, 6); // 14/07 → NOW 20/07
    assert.equal(m1.perStage.find((s) => s.key === "lista")!.avgDays, null);

    const all = computeKanbanMetrics(deals, events, stages, NOW);
    assert.equal(all.totalDeals, 3);
  });
});
