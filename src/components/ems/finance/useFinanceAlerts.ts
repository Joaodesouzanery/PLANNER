import { useMemo } from "react";
import { addMonths, format } from "date-fns";
import { fmtCurrency } from "./useFinanceData";
import { useFinanceWorkspace } from "./useFinanceWorkspace";
import { useFinanceSettings } from "./useFinanceSettings";
import { useClientes } from "./useClientes";
import { useCategoryBudgets } from "./useCategoryBudgets";
import { computeCfo } from "./financeCfo";
import { buildClientRevenue, clientConcentration } from "./financeClients";
import { buildBudgetLines } from "./financeBudget";
import { rbt12Status } from "./financeRbt12";
import { buildAlerts } from "./financeAlerts";

const todayIso = () => format(new Date(), "yyyy-MM-dd");

/** Junta a fonte única + Fases 1/3/5 e roda o engine de alertas. Nada é persistido (derivado). */
export const useFinanceAlerts = () => {
  const workspace = useFinanceWorkspace();
  const { settings } = useFinanceSettings();
  const { clientes } = useClientes();
  const now = new Date();
  const { budgets } = useCategoryBudgets(now.getFullYear(), now.getMonth() + 1);
  const curKey = format(now, "yyyy-MM");

  return useMemo(() => {
    const cfo = computeCfo(workspace.canonical.rows, settings, workspace.reserveBalance, todayIso(), workspace.expectedMonthly);
    const curva90 = workspace.canonical.curva(90);

    const realizadoPorCat: Record<string, number> = {};
    for (const r of workspace.canonical.rows) {
      if (r.type !== "expense" || !r.paid || r.date.slice(0, 7) !== curKey) continue;
      const c = r.category || "Sem categoria";
      realizadoPorCat[c] = (realizadoPorCat[c] || 0) + r.amount;
    }
    const lines = buildBudgetLines(budgets.map((b) => ({ category: b.category, teto: Number(b.teto) })), realizadoPorCat);
    const budgetEstouros = lines.filter((l) => l.estourou).map((l) => ({ category: l.category, saldo: l.saldo }));

    const { clients } = buildClientRevenue(workspace.rawTransactions as any[], clientes);
    const conc = clientConcentration(clients);

    const rbt = rbt12Status(workspace.monthlyData ?? [], settings.rbt12_limit, settings.rbt12_alert_pct ?? 80, cfo.faturamentoMensal);
    const rbtCruzaEm = rbt?.mesesAteCruzar != null ? format(addMonths(new Date(), rbt.mesesAteCruzar), "MMM/yy") : null;

    const alerts = buildAlerts({
      cfo,
      curva90,
      reservaAlvo: cfo.reservaAlvo,
      budgetEstouros,
      concentracaoTop1: clients.length ? conc.top1Share : null,
      rbt12: rbt?.alert ? { pct: rbt.pct, cruzaEm: rbtCruzaEm } : null,
      brl: fmtCurrency,
    });
    return { alerts, cfo };
  }, [workspace.canonical, workspace.rawTransactions, workspace.reserveBalance, workspace.expectedMonthly, workspace.monthlyData, settings, budgets, clientes, curKey]);
};
