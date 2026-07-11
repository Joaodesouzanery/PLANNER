import { useMemo } from "react";
import { format, subMonths } from "date-fns";
import { Repeat, TrendingUp, TrendingDown, Plus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { fmtCurrency } from "./useFinanceData";
import { useFinanceWorkspace } from "./useFinanceWorkspace";
import { activeIncomeContracts, mrrHeadline, recurringTotal, mrrDeltas } from "./financeMrr";

const isRevenueOkr = (o: { unit?: string; title?: string }) =>
  /r\$|mrr|receita|reais|faturamento/i.test(`${o.unit || ""} ${o.title || ""}`);

export const FinanceMrrPanel = () => {
  const workspace = useFinanceWorkspace();
  const okrs = (workspace as any).okrs ?? [];

  const { mrr, total, deltas } = useMemo(() => {
    const txns = workspace.rawTransactions as any[];
    const curKey = format(new Date(), "yyyy-MM");
    const prevKey = format(subMonths(new Date(), 1), "yyyy-MM");
    const cur = activeIncomeContracts(txns, curKey);
    const prev = activeIncomeContracts(txns, prevKey);
    return { mrr: mrrHeadline(cur), total: recurringTotal(cur), deltas: mrrDeltas(prev, cur) };
  }, [workspace.rawTransactions]);

  const revenueOkrs = useMemo(() => okrs.filter(isRevenueOkr), [okrs]);
  const pontual = total - mrr;

  return (
    <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-base flex items-center gap-2"><Repeat className="h-4 w-4 text-primary" />MRR — receita recorrente</CardTitle>
          <div className="text-right">
            <p className="font-mono text-xl font-bold text-primary leading-none">{fmtCurrency(mrr)}<span className="text-xs text-muted-foreground font-normal">/mês</span></p>
            {pontual > 0 && <p className="text-[10px] text-muted-foreground">+ {fmtCurrency(pontual)} a prazo (pontual)</p>}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-2"><p className="text-[10px] text-muted-foreground flex items-center gap-1"><Plus className="h-3 w-3" />Novos</p><p className="font-mono font-semibold text-emerald-400">{fmtCurrency(deltas.novos)}</p></div>
          <div className="rounded-lg border border-sky-500/20 bg-sky-500/5 p-2"><p className="text-[10px] text-muted-foreground flex items-center gap-1"><TrendingUp className="h-3 w-3" />Expansão</p><p className="font-mono font-semibold text-sky-400">{fmtCurrency(deltas.expansao)}</p></div>
          <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-2"><p className="text-[10px] text-muted-foreground flex items-center gap-1"><TrendingDown className="h-3 w-3" />Churn</p><p className="font-mono font-semibold text-destructive">−{fmtCurrency(deltas.churn)}</p></div>
        </div>

        {revenueOkrs.length === 0 ? (
          <p className="text-[11px] text-muted-foreground">Crie uma meta de MRR como <strong>OKR</strong> (unidade R$) na sub-aba OKRs — a barra de progresso liga automático a este número.</p>
        ) : (
          <div className="space-y-2">
            {revenueOkrs.map((o: any) => {
              const pct = o.target_value > 0 ? Math.min(100, (mrr / o.target_value) * 100) : 0;
              return (
                <div key={o.id}>
                  <div className="flex items-center justify-between text-xs"><span className="truncate">{o.title}</span><span className="font-mono">{fmtCurrency(mrr)} / {fmtCurrency(o.target_value)} · {Math.round(pct)}%</span></div>
                  <Progress value={pct} className={cn("h-1.5 mt-1")} />
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default FinanceMrrPanel;
