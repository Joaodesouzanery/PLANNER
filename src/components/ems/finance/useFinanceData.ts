/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCompany } from "@/contexts/CompanyContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format, subMonths, addMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { expandRecurringTransactions, parseDateOnly } from "@/lib/geocode";
import { computeProjection, type ProjectionBreakdown } from "./projectionCalc";

export interface OKR {
  id: string; title: string; description: string | null; target_value: number;
  current_value: number; unit: string; period: string; start_date: string | null; end_date: string | null;
}
export interface Transaction {
  id: string; description: string; amount: number; type: "income" | "expense";
  category: string | null; date: string; created_at: string;
  company_id?: string | null; finance_account_id?: string | null; due_date?: string | null;
  settled_at?: string | null; status?: "planned" | "confirmed" | "reconciled" | null;
  card_invoice_id?: string | null; import_fingerprint?: string | null;
  installment_group_id?: string | null; installment_number?: number | null; installment_total?: number | null;
  is_recurring?: boolean; recurrence_interval?: string | null; recurrence_end_date?: string | null;
  source_id?: string | null; is_projected?: boolean | null; projection_index?: number | null;
}
export interface SavedInstallment {
  id: string;
  item_name: string;
  item_price: number;
  monthly_income: number | null;
  monthly_expenses: number | null;
  option_label: string;
  risk_level: string | null;
  installments: number;
  monthly_payment: number;
  percent_of_income: number | null;
  remains_after: number | null;
  metadata: Record<string, unknown> | null;
  entity_id?: string | null;
  account_id?: string | null;
  added_to_flow_at?: string | null;
  created_at: string;
}
export interface MonthlyPlan {
  id: string;
  month: number;
  year: number;
  notes: string | null;
  status: "open" | "closed" | "archived";
  company_id?: string | null;
  created_at: string;
  updated_at?: string;
}
export interface PlanItem {
  id: string;
  plan_id: string;
  transaction_id: string | null;
  description: string;
  amount: number;
  type: "income" | "expense";
  category: string | null;
  due_date: string;
  status: "planned" | "confirmed" | "skipped";
  notes: string | null;
  entity_id?: string | null;
  account_id?: string | null;
  company_id?: string | null;
  created_at: string;
  updated_at?: string;
}

export const PIE_COLORS = ["hsl(var(--primary))", "hsl(142.1, 76.2%, 36.3%)", "hsl(0, 84.2%, 60.2%)", "hsl(45, 93%, 47%)", "hsl(262, 83%, 58%)", "hsl(199, 89%, 48%)", "hsl(330, 80%, 55%)", "hsl(160, 60%, 45%)"];

