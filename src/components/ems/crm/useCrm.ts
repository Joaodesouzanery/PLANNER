import { useEffect, useMemo, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { toast } from "@/hooks/use-toast";
import { buildClientRevenue } from "@/components/ems/finance/financeClients";
import { CLOSED_STAGES, type CustomerSpine, type CrmContact, type CrmDeal, type CrmRoutine, type CrmInteraction } from "./crm360";
import { buildNextBestActions, type NbaItem } from "./buildNextBestActions";
import { scoreCustomer, type CustomerScore } from "./crmScores";

const todayIso = () => new Date().toISOString().slice(0, 10);
const dayDiff = (from: string, to: string) => Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
const CLOSED = CLOSED_STAGES;

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
      const [spine, contacts, deals, routines, interactions, meta, txns, onbSteps, onbTracking, tasks, projects, stageEvents] = await Promise.all([
        safe(() => db.from("finance_clientes").select("*").order("nome")),
        safe(() => co(db.from("contacts").select("id,name,customer_id,pipeline_stage,email,phone,company,company_id"))),
        safe(() => co(db.from("project_opportunities").select("id,title,value,stage,probability,expected_close_date,status_outcome,close_reason,customer_id,contact_id,project_id,company_id,modulo_id,ativo_origem_id,created_at"))),
        safe(() => db.from("routine_clients").select("id,name,customer_id,status")),
        safe(() => db.from("contact_interactions").select("id,contact_id,type,description,date")),
        safe(() => db.from("commercial_contact_meta").select("contact_id,next_action_date,next_action_description,last_contact_date")),
        safe(() => co(db.from("financial_transactions").select("id,amount,type,is_recurring,recurrence_interval,recurrence_end_date,cliente_id,date,description"))),
        safe(() => db.from("onboarding_steps").select("id")),
        safe(() => db.from("contact_onboarding_tracking").select("contact_id,step_id,status")),
        safe(() => co(db.from("tasks").select("id,title,status,due_date,priority,contact_id,project_id")).neq("status", "completed").neq("status", "done")),
        safe(() => co(db.from("projects").select("id,title,status,next_invoice_date"))),
        safe(() => co(db.from("crm_stage_events").select("deal_id,to_stage,moved_at"))),
      ]);
      return { spine, contacts, deals, routines, interactions, meta, txns, onbSteps, onbTracking, tasks, projects, stageEvents };
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
      if (outcome === "won" || stage === "ganho" || stage === "ganha" || stage === "won") a.won++;
      else if (outcome === "lost" || stage === "perdido" || stage === "perdida" || stage === "lost") a.lost++;
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

    // Último contato: interações (contact_interactions) + o "último contato" manual (commercial_contact_meta).
    const lastByCust = new Map<string, string>();
    const touch = (cust: string | null | undefined, date: string | null | undefined) => {
      if (!cust || !date) return;
      const d = String(date).slice(0, 10);
      const prev = lastByCust.get(cust);
      if (!prev || d > prev) lastByCust.set(cust, d);
    };
    for (const i of interactions) touch(custByContact.get(i.contact_id), i.date);
    for (const m of ((data?.meta ?? []) as any[])) touch(custByContact.get(m.contact_id), m.last_contact_date);

    const esfriando: any[] = [];
    for (const c of customers) {
      const r = revenueByCustomer.get(c.id);
      if (!c.recorrente || !r || r.ongoing <= 0) continue;
      const last = lastByCust.get(c.id);
      if (!last) continue; // sem contato registrado → não inventa "999d" (higiene de dado, não esfriamento)
      const dias = dayDiff(last, today);
      if (dias >= 21) esfriando.push({ customerId: c.id, customerName: c.nome, dias, ongoing: r.ongoing });
    }

    // Follow-up 48h: deal ABERTO parado há ≥2d numa etapa de espera (abordado/documento/proposta) → 1 toque e para.
    const lastMovedByDeal = new Map<string, string>();
    for (const e of ((data?.stageEvents ?? []) as any[])) {
      const prev = lastMovedByDeal.get(e.deal_id);
      if (!prev || e.moved_at > prev) lastMovedByDeal.set(e.deal_id, e.moved_at);
    }
    // Etapas de espera (após abordar/enviar doc) onde um deal parado 48h pede 1 toque — keys do template + legadas.
    const FOLLOWUP_STAGES = new Set(["abordado", "documento", "qualificado", "fechamento", "proposta", "negociacao"]);
    const followUps48h: any[] = [];
    for (const d of deals) {
      if (d.status_outcome === "won" || d.status_outcome === "lost") continue;
      if (!FOLLOWUP_STAGES.has(String(d.stage || "").toLowerCase())) continue;
      const moved = lastMovedByDeal.get(d.id);
      if (!moved) continue;
      const dias = dayDiff(String(moved).slice(0, 10), today);
      if (dias >= 2) followUps48h.push({ dealId: d.id, customerId: d.customer_id ?? null, customerName: (d.customer_id && nameById.get(d.customer_id)) || d.title, title: d.title, dias });
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

    return buildNextBestActions({ today, nextActions, deals: dealsIn, concentracao, esfriando, onboardingGaps, ofertas, followUps48h, esfriandoDias: 21 });
  }, [customers, contacts, deals, interactions, data?.meta, data?.stageEvents, revenueByCustomer, scores, onboardingByCustomer]);

  // Saúde ÚNICA: persiste a saúde CALCULADA em finance_clientes.health (a fonte que o Conselho lê),
  // pra Central de Atenção e CRM não divergirem. Converge em 1 rodada (após escrever, calculado == salvo).
  const syncingRef = useRef(false);
  useEffect(() => {
    // Só sincroniza no view "todas as empresas": com empresa específica, os satélites (contatos/deals/
    // interações) vêm filtrados e a saúde calculada seria falsa (baixa) p/ clientes de outra empresa.
    if (scoped || query.isLoading || syncingRef.current || customers.length === 0) return;
    const diffs = customers.filter((c) => { const h = scores.get(c.id)?.health; return h && h !== (c.health || null); });
    if (diffs.length === 0) return;
    syncingRef.current = true;
    (async () => {
      try {
        await Promise.all(diffs.map((c) => db.from("finance_clientes").update({ health: scores.get(c.id)!.health }).eq("id", c.id)));
        qc.invalidateQueries({ queryKey: ["crm"] });
        qc.invalidateQueries({ queryKey: ["board-attention"] });
      } finally { syncingRef.current = false; }
    })();
  }, [customers, scores, query.isLoading, qc]);

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

  // Cria um contato (pessoa) já ligado a um cliente do spine, direto do CRM.
  const createContact = useMutation({
    mutationFn: async (c: { name: string; email?: string; phone?: string; company?: string; customerId?: string | null; stage?: string | null; companyId?: string | null }) => {
      const { error } = await db.from("contacts").insert({
        name: c.name.trim(),
        email: c.email?.trim() || null,
        phone: c.phone?.trim() || null,
        company: c.company?.trim() || null,
        customer_id: c.customerId || null,
        ...(c.stage ? { pipeline_stage: c.stage } : {}),
        company_id: c.companyId !== undefined ? c.companyId : scoped ? selectedCompanyId : null,
      });
      if (error) throw error;
    },

    onSuccess: () => { invalidate(); toast({ title: "Contato criado" }); },
    onError: (e: any) => toast({ title: "Erro ao criar contato", description: e?.message, variant: "destructive" }),
  });

  const updateContact = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Record<string, any> }) => {
      const { error } = await db.from("contacts").update(patch).eq("id", id); if (error) throw error;
    },
    onSuccess: invalidate,
    onError: (e: any) => toast({ title: "Erro ao atualizar contato", description: e?.message, variant: "destructive" }),
  });

  const deleteContact = useMutation({
    mutationFn: async (id: string) => { const { error } = await db.from("contacts").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { invalidate(); toast({ title: "Contato removido" }); },
    onError: (e: any) => toast({ title: "Erro ao remover contato", description: e?.message, variant: "destructive" }),
  });

  // Cria uma tarefa ligada a um contato do cliente (reusa a tabela tasks — molde de Contacts.saveTask).
  const createTask = useMutation({
    mutationFn: async (t: { title: string; contactId?: string | null; due_date?: string | null; priority?: string }) => {
      const { error } = await db.from("tasks").insert({
        title: t.title.trim(), contact_id: t.contactId || null,
        due_date: t.due_date || todayIso(), priority: t.priority || "medium",
        company_id: scoped ? selectedCompanyId : null,
      });
      if (error) throw error;
    },
    onSuccess: () => { invalidate(); qc.invalidateQueries({ queryKey: ["contact-tasks"] }); qc.invalidateQueries({ queryKey: ["tasks"] }); toast({ title: "Tarefa criada" }); },
    onError: (e: any) => toast({ title: "Erro ao criar tarefa", description: e?.message, variant: "destructive" }),
  });

  // Cria um deal já ligado ao cliente (e opcionalmente ao contato) — molde de Projects.saveOpportunity, mas com customer_id.
  const createDeal = useMutation({
    mutationFn: async (d: { customerId: string; title: string; value?: string | number | null; stage?: string; probability?: string | number | null; expected_close_date?: string | null; contactId?: string | null; moduloId?: string | null; ativoOrigemId?: string | null }) => {
      const { error } = await db.from("project_opportunities").insert({
        title: d.title.trim(),
        value: d.value ? Number(d.value) : null,
        stage: d.stage || "nova",
        probability: d.probability != null && d.probability !== "" ? Number(d.probability) : 50,
        expected_close_date: d.expected_close_date || null,
        customer_id: d.customerId,
        contact_id: d.contactId || null,
        modulo_id: d.moduloId || null,
        ativo_origem_id: d.ativoOrigemId || null,
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
    tasks: (data?.tasks ?? []) as any[],
    projects: (data?.projects ?? []) as any[],
    transactions: (data?.txns ?? []) as any[],
    isLoading: query.isLoading,
    missing: (data?.spine ?? []).length === 0 && !query.isLoading,
    updateCustomer, addInteraction, updateDeal, linkContact, createContact, updateContact, deleteContact, createTask, createDeal,
  };
};
