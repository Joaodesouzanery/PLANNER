import { useMemo } from "react";
import { Target, TrendingUp, ArrowRight, Check, X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { useCrm } from "./useCrm";
import { forecastPonderado, type NbaSev } from "./buildNextBestActions";
import { CLOSED_STAGES } from "./crm360";

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const sevStyle: Record<NbaSev, string> = { red: "border-red-500/30 bg-red-500/5", yellow: "border-amber-500/30 bg-amber-500/5", low: "border-border/50 bg-muted/20" };
const sevDot: Record<NbaSev, string> = { red: "bg-red-500", yellow: "bg-amber-500", low: "bg-muted-foreground" };

export const OpportunityInbox = ({ crm, onSelectCustomer }: { crm: ReturnType<typeof useCrm>; onSelectCustomer: (id: string) => void }) => {
  const forecast = useMemo(() => forecastPonderado(crm.deals as any[]), [crm.deals]);
  const items = crm.nbaItems;
  const reds = items.filter((i) => i.severidade === "red").length;

  const winLose = (dealId: string, outcome: "won" | "lost") =>
    crm.updateDeal.mutate({ id: dealId, patch: { status_outcome: outcome, stage: outcome === "won" ? "ganho" : "perdido" } });

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,2fr)_minmax(240px,1fr)] gap-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Target className="h-4 w-4 text-primary" />Próxima melhor ação
            {items.length > 0 && <span className="rounded-full bg-primary/15 text-primary px-2 text-xs font-mono">{items.length}</span>}
            {reds > 0 && <span className="rounded-full bg-red-500/15 text-red-500 px-2 text-[10px]">{reds} crítico{reds > 1 ? "s" : ""}</span>}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-1.5">
          {items.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nada pendente na fila. ✓</p>
          ) : (
            items.map((i) => (
              <div key={i.id} className={cn("flex items-center gap-2 rounded-lg border p-2 text-sm", sevStyle[i.severidade])}>
                <span className={cn("h-2 w-2 shrink-0 rounded-full", sevDot[i.severidade])} />
                <div className="min-w-0 flex-1">
                  <p className="truncate"><span className="text-[10px] uppercase tracking-wide text-muted-foreground mr-1.5">{i.customerName}</span>{i.titulo}</p>
                </div>
                {i.valor != null && <span className="font-mono text-xs text-muted-foreground shrink-0">{brl(i.valor)}</span>}
                {i.tipo.startsWith("deal") && i.refId && (
                  <>
                    <Button size="icon" variant="ghost" className="h-6 w-6 text-emerald-500" title="Ganhou" onClick={() => winLose(i.refId!, "won")}><Check className="h-3.5 w-3.5" /></Button>
                    <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive" title="Perdeu" onClick={() => winLose(i.refId!, "lost")}><X className="h-3.5 w-3.5" /></Button>
                  </>
                )}
                {i.customerId && <Button size="icon" variant="ghost" className="h-6 w-6" title="Ver cliente" onClick={() => onSelectCustomer(i.customerId!)}><ArrowRight className="h-3.5 w-3.5" /></Button>}
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card className="h-fit">
        <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><TrendingUp className="h-4 w-4 text-primary" />Funil</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          <div className="rounded-lg border border-primary/20 bg-primary/5 p-2.5"><p className="text-[11px] text-muted-foreground">Forecast ponderado</p><p className="font-mono text-lg font-bold text-primary">{brl(forecast)}</p><p className="text-[10px] text-muted-foreground">Σ valor × probabilidade dos deals abertos</p></div>
          <div className="rounded-lg border border-border/50 p-2.5"><p className="text-[11px] text-muted-foreground">Deals abertos</p><p className="font-mono text-lg font-bold">{(crm.deals as any[]).filter((d) => !CLOSED_STAGES.has((d.stage || "").toLowerCase())).length}</p></div>
        </CardContent>
      </Card>
    </div>
  );
};

export default OpportunityInbox;
