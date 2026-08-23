// Histórico das importações da planilha, dentro da Auditoria: é onde fica o registro de que a
// conferência bateu (ou não) e de onde se desfaz a última importação.

import { AlertTriangle, Check, FileSpreadsheet, Loader2, RotateCcw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { fmtCurrency } from "../useFinanceData";
import { usePlanilhaImport, type LoteImport } from "./usePlanilhaImport";

const dataHora = (iso: string) => new Date(iso).toLocaleString("pt-BR");

interface MesConferido {
  mes: string;
  comparavel?: boolean;
  bate?: boolean;
  entradasApp?: number;
  entradasPlanilha?: number;
  saidasApp?: number;
  saidasPlanilha?: number;
}

const Conferencia = ({ lote }: { lote: LoteImport }) => {
  const conf = lote.conferencia as { bate?: boolean; porMes?: MesConferido[] } | null;
  const meses = (conf?.porMes || []).filter((m) => m.comparavel !== false);
  if (!meses.length) return <span className="text-xs text-muted-foreground">sem totais para conferir</span>;
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {conf?.bate
        ? <Badge variant="outline" className="gap-1 text-emerald-400"><Check className="h-3 w-3" />conferido</Badge>
        : <Badge variant="outline" className="gap-1 text-amber-500"><AlertTriangle className="h-3 w-3" />divergiu</Badge>}
      {meses.filter((m) => m.bate === false).map((m) => (
        <span key={m.mes} className="text-xs text-muted-foreground">
          {m.mes}: app {fmtCurrency(Number(m.saidasApp || 0))} × planilha {fmtCurrency(Number(m.saidasPlanilha || 0))}
        </span>
      ))}
    </div>
  );
};

export const PlanilhaImportHistory = () => {
  const { lotes, desfazer, desfazendo, ultimoLote } = usePlanilhaImport();
  if (!lotes.length) return null;

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm">
          <FileSpreadsheet className="h-4 w-4" />Importações da planilha
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {lotes.map((l) => (
          <div
            key={l.id}
            className={cn(
              "flex flex-wrap items-center justify-between gap-2 rounded-lg border p-2 text-sm",
              l.desfeito_em && "opacity-60",
            )}
          >
            <div className="min-w-0 space-y-1">
              <p className="font-medium">
                {l.arquivo || "planilha"} · {dataHora(l.created_at)}
                {l.desfeito_em && <span className="ml-1.5 text-xs text-muted-foreground">(desfeita)</span>}
              </p>
              <p className="text-xs text-muted-foreground">
                {l.criados} novos · {l.atualizados} atualizados · {l.removidos} removidos · {l.inalterados} sem mudança
                {l.janela_inicio && ` · período ${l.janela_inicio.slice(5)} a ${l.janela_fim?.slice(5)}`}
              </p>
              <Conferencia lote={l} />
              {(l.avisos || []).map((a) => (
                <p key={a} className="text-xs text-amber-600">{a}</p>
              ))}
            </div>
            {!l.desfeito_em && l.id === ultimoLote?.id && (
              <Button variant="outline" size="sm" disabled={desfazendo} onClick={() => desfazer(l.id)}>
                {desfazendo ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="mr-1 h-3.5 w-3.5" />}
                Desfazer
              </Button>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
};

export default PlanilhaImportHistory;
