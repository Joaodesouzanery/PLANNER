import { useState, useEffect, useMemo } from "react";
import { useCompany } from "@/contexts/CompanyContext";
import { EMSLayout } from "@/components/ems/EMSLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { motion } from "framer-motion";
import {
  DollarSign, FolderKanban, ListTodo, Users, Target, TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight, AlertTriangle, Clock,
} from "lucide-react";
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { format, subMonths, startOfMonth, endOfMonth, parseISO, isAfter, isBefore } from "date-fns";
import { ptBR } from "date-fns/locale";

const CHART_COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--accent))",
  "hsl(142 76% 36%)",
  "hsl(38 92% 50%)",
  "hsl(0 84% 60%)",
  "hsl(262 83% 58%)",
  "hsl(199 89% 48%)",
];

interface KPI {
  label: string;
  value: string;
  icon: React.ElementType;
  trend?: number;
  sub?: string;
}

const Executive = () => {
  const { selectedCompanyId, companies } = useCompany();
  const [dateFrom, setDateFrom] = useState(() => format(startOfMonth(subMonths(new Date(), 1)), "yyyy-MM-dd"));
  const [dateTo, setDateTo] = useState(() => format(new Date(), "yyyy-MM-dd"));

  const [kpis, setKpis] = useState<KPI[]>([]);
  const [statusData, setStatusData] = useState<{ name: string; value: number }[]>([]);
  const [monthCompare, setMonthCompare] = useState<{ name: string; receita: number; despesa: number }[]>([]);
  const [okrsAtRisk, setOkrsAtRisk] = useState<{ title: string; progress: number; end_date: string | null }[]>([]);
  const [loading, setLoading] = useState(true);

  const companyFilter = (q: any) => {
    if (selectedCompanyId !== "all") return q.eq("company_id", selectedCompanyId);
    return q;
  };

  const fetchAll = async () => {
    setLoading(true);

    // Projects
    let projQ = supabase.from("projects").select("*");
    projQ = companyFilter(projQ);
    const { data: projects = [] } = await projQ;

    // Tasks
    let taskQ = supabase.from("tasks").select("*");
    taskQ = companyFilter(taskQ);
    const { data: tasks = [] } = await taskQ;

    // Contacts
    let contQ = supabase.from("contacts").select("*");
    contQ = companyFilter(contQ);
    const { data: contacts = [] } = await contQ;

    // Financial
    let finQ = supabase.from("financial_transactions").select("*");
    finQ = companyFilter(finQ);
    const { data: transactions = [] } = await finQ;

    // OKRs
    let okrQ = supabase.from("okrs").select("*");
    okrQ = companyFilter(okrQ);
    const { data: okrs = [] } = await okrQ;

    // Filter transactions by date range
    const filteredTx = (transactions || []).filter((t: any) => {
      const d = t.date;
      return d >= dateFrom && d <= dateTo;
    });

    const totalReceita = filteredTx.filter((t: any) => t.type === "income").reduce((s: number, t: any) => s + Number(t.amount), 0);
    const totalDespesa = filteredTx.filter((t: any) => t.type === "expense").reduce((s: number, t: any) => s + Number(t.amount), 0);

    // Previous period
    const rangeMs = new Date(dateTo).getTime() - new Date(dateFrom).getTime();
    const prevFrom = format(new Date(new Date(dateFrom).getTime() - rangeMs), "yyyy-MM-dd");
    const prevTo = format(new Date(new Date(dateFrom).getTime() - 1), "yyyy-MM-dd");
    const prevTx = (transactions || []).filter((t: any) => t.date >= prevFrom && t.date <= prevTo);
    const prevReceita = prevTx.filter((t: any) => t.type === "income").reduce((s: number, t: any) => s + Number(t.amount), 0);
    const prevDespesa = prevTx.filter((t: any) => t.type === "expense").reduce((s: number, t: any) => s + Number(t.amount), 0);

    const trendReceita = prevReceita > 0 ? ((totalReceita - prevReceita) / prevReceita) * 100 : 0;
    const trendDespesa = prevDespesa > 0 ? ((totalDespesa - prevDespesa) / prevDespesa) * 100 : 0;

    const allProjects = projects || [];
    const doneProjects = allProjects.filter((p: any) => p.status === "done").length;
    const overdueProjects = allProjects.filter((p: any) => p.due_date && p.status !== "done" && p.due_date < format(new Date(), "yyyy-MM-dd")).length;
    const pendingTasks = (tasks || []).filter((t: any) => t.status !== "done").length;

    const allOkrs = okrs || [];
    const avgOkr = allOkrs.length > 0
      ? Math.round(allOkrs.reduce((s: number, o: any) => s + (o.target_value > 0 ? (o.current_value / o.target_value) * 100 : 0), 0) / allOkrs.length)
      : 0;

    setKpis([
      {
        label: "Receita",
        value: `R$ ${totalReceita.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,
        icon: DollarSign,
        trend: Math.round(trendReceita),
        sub: "no período",
      },
      {
        label: "Despesas",
        value: `R$ ${totalDespesa.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,
        icon: DollarSign,
        trend: Math.round(trendDespesa),
        sub: "no período",
      },
      {
        label: "Projetos",
        value: `${allProjects.length}`,
        icon: FolderKanban,
        sub: `${doneProjects} concluídos · ${overdueProjects} atrasados`,
      },
      {
        label: "Tarefas Pendentes",
        value: `${pendingTasks}`,
        icon: ListTodo,
        sub: `de ${(tasks || []).length} total`,
      },
      {
        label: "Contatos",
        value: `${(contacts || []).length}`,
        icon: Users,
      },
      {
        label: "OKRs (média)",
        value: `${avgOkr}%`,
        icon: Target,
      },
    ]);

    // Status pie chart
    const statusMap: Record<string, number> = {};
    allProjects.forEach((p: any) => {
      statusMap[p.status] = (statusMap[p.status] || 0) + 1;
    });
    setStatusData(Object.entries(statusMap).map(([name, value]) => ({ name, value })));

    // Month compare bar chart (current month vs previous)
    const now = new Date();
    const curMonth = startOfMonth(now);
    const prevMonth = startOfMonth(subMonths(now, 1));
    const curEnd = endOfMonth(now);
    const prevEnd = endOfMonth(subMonths(now, 1));

    const curIncome = (transactions || []).filter((t: any) => t.type === "income" && t.date >= format(curMonth, "yyyy-MM-dd") && t.date <= format(curEnd, "yyyy-MM-dd")).reduce((s: number, t: any) => s + Number(t.amount), 0);
    const curExpense = (transactions || []).filter((t: any) => t.type === "expense" && t.date >= format(curMonth, "yyyy-MM-dd") && t.date <= format(curEnd, "yyyy-MM-dd")).reduce((s: number, t: any) => s + Number(t.amount), 0);
    const pmIncome = (transactions || []).filter((t: any) => t.type === "income" && t.date >= format(prevMonth, "yyyy-MM-dd") && t.date <= format(prevEnd, "yyyy-MM-dd")).reduce((s: number, t: any) => s + Number(t.amount), 0);
    const pmExpense = (transactions || []).filter((t: any) => t.type === "expense" && t.date >= format(prevMonth, "yyyy-MM-dd") && t.date <= format(prevEnd, "yyyy-MM-dd")).reduce((s: number, t: any) => s + Number(t.amount), 0);

    setMonthCompare([
      { name: format(prevMonth, "MMM/yy", { locale: ptBR }), receita: pmIncome, despesa: pmExpense },
      { name: format(curMonth, "MMM/yy", { locale: ptBR }), receita: curIncome, despesa: curExpense },
    ]);

    // OKRs at risk
    const risky = allOkrs
      .filter((o: any) => {
        const progress = o.target_value > 0 ? (o.current_value / o.target_value) * 100 : 0;
        return progress < 50 && o.end_date;
      })
      .map((o: any) => ({
        title: o.title,
        progress: o.target_value > 0 ? Math.round((o.current_value / o.target_value) * 100) : 0,
        end_date: o.end_date,
      }));
    setOkrsAtRisk(risky);

    setLoading(false);
  };

  useEffect(() => {
    fetchAll();
  }, [selectedCompanyId, dateFrom, dateTo]);

  return (
    <EMSLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-foreground">Dashboard Executivo</h1>
            <p className="text-sm text-muted-foreground">Visão 360° consolidada de todos os módulos</p>
          </div>
          <div className="flex items-center gap-2">
            <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-36 text-xs" />
            <span className="text-muted-foreground text-xs">até</span>
            <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-36 text-xs" />
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {kpis.map((kpi, i) => (
            <motion.div key={kpi.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
              <Card className="h-full">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <kpi.icon className="h-4 w-4 text-muted-foreground" />
                    {kpi.trend !== undefined && (
                      <Badge variant={kpi.trend >= 0 ? "default" : "destructive"} className="text-[10px] px-1 py-0">
                        {kpi.trend >= 0 ? <ArrowUpRight className="h-3 w-3 mr-0.5" /> : <ArrowDownRight className="h-3 w-3 mr-0.5" />}
                        {Math.abs(kpi.trend)}%
                      </Badge>
                    )}
                  </div>
                  <p className="text-lg md:text-xl font-bold text-foreground">{kpi.value}</p>
                  <p className="text-[11px] text-muted-foreground">{kpi.label}</p>
                  {kpi.sub && <p className="text-[10px] text-muted-foreground mt-1">{kpi.sub}</p>}
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* Charts row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Month comparison */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Comparativo Mensal</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthCompare}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="name" className="text-xs fill-muted-foreground" />
                    <YAxis className="text-xs fill-muted-foreground" />
                    <Tooltip formatter={(value: number) => `R$ ${value.toLocaleString("pt-BR")}`} />
                    <Legend />
                    <Bar dataKey="receita" name="Receita" fill="hsl(142 76% 36%)" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="despesa" name="Despesa" fill="hsl(0 84% 60%)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Projects by status */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Projetos por Status</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={statusData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={(e) => `${e.name} (${e.value})`}>
                      {statusData.map((_, i) => (
                        <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* OKRs at Risk */}
        {okrsAtRisk.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-destructive" />
                OKRs em Risco ({okrsAtRisk.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {okrsAtRisk.map((okr, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{okr.title}</p>
                      {okr.end_date && (
                        <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          Prazo: {format(parseISO(okr.end_date), "dd/MM/yyyy")}
                        </p>
                      )}
                    </div>
                    <div className="w-24 flex items-center gap-2">
                      <Progress value={okr.progress} className="h-2" />
                      <span className="text-xs text-muted-foreground w-8">{okr.progress}%</span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </EMSLayout>
  );
};

export default Executive;
