import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CalendarRange, RotateCcw, TrendingDown, TrendingUp, CalendarDays } from "lucide-react";
import { cn } from "@/lib/utils";
import { differenceInCalendarDays, differenceInCalendarMonths, format, startOfMonth, endOfMonth, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ResponsiveContainer, BarChart, Bar, CartesianGrid, XAxis, YAxis, Tooltip, Legend } from "recharts";
import { DateRangeFilter } from "@/components/ems/DateRangeFilter";
import { fmtCurrency, tooltipStyle } from "./useFinanceData";
import { useFinanceWorkspace } from "./useFinanceWorkspace";

const fmtFrom = () => format(startOfMonth(subMonths(new Date(), 5)), "yyyy-MM-dd");
const fmtTo = () => format(endOfMonth(new Date()), "yyyy-MM-dd");
const monthLabel = (key: string) => {
  const [y, m] = key.split("-");
  return format(new Date(Number(y), Number(m) - 1, 1), "MMM/yy", { locale: ptBR });
};

const FinanceAverages = () => {
  const { dashboardTransactions, monthlyPlans, planItems } = useFinanceWorkspace();
  const [from, setFrom] = useState(fmtFrom());
  const [to, setTo] = useState(fmtTo());

  const setPreset = (preset: string) => {
    const today = new Date();
    if (preset === "3m") { setFrom(format(startOfMonth(subMonths(today, 2)), "yyyy-MM-dd")); setTo(format(endOfMonth(today), "yyyy-MM-dd")); }
    else if (preset === "6m") { setFrom(format(startOfMonth(subMonths(today, 5)), "yyyy-MM-dd")); setTo(format(endOfMonth(today), "yyyy-MM-dd")); }
    else if (preset === "12m") { setFrom(format(startOfMonth(subMonths(today, 11)), "yyyy-MM-dd")); setTo(format(endOfMonth(today), "yyyy-MM-dd")); }
    else if (preset === "ytd") { setFrom(`${today.getFullYear()}-01-01`); setTo(format(endOfMonth(today), "yyyy-MM-dd")); }
  };

  const filtered = useMemo(() => dashboardTransactions.filter((t) => {
    const d = String(t.date).slice(0, 10);
    return d >= from && d <= to;
  }), [dashboardTransactions, from, to]);

  const totals = useMemo(() => {
    const income = filtered.filter(t => t.type === "income").reduce((a, t) => a + Number(t.amount), 0);
    const expense = filtered.filter(t => t.type === "expense").reduce((a, t) => a + Number(t.amount), 0);
    const fromDate = new Date(`${from}T00:00:00`);
    const toDate = new Date(`${to}T00:00:00`);
    const days = Math.max(1, differenceInCalendarDays(toDate, fromDate) + 1);
    const weeks = Math.max(1, days / 7);
    const months = Math.max(1, differenceInCalendarMonths(toDate, fromDate) + 1);
    return {
      income, expense, days, weeks, months,
      expPerWeek: expense / weeks, expPerMonth: expense / months,
      incPerWeek: income / weeks, incPerMonth: income / months,
    };
  }, [filtered, from, to]);

  const byMonth = useMemo(() => {
    const map = new Map<string, { month: string; income: number; expense: number }>();
    filtered.forEach((t) => {
      const key = String(t.date).slice(0, 7);
      const cur = map.get(key) || { month: key, income: 0, expense: 0 };
      if (t.type === "income") cur.income += Number(t.amount); else cur.expense += Number(t.amount);
      map.set(key, cur);
    });
    return Array.from(map.values()).sort((a, b) => a.month.localeCompare(b.month)).map(m => ({ ...m, label: monthLabel(m.month), balance: m.income - m.expense }));
  }, [filtered]);

  // ---- Mes especifico ----
  const availableMonths = useMemo(() => {
    const set = new Set(dashboardTransactions.map(t => String(t.date).slice(0, 7)));
    return Array.from(set).sort((a, b) => b.localeCompare(a));
  }, [dashboardTransactions]);
  const [selectedMonth, setSelectedMonth] = useState<string>("");
  const month = selectedMonth || availableMonths[0] || format(new Date(), "yyyy-MM");

  const monthDetail = useMemo(() => {
    const [y, m] = month.split("-").map(Number);
    const tx = dashboardTransactions.filter(t => String(t.date).slice(0, 7) === month);
    const income = tx.filter(t => t.type === "income").reduce((a, t) => a + Number(t.amount), 0);
    const expense = tx.filter(t => t.type === "expense").reduce((a, t) => a + Number(t.amount), 0);
    const planIds = monthlyPlans.filter((p) => p.month === m && p.year === y).map((p) => p.id);
    const items = planItems.filter((item) => planIds.includes(item.plan_id) && item.status !== "skipped");
    const plannedIncome = items.filter((i) => i.type === "income").reduce((s, i) => s + Number(i.amount), 0);
    const plannedExpense = items.filter((i) => i.type === "expense").reduce((s, i) => s + Number(i.amount), 0);
    const catMap: Record<string, number> = {};
    tx.filter(t => t.type === "expense").forEach(t => { const c = t.category || "Sem categoria"; catMap[c] = (catMap[c] || 0) + Number(t.amount); });
    const byCat = Object.entries(catMap).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
    return {
      count: tx.length, income, expense, balance: income - expense,
      plannedIncome, plannedExpense, plannedBalance: plannedIncome - plannedExpense,
      variance: (income - expense) - (plannedIncome - plannedExpense),
      byCat,
    };
  }, [month, dashboardTransactions, monthlyPlans, planItems]);

  const avgCards = [
    { label: "Saídas / semana", value: totals.expPerWeek, icon: TrendingDown, color: "text-destructive" },
    { label: "Saídas / mês", value: totals.expPerMonth, icon: TrendingDown, color: "text-destructive" },
    { label: "Entradas / semana", value: totals.incPerWeek, icon: TrendingUp, color: "text-emerald-400" },
    { label: "Entradas / mês", value: totals.incPerMonth, icon: TrendingUp, color: "text-emerald-400" },
  ];

  return (
    <div className="space-y-6">
      <Card className="border border-border/50 bg-card/80">
        <CardContent className="p-3 flex flex-wrap items-center gap-3">
          <CalendarRange className="h-4 w-4 text-primary" />
          <span className="text-xs font-medium text-muted-foreground">Período:</span>
          <DateRangeFilter dateFrom={from} dateTo={to} onDateFromChange={setFrom} onDateToChange={setTo} />
          <Select onValueChange={setPreset}>
            <SelectTrigger className="w-[170px] h-9 text-xs"><SelectValue placeholder="Atalhos" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="3m">Últimos 3 meses</SelectItem>
              <SelectItem value="6m">Últimos 6 meses</SelectItem>
              <SelectItem value="12m">Últimos 12 meses</SelectItem>
              <SelectItem value="ytd">Ano atual</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="ghost" size="sm" className="h-9 text-xs" onClick={() => { setFrom(fmtFrom()); setTo(fmtTo()); }}>
            <RotateCcw className="h-3.5 w-3.5 mr-1" /> 6 meses
          </Button>
          <Badge variant="outline" className="ml-auto text-xs">
            {totals.months} {totals.months === 1 ? "mês" : "meses"} · ~{totals.weeks.toFixed(1)} semanas
          </Badge>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {avgCards.map((c) => (
          <Card key={c.label} className="border border-border/50 bg-card/80">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-muted/40"><c.icon className={cn("h-5 w-5", c.color)} /></div>
              <div>
                <p className={cn("text-lg font-bold font-mono", c.color)}>{fmtCurrency(c.value)}</p>
                <p className="text-[10px] sm:text-xs text-muted-foreground">Média {c.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="border border-border/50 bg-card/80">
        <CardHeader className="pb-2"><CardTitle className="text-base">Gastos por mês no período</CardTitle></CardHeader>
        <CardContent>
          <div className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={byMonth}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="label" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => fmtCurrency(v)} />
                <Legend />
                <Bar dataKey="expense" name="Saídas" fill="hsl(0, 84.2%, 60.2%)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="income" name="Entradas" fill="hsl(142.1, 76.2%, 36.3%)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card className="border border-primary/20 bg-card/80">
        <CardHeader className="pb-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="text-base flex items-center gap-2"><CalendarDays className="h-4 w-4 text-primary" />Mês específico</CardTitle>
            <Select value={month} onValueChange={setSelectedMonth}>
              <SelectTrigger className="w-[170px] h-9 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {availableMonths.length === 0 && <SelectItem value={month}>{monthLabel(month)}</SelectItem>}
                {availableMonths.map((mk) => <SelectItem key={mk} value={mk}>{monthLabel(mk)}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { label: "Entradas", value: monthDetail.income, color: "text-emerald-400" },
              { label: "Saídas", value: monthDetail.expense, color: "text-destructive" },
              { label: "Saldo", value: monthDetail.balance, color: monthDetail.balance >= 0 ? "text-emerald-400" : "text-destructive" },
              { label: "Lançamentos", value: monthDetail.count, color: "text-primary", raw: true },
            ].map((s) => (
              <div key={s.label} className="rounded-lg border border-border/50 bg-background/40 p-3">
                <p className="text-xs text-muted-foreground">{s.label}</p>
                <p className={cn("text-lg font-bold font-mono mt-1", s.color)}>{s.raw ? s.value : fmtCurrency(Number(s.value))}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { label: "Saídas previstas", value: monthDetail.plannedExpense, color: "text-destructive" },
              { label: "Entradas previstas", value: monthDetail.plannedIncome, color: "text-emerald-400" },
              { label: "Saldo planejado", value: monthDetail.plannedBalance, color: monthDetail.plannedBalance >= 0 ? "text-emerald-400" : "text-destructive" },
              { label: "Diferença (real − plano)", value: monthDetail.variance, color: monthDetail.variance >= 0 ? "text-emerald-400" : "text-destructive" },
            ].map((s) => (
              <div key={s.label} className="rounded-lg border border-dashed border-border/50 bg-background/20 p-3">
                <p className="text-xs text-muted-foreground">{s.label}</p>
                <p className={cn("text-base font-semibold font-mono mt-1", s.color)}>{fmtCurrency(s.value)}</p>
              </div>
            ))}
          </div>

          {monthDetail.byCat.length > 0 && (
            <div>
              <p className="text-xs text-muted-foreground mb-2">Saídas por categoria</p>
              <div className="space-y-1.5">
                {monthDetail.byCat.map((c) => {
                  const pct = monthDetail.expense > 0 ? (c.value / monthDetail.expense) * 100 : 0;
                  return (
                    <div key={c.name} className="flex items-center gap-2">
                      <span className="w-32 truncate text-xs">{c.name}</span>
                      <div className="flex-1 h-2 rounded-full bg-muted/40 overflow-hidden"><div className="h-full bg-destructive/70" style={{ width: `${pct}%` }} /></div>
                      <span className="w-24 text-right font-mono text-xs">{fmtCurrency(c.value)}</span>
                      <span className="w-10 text-right text-[10px] text-muted-foreground">{pct.toFixed(0)}%</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default FinanceAverages;
