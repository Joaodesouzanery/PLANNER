import { useState } from "react";
import { Activity, ChevronDown, TrendingDown } from "lucide-react";
import { CartesianGrid, Legend, Line, LineChart, PolarAngleAxis, RadialBar, RadialBarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { tooltipStyle } from "@/components/ems/finance/useFinanceData";
import { useBoardHealth, type HealthStatus } from "@/hooks/useBoardHealth";
import { useBoardHealthTrend } from "./useBoardHealthTrend";
import { biggestDrop, overallDelta, type HealthSnapshot } from "./boardHealthTrend";

const TREND_LINES = [
  { key: "overall_score", label: "Geral", color: "hsl(var(--primary))", w: 2.5 },
  { key: "financial_score", label: "Financeiro", color: "hsl(142 76% 36%)", w: 1.5 },
  { key: "risk_score", label: "Risco", color: "hsl(0 84% 60%)", w: 1.5 },
  { key: "governance_score", label: "Governança", color: "hsl(262 83% 58%)", w: 1.5 },
  { key: "compliance_score", label: "Compliance", color: "hsl(38 92% 50%)", w: 1.5 },
];

const HealthTrend = ({ trend }: { trend: HealthSnapshot[] }) => {
  if (trend.length < 2) return <p className="mt-2 text-[11px] text-muted-foreground">Coletando histórico — a tendência aparece após alguns dias de snapshots diários.</p>;
  const prev = trend[trend.length - 2];
  const curr = trend[trend.length - 1];
  const drop = biggestDrop(prev, curr);
  const delta = overallDelta(prev, curr);
  return (
    <div className="mt-2 space-y-2">
      <div className="h-[170px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={trend} margin={{ top: 6, right: 8, left: -8, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 4" stroke="hsl(var(--border))" />
            <XAxis dataKey="snapshot_date" tickFormatter={(d: string) => d.slice(5)} stroke="hsl(var(--muted-foreground))" fontSize={10} />
            <YAxis domain={[0, 100]} stroke="hsl(var(--muted-foreground))" fontSize={10} width={28} />
            <Tooltip contentStyle={tooltipStyle} />
            <Legend wrapperStyle={{ fontSize: 10 }} />
            {TREND_LINES.map((l) => <Line key={l.key} type="monotone" dataKey={l.key} name={l.label} stroke={l.color} strokeWidth={l.w} dot={false} />)}
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className={cn("rounded-lg border p-2 text-xs flex items-start gap-2", delta < 0 ? "border-red-500/30 bg-red-500/5 text-red-300" : "border-emerald-500/20 bg-emerald-500/5 text-emerald-300")}>
        <TrendingDown className="h-3.5 w-3.5 shrink-0 mt-0.5" />
        <span>
          {delta < 0
            ? <>Score geral caiu <b>{Math.abs(delta)}</b> pts desde o snapshot anterior.{drop ? <> Quem mais puxou pra baixo: <b>{drop.label}</b> ({drop.from}→{drop.to}).</> : ""}</>
            : delta > 0 ? <>Score geral subiu <b>{delta}</b> pts. ✓</> : <>Score estável desde o último snapshot.</>}
        </span>
      </div>
    </div>
  );
};

const STATUS_HEX: Record<HealthStatus, string> = {
  green: "hsl(142 76% 36%)",
  yellow: "hsl(38 92% 50%)",
  red: "hsl(0 84% 60%)",
};
const STATUS_DOT: Record<HealthStatus, string> = {
  green: "bg-emerald-500",
  yellow: "bg-amber-500",
  red: "bg-red-500",
};
const overallLabel = (status: HealthStatus) =>
  status === "green" ? "Saudável" : status === "yellow" ? "Atenção" : "Crítico";

export const BoardHealthScoreBar = () => {
  const { overall, status, dimensions, isLoading } = useBoardHealth();
  const trend = useBoardHealthTrend();
  const [showTrend, setShowTrend] = useState(false);
  const gaugeData = [{ name: "saude", value: overall, fill: STATUS_HEX[status] }];

  return (
    <Card>
      <CardContent className="p-4">
        <div className="grid gap-4 lg:grid-cols-[auto_1fr] lg:items-center">
          <div className="flex items-center gap-4">
            <div className="relative h-24 w-24 shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <RadialBarChart innerRadius="72%" outerRadius="100%" data={gaugeData} startAngle={90} endAngle={-270}>
                  <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
                  <RadialBar dataKey="value" cornerRadius={8} background={{ fill: "hsl(var(--muted))" }} />
                </RadialBarChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-2xl font-bold leading-none">{isLoading ? "—" : overall}</span>
                <span className="text-[10px] text-muted-foreground">/100</span>
              </div>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
                <Activity className="h-3.5 w-3.5" /> Saúde do negócio
                {!isLoading && (
                  <span className="ml-1 inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-1.5 py-0.5 text-[9px] font-medium normal-case text-emerald-500">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />ao vivo
                  </span>
                )}
              </p>
              <p className="text-lg font-bold flex items-center gap-2">
                <span className={cn("h-2.5 w-2.5 rounded-full", STATUS_DOT[status])} />
                {overallLabel(status)}
              </p>
              <p className="text-[11px] text-muted-foreground">Financeiro · Risco · Governança · Compliance</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
            {dimensions.map((dim) => (
              <div key={dim.key} className="rounded-lg border border-border/50 p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium">{dim.label}</span>
                  <span className={cn("h-2.5 w-2.5 rounded-full shrink-0", STATUS_DOT[dim.status])} />
                </div>
                <p className="mt-1 text-xl font-bold">{isLoading ? "—" : dim.score}</p>
                <p className="mt-0.5 text-[10px] text-muted-foreground line-clamp-2">{dim.reason}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-3 border-t border-border/40 pt-2">
          <button onClick={() => setShowTrend((v) => !v)} className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground">
            {showTrend ? "ocultar tendência" : "ver tendência"} <ChevronDown className={cn("h-3 w-3 transition-transform", showTrend && "rotate-180")} />
          </button>
          {showTrend && <HealthTrend trend={trend} />}
        </div>
      </CardContent>
    </Card>
  );
};
