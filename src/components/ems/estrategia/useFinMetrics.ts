import { useMemo } from "react";
import { format } from "date-fns";
import { useFinanceWorkspace } from "@/components/ems/finance/useFinanceWorkspace";
import { useFinanceSettings } from "@/components/ems/finance/useFinanceSettings";
import { usePatrimonio } from "@/components/ems/finance/usePatrimonio";
import { computeCfo } from "@/components/ems/finance/financeCfo";
import { computeNetWorth, investimentosPrincipal } from "@/components/ems/finance/financePatrimonioCalc";
import { activeIncomeContracts, mrrHeadline } from "@/components/ems/finance/financeMrr";
import { intervalFactor } from "@/components/ems/finance/projectionCalc";
import type { FinMetrics } from "./estrategiaProgress";

// Fonte ÚNICA dos 4 valores canônicos que as metas financeiras da Estratégia leem automaticamente.
// Reusa exatamente a fiação do app (FinanceKpis p/ MRR/sobra; FinancePatrimonio p/ patrimônio) — não
// recalcula nada por fora. É o "atual" das metas mrr/reserva/patrimonio/sobra.
const todayIso = () => format(new Date(), "yyyy-MM-dd");
const monthsUntil = (from: string, to: string) => {
  const [fy, fm] = from.split("-").map(Number);
  const [ty, tm] = to.split("-").map(Number);
  return Math.max(0, (ty - fy) * 12 + (tm - fm));
};

export const useFinMetrics = (): FinMetrics => {
  const workspace = useFinanceWorkspace();
  const { settings } = useFinanceSettings();
  const { items } = usePatrimonio();

  return useMemo<FinMetrics>(() => {
    const rows = workspace.canonical.rows;
    const txns = workspace.rawTransactions as any[];
    const reserva = workspace.reserveBalance;

    // sobra mensal — mesma chamada canônica de FinanceKpis/FinancePatrimonio
    const cfo = computeCfo(rows, settings, reserva, todayIso(), workspace.expectedMonthly);

    // MRR — headline dos contratos de receita ativos deste mês (base do FinanceKpis)
    const curKey = format(new Date(), "yyyy-MM");
    const mrr = mrrHeadline(activeIncomeContracts(txns, curKey));

    // patrimônio líquido — mesma composição do FinancePatrimonio
    const today = todayIso();
    const caixa = workspace.canonical.saldoRealHoje;
    const installments = rows.filter((r: any) => r.sourceType === "installment" && !r.paid).reduce((a: number, r: any) => a + r.amount, 0);
    const recorrentesComFim = (workspace.transactions as any[])
      .filter((t) => t.type === "expense" && t.is_recurring && t.recurrence_end_date && t.recurrence_end_date >= today)
      .reduce((a, t) => a + Number(t.amount) * intervalFactor(t.recurrence_interval) * monthsUntil(today, t.recurrence_end_date), 0);
    const ativosManuais = items.filter((i) => i.kind === "asset").reduce((a, i) => a + Number(i.value), 0);
    const passivosManuais = items.filter((i) => i.kind === "liability").reduce((a, i) => a + Number(i.value), 0);
    const investimentos = investimentosPrincipal(workspace.selectedAccounts);
    const { patrimonioLiquido } = computeNetWorth({
      caixa, investimentos, ativosManuais, passivosAuto: installments + recorrentesComFim, passivosManuais,
    });

    return { mrr, reserva, patrimonio: patrimonioLiquido, sobra: cfo.sobraMensal };
  }, [
    workspace.canonical.rows, workspace.canonical.saldoRealHoje, workspace.rawTransactions,
    workspace.transactions, workspace.reserveBalance, workspace.expectedMonthly, workspace.selectedAccounts,
    settings, items,
  ]);
};
