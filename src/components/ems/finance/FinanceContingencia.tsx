import { useMemo, useState } from "react";
import { format } from "date-fns";
import { ShieldAlert, TrendingDown } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { fmtCurrency } from "./useFinanceData";
import { useFinanceWorkspace } from "./useFinanceWorkspace";
import { useFinanceSettings } from "./useFinanceSettings";
import { useClientes } from "./useClientes";
import { buildClientRevenue } from "./financeClients";
import { stressScenario, type Veredito } from "./financeStress";

const todayIso = () => format(new Date(), "yyyy-MM-dd");
const fmtRunway = (v: number) => (v === Infinity ? "∞" : `${v.toFixed(1)} m`);

const veredictoInfo: Record<Veredito, { label: string; cls: string }> = {
  aguenta: { label: "Aguenta o tranco", cls: "border-success/40 bg-success/10 text-success" },
  aperta: { label: "Aperta — passa a queimar reserva", cls: "border-warning/40 bg-warning/10 text-warning" },
  quebra: { label: "Quebra — caixa não segura", cls: "border-destructive/40 bg-destructive/10 text-destructive" },
};

export const FinanceContingencia = () => {
  const workspace = useFinanceWorkspace();
  const { settings } = useFinanceSettings();
  const { clientes } = useClientes();

  const [rendaPct, setRendaPct] = useState("0");
  const [clienteId, setClienteId] = useState("none");
  const [gastoExtra, setGastoExtra] = useState("");

  const clients = useMemo(() => buildClientRevenue(workspace.rawTransactions as any[], clientes).clients, [workspace.rawTransactions, clientes]);
  const perderRenda = clienteId !== "none" ? clients.find((c) => c.id === clienteId)?.ongoing ?? 0 : 0;

  const s = useMemo(
    () => stressScenario(workspace.canonical.rows, workspace.expectedMonthly, settings, workspace.reserveBalance, todayIso(), {
      rendaPct: (Number(rendaPct) || 0) / 100,
      perderRenda,
      gastoExtra: Number(gastoExtra) || 0,
    }),
    [workspace.canonical.rows, workspace.expectedMonthly, workspace.reserveBalance, settings, rendaPct, perderRenda, gastoExtra],
  );

  const v = veredictoInfo[s.veredito];

  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><ShieldAlert className="h-4 w-4 text-primary" />Contingência — e se der errado?</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {[0, 10, 30, 50].map((p) => (
            <Button key={p} variant={rendaPct === String(p) ? "secondary" : "outline"} size="sm" className="h-7 text-xs" onClick={() => setRendaPct(String(p))}>renda −{p}%</Button>
          ))}
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <div><Label className="text-xs">Queda de renda (%)</Label><Input type="number" value={rendaPct} onChange={(e) => setRendaPct(e.target.value)} /></div>
          <div>
            <Label className="text-xs">Perder um cliente</Label>
            <Select value={clienteId} onValueChange={setClienteId}>
              <SelectTrigger><SelectValue placeholder="Nenhum" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Nenhum</SelectItem>
                {clients.map((c) => <SelectItem key={c.id} value={c.id!}>{c.nome} (−{fmtCurrency(c.ongoing)}/mês)</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div><Label className="text-xs">Gasto extra pontual (R$)</Label><Input type="number" value={gastoExtra} onChange={(e) => setGastoExtra(e.target.value)} placeholder="0" /></div>
        </div>

        <div className={cn("rounded-xl border p-3 space-y-2", v.cls)}>
          <p className="flex items-center gap-2 text-sm font-semibold"><TrendingDown className="h-4 w-4" />{v.label}</p>
          {s.perdaRendaMensal > 0 && <p className="text-[11px] text-muted-foreground">Perda de renda no cenário: {fmtCurrency(s.perdaRendaMensal)}/mês</p>}
          <div className="grid grid-cols-3 gap-3 font-mono text-xs">
            <div><p className="text-[10px] text-muted-foreground">Sobra/mês</p><p className="font-bold">{fmtCurrency(s.sobraBase)}</p><p className={cn("text-[10px]", s.sobraChoque < 0 ? "text-destructive" : "text-muted-foreground")}>→ {fmtCurrency(s.sobraChoque)}</p></div>
            <div><p className="text-[10px] text-muted-foreground">Fôlego</p><p className="font-bold">{fmtRunway(s.runwayBase)}</p><p className="text-[10px] text-muted-foreground">→ {fmtRunway(s.runwayChoque)}</p></div>
            <div><p className="text-[10px] text-muted-foreground">Piso 90d</p><p className="font-bold">{fmtCurrency(s.pisoBase)}</p><p className={cn("text-[10px]", s.pisoChoque < 0 ? "text-destructive" : "text-muted-foreground")}>→ {fmtCurrency(s.pisoChoque)}</p></div>
          </div>
        </div>
        <p className="text-[11px] text-muted-foreground">Base × cenário. Some os choques (renda, perder cliente, gasto extra) para simular a crise combinada. Escreva os planos de resposta por risco no <strong>Conselho › Riscos</strong>.</p>
      </CardContent>
    </Card>
  );
};

export default FinanceContingencia;
