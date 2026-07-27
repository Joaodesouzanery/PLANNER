// Relatório da semana — resumo dos últimos 7 dias a partir dos eventos de transição. Puro/testável.
import { resolveStageKey, type CrmStage } from "./crmStages";
import type { StageEvent } from "./kanbanMetrics";

export interface WeekSummary {
  movimentos: number; // moves no funil na janela
  ganhos: number;
  perdidos: number;
  porEtapa: { key: string; title: string; count: number }[]; // moves por etapa de destino
}

export const computeWeekSummary = (
  events: StageEvent[],
  stages: CrmStage[],
  nowIso: string,
  days = 7,
): WeekSummary => {
  const fromMs = Date.parse(nowIso) - days * 86_400_000;
  const win = events.filter((e) => Number.isFinite(Date.parse(e.moved_at)) && Date.parse(e.moved_at) >= fromMs);
  const titleOf = (key: string) => stages.find((s) => s.key === key)?.title || key;

  let ganhos = 0;
  let perdidos = 0;
  const byStage = new Map<string, number>();
  for (const e of win) {
    const key = resolveStageKey(e.to_stage, stages);
    const outcome = stages.find((s) => s.key === key)?.outcome ?? null;
    if (outcome === "won") ganhos++;
    else if (outcome === "lost") perdidos++;
    byStage.set(key, (byStage.get(key) ?? 0) + 1);
  }
  const porEtapa = [...byStage.entries()]
    .map(([key, count]) => ({ key, title: titleOf(key), count }))
    .sort((a, b) => b.count - a.count);

  return { movimentos: win.length, ganhos, perdidos, porEtapa };
};
