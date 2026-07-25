import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { toast } from "@/hooks/use-toast";
import { buildClientRevenue } from "@/components/ems/finance/financeClients";
import type { CustomerSpine, CrmContact, CrmDeal, CrmRoutine, CrmInteraction } from "./crm360";
import { buildNextBestActions, type NbaItem } from "./buildNextBestActions";
import { scoreCustomer, type CustomerScore } from "./crmScores";

const todayIso = () => new Date().toISOString().slice(0, 10);
const dayDiff = (from: string, to: string) => Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
const CLOSED = new Set(["ganho", "perdido", "won", "lost", "fechado", "closed"]);

/** Últimos n meses no formato YYYY-MM (antigo→recente), a partir de uma data hoje. */
const recentMonths = (today: string, n = 3): string[] => {
  let [y, m] = today.slice(0, 7).split("-").map(Number);
  const arr: string[] = [];
  for (let k = 0; k < n; k++) { arr.unshift(`${y}-${String(m).padStart(2, "0")}`); m--; if (m === 0) { m = 12; y--; } }
  return arr;
};

export interface OnboardingStatus { completeness: number | null; completed: number; total: number; pendentes: number }

const db = supabase as any;
const safe = async (build: () => any): Promise<any[]> => {
  try { const { data, error } = await build(); if (error) return []; return data ?? []; } catch { return []; }
};

