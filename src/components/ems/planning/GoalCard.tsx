import { memo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus, Edit2, Trash2, Calendar, Flag, ChevronDown, ChevronRight, Milestone,
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { cn } from "@/lib/utils";
import { PlanningGoal, PlanningMilestone, getCategoryInfo, getStatusInfo } from "@/hooks/usePlanningData";

interface GoalCardProps {
  goal: PlanningGoal;
  depth?: number;
  milestones: PlanningMilestone[];
  childGoals: PlanningGoal[];
  isExpanded: boolean;
  onToggleExpand: (id: string) => void;
  onEdit: (goal: PlanningGoal) => void;
  onDelete: (id: string) => void;
  onAddMilestone: (goalId: string) => void;
  onToggleMilestone: (milestone: PlanningMilestone) => void;
  onDeleteMilestone: (id: string, goalId: string) => void;
  getChildGoals: (id: string) => PlanningGoal[];
  getGoalMilestones: (id: string) => PlanningMilestone[];
  expandedGoals: Set<string>;
}

export const GoalCard = memo(({
  goal, depth = 0, milestones, childGoals, isExpanded,
  onToggleExpand, onEdit, onDelete, onAddMilestone,
  onToggleMilestone, onDeleteMilestone, getChildGoals, getGoalMilestones, expandedGoals,
}: GoalCardProps) => {
  const categoryInfo = getCategoryInfo(goal.category);
  const statusInfo = getStatusInfo(goal.status);
  const hasChildren = childGoals.length > 0 || milestones.length > 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(depth > 0 && "ml-4 sm:ml-6 border-l-2 border-border pl-4")}
    >
      <Card className="mb-3 group hover:border-primary/30 transition-all hover:shadow-sm">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            {hasChildren ? (
              <button onClick={() => onToggleExpand(goal.id)} className="p-1 hover:bg-muted rounded mt-1 transition-colors">
                {isExpanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
              </button>
            ) : <div className="w-6" />}

            <div className={cn("w-1.5 self-stretch rounded-full min-h-[3rem]", categoryInfo.color)} />

            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h4 className="font-semibold text-foreground leading-tight">{goal.title}</h4>
                  {goal.description && (
                    <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{goal.description}</p>
                  )}
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <Badge variant="outline" className="text-[10px] px-1.5">{categoryInfo.label}</Badge>
                  <Badge variant="outline" className={cn("text-[10px] px-1.5", statusInfo.color)}>{statusInfo.label}</Badge>
                </div>
              </div>

              <div className="mt-3 flex items-center gap-3">
                <div className="flex-1">
                  <Progress value={goal.progress} className="h-2" />
                </div>
                <span className={cn(
                  "text-sm font-bold tabular-nums",
                  goal.progress === 100 ? "text-emerald-500" : goal.progress > 50 ? "text-primary" : "text-muted-foreground"
                )}>
                  {goal.progress}%
                </span>
              </div>

              <div className="mt-3 flex items-center justify-between">
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  {goal.start_date && (
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {format(parseISO(goal.start_date), "dd/MM/yy")}
                    </span>
                  )}
                  {goal.end_date && (
                    <span className="flex items-center gap-1">
                      <Flag className="h-3 w-3" />
                      {format(parseISO(goal.end_date), "dd/MM/yy")}
                    </span>
                  )}
                  {milestones.length > 0 && (
                    <span className="flex items-center gap-1">
                      <Milestone className="h-3 w-3" />
                      {milestones.filter(m => m.completed).length}/{milestones.length}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onAddMilestone(goal.id)}>
                    <Plus className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onEdit(goal)}>
                    <Edit2 className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => onDelete(goal.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </div>
          </div>

          <AnimatePresence>
            {isExpanded && milestones.length > 0 && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="mt-4 pt-4 border-t border-border">
                  <h5 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-2">
                    <Milestone className="h-3.5 w-3.5" />Marcos
                  </h5>
                  <div className="space-y-1.5">
                    {milestones.map(milestone => (
                      <div key={milestone.id} className="flex items-center gap-3 p-2 rounded-lg bg-muted/40 hover:bg-muted/70 transition-colors">
                        <Checkbox checked={milestone.completed} onCheckedChange={() => onToggleMilestone(milestone)} />
                        <div className="flex-1 min-w-0">
                          <span className={cn("text-sm", milestone.completed && "line-through text-muted-foreground")}>
                            {milestone.title}
                          </span>
                          {milestone.due_date && (
                            <span className="text-[10px] text-muted-foreground ml-2">
                              {format(parseISO(milestone.due_date), "dd/MM/yy")}
                            </span>
                          )}
                        </div>
                        <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive opacity-0 group-hover:opacity-100"
                          onClick={() => onDeleteMilestone(milestone.id, goal.id)}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </CardContent>
      </Card>

      {isExpanded && childGoals.map(child => (
        <GoalCard
          key={child.id}
          goal={child}
          depth={depth + 1}
          milestones={getGoalMilestones(child.id)}
          childGoals={getChildGoals(child.id)}
          isExpanded={expandedGoals.has(child.id)}
          onToggleExpand={onToggleExpand}
          onEdit={onEdit}
          onDelete={onDelete}
          onAddMilestone={onAddMilestone}
          onToggleMilestone={onToggleMilestone}
          onDeleteMilestone={onDeleteMilestone}
          getChildGoals={getChildGoals}
          getGoalMilestones={getGoalMilestones}
          expandedGoals={expandedGoals}
        />
      ))}
    </motion.div>
  );
});

GoalCard.displayName = "GoalCard";
