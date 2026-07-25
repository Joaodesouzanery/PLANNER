// CRM · Scorecard do cliente — health/churn/engagement/propensão + próxima melhor oferta. Puro/testável.
// Heurístico e honesto (não é ML): deriva de sinais reais já buscados no useCrm
// (receita recorrente, recência/frequência de interações, follow-up vencido, completude de onboarding,
//  tendência de receita, deals). Não busca nada, não escreve nada.

export type Health = "green" | "yellow" | "red";
export type Trend = "up" | "flat" | "down";
export type OfertaTipo = "upsell" | "cross_sell" | "recorrencia" | "retencao";

export interface NextOffer {
  tipo: OfertaTipo;
  titulo: string;
}

export interface ScoreInput {
  id: string;
  nome: string;
  recorrente: boolean;
  today: string;
  ongoing: number;                 // MRR recorrente (sai de vez se cancelar)
  monthly: number;                 // run-rate mensal (inclui pontual)
  ltv?: number;                    // receita total histórica (soma das entradas)
  sinceDate?: string | null;       // 1ª entrada/cadastro → tempo de casa
  lastInteraction?: string | null; // data da última interação
  interactions90d?: number;        // nº de interações nos últimos 90d
  nextActionDate?: string | null;  // próxima ação agendada (vencida = penaliza)
  openDeals?: number;
  openDealsValue?: number;
  wonDeals?: number;
  lostDeals?: number;
  onboardingCompleteness?: number | null; // 0..1; null = sem dados (neutro)
  revenue3m?: number[];            // entradas mensais recentes (antigo→recente) p/ tendência
}

export interface CustomerScore {
  id: string;
  nome: string;
  healthScore: number;             // 0..100 (calculado)
  health: Health;                  // cor derivada do score
  churnRisk: number;               // 0..100
  engagement: number;              // 0..100
  expansionPropensity: number;     // 0..100
  revenueTrend: Trend;
  ltv: number;
  tenureMonths: number | null;
  recencyDias: number | null;      // dias desde a última interação
  nextOffer: NextOffer | null;
  reasons: string[];               // por que o health ficou assim (transparência)
}

const clamp = (v: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, Math.round(v)));
const dayDiff = (from: string, to: string) => Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);

const recencyPenalty = (dias: number) => (dias <= 30 ? 0 : dias <= 60 ? 10 : dias <= 90 ? 20 : 30);
const recencyBonus = (dias: number) => (dias <= 15 ? 40 : dias <= 30 ? 25 : dias <= 60 ? 10 : 0);

/** Tendência da receita a partir das últimas entradas mensais (compara o último mês com a média dos anteriores).
 *  Exige ≥2 meses com valor > 0 p/ evitar "alta" falsa quando a recorrência aparece esparsa nos dados. */
const trendOf = (r?: number[]): Trend => {
  if (!r || r.length < 2 || r.filter((v) => v > 0).length < 2) return "flat";
  const last = r[r.length - 1];
  const prior = r.slice(0, -1);
  const avg = prior.reduce((a, v) => a + v, 0) / prior.length;
  if (avg <= 0) return last > 0 ? "up" : "flat";
  const delta = (last - avg) / avg;
  return delta >= 0.1 ? "up" : delta <= -0.1 ? "down" : "flat";
};

export const scoreCustomer = (i: ScoreInput): CustomerScore => {
  const dias = i.lastInteraction ? dayDiff(i.lastInteraction, i.today) : null;
  const recDias = dias == null ? 999 : dias;
  const interactions90d = i.interactions90d ?? 0;
  const overdue = !!(i.nextActionDate && i.nextActionDate < i.today);
  const onbPenalty = i.onboardingCompleteness == null ? 0 : Math.round((1 - i.onboardingCompleteness) * 20);
  const recurringLoss = i.recorrente && i.ongoing <= 0 ? 25 : 0;
  const trend = trendOf(i.revenue3m);
  const trendAdj = trend === "down" ? -20 : trend === "up" ? 5 : 0;

  const engagement = clamp(Math.min(60, interactions90d * 20) + recencyBonus(recDias));

  const healthScore = clamp(100 - recencyPenalty(recDias) - (overdue ? 15 : 0) - onbPenalty - recurringLoss + trendAdj);
  const health: Health = healthScore >= 70 ? "green" : healthScore >= 40 ? "yellow" : "red";

  const churnRisk = clamp(recencyPenalty(recDias) + (overdue ? 15 : 0) + recurringLoss + (trend === "down" ? 20 : 0));

  const openDeals = i.openDeals ?? 0;
  const wonDeals = i.wonDeals ?? 0;
  const expansionPropensity = clamp(
    Math.round(engagement * 0.4) + (trend === "up" ? 25 : 0) + (openDeals > 0 ? 20 : 0) + (wonDeals > 0 ? 10 : 0) + (healthScore >= 70 ? 15 : 0),
  );

  // Por que o health ficou assim (transparência p/ a UI).
  const reasons: string[] = [];
  if (recencyPenalty(recDias) > 0) reasons.push(dias == null ? "sem interação registrada" : `${recDias}d sem contato`);
  if (overdue) reasons.push("follow-up vencido");
  if (recurringLoss) reasons.push("recorrência perdida (MRR zerado)");
  if (onbPenalty) reasons.push("onboarding incompleto");
  if (trend === "down") reasons.push("receita em queda");
  if (trend === "up") reasons.push("receita em alta");
  if (reasons.length === 0) reasons.push("carteira em dia");

  const nextOffer = pickOffer({ recorrente: i.recorrente, churnRisk, trend, expansionPropensity, healthScore, openDeals, wonDeals, monthly: i.monthly });

  return {
    id: i.id,
    nome: i.nome,
    healthScore,
    health,
    churnRisk,
    engagement,
    expansionPropensity,
    revenueTrend: trend,
    ltv: i.ltv ?? 0,
    tenureMonths: i.sinceDate ? Math.max(0, Math.round(dayDiff(i.sinceDate, i.today) / 30)) : null,
    recencyDias: dias,
    nextOffer,
    reasons,
  };
};

/** Próxima melhor oferta (upsell/cross-sell/recorrência/retenção) a partir do estado do cliente. */
const pickOffer = (s: {
  recorrente: boolean; churnRisk: number; trend: Trend; expansionPropensity: number;
  healthScore: number; openDeals: number; wonDeals: number; monthly: number;
}): NextOffer | null => {
  if (s.recorrente && s.churnRisk >= 50) return { tipo: "retencao", titulo: "Risco de churn — acionar retenção/renovação" };
  if (s.recorrente && s.trend === "up" && s.expansionPropensity >= 50) return { tipo: "upsell", titulo: "Cliente crescendo — propor expansão/upsell" };
  if (!s.recorrente && (s.wonDeals > 0 || s.monthly > 0)) return { tipo: "recorrencia", titulo: "Converter em contrato recorrente/assinatura" };
  if (s.healthScore >= 70 && s.openDeals === 0) return { tipo: "cross_sell", titulo: "Cliente saudável sem deal aberto — propor novo projeto" };
  return null;
};

/** Rótulos p/ a UI. */
export const OFERTA_LABEL: Record<OfertaTipo, string> = {
  upsell: "Upsell / expansão",
  cross_sell: "Cross-sell / novo projeto",
  recorrencia: "Virar recorrente",
  retencao: "Retenção / renovação",
};
export const TREND_LABEL: Record<Trend, string> = { up: "↑ em alta", flat: "→ estável", down: "↓ em queda" };