export const fmtCurrency = (v: number) => `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
export const tooltipStyle = { backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "12px" };
export const formatDateBR = (date: string) => {
  const parsed = parseDateOnly(date);
  return parsed ? format(parsed, "dd/MM/yyyy") : "-";
};
/** Data efetiva de um lançamento (vencimento quando houver), p/ agrupar por mês de forma consistente entre as abas. */
export const effectiveDate = (t: { date: string; due_date?: string | null }) => String(t.due_date || t.date).slice(0, 10);

/** "Realizado" = já aconteceu: não é planejado E a data efetiva já chegou. Fonte única da verdade. */
export const isRealized = (
  t: { status?: string | null; date: string; due_date?: string | null },
  today: string = new Date().toISOString().slice(0, 10),
) => t.status !== "planned" && effectiveDate(t) <= today;

const isSyntheticId = (id: string) => id.includes("-future-") || /-r\d+$/.test(id);

export interface PeriodRow {
  id: string; date: string; type: "income" | "expense"; amount: number;
  category: string | null; description: string; sourceId: string | null;
  accountId: string | null; sourceType: string;
  real: boolean; projected: boolean; synthetic: boolean;
}

/**
 * Universo unificado do fluxo: realizado (dashboardTransactions) + previsto (allEvents),
 * cada linha com `real` (realizado ou marcado), `projected` (previsto), `synthetic` (ocorrência
 * de recorrência sem linha no banco). Dedup por (origem,data,tipo) preferindo real/não-sintético
 * (evita contar 2x quando uma recorrência é materializada). Exclui cenários. Usado por Dashboard e Médias.
 */
export const buildPeriodSource = (dashboardTransactions: any[], allEvents: any[]): PeriodRow[] => {
  const realized: PeriodRow[] = dashboardTransactions
    .filter((t) => t.type === "income" || t.type === "expense")
    .map((t) => ({
      id: String(t.id), date: effectiveDate(t), type: t.type, amount: Number(t.amount),
      category: t.category || null, description: t.description, sourceId: t.source_id || String(t.id),
      accountId: t.finance_account_id || null, sourceType: "transaction",
      real: true, projected: false, synthetic: isSyntheticId(String(t.id)),
    }));
  const seenIds = new Set(realized.map((r) => r.id));
  const scheduled: PeriodRow[] = (allEvents || [])
    .filter((e) => (e.kind === "income" || e.kind === "expense") && !e.isScenario && !seenIds.has(e.id))
    .map((e) => ({
      id: String(e.id), date: String(e.date).slice(0, 10), type: e.kind, amount: Number(e.amount),
      category: e.category || null, description: e.description, sourceId: e.sourceId || null,
      accountId: e.accountId || null, sourceType: e.sourceType,
      real: e.status === "reconciled", projected: true, synthetic: isSyntheticId(String(e.id)),
    }));
  const score = (r: PeriodRow) => (r.real ? 2 : 0) + (r.synthetic ? 0 : 1);
  const merged = new Map<string, PeriodRow>();
  const standalone: PeriodRow[] = [];
  for (const row of [...realized, ...scheduled]) {
    if (!row.sourceId) { standalone.push(row); continue; }
    const key = `${row.sourceId}|${row.date}|${row.type}`;
    const existing = merged.get(key);
    if (!existing || score(row) > score(existing)) merged.set(key, row);
  }
  return [...standalone, ...merged.values()];
};

const isMissingTableError = (error: any) =>
  error?.code === "42P01" ||
  error?.code === "PGRST205" ||
  ["finance_saved_installments", "finance_monthly_plans", "finance_plan_items"].some((table) =>
    String(error?.message || "").toLowerCase().includes(table)
  );

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const assertUuid = (id: string | undefined, label: string) => {
  if (!id || !UUID_RE.test(id)) {
    throw new Error(`${label} invalido. Recarregue a pagina e tente novamente.`);
  }
};

export const useFinanceData = (options?: { historyWindow?: number }) => {
  const { toast } = useToast();
  const { selectedCompanyId } = useCompany();
  const queryClient = useQueryClient();
  const [historyWindow, setHistoryWindow] = useState<number>(options?.historyWindow ?? 3);

  const { data: okrs = [] } = useQuery({
    queryKey: ["finance-okrs", selectedCompanyId],
    queryFn: async () => {
      let q = supabase.from("okrs").select("*").order("created_at", { ascending: false });
      if (selectedCompanyId !== "all") q = q.eq("company_id", selectedCompanyId);
      const { data, error } = await q;
      if (error) throw error;
      return data as OKR[];
    },
  });

  const { data: rawTransactions = [], dataUpdatedAt: transactionsUpdatedAt } = useQuery({
    queryKey: ["finance-transactions", selectedCompanyId],
    queryFn: async () => {
      let q = supabase.from("financial_transactions").select("*").order("date", { ascending: false });
      if (selectedCompanyId !== "all") q = q.eq("company_id", selectedCompanyId);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as Transaction[];
    },
  });

  const transactions = useMemo(() => expandRecurringTransactions(rawTransactions), [rawTransactions]);

  const { data: savedInstallments = [] } = useQuery({
    queryKey: ["finance-saved-installments", selectedCompanyId],
    queryFn: async () => {
      let q = (supabase as any).from("finance_saved_installments").select("*").order("created_at", { ascending: false });
      if (selectedCompanyId !== "all") q = q.eq("company_id", selectedCompanyId);
      const { data, error } = await q;
      if (isMissingTableError(error)) return [];
      if (error) throw error;
      return (data || []) as SavedInstallment[];
    },
    retry: false,
  });

  const { data: monthlyPlans = [] } = useQuery({
    queryKey: ["finance-monthly-plans", selectedCompanyId],
    queryFn: async () => {
      let q = (supabase as any)
        .from("finance_monthly_plans")
        .select("*")
        .order("year", { ascending: false })
        .order("month", { ascending: false });
      if (selectedCompanyId !== "all") q = q.eq("company_id", selectedCompanyId);
      const { data, error } = await q;
      if (isMissingTableError(error)) return [];
      if (error) throw error;
      return (data || []) as MonthlyPlan[];
    },
    retry: false,
  });

  const { data: planItems = [] } = useQuery({
    queryKey: ["finance-plan-items", selectedCompanyId],
    queryFn: async () => {
      let q = (supabase as any)
        .from("finance_plan_items")
        .select("*")
        .order("due_date", { ascending: true });
      if (selectedCompanyId !== "all") q = q.eq("company_id", selectedCompanyId);
      const { data, error } = await q;
      if (isMissingTableError(error)) return [];
      if (error) throw error;
      return (data || []) as PlanItem[];
    },
    retry: false,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["finance-okrs"] });
    queryClient.invalidateQueries({ queryKey: ["finance-transactions"] });
    queryClient.invalidateQueries({ queryKey: ["finance-saved-installments"] });
    queryClient.invalidateQueries({ queryKey: ["finance-monthly-plans"] });
    queryClient.invalidateQueries({ queryKey: ["finance-plan-items"] });
  };

  // Realtime: qualquer mudança em transações, planos mensais ou itens planejados
  // invalida o cache para a projeção se recalcular sem reload.
  useEffect(() => {
    const channel = supabase
      .channel(`finance-live-${selectedCompanyId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "financial_transactions" }, () => {
        queryClient.invalidateQueries({ queryKey: ["finance-transactions"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "finance_monthly_plans" }, () => {
        queryClient.invalidateQueries({ queryKey: ["finance-monthly-plans"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "finance_plan_items" }, () => {
        queryClient.invalidateQueries({ queryKey: ["finance-plan-items"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "finance_transfers" }, () => {
        queryClient.invalidateQueries({ queryKey: ["finance-transfers"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "finance_card_invoices" }, () => {
        queryClient.invalidateQueries({ queryKey: ["finance-card-invoices"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "finance_accounts" }, () => {
        queryClient.invalidateQueries({ queryKey: ["finance-accounts"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "finance_entities" }, () => {
        queryClient.invalidateQueries({ queryKey: ["finance-entities"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "finance_saved_installments" }, () => {
        queryClient.invalidateQueries({ queryKey: ["finance-saved-installments"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "project_financial_impacts" }, () => {
        queryClient.invalidateQueries({ queryKey: ["finance-forecast-impacts"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "finance_scenarios" }, () => {
        queryClient.invalidateQueries({ queryKey: ["finance-scenarios"] });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient, selectedCompanyId]);

  const ensureMonthlyPlan = async (month: number, year: number) => {
    let query = (supabase as any)
      .from("finance_monthly_plans")
      .select("*")
      .eq("month", month)
      .eq("year", year)
      .limit(1);
    query = selectedCompanyId !== "all" ? query.eq("company_id", selectedCompanyId) : query.is("company_id", null);
    const { data: existing, error: findError } = await query.maybeSingle();
    if (findError && !isMissingTableError(findError)) throw findError;
    if (existing) return existing as MonthlyPlan;

    const { data, error } = await (supabase as any)
      .from("finance_monthly_plans")
      .insert({
        month,
        year,
        status: "open",
        company_id: selectedCompanyId !== "all" ? selectedCompanyId : null,
      })
      .select("*")
      .single();
    if (error) throw error;
    return data as MonthlyPlan;
  };

  const saveOkrMutation = useMutation({
    mutationFn: async ({ form, editingId }: { form: any; editingId?: string }) => {
      if (editingId) {
        assertUuid(editingId, "ID do OKR");
        const { error } = await supabase.from("okrs").update(form).eq("id", editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("okrs").insert({ ...form, company_id: selectedCompanyId !== "all" ? selectedCompanyId : null });
        if (error) throw error;
      }
    },
    onSuccess: (_, vars) => { invalidate(); toast({ title: vars.editingId ? "OKR atualizado!" : "OKR criado!" }); },
    onError: (e: any) => toast({ title: "Erro", description: e?.message, variant: "destructive" }),
  });

  const deleteOkrMutation = useMutation({
    mutationFn: async (id: string) => { assertUuid(id, "ID do OKR"); const { error } = await supabase.from("okrs").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { invalidate(); toast({ title: "OKR removido!" }); },
    onError: (e: any) => toast({ title: "Erro ao excluir OKR", description: e?.message, variant: "destructive" }),
  });

  const saveTransactionMutation = useMutation({
    mutationFn: async ({ form, editingId }: { form: any; editingId?: string }) => {
      if (editingId) {
        assertUuid(editingId, "ID da transacao");
        const { error } = await supabase.from("financial_transactions").update(form).eq("id", editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("financial_transactions").insert({ ...form, company_id: selectedCompanyId !== "all" ? selectedCompanyId : null });
        if (error) throw error;
      }
    },
    onSuccess: (_, vars) => { invalidate(); toast({ title: vars.editingId ? "Transação atualizada!" : "Transação criada!" }); },
    onError: (e: any) => toast({ title: "Erro", description: e?.message, variant: "destructive" }),
  });

  const deleteTransactionMutation = useMutation({
    mutationFn: async (id: string) => { assertUuid(id, "ID da transacao"); const { error } = await supabase.from("financial_transactions").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { invalidate(); toast({ title: "Transação removida!" }); },
  });

  const saveInstallmentMutation = useMutation({
    mutationFn: async (payload: Omit<SavedInstallment, "id" | "created_at">) => {
      const { error } = await (supabase as any).from("finance_saved_installments").insert({
        ...payload,
        company_id: selectedCompanyId !== "all" ? selectedCompanyId : null,
      });
      if (error) throw error;
    },
    onSuccess: () => { invalidate(); toast({ title: "Parcelamento salvo!" }); },
    onError: (e: any) => toast({
      title: "Tabela de parcelamentos indisponivel",
      description: isMissingTableError(e) ? "A migration finance_saved_installments ainda precisa ser aplicada." : e?.message,
      variant: "destructive",
    }),
  });

  const deleteInstallmentMutation = useMutation({
    mutationFn: async (id: string) => {
      assertUuid(id, "ID do parcelamento");
      const { error } = await (supabase as any).from("finance_saved_installments").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { invalidate(); toast({ title: "Parcelamento removido!" }); },
    onError: (e: any) => toast({
      title: "Erro ao excluir parcelamento",
      description: isMissingTableError(e) ? "A migration finance_saved_installments ainda precisa ser aplicada." : e?.message,
      variant: "destructive",
    }),
  });

  const saveMonthlyPlanMutation = useMutation({
    mutationFn: async ({ form, editingId }: { form: Partial<MonthlyPlan>; editingId?: string }) => {
      if (editingId) {
        assertUuid(editingId, "ID do planejamento");
        const { error } = await (supabase as any).from("finance_monthly_plans").update(form).eq("id", editingId);
        if (error) throw error;
        return;
      }
      const { error } = await (supabase as any).from("finance_monthly_plans").insert({
        ...form,
        company_id: selectedCompanyId !== "all" ? selectedCompanyId : null,
      });
      if (error) throw error;
    },
    onSuccess: () => { invalidate(); toast({ title: "Planejamento mensal salvo!" }); },
    onError: (e: any) => toast({
      title: "Erro ao salvar planejamento",
      description: isMissingTableError(e) ? "A migration finance_monthly_plans ainda precisa ser aplicada." : e?.message,
      variant: "destructive",
    }),
  });

  const savePlanItemMutation = useMutation({
    mutationFn: async ({ form, month, year, editingId }: { form: Partial<PlanItem>; month: number; year: number; editingId?: string }) => {
      if (editingId) {
        assertUuid(editingId, "ID do item planejado");
        const { error } = await (supabase as any).from("finance_plan_items").update(form).eq("id", editingId);
        if (error) throw error;
        return;
      }
      const plan = await ensureMonthlyPlan(month, year);
      const { error } = await (supabase as any).from("finance_plan_items").insert({
        ...form,
        plan_id: plan.id,
        company_id: selectedCompanyId !== "all" ? selectedCompanyId : null,
      });
      if (error) throw error;
    },
    onSuccess: (_, vars) => { invalidate(); toast({ title: vars.editingId ? "Item planejado atualizado!" : "Item planejado criado!" }); },
    onError: (e: any) => toast({
      title: "Erro ao salvar item planejado",
      description: isMissingTableError(e) ? "A migration finance_plan_items ainda precisa ser aplicada." : e?.message,
      variant: "destructive",
    }),
  });

  const deletePlanItemMutation = useMutation({
    mutationFn: async (id: string) => {
      assertUuid(id, "ID do item planejado");
      const { error } = await (supabase as any).from("finance_plan_items").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { invalidate(); toast({ title: "Item planejado removido!" }); },
    onError: (e: any) => toast({ title: "Erro ao remover item", description: e?.message, variant: "destructive" }),
  });

  const skipPlanItemMutation = useMutation({
    mutationFn: async (id: string) => {
      assertUuid(id, "ID do item planejado");
      const { error } = await (supabase as any).from("finance_plan_items").update({ status: "skipped" }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { invalidate(); toast({ title: "Item marcado como ignorado" }); },
    onError: (e: any) => toast({ title: "Erro ao ignorar item", description: e?.message, variant: "destructive" }),
  });

  const confirmPlanItemMutation = useMutation({
    mutationFn: async (item: PlanItem) => {
      assertUuid(item.id, "ID do item planejado");
      const { data, error: insertError } = await (supabase as any)
        .from("financial_transactions")
        .insert({
          description: item.description,
          amount: item.amount,
          type: item.type,
          category: item.category,
          date: item.due_date,
          due_date: item.due_date,
          status: "confirmed",
          finance_account_id: item.account_id ?? null,
          source_type: "plan",
          source_id: item.id,
          company_id: selectedCompanyId !== "all" ? selectedCompanyId : item.company_id ?? null,
        })
        .select("id")
        .single();
      if (insertError) throw insertError;
      const { error: updateError } = await (supabase as any)
        .from("finance_plan_items")
        .update({ status: "confirmed", transaction_id: data.id })
        .eq("id", item.id);
      if (updateError) throw updateError;
    },
    onSuccess: () => { invalidate(); toast({ title: "Item confirmado como transacao real!" }); },
    onError: (e: any) => toast({ title: "Erro ao confirmar item", description: e?.message, variant: "destructive" }),
  });

  const dashboardTransactions = useMemo(() => {
    // Realizado = já aconteceu (membership por effectiveDate, casando com o agrupamento das abas).
    const today = format(new Date(), "yyyy-MM-dd");
    const realized = transactions.filter((t) => isRealized(t, today));
    // Dedup por (origem,data,tipo): o real materializado vence a ocorrência sintética (-rN) da mesma
    // recorrência (senão o mês contaria 2x depois de "Recebi/Paguei").
    const merged = new Map<string, Transaction>();
    for (const t of realized) {
      const key = `${t.source_id || t.id}|${effectiveDate(t)}|${t.type}`;
      const existing = merged.get(key);
      const better = !existing || (!t.is_projected && existing.is_projected);
      if (better) merged.set(key, t);
    }
    return Array.from(merged.values());
  }, [transactions]);

  const totalIncome = useMemo(() => dashboardTransactions.filter(t => t.type === "income").reduce((a, t) => a + Number(t.amount), 0), [dashboardTransactions]);
  const totalExpense = useMemo(() => dashboardTransactions.filter(t => t.type === "expense").reduce((a, t) => a + Number(t.amount), 0), [dashboardTransactions]);
  const balance = totalIncome - totalExpense;

  const allCategories = useMemo(() => {
    const cats = new Set<string>();
    rawTransactions.forEach(t => { if (t.category) cats.add(t.category); });
    return Array.from(cats).sort();
  }, [rawTransactions]);

  const monthlyData = useMemo(() => {
    const months: { month: string; income: number; expense: number; balance: number }[] = [];
    const totalMonths = Math.max(12, historyWindow);
    for (let i = totalMonths - 1; i >= 0; i--) {
      const d = subMonths(new Date(), i); const key = format(d, "yyyy-MM"); const label = format(d, "MMM/yy", { locale: ptBR });
      const monthTx = dashboardTransactions.filter(t => effectiveDate(t).slice(0, 7) === key);
      const inc = monthTx.filter(t => t.type === "income").reduce((a, t) => a + Number(t.amount), 0);
      const exp = monthTx.filter(t => t.type === "expense").reduce((a, t) => a + Number(t.amount), 0);
      months.push({ month: label, income: inc, expense: exp, balance: inc - exp });
    }
    return months;
  }, [dashboardTransactions, historyWindow]);

  const incomeByCat = useMemo(() => {
    const map: Record<string, number> = {};
    dashboardTransactions.filter(t => t.type === "income").forEach(t => { const cat = t.category || "Sem categoria"; map[cat] = (map[cat] || 0) + Number(t.amount); });
    return Object.entries(map).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [dashboardTransactions]);

  const expenseByCat = useMemo(() => {
    const map: Record<string, number> = {};
    dashboardTransactions.filter(t => t.type === "expense").forEach(t => { const cat = t.category || "Sem categoria"; map[cat] = (map[cat] || 0) + Number(t.amount); });
    return Object.entries(map).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [dashboardTransactions]);

  const projection = useMemo(() => {
    const futureMonthLabels: string[] = [];
    const futureMonthKeys: string[] = [];
    for (let i = 1; i <= 3; i++) {
      futureMonthLabels.push(format(addMonths(new Date(), i), "MMM/yy", { locale: ptBR }));
      futureMonthKeys.push(format(addMonths(new Date(), i), "yyyy-MM"));
    }
    return computeProjection({
      monthlyData,
      recurringTransactions: rawTransactions.map((t) => ({
        id: t.id,
        description: t.description,
        category: t.category ?? null,
        amount: Number(t.amount),
        type: t.type,
        is_recurring: !!t.is_recurring,
        recurrence_interval: t.recurrence_interval ?? null,
        recurrence_end_date: t.recurrence_end_date ?? null,
      })),
      futureMonthLabels,
      futureMonthKeys,
      historyWindow,
    });
  }, [monthlyData, rawTransactions, historyWindow]);

  const projectionData = projection.rows;
  const projectionBreakdown: ProjectionBreakdown = projection.breakdown;

  const capitalEvolution = useMemo(() => {
    // Semeia com o realizado acumulado ANTES da janela, p/ a curva refletir o capital real.
    const totalMonths = Math.max(12, historyWindow);
    const windowStart = `${format(subMonths(new Date(), totalMonths - 1), "yyyy-MM")}-01`;
    const seed = dashboardTransactions.reduce(
      (acc, t) => (effectiveDate(t) < windowStart ? acc + (t.type === "income" ? Number(t.amount) : -Number(t.amount)) : acc),
      0,
    );
    let running = seed;
    return monthlyData.map(m => { running += m.balance; return { month: m.month, capital: running }; });
  }, [monthlyData, dashboardTransactions, historyWindow]);

  const currentMonthPlanSummary = useMemo(() => {
    const now = new Date();
    const month = now.getMonth() + 1;
    const year = now.getFullYear();
    const planIds = monthlyPlans.filter((p) => p.month === month && p.year === year).map((p) => p.id);
    const items = planItems.filter((item) => planIds.includes(item.plan_id));
    const plannedIncome = items.filter((item) => item.type === "income" && item.status !== "skipped").reduce((sum, item) => sum + Number(item.amount), 0);
    const plannedExpense = items.filter((item) => item.type === "expense" && item.status !== "skipped").reduce((sum, item) => sum + Number(item.amount), 0);
    const monthKey = format(now, "yyyy-MM");
    const realized = dashboardTransactions.filter((t) => effectiveDate(t).slice(0, 7) === monthKey);
    const realizedIncome = realized.filter((t) => t.type === "income").reduce((sum, t) => sum + Number(t.amount), 0);
    const realizedExpense = realized.filter((t) => t.type === "expense").reduce((sum, t) => sum + Number(t.amount), 0);
    return {
      plannedIncome,
      plannedExpense,
      plannedBalance: plannedIncome - plannedExpense,
      realizedIncome,
      realizedExpense,
      realizedBalance: realizedIncome - realizedExpense,
      variance: (realizedIncome - realizedExpense) - (plannedIncome - plannedExpense),
    };
  }, [dashboardTransactions, monthlyPlans, planItems]);

  return {
    okrs, transactions, rawTransactions, transactionsUpdatedAt, dashboardTransactions, totalIncome, totalExpense, balance, allCategories,
    savedInstallments, monthlyPlans, planItems, currentMonthPlanSummary,
    monthlyData, incomeByCat, expenseByCat, projectionData, projectionBreakdown, capitalEvolution,
    historyWindow, setHistoryWindow,
    saveOkrMutation, deleteOkrMutation, saveTransactionMutation, deleteTransactionMutation,
    saveInstallmentMutation, deleteInstallmentMutation,
    saveMonthlyPlanMutation, savePlanItemMutation, deletePlanItemMutation, skipPlanItemMutation, confirmPlanItemMutation,
    toast, selectedCompanyId,
  };
};
