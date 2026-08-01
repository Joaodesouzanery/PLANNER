import { useMemo } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { UserRound } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { fmtCurrency } from "./useFinanceData";
import { useFinanceWorkspace } from "./useFinanceWorkspace";
import { useFinanceSettings } from "./useFinanceSettings";
import { categoryScope } from "./financeCategories";
import { useConfigTimeline } from "./useConfigTimeline";

// Painel PF: mede seus gastos PESSOAIS (categorias PF) contra o pró-labore — não contra o
// faturamento. Só aparece quando o pró-labore está configurado (Ajustes CFO). A sobra é o que
// vira aporte/investimento no ciclo do patrimônio.
export const FinanceProLaborePanel = () => {
  const { canonical } = useFinanceWorkspace();
  const { settings } = useFinanceSettings();
  const cfg = useConfigTimeline();
  const curKey = format(new Date(), "yyyy-MM");
  // Camada datada: pró-labore vigente neste mês (fallback = settings).
  const prolabore = cfg.valueAsOf("prolabore", curKey) ?? settings.prolabore_mensal ?? 0;

  const gastoPF = useMemo(
    () => canonical.rows
      .filter((r) => r.type === "expense" && r.paid && r.date.slice(0, 7) === curKey && categoryScope(r.category) === "PF")
      .reduce((a, r) => a + r.amount, 0),
    [canonical.rows, curKey],
  );

  if (prolabore <= 0) return null;

  const sobra = prolabore - gastoPF;
  const usoPct = Math.min(1, gastoPF / prolabore);

  return (
    <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2"><UserRound className="h-4 w-4 text-primary" />Pró-labore de {format(new Date(), "MMM/yy", { locale: ptBR })}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-border/50 p-3"><p className="text-xs text-muted-foreground">Pró-labore</p><p className="font-mono text-xl font-bold">{fmtCurrency(prolabore)}</p><p className="text-[10px] text-muted-foreground">sua retirada mensal</p></div>
          <div className="rounded-xl border border-border/50 p-3"><p className="text-xs text-muted-foreground">Gasto pessoal (PF)</p><p className="font-mono text-xl font-bold text-destructive">{fmtCurrency(gastoPF)}</p><p className="text-[10px] text-muted-foreground">categorias pessoais, pago no mês</p></div>
          <div className="rounded-xl border border-primary/30 bg-primary/5 p-3"><p className="text-xs text-muted-foreground">Sobra pessoal</p><p className={cn("font-mono text-xl font-bold", sobra >= 0 ? "text-emerald-400" : "text-destructive")}>{fmtCurrency(sobra)}</p><p className="text-[10px] text-muted-foreground">{sobra >= 0 ? "→ vira aporte/investimento" : "estourou o pró-labore"}</p></div>
        </div>
        <div className="h-1.5 rounded bg-muted/40 overflow-hidden">
          <div className={cn("h-full rounded", sobra < 0 ? "bg-destructive" : usoPct > 0.8 ? "bg-amber-500" : "bg-emerald-500")} style={{ width: `${Math.max(2, usoPct * 100)}%` }} />
        </div>
        <p className="text-[11px] text-muted-foreground">Seus gastos são medidos contra o pró-labore ({fmtCurrency(prolabore)}), não contra o faturamento. O que sobra vira aporte no patrimônio.</p>
      </CardContent>
    </Card>
  );
};

export default FinanceProLaborePanel;
