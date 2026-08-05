/* eslint-disable @typescript-eslint/no-explicit-any */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import type { CostBucket } from "./financeCosts";

const db = supabase as any;

/** Tipos de custo (Fixos, Variáveis e os que o usuário criar). */
export const useCostBuckets = () => {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ["finance-cost-buckets"],
    queryFn: async (): Promise<CostBucket[]> => {
      const { data, error } = await db.from("finance_cost_buckets").select("*").order("sort_order");
      if (error) {
        if (error.code === "42P01" || error.code === "PGRST205") return [];
        throw error;
      }
      return (data || []) as CostBucket[];
    },
    retry: false,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["finance-cost-buckets"] });

  const save = useMutation({
    mutationFn: async (payload: Partial<CostBucket> & { id?: string }) => {
      const { id, ...rest } = payload;
      const { error } = id
        ? await db.from("finance_cost_buckets").update(rest).eq("id", id)
        : await db.from("finance_cost_buckets").insert(rest);
      if (error) throw error;
    },
    onSuccess: () => { invalidate(); toast({ title: "Tipo de custo salvo" }); },
    onError: (e: any) => toast({ title: "Erro ao salvar tipo", description: e?.message, variant: "destructive" }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db.from("finance_cost_buckets").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { invalidate(); toast({ title: "Tipo removido" }); },
    onError: (e: any) => toast({ title: "Erro ao remover", description: e?.message, variant: "destructive" }),
  });

  return { buckets: query.data || [], isLoading: query.isLoading, save, remove };
};
