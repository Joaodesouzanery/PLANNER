import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { fmtCurrency } from "./useFinanceData";
import type { ProjectionBreakdown, ProjectionRow } from "./projectionCalc";

export const intervalLabel = (interval: string) => {
  const i = interval.toLowerCase();
  if (i.startsWith("week") || i === "semanal") return "Semanal (× 4,345)";
  if (i.startsWith("year") || i === "anual" || i === "annual") return "Anual (÷ 12)";
  return "Mensal (× 1)";
};

const sourceText = (source: ProjectionBreakdown["incomeSourceUsed"]) =>
  source === "recurring" ? "Baseline recorrente" : source === "historical" ? "Média histórica" : "Sem dado";

interface SourceListProps {
  title: string;
  sources: { id: string; description: string; category: string | null; rawAmount: number; interval: string; monthlyEquivalent: number }[];
  emptyLabel: string;
  tone: "emerald" | "destructive";
  compact?: boolean;
}

export const SourceList = ({ title, sources, emptyLabel, tone, compact }: SourceListProps) => (
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

/** Resumo "como entradas/saídas mensais foram escolhidas" (histórico × recorrente). */
export const ProjectionBreakdownPanel = ({ breakdown: b }: { breakdown: ProjectionBreakdown }) => {
  const incomeSources = b.recurringSources.filter((s) => s.type === "income");
  const expenseSources = b.recurringSources.filter((s) => s.type === "expense");
  return (
    <div className="space-y-4 text-sm">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-md border border-border/50 p-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-medium text-emerald-400">Entradas / mês</span>
            <Badge variant={b.incomeSourceUsed === "recurring" ? "default" : "secondary"} className="text-[10px]">{sourceText(b.incomeSourceUsed)}</Badge>
          </div>
          <div className="flex justify-between text-xs text-muted-foreground"><span>Média histórica ({b.historicalMonthsConsideredIncome}/{b.historyWindow} mes(es))</span><span className="font-mono">{fmtCurrency(b.historicalAverageIncome)}</span></div>
          <div className="flex justify-between text-xs text-muted-foreground"><span>Baseline recorrente</span><span className="font-mono">{fmtCurrency(b.recurringBaselineIncome)}</span></div>
          <div className="flex justify-between border-t border-border/50 pt-1 text-sm"><span className="font-medium">Valor usado</span><span className="font-mono text-emerald-400">{fmtCurrency(b.chosenIncome)}</span></div>
        </div>
        <div className="rounded-md border border-border/50 p-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-medium text-destructive">Saídas / mês</span>
            <Badge variant={b.expenseSourceUsed === "recurring" ? "default" : "secondary"} className="text-[10px]">{sourceText(b.expenseSourceUsed)}</Badge>
          </div>
          <div className="flex justify-between text-xs text-muted-foreground"><span>Média histórica ({b.historicalMonthsConsideredExpense}/{b.historyWindow} mes(es))</span><span className="font-mono">{fmtCurrency(b.historicalAverageExpense)}</span></div>
          <div className="flex justify-between text-xs text-muted-foreground"><span>Baseline recorrente</span><span className="font-mono">{fmtCurrency(b.recurringBaselineExpense)}</span></div>
          <div className="flex justify-between border-t border-border/50 pt-1 text-sm"><span className="font-medium">Valor usado</span><span className="font-mono text-destructive">{fmtCurrency(b.chosenExpense)}</span></div>
        </div>
      </div>
      {(incomeSources.length > 0 || expenseSources.length > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <SourceList title="Renda recorrente ativa" sources={incomeSources} emptyLabel="Nenhuma renda recorrente cadastrada" tone="emerald" />
          <SourceList title="Despesas fixas recorrentes" sources={expenseSources} emptyLabel="Nenhuma despesa recorrente cadastrada" tone="destructive" />
        </div>
      )}
    </div>
  );
};

/** Tabela mês a mês: como cada mês foi calculado (histórico/projetado, fonte, regras). */
export const ProjectionAuditTable = ({ rows, breakdown: b }: { rows: ProjectionRow[]; breakdown: ProjectionBreakdown }) => (
  <div className="space-y-3">
    <div className="rounded-md border border-border/50 p-3 text-xs text-muted-foreground">
      <p className="font-medium text-foreground mb-1">Regras aplicadas</p>
      Janela histórica: <strong>últimos {b.historyWindow} meses</strong>. Para cada mês futuro usa-se o <strong>maior</strong> valor entre a média histórica e o baseline mensal das recorrências ativas. Recorrências <strong>semanais × 4,345</strong>; <strong>anuais ÷ 12</strong>; mensais × 1.
    </div>
    {b.alerts.length > 0 && (
      <div className="space-y-1.5">
        {b.alerts.map((alert, idx) => (
          <Alert key={idx} variant={alert.level === "warning" ? "destructive" : "default"} className="py-2">
            <AlertTriangle className="h-3.5 w-3.5" />
            <AlertDescription className="text-[11px]">{alert.message}</AlertDescription>
          </Alert>
        ))}
      </div>
    )}
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b text-muted-foreground">
            <th className="text-left py-1.5">Mês</th>
            <th className="text-left">Tipo</th>
            <th className="text-right">Entradas</th>
            <th className="text-right">Saídas</th>
            <th className="text-right">Saldo</th>
            <th className="text-right">Fonte (E / S)</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.month} className="border-b border-border/50">
              <td className="py-1.5 font-mono">{r.month}</td>
              <td>{r.projected ? <Badge variant="outline" className="text-[9px] border-primary/40 text-primary">Projetado</Badge> : <Badge variant="secondary" className="text-[9px]">Realizado</Badge>}</td>
              <td className="text-right font-mono text-emerald-400">{fmtCurrency(r.income)}</td>
              <td className="text-right font-mono text-destructive">{fmtCurrency(r.expense)}</td>
              <td className={cn("text-right font-mono", r.balance >= 0 ? "text-emerald-400" : "text-destructive")}>{fmtCurrency(r.balance)}</td>
              <td className="text-right text-[10px] text-muted-foreground">{r.projected ? `${sourceText(b.incomeSourceUsed)} / ${sourceText(b.expenseSourceUsed)}` : "Realizado"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
);
