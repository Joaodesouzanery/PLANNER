// Estratégia · progresso CALCULADO da cascata (BHAG → Objetivo → KR → Ação). Puro/testável.
// O "atual" nunca é digitado: metas FINANCEIRAS leem o dado real canônico (mrr/reserva/patrimônio/sobra,
// injetado via FinMetrics); metas OPERACIONAIS sobem a partir das ações concluídas (rollup).
// Semáforo 70%: verde ≥70%, amarelo 40–70%, vermelho <40% (spec Parte 8).

export type EstrTipo = "financeira" | "operacional";
export type Semaforo = "verde" | "amarelo" | "vermelho";

// Valores financeiros canônicos, INJETADOS (não recalculados aqui) — a fonte é o useFinanceWorkspace.
export interface FinMetrics {
  mrr: number;
  reserva: number;
  patrimonio: number;
  sobra: number;
}

export interface AcaoLite {
  id: string;
  status: string; // 'todo' | 'doing' | 'done'
}
export interface KrLite {
  id: string;
  tipo: EstrTipo;
  metrica?: string | null;
  alvo?: number | null;
  acoes: AcaoLite[];
}
export interface ObjetivoLite {
  id: string;
  tipo: EstrTipo;
  metrica?: string | null;
  alvo?: number | null;
  krs: KrLite[];
}
export interface VisaoLite {
  id: string;
  metrica_alvo?: string | null;
  valor_alvo?: number | null;
  objetivos: ObjetivoLite[];
}

export interface Progress {
  tipo: EstrTipo;
  atual: number;
  alvo: number;
  pct: number; // 0..1 (pode passar de 1 quando a meta é superada)
  semaforo: Semaforo;
}

export const semaforoOf = (pct: number): Semaforo =>
  pct >= 0.7 ? "verde" : pct >= 0.4 ? "amarelo" : "vermelho";

// Resolve uma métrica financeira nomeada para o valor real canônico. Retorna null se não reconhecida.
export const metricValue = (metrica: string | null | undefined, fin: FinMetrics): number | null => {
  switch ((metrica || "").trim().toLowerCase()) {
    case "mrr":
      return fin.mrr;
    case "reserva":
      return fin.reserva;
    case "patrimonio":
    case "patrimônio":
      return fin.patrimonio;
    case "sobra":
      return fin.sobra;
    default:
      return null;
  }
};

const pctOf = (atual: number, alvo: number) => (alvo > 0 ? Math.max(0, atual / alvo) : 0);
const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

const financeiraProgress = (metrica: string | null | undefined, alvo: number | null | undefined, fin: FinMetrics): Progress => {
  const atual = metricValue(metrica, fin) ?? 0;
  const target = Number(alvo) || 0;
  const pct = pctOf(atual, target);
  return { tipo: "financeira", atual, alvo: target, pct, semaforo: semaforoOf(pct) };
};

// KR: financeira lê a métrica; operacional = % de ações "done".
export const krProgress = (kr: KrLite, fin: FinMetrics): Progress => {
  if (kr.tipo === "financeira") return financeiraProgress(kr.metrica, kr.alvo, fin);
  const total = kr.acoes.length;
  const done = kr.acoes.filter((a) => a.status === "done").length;
  const pct = total > 0 ? done / total : 0;
  return { tipo: "operacional", atual: done, alvo: total, pct, semaforo: semaforoOf(pct) };
};

// Objetivo: financeira lê a métrica; operacional = média dos pct dos KRs (rollup).
export const objetivoProgress = (o: ObjetivoLite, fin: FinMetrics): Progress => {
  if (o.tipo === "financeira") return financeiraProgress(o.metrica, o.alvo, fin);
  const pct = avg(o.krs.map((k) => krProgress(k, fin).pct));
  return { tipo: "operacional", atual: 0, alvo: 0, pct, semaforo: semaforoOf(pct) };
};

// Visão/BHAG: se tem métrica financeira própria com alvo, usa ela; senão média dos Objetivos.
export const visaoProgress = (v: VisaoLite, fin: FinMetrics): Progress => {
  const finVal = metricValue(v.metrica_alvo, fin);
  if (finVal != null && Number(v.valor_alvo) > 0) {
    const target = Number(v.valor_alvo);
    const pct = pctOf(finVal, target);
    return { tipo: "financeira", atual: finVal, alvo: target, pct, semaforo: semaforoOf(pct) };
  }
  const pct = avg(v.objetivos.map((o) => objetivoProgress(o, fin).pct));
  return { tipo: "operacional", atual: 0, alvo: 0, pct, semaforo: semaforoOf(pct) };
};
