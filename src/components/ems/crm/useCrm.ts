import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { toast } from "@/hooks/use-toast";
import { buildClientRevenue } from "@/components/ems/finance/financeClients";
import type { CustomerSpine, CrmContact, CrmDeal, CrmRoutine, CrmInteraction } from "./crm360";
import { buildNextBestActions, type NbaItem } from "./buildNextBestActions";

const todayIso = () => new Date().toISOString().slice(0, 10);

const db = supabase as any;
const safe = async (build: () => any): Promise<any[]> => {
  try { const { data, error } = await build(); if (error) return []; return data ?? []; } catch { return []; }
};

/** Fonte única do CRM: spine (finance_clientes + campos CRM) + satélites + receita por cliente. */
export const useCrm = () => {
  const qc = useQueryClient();
  const { selectedCompanyId } = useCompany();
  const scoped = selectedCompanyId && selectedCompanyId !== "all";
  const co = (q: any) => (scoped ? q.eq("company_id", selectedCompanyId) : q);

  const query = useQuery({
    queryKey: ["crm", selectedCompanyId],
    staleTime: 60_000,
    queryFn: async () => {
      const [spine, contacts, deals, routines, interactions, meta, txns] = await Promise.all([
        safe(() => db.from("finance_clientes").select("*").order("nome")),
        safe(() => co(db.from("contacts").select("id,name,customer_id,pipeline_stage,email,phone,company"))),
        safe(() => co(db.from("project_opportunities").select("id,title,value,stage,probability,expected_close_date,status_outcome,customer_id,contact_id"))),
        safe(() => db.from("routine_clients").select("id,name,customer_id,status")),
        safe(() => db.from("contact_interactions").select("id,contact_id,type,description,date")),
        safe(() => db.from("commercial_contact_meta").select("contact_id,next_action_date,next_action_description")),
        safe(() => co(db.from("financial_transactions").select("id,amount,type,is_recurring,recurrence_interval,recurrence_end_date,cliente_id"))),
      ]);
      return { spine, contacts, deals, routines, interactions, meta, txns };
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

  // Next-Best-Action: a fila do que fazer agora (follow-ups vencidos, deals, concentração, esfriando).
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
      const cust = custByContact.get(i.contact_id);
      if (!cust) continue;
      const prev = lastByCust.get(cust);
      if (!prev || i.date > prev) lastByCust.set(cust, i.date);
    }
    const esfriando: any[] = [];
    for (const c of customers) {
      const r = revenueByCustomer.get(c.id);
      if (!c.recorrente || !r || r.ongoing <= 0) continue;
      const last = lastByCust.get(c.id);
      const dias = last ? Math.round((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${last.slice(0, 10)}T00:00:00Z`)) / 86_400_000) : 999;
      if (dias >= 30) esfriando.push({ customerId: c.id, customerName: c.nome, dias, ongoing: r.ongoing });
    }

    return buildNextBestActions({ today, nextActions, deals: dealsIn, concentracao, esfriando });
  }, [customers, contacts, deals, interactions, data?.meta, revenueByCustomer]);

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

  return {
    customers, contacts, deals, routines, interactions, revenueByCustomer, nbaItems,
    isLoading: query.isLoading,
    missing: (data?.spine ?? []).length === 0 && !query.isLoading,
    updateCustomer, addInteraction, updateDeal,
  };
};
