import { useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCompany } from "@/contexts/CompanyContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format, subMonths, addMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { expandRecurringTransactions, parseDateOnly } from "@/lib/geocode";

export interface OKR {
  id: string; title: string; description: string | null; target_value: number;
  current_value: number; unit: string; period: string; start_date: string | null; end_date: string | null;
}
export interface Transaction {
  id: string; description: string; amount: number; type: "income" | "expense";
  category: string | null; date: string; created_at: string;
  is_recurring?: boolean; recurrence_interval?: string | null;
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
  created_at: string;
}

export const PIE_COLORS = ["hsl(var(--primary))", "hsl(142.1, 76.2%, 36.3%)", "hsl(0, 84.2%, 60.2%)", "hsl(45, 93%, 47%)", "hsl(262, 83%, 58%)", "hsl(199, 89%, 48%)", "hsl(330, 80%, 55%)", "hsl(160, 60%, 45%)"];

export const fmtCurrency = (v: number) => `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
export const tooltipStyle = { backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "12px" };
export const formatDateBR = (date: string) => {
  const parsed = parseDateOnly(date);
  return parsed ? format(parsed, "dd/MM/yyyy") : "-";
};

const isMissingTableError = (error: any) =>
  error?.code === "42P01" ||
  error?.code === "PGRST205" ||
  String(error?.message || "").toLowerCase().includes("finance_saved_installments");

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const assertUuid = (id: string | undefined, label: string) => {
  if (!id || !UUID_RE.test(id)) {
    throw new Error(`${label} invalido. Recarregue a pagina e tente novamente.`);
  }
};

export const useFinanceData = () => {
  const { toast } = useToast();
  const { selectedCompanyId } = useCompany();
  const queryClient = useQueryClient();

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

  const { data: rawTransactions = [] } = useQuery({
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

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["finance-okrs"] });
    queryClient.invalidateQueries({ queryKey: ["finance-transactions"] });
    queryClient.invalidateQueries({ queryKey: ["finance-saved-installments"] });
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

  const dashboardTransactions = useMemo(() => {
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    return transactions.filter((t) => {
      const date = parseDateOnly(t.date);
      return date ? date <= today : false;
    });
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
    for (let i = 11; i >= 0; i--) {
      const d = subMonths(new Date(), i); const key = format(d, "yyyy-MM"); const label = format(d, "MMM/yy", { locale: ptBR });
      const monthTx = dashboardTransactions.filter(t => String(t.date).slice(0, 7) === key);
      const inc = monthTx.filter(t => t.type === "income").reduce((a, t) => a + Number(t.amount), 0);
      const exp = monthTx.filter(t => t.type === "expense").reduce((a, t) => a + Number(t.amount), 0);
      months.push({ month: label, income: inc, expense: exp, balance: inc - exp });
    }
    return months;
  }, [dashboardTransactions]);

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

  const projectionData = useMemo(() => {
    const last3 = monthlyData.slice(-3);
    const incomeMonths = last3.filter((m) => m.income > 0);
    const expenseMonths = last3.filter((m) => m.expense > 0);
    const avgInc = incomeMonths.length > 0 ? incomeMonths.reduce((a, m) => a + m.income, 0) / incomeMonths.length : 0;
    const avgExp = expenseMonths.length > 0 ? expenseMonths.reduce((a, m) => a + m.expense, 0) / expenseMonths.length : 0;
    const projected: { month: string; income: number; expense: number; balance: number; projected: boolean }[] = [];
    last3.forEach(m => projected.push({ ...m, projected: false }));
    for (let i = 1; i <= 3; i++) { const d = addMonths(new Date(), i); projected.push({ month: format(d, "MMM/yy", { locale: ptBR }), income: Math.round(avgInc), expense: Math.round(avgExp), balance: Math.round(avgInc - avgExp), projected: true }); }
    return projected;
  }, [monthlyData]);

  const capitalEvolution = useMemo(() => { let running = 0; return monthlyData.map(m => { running += m.balance; return { month: m.month, capital: running }; }); }, [monthlyData]);

  return {
    okrs, transactions, rawTransactions, dashboardTransactions, totalIncome, totalExpense, balance, allCategories,
    savedInstallments,
    monthlyData, incomeByCat, expenseByCat, projectionData, capitalEvolution,
    saveOkrMutation, deleteOkrMutation, saveTransactionMutation, deleteTransactionMutation,
    saveInstallmentMutation, deleteInstallmentMutation,
    toast, selectedCompanyId,
  };
};
