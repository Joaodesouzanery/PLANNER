import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { toast } from "@/hooks/use-toast";
import { buildClientRevenue } from "@/components/ems/finance/financeClients";
import type { CustomerSpine, CrmContact, CrmDeal, CrmRoutine, CrmInteraction } from "./crm360";

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
      const [spine, contacts, deals, routines, interactions, txns] = await Promise.all([
        safe(() => db.from("finance_clientes").select("*").order("nome")),
        safe(() => co(db.from("contacts").select("id,name,customer_id,pipeline_stage,email,phone,company"))),
        safe(() => co(db.from("project_opportunities").select("id,title,value,stage,probability,expected_close_date,customer_id"))),
        safe(() => db.from("routine_clients").select("id,name,customer_id,status")),
        safe(() => db.from("contact_interactions").select("id,contact_id,type,description,date")),
        safe(() => co(db.from("financial_transactions").select("id,amount,type,is_recurring,recurrence_interval,recurrence_end_date,cliente_id"))),
      ]);
      return { spine, contacts, deals, routines, interactions, txns };
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

  return {
    customers, contacts, deals, routines, interactions, revenueByCustomer,
    isLoading: query.isLoading,
    missing: (data?.spine ?? []).length === 0 && !query.isLoading,
    updateCustomer, addInteraction,
  };
};
