import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { configAsOf, type ConfigRow } from "./configTimeline";

// Regra-Mestre · CRUD + leitura as-of da camada de config datada (consolidada: company_id null).
// Config é global do usuário (não escopada por empresa) — é a fonte única que o DRE/painéis leem.
const db = supabase as any;
const safe = async (build: () => any): Promise<any[]> => {
  try { const { data, error } = await build(); if (error) return []; return data ?? []; } catch { return []; }
};

export interface ConfigTimelineRow extends ConfigRow {
  id: string;
  note: string | null;
}

export const useConfigTimeline = () => {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["finance-config-timeline"],
    staleTime: 60_000,
    queryFn: async () =>
      safe(() => db.from("finance_config_timeline").select("id,key,value,effective_date,note").order("effective_date", { ascending: true })),
  });
  const rows = (query.data ?? []) as ConfigTimelineRow[];

  const valueAsOf = (key: string, monthKey: string) => configAsOf(rows, key, monthKey);
  const byKey = (key: string) => rows.filter((r) => r.key === key);

  const invalidate = () => qc.invalidateQueries({ queryKey: ["finance-config-timeline"] });

  const saveValue = useMutation({
    mutationFn: async (v: { id?: string; key: string; value: number; effective_date: string; note?: string | null }) => {
      const patch = { key: v.key, value: Number(v.value), effective_date: v.effective_date, note: v.note ?? null };
      // Resolve a linha alvo: id explícito, ou uma vigência já existente na mesma (key, data) — assim salvar
      // a mesma data ATUALIZA em vez de estourar o índice único.
      const targetId = v.id ?? rows.find((r) => r.key === v.key && r.effective_date === v.effective_date)?.id;
      if (targetId) {
        const { error } = await db.from("finance_config_timeline").update(patch).eq("id", targetId);
        if (error) throw error;
      } else {
        const { error } = await db.from("finance_config_timeline").insert({ ...patch, company_id: null });
        if (error) throw error;
      }
    },
    onSuccess: () => { invalidate(); toast({ title: "Vigência salva" }); },
    onError: (e: any) => toast({ title: "Erro ao salvar vigência", description: e?.message, variant: "destructive" }),
  });

  const deleteValue = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db.from("finance_config_timeline").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { invalidate(); toast({ title: "Vigência removida" }); },
    onError: (e: any) => toast({ title: "Erro ao remover", description: e?.message, variant: "destructive" }),
  });

  return { rows, isLoading: query.isLoading, valueAsOf, byKey, saveValue, deleteValue };
};
