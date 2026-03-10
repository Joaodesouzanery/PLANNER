import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import { Calendar, CheckCircle2, Flag, Milestone } from "lucide-react";
import { format, parseISO, isBefore } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import {
  PlanningGoal, horizonConfig, getHorizon, getCategoryInfo, getStatusInfo,
} from "@/hooks/usePlanningData";

interface PlanningTimelineProps {
  goals: PlanningGoal[];
}

export const PlanningTimeline = ({ goals }: PlanningTimelineProps) => {
  const sorted = goals
    .filter(g => g.end_date)
    .sort((a, b) => new Date(a.end_date!).getTime() - new Date(b.end_date!).getTime());

  if (sorted.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Calendar className="h-10 w-10 mx-auto text-muted-foreground mb-3 opacity-50" />
          <p className="text-muted-foreground">Adicione datas de término às metas para visualizar a timeline</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-6">
        <div className="relative">
          <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gradient-to-b from-emerald-500 via-amber-500 to-purple-500 opacity-30" />
          <div className="space-y-4">
            {sorted.map((goal, index) => {
              const categoryInfo = getCategoryInfo(goal.category);
              const isPast = isBefore(parseISO(goal.end_date!), new Date());
              const horizon = getHorizon(goal);
              const hConfig = horizonConfig[horizon];

              return (
                <motion.div
                  key={goal.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.03 }}
                  className="relative pl-10"
                >
                  <div className={cn(
                    "absolute left-2 w-5 h-5 rounded-full border-2 border-background shadow-sm",
                    goal.status === "completed" ? "bg-emerald-500" : isPast ? "bg-destructive" : categoryInfo.color,
                  )} />
                  <div className="bg-card border border-border rounded-lg p-4 hover:shadow-sm transition-shadow">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="font-semibold text-sm">{goal.title}</h4>
                          <Badge variant="outline" className={cn("text-[10px]", hConfig.color)}>
                            {hConfig.label}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          {format(parseISO(goal.end_date!), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                        </p>
                      </div>
                      <Badge variant="outline" className={cn("text-[10px] flex-shrink-0", getStatusInfo(goal.status).color)}>
                        {getStatusInfo(goal.status).label}
                      </Badge>
                    </div>
                    <Progress value={goal.progress} className="h-1.5 mt-3" />
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
