import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { motion } from "framer-motion";
import { ArrowUpRight, ArrowDownRight, CalendarClock, CalendarDays, CheckCircle2, DollarSign, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";
import { ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell, AreaChart, Area, CartesianGrid, XAxis, YAxis, Tooltip, Legend } from "recharts";
import { fmtCurrency, formatDateBR, tooltipStyle, PIE_COLORS } from "./useFinanceData";
import { useFinanceWorkspace } from "./useFinanceWorkspace";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const FinanceDashboard = () => {
  const { totalIncome, totalExpense, balance, dashboardTransactions, monthlyData, capitalEvolution, incomeByCat, expenseByCat, currentMonthPlanSummary, upcomingPayables, reconcileTransactionMutation } = useFinanceWorkspace();

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Entradas", value: fmtCurrency(totalIncome), icon: ArrowUpRight, color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/20" },
          { label: "Saídas", value: fmtCurrency(totalExpense), icon: ArrowDownRight, color: "text-destructive", bg: "bg-destructive/10", border: "border-destructive/20" },
          { label: "Saldo", value: fmtCurrency(balance), icon: DollarSign, color: balance >= 0 ? "text-emerald-400" : "text-destructive", bg: balance >= 0 ? "bg-emerald-500/10" : "bg-destructive/10", border: balance >= 0 ? "border-emerald-500/20" : "border-destructive/20" },
          { label: "Transações", value: dashboardTransactions.length, icon: Wallet, color: "text-primary", bg: "bg-primary/10", border: "border-primary/20" },
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
            Planejamento do mes vs realizado
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
          <CardHeader className="pb-2"><CardTitle className="text-base">Receita vs Despesa Mensal</CardTitle></CardHeader>
          <CardContent><div className="h-[280px]"><ResponsiveContainer width="100%" height="100%"><BarChart data={monthlyData}><CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" /><XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={11} /><YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} /><Tooltip contentStyle={tooltipStyle} formatter={(v: number) => fmtCurrency(v)} /><Legend /><Bar dataKey="income" fill="hsl(142.1, 76.2%, 36.3%)" name="Entradas" radius={[4, 4, 0, 0]} /><Bar dataKey="expense" fill="hsl(0, 84.2%, 60.2%)" name="Saídas" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer></div></CardContent>
        </Card>
        <Card className="border border-border/50 bg-card/80">
          <CardHeader className="pb-2"><CardTitle className="text-base">Evolução do Capital</CardTitle></CardHeader>
          <CardContent><div className="h-[280px]"><ResponsiveContainer width="100%" height="100%"><AreaChart data={capitalEvolution}><CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" /><XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={11} /><YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} /><Tooltip contentStyle={tooltipStyle} formatter={(v: number) => fmtCurrency(v)} /><Area type="monotone" dataKey="capital" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.15} strokeWidth={2} /></AreaChart></ResponsiveContainer></div></CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="border border-border/50 bg-card/80">
          <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><ArrowUpRight className="h-4 w-4 text-emerald-400" />Receita por Categoria</CardTitle></CardHeader>
          <CardContent>
            <div className="h-[250px]">{incomeByCat.length > 0 ? (<ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={incomeByCat} cx="50%" cy="50%" innerRadius={45} outerRadius={80} paddingAngle={3} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>{incomeByCat.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}</Pie><Tooltip contentStyle={tooltipStyle} formatter={(v: number) => fmtCurrency(v)} /></PieChart></ResponsiveContainer>) : <div className="h-full flex items-center justify-center text-muted-foreground text-sm italic">Nenhuma receita</div>}</div>
            {incomeByCat.length > 0 && <div className="space-y-2 mt-2">{incomeByCat.map((c, i) => (<div key={c.name} className="flex items-center justify-between text-sm"><div className="flex items-center gap-2"><div className="w-3 h-3 rounded-sm" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} /><span className="text-muted-foreground">{c.name}</span></div><span className="font-medium font-mono text-emerald-400">{fmtCurrency(c.value)}</span></div>))}</div>}
          </CardContent>
        </Card>
        <Card className="border border-border/50 bg-card/80">
          <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><ArrowDownRight className="h-4 w-4 text-destructive" />Despesas por Categoria</CardTitle></CardHeader>
          <CardContent>
            <div className="h-[250px]">{expenseByCat.length > 0 ? (<ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={expenseByCat} cx="50%" cy="50%" innerRadius={45} outerRadius={80} paddingAngle={3} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>{expenseByCat.map((_, i) => <Cell key={i} fill={PIE_COLORS[(i + 2) % PIE_COLORS.length]} />)}</Pie><Tooltip contentStyle={tooltipStyle} formatter={(v: number) => fmtCurrency(v)} /></PieChart></ResponsiveContainer>) : <div className="h-full flex items-center justify-center text-muted-foreground text-sm italic">Nenhuma despesa</div>}</div>
            {expenseByCat.length > 0 && <div className="space-y-2 mt-2">{expenseByCat.map((c, i) => (<div key={c.name} className="flex items-center justify-between text-sm"><div className="flex items-center gap-2"><div className="w-3 h-3 rounded-sm" style={{ backgroundColor: PIE_COLORS[(i + 2) % PIE_COLORS.length] }} /><span className="text-muted-foreground">{c.name}</span></div><span className="font-medium font-mono text-destructive">{fmtCurrency(c.value)}</span></div>))}</div>}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default FinanceDashboard;
