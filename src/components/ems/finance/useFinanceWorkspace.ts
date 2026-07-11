/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { addDays, addMonths, format } from "date-fns";
import { useCompany } from "@/contexts/CompanyContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { buildForecastSeries, getUpcomingPayables, parseFinanceCsv, summarizeForecastByMonth } from "./financeForecast";
import type { FinanceAccount, FinanceCardInvoice, FinanceEntity, FinanceTransfer, ForecastEvent } from "./financeTypes";
import { useFinanceData, assertUuid, buildPeriodSource, type PlanItem, type Transaction } from "./useFinanceData";
import { canonicalTotals, curvaDiaria, menorSaldo, saldoAbertura, saldoRealHoje } from "./financeCanonical";

const SCOPE_KEY = "ems-finance-scope";
const todayIso = () => format(new Date(), "yyyy-MM-dd");

interface PlanningImpact {
  id: string;
  company_id: string | null;
  title: string;
  impact_type: string;
  expected_amount: number;
  expected_date: string | null;
  confidence: "high" | "medium" | "low" | null;
  status: string | null;
}

const recurringFutureEvents = (transaction: Transaction, entityId: string | null): ForecastEvent[] => {
  if (!transaction.is_recurring) return [];
  const interval = transaction.recurrence_interval || "monthly";
  const advance = (date: Date) => interval === "weekly" ? addDays(date, 7) : interval === "yearly" ? addMonths(date, 12) : addMonths(date, 1);
  let cursor = advance(new Date(`${transaction.due_date || transaction.date}T12:00:00`));
  const horizon = addMonths(new Date(), 12);
  // Contrato com prazo: para a projeção no fim do contrato (senão projeta os 12 meses cheios).
  const end = transaction.recurrence_end_date ? new Date(`${transaction.recurrence_end_date}T12:00:00`) : null;
  const stop = end && end < horizon ? end : horizon;
  while (cursor < new Date()) cursor = advance(cursor);
  const events: ForecastEvent[] = [];
  let index = 0;
  while (cursor <= stop && index < 60) {
    events.push({
      id: `${transaction.id}-future-${index}`,
      date: format(cursor, "yyyy-MM-dd"),
      description: transaction.description,
      amount: Number(transaction.amount),
      kind: transaction.type,
      accountId: transaction.finance_account_id || null,
      entityId,
      category: transaction.category,
      sourceType: "transaction",
      sourceId: transaction.id,
      status: "planned",
    });
    cursor = advance(cursor);
    index += 1;
  }
  return events;
};

