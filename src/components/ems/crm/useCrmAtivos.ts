import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { toast } from "@/hooks/use-toast";
import type { CrmAtivo } from "./crmAtivos";

// Matriz de ativos (crm_ativos). Dados (não config) → em "todas" agrega os produtos (scoped?eq:q, como deals).
const db = supabase as any;
const safe = async (build: () => any): Promise<any[]> => {
  try { const { data, error } = await build(); if (error) return []; return data ?? []; } catch { return []; }
};
const numOrNull = (v: unknown) => (v === "" || v == null ? null : Number(v));

export const useCrmAtivos = () => {
  const qc = useQueryClient();
  const { selectedCompanyId } = useCompany();
  const scoped = selectedCompanyId && selectedCompanyId !== "all";
  const companyId = scoped ? selectedCompanyId : null;
  const co = (q: any) => (scoped ? q.eq("company_id", selectedCompanyId) : q);

  const query = useQuery({
    queryKey: ["crm-ativos", selectedCompanyId],
    staleTime: 60_000,
    queryFn: async () =>
      safe(() =>
        co(db.from("crm_ativos").select("id,modulo_id,tipo,titulo,angulo_de_dor,variante_de_copy,canal,data,leads_gerados,impressions,views,opens,notes"))
          .order("data", { ascending: false, nullsFirst: false }),
      ),
  });
  const ativos = (query.data ?? []) as CrmAtivo[];

  const invalidate = () => qc.invalidateQueries({ queryKey: ["crm-ativos"] });

  const saveAtivo = useMutation({
    mutationFn: async (a: Partial<CrmAtivo> & { id?: string }) => {
      const patch = {
        modulo_id: a.modulo_id || null,
        tipo: a.tipo || "post",
        titulo: a.titulo,
        angulo_de_dor: a.angulo_de_dor || null,
        variante_de_copy: a.variante_de_copy || null,
        canal: a.canal || null,
        data: a.data || null,
        leads_gerados: numOrNull(a.leads_gerados) ?? 0,
        impressions: numOrNull(a.impressions),
        views: numOrNull(a.views),
        opens: numOrNull(a.opens),
        notes: a.notes || null,
      };
      if (a.id) {
        const { error } = await db.from("crm_ativos").update(patch).eq("id", a.id);
        if (error) throw error;
      } else {
        const { error } = await db.from("crm_ativos").insert({ ...patch, company_id: companyId });
        if (error) throw error;
      }
    },
    onSuccess: () => { invalidate(); toast({ title: "Ativo salvo" }); },
    onError: (e: any) => toast({ title: "Erro ao salvar ativo", description: e?.message, variant: "destructive" }),
  });

  const deleteAtivo = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db.from("crm_ativos").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { invalidate(); toast({ title: "Ativo removido" }); },
    onError: (e: any) => toast({ title: "Erro ao remover ativo", description: e?.message, variant: "destructive" }),
  });

  return { ativos, isLoading: query.isLoading, saveAtivo, deleteAtivo };
};
