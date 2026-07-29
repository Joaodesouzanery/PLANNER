import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { toast } from "@/hooks/use-toast";
import { gerarAtividades } from "./cadencias";

// Atividades (log de toque + agenda). Aplicar cadência gera atividades; concluir marca feito.
const db = supabase as any;
const safe = async (build: () => any): Promise<any[]> => {
  try { const { data, error } = await build(); if (error) return []; return data ?? []; } catch { return []; }
};

export interface Atividade {
  id: string;
  deal_id: string | null;
  tipo: string;
  status: string;
  data_prevista: string | null;
  data_feito: string | null;
  cadencia_id: string | null;
  passo_n: number | null;
  resultado: string | null;
}

export const useCrmAtividades = () => {
  const qc = useQueryClient();
  const { selectedCompanyId } = useCompany();
  const scoped = selectedCompanyId && selectedCompanyId !== "all";
  const companyId = scoped ? selectedCompanyId : null;
  const co = (q: any) => (scoped ? q.eq("company_id", selectedCompanyId) : q);

  const query = useQuery({
    queryKey: ["crm-atividades", selectedCompanyId],
    staleTime: 30_000,
    queryFn: () =>
      safe(() => co(db.from("crm_atividades").select("id,deal_id,tipo,status,data_prevista,data_feito,cadencia_id,passo_n,resultado")).order("data_prevista", { ascending: true, nullsFirst: false })),
  });
  const atividades = (query.data ?? []) as Atividade[];

  const invalidate = () => qc.invalidateQueries({ queryKey: ["crm-atividades"] });
  const err = (title: string) => (e: any) => toast({ title, description: e?.message, variant: "destructive" });

  const aplicarCadencia = useMutation({
    mutationFn: async ({ dealId, cadenciaId }: { dealId: string; cadenciaId: string }) => {
      const passos = await safe(() => db.from("crm_cadencia_passos").select("passo_n,canal,dia_offset").eq("cadencia_id", cadenciaId));
      if (!passos.length) throw new Error("Cadência sem passos");
      const seeds = gerarAtividades(dealId, cadenciaId, passos as any[], new Date().toISOString());
      const { error } = await db.from("crm_atividades").insert(seeds.map((s) => ({ ...s, company_id: companyId })));
      if (error) throw error;
    },
    onSuccess: () => { invalidate(); toast({ title: "Cadência aplicada — atividades geradas" }); },
    onError: err("Erro ao aplicar cadência"),
  });

  const concluir = useMutation({
    mutationFn: async ({ id, resultado }: { id: string; resultado?: string | null }) => {
      const { error } = await db.from("crm_atividades").update({ status: "feito", data_feito: new Date().toISOString(), resultado: resultado || null }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError: err("Erro ao concluir atividade"),
  });

  const criar = useMutation({
    mutationFn: async (a: { deal_id: string; tipo: string; data_prevista?: string | null }) => {
      const { error } = await db.from("crm_atividades").insert({ deal_id: a.deal_id, tipo: a.tipo, status: "pendente", data_prevista: a.data_prevista || new Date().toISOString().slice(0, 10), company_id: companyId });
      if (error) throw error;
    },
    onSuccess: () => { invalidate(); toast({ title: "Atividade criada" }); },
    onError: err("Erro ao criar atividade"),
  });

  return { atividades, isLoading: query.isLoading, aplicarCadencia, concluir, criar };
};
