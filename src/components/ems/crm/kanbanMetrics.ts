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
  created_at?: string | null;
}

export interface StageMetric {
  key: string;
  title: string;
  offtrack: boolean;
  count: number;
  totalValue: number;
  avgDays: number | null; // tempo médio no estágio (de eventos); null = sem dado ainda
}
export interface FunnelStage {
  key: string;
  title: string;
  reached: number; // nº de deals que já chegaram nesta etapa (ou além) — funil monotônico
  convPct: number | null; // conversão da etapa anterior p/ esta (null na 1ª)
}
export interface MonthlyPoint {
  month: string; // "yyyy-MM"
  criados: number;
  ganhos: number;
  valorGanho: number;
}
export interface KanbanMetrics {
  perStage: StageMetric[];
  bottleneck: { key: string; title: string; avgDays: number } | null;
  wonCount: number;
  lostCount: number;
  openCount: number;
  wonValue: number; // R$ ganho
  lostValue: number; // R$ perdido
  openValue: number; // R$ em aberto
  ticketMedio: number | null; // wonValue / wonCount
  winRate: number | null; // won / (won + lost)
  avgCycleDays: number | null; // 1º evento → último (deals ganhos)
  lostReasons: { reason: string; count: number }[];
  funnel: FunnelStage[]; // conversão etapa a etapa (só esteira on-track)
  monthly: MonthlyPoint[]; // últimos 6 meses: criados + ganhos + valor ganho
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

  const val = (arr: DealLite[]) => arr.reduce((a, d) => a + (Number(d.value) || 0), 0);
  const wonValue = val(won);
  const lostValue = val(lost);
  const open = deals.filter((d) => d.status_outcome !== "won" && d.status_outcome !== "lost");
  const openValue = val(open);
  const ticketMedio = wonCount > 0 ? wonValue / wonCount : null;

  // Funil de conversão (só esteira on-track): "reached" = deals cujo estágio mais avançado alcançado
  // (etapa atual / eventos / ganho = chegou ao fim) é >= o índice da etapa. Monotônico decrescente.
  const onTrack = stages.filter((s) => !s.is_offtrack);
  const idxOf = new Map(onTrack.map((s, i) => [s.key, i] as const));
  const furthest = new Map<string, number>();
  for (const d of deals) {
    let mx = -1;
    const cur = resolveStageKey(d.stage, stages);
    if (idxOf.has(cur)) mx = Math.max(mx, idxOf.get(cur) as number);
    if (d.status_outcome === "won") mx = onTrack.length - 1;
    for (const e of byDeal.get(d.id) || []) if (e.to_stage && idxOf.has(e.to_stage)) mx = Math.max(mx, idxOf.get(e.to_stage) as number);
    if (mx >= 0) furthest.set(d.id, mx);
  }
  const reachedAt = onTrack.map((_, i) => [...furthest.values()].filter((v) => v >= i).length);
  const funnel: FunnelStage[] = onTrack.map((s, i) => ({
    key: s.key,
    title: s.title,
    reached: reachedAt[i],
    convPct: i === 0 ? null : reachedAt[i - 1] > 0 ? reachedAt[i] / reachedAt[i - 1] : null,
  }));

  // Série mensal (últimos 6 meses): criados por created_at; ganhos/valor por data do ganho
  // (último evento do deal ganho, com fallback no created_at).
  // Chaves de mês em UTC (os buckets usam .slice(0,7) do ISO 'Z' → tem que casar, senão perto da
  // virada de mês em fuso ≠ UTC um deal cairia fora da janela e sumiria).
  const base = new Date(nowIso);
  const monthKeys: string[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() - i, 1));
    monthKeys.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`);
  }
  const mk = new Map<string, MonthlyPoint>(monthKeys.map((month) => [month, { month, criados: 0, ganhos: 0, valorGanho: 0 }]));
  for (const d of deals) {
    const cm = (d.created_at || "").slice(0, 7);
    if (mk.has(cm)) (mk.get(cm) as MonthlyPoint).criados += 1;
    if (d.status_outcome === "won") {
      const evs = byDeal.get(d.id);
      const wonAt = (evs && evs.length ? evs[evs.length - 1].moved_at : d.created_at || "").slice(0, 7);
      const p = mk.get(wonAt);
      if (p) { p.ganhos += 1; p.valorGanho += Number(d.value) || 0; }
    }
  }
  const monthly = monthKeys.map((month) => mk.get(month) as MonthlyPoint);

  return {
    perStage,
    bottleneck: bottleneck ? { key: bottleneck.key, title: bottleneck.title, avgDays: bottleneck.avgDays as number } : null,
    wonCount,
    lostCount,
    openCount,
    wonValue,
    lostValue,
    openValue,
    ticketMedio,
    winRate,
    avgCycleDays,
    lostReasons,
    funnel,
    monthly,
    totalDeals: deals.length,
    totalValue: deals.reduce((a, d) => a + (Number(d.value) || 0), 0),
  };
};
