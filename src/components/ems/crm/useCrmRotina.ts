import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { startOfWeek, format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { toast } from "@/hooks/use-toast";
import type { RotinaBloco } from "./crmRotina";

// Rotina semanal (crm_rotina_blocos) por produto (company). "Feito nesta semana" = done_week na 2ª atual.
const db = supabase as any;
const safe = async (build: () => any): Promise<any[]> => {
  try { const { data, error } = await build(); if (error) return []; return data ?? []; } catch { return []; }
};

/** 2ª-feira (yyyy-MM-dd) da semana atual — a âncora do "feito nesta semana". */
export const currentMonday = () => format(startOfWeek(new Date(), { weekStartsOn: 1 }), "yyyy-MM-dd");

export const useCrmRotina = () => {
  const qc = useQueryClient();
  const { selectedCompanyId } = useCompany();
  const scoped = selectedCompanyId && selectedCompanyId !== "all";
  const companyId = scoped ? selectedCompanyId : null;
  const co = (q: any) => (scoped ? q.eq("company_id", selectedCompanyId) : q.is("company_id", null));

  const query = useQuery({
    queryKey: ["crm-rotina", selectedCompanyId],
    staleTime: 60_000,
    queryFn: async () =>
      safe(() => co(db.from("crm_rotina_blocos").select("id,weekday,canal,titulo,modulo_id,order_index,done_week")).order("weekday").order("order_index")),
  });
  const blocos = (query.data ?? []) as RotinaBloco[];
  const monday = currentMonday();
  const isDone = (b: RotinaBloco) => b.done_week === monday;

  const invalidate = () => qc.invalidateQueries({ queryKey: ["crm-rotina"] });

  const saveBloco = useMutation({
    mutationFn: async (b: Partial<RotinaBloco> & { id?: string }) => {
      const patch = { weekday: b.weekday ?? 1, canal: b.canal || null, titulo: b.titulo, modulo_id: b.modulo_id || null };
      if (b.id) {
        const { error } = await db.from("crm_rotina_blocos").update(patch).eq("id", b.id);
        if (error) throw error;
      } else {
        const maxOrder = blocos.filter((x) => x.weekday === (b.weekday ?? 1)).reduce((mx, x) => Math.max(mx, x.order_index), -1);
        const { error } = await db.from("crm_rotina_blocos").insert({ ...patch, order_index: maxOrder + 1, company_id: companyId });
        if (error) throw error;
      }
    },
    onSuccess: invalidate,
    onError: (e: any) => toast({ title: "Erro ao salvar bloco", description: e?.message, variant: "destructive" }),
  });

  const deleteBloco = useMutation({
    mutationFn: async (id: string) => { const { error } = await db.from("crm_rotina_blocos").delete().eq("id", id); if (error) throw error; },
    onSuccess: invalidate,
    onError: (e: any) => toast({ title: "Erro ao excluir bloco", description: e?.message, variant: "destructive" }),
  });

  // Marca/desmarca "feito nesta semana" (done_week = 2ª atual ou null).
  const toggleDone = useMutation({
    mutationFn: async (b: RotinaBloco) => {
      if (!b.id) return;
      const { error } = await db.from("crm_rotina_blocos").update({ done_week: isDone(b) ? null : monday }).eq("id", b.id);
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError: (e: any) => toast({ title: "Erro ao marcar", description: e?.message, variant: "destructive" }),
  });

  const seedDefault = useMutation({
    mutationFn: async (template: RotinaBloco[]) => {
      if (blocos.length > 0) return; // já tem rotina — não duplica
      const { error } = await db.from("crm_rotina_blocos").insert(
        template.map((t) => ({ weekday: t.weekday, canal: t.canal, titulo: t.titulo, modulo_id: t.modulo_id, order_index: t.order_index, company_id: companyId })),
      );
      if (error) throw error;
    },
    onSuccess: () => { invalidate(); toast({ title: "Rotina gerada" }); },
    onError: (e: any) => toast({ title: "Erro ao gerar rotina", description: e?.message, variant: "destructive" }),
  });

  return { blocos, isEmpty: blocos.length === 0, isLoading: query.isLoading, isDone, saveBloco, deleteBloco, toggleDone, seedDefault };
};
