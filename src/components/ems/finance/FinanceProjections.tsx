import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tooltip as UiTooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { TrendingUp, Info, HelpCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { ResponsiveContainer, BarChart, Bar, AreaChart, Area, CartesianGrid, XAxis, YAxis, Tooltip, Legend } from "recharts";
import { useFinanceData, fmtCurrency, tooltipStyle } from "./useFinanceData";

const intervalLabel = (interval: string) => {
  const i = interval.toLowerCase();
  if (i.startsWith("week") || i === "semanal") return "Semanal (× 4,345)";
  if (i.startsWith("year") || i === "anual" || i === "annual") return "Anual (÷ 12)";
  return "Mensal (× 1)";
};

const FinanceProjections = () => {
  const { projectionData, capitalEvolution, projectionBreakdown } = useFinanceData();
  const [openMonth, setOpenMonth] = useState<string | null>(null);

  const b = projectionBreakdown;
  const incomeSources = b.recurringSources.filter((s) => s.type === "income");
  const expenseSources = b.recurringSources.filter((s) => s.type === "expense");

  return (
    <TooltipProvider>
      <div className="space-y-6">
        <Card className="border border-border/50 bg-card/80">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />Projeção Mensal (3 meses)
              <UiTooltip>
                <TooltipTrigger asChild>
                  <button type="button" className="text-muted-foreground hover:text-foreground">
                    <HelpCircle className="h-3.5 w-3.5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right" className="max-w-xs text-xs">
                  Para cada mês futuro usamos o MAIOR valor entre a média histórica dos últimos 3 meses
                  e o baseline mensal das transações recorrentes ativas. Assim a renda configurada nunca
                  é subestimada quando começa há pouco tempo.
                </TooltipContent>
              </UiTooltip>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground mb-4 italic">Maior valor entre média histórica e baseline recorrente.</p>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={projectionData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
                  <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => fmtCurrency(v)} />
                  <Legend />
                  <Bar dataKey="income" fill="hsl(142.1, 76.2%, 36.3%)" name="Entradas" radius={[4, 4, 0, 0]} fillOpacity={0.8} />
                  <Bar dataKey="expense" fill="hsl(0, 84.2%, 60.2%)" name="Saídas" radius={[4, 4, 0, 0]} fillOpacity={0.8} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Explicação do cálculo */}
        <Card className="border border-border/50 bg-card/60">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Info className="h-4 w-4 text-primary" />Como a projeção foi calculada
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="rounded-md border border-border/50 p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-emerald-400">Entradas / mês</span>
                  <Badge variant={b.incomeSourceUsed === "recurring" ? "default" : "secondary"} className="text-[10px]">
                    {b.incomeSourceUsed === "recurring" ? "Recorrente" : b.incomeSourceUsed === "historical" ? "Histórico" : "Sem dado"}
                  </Badge>
                </div>
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Média histórica ({b.historicalMonthsConsideredIncome} mês{b.historicalMonthsConsideredIncome === 1 ? "" : "es"})</span>
                  <span className="font-mono">{fmtCurrency(b.historicalAverageIncome)}</span>
                </div>
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Baseline recorrente</span>
                  <span className="font-mono">{fmtCurrency(b.recurringBaselineIncome)}</span>
                </div>
                <div className="flex justify-between border-t border-border/50 pt-1 text-sm">
                  <span className="font-medium">Valor usado</span>
                  <span className="font-mono text-emerald-400">{fmtCurrency(b.chosenIncome)}</span>
                </div>
              </div>
              <div className="rounded-md border border-border/50 p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-destructive">Saídas / mês</span>
                  <Badge variant={b.expenseSourceUsed === "recurring" ? "default" : "secondary"} className="text-[10px]">
                    {b.expenseSourceUsed === "recurring" ? "Recorrente" : b.expenseSourceUsed === "historical" ? "Histórico" : "Sem dado"}
                  </Badge>
                </div>
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Média histórica ({b.historicalMonthsConsideredExpense} mês{b.historicalMonthsConsideredExpense === 1 ? "" : "es"})</span>
                  <span className="font-mono">{fmtCurrency(b.historicalAverageExpense)}</span>
                </div>
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Baseline recorrente</span>
                  <span className="font-mono">{fmtCurrency(b.recurringBaselineExpense)}</span>
                </div>
                <div className="flex justify-between border-t border-border/50 pt-1 text-sm">
                  <span className="font-medium">Valor usado</span>
                  <span className="font-mono text-destructive">{fmtCurrency(b.chosenExpense)}</span>
                </div>
              </div>
            </div>

            {(incomeSources.length > 0 || expenseSources.length > 0) && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <SourceList title="Renda recorrente ativa" sources={incomeSources} emptyLabel="Nenhuma renda recorrente cadastrada" tone="emerald" />
                <SourceList title="Despesas fixas recorrentes" sources={expenseSources} emptyLabel="Nenhuma despesa recorrente cadastrada" tone="destructive" />
              </div>
            )}
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {projectionData.filter(p => p.projected).map(p => (
            <Dialog key={p.month} open={openMonth === p.month} onOpenChange={(o) => setOpenMonth(o ? p.month : null)}>
              <Card className="border border-dashed border-primary/30 bg-card/80">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-medium text-primary font-mono">{p.month} (projeção)</p>
                    <DialogTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-7 px-2 text-xs gap-1">
                        <Info className="h-3 w-3" />Detalhes
                      </Button>
                    </DialogTrigger>
                  </div>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between"><span className="text-muted-foreground">Entradas</span><span className="text-emerald-400 font-medium font-mono">{fmtCurrency(p.income)}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Saídas</span><span className="text-destructive font-medium font-mono">{fmtCurrency(p.expense)}</span></div>
                    <div className="flex justify-between border-t border-border/50 pt-1 mt-1"><span className="text-muted-foreground">Saldo</span><span className={cn("font-bold font-mono", p.balance >= 0 ? "text-emerald-400" : "text-destructive")}>{fmtCurrency(p.balance)}</span></div>
                  </div>
                </CardContent>
              </Card>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle>Como {p.month} foi projetado</DialogTitle>
                </DialogHeader>
                <div className="space-y-3 text-sm">
                  <div className="rounded-md border border-border/50 p-3 space-y-1">
                    <p className="text-xs text-muted-foreground">Regra aplicada</p>
                    <p>O valor projetado é o <strong>maior</strong> entre a média histórica dos últimos 3 meses e o baseline mensal das transações recorrentes ativas. Recorrências semanais multiplicam por 4,345; anuais dividem por 12.</p>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-md border border-border/50 p-3">
                      <p className="text-xs text-muted-foreground mb-1">Entradas usadas</p>
                      <p className="font-mono text-emerald-400">{fmtCurrency(p.income)}</p>
                      <p className="text-[11px] text-muted-foreground mt-1">Fonte: {b.incomeSourceUsed === "recurring" ? "baseline recorrente" : b.incomeSourceUsed === "historical" ? "média histórica" : "sem dado"}</p>
                    </div>
                    <div className="rounded-md border border-border/50 p-3">
                      <p className="text-xs text-muted-foreground mb-1">Saídas usadas</p>
                      <p className="font-mono text-destructive">{fmtCurrency(p.expense)}</p>
                      <p className="text-[11px] text-muted-foreground mt-1">Fonte: {b.expenseSourceUsed === "recurring" ? "baseline recorrente" : b.expenseSourceUsed === "historical" ? "média histórica" : "sem dado"}</p>
                    </div>
                  </div>
                  <SourceList title="Renda recorrente considerada" sources={incomeSources} emptyLabel="Nenhuma" tone="emerald" compact />
                  <SourceList title="Despesa recorrente considerada" sources={expenseSources} emptyLabel="Nenhuma" tone="destructive" compact />
                </div>
              </DialogContent>
            </Dialog>
          ))}
        </div>

        <Card className="border border-border/50 bg-card/80">
          <CardHeader className="pb-2"><CardTitle className="text-base">Projeção de Capital Acumulado</CardTitle></CardHeader>
          <CardContent>
            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={(() => { let running = capitalEvolution.length > 0 ? capitalEvolution[capitalEvolution.length - 1].capital : 0; return projectionData.map(p => { if (!p.projected) return { month: p.month, capital: null, projected: null }; running += p.balance; return { month: p.month, capital: null, projected: running }; }).filter(p => p.projected !== null || p.capital !== null); })()}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
                  <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => fmtCurrency(v)} />
                  <Area type="monotone" dataKey="projected" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.1} strokeWidth={2} strokeDasharray="5 5" name="Projetado" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
    </TooltipProvider>
  );
};

