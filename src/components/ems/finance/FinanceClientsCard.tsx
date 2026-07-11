import { useMemo } from "react";
import { format } from "date-fns";
import { Users, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { fmtCurrency } from "./useFinanceData";
import { useFinanceWorkspace } from "./useFinanceWorkspace";
import { useFinanceSettings } from "./useFinanceSettings";
import { useClientes } from "./useClientes";
import { intervalFactor } from "./projectionCalc";
import { computeCfo } from "./financeCfo";
import { clientConcentration, impactoSeSair, type ClientRevenue } from "./financeClients";

const todayIso = () => format(new Date(), "yyyy-MM-dd");
const CONCENTRACAO_LIMITE = 0.3; // top-1 acima disso = risco

export const FinanceClientsCard = () => {
  const workspace = useFinanceWorkspace();
  const { settings } = useFinanceSettings();
  const { clientes } = useClientes();

  const cfo = useMemo(
    () => computeCfo(workspace.canonical.rows, settings, workspace.reserveBalance, todayIso(), workspace.expectedMonthly),
    [workspace.canonical.rows, settings, workspace.reserveBalance, workspace.expectedMonthly],
  );

  const { clients, semCliente } = useMemo(() => {
    const nameById = new Map(clientes.map((c) => [c.id, c]));
    const rev = new Map<string, ClientRevenue>();
    for (const t of workspace.rawTransactions as any[]) {
      if (t.type !== "income" || !t.is_recurring) continue; // run-rate = recorrentes de entrada
      const mEq = Number(t.amount) * intervalFactor(t.recurrence_interval);
      const ongoing = t.recurrence_end_date ? 0 : mEq; // com prazo = pontual, não conta pro MRR
      const key = t.cliente_id || "__sem__";
      const meta = t.cliente_id ? nameById.get(t.cliente_id) : null;
      const e = rev.get(key) || { id: t.cliente_id || null, nome: meta?.nome || "Sem cliente", recorrente: meta?.recorrente ?? !t.recurrence_end_date, monthly: 0, ongoing: 0 };
      e.monthly += mEq; e.ongoing += ongoing;
      rev.set(key, e);
    }
    const semCliente = rev.get("__sem__")?.monthly ?? 0;
    const clients = [...rev.values()].filter((e) => e.id !== null);
    return { clients, semCliente };
  }, [workspace.rawTransactions, clientes]);

  const conc = useMemo(() => clientConcentration(clients), [clients]);
  const mrr = useMemo(() => clients.reduce((a, c) => a + c.ongoing, 0), [clients]);
  const maior = conc.ranked[0];
  const impacto = maior ? impactoSeSair(maior.ongoing, mrr, cfo.sobraMensal, cfo.saldoLiquidoImposto) : null;

  if (clients.length === 0 && semCliente === 0) {
    return (
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><Users className="h-4 w-4 text-primary" />Receita por cliente</CardTitle></CardHeader>
        <CardContent><p className="text-sm text-muted-foreground">Marque o <strong>cliente</strong> nas suas entradas (em Transações) para ver o peso de cada um e o risco de concentração.</p></CardContent>
      </Card>
    );
  }

  const alto = conc.top1Share > CONCENTRACAO_LIMITE;

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-base flex items-center gap-2"><Users className="h-4 w-4 text-primary" />Receita por cliente</CardTitle>
          <span className="font-mono text-sm text-muted-foreground">{fmtCurrency(conc.total)}/mês</span>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-2">
          {conc.ranked.map((c) => (
            <div key={c.id}>
              <div className="flex items-center justify-between text-sm gap-2">
                <span className="flex items-center gap-1.5 min-w-0 truncate">
                  {c.nome}
                  {!c.recorrente && <Badge variant="outline" className="text-[9px] border-amber-500/40 text-amber-500 shrink-0">pontual</Badge>}
                </span>
                <span className="font-mono shrink-0">{fmtCurrency(c.monthly)} · {(c.share * 100).toFixed(0)}%</span>
              </div>
              <div className="h-1.5 rounded bg-muted/40 mt-1 overflow-hidden"><div className="h-full rounded bg-primary" style={{ width: `${Math.min(100, c.share * 100)}%` }} /></div>
            </div>
          ))}
        </div>

        {semCliente > 0 && <p className="text-[11px] text-amber-500">Ainda há {fmtCurrency(semCliente)}/mês de receita recorrente <strong>sem cliente</strong> — marque em Transações.</p>}

        {maior && impacto && (
          <div className={cn("rounded-lg border p-2.5 text-xs flex items-start gap-2", alto ? "border-amber-500/30 bg-amber-500/5" : "border-border/50")}>
            {alto && <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />}
            <span>
              Maior cliente: <strong>{maior.nome} ({(conc.top1Share * 100).toFixed(0)}%)</strong>. Se sair, o MRR cai de {fmtCurrency(mrr)} para <strong>{fmtCurrency(impacto.mrrPos)}</strong>
              {impacto.novaSobra < 0
                ? <> e a sobra vira {fmtCurrency(impacto.novaSobra)}/mês — fôlego de ~{impacto.runwaySeSair.toFixed(1)} meses.</>
                : <> e a sobra ainda fica positiva ({fmtCurrency(impacto.novaSobra)}/mês).</>}
              {" "}Top-2 concentram {(conc.top2Share * 100).toFixed(0)}%.
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default FinanceClientsCard;
