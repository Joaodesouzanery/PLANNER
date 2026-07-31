import { useMemo } from "react";
import { Flag, Target, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useEstrategia } from "./useEstrategia";
import { useFinMetrics } from "./useFinMetrics";
import { visaoProgress, objetivoProgress, type Semaforo, type Progress } from "./estrategiaProgress";

// O sonho toda vez que abre o Painel CFO: o BHAG principal + o foco do ano, com a barra calculada.
// Some (render null) quando não há visão cadastrada, pra não poluir o painel.
const SEM_BAR: Record<Semaforo, string> = { verde: "bg-emerald-500", amarelo: "bg-amber-500", vermelho: "bg-destructive" };
const SEM_TXT: Record<Semaforo, string> = { verde: "text-emerald-400", amarelo: "text-amber-400", vermelho: "text-destructive" };
const pctLabel = (p: number) => `${Math.round(p * 100)}%`;

const MiniProgress = ({ prog, titulo, icon: Icon, kicker }: { prog: Progress; titulo: string; icon: typeof Flag; kicker: string }) => (
  <div className="flex-1 min-w-0">
    <div className="flex items-center gap-1.5 mb-1">
      <Icon className="h-3.5 w-3.5 text-primary shrink-0" />
      <span className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">{kicker}</span>
      <span className={cn("ml-auto text-xs font-mono font-bold", SEM_TXT[prog.semaforo])}>{pctLabel(prog.pct)}</span>
    </div>
    <p className="text-sm font-semibold truncate mb-1.5" title={titulo}>{titulo}</p>
    <div className="h-1.5 w-full rounded-full bg-muted/40 overflow-hidden">
      <div className={cn("h-full rounded-full transition-all", SEM_BAR[prog.semaforo])} style={{ width: `${Math.min(100, Math.round(prog.pct * 100))}%` }} />
    </div>
  </div>
);

export const EstrategiaCfoStrip = () => {
  const est = useEstrategia();
  const fin = useFinMetrics();

  const visao = est.tree[0];
  const foco = useMemo(() => {
    const objetivos = est.tree.flatMap((v) => v.objetivos);
    if (objetivos.length === 0) return null;
    const year = new Date().getFullYear();
    const doAno = objetivos.filter((o) => o.ano === year);
    const pool = doAno.length ? doAno : objetivos;
    // Foco = o objetivo mais atrasado (chama atenção pro que precisa de você).
    return [...pool].sort((a, b) => objetivoProgress(a, fin).pct - objetivoProgress(b, fin).pct)[0];
  }, [est.tree, fin]);

  if (est.isLoading || !visao) return null;

  const visaoProg = visaoProgress(visao, fin);
  const focoProg = foco ? objetivoProgress(foco, fin) : null;

  return (
    <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
      <CardContent className="p-4">
        <div className="flex items-center gap-1.5 mb-3">
          <Sparkles className="h-3.5 w-3.5 text-primary" />
          <span className="text-xs font-semibold">Sua estratégia</span>
          <Badge variant="outline" className="text-[9px] ml-1">{visao.horizonte}</Badge>
        </div>
        <div className="flex flex-col sm:flex-row gap-5">
          <MiniProgress prog={visaoProg} titulo={visao.titulo} icon={Flag} kicker="BHAG · o sonho" />
          {foco && focoProg && (
            <>
              <div className="hidden sm:block w-px bg-border/50" />
              <MiniProgress prog={focoProg} titulo={foco.titulo} icon={Target} kicker={`Foco ${foco.ano || "do ano"}`} />
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default EstrategiaCfoStrip;
