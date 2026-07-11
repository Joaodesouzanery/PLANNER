import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

const db = supabase as any;
const missingCode = (e: any) => e?.code === "42P01" || e?.code === "PGRST205";

export interface CategoryBudgetRow { id: string; category: string; year: number; month: number; teto: number }

export const useCategoryBudgets = (year: number, month: number) => {
  const qc = useQueryClient();
  const key = ["finance-category-budgets", year, month];

  const query = useQuery({
    queryKey: key,
    queryFn: async () => {
      const { data, error } = await db.from("finance_category_budgets").select("*").eq("year", year).eq("month", month);
      if (error) { if (missingCode(error)) return { missing: true, rows: [] as CategoryBudgetRow[] }; throw error; }
      return { missing: false, rows: (data ?? []) as CategoryBudgetRow[] };
    },
    retry: false,
  });

  const setTeto = useMutation({
    mutationFn: async ({ category, teto }: { category: string; teto: number }) => {
      const { error } = await db.from("finance_category_budgets").upsert(
        { category, year, month, teto },
        { onConflict: "user_id,category,year,month" },
      );
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
    onError: (e: any) => toast({ title: "Erro ao salvar teto", description: e?.message, variant: "destructive" }),
  });

  const removeTeto = useMutation({
    mutationFn: async (id: string) => { const { error } = await db.from("finance_category_budgets").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });

  const copyPrevMonth = useMutation({
    mutationFn: async () => {
      const pm = month === 1 ? 12 : month - 1;
      const py = month === 1 ? year - 1 : year;
      const { data, error } = await db.from("finance_category_budgets").select("category, teto").eq("year", py).eq("month", pm);
      if (error) throw error;
      if (!data?.length) return 0;
      const rows = data.map((r: any) => ({ category: r.category, year, month, teto: r.teto }));
      const { error: upErr } = await db.from("finance_category_budgets").upsert(rows, { onConflict: "user_id,category,year,month" });
      if (upErr) throw upErr;
      return rows.length;
    },
    onSuccess: (n: number) => { qc.invalidateQueries({ queryKey: key }); toast({ title: n ? `${n} tetos copiados` : "Mês anterior sem tetos" }); },
    onError: (e: any) => toast({ title: "Erro ao copiar", description: e?.message, variant: "destructive" }),
  });

  return {
    budgets: query.data?.rows ?? [],
    missing: query.data?.missing ?? false,
    isLoading: query.isLoading,
    setTeto, removeTeto, copyPrevMonth,
  };
};
