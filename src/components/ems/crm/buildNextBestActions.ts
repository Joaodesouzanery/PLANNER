// CRM · Next-Best-Action — a fila do que fazer AGORA por cliente. Puro/testável.
// Mesmo contrato do boardAttention: recebe inputs já buscados, devolve fila ranqueada (reds primeiro).
import { CLOSED_STAGES } from "./crm360";

export type NbaSev = "red" | "yellow" | "low";
export type NbaTipo = "follow_up" | "follow_up_48h" | "deal_fechando" | "deal_parado" | "concentracao" | "esfriando" | "renovacao" | "oferta" | "onboarding";

export interface NbaItem {
  id: string;
  tipo: NbaTipo;
  severidade: NbaSev;
  customerId: string | null;
  customerName: string;
  titulo: string;
  data?: string | null;
  valor?: number | null;
  refId?: string | null; // contact_id ou deal_id p/ agir
}

export interface NbaInputs {
  today: string;
  nextActions?: { customerId: string | null; customerName: string; contactId?: string | null; date: string; desc?: string | null }[];
  deals?: { id: string; customerId: string | null; customerName: string; title: string; value?: number | null; stage?: string | null; expected_close_date?: string | null }[];
  concentracao?: { customerId: string; customerName: string; top1Share: number } | null;
  esfriando?: { customerId: string; customerName: string; dias: number; ongoing: number }[];
  followUps48h?: { dealId: string; customerId: string | null; customerName: string; title: string; dias: number }[];
  onboardingGaps?: { customerId: string; customerName: string; pendentes: number }[];
  ofertas?: { customerId: string; customerName: string; titulo: string; valor?: number | null }[];
  concentracaoLimite?: number; // default 0.35
  esfriandoDias?: number; // default 30
}

const RANK: Record<NbaSev, number> = { red: 0, yellow: 1, low: 2 };
const CLOSED = CLOSED_STAGES;
const dayDiff = (from: string, to: string) => Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);

export const buildNextBestActions = (i: NbaInputs): NbaItem[] => {
  const today = i.today;
  const limite = i.concentracaoLimite ?? 0.35;
  const frio = i.esfriandoDias ?? 30;
  const out: NbaItem[] = [];

  for (const n of i.nextActions ?? []) {
    if (n.date >= today) continue; // só as vencidas
    const atraso = dayDiff(n.date, today);
    out.push({ id: `fu:${n.contactId || n.customerId}:${n.date}`, tipo: "follow_up", severidade: atraso > 7 ? "red" : "yellow", customerId: n.customerId, customerName: n.customerName, titulo: `Follow-up vencido (${atraso}d): ${n.desc || "próxima ação"}`, data: n.date, refId: n.contactId ?? null });
  }

  for (const d of i.deals ?? []) {
    if (CLOSED.has((d.stage || "").toLowerCase()) || !d.expected_close_date) continue;
    const dias = dayDiff(today, d.expected_close_date);
    if (dias < 0) out.push({ id: `dl:${d.id}`, tipo: "deal_parado", severidade: "red", customerId: d.customerId, customerName: d.customerName, titulo: `Deal vencido no funil: ${d.title}`, data: d.expected_close_date, valor: d.value ?? null, refId: d.id });
    else if (dias <= 14) out.push({ id: `dl:${d.id}`, tipo: "deal_fechando", severidade: "yellow", customerId: d.customerId, customerName: d.customerName, titulo: `Deal fechando em ${dias}d: ${d.title}`, data: d.expected_close_date, valor: d.value ?? null, refId: d.id });
  }

  if (i.concentracao && i.concentracao.top1Share > limite) {
    out.push({ id: `cc:${i.concentracao.customerId}`, tipo: "concentracao", severidade: i.concentracao.top1Share > 0.5 ? "red" : "yellow", customerId: i.concentracao.customerId, customerName: i.concentracao.customerName, titulo: `Concentração: ${i.concentracao.customerName} é ${Math.round(i.concentracao.top1Share * 100)}% da receita — diversifique` });
  }

  for (const e of i.esfriando ?? []) {
    if (e.dias < frio) continue;
    out.push({ id: `es:${e.customerId}`, tipo: "esfriando", severidade: e.dias > frio * 2 ? "red" : "yellow", customerId: e.customerId, customerName: e.customerName, titulo: `Esfriando: ${e.dias}d sem contato (MRR ${e.ongoing.toFixed(0)})`, valor: e.ongoing });
  }

  for (const f of i.followUps48h ?? []) {
    out.push({ id: `fu48:${f.dealId}`, tipo: "follow_up_48h", severidade: f.dias > 4 ? "red" : "yellow", customerId: f.customerId, customerName: f.customerName, titulo: `Follow-up: "${f.title}" parado há ${f.dias}d na etapa — 1 toque e para`, valor: null, refId: f.dealId });
  }

  for (const g of i.onboardingGaps ?? []) {
    if (g.pendentes <= 0) continue;
    out.push({ id: `ob:${g.customerId}`, tipo: "onboarding", severidade: "yellow", customerId: g.customerId, customerName: g.customerName, titulo: `Onboarding incompleto: ${g.pendentes} passo(s) pendente(s)` });
  }

  for (const o of i.ofertas ?? []) {
    out.push({ id: `of:${o.customerId}`, tipo: "oferta", severidade: "low", customerId: o.customerId, customerName: o.customerName, titulo: `Oportunidade: ${o.titulo}`, valor: o.valor ?? null });
  }

  const seen = new Set<string>();
  return out.filter((a) => (seen.has(a.id) ? false : (seen.add(a.id), true))).sort((a, b) => RANK[a.severidade] - RANK[b.severidade]);
};

/** Forecast ponderado dos deals abertos. */
export const forecastPonderado = (deals: { value?: number | null; probability?: number | null; stage?: string | null }[]): number =>
  deals.filter((d) => !CLOSED.has((d.stage || "").toLowerCase())).reduce((a, d) => a + (Number(d.value) || 0) * ((Number(d.probability) || 0) / 100), 0);
