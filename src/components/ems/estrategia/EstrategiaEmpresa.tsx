import { useMemo } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Building2, TableProperties, TrendingUp, Wallet, Activity } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useCompany } from "@/contexts/CompanyContext";
import { fmtCurrency } from "@/components/ems/finance/useFinanceData";
import { useFinanceWorkspace } from "@/components/ems/finance/useFinanceWorkspace";
import { buildForecastSeries, summarizeForecastByMonthScenarios } from "@/components/ems/finance/financeForecast";
import { FinanceDre } from "@/components/ems/finance/FinanceDre";
import { FinanceBudgetCard } from "@/components/ems/finance/FinanceBudgetCard";
import FinanceFutureFlow from "@/components/ems/finance/FinanceFutureFlow";

const mesLabel = (m: string) => format(new Date(m + "-01T00:00:00"), "MMM/yy", { locale: ptBR });

// Peça de negócio da Estratégia: a leitura de empresa (DRE, orçado×realizado, fluxo) + o orçamento anual
// 12 meses × 3 cenários (conservador/esperado/otimista), tudo derivado do mesmo dado real.
export const EstrategiaEmpresa = () => {
  const workspace = useFinanceWorkspace();
  const { selectedCompanyId, companies } = useCompany();

  const scopeLabel = selectedCompanyId === "all" ? "Consolidado (todas as empresas)" : (companies.find((c) => c.id === selectedCompanyId)?.name || "Empresa");

  // Orçamento anual 12m × 3 cenários — mesma origem do Fluxo Futuro (série de 365d carrega os 3 cenários).
  const anual = useMemo(() => {
    const series = buildForecastSeries({
      events: workspace.filteredEvents,
      openingBalance: workspace.canonical.saldoRealHoje,
      days: 365,
      variableMonthlyExpense: workspace.expectedMonthly.variavel,
    });
    return summarizeForecastByMonthScenarios(series).slice(0, 12);
  }, [workspace.filteredEvents, workspace.canonical.saldoRealHoje, workspace.expectedMonthly.variavel]);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <div className="p-1.5 rounded-lg bg-primary/10"><Building2 className="h-4 w-4 text-primary" /></div>
        <div>
          <h3 className="text-sm font-semibold">Empresa · leitura de negócio</h3>
          <p className="text-[11px] text-muted-foreground">DRE, orçamento e fluxo da <span className="text-foreground font-medium">{scopeLabel}</span> — todos derivados do mesmo razão.</p>
        </div>
      </div>

      {/* Orçamento anual 12m × 3 cenários (peça nova) */}
      <Card className="border-border/50 bg-card/60">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-1.5"><TableProperties className="h-4 w-4 text-primary" />Orçamento anual · 12 meses × 3 cenários</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3 mb-2 text-[10px] text-muted-foreground">
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-destructive/70" />Conservador</span>
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-primary" />Esperado</span>
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-500" />Otimista</span>
            <span className="ml-auto">Saldos = fechamento projetado do mês</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-muted-foreground border-b border-border/50">
                  <th className="text-left font-medium py-1.5 pr-2">Mês</th>
                  <th className="text-right font-medium py-1.5 px-2">Entradas</th>
                  <th className="text-right font-medium py-1.5 px-2">Saídas</th>
                  <th className="text-right font-medium py-1.5 px-2 text-destructive/80">Conservador</th>
                  <th className="text-right font-medium py-1.5 px-2 text-primary">Esperado</th>
                  <th className="text-right font-medium py-1.5 pl-2 text-emerald-400">Otimista</th>
                </tr>
              </thead>
              <tbody>
                {anual.length === 0 ? (
                  <tr><td colSpan={6} className="py-6 text-center text-muted-foreground">Sem dados para projetar.</td></tr>
                ) : anual.map((m) => (
                  <tr key={m.month} className="border-b border-border/30 last:border-0">
                    <td className="py-1.5 pr-2 capitalize font-medium">{mesLabel(m.month)}</td>
                    <td className="py-1.5 px-2 text-right font-mono text-emerald-400/90">{fmtCurrency(m.income)}</td>
                    <td className="py-1.5 px-2 text-right font-mono text-muted-foreground">{fmtCurrency(m.expense)}</td>
                    <td className={cn("py-1.5 px-2 text-right font-mono", m.conservative < 0 ? "text-destructive font-bold" : "text-destructive/70")}>{fmtCurrency(m.conservative)}</td>
                    <td className={cn("py-1.5 px-2 text-right font-mono", m.expected < 0 ? "text-destructive font-bold" : "")}>{fmtCurrency(m.expected)}</td>
                    <td className="py-1.5 pl-2 text-right font-mono text-emerald-400">{fmtCurrency(m.optimistic)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-[10px] text-muted-foreground mt-2">O cenário conservador aplica o gasto variável estimado; o otimista o ignora. Se o conservador fica no vermelho, é onde o caixa aperta.</p>
        </CardContent>
      </Card>

      {/* DRE (mês/tri/ano já embutido) */}
      <div className="space-y-2">
        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5"><TrendingUp className="h-3.5 w-3.5" />DRE</h4>
        <FinanceDre />
      </div>

      {/* Orçado × Realizado */}
      <div className="space-y-2">
        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5"><Wallet className="h-3.5 w-3.5" />Orçado × Realizado</h4>
        <FinanceBudgetCard />
      </div>

      {/* Fluxo de caixa futuro */}
      <div className="space-y-2">
        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5"><Activity className="h-3.5 w-3.5" />Fluxo de caixa (12 meses)</h4>
        <FinanceFutureFlow />
      </div>
    </div>
  );
};

export default EstrategiaEmpresa;
