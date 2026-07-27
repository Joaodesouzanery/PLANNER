import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { toast } from "@/hooks/use-toast";

// Motor de Prova (crm_provas). Dados (não config) → em "todas" agrega os produtos (scoped?eq:q, como deals).
const db = supabase as any;
const safe = async (build: () => any): Promise<any[]> => {
  try { const { data, error } = await build(); if (error) return []; return data ?? []; } catch { return []; }
};

export interface CrmProva {
  id?: string;
  customer_id: string | null;
  modulo_id: string | null;
  titulo: string;
  resultado_valor: number | null;
  evidencia: string | null;
  permissao_uso: boolean;
  data: string | null;
  descricao: string | null;
}

export const useCrmProvas = () => {
  const qc = useQueryClient();
  const { selectedCompanyId } = useCompany();
  const scoped = selectedCompanyId && selectedCompanyId !== "all";
  const companyId = scoped ? selectedCompanyId : null;
  const co = (q: any) => (scoped ? q.eq("company_id", selectedCompanyId) : q);

  const query = useQuery({
    queryKey: ["crm-provas", selectedCompanyId],
    staleTime: 60_000,
    queryFn: async () =>
      safe(() =>
        co(db.from("crm_provas").select("id,customer_id,modulo_id,titulo,resultado_valor,evidencia,permissao_uso,data,descricao"))
          .order("data", { ascending: false, nullsFirst: false }),
      ),
  });
  const provas = (query.data ?? []) as CrmProva[];

  const invalidate = () => qc.invalidateQueries({ queryKey: ["crm-provas"] });

  const saveProva = useMutation({
    mutationFn: async (p: Partial<CrmProva> & { id?: string }) => {
      const patch = {
        customer_id: p.customer_id || null,
        modulo_id: p.modulo_id || null,
        titulo: p.titulo,
        resultado_valor: p.resultado_valor === undefined || p.resultado_valor === null || (p.resultado_valor as any) === "" ? null : Number(p.resultado_valor),
        evidencia: p.evidencia || null,
        permissao_uso: !!p.permissao_uso,
        data: p.data || null,
        descricao: p.descricao || null,
      };
      if (p.id) {
        const { error } = await db.from("crm_provas").update(patch).eq("id", p.id);
        if (error) throw error;
      } else {
        const { error } = await db.from("crm_provas").insert({ ...patch, company_id: companyId });
        if (error) throw error;
      }
    },
    onSuccess: () => { invalidate(); toast({ title: "Prova salva" }); },
    onError: (e: any) => toast({ title: "Erro ao salvar prova", description: e?.message, variant: "destructive" }),
  });

  const deleteProva = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db.from("crm_provas").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { invalidate(); toast({ title: "Prova removida" }); },
    onError: (e: any) => toast({ title: "Erro ao remover prova", description: e?.message, variant: "destructive" }),
  });

  return { provas, isLoading: query.isLoading, saveProva, deleteProva };
};