/** Fonte única do CRM: spine (finance_clientes + campos CRM) + satélites + receita + scores por cliente. */
export const useCrm = () => {
  const qc = useQueryClient();
  const { selectedCompanyId } = useCompany();
  const scoped = selectedCompanyId && selectedCompanyId !== "all";
  const co = (q: any) => (scoped ? q.eq("company_id", selectedCompanyId) : q);

  const query = useQuery({
    queryKey: ["crm", selectedCompanyId],
    staleTime: 60_000,
    queryFn: async () => {
      const [spine, contacts, deals, routines, interactions, meta, txns, onbSteps, onbTracking] = await Promise.all([
        safe(() => db.from("finance_clientes").select("*").order("nome")),
        safe(() => co(db.from("contacts").select("id,name,customer_id,pipeline_stage,email,phone,company"))),
        safe(() => co(db.from("project_opportunities").select("id,title,value,stage,probability,expected_close_date,status_outcome,customer_id,contact_id"))),
        safe(() => db.from("routine_clients").select("id,name,customer_id,status")),
        safe(() => db.from("contact_interactions").select("id,contact_id,type,description,date")),
        safe(() => db.from("commercial_contact_meta").select("contact_id,next_action_date,next_action_description")),
        safe(() => co(db.from("financial_transactions").select("id,amount,type,is_recurring,recurrence_interval,recurrence_end_date,cliente_id,date"))),
        safe(() => db.from("onboarding_steps").select("id")),
        safe(() => db.from("contact_onboarding_tracking").select("contact_id,step_id,status")),
      ]);
      return { spine, contacts, deals, routines, interactions, meta, txns, onbSteps, onbTracking };
    },
  });

  const data = query.data;
  const customers = (data?.spine ?? []) as CustomerSpine[];
  const contacts = (data?.contacts ?? []) as CrmContact[];
  const deals = (data?.deals ?? []) as CrmDeal[];
  const routines = (data?.routines ?? []) as CrmRoutine[];
  const interactions = (data?.interactions ?? []) as CrmInteraction[];

  const revenueByCustomer = useMemo(() => {
    const clientesLite = customers.map((c) => ({ id: c.id, nome: c.nome, recorrente: c.recorrente }));
    const { clients } = buildClientRevenue((data?.txns ?? []) as any[], clientesLite);
    const map = new Map<string, { monthly: number; ongoing: number }>();
    for (const c of clients) if (c.id) map.set(c.id, { monthly: c.monthly, ongoing: c.ongoing });
    return map;
  }, [customers, data?.txns]);

  // Scorecard + status de onboarding por cliente (deriva de tudo que já foi buscado).
  const { scores, onboardingByCustomer } = useMemo(() => {
    const today = todayIso();
    const months = recentMonths(today, 3);
    const custByContact = new Map(contacts.map((c) => [c.id, c.customer_id ?? null]));
    const txns = (data?.txns ?? []) as any[];
    const metaRows = (data?.meta ?? []) as any[];
    const onbTotal = ((data?.onbSteps ?? []) as any[]).length;
    const onbTracking = (data?.onbTracking ?? []) as any[];

    // Interações por cliente (via contact.customer_id).
    const interByCust = new Map<string, CrmInteraction[]>();
    for (const it of interactions) {
      const cust = custByContact.get(it.contact_id); if (!cust) continue;
      (interByCust.get(cust) ?? interByCust.set(cust, []).get(cust)!).push(it);
    }
    // Receita histórica: LTV, 1ª data, buckets mensais recentes.
    const ltvByCust = new Map<string, number>();
    const sinceByCust = new Map<string, string>();
    const monthlyByCust = new Map<string, Map<string, number>>();
    for (const t of txns) {
      if (t.type !== "income" || !t.cliente_id) continue;
      const amt = Number(t.amount) || 0;
      ltvByCust.set(t.cliente_id, (ltvByCust.get(t.cliente_id) ?? 0) + amt);
      const d = (t.date || "").slice(0, 10);
      if (d) {
        const prev = sinceByCust.get(t.cliente_id);
        if (!prev || d < prev) sinceByCust.set(t.cliente_id, d);
        const ym = d.slice(0, 7);
        if (months.includes(ym)) {
          const mm = monthlyByCust.get(t.cliente_id) ?? monthlyByCust.set(t.cliente_id, new Map()).get(t.cliente_id)!;
          mm.set(ym, (mm.get(ym) ?? 0) + amt);
        }
      }
    }
    // Deals por cliente.
    const dealAgg = new Map<string, { open: number; openValue: number; won: number; lost: number }>();
    for (const d of deals) {
      if (!d.customer_id) continue;
      const a = dealAgg.get(d.customer_id) ?? dealAgg.set(d.customer_id, { open: 0, openValue: 0, won: 0, lost: 0 }).get(d.customer_id)!;
      const outcome = ((d as any).status_outcome || "").toLowerCase();
      const stage = (d.stage || "").toLowerCase();
      if (outcome === "won" || stage === "ganho" || stage === "won") a.won++;
      else if (outcome === "lost" || stage === "perdido" || stage === "lost") a.lost++;
      else if (!CLOSED.has(stage)) { a.open++; a.openValue += Number(d.value) || 0; }
    }
    // Próxima ação por cliente (meta dos seus contatos).
    const metaNextByCust = new Map<string, string>();
    for (const m of metaRows) {
      if (!m.next_action_date) continue;
      const cust = custByContact.get(m.contact_id); if (!cust) continue;
      const prev = metaNextByCust.get(cust);
      if (!prev || m.next_action_date < prev) metaNextByCust.set(cust, m.next_action_date);
    }
    // Onboarding por cliente (nível conta: passos concluídos entre os contatos do cliente).
    const onbDone = new Map<string, Set<string>>();
    const onbHas = new Set<string>();
    for (const r of onbTracking) {
      const cust = custByContact.get(r.contact_id); if (!cust) continue;
      onbHas.add(cust);
      if (r.status === "completed") (onbDone.get(cust) ?? onbDone.set(cust, new Set()).get(cust)!).add(r.step_id);
    }

    const onboardingByCustomer = new Map<string, OnboardingStatus>();
    const scores = new Map<string, CustomerScore>();
    for (const c of customers) {
      const rev = revenueByCustomer.get(c.id) ?? { monthly: 0, ongoing: 0 };
      const inter = (interByCust.get(c.id) ?? []).slice().sort((a, b) => b.date.localeCompare(a.date));
      const lastInteraction = inter[0]?.date ?? null;
      const interactions90d = inter.filter((i) => dayDiff(i.date.slice(0, 10), today) <= 90).length;
      const dAgg = dealAgg.get(c.id) ?? { open: 0, openValue: 0, won: 0, lost: 0 };
      const nextActionDate = c.next_action_date ?? metaNextByCust.get(c.id) ?? null;
      const mm = monthlyByCust.get(c.id);
      const revenue3m = mm ? months.map((k) => mm.get(k) ?? 0) : undefined;

      const total = onbTotal;
      const completed = onbDone.get(c.id)?.size ?? 0;
      const completeness = onbHas.has(c.id) && total > 0 ? completed / total : null;
      const onb: OnboardingStatus = { completeness, completed, total, pendentes: total > 0 && onbHas.has(c.id) ? total - completed : 0 };
      onboardingByCustomer.set(c.id, onb);

      scores.set(c.id, scoreCustomer({
        id: c.id, nome: c.nome, recorrente: c.recorrente, today,
        ongoing: rev.ongoing, monthly: rev.monthly,
        ltv: ltvByCust.get(c.id) ?? 0, sinceDate: sinceByCust.get(c.id) ?? null,
        lastInteraction, interactions90d, nextActionDate,
        openDeals: dAgg.open, openDealsValue: dAgg.openValue, wonDeals: dAgg.won, lostDeals: dAgg.lost,
        onboardingCompleteness: completeness, revenue3m,
      }));
    }
    return { scores, onboardingByCustomer };
  }, [customers, contacts, deals, interactions, data?.txns, data?.meta, data?.onbSteps, data?.onbTracking, revenueByCustomer]);

  // Next-Best-Action: fila do que fazer agora (follow-ups, deals, concentração, esfriando, onboarding, ofertas).
  const nbaItems: NbaItem[] = useMemo(() => {
    const today = todayIso();
    const nameById = new Map(customers.map((c) => [c.id, c.nome]));
    const custByContact = new Map(contacts.map((c) => [c.id, c.customer_id ?? null]));

    const nextActions: any[] = [];
    for (const c of customers) if (c.next_action_date) nextActions.push({ customerId: c.id, customerName: c.nome, date: c.next_action_date, desc: c.next_action_desc });
    for (const m of ((data?.meta ?? []) as any[])) {
      if (!m.next_action_date) continue;
      const cust = custByContact.get(m.contact_id) ?? null;
      nextActions.push({ customerId: cust, customerName: (cust && nameById.get(cust)) || "Contato", contactId: m.contact_id, date: m.next_action_date, desc: m.next_action_description });
    }

    const dealsIn = deals.map((d) => ({ id: d.id, customerId: d.customer_id ?? null, customerName: (d.customer_id && nameById.get(d.customer_id)) || d.title, title: d.title, value: d.value ?? null, stage: d.stage ?? null, expected_close_date: d.expected_close_date ?? null }));

    const revs = [...revenueByCustomer.entries()].map(([id, r]) => ({ id, ongoing: r.ongoing }));
    const total = revs.reduce((a, r) => a + r.ongoing, 0);
    const concentracao = total > 0 ? (() => { const top = revs.reduce((m, r) => (r.ongoing > m.ongoing ? r : m), revs[0]); return { customerId: top.id, customerName: nameById.get(top.id) || "?", top1Share: top.ongoing / total }; })() : null;

    const lastByCust = new Map<string, string>();
    for (const i of interactions) {
      const cust = custByContact.get(i.contact_id); if (!cust) continue;
      const prev = lastByCust.get(cust);
      if (!prev || i.date > prev) lastByCust.set(cust, i.date);
    }
    const esfriando: any[] = [];
    for (const c of customers) {
      const r = revenueByCustomer.get(c.id);
      if (!c.recorrente || !r || r.ongoing <= 0) continue;
      const last = lastByCust.get(c.id);
      const dias = last ? dayDiff(last.slice(0, 10), today) : 999;
      if (dias >= 30) esfriando.push({ customerId: c.id, customerName: c.nome, dias, ongoing: r.ongoing });
    }

    // Gaps de onboarding (só p/ quem ainda está entrando: novo/onboarding).
    const onboardingGaps: any[] = [];
    for (const c of customers) {
      const onb = onboardingByCustomer.get(c.id);
      const stage = (c.stage || "active");
      if (onb && onb.pendentes > 0 && (stage === "new" || stage === "onboarding")) onboardingGaps.push({ customerId: c.id, customerName: c.nome, pendentes: onb.pendentes });
    }
    // Ofertas (próxima melhor oferta de expansão/recorrência/cross-sell — retenção já vem por esfriando/concentração).
    const ofertas: any[] = [];
    for (const c of customers) {
      const sc = scores.get(c.id);
      if (sc?.nextOffer && sc.nextOffer.tipo !== "retencao") ofertas.push({ customerId: c.id, customerName: c.nome, titulo: sc.nextOffer.titulo, valor: null });
    }

    return buildNextBestActions({ today, nextActions, deals: dealsIn, concentracao, esfriando, onboardingGaps, ofertas });
  }, [customers, contacts, deals, interactions, data?.meta, revenueByCustomer, scores, onboardingByCustomer]);

  const invalidate = () => qc.invalidateQueries({ queryKey: ["crm"] });

  const updateCustomer = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<CustomerSpine> }) => {
      const { error } = await db.from("finance_clientes").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError: (e: any) => toast({ title: "Erro ao salvar cliente", description: e?.message, variant: "destructive" }),
  });

  const addInteraction = useMutation({
    mutationFn: async ({ contact_id, type, description }: { contact_id: string; type: string; description: string }) => {
      const { error } = await db.from("contact_interactions").insert({ contact_id, type, description });
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError: (e: any) => toast({ title: "Erro ao registrar interação", description: e?.message, variant: "destructive" }),
  });

  const updateDeal = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Record<string, any> }) => {
      const { error } = await db.from("project_opportunities").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError: (e: any) => toast({ title: "Erro ao atualizar deal", description: e?.message, variant: "destructive" }),
  });

  // Liga um contato (pessoa) a um cliente do spine — a lacuna que fazia contato novo não aparecer no 360.
  const linkContact = useMutation({
    mutationFn: async ({ contactId, customerId }: { contactId: string; customerId: string | null }) => {
      const { error } = await db.from("contacts").update({ customer_id: customerId }).eq("id", contactId);
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError: (e: any) => toast({ title: "Erro ao ligar contato", description: e?.message, variant: "destructive" }),
  });

  // Cria um deal já ligado ao cliente (e opcionalmente ao contato) — molde de Projects.saveOpportunity, mas com customer_id.
  const createDeal = useMutation({
    mutationFn: async (d: { customerId: string; title: string; value?: string | number | null; stage?: string; probability?: string | number | null; expected_close_date?: string | null; contactId?: string | null }) => {
      const { error } = await db.from("project_opportunities").insert({
        title: d.title.trim(),
        value: d.value ? Number(d.value) : null,
        stage: d.stage || "nova",
        probability: d.probability != null && d.probability !== "" ? Number(d.probability) : 50,
        expected_close_date: d.expected_close_date || null,
        customer_id: d.customerId,
        contact_id: d.contactId || null,
        project_id: null,
        company_id: scoped ? selectedCompanyId : null,
      });
      if (error) throw error;
    },
    onSuccess: () => { invalidate(); toast({ title: "Deal criado" }); },
    onError: (e: any) => toast({ title: "Erro ao criar deal", description: e?.message, variant: "destructive" }),
  });

  return {
    customers, contacts, deals, routines, interactions, revenueByCustomer, nbaItems,
    scores, onboardingByCustomer,
    isLoading: query.isLoading,
    missing: (data?.spine ?? []).length === 0 && !query.isLoading,
    updateCustomer, addInteraction, updateDeal, linkContact, createDeal,
  };
};
