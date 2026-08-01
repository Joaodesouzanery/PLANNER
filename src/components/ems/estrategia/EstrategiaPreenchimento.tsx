import { Download, Trash2, CheckCircle2, Database, Users, TrendingUp, Wallet, Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useConfirm } from "@/hooks/useConfirm";
import { useSeedMyData } from "./useSeedMyData";

// Aba "Preenchimento": carrega os dados reais do doc (client-side, idempotente) nas tabelas de finanças/
// estratégia — a fonte única que o Finanças e a cascata leem. Rodar 2× não duplica.
const ITENS = [
  { icon: Users, label: "Clientes & receita", desc: "IRIS, Circle, RAONI, Compizzo (recorrentes) + CONAB (temporário)" },
  { icon: TrendingUp, label: "Custos PJ & DAS", desc: "contador, ferramentas, infra, Macbook (até mai/27), DAS" },
  { icon: Wallet, label: "Patrimônio & tetos", desc: "caixa, reserva, dívidas, tetos PF do mês" },
  { icon: Target, label: "Estratégia", desc: "BHAG + objetivos + OKR do trimestre + sprint" },
];

export const EstrategiaPreenchimento = () => {
  const seed = useSeedMyData();
  const confirm = useConfirm();
  const carregado = seed.loadedCount > 0;

  const limpar = async () => {
    if (await confirm({ title: "Limpar dados carregados?", description: "Remove os dados do preenchimento (transações do seed, clientes, patrimônio, tetos e a visão da estratégia). Não afeta o que você criou à mão.", confirmText: "Limpar", destructive: true })) {
      seed.clear.mutate();
    }
  };

  return (
    <div className="space-y-4">
      <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Database className="h-4 w-4 text-primary" />Carregar meus dados
            {carregado && <Badge variant="outline" className="text-[10px] gap-0.5 text-emerald-400 border-emerald-500/40"><CheckCircle2 className="h-2.5 w-2.5" />carregado</Badge>}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Preenche o sistema com seus dados reais (Nery Tecnologia, consolidado) — tudo vira linha editável nas
            tabelas de finanças, que o Finanças e a cascata leem. É <span className="text-foreground font-medium">idempotente</span>:
            pode rodar de novo sem duplicar.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {ITENS.map((it) => (
              <div key={it.label} className="flex items-start gap-2 rounded-lg border border-border/50 bg-background/40 p-2.5">
                <it.icon className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs font-medium">{it.label}</p>
                  <p className="text-[10px] text-muted-foreground">{it.desc}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <Button onClick={() => seed.run.mutate()} disabled={seed.run.isPending} className="gap-1.5">
              <Download className="h-4 w-4" />{seed.run.isPending ? "Carregando…" : carregado ? "Recarregar (idempotente)" : "Carregar meus dados"}
            </Button>
            {carregado && (
              <Button variant="ghost" onClick={limpar} disabled={seed.clear.isPending} className="gap-1.5 text-muted-foreground hover:text-destructive">
                <Trash2 className="h-4 w-4" />Limpar dados carregados
              </Button>
            )}
          </div>
          <p className="text-[10px] text-muted-foreground">
            Depois de carregar: o pró-labore, os clientes e os custos aparecem no Finanças; o MRR real sobe na cascata;
            o Fluxo Futuro mostra CONAB até ~mar/27 e o Macbook até ~mai/27. Ajuste qualquer número na aba Config ou no Finanças.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default EstrategiaPreenchimento;
