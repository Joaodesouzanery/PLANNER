import { useMemo } from "react";
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
  // Vigia do teto do Simples (RBT12) — limite configurável (null = não vigia).
  rbt12_limit: number | null;
  rbt12_alert_pct: number | null;
  // Pró-labore mensal (PJ→PF): entra na DRE como "= Lucro da empresa" e no painel PF (null = 0).
  prolabore_mensal: number | null;
  // Bloco CAIXA (aba Config da planilha): saldo − reserva − provisionado = caixa livre.
  // reserva_separada null = inferir pelo saldo das contas savings/investment.
  reserva_separada: number | null;
  provisionado: number | null;
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
  rbt12_limit: null,
  rbt12_alert_pct: 80,
  prolabore_mensal: null,
  reserva_separada: null,
  provisionado: null,
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
  const row = query.data?.row ?? null;
  // Memoizado: sem isso `settings` é um objeto novo a cada render e derruba o useMemo de TODO
  // consumidor (computeCfo varre o universo canônico inteiro em cada um deles).
  const settings: FinanceSettings = useMemo(() => ({ ...FALLBACK, ...(row ?? {}) }), [row]);

  // Colunas que podem não existir ainda no banco (migration mais nova que o deploy). Mandá-las no
  // upsert derrubaria o "Salvar" INTEIRO com PGRST204 — imposto, baldes e RBT12 juntos.
  const colunasDoServidor = useMemo(() => new Set(Object.keys(row ?? {})), [row]);
  const seguro = (payload: Record<string, unknown>) => {
    if (!row) return payload; // ainda não há linha: o insert define as colunas que existirem
    return Object.fromEntries(Object.entries(payload).filter(([k]) => colunasDoServidor.has(k)));
  };

  const save = useMutation({
    mutationFn: async (patch: Partial<FinanceSettings>) => {
      const { error } = await db.from("finance_settings").upsert(seguro({ ...settings, ...patch }), { onConflict: "user_id" });
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["finance-settings"] }); toast({ title: "Config salva" }); },
    onError: (e: any) => toast({ title: "Erro ao salvar", description: e?.message, variant: "destructive" }),
  });

  return { settings, missing, isLoading: query.isLoading, save };
};
