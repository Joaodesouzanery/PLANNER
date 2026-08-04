import { useMemo } from "react";
import { AlertTriangle, Gauge, Link2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress as ProgressBar } from "@/components/ui/progress";
import { useEstrategia } from "./useEstrategia";
import { useEstrategiaSignals } from "./useEstrategiaSignals";
import { visaoProgress, objetivoProgress, semaforoOf } from "./estrategiaProgress";

// Cockpit da Estratégia: um só lugar onde a estratégia "conversa" com todos os módulos.
// Os números vêm das fontes canônicas (Finanças, Projetos, Tarefas, CRM/Oportunidades, Tempo)
// e alimentam automaticamente o progresso da cascata.
const dotClass = (s: string) =>
  s === "verde" ? "bg-emerald-500" : s === "amarelo" ? "bg-amber-500" : "bg-red-500";

export const EstrategiaCockpit = () => {
  const { tree, isLoading } = useEstrategia();
  const signals = useEstrategiaSignals();

  const visoes = useMemo(() => tree.map((v) => ({ v, p: visaoProgress(v, signals.fin) })), [tree, signals.fin]);
  const objetivos = useMemo(
    () => tree.flatMap((v) => v.objetivos.map((o) => ({ o, p: objetivoProgress(o, signals.fin) }))),
    [tree, signals.fin],
  );
  const geral = objetivos.length ? objetivos.reduce((a, x) => a + x.p.pct, 0) / objetivos.length : 0;
  const alerts = signals.modules.flatMap((m) => m.items.filter((i) => i.alert).map((i) => `${m.label}: ${i.label} — ${i.value}`));

  return (
    <div className="space-y-4">
      <Card className="border-primary/20">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Gauge className="h-4 w-4 text-primary" />
            Progresso geral da estratégia
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-3">
            <ProgressBar value={Math.min(100, geral * 100)} className="h-2" />
            <span className="text-sm font-bold w-14 text-right">{Math.round(geral * 100)}%</span>
            <span className={`h-2.5 w-2.5 rounded-full ${dotClass(semaforoOf(geral))}`} />
          </div>
          <p className="text-xs text-muted-foreground">
            {isLoading || signals.isLoading ? "Carregando dados dos módulos…" : `${objetivos.length} objetivo(s) monitorado(s) com dado real dos outros módulos.`}
          </p>
        </CardContent>
      </Card>

      {alerts.length > 0 && (
        <Card className="border-amber-500/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2 text-amber-500">
              <AlertTriangle className="h-4 w-4" /> Sinais de atenção
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-xs text-muted-foreground">
            {alerts.map((a) => <p key={a}>{a}</p>)}
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
        {signals.modules.map((m) => (
          <Card key={m.key}>
            <CardHeader className="pb-2"><CardTitle className="text-sm">{m.label}</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {m.items.map((i) => (
                <div key={i.label} className="flex items-center justify-between gap-2 text-xs">
                  <span className="text-muted-foreground">{i.label}</span>
                  <span className={i.alert ? "font-semibold text-amber-500" : "font-semibold"}>{i.value}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>

      {visoes.length > 0 && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Visões (BHAG)</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {visoes.map(({ v, p }) => (
              <div key={v.id} className="space-y-1">
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="font-medium">{v.titulo}</span>
                  <span className="flex items-center gap-2">
                    <span className={`h-2 w-2 rounded-full ${dotClass(p.semaforo)}`} />
                    {Math.round(p.pct * 100)}%
                  </span>
                </div>
                <ProgressBar value={Math.min(100, p.pct * 100)} className="h-1.5" />
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Link2 className="h-4 w-4 text-primary" /> Métricas disponíveis para objetivos e KRs
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-xs text-muted-foreground">
            Use um destes nomes no campo “métrica” de um Objetivo/KR — o valor atual é lido automaticamente do módulo de origem.
          </p>
          <div className="flex flex-wrap gap-1.5">
            {["mrr", "reserva", "patrimonio", "sobra", ...Object.keys(signals.metrics)].map((k) => (
              <Badge key={k} variant="outline" className="text-[10px] font-mono">{k}</Badge>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default EstrategiaCockpit;
