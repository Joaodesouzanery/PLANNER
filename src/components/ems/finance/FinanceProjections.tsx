import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { ResponsiveContainer, BarChart, Bar, AreaChart, Area, CartesianGrid, XAxis, YAxis, Tooltip, Legend } from "recharts";
import { useFinanceData, fmtCurrency, tooltipStyle } from "./useFinanceData";

const FinanceProjections = () => {
  const { projectionData, capitalEvolution } = useFinanceData();

  return (
    <div className="space-y-6">
      <Card className="border border-border/50 bg-card/80">
        <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><TrendingUp className="h-4 w-4 text-primary" />Projeção Mensal (3 meses)</CardTitle></CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground mb-4 italic">Baseado na média dos últimos 3 meses.</p>
          <div className="h-[300px]"><ResponsiveContainer width="100%" height="100%"><BarChart data={projectionData}><CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" /><XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={11} /><YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} /><Tooltip contentStyle={tooltipStyle} formatter={(v: number) => fmtCurrency(v)} /><Legend /><Bar dataKey="income" fill="hsl(142.1, 76.2%, 36.3%)" name="Entradas" radius={[4, 4, 0, 0]} fillOpacity={0.8} /><Bar dataKey="expense" fill="hsl(0, 84.2%, 60.2%)" name="Saídas" radius={[4, 4, 0, 0]} fillOpacity={0.8} /></BarChart></ResponsiveContainer></div>
        </CardContent>
      </Card>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {projectionData.filter(p => p.projected).map(p => (
          <Card key={p.month} className="border border-dashed border-primary/30 bg-card/80">
            <CardContent className="p-4">
              <p className="text-sm font-medium text-primary mb-2 font-mono">{p.month} (projeção)</p>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Entradas</span><span className="text-emerald-400 font-medium font-mono">{fmtCurrency(p.income)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Saídas</span><span className="text-destructive font-medium font-mono">{fmtCurrency(p.expense)}</span></div>
                <div className="flex justify-between border-t border-border/50 pt-1 mt-1"><span className="text-muted-foreground">Saldo</span><span className={cn("font-bold font-mono", p.balance >= 0 ? "text-emerald-400" : "text-destructive")}>{fmtCurrency(p.balance)}</span></div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      <Card className="border border-border/50 bg-card/80">
        <CardHeader className="pb-2"><CardTitle className="text-base">Projeção de Capital Acumulado</CardTitle></CardHeader>
        <CardContent>
          <div className="h-[250px]"><ResponsiveContainer width="100%" height="100%"><AreaChart data={(() => { let running = capitalEvolution.length > 0 ? capitalEvolution[capitalEvolution.length - 1].capital : 0; return projectionData.map(p => { if (!p.projected) return { month: p.month, capital: null, projected: null }; running += p.balance; return { month: p.month, capital: null, projected: running }; }).filter(p => p.projected !== null || p.capital !== null); })()}><CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" /><XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={11} /><YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} /><Tooltip contentStyle={tooltipStyle} formatter={(v: number) => fmtCurrency(v)} /><Area type="monotone" dataKey="projected" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.1} strokeWidth={2} strokeDasharray="5 5" name="Projetado" /></AreaChart></ResponsiveContainer></div>
        </CardContent>
      </Card>
    </div>
  );
};

export default FinanceProjections;
