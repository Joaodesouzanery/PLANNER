import { useMemo, useState } from "react";
import { format } from "date-fns";
import { AlertTriangle, Coins, Gauge, PiggyBank, Receipt, Settings2, ShieldCheck, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { fmtCurrency } from "./useFinanceData";
import { useFinanceWorkspace } from "./useFinanceWorkspace";
import { useFinanceSettings } from "./useFinanceSettings";
import { computeCfo, mesesParaReserva } from "./financeCfo";

const todayIso = () => format(new Date(), "yyyy-MM-dd");
const pctFmt = (v: number) => `${Math.round(v * 100)}%`;

const CfoStat = ({ icon: Icon, label, value, hint, tone }: { icon: typeof Coins; label: string; value: string; hint?: string; tone?: string }) => (
  <div className="rounded-xl border border-border/50 bg-background/40 p-3">
    <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground"><Icon className="h-3.5 w-3.5" />{label}</p>
    <p className={cn("mt-1 font-mono text-lg font-bold leading-tight", tone)}>{value}</p>
    {hint && <p className="text-[10px] text-muted-foreground mt-0.5 truncate">{hint}</p>}
  </div>
);

export const FinanceCfoPanel = () => {
  const { canonical, reserveBalance, expectedMonthly } = useFinanceWorkspace();
  const { settings, missing, save } = useFinanceSettings();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<{ tax_rate: string; reserve_months: string; cdi_monthly_liquid: string }>({ tax_rate: "", reserve_months: "", cdi_monthly_liquid: "" });

  const m = useMemo(
    () => computeCfo(canonical.rows, settings, reserveBalance, todayIso(), expectedMonthly),
    [canonical.rows, settings, reserveBalance, expectedMonthly],
  );
  const mesesReserva = mesesParaReserva(m);

  const openSettings = () => {
    setForm({ tax_rate: String(settings.tax_rate), reserve_months: String(settings.reserve_months), cdi_monthly_liquid: String(settings.cdi_monthly_liquid) });
    setOpen(true);
  };
  const saveSettings = () => save.mutate({
    tax_rate: Number(form.tax_rate) || 0,
    reserve_months: Number(form.reserve_months) || 6,
    cdi_monthly_liquid: Number(form.cdi_monthly_liquid) || 0,
  }, { onSuccess: () => setOpen(false) });

  const runwayTone = m.runwayMeses < 3 ? "text-destructive" : m.runwayMeses < 6 ? "text-amber-400" : "text-emerald-400";
  const alertReserva = m.reservaAtual < m.reservaAlvo * 0.5;

  return (
    <Card className="border border-primary/30 bg-gradient-to-br from-primary/5 to-transparent">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <p className="flex items-center gap-2 text-sm font-semibold"><ShieldCheck className="h-4 w-4 text-primary" />Painel CFO</p>
          <div className="flex items-center gap-2">
            {missing && <Badge variant="outline" className="text-[10px] text-amber-400 border-amber-400/40">defaults · aplique a migration p/ salvar</Badge>}
            <Button variant="ghost" size="sm" className="h-7 gap-1.5 px-2 text-xs" onClick={openSettings}><Settings2 className="h-3.5 w-3.5" /> Ajustes</Button>
          </div>
        </div>

        {(m.runwayMeses > 0 && m.runwayMeses < 3) || alertReserva ? (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-2.5 text-xs flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
            <span>
              {m.runwayMeses > 0 && m.runwayMeses < 3 && <>Runway curto (~{m.runwayMeses.toFixed(1)} mês): se a receita parasse, o caixa segura pouco tempo. </>}
              {alertReserva && <>Reserva abaixo do alvo — prioridade nº 1 é separar {fmtCurrency(m.reservaAlvo)} ({settings.reserve_months} meses de custo).</>}
            </span>
          </div>
        ) : null}

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
          <CfoStat icon={Coins} label="Saldo (líq. imposto)" value={fmtCurrency(m.saldoLiquidoImposto)} hint={`bruto ${fmtCurrency(m.saldoDisponivel)}`} tone={m.saldoLiquidoImposto >= 0 ? "" : "text-destructive"} />
          <CfoStat icon={Gauge} label="Runway" value={m.burnMensal > 0 ? `${m.runwayMeses.toFixed(1)} m` : "—"} hint={`burn ${fmtCurrency(m.burnMensal)}/mês`} tone={runwayTone} />
          <CfoStat icon={TrendingUp} label="Taxa de poupança" value={m.receitaLiquida > 0 ? pctFmt(m.taxaPoupanca) : "—"} hint={`sobra ${fmtCurrency(m.sobraMensal)}/mês`} />
          <CfoStat icon={Receipt} label="Imposto a recolher" value={fmtCurrency(m.impostoARecolher)} hint={`${settings.tax_rate}% · ${fmtCurrency(m.impostoMensal)}/mês`} tone={m.impostoARecolher > 0 ? "text-amber-400" : ""} />
          <CfoStat icon={AlertTriangle} label="A receber vencido" value={fmtCurrency(m.aReceberVencido)} hint={m.aReceberVencidoRows.length ? `${m.aReceberVencidoRows.length} em atraso` : "em dia"} tone={m.aReceberVencido > 0 ? "text-destructive" : "text-emerald-400"} />
          <div className="rounded-xl border border-border/50 bg-background/40 p-3">
            <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground"><PiggyBank className="h-3.5 w-3.5" />Reserva</p>
            <p className="mt-1 font-mono text-sm font-bold leading-tight">{fmtCurrency(m.reservaAtual)} <span className="text-muted-foreground font-normal">/ {fmtCurrency(m.reservaAlvo)}</span></p>
            <Progress value={m.reservaPct * 100} className="h-1.5 mt-1" />
            <p className="text-[10px] text-muted-foreground mt-0.5">{mesesReserva === 0 ? "alvo atingido" : mesesReserva ? `~${mesesReserva} meses` : "sem sobra p/ poupar"}</p>
          </div>
        </div>
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Ajustes CFO</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label className="text-xs">Alíquota de imposto (%)</Label><Input type="number" step="0.1" value={form.tax_rate} onChange={(e) => setForm({ ...form, tax_rate: e.target.value })} placeholder="6" /></div>
            <div><Label className="text-xs">Reserva de emergência (meses de custo)</Label><Input type="number" min={1} value={form.reserve_months} onChange={(e) => setForm({ ...form, reserve_months: e.target.value })} placeholder="6" /></div>
            <div><Label className="text-xs">CDI líquido ao mês (%)</Label><Input type="number" step="0.1" value={form.cdi_monthly_liquid} onChange={(e) => setForm({ ...form, cdi_monthly_liquid: e.target.value })} placeholder="0.9" /></div>
            {missing && <p className="text-[11px] text-amber-400">A tabela finance_settings ainda não existe. Aplique a migration <code>20260712120000_finance_settings.sql</code> na Lovable para salvar (por enquanto usa defaults).</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={saveSettings} disabled={save.isPending || missing}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
};

export default FinanceCfoPanel;
