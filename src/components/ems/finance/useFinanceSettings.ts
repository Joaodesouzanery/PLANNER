import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { DEFAULT_CFO } from "./financeCfo";

const db = supabase as any;

export interface FinanceSettings {
  tax_regime: string;
  tax_rate: number;
  reserve_months: number;
  cdi_monthly_liquid: number;
  opening_bank_balance: number | null;
  // Despesa esperada em 3 baldes (null = usar sugestão da projeção).
  expected_expense_fixo: number | null;
  expected_expense_variavel: number | null;
  expected_expense_anual: number | null;
}

const FALLBACK: FinanceSettings = {
  tax_regime: "simples",
  tax_rate: DEFAULT_CFO.tax_rate,
  reserve_months: DEFAULT_CFO.reserve_months,
  cdi_monthly_liquid: DEFAULT_CFO.cdi_monthly_liquid,
  opening_bank_balance: null,
  expected_expense_fixo: null,
  expected_expense_variavel: null,
  expected_expense_anual: null,
};

/** Config CFO. Se a tabela finance_settings ainda não existir (migration não aplicada), usa defaults. */
export const useFinanceSettings = () => {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ["finance-settings"],
    queryFn: async () => {
      const { data, error } = await db.from("finance_settings").select("*").limit(1).maybeSingle();
      if (error) {
        if (error.code === "42P01" || error.code === "PGRST205") return { missing: true, row: null };
        throw error;
      }
      return { missing: false, row: data };
    },
    retry: false,
  });

  const missing = query.data?.missing ?? false;
  const settings: FinanceSettings = { ...FALLBACK, ...(query.data?.row ?? {}) };

  const save = useMutation({
    mutationFn: async (patch: Partial<FinanceSettings>) => {
      const { error } = await db.from("finance_settings").upsert({ ...settings, ...patch }, { onConflict: "user_id" });
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["finance-settings"] }); toast({ title: "Config salva" }); },
    onError: (e: any) => toast({ title: "Erro ao salvar", description: e?.message, variant: "destructive" }),
  });

  return { settings, missing, isLoading: query.isLoading, save };
};