interface SourceListProps {
  title: string;
  sources: { id: string; description: string; category: string | null; rawAmount: number; interval: string; monthlyEquivalent: number }[];
  emptyLabel: string;
  tone: "emerald" | "destructive";
  compact?: boolean;
}

const SourceList = ({ title, sources, emptyLabel, tone, compact }: SourceListProps) => (
  <div className={cn("rounded-md border border-border/50 p-3", compact ? "space-y-1" : "space-y-2")}>
    <p className="text-xs font-medium text-muted-foreground">{title}</p>
    {sources.length === 0 ? (
      <p className="text-xs text-muted-foreground italic">{emptyLabel}</p>
    ) : (
      <ul className="space-y-1">
        {sources.map((s) => (
          <li key={s.id} className="flex items-center justify-between gap-2 text-xs">
            <div className="min-w-0">
              <p className="truncate">{s.description}</p>
              <p className="text-[10px] text-muted-foreground">{intervalLabel(s.interval)}{s.category ? ` · ${s.category}` : ""}</p>
            </div>
            <div className="text-right">
              <p className={cn("font-mono", tone === "emerald" ? "text-emerald-400" : "text-destructive")}>{fmtCurrency(s.monthlyEquivalent)}</p>
              {s.rawAmount !== s.monthlyEquivalent && (
                <p className="text-[10px] text-muted-foreground font-mono">orig {fmtCurrency(s.rawAmount)}</p>
              )}
            </div>
          </li>
        ))}
      </ul>
    )}
  </div>
);

export default FinanceProjections;
