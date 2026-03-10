import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Plus, CheckCircle2, TrendingUp, Zap, Rocket,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  PlanningGoal, PlanningMilestone, Horizon, horizonConfig,
} from "@/hooks/usePlanningData";
import { GoalCard } from "./GoalCard";

const horizonIcons = { short: Zap, medium: TrendingUp, long: Rocket };

interface HorizonSectionProps {
  horizonKey: Horizon;
  goals: PlanningGoal[];
  horizonStat: { total: number; avg: number; completed: number };
  onCreateGoal: (horizon: Horizon) => void;
  // GoalCard props passthrough
  expandedGoals: Set<string>;
  onToggleExpand: (id: string) => void;
  onEditGoal: (goal: PlanningGoal) => void;
  onDeleteGoal: (id: string) => void;
  onAddMilestone: (goalId: string) => void;
  onToggleMilestone: (milestone: PlanningMilestone) => void;
  onDeleteMilestone: (id: string, goalId: string) => void;
  getChildGoals: (id: string) => PlanningGoal[];
  getGoalMilestones: (id: string) => PlanningMilestone[];
}

export const HorizonSection = ({
  horizonKey, goals, horizonStat, onCreateGoal,
  expandedGoals, onToggleExpand, onEditGoal, onDeleteGoal,
  onAddMilestone, onToggleMilestone, onDeleteMilestone,
  getChildGoals, getGoalMilestones,
}: HorizonSectionProps) => {
  const config = horizonConfig[horizonKey];
  const Icon = horizonIcons[horizonKey];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <Card className={cn("border", config.border)}>
          <CardContent className="p-4 flex items-center gap-3">
            <div className={cn("p-2 rounded-lg", config.bg)}><Icon className={cn("h-5 w-5", config.color)} /></div>
            <div><p className="text-2xl font-bold tabular-nums">{horizonStat.total}</p><p className="text-xs text-muted-foreground">Metas</p></div>
          </CardContent>
        </Card>
        <Card className={cn("border", config.border)}>
          <CardContent className="p-4 flex items-center gap-3">
            <div className={cn("p-2 rounded-lg", config.bg)}><TrendingUp className={cn("h-5 w-5", config.color)} /></div>
            <div><p className="text-2xl font-bold tabular-nums">{horizonStat.avg}%</p><p className="text-xs text-muted-foreground">Progresso</p></div>
          </CardContent>
        </Card>
        <Card className={cn("border col-span-2 sm:col-span-1", config.border)}>
          <CardContent className="p-4 flex items-center gap-3">
            <div className={cn("p-2 rounded-lg", config.bg)}><CheckCircle2 className={cn("h-5 w-5", config.color)} /></div>
            <div><p className="text-2xl font-bold tabular-nums">{horizonStat.completed}</p><p className="text-xs text-muted-foreground">Concluídas</p></div>
          </CardContent>
        </Card>
      </div>

      <div className="flex justify-end">
        <Button size="sm" onClick={() => onCreateGoal(horizonKey)}>
          <Plus className="h-4 w-4 mr-1" />Nova Meta
        </Button>
      </div>

      {goals.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center">
            <Icon className={cn("h-10 w-10 mx-auto mb-3 opacity-40", config.color)} />
            <p className="text-muted-foreground">Nenhuma meta de {config.label.toLowerCase()}</p>
            <p className="text-xs text-muted-foreground mt-1">{config.sublabel}</p>
            <Button className="mt-4" size="sm" variant="outline" onClick={() => onCreateGoal(horizonKey)}>
              <Plus className="h-4 w-4 mr-1" />Criar Meta
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {goals.map(g => (
            <GoalCard
              key={g.id}
              goal={g}
              milestones={getGoalMilestones(g.id)}
              childGoals={getChildGoals(g.id)}
              isExpanded={expandedGoals.has(g.id)}
              onToggleExpand={onToggleExpand}
              onEdit={onEditGoal}
              onDelete={onDeleteGoal}
              onAddMilestone={onAddMilestone}
              onToggleMilestone={onToggleMilestone}
              onDeleteMilestone={onDeleteMilestone}
              getChildGoals={getChildGoals}
              getGoalMilestones={getGoalMilestones}
              expandedGoals={expandedGoals}
            />
          ))}
        </div>
      )}
    </div>
  );
};
