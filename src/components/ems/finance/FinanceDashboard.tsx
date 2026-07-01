import { useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { ArrowUpRight, ArrowDownRight, CalendarClock, CalendarDays, CheckCircle2, ChevronLeft, ChevronRight, DollarSign, FileDown, RotateCcw, Wallet, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { format, startOfMonth, endOfMonth, addMonths, subMonths, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell, AreaChart, Area, CartesianGrid, XAxis, YAxis, Tooltip, Legend } from "recharts";
import { fmtCurrency, formatDateBR, tooltipStyle, PIE_COLORS } from "./useFinanceData";
import { useFinanceWorkspace } from "./useFinanceWorkspace";
import { Badge } from "@/components/ui/badge";
import { DateRangeFilter } from "@/components/ems/DateRangeFilter";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { exportTablePdf, captureChart } from "@/lib/exportPdf";
import { toast } from "sonner";
import FinanceAverages from "./FinanceAverages";

const todayIso = () => format(new Date(), "yyyy-MM-dd");
const defaultFrom = () => format(startOfMonth(new Date()), "yyyy-MM-dd");
const defaultTo = () => format(endOfMonth(new Date()), "yyyy-MM-dd");

const FinanceDashboard = () => {
  const { dashboardTransactions, capitalEvolution, currentMonthPlanSummary, upcomingPayables, reconcileTransactionMutation, allEvents, transactionsUpdatedAt, projectionData } = useFinanceWorkspace();
  const queryClient = useQueryClient();
  const [from, setFrom] = useState(defaultFrom());
  const [to, setTo] = useState(defaultTo());
  const [, setTick] = useState(0);
  const [exporting, setExporting] = useState(false);
  const chartRevExp = useRef<HTMLDivElement>(null);
  const chartCapital = useRef<HTMLDivElement>(null);
  const chartIncomeCat = useRef<HTMLDivElement>(null);
  const chartExpenseCat = useRef<HTMLDivElement>(null);

  // Mantem o rotulo "atualizado ha X" vivo sem precisar de nova query.
  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  const lastUpdatedLabel = transactionsUpdatedAt
    ? formatDistanceToNow(new Date(transactionsUpdatedAt), { addSuffix: true, locale: ptBR })
    : "—";

  const refreshAll = () => {
    ["finance-transactions", "finance-monthly-plans", "finance-plan-items", "finance-transfers", "finance-card-invoices", "finance-accounts"]
      .forEach((key) => queryClient.invalidateQueries({ queryKey: [key] }));
  };

  const setPreset = (preset: string) => {
    const today = new Date();
    if (preset === "prev-month") { goMonth(-1); }
    else if (preset === "next-month") { goMonth(1); }
    else if (preset === "this-month") { setFrom(format(startOfMonth(today), "yyyy-MM-dd")); setTo(format(endOfMonth(today), "yyyy-MM-dd")); }
    else if (preset === "3m") { setFrom(format(startOfMonth(subMonths(today, 2)), "yyyy-MM-dd")); setTo(format(endOfMonth(today), "yyyy-MM-dd")); }
    else if (preset === "6m") { setFrom(format(startOfMonth(subMonths(today, 5)), "yyyy-MM-dd")); setTo(format(endOfMonth(today), "yyyy-MM-dd")); }
    else if (preset === "12m") { setFrom(format(startOfMonth(subMonths(today, 11)), "yyyy-MM-dd")); setTo(format(endOfMonth(today), "yyyy-MM-dd")); }
    else if (preset === "ytd") { setFrom(`${today.getFullYear()}-01-01`); setTo(todayIso()); }
  };

  // Fonte unificada: realizado (dashboardTransactions) + previsto (allEvents do workspace,
  // que já inclui plan items, recorrências futuras e transações planejadas).
  const periodSource = useMemo(() => {
    const today = todayIso();
    const realized = dashboardTransactions.map((t) => ({
      id: t.id, date: String(t.date).slice(0, 10), type: t.type, amount: Number(t.amount), category: t.category || null, projected: false,
    }));
    // Dedup pelo ID EXATO do evento (nao por sourceId): assim as ocorrencias
    // futuras de uma recorrencia (id "${tx.id}-future-N") contam em cada mes,
    // enquanto uma transacao realizada que reapareceria como evento (mesmo id)
    // segue suprimida.
    const seenIds = new Set(realized.map((r) => r.id));
    const future = (allEvents || []).filter((e) => (e.kind === "income" || e.kind === "expense") && e.date > today && !seenIds.has(e.id))
      .map((e) => ({ id: e.id, date: String(e.date).slice(0, 10), type: e.kind as "income" | "expense", amount: Number(e.amount), category: e.category || null, projected: true }));
    return [...realized, ...future];
  }, [dashboardTransactions, allEvents]);

  const filtered = useMemo(() => periodSource.filter((t) => t.date >= from && t.date <= to), [periodSource, from, to]);

  const totalIncome = useMemo(() => filtered.filter(t => t.type === "income").reduce((a, t) => a + Number(t.amount), 0), [filtered]);
  const totalExpense = useMemo(() => filtered.filter(t => t.type === "expense").reduce((a, t) => a + Number(t.amount), 0), [filtered]);
  const balance = totalIncome - totalExpense;

  const incomeByCat = useMemo(() => {
    const map: Record<string, number> = {};
    filtered.filter(t => t.type === "income").forEach(t => { const c = t.category || "Sem categoria"; map[c] = (map[c] || 0) + Number(t.amount); });
    return Object.entries(map).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [filtered]);

  const expenseByCat = useMemo(() => {
    const map: Record<string, number> = {};
    filtered.filter(t => t.type === "expense").forEach(t => { const c = t.category || "Sem categoria"; map[c] = (map[c] || 0) + Number(t.amount); });
    return Object.entries(map).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [filtered]);

  const monthlyData = useMemo(() => {
    const months: Record<string, { month: string; income: number; expense: number; balance: number }> = {};
    filtered.forEach((t) => {
      const key = String(t.date).slice(0, 7);
      if (!months[key]) months[key] = { month: key, income: 0, expense: 0, balance: 0 };
      if (t.type === "income") months[key].income += Number(t.amount);
      else months[key].expense += Number(t.amount);
    });
    return Object.values(months).sort((a, b) => a.month.localeCompare(b.month)).map(m => ({ ...m, balance: m.income - m.expense }));
  }, [filtered]);

  const goMonth = (delta: number) => {
    const target = addMonths(new Date(`${from}T00:00:00`), delta);
    setFrom(format(startOfMonth(target), "yyyy-MM-dd"));
    setTo(format(endOfMonth(target), "yyyy-MM-dd"));
  };
  const periodLabel = (() => {
    try { return format(new Date(`${from}T00:00:00`), "MMM yyyy", { locale: ptBR }); } catch { return ""; }
  })();

  const exportPeriodReport = async () => {
    setExporting(true);
    try {
      const money = (v: number) => fmtCurrency(Number(v));
      const [imgRevExp, imgCapital, imgIncome, imgExpense] = await Promise.all([
        captureChart(chartRevExp.current), captureChart(chartCapital.current),
        captureChart(chartIncomeCat.current), captureChart(chartExpenseCat.current),
      ]);
      const images = [
        imgRevExp && { heading: "Receita vs Despesa no período", dataUrl: imgRevExp, height: 70 },
        imgCapital && { heading: "Evolução do Capital (12 meses)", dataUrl: imgCapital, height: 70 },
        imgIncome && { heading: "Receita por Categoria", dataUrl: imgIncome, width: 100, height: 70 },
        imgExpense && { heading: "Despesas por Categoria", dataUrl: imgExpense, width: 100, height: 70 },
      ].filter(Boolean) as { heading: string; dataUrl: string; width?: number; height?: number }[];

      const sections = [
        { heading: "Resumo do período", head: [["Indicador", "Valor"]], body: [
          ["Entradas", money(totalIncome)], ["Saídas", money(totalExpense)], ["Saldo", money(balance)], ["Lançamentos", String(filtered.length)],
        ] },
        { heading: "Planejado × realizado (mês corrente)", head: [["Indicador", "Valor"]], body: [
          ["Entradas previstas", money(currentMonthPlanSummary.plannedIncome)],
          ["Saídas previstas", money(currentMonthPlanSummary.plannedExpense)],
          ["Saldo planejado", money(currentMonthPlanSummary.plannedBalance)],
          ["Saldo realizado", money(currentMonthPlanSummary.realizedBalance)],
          ["Diferença", money(currentMonthPlanSummary.variance)],
        ] },
        { heading: "Entradas por categoria", head: [["Categoria", "Valor"]], body: incomeByCat.length ? incomeByCat.map((c) => [c.name, money(c.value)]) : [["—", "—"]] },
        { heading: "Saídas por categoria", head: [["Categoria", "Valor"]], body: expenseByCat.length ? expenseByCat.map((c) => [c.name, money(c.value)]) : [["—", "—"]] },
        { heading: "Mês a mês (período)", head: [["Mês", "Entradas", "Saídas", "Saldo"]], body: monthlyData.length ? monthlyData.map((m) => [m.month, money(m.income), money(m.expense), money(m.balance)]) : [["—", "—", "—", "—"]] },
        { heading: "Falta pagar (45 dias)", head: [["Vencimento", "Descrição", "Valor"]], body: upcomingPayables.length ? upcomingPayables.map((p) => [formatDateBR(p.dueDate), p.description, money(p.amount)]) : [["—", "—", "—"]] },
        { heading: "Projeção (3 meses)", head: [["Mês", "Entradas", "Saídas", "Saldo", "Tipo"]], body: projectionData.map((p) => [p.month, money(p.income), money(p.expense), money(p.balance), p.projected ? "Projetado" : "Realizado"]) },
        { heading: `Transações do período (${filtered.length})`, head: [["Data", "Tipo", "Categoria", "Situação", "Valor"]], body: [...filtered].sort((a, b) => String(b.date).localeCompare(String(a.date))).map((t) => [formatDateBR(t.date), t.type === "income" ? "Entrada" : "Saída", t.category || "-", t.projected ? "Prevista" : "Realizada", money(t.amount)]) },
      ];

      await exportTablePdf({
        title: "Relatório Financeiro do Período",
        subtitle: `${formatDateBR(from)} a ${formatDateBR(to)} · gerado em ${format(new Date(), "dd/MM/yyyy HH:mm")}`,
        filename: `financeiro-${from}_a_${to}.pdf`,
        images,
        sections,
      });
      toast.success("Relatório do período exportado!");
    } catch (err: any) {
      toast.error("Falha ao exportar", { description: err?.message });
    } finally {
      setExporting(false);
    }
  };

  return (
    <Tabs defaultValue="overview" className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <TabsList className="bg-card/80 border border-border/50 rounded-xl">
          <TabsTrigger value="overview" className="rounded-lg data-[state=active]:bg-primary/15 data-[state=active]:text-primary">Visão geral</TabsTrigger>
          <TabsTrigger value="averages" className="rounded-lg data-[state=active]:bg-primary/15 data-[state=active]:text-primary">Médias & mês</TabsTrigger>
        </TabsList>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />Atualizado {lastUpdatedLabel}</span>
          <Button variant="outline" size="sm" className="h-8 text-xs rounded-lg" onClick={exportPeriodReport} disabled={exporting}><FileDown className="h-3.5 w-3.5 mr-1" />{exporting ? "Gerando..." : "Exportar período"}</Button>
          <Button variant="outline" size="sm" className="h-8 text-xs rounded-lg" onClick={refreshAll}><RefreshCw className="h-3.5 w-3.5 mr-1" />Atualizar</Button>
        </div>
      </div>

      <TabsContent value="overview" className="mt-0 space-y-6">
        <Card className="border border-border/50 bg-card/80">
          <CardContent className="p-3 flex flex-wrap items-center gap-3">
            <DollarSign className="h-4 w-4 text-primary" />
            <span className="text-xs font-medium text-muted-foreground">Periodo:</span>
            <div className="flex items-center gap-1">
              <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => goMonth(-1)} title="Mês anterior"><ChevronLeft className="h-4 w-4" /></Button>
              <span className="min-w-[70px] text-center text-xs font-medium capitalize">{periodLabel}</span>
              <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => goMonth(1)} title="Mês seguinte"><ChevronRight className="h-4 w-4" /></Button>
            </div>
            <DateRangeFilter dateFrom={from} dateTo={to} onDateFromChange={setFrom} onDateToChange={setTo} />
            <Select onValueChange={setPreset}>
              <SelectTrigger className="w-[170px] h-9 text-xs"><SelectValue placeholder="Atalhos" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="prev-month">Mes anterior</SelectItem>
                <SelectItem value="this-month">Este mes</SelectItem>
                <SelectItem value="next-month">Proximo mes</SelectItem>
                <SelectItem value="3m">Ultimos 3 meses</SelectItem>
                <SelectItem value="6m">Ultimos 6 meses</SelectItem>
                <SelectItem value="12m">Ultimos 12 meses</SelectItem>
                <SelectItem value="ytd">Ano atual</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="ghost" size="sm" className="h-9 text-xs" onClick={() => { setFrom(defaultFrom()); setTo(defaultTo()); }}>
              <RotateCcw className="h-3.5 w-3.5 mr-1" /> Limpar filtro
            </Button>
            <div className="ml-auto flex items-center gap-1.5">
              <Badge variant="outline" className="text-xs">{filtered.filter(f => !f.projected).length} realizadas</Badge>
              {filtered.some(f => f.projected) && <Badge variant="secondary" className="text-xs">{filtered.filter(f => f.projected).length} previstas</Badge>}
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Entradas", value: fmtCurrency(totalIncome), icon: ArrowUpRight, color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/20" },
            { label: "Saídas", value: fmtCurrency(totalExpense), icon: ArrowDownRight, color: "text-destructive", bg: "bg-destructive/10", border: "border-destructive/20" },
            { label: "Saldo", value: fmtCurrency(balance), icon: DollarSign, color: balance >= 0 ? "text-emerald-400" : "text-destructive", bg: balance >= 0 ? "bg-emerald-500/10" : "bg-destructive/10", border: balance >= 0 ? "border-emerald-500/20" : "border-destructive/20" },
            { label: "Lançamentos", value: filtered.length, icon: Wallet, color: "text-primary", bg: "bg-primary/10", border: "border-primary/20" },
          ].map((s, i) => (
            <motion.div key={s.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
              <Card className={cn("border transition-all duration-300 hover:scale-[1.03]", s.border)}>
                <CardContent className="p-4 flex items-center gap-3">
                  <div className={cn("p-2 rounded-lg", s.bg)}><s.icon className={cn("h-5 w-5", s.color)} /></div>
                  <div><p className="text-lg sm:text-xl font-bold font-mono">{s.value}</p><p className="text-[10px] sm:text-xs text-muted-foreground">{s.label}</p></div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        <Card className="border border-primary/20 bg-card/80">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-primary" />
              Planejamento do mes vs realizado (mes corrente)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
              {[
                { label: "Entradas previstas", value: currentMonthPlanSummary.plannedIncome, color: "text-emerald-400" },
                { label: "Saidas previstas", value: currentMonthPlanSummary.plannedExpense, color: "text-destructive" },
                { label: "Saldo planejado", value: currentMonthPlanSummary.plannedBalance, color: currentMonthPlanSummary.plannedBalance >= 0 ? "text-emerald-400" : "text-destructive" },
                { label: "Saldo realizado", value: currentMonthPlanSummary.realizedBalance, color: currentMonthPlanSummary.realizedBalance >= 0 ? "text-emerald-400" : "text-destructive" },
                { label: "Diferenca", value: currentMonthPlanSummary.variance, color: currentMonthPlanSummary.variance >= 0 ? "text-emerald-400" : "text-destructive" },
              ].map((item) => (
                <div key={item.label} className="rounded-lg border border-border/50 bg-background/40 p-3">
                  <p className="text-xs text-muted-foreground">{item.label}</p>
                  <p className={cn("text-lg font-bold font-mono mt-1", item.color)}>{fmtCurrency(item.value)}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="border border-amber-500/20 bg-card/80">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between gap-3">
              <CardTitle className="text-base flex items-center gap-2">
                <CalendarClock className="h-4 w-4 text-amber-500" />
                Falta pagar
              </CardTitle>
              <Badge variant="outline" className="border-amber-500/30 text-amber-500">
                {fmtCurrency(upcomingPayables.reduce((sum, item) => sum + item.amount, 0))} em 45 dias
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {upcomingPayables.slice(0, 8).map((item) => (
              <div key={item.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-lg border border-border/50 p-3">
                <div className="min-w-0">
                  <p className="font-medium text-sm truncate">{item.description}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-muted-foreground">{formatDateBR(item.dueDate)}</span>
                    <Badge variant="outline" className={cn("text-[10px]", item.status === "overdue" && "border-destructive/40 text-destructive", item.status === "today" && "border-amber-500/40 text-amber-500", item.status === "soon" && "border-orange-500/40 text-orange-500")}>
                      {item.status === "overdue" ? `${Math.abs(item.daysUntilDue)} dias atrasada` : item.status === "today" ? "Vence hoje" : `Faltam ${item.daysUntilDue} dias`}
                    </Badge>
                  </div>
                </div>
                <div className="flex items-center justify-between sm:justify-end gap-3">
                  <span className="font-mono font-semibold text-destructive">{fmtCurrency(item.amount)}</span>
                  {item.sourceType === "transaction" && (
                    <Button size="sm" variant="ghost" className="h-8" onClick={() => reconcileTransactionMutation.mutate(item.id)}>
                      <CheckCircle2 className="h-4 w-4 mr-1" /> Paguei
                    </Button>
                  )}
                </div>
              </div>
            ))}
            {upcomingPayables.length === 0 && <p className="text-sm text-muted-foreground text-center py-6">Nenhum pagamento pendente nos proximos 45 dias.</p>}
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card className="border border-border/50 bg-card/80">
            <CardHeader className="pb-2"><CardTitle className="text-base">Receita vs Despesa no periodo</CardTitle></CardHeader>
            <CardContent><div ref={chartRevExp} className="h-[280px]"><ResponsiveContainer width="100%" height="100%"><BarChart data={monthlyData}><CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" /><XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={11} /><YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} /><Tooltip contentStyle={tooltipStyle} formatter={(v: number) => fmtCurrency(v)} /><Legend /><Bar dataKey="income" fill="hsl(142.1, 76.2%, 36.3%)" name="Entradas" radius={[4, 4, 0, 0]} /><Bar dataKey="expense" fill="hsl(0, 84.2%, 60.2%)" name="Saídas" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer></div></CardContent>
          </Card>
          <Card className="border border-border/50 bg-card/80">
            <CardHeader className="pb-2"><CardTitle className="text-base">Evolução do Capital (12 meses)</CardTitle></CardHeader>
            <CardContent><div ref={chartCapital} className="h-[280px]"><ResponsiveContainer width="100%" height="100%"><AreaChart data={capitalEvolution}><CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" /><XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={11} /><YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} /><Tooltip contentStyle={tooltipStyle} formatter={(v: number) => fmtCurrency(v)} /><Area type="monotone" dataKey="capital" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.15} strokeWidth={2} /></AreaChart></ResponsiveContainer></div></CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card className="border border-border/50 bg-card/80">
            <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><ArrowUpRight className="h-4 w-4 text-emerald-400" />Receita por Categoria</CardTitle></CardHeader>
            <CardContent>
              <div ref={chartIncomeCat} className="h-[250px]">{incomeByCat.length > 0 ? (<ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={incomeByCat} cx="50%" cy="50%" innerRadius={45} outerRadius={80} paddingAngle={3} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>{incomeByCat.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}</Pie><Tooltip contentStyle={tooltipStyle} formatter={(v: number) => fmtCurrency(v)} /></PieChart></ResponsiveContainer>) : <div className="h-full flex items-center justify-center text-muted-foreground text-sm italic">Nenhuma receita no periodo</div>}</div>
            </CardContent>
          </Card>
          <Card className="border border-border/50 bg-card/80">
            <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><ArrowDownRight className="h-4 w-4 text-destructive" />Despesas por Categoria</CardTitle></CardHeader>
            <CardContent>
              <div ref={chartExpenseCat} className="h-[250px]">{expenseByCat.length > 0 ? (<ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={expenseByCat} cx="50%" cy="50%" innerRadius={45} outerRadius={80} paddingAngle={3} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>{expenseByCat.map((_, i) => <Cell key={i} fill={PIE_COLORS[(i + 2) % PIE_COLORS.length]} />)}</Pie><Tooltip contentStyle={tooltipStyle} formatter={(v: number) => fmtCurrency(v)} /></PieChart></ResponsiveContainer>) : <div className="h-full flex items-center justify-center text-muted-foreground text-sm italic">Nenhuma despesa no periodo</div>}</div>
            </CardContent>
          </Card>
        </div>
      </TabsContent>

      <TabsContent value="averages" className="mt-0">
        <FinanceAverages />
      </TabsContent>
    </Tabs>
  );
};

export default FinanceDashboard;
