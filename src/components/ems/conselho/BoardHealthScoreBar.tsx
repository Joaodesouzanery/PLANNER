import { Activity } from "lucide-react";
import { PolarAngleAxis, RadialBar, RadialBarChart, ResponsiveContainer } from "recharts";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useBoardHealth, type HealthStatus } from "@/hooks/useBoardHealth";

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
      </CardContent>
    </Card>
  );
};
