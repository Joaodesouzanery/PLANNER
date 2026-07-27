import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { toast } from "@/hooks/use-toast";
import { DEFAULT_STAGES, DEFAULT_STAGE_COLOR, slugifyStage, type CrmStage } from "./crmStages";

// Etapas do funil (crm_stages) por empresa. Degrada gracioso: se a tabela não existe ou está vazia,
// cai no template padrão (constante) — o board sempre renderiza; customização persiste depois.
const db = supabase as any;
const safe = async (build: () => any): Promise<any[]> => {
  try { const { data, error } = await build(); if (error) return []; return data ?? []; } catch { return []; }
};

export const useCrmStages = () => {
  const qc = useQueryClient();
  const { selectedCompanyId } = useCompany();
  const scoped = selectedCompanyId && selectedCompanyId !== "all";
  const companyId = scoped ? selectedCompanyId : null;
  // Etapas são config pequena: na visão "todas" usa o conjunto global (company_id null); espelha a gravação.
  const co = (q: any) => (scoped ? q.eq("company_id", selectedCompanyId) : q.is("company_id", null));

  const query = useQuery({
    queryKey: ["crm-stages", selectedCompanyId],
    staleTime: 60_000,
    queryFn: async () =>
      safe(() => co(db.from("crm_stages").select("id,key,title,order_index,color,outcome,is_offtrack").order("order_index"))),
  });
  const rows = (query.data ?? []) as CrmStage[];
  const isDefault = rows.length === 0;
  const stages = isDefault ? DEFAULT_STAGES : rows;

  const invalidate = () => qc.invalidateQueries({ queryKey: ["crm-stages"] });

  const saveStage = useMutation({
    mutationFn: async (s: Partial<CrmStage> & { id?: string }) => {
      if (s.id) {
        const { error } = await db
          .from("crm_stages")
          .update({ title: s.title, color: s.color, outcome: s.outcome ?? null, is_offtrack: !!s.is_offtrack })
          .eq("id", s.id);
        if (error) throw error;
      } else {
        const maxOrder = rows.length ? Math.max(...rows.map((r) => r.order_index)) : -1;
        const { error } = await db.from("crm_stages").insert({
          key: s.key || slugifyStage(s.title || ""),
          title: s.title,
          color: s.color || DEFAULT_STAGE_COLOR,
          outcome: s.outcome ?? null,
          is_offtrack: !!s.is_offtrack,
          order_index: maxOrder + 1,
          company_id: companyId,
        });
        if (error) throw error;
      }
    },
    onSuccess: invalidate,
    onError: (e: any) => toast({ title: "Erro ao salvar etapa", description: e?.message, variant: "destructive" }),
  });

  const deleteStage = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db.from("crm_stages").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError: (e: any) => toast({ title: "Erro ao excluir etapa", description: e?.message, variant: "destructive" }),
  });

  const reorderStages = useMutation({
    mutationFn: async (orderedIds: string[]) => {
      for (let i = 0; i < orderedIds.length; i++) {
        const { error } = await db.from("crm_stages").update({ order_index: i }).eq("id", orderedIds[i]);
        if (error) throw error;
      }
    },
    onSuccess: invalidate,
    onError: (e: any) => toast({ title: "Erro ao reordenar", description: e?.message, variant: "destructive" }),
  });

  // Batch-insert de um template (idempotente por key: pula as que já existem no escopo).
  const seedStages = useMutation({
    mutationFn: async (template: CrmStage[]) => {
      const existing = new Set(rows.map((r) => r.key));
      const toInsert = template
        .filter((t) => !existing.has(t.key))
        .map((t) => ({
          key: t.key,
          title: t.title,
          color: t.color,
          outcome: t.outcome ?? null,
          is_offtrack: !!t.is_offtrack,
          order_index: t.order_index,
          company_id: companyId,
        }));
      if (!toInsert.length) return;
      const { error } = await db.from("crm_stages").insert(toInsert);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast({ title: "Quadro gerado" });
    },
    onError: (e: any) => toast({ title: "Erro ao gerar quadro", description: e?.message, variant: "destructive" }),
  });

  return { stages, rows, isDefault, isLoading: query.isLoading, saveStage, deleteStage, reorderStages, seedStages };
};
