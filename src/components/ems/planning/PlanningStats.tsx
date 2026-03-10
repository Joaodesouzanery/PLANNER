import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import {
  Target, CheckCircle2, TrendingUp, Clock, ListChecks,
} from "lucide-react";

interface PlanningStatsProps {
  stats: {
    total: number;
    completed: number;
    inProgress: number;
    pending: number;
    avgProgress: number;
  };
}

const statItems = [
  { key: "total" as const, label: "Total", icon: Target, color: "text-primary", bg: "bg-primary/10" },
  { key: "completed" as const, label: "Concluídas", icon: CheckCircle2, color: "text-emerald-500", bg: "bg-emerald-500/10" },
  { key: "inProgress" as const, label: "Em Andamento", icon: TrendingUp, color: "text-blue-500", bg: "bg-blue-500/10" },
  { key: "pending" as const, label: "Pendentes", icon: Clock, color: "text-amber-500", bg: "bg-amber-500/10" },
];

export const PlanningStats = ({ stats }: PlanningStatsProps) => (
  <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
    {statItems.map(s => (
      <Card key={s.key} className="overflow-hidden">
        <CardContent className="p-4 flex items-center gap-3">
          <div className={cn("p-2 rounded-lg", s.bg)}>
            <s.icon className={cn("h-5 w-5", s.color)} />
          </div>
          <div>
            <p className="text-2xl font-bold tabular-nums">{stats[s.key]}</p>
            <p className="text-xs text-muted-foreground">{s.label}</p>
          </div>
        </CardContent>
      </Card>
    ))}
    <Card className="overflow-hidden">
      <CardContent className="p-4">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 rounded-lg bg-purple-500/10">
            <ListChecks className="h-5 w-5 text-purple-500" />
          </div>
          <div>
            <p className="text-2xl font-bold tabular-nums">{stats.avgProgress}%</p>
            <p className="text-xs text-muted-foreground">Progresso</p>
          </div>
        </div>
        <Progress value={stats.avgProgress} className="h-1.5" />
      </CardContent>
    </Card>
  </div>
);
