import { useMemo } from "react";
import { Gauge as GaugeIcon } from "lucide-react";
import {
  Bar, CartesianGrid, ComposedChart, Legend, Line, PolarAngleAxis,
  RadialBar, RadialBarChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { fmtCurrency, tooltipStyle } from "./useFinanceData";
import { useFinanceWorkspace } from "./useFinanceWorkspace";
import { useFinanceSettings } from "./useFinanceSettings";
import { computeCfo } from "./financeCfo";
import { rbt12Status } from "./financeRbt12";

const todayIso = () => new Date().toISOString().slice(0, 10);

// Semáforo por bloco (mesmos limiares do Painel CFO), com hex p/ o anel e texto p/ o rótulo.
type Sem = "green" | "amber" | "red";
const SEM_HEX: Record<Sem, string> = { green: "hsl(142 76% 36%)", amber: "hsl(38 92% 50%)", red: "hsl(0 84% 60%)" };
const SEM_TEXT: Record<Sem, string> = { green: "text-emerald-400", amber: "text-amber-400", red: "text-destructive" };
const SEM_WORD: Record<Sem, string> = { green: "saudável", amber: "atenção", red: "crítico" };

interface GaugeSpec { key: string; label: string; pct: number; center: string; sem: Sem; hint: string }

const Gauge = ({ g }: { g: GaugeSpec }) => {
  const data = [{ name: g.key, value: Math.max(0, Math.min(100, g.pct)), fill: SEM_HEX[g.sem] }];
  return (
    <div className="flex flex-col items-center rounded-xl border border-border/50 bg-background/40 p-2.5">
      <div className="relative h-[88px] w-[88px] shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <RadialBarChart innerRadius="70%" outerRadius="100%" data={data} startAngle={90} endAngle={-270}>
            <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
            <RadialBar dataKey="value" cornerRadius={8} background={{ fill: "hsl(var(--muted))" }} />
          </RadialBarChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className={cn("font-mono text-base font-bold leading-none", SEM_TEXT[g.sem])}>{g.center}</span>
        </div>
      </div>
      <p className="mt-1 text-[11px] font-medium text-center leading-tight">{g.label}</p>
      <span className={cn("text-[10px] font-medium", SEM_TEXT[g.sem])}>{SEM_WORD[g.sem]}</span>
      <p className="text-[9px] text-muted-foreground text-center leading-tight line-clamp-1">{g.hint}</p>
    </div>
  );
};

/** Cockpit financeiro: faixa de gauges (Runway/Reserva/Poupança/RBT12) + gráfico combinado (fluxo + capital). */
export const FinanceCockpitStrip = () => {
  const { canonical, reserveBalance, expectedMonthly, monthlyData, capitalEvolution } = useFinanceWorkspace();
  const { settings } = useFinanceSettings();

  const m = useMemo(
    () => computeCfo(canonical.rows, settings, reserveBalance, todayIso(), expectedMonthly),
    [canonical.rows, settings, reserveBalance, expectedMonthly],
  );
  const rbt = useMemo(
    () => rbt12Status(monthlyData ?? [], settings.rbt12_limit, settings.rbt12_alert_pct ?? 80, m.faturamentoMensal),
    [monthlyData, settings.rbt12_limit, settings.rbt12_alert_pct, m.faturamentoMensal],
  );

  const runwayTarget = settings.reserve_months || 6;
  const runwaySem: Sem = m.runwayMeses < 3 ? "red" : m.runwayMeses < 6 ? "amber" : "green";
  const reservaSem: Sem = m.reservaPct < 0.5 ? "red" : m.reservaPct < 1 ? "amber" : "green";
  const poupSem: Sem = m.taxaPoupanca <= 0 ? "red" : m.taxaPoupanca < 0.15 ? "amber" : "green";

  const gauges: GaugeSpec[] = [
    {
      key: "runway", label: "Runway", sem: m.burnMensal > 0 ? runwaySem : "green",
      pct: m.burnMensal > 0 ? (m.runwayMeses / runwayTarget) * 100 : 0,
      center: m.burnMensal > 0 ? `${m.runwayMeses.toFixed(1)}m` : "—",
      hint: `ideal ${runwayTarget}m · burn ${fmtCurrency(m.burnMensal)}`,
    },
    {
      key: "reserva", label: "Reserva vs alvo", sem: reservaSem, pct: m.reservaPct * 100,
      center: `${Math.round(m.reservaPct * 100)}%`,
      hint: `${fmtCurrency(m.reservaAtual)} / ${fmtCurrency(m.reservaAlvo)}`,
    },
    {
      key: "poupanca", label: "Taxa de poupança", sem: m.receitaLiquida > 0 ? poupSem : "green",
      pct: m.taxaPoupanca * 100, center: m.receitaLiquida > 0 ? `${Math.round(m.taxaPoupanca * 100)}%` : "—",
      hint: `sobra ${fmtCurrency(m.sobraMensal)}/mês`,
    },
  ];
  if (rbt) {
    gauges.push({
      key: "rbt", label: "Teto Simples (RBT12)", sem: rbt.pct >= 1 ? "red" : rbt.alert ? "amber" : "green",
      pct: rbt.pct * 100, center: `${Math.round(rbt.pct * 100)}%`, hint: `folga ${fmtCurrency(rbt.headroom)}`,
    });
  }

  // capitalEvolution mapeia monthlyData (mesma ordem/tamanho) → alinha por índice.
  const combined = useMemo(
    () => capitalEvolution.map((c, i) => ({
      month: c.month, income: monthlyData[i]?.income ?? 0, expense: monthlyData[i]?.expense ?? 0, capital: c.capital,
    })),
    [capitalEvolution, monthlyData],
  );

  return (
    <Card className="border border-primary/30 bg-gradient-to-br from-primary/5 to-transparent">
      <CardContent className="p-4 space-y-4">
        <p className="flex items-center gap-2 text-sm font-semibold"><GaugeIcon className="h-4 w-4 text-primary" />Cockpit financeiro</p>

        <div className={cn("grid grid-cols-2 gap-2", gauges.length >= 4 ? "lg:grid-cols-4" : "lg:grid-cols-3")}>
          {gauges.map((g) => <Gauge key={g.key} g={g} />)}
        </div>

        <div>
          <p className="mb-1 text-[11px] text-muted-foreground">Fluxo mensal × capital acumulado (12 meses)</p>
          <div className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={combined} margin={{ top: 6, right: 4, left: -8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <YAxis yAxisId="flow" stroke="hsl(var(--muted-foreground))" fontSize={11} tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}k`} />
                <YAxis yAxisId="cap" orientation="right" stroke="hsl(var(--primary))" fontSize={11} tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}k`} width={40} />
                <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => fmtCurrency(v)} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar yAxisId="flow" dataKey="income" name="Entradas" fill="hsl(142.1, 76.2%, 36.3%)" radius={[4, 4, 0, 0]} />
                <Bar yAxisId="flow" dataKey="expense" name="Saídas" fill="hsl(0, 84.2%, 60.2%)" radius={[4, 4, 0, 0]} />
                <Line yAxisId="cap" type="monotone" dataKey="capital" name="Capital acumulado" stroke="hsl(var(--primary))" strokeWidth={2.5} dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default FinanceCockpitStrip;
