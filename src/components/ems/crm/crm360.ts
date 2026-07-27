// CRM · Customer 360 — agrega, por cliente (spine = finance_clientes), tudo que está espalhado:
// receita/recorrência, contatos (pessoas), deals, rotinas e timeline de interações. Puro/testável.

export interface CustomerSpine {
  id: string;
  nome: string;
  recorrente: boolean;
  stage?: string | null;
  health?: string | null;
  priority?: string | null;
  next_action_date?: string | null;
  next_action_desc?: string | null;
  segment?: string | null;
  tier?: string | null;
}
export interface CrmContact { id: string; name: string; customer_id?: string | null; pipeline_stage?: string | null; email?: string | null; phone?: string | null; company?: string | null }
export interface CrmDeal { id: string; title: string; value?: number | null; stage?: string | null; probability?: number | null; expected_close_date?: string | null; customer_id?: string | null; project_id?: string | null; status_outcome?: string | null; close_reason?: string | null; company_id?: string | null; modulo_id?: string | null; ativo_origem_id?: string | null }
export interface CrmRoutine { id: string; name: string; customer_id?: string | null; status?: string | null }
export interface CrmInteraction { id: string; contact_id: string; type: string; description: string; date: string }

export interface Customer360 {
  spine: CustomerSpine;
  monthly: number;
  ongoing: number;
  contatos: CrmContact[];
  deals: CrmDeal[];
  dealsAbertos: number;
  forecastPonderado: number;
  rotinas: CrmRoutine[];
  interacoes: CrmInteraction[]; // desc por data
  ultimaInteracao: string | null;
}

// Vocabulário ÚNICO de estágios fechados (fonte compartilhada — evita as cópias divergentes).
// Inclui "ganha"/"perdida" (grafia usada no modal de Projetos) além de "ganho"/"perdido".
export const CLOSED_STAGES = new Set(["ganho", "ganha", "perdido", "perdida", "won", "lost", "fechado", "closed"]);
const CLOSED = CLOSED_STAGES;

export const buildCustomer360 = (
  spine: CustomerSpine,
  revenue: { monthly: number; ongoing: number },
  allContacts: CrmContact[],
  allDeals: CrmDeal[],
  allRoutines: CrmRoutine[],
  allInteractions: CrmInteraction[],
): Customer360 => {
  const contatos = allContacts.filter((c) => c.customer_id === spine.id);
  const contactIds = new Set(contatos.map((c) => c.id));
  const deals = allDeals.filter((d) => d.customer_id === spine.id);
  const rotinas = allRoutines.filter((r) => r.customer_id === spine.id);
  const interacoes = allInteractions
    .filter((i) => contactIds.has(i.contact_id))
    .sort((a, b) => b.date.localeCompare(a.date));

  const dealsAbertos = deals.filter((d) => !CLOSED.has((d.stage || "").toLowerCase())).length;
  const forecastPonderado = deals
    .filter((d) => !CLOSED.has((d.stage || "").toLowerCase()))
    .reduce((a, d) => a + (Number(d.value) || 0) * ((Number(d.probability) || 0) / 100), 0);

  return {
    spine,
    monthly: revenue.monthly,
    ongoing: revenue.ongoing,
    contatos,
    deals,
    dealsAbertos,
    forecastPonderado,
    rotinas,
    interacoes,
    ultimaInteracao: interacoes[0]?.date ?? null,
  };
};

/** Dias desde a última interação (para "esfriando"). null se nunca. */
export const diasSemContato = (c: Customer360, today: string): number | null => {
  if (!c.ultimaInteracao) return null;
  return Math.round((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${c.ultimaInteracao.slice(0, 10)}T00:00:00Z`)) / 86_400_000);
};
