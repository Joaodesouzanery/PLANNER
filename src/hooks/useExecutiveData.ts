import { useMemo } from "react";
import { useCompanyQuery } from "@/hooks/useCompanyQuery";
import { format, subMonths, startOfMonth, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";

export interface KPI {
  label: string;
  value: string;
  icon: string;
  trend?: number;
  sub?: string;
}

export function useExecutiveData(dateFrom: string, dateTo: string) {
  const { data: projects = [] } = useCompanyQuery({ table: "projects" });
  const { data: tasks = [] } = useCompanyQuery({ table: "tasks" });
  const { data: contacts = [] } = useCompanyQuery({ table: "contacts" });
  const { data: transactions = [] } = useCompanyQuery({ table: "financial_transactions" });
  const { data: okrs = [] } = useCompanyQuery({ table: "okrs" });

  return useMemo(() => {
    const allProjects = projects as any[];
    const allTasks = tasks as any[];
    const allContacts = contacts as any[];
    const allTx = transactions as any[];
    const allOkrs = okrs as any[];

    // Filter transactions by date range
    const filteredTx = allTx.filter((t) => t.date >= dateFrom && t.date <= dateTo);
    const totalReceita = filteredTx.filter((t) => t.type === "income").reduce((s, t) => s + Number(t.amount), 0);
    const totalDespesa = filteredTx.filter((t) => t.type === "expense").reduce((s, t) => s + Number(t.amount), 0);

    // Previous period
    const rangeMs = new Date(dateTo).getTime() - new Date(dateFrom).getTime();
    const prevFrom = format(new Date(new Date(dateFrom).getTime() - rangeMs), "yyyy-MM-dd");
    const prevTo = format(new Date(new Date(dateFrom).getTime() - 1), "yyyy-MM-dd");
    const prevTx = allTx.filter((t) => t.date >= prevFrom && t.date <= prevTo);
    const prevReceita = prevTx.filter((t) => t.type === "income").reduce((s, t) => s + Number(t.amount), 0);
    const prevDespesa = prevTx.filter((t) => t.type === "expense").reduce((s, t) => s + Number(t.amount), 0);

    const trendReceita = prevReceita > 0 ? Math.round(((totalReceita - prevReceita) / prevReceita) * 100) : 0;
    const trendDespesa = prevDespesa > 0 ? Math.round(((totalDespesa - prevDespesa) / prevDespesa) * 100) : 0;

    const doneProjects = allProjects.filter((p) => p.status === "done").length;
    const overdueProjects = allProjects.filter((p) => p.due_date && p.status !== "done" && p.due_date < format(new Date(), "yyyy-MM-dd")).length;
    const pendingTasks = allTasks.filter((t) => t.status !== "done").length;

    const avgOkr = allOkrs.length > 0
      ? Math.round(allOkrs.reduce((s, o) => s + (o.target_value > 0 ? (o.current_value / o.target_value) * 100 : 0), 0) / allOkrs.length)
      : 0;

    const kpis: KPI[] = [
      { label: "Receita", value: `R$ ${totalReceita.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`, icon: "DollarSign", trend: trendReceita, sub: "no período" },
      { label: "Despesas", value: `R$ ${totalDespesa.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`, icon: "DollarSign", trend: trendDespesa, sub: "no período" },
      { label: "Projetos", value: `${allProjects.length}`, icon: "FolderKanban", sub: `${doneProjects} concluídos · ${overdueProjects} atrasados` },
      { label: "Tarefas Pendentes", value: `${pendingTasks}`, icon: "ListTodo", sub: `de ${allTasks.length} total` },
      { label: "Contatos", value: `${allContacts.length}`, icon: "Users" },
      { label: "OKRs (média)", value: `${avgOkr}%`, icon: "Target" },
    ];

    // Status pie chart
    const statusMap: Record<string, number> = {};
    allProjects.forEach((p) => { statusMap[p.status] = (statusMap[p.status] || 0) + 1; });
    const statusData = Object.entries(statusMap).map(([name, value]) => ({ name, value }));

    // Month compare
    const now = new Date();
    const curMonth = startOfMonth(now);
    const prevMonth = startOfMonth(subMonths(now, 1));
    const curEnd = endOfMonth(now);
    const prevEnd = endOfMonth(subMonths(now, 1));

    const monthFilter = (type: string, from: Date, to: Date) =>
      allTx.filter((t) => t.type === type && t.date >= format(from, "yyyy-MM-dd") && t.date <= format(to, "yyyy-MM-dd")).reduce((s, t) => s + Number(t.amount), 0);

    const monthCompare = [
      { name: format(prevMonth, "MMM/yy", { locale: ptBR }), receita: monthFilter("income", prevMonth, prevEnd), despesa: monthFilter("expense", prevMonth, prevEnd) },
      { name: format(curMonth, "MMM/yy", { locale: ptBR }), receita: monthFilter("income", curMonth, curEnd), despesa: monthFilter("expense", curMonth, curEnd) },
    ];

    // OKRs at risk
    const okrsAtRisk = allOkrs
      .filter((o) => {
        const progress = o.target_value > 0 ? (o.current_value / o.target_value) * 100 : 0;
        return progress < 50 && o.end_date;
      })
      .map((o) => ({
        title: o.title,
        progress: o.target_value > 0 ? Math.round((o.current_value / o.target_value) * 100) : 0,
        end_date: o.end_date,
      }));

    return { kpis, statusData, monthCompare, okrsAtRisk };
  }, [projects, tasks, contacts, transactions, okrs, dateFrom, dateTo]);
}
