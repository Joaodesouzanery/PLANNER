import { useMemo, useState } from "react";
import { CalendarClock, Check, Sparkles, Inbox } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { useCrm } from "./useCrm";
import { useCrmAtividades } from "./useCrmAtividades";
import { useCrmCadencias } from "./useCrmCadencias";
import { CadenciaManager } from "./CadenciaManager";
import { isFilaDoDia, CANAL_LABEL, type Canal } from "./cadencias";

const todayIso = () => new Date().toISOString();
const canal = (t: string) => CANAL_LABEL[t as Canal] || t;

/** Fila do dia (atividades pendentes com data <= hoje) + aplicar cadência num deal. */
export const AtividadesPanel = ({ crm }: { crm: ReturnType<typeof useCrm> }) => {
  const { atividades, aplicarCadencia, concluir } = useCrmAtividades();
  const { cadencias } = useCrmCadencias();
  const [dealId, setDealId] = useState("");
  const [cadenciaId, setCadenciaId] = useState("");

  const dealTitle = useMemo(() => new Map((crm.deals as any[]).map((d) => [d.id, d.title])), [crm.deals]);
  const openDeals = useMemo(() => (crm.deals as any[]).filter((d) => d.status_outcome !== "won" && d.status_outcome !== "lost"), [crm.deals]);

  const now = todayIso();
  const fila = useMemo(() => atividades.filter((a) => isFilaDoDia(a, now)), [atividades, now]);
  const proximas = useMemo(() => atividades.filter((a) => a.status === "pendente" && !isFilaDoDia(a, now)).slice(0, 15), [atividades, now]);

  const aplicar = () => { if (dealId && cadenciaId) aplicarCadencia.mutate({ dealId, cadenciaId }); };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">A fila do dia = atividades pendentes com data até hoje. Aplique uma cadência num deal e ela gera os toques (1 por passo).</p>
        <CadenciaManager />
      </div>

      {/* Aplicar cadência */}
      <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
        <CardContent className="flex flex-wrap items-center gap-2 p-3">
          <Sparkles className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium">Aplicar cadência</span>
          <Select value={dealId} onValueChange={setDealId}>
            <SelectTrigger className="h-8 w-[200px] text-xs"><SelectValue placeholder="Deal" /></SelectTrigger>
            <SelectContent>{openDeals.map((d) => <SelectItem key={d.id} value={d.id}>{d.title}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={cadenciaId} onValueChange={setCadenciaId}>
            <SelectTrigger className="h-8 w-[180px] text-xs"><SelectValue placeholder="Cadência" /></SelectTrigger>
            <SelectContent>{cadencias.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}</SelectContent>
          </Select>
          <Button size="sm" className="h-8" disabled={!dealId || !cadenciaId || aplicarCadencia.isPending} onClick={aplicar}>Aplicar</Button>
        </CardContent>
      </Card>

      {/* Fila do dia */}
      <Card className="border border-border/50 bg-card/80">
        <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><CalendarClock className="h-4 w-4 text-primary" />Fila do dia ({fila.length})</CardTitle></CardHeader>
        <CardContent className="space-y-1.5">
          {fila.length === 0 && <p className="text-sm text-muted-foreground text-center py-6 flex flex-col items-center gap-1"><Inbox className="h-5 w-5" />Nada pendente para hoje. ✓</p>}
          {fila.map((a) => {
            const atrasada = a.data_prevista != null && a.data_prevista < now.slice(0, 10);
            return (
              <div key={a.id} className={cn("flex items-center gap-2 rounded-lg border p-2 text-sm", atrasada ? "border-red-500/30 bg-red-500/5" : "border-border/50")}>
                <Badge variant="outline" className="text-[10px]">{canal(a.tipo)}</Badge>
                <span className="min-w-0 flex-1 truncate">{a.deal_id ? dealTitle.get(a.deal_id) || "Deal" : "—"}{a.passo_n ? <span className="text-muted-foreground"> · passo {a.passo_n}</span> : null}</span>
                <span className={cn("text-[11px] shrink-0", atrasada ? "text-red-400" : "text-muted-foreground")}>{a.data_prevista}</span>
                <Button size="sm" variant="ghost" className="h-7 gap-1 text-xs text-emerald-500" onClick={() => concluir.mutate({ id: a.id })}><Check className="h-3.5 w-3.5" />Concluir</Button>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Próximas */}
      {proximas.length > 0 && (
        <Card className="border border-border/50 bg-card/80">
          <CardHeader className="pb-2"><CardTitle className="text-base">Próximas ({proximas.length})</CardTitle></CardHeader>
          <CardContent className="space-y-1">
            {proximas.map((a) => (
              <div key={a.id} className="flex items-center gap-2 rounded-lg border border-border/40 p-1.5 text-xs opacity-80">
                <Badge variant="outline" className="text-[9px]">{canal(a.tipo)}</Badge>
                <span className="min-w-0 flex-1 truncate">{a.deal_id ? dealTitle.get(a.deal_id) || "Deal" : "—"}</span>
                <span className="text-[10px] text-muted-foreground shrink-0">{a.data_prevista}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default AtividadesPanel;