export const useFinanceWorkspace = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { selectedCompanyId, companies } = useCompany();
  const finance = useFinanceData();
  const [scope, setScope] = useState(() => localStorage.getItem(SCOPE_KEY) || "personal");

  const { data: entities = [], isLoading: entitiesLoading, error: entitiesError } = useQuery({
    queryKey: ["finance-entities"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("finance_entities").select("*").order("entity_type").order("name");
      if (error) throw error;
      return (data || []) as FinanceEntity[];
    },
    retry: false,
  });

  const { data: accounts = [] } = useQuery({
    queryKey: ["finance-accounts"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("finance_accounts").select("*").order("is_default", { ascending: false }).order("name");
      if (error) throw error;
      return (data || []) as FinanceAccount[];
    },
    enabled: !entitiesError,
    retry: false,
  });

  const { data: transfers = [] } = useQuery({
    queryKey: ["finance-transfers"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("finance_transfers").select("*").order("transfer_date", { ascending: false });
      if (error) throw error;
      return (data || []) as FinanceTransfer[];
    },
    enabled: !entitiesError,
    retry: false,
  });

  const { data: invoices = [] } = useQuery({
    queryKey: ["finance-card-invoices"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("finance_card_invoices").select("*").order("due_date");
      if (error) throw error;
      return (data || []) as FinanceCardInvoice[];
    },
    enabled: !entitiesError,
    retry: false,
  });

  const { data: impacts = [] } = useQuery({
    queryKey: ["finance-forecast-impacts"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("project_financial_impacts")
        .select("id,company_id,project_id,title,impact_type,amount,notes,created_at")
        .order("created_at", { ascending: false });
      if (error) {
        if (error.code === "42P01" || error.code === "PGRST205") return [];
        throw error;
      }
      return (data || []).map((row: any) => ({
        id: row.id,
        company_id: row.company_id,
        title: row.title,
        impact_type: row.impact_type,
        expected_amount: Number(row.amount || 0),
        expected_date: null,
        confidence: "medium" as const,
        status: "planned" as const,
      })) as PlanningImpact[];
    },
    retry: false,
  });

  useEffect(() => {
    if (selectedCompanyId === "all") return;
    const entity = entities.find((item) => item.company_id === selectedCompanyId);
    if (entity) setScope(entity.id);
  }, [entities, selectedCompanyId]);

  useEffect(() => {
    localStorage.setItem(SCOPE_KEY, scope);
  }, [scope]);

  const bootstrapMutation = useMutation({
    mutationFn: async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) throw new Error("Sessao nao encontrada.");
      let personal = entities.find((item) => item.entity_type === "cpf");
      if (!personal) {
        const { data, error } = await (supabase as any).from("finance_entities").insert({ entity_type: "cpf", name: "Pessoal", is_default: true }).select("*").single();
        if (error) throw error;
        personal = data;
      }
      const personalAccount = accounts.find((item) => item.entity_id === personal!.id && item.is_default);
      if (!personalAccount) {
        const { error } = await (supabase as any).from("finance_accounts").insert({ entity_id: personal!.id, name: "Conta pessoal", account_type: "checking", is_default: true });
        if (error) throw error;
      }
      for (const company of companies) {
        let entity = entities.find((item) => item.company_id === company.id);
        if (!entity) {
          const { data, error } = await (supabase as any).from("finance_entities").insert({ company_id: company.id, entity_type: "cnpj", name: company.name, color: company.color, is_default: true }).select("*").single();
          if (error) throw error;
          entity = data;
        }
        if (!accounts.some((item) => item.entity_id === entity!.id && item.is_default)) {
          const { error } = await (supabase as any).from("finance_accounts").insert({ company_id: company.id, entity_id: entity!.id, name: "Conta principal", account_type: "checking", is_default: true });
          if (error) throw error;
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["finance-entities"] });
      queryClient.invalidateQueries({ queryKey: ["finance-accounts"] });
    },
  });

  useEffect(() => {
    if (!entitiesLoading && !entitiesError && (!entities.some((item) => item.entity_type === "cpf") || companies.some((company) => !entities.some((item) => item.company_id === company.id)))) {
      bootstrapMutation.mutate();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entitiesLoading, entities.length, companies.length, entitiesError]);

  const selectedEntity = scope === "consolidated" ? null : scope === "personal"
    ? entities.find((item) => item.entity_type === "cpf") || null
    : entities.find((item) => item.id === scope) || null;
  const selectedAccounts = useMemo(() => accounts.filter((account) =>
    account.is_active && (scope === "consolidated" || account.entity_id === selectedEntity?.id)
  ), [accounts, scope, selectedEntity]);
  const selectedAccountIds = useMemo(() => new Set(selectedAccounts.map((account) => account.id)), [selectedAccounts]);
  const entityByAccount = useMemo(() => new Map(accounts.map((account) => [account.id, account.entity_id])), [accounts]);

  const allEvents = useMemo(() => {
    const events: ForecastEvent[] = [];
    const today = todayIso();
    finance.transactions.forEach((transaction) => {
      const accountId = transaction.finance_account_id || null;
      const entityId = accountId ? entityByAccount.get(accountId) || null : entities.find((entity) => entity.company_id === transaction.company_id)?.id || entities.find((entity) => entity.entity_type === "cpf")?.id || null;
      const dueDate = transaction.due_date || transaction.date;
      if (dueDate >= today || transaction.status === "planned") {
        events.push({
          id: transaction.id,
          date: dueDate,
          description: transaction.description,
          amount: Number(transaction.amount),
          kind: transaction.type,
          accountId,
          entityId,
          category: transaction.category,
          sourceType: transaction.card_invoice_id ? "invoice" : transaction.installment_group_id ? "installment" : "transaction",
          sourceId: transaction.source_id || transaction.id,
          status: transaction.status || "confirmed",
        });
      }
      events.push(...recurringFutureEvents(transaction, entityId));
    });
    finance.planItems.forEach((item: PlanItem) => {
      if (item.transaction_id || item.status === "skipped") return;
      const inferredEntity = item.entity_id ? entities.find((entity) => entity.id === item.entity_id) : entities.find((entity) => entity.company_id === item.company_id);
      const accountId = item.account_id || accounts.find((account) => account.entity_id === inferredEntity?.id && account.is_default)?.id || null;
      const entityId = inferredEntity?.id || (accountId ? entityByAccount.get(accountId) || null : null);
      events.push({ id: item.id, date: item.due_date, description: item.description, amount: Number(item.amount), kind: item.type, accountId, entityId, category: item.category, sourceType: "plan", sourceId: item.id, status: "planned" });
    });
    transfers.forEach((transfer) => {
      events.push({ id: `${transfer.id}-out`, date: transfer.transfer_date, description: transfer.description || "Transferencia", amount: Number(transfer.amount), kind: "transfer_out", accountId: transfer.from_account_id, entityId: entityByAccount.get(transfer.from_account_id) || null, sourceType: "transfer", sourceId: transfer.id, status: transfer.status });
      events.push({ id: `${transfer.id}-in`, date: transfer.transfer_date, description: transfer.description || "Transferencia", amount: Number(transfer.amount), kind: "transfer_in", accountId: transfer.to_account_id, entityId: entityByAccount.get(transfer.to_account_id) || null, sourceType: "transfer", sourceId: transfer.id, status: transfer.status });
    });
    invoices.forEach((invoice) => {
      events.push({ id: invoice.id, date: invoice.paid_at?.slice(0, 10) || invoice.due_date, description: `Fatura ${accounts.find((account) => account.id === invoice.card_account_id)?.name || "cartao"}`, amount: Number(invoice.amount), kind: "expense", accountId: invoice.card_account_id, entityId: entityByAccount.get(invoice.card_account_id) || null, sourceType: "invoice", sourceId: invoice.id, status: invoice.status === "paid" ? "reconciled" : invoice.status === "open" ? "planned" : "confirmed" });
    });
    impacts.filter((impact) => impact.expected_date && impact.status !== "cancelled").forEach((impact) => {
      const entity = entities.find((item) => item.company_id === impact.company_id);
      const account = accounts.find((item) => item.entity_id === entity?.id && item.is_default);
      events.push({ id: impact.id, date: impact.expected_date!, description: impact.title, amount: Number(impact.expected_amount), kind: impact.impact_type === "cost" ? "expense" : "income", accountId: account?.id || null, entityId: entity?.id || null, sourceType: "project", sourceId: impact.id, status: "planned", isScenario: true, confidence: impact.confidence });
    });
    return events;
  }, [accounts, entities, entityByAccount, finance.planItems, finance.transactions, impacts, invoices, transfers]);

  const filteredEvents = useMemo(() => allEvents.filter((event) =>
    event.accountId ? selectedAccountIds.has(event.accountId) : scope === "consolidated" || event.entityId === selectedEntity?.id
  ), [allEvents, scope, selectedAccountIds, selectedEntity]);

  const openingBalance = useMemo(() => {
    const today = todayIso();
    let total = selectedAccounts.reduce((sum, account) => sum + Number(account.opening_balance || 0), 0);
    finance.transactions.forEach((transaction) => {
      if (!transaction.finance_account_id || !selectedAccountIds.has(transaction.finance_account_id)) return;
      const eventDate = transaction.due_date || transaction.date;
      if (eventDate < today && transaction.status !== "planned") total += transaction.type === "income" ? Number(transaction.amount) : -Number(transaction.amount);
    });
    transfers.filter((transfer) => transfer.transfer_date < today && transfer.status !== "planned").forEach((transfer) => {
      if (selectedAccountIds.has(transfer.from_account_id)) total -= Number(transfer.amount);
      if (selectedAccountIds.has(transfer.to_account_id)) total += Number(transfer.amount);
    });
    return total;
  }, [finance.transactions, selectedAccountIds, selectedAccounts, transfers]);

  const accountBalances = useMemo(() => {
    const today = todayIso();
    const balances = new Map(accounts.map((account) => [account.id, Number(account.opening_balance || 0)]));
    finance.transactions.forEach((transaction) => {
      if (!transaction.finance_account_id || (transaction.due_date || transaction.date) > today || transaction.status === "planned") return;
      balances.set(transaction.finance_account_id, (balances.get(transaction.finance_account_id) || 0) + (transaction.type === "income" ? Number(transaction.amount) : -Number(transaction.amount)));
    });
    transfers.filter((transfer) => transfer.transfer_date <= today && transfer.status !== "planned").forEach((transfer) => {
      balances.set(transfer.from_account_id, (balances.get(transfer.from_account_id) || 0) - Number(transfer.amount));
      balances.set(transfer.to_account_id, (balances.get(transfer.to_account_id) || 0) + Number(transfer.amount));
    });
    return balances;
  }, [accounts, finance.transactions, transfers]);

  // ── Read-model CANÔNICO (fonte única): toda aba lê daqui, ninguém recalcula saldo. ──
  const canonicalRows = useMemo(() => buildPeriodSource(finance.dashboardTransactions, allEvents), [finance.dashboardTransactions, allEvents]);
  const saldoRealHojeVal = useMemo(() => saldoRealHoje(canonicalRows, todayIso()), [canonicalRows]);
  const canonical = useMemo(() => ({
    rows: canonicalRows,
    saldoRealHoje: saldoRealHojeVal,
    saldoAbertura: (monthStart: string) => saldoAbertura(canonicalRows, monthStart),
    totals: (from: string, to: string) => canonicalTotals(canonicalRows, from, to),
    curva: (days: number) => curvaDiaria(canonicalRows, days, todayIso()),
    menorSaldo: (n: number) => menorSaldo(canonicalRows, n, todayIso()),
  }), [canonicalRows, saldoRealHojeVal]);

  // Renda/despesa mensal ESPERADA — fonte única das métricas derivadas (CFO, Viagem, Patrimônio).
  // Reusa exatamente o que a aba Projeções mostra: max(média histórica, baseline recorrente).
  const expectedMonthly = useMemo(() => ({
    income: finance.projectionBreakdown?.chosenIncome ?? 0,
    expense: finance.projectionBreakdown?.chosenExpense ?? 0,
  }), [finance.projectionBreakdown]);

  // Gasto variável estimado (esperado − recorrente): entra nas linhas Esperado/Conservador do forecast
  // p/ a projeção não crescer rápido demais ignorando o dia-a-dia (converge com a aba Projeções).
  const variableMonthlyExpense = useMemo(
    () => Math.max(0, (finance.projectionBreakdown?.chosenExpense ?? 0) - (finance.projectionBreakdown?.recurringBaselineExpense ?? 0)),
    [finance.projectionBreakdown],
  );

  // Forecast semeado pelo saldo real canônico (não pelo openingBalance inflado). Mata o duplo-5.500.
  const forecast90 = useMemo(() => buildForecastSeries({ events: filteredEvents, openingBalance: saldoRealHojeVal, days: 90, variableMonthlyExpense }), [filteredEvents, saldoRealHojeVal, variableMonthlyExpense]);
  const forecast365 = useMemo(() => buildForecastSeries({ events: filteredEvents, openingBalance: saldoRealHojeVal, days: 365, variableMonthlyExpense }), [filteredEvents, saldoRealHojeVal, variableMonthlyExpense]);
  const monthlyForecast = useMemo(() => summarizeForecastByMonth(forecast365).slice(0, 12), [forecast365]);

  // Contratos = recorrencias COM termino (recurrence_end_date). Escopo por conta selecionada.
  const contracts = useMemo(() => {
    const curKey = format(new Date(), "yyyy-MM");
    const monthDiff = (from: string, to: string) => {
      const [fy, fm] = from.split("-").map(Number);
      const [ty, tm] = to.split("-").map(Number);
      return (ty - fy) * 12 + (tm - fm);
    };
    return finance.transactions
      .filter((t) => t.is_recurring && t.recurrence_end_date && (!t.finance_account_id || selectedAccountIds.has(t.finance_account_id)))
      .map((t) => {
        const startDate = t.due_date || t.date;
        const endDate = t.recurrence_end_date as string;
        const totalMonths = Math.max(1, monthDiff(startDate.slice(0, 7), endDate.slice(0, 7)) + 1);
        const monthsLeft = Math.max(0, monthDiff(curKey, endDate.slice(0, 7)) + 1);
        return {
          id: t.id,
          description: t.description,
          amount: Number(t.amount),
          type: t.type as "income" | "expense",
          interval: t.recurrence_interval || "monthly",
          startDate,
          endDate,
          totalMonths,
          monthsLeft,
          monthsElapsed: Math.min(totalMonths, Math.max(0, totalMonths - monthsLeft)),
          active: monthsLeft > 0,
        };
      })
      .sort((a, b) => a.endDate.localeCompare(b.endDate));
  }, [finance.transactions, selectedAccountIds]);
  const upcomingPayables = useMemo(() => getUpcomingPayables(filteredEvents, todayIso(), 45), [filteredEvents]);

  const invalidate = () => {
    ["finance-accounts", "finance-transfers", "finance-card-invoices", "finance-transactions"].forEach((key) => queryClient.invalidateQueries({ queryKey: [key] }));
  };

  const saveAccountMutation = useMutation({
    mutationFn: async (form: Partial<FinanceAccount> & { id?: string }) => {
      const payload = { ...form, company_id: entities.find((entity) => entity.id === form.entity_id)?.company_id || null };
      const { id, ...values } = payload;
      if (id) assertUuid(id, "ID da conta");
      const result = id ? await (supabase as any).from("finance_accounts").update(values).eq("id", id) : await (supabase as any).from("finance_accounts").insert(values);
      if (result.error) throw result.error;
    },
    onSuccess: () => { invalidate(); toast({ title: "Conta salva" }); },
    onError: (error: any) => toast({ title: "Erro ao salvar conta", description: error.message, variant: "destructive" }),
  });

  const saveTransferMutation = useMutation({
    mutationFn: async (form: Partial<FinanceTransfer>) => {
      const from = accounts.find((account) => account.id === form.from_account_id);
      const { error } = await (supabase as any).from("finance_transfers").insert({ ...form, company_id: from?.company_id || null });
      if (error) throw error;
    },
    onSuccess: () => { invalidate(); toast({ title: "Transferencia registrada" }); },
    onError: (error: any) => toast({ title: "Erro na transferencia", description: error.message, variant: "destructive" }),
  });

  const saveInvoiceMutation = useMutation({
    mutationFn: async (form: Partial<FinanceCardInvoice>) => {
      const account = accounts.find((item) => item.id === form.card_account_id);
      const { error } = await (supabase as any).from("finance_card_invoices").insert({ ...form, company_id: account?.company_id || null });
      if (error) throw error;
    },
    onSuccess: () => { invalidate(); toast({ title: "Fatura criada" }); },
    onError: (error: any) => toast({ title: "Erro ao criar fatura", description: error.message, variant: "destructive" }),
  });

  const payInvoiceMutation = useMutation({
    mutationFn: async ({ invoice, fromAccountId }: { invoice: FinanceCardInvoice; fromAccountId: string }) => {
      const from = accounts.find((account) => account.id === fromAccountId);
      const { data: transfer, error: transferError } = await (supabase as any).from("finance_transfers").insert({
        from_account_id: fromAccountId,
        to_account_id: invoice.card_account_id,
        amount: invoice.amount,
        transfer_date: todayIso(),
        description: `Pagamento de fatura ${accounts.find((account) => account.id === invoice.card_account_id)?.name || "cartao"}`,
        status: "reconciled",
        company_id: from?.company_id || null,
      }).select("id").single();
      if (transferError) throw transferError;
      const { error } = await (supabase as any).from("finance_card_invoices").update({ status: "paid", paid_at: new Date().toISOString(), payment_transfer_id: transfer.id }).eq("id", invoice.id);
      if (error) throw error;
    },
    onSuccess: () => { invalidate(); toast({ title: "Fatura paga" }); },
    onError: (error: any) => toast({ title: "Erro ao pagar fatura", description: error.message, variant: "destructive" }),
  });

  const reconcileTransactionMutation = useMutation({
    mutationFn: async (id: string) => {
      assertUuid(id, "ID da transacao");
      const { error } = await (supabase as any).from("financial_transactions").update({ status: "reconciled", settled_at: new Date().toISOString() }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { invalidate(); toast({ title: "Pagamento confirmado" }); },
  });

  const importCsvMutation = useMutation({
    mutationFn: async ({ content, accountId }: { content: string; accountId: string }) => {
      const rows = parseFinanceCsv(content);
      if (!rows.length) throw new Error("CSV sem colunas reconhecidas: Data, Descricao e Valor.");
      const account = accounts.find((item) => item.id === accountId);
      const fingerprints = rows.map((row) => row.import_fingerprint);
      const { data: existing, error: findError } = await (supabase as any).from("financial_transactions").select("import_fingerprint").in("import_fingerprint", fingerprints);
      if (findError) throw findError;
      const existingSet = new Set((existing || []).map((item: any) => item.import_fingerprint));
      // Dedup tambem DENTRO do proprio CSV (duas linhas identicas no arquivo).
      const seen = new Set<string>();
      const pending = rows.filter((row) => {
        if (existingSet.has(row.import_fingerprint) || seen.has(row.import_fingerprint)) return false;
        seen.add(row.import_fingerprint);
        return true;
      });
      const skipped = rows.length - pending.length;
      if (pending.length) {
        const { error } = await (supabase as any).from("financial_transactions").insert(pending.map((row) => ({ ...row, finance_account_id: accountId, company_id: account?.company_id || null, due_date: row.date, status: "confirmed", source_type: "csv" })));
        if (error) throw error;
      }
      return { inserted: pending.length, skipped };
    },
    onSuccess: ({ inserted, skipped }) => { invalidate(); toast({ title: `${inserted} importada(s)`, description: skipped ? `${skipped} duplicada(s) ignorada(s)` : undefined }); },
    onError: (error: any) => toast({ title: "Erro ao importar CSV", description: error.message, variant: "destructive" }),
  });

  const addInstallmentToFlowMutation = useMutation({
    mutationFn: async ({ installmentId, accountId }: { installmentId: string; accountId: string }) => {
      const installment = finance.savedInstallments.find((item) => item.id === installmentId);
      const account = accounts.find((item) => item.id === accountId);
      if (!installment || !account) throw new Error("Parcelamento ou conta nao encontrado.");
      const groupId = crypto.randomUUID();
      const rows = Array.from({ length: installment.installments }, (_, index) => {
        const dueDate = format(addMonths(new Date(), index + 1), "yyyy-MM-dd");
        return {
          description: `${installment.item_name} (${index + 1}/${installment.installments})`,
          amount: installment.monthly_payment,
          type: "expense",
          category: "Parcelamento",
          date: dueDate,
          due_date: dueDate,
          status: "planned",
          finance_account_id: accountId,
          company_id: account.company_id,
          installment_group_id: groupId,
          installment_number: index + 1,
          installment_total: installment.installments,
          source_type: "installment",
          source_id: installment.id,
        };
      });
      const { error } = await (supabase as any).from("financial_transactions").insert(rows);
      if (error) throw error;
      const { error: updateError } = await (supabase as any).from("finance_saved_installments").update({ entity_id: account.entity_id, account_id: accountId, added_to_flow_at: new Date().toISOString() }).eq("id", installment.id);
      if (updateError) throw updateError;
    },
    onSuccess: () => { invalidate(); queryClient.invalidateQueries({ queryKey: ["finance-saved-installments"] }); toast({ title: "Parcelamento adicionado ao fluxo" }); },
    onError: (error: any) => toast({ title: "Erro ao adicionar parcelamento", description: error.message, variant: "destructive" }),
  });

  // Marca um previsto como recebido/pago. Para ocorrencias projetadas (recorrencias, sem linha
  // no banco) MATERIALIZA uma transacao "reconciled". Dedup por source_id + data.
  const materializeReceived = useMutation({
    mutationFn: async (ev: { sourceId?: string | null; date: string; amount: number; kind: "income" | "expense"; description: string; category?: string | null; accountId?: string | null; companyId?: string | null }) => {
      const src = ev.sourceId || null;
      if (src) {
        const { data: existing } = await (supabase as any)
          .from("financial_transactions").select("id, status").eq("source_id", src).eq("date", ev.date).limit(1);
        const row = existing?.[0];
        if (row) {
          if (row.status !== "reconciled") {
            const { error } = await (supabase as any).from("financial_transactions").update({ status: "reconciled", settled_at: new Date().toISOString() }).eq("id", row.id);
            if (error) throw error;
          }
          return;
        }
      }
      const account = ev.accountId ? accounts.find((a) => a.id === ev.accountId) : null;
      const { error } = await (supabase as any).from("financial_transactions").insert({
        description: ev.description,
        amount: ev.amount,
        type: ev.kind,
        category: ev.category || null,
        date: ev.date,
        due_date: ev.date,
        status: "reconciled",
        settled_at: new Date().toISOString(),
        finance_account_id: ev.accountId || null,
        company_id: ev.companyId ?? account?.company_id ?? (selectedCompanyId !== "all" ? selectedCompanyId : null),
        source_type: "materialized",
        source_id: src,
      });
      if (error) throw error;
    },
    onSuccess: () => { invalidate(); toast({ title: "Marcado como recebido/pago" }); },
    onError: (error: any) => toast({ title: "Erro ao marcar", description: error.message, variant: "destructive" }),
  });

  const cardAccounts = selectedAccounts.filter((account) => account.account_type === "credit_card");
  const reserveBalance = selectedAccounts.filter((account) => account.account_type === "savings" || account.account_type === "investment").reduce((sum, account) => sum + Number(account.opening_balance), 0);

  return {
    ...finance,
    scope, setScope, entities, accounts, selectedEntity, selectedAccounts, cardAccounts, accountBalances,
    transfers, invoices, allEvents, filteredEvents, openingBalance, forecast90, monthlyForecast, contracts,
    canonical, expectedMonthly, upcomingPayables, reserveBalance, entitiesLoading, entitiesError,
    saveAccountMutation, saveTransferMutation, saveInvoiceMutation, payInvoiceMutation,
    reconcileTransactionMutation, importCsvMutation, addInstallmentToFlowMutation, materializeReceived,
  };
};
