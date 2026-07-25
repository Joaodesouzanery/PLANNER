// CRM · Servicing Control Tower (rico) — KPIs de servicing + drill por segmento/tier. Puro/testável.
// Adapta o pilar "Control Tower" das telas de referência: SLA adherence, tempo de resposta (proxy),
// MRR em risco, churn risk, e a "manager workbench" (grupos por segmento/tier). Sem NRR fabricado —
// o modelo de contrato não guarda snapshot mensal, então usamos MRR em risco (honesto) como lente de retenção.

export interface TowerCustomer {
  id: string;
  nome: string;
  segment?: string | null;
  tier?: string | null;
  stage?: string | null;
  health: string;            // green|yellow|red (calculado)
  healthScore: number;
  churnRisk: number;
  recencyDias: number | null;
  recorrente: boolean;
  ongoing: number;
  nextActionDate?: string | null;
  priority?: string | null;
}

export interface TowerKpis {
  total: number;
  mrr: number;
  emRisco: number;
  atencao: number;
  ativos: number;
  comProximaAcao: number;
  foraSla: number;           // próxima ação vencida
  proxSla: number;           // próxima ação vencendo em <= slaDays
  slaAdherence: number;      // (comProximaAcao - foraSla) / comProximaAcao
  avgResponseDias: number;   // média de dias desde o último contato (proxy TAT)
  mrrEmRisco: number;        // Σ ongoing dos clientes com saúde crítica
  churnRiskMedio: number;    // média de churnRisk dos recorrentes
  prioridadeAlta: number;
}

export interface TowerGroup {
  chave: string;
  count: number;
  mrr: number;
  emRisco: number;
  comProximaAcao: number;
  foraSla: number;
  proxSla: number;
  slaAdherence: number;
  avgHealth: number;
  prioridadeAlta: number;
}

const dayDiff = (from: string, to: string) => Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
const avg = (xs: number[]) => (xs.length ? Math.round(xs.reduce((a, v) => a + v, 0) / xs.length) : 0);

interface SlaState { comProximaAcao: number; foraSla: number; proxSla: number }
const slaOf = (rows: TowerCustomer[], today: string, slaDays: number): SlaState => {
  let comProximaAcao = 0, foraSla = 0, proxSla = 0;
  for (const r of rows) {
    if (!r.nextActionDate) continue;
    comProximaAcao++;
    if (r.nextActionDate < today) foraSla++;
    else if (dayDiff(today, r.nextActionDate) <= slaDays) proxSla++;
  }
  return { comProximaAcao, foraSla, proxSla };
};
const adherence = (s: SlaState) => (s.comProximaAcao > 0 ? (s.comProximaAcao - s.foraSla) / s.comProximaAcao : 1);

export const towerKpis = (rows: TowerCustomer[], today: string, slaDays = 7): TowerKpis => {
  const sla = slaOf(rows, today, slaDays);
  const recorrentes = rows.filter((r) => r.recorrente);
  return {
    total: rows.length,
    mrr: rows.reduce((a, r) => a + r.ongoing, 0),
    emRisco: rows.filter((r) => r.health === "red").length,
    atencao: rows.filter((r) => r.health === "yellow").length,
    ativos: rows.filter((r) => (r.health || "green") === "green").length,
    comProximaAcao: sla.comProximaAcao,
    foraSla: sla.foraSla,
    proxSla: sla.proxSla,
    slaAdherence: adherence(sla),
    avgResponseDias: avg(rows.filter((r) => r.recencyDias != null).map((r) => r.recencyDias as number)),
    mrrEmRisco: rows.filter((r) => r.health === "red").reduce((a, r) => a + r.ongoing, 0),
    churnRiskMedio: avg(recorrentes.map((r) => r.churnRisk)),
    prioridadeAlta: rows.filter((r) => r.priority === "high").length,
  };
};

/** Manager workbench: agrupa a carteira por segmento ou tier, com métricas de servicing por grupo. */
export const towerGroups = (rows: TowerCustomer[], by: "segment" | "tier", today: string, slaDays = 7): TowerGroup[] => {
  const map = new Map<string, TowerCustomer[]>();
  for (const r of rows) {
    const key = (r[by] || "—").toString();
    (map.get(key) ?? map.set(key, []).get(key)!).push(r);
  }
  return [...map.entries()].map(([chave, g]) => {
    const sla = slaOf(g, today, slaDays);
    return {
      chave,
      count: g.length,
      mrr: g.reduce((a, r) => a + r.ongoing, 0),
      emRisco: g.filter((r) => r.health === "red").length,
      comProximaAcao: sla.comProximaAcao,
      foraSla: sla.foraSla,
      proxSla: sla.proxSla,
      slaAdherence: adherence(sla),
      avgHealth: avg(g.map((r) => r.healthScore)),
      prioridadeAlta: g.filter((r) => r.priority === "high").length,
    };
  }).sort((a, b) => b.mrr - a.mrr);
};
