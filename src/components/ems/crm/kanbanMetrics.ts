// Motor de métricas do funil (kanban de deals). Puro/testável — sem React/Supabase.
// Lê deals (contagem/valor/outcome/motivo de perda) + eventos de transição (crm_stage_events) e produz:
// lead por etapa, tempo médio por etapa, gargalo, win rate, ciclo em dias e motivos de perda.
import { resolveStageKey, type CrmStage } from "./crmStages";

export interface StageEvent {
  deal_id: string;
  from_stage: string | null;
  to_stage: string | null;
  moved_at: string;
}
export interface DealLite {
  id: string;
  stage: string | null;
  status_outcome: string | null;
  value: number | null;
  close_reason?: string | null;
  modulo_id?: string | null;
}

export interface StageMetric {
  key: string;
  title: string;
  offtrack: boolean;
  count: number;
  totalValue: number;
  avgDays: number | null; // tempo médio no estágio (de eventos); null = sem dado ainda
}
export interface KanbanMetrics {
  perStage: StageMetric[];
  bottleneck: { key: string; title: string; avgDays: number } | null;
  wonCount: number;
  lostCount: number;
  openCount: number;
  winRate: number | null; // won / (won + lost)
  avgCycleDays: number | null; // 1º evento → último (deals ganhos)
  lostReasons: { reason: string; count: number }[];
  totalDeals: number;
  totalValue: number;
}

const DAY = 86_400_000;
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

/** Agrupa eventos por deal (ordenados asc) — base pro tempo por etapa e o ciclo. */
const groupByDeal = (events: StageEvent[]): Map<string, StageEvent[]> => {
  const map = new Map<string, StageEvent[]>();
  for (const e of events) {
    const arr = map.get(e.deal_id);
    if (arr) arr.push(e);
    else map.set(e.deal_id, [e]);
  }
  for (const arr of map.values()) arr.sort((a, b) => a.moved_at.localeCompare(b.moved_at));
  return map;
};

export const computeKanbanMetrics = (
  allDeals: DealLite[],
  allEvents: StageEvent[],
  stages: CrmStage[],
  nowIso: string,
  moduloId?: string | null,
): KanbanMetrics => {
  // Funil por módulo: filtra deals pelo módulo e os eventos pelos deals resultantes.
  const deals = moduloId ? allDeals.filter((d) => d.modulo_id === moduloId) : allDeals;
  const dealIds = new Set(deals.map((d) => d.id));
  const events = moduloId ? allEvents.filter((e) => dealIds.has(e.deal_id)) : allEvents;
  const now = Date.parse(nowIso);
  const byDeal = groupByDeal(events);

  // Tempo por etapa: entrou (to_stage) em t0, saiu no próximo evento (ou agora, se ainda está lá).
  const durations = new Map<string, number[]>();
  for (const evs of byDeal.values()) {
    for (let i = 0; i < evs.length; i++) {
      const stageKey = evs[i].to_stage;
      if (!stageKey) continue;
      const t0 = Date.parse(evs[i].moved_at);
      const t1 = i + 1 < evs.length ? Date.parse(evs[i + 1].moved_at) : now;
      const days = (t1 - t0) / DAY;
      if (Number.isFinite(days) && days >= 0) {
        const arr = durations.get(stageKey);
        if (arr) arr.push(days);
        else durations.set(stageKey, [days]);
      }
    }
  }

  const perStage: StageMetric[] = stages.map((s) => {
    const inStage = deals.filter((d) => resolveStageKey(d.stage, stages) === s.key);
    const ds = durations.get(s.key);
    return {
      key: s.key,
      title: s.title,
      offtrack: s.is_offtrack,
      count: inStage.length,
      totalValue: inStage.reduce((a, d) => a + (Number(d.value) || 0), 0),
      avgDays: ds && ds.length ? mean(ds) : null,
    };
  });

  // Gargalo = etapa da esteira (não offtrack) com maior tempo médio.
  const bottleneck = perStage
    .filter((p) => !p.offtrack && p.avgDays != null)
    .sort((a, b) => (b.avgDays as number) - (a.avgDays as number))[0];

  const won = deals.filter((d) => d.status_outcome === "won");
  const lost = deals.filter((d) => d.status_outcome === "lost");
  const wonCount = won.length;
  const lostCount = lost.length;
  const openCount = deals.length - wonCount - lostCount;
  const winRate = wonCount + lostCount > 0 ? wonCount / (wonCount + lostCount) : null;

  // Ciclo em dias: do 1º ao último evento de cada deal ganho.
  const cycles: number[] = [];
  for (const d of won) {
    const evs = byDeal.get(d.id);
    if (evs && evs.length >= 1) {
      const days = (Date.parse(evs[evs.length - 1].moved_at) - Date.parse(evs[0].moved_at)) / DAY;
      if (Number.isFinite(days) && days >= 0) cycles.push(days);
    }
  }
  const avgCycleDays = cycles.length ? mean(cycles) : null;

  const reasons = new Map<string, number>();
  for (const d of lost) {
    const r = (d.close_reason || "").trim() || "Sem motivo";
    reasons.set(r, (reasons.get(r) || 0) + 1);
  }
  const lostReasons = [...reasons.entries()]
    .map(([reason, count]) => ({ reason, count }))
    .sort((a, b) => b.count - a.count);

  return {
    perStage,
    bottleneck: bottleneck ? { key: bottleneck.key, title: bottleneck.title, avgDays: bottleneck.avgDays as number } : null,
    wonCount,
    lostCount,
    openCount,
    winRate,
    avgCycleDays,
    lostReasons,
    totalDeals: deals.length,
    totalValue: deals.reduce((a, d) => a + (Number(d.value) || 0), 0),
  };
};
