import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import type { DreLine } from "./financeDre";

const db = supabase as any;
const missingCode = (e: any) => e?.code === "42P01" || e?.code === "PGRST205";

/** Overrides categoria → linha da DRE (correções do usuário sobre a heurística). */
export const useDreCategories = () => {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["finance-dre-categories"],
    queryFn: async () => {
      const { data, error } = await db.from("finance_dre_categories").select("category, dre_line");
      if (error) { if (missingCode(error)) return { missing: true, rows: [] as any[] }; throw error; }
      return { missing: false, rows: (data ?? []) as { category: string; dre_line: DreLine }[] };
    },
    retry: false,
  });

  const overrides = useMemo(() => {
    const map: Record<string, DreLine> = {};
    for (const r of query.data?.rows ?? []) map[r.category] = r.dre_line;
    return map;
  }, [query.data]);

  const setOverride = useMutation({
    mutationFn: async ({ category, dre_line }: { category: string; dre_line: DreLine }) => {
      const { error } = await db.from("finance_dre_categories").upsert({ category, dre_line }, { onConflict: "user_id,category" });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["finance-dre-categories"] }),
    onError: (e: any) => toast({ title: "Erro ao classificar", description: e?.message, variant: "destructive" }),
  });

  return { overrides, missing: query.data?.missing ?? false, setOverride };
};
