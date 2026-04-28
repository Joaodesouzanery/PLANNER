import { useState, useCallback } from "react";
import { EMSLayout } from "@/components/ems/EMSLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Target, Plus, Eye, Zap, TrendingUp, Rocket, BarChart3, Calendar,
} from "lucide-react";
import { format, addMonths, addYears } from "date-fns";
import { cn } from "@/lib/utils";
import {
  usePlanningData, PlanningGoal, GoalFormData, MilestoneFormData,
  Horizon, horizonConfig, categories, getCategoryInfo,
} from "@/hooks/usePlanningData";
import { PlanningStats } from "@/components/ems/planning/PlanningStats";
import { GoalCard } from "@/components/ems/planning/GoalCard";
import { HorizonSection } from "@/components/ems/planning/HorizonSection";
import { PlanningTimeline } from "@/components/ems/planning/PlanningTimeline";
import { GoalModal, MilestoneModal } from "@/components/ems/planning/PlanningModals";
import { TrueNorthPanel } from "@/components/ems/TrueNorthPanel";

const emptyGoalForm: GoalFormData = {
  title: "", description: "", category: "strategic", start_date: "",
  end_date: "", status: "pending", parent_id: "", okr_id: "", project_id: "",
};

const emptyMilestoneForm: MilestoneFormData = { title: "", description: "", due_date: "" };

const horizonIcons = { short: Zap, medium: TrendingUp, long: Rocket };

const Planning = () => {
  const data = usePlanningData();
  const [activeTab, setActiveTab] = useState("dashboard");
  const [expandedGoals, setExpandedGoals] = useState<Set<string>>(new Set());
  const [showGoalModal, setShowGoalModal] = useState(false);
  const [showMilestoneModal, setShowMilestoneModal] = useState(false);
  const [editingGoal, setEditingGoal] = useState<PlanningGoal | null>(null);
  const [selectedGoalId, setSelectedGoalId] = useState<string | null>(null);
  const [goalForm, setGoalForm] = useState<GoalFormData>(emptyGoalForm);
  const [milestoneForm, setMilestoneForm] = useState<MilestoneFormData>(emptyMilestoneForm);

  const toggleExpand = useCallback((id: string) => {
    setExpandedGoals(prev => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  }, []);

  const resetGoalForm = useCallback(() => {
    setGoalForm(emptyGoalForm);
    setEditingGoal(null);
    setShowGoalModal(false);
  }, []);

  const handleEditGoal = useCallback((goal: PlanningGoal) => {
    setEditingGoal(goal);
    setGoalForm({
      title: goal.title, description: goal.description || "", category: goal.category,
      start_date: goal.start_date || "", end_date: goal.end_date || "", status: goal.status,
      parent_id: goal.parent_id || "", okr_id: "", project_id: "",
    });
    setShowGoalModal(true);
  }, []);

  const handleSaveGoal = useCallback(async () => {
    if (!goalForm.title.trim()) return;
    await data.saveGoal({ form: goalForm, editId: editingGoal?.id });
    resetGoalForm();
  }, [goalForm, editingGoal, data, resetGoalForm]);

  const handleDeleteGoal = useCallback(async (id: string) => {
    await data.deleteGoal(id);
  }, [data]);

  const handleAddMilestone = useCallback((goalId: string) => {
    setSelectedGoalId(goalId);
    setMilestoneForm(emptyMilestoneForm);
    setShowMilestoneModal(true);
  }, []);

  const handleSaveMilestone = useCallback(async () => {
    if (!milestoneForm.title.trim() || !selectedGoalId) return;
    await data.saveMilestone({ form: milestoneForm, goalId: selectedGoalId });
    setMilestoneForm(emptyMilestoneForm);
    setShowMilestoneModal(false);
  }, [milestoneForm, selectedGoalId, data]);

  const handleToggleMilestone = useCallback(async (m: any) => {
    await data.toggleMilestone(m);
  }, [data]);

  const handleDeleteMilestone = useCallback(async (id: string, goalId: string) => {
    await data.deleteMilestone({ id, goalId });
  }, [data]);

  const openGoalForHorizon = useCallback((horizon: Horizon) => {
    const now = new Date();
    let end_date = "";
    if (horizon === "short") end_date = format(addMonths(now, 2), "yyyy-MM-dd");
    else if (horizon === "medium") end_date = format(addMonths(now, 6), "yyyy-MM-dd");
    else end_date = format(addYears(now, 2), "yyyy-MM-dd");
    setGoalForm({ ...emptyGoalForm, start_date: format(now, "yyyy-MM-dd"), end_date });
    setShowGoalModal(true);
  }, []);

  // Shared GoalCard props
  const cardProps = {
    expandedGoals, onToggleExpand: toggleExpand, onEdit: handleEditGoal,
    onDelete: handleDeleteGoal, onAddMilestone: handleAddMilestone,
    onToggleMilestone: handleToggleMilestone, onDeleteMilestone: handleDeleteMilestone,
    getChildGoals: data.getChildGoals, getGoalMilestones: data.getGoalMilestones,
  };

  return (
    <EMSLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-heading font-bold text-foreground">Planejamento</h1>
            <p className="text-muted-foreground mt-1">Plano de curto, médio e longo prazo</p>
          </div>
          <Button onClick={() => { setGoalForm(emptyGoalForm); setEditingGoal(null); setShowGoalModal(true); }}>
            <Plus className="h-4 w-4 mr-2" />Nova Meta
          </Button>
        </div>

        <TrueNorthPanel compact />

        {/* Stats */}
        <PlanningStats stats={data.stats} />

        {/* Horizon Overview */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {(["short", "medium", "long"] as const).map(h => {
            const config = horizonConfig[h];
            const hs = data.horizonStats[h];
            const Icon = horizonIcons[h];
            return (
              <Card key={h} className={cn("border cursor-pointer hover:shadow-md transition-all", config.border)}
                onClick={() => setActiveTab(h)}>
                <CardContent className="p-5">
                  <div className="flex items-center gap-3 mb-3">
                    <div className={cn("p-2.5 rounded-xl", config.bg)}>
                      <Icon className={cn("h-6 w-6", config.color)} />
                    </div>
                    <div>
                      <h3 className="font-semibold">{config.label}</h3>
                      <p className="text-xs text-muted-foreground">{config.sublabel}</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">{hs.total} metas</span>
                    <span className={cn("text-sm font-bold tabular-nums", config.color)}>{hs.avg}%</span>
                  </div>
                  <Progress value={hs.avg} className="h-2 mt-2" />
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-6">
            <TabsTrigger value="dashboard" className="gap-1"><Eye className="h-4 w-4" /><span className="hidden sm:inline">Geral</span></TabsTrigger>
            <TabsTrigger value="short" className="gap-1"><Zap className="h-4 w-4" /><span className="hidden sm:inline">Curto</span></TabsTrigger>
            <TabsTrigger value="medium" className="gap-1"><TrendingUp className="h-4 w-4" /><span className="hidden sm:inline">Médio</span></TabsTrigger>
            <TabsTrigger value="long" className="gap-1"><Rocket className="h-4 w-4" /><span className="hidden sm:inline">Longo</span></TabsTrigger>
            <TabsTrigger value="by-category" className="gap-1"><BarChart3 className="h-4 w-4" /><span className="hidden sm:inline">Categorias</span></TabsTrigger>
            <TabsTrigger value="timeline" className="gap-1"><Calendar className="h-4 w-4" /><span className="hidden sm:inline">Timeline</span></TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard" className="mt-4">
            {data.isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map(i => <Skeleton key={i} className="h-24 w-full rounded-lg" />)}
              </div>
            ) : data.rootGoals.length === 0 ? (
              <Card>
                <CardContent className="py-16 text-center">
                  <Target className="h-12 w-12 mx-auto text-muted-foreground mb-4 opacity-50" />
                  <h3 className="text-lg font-semibold">Nenhuma meta cadastrada</h3>
                  <p className="text-muted-foreground mt-1">Comece criando sua primeira meta estratégica</p>
                  <Button className="mt-4" onClick={() => setShowGoalModal(true)}>
                    <Plus className="h-4 w-4 mr-2" />Criar Meta
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-2">
                {data.rootGoals.map(g => (
                  <GoalCard
                    key={g.id} goal={g}
                    milestones={data.getGoalMilestones(g.id)}
                    childGoals={data.getChildGoals(g.id)}
                    isExpanded={expandedGoals.has(g.id)}
                    {...cardProps}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          {(["short", "medium", "long"] as const).map(h => (
            <TabsContent key={h} value={h} className="mt-4">
              <HorizonSection
                horizonKey={h}
                goals={data.goalsByHorizon[h]}
                horizonStat={data.horizonStats[h]}
                onCreateGoal={openGoalForHorizon}
                onEditGoal={handleEditGoal}
                onDeleteGoal={handleDeleteGoal}
                onAddMilestone={handleAddMilestone}
                onToggleMilestone={handleToggleMilestone}
                onDeleteMilestone={handleDeleteMilestone}
                {...cardProps}
              />
            </TabsContent>
          ))}

          <TabsContent value="by-category" className="mt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {categories.map(cat => {
                const catGoals = data.goals.filter(g => g.category === cat.value);
                return (
                  <Card key={cat.value}>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base flex items-center gap-2">
                        <div className={cn("w-3 h-3 rounded-full", cat.color)} />
                        {cat.label}
                        <Badge variant="outline" className="ml-auto">{catGoals.length}</Badge>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {catGoals.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-4">Nenhuma meta</p>
                      ) : (
                        <div className="space-y-2">
                          {catGoals.slice(0, 5).map(g => (
                            <div key={g.id} className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
                              <span className="text-sm truncate flex-1">{g.title}</span>
                              <div className="flex items-center gap-2 ml-2">
                                <Progress value={g.progress} className="h-1.5 w-16" />
                                <span className="text-xs text-muted-foreground tabular-nums">{g.progress}%</span>
                              </div>
                            </div>
                          ))}
                          {catGoals.length > 5 && (
                            <p className="text-xs text-muted-foreground text-center">+{catGoals.length - 5} mais</p>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </TabsContent>

          <TabsContent value="timeline" className="mt-4">
            <PlanningTimeline goals={data.goals} />
          </TabsContent>
        </Tabs>

        {/* Modals */}
        <GoalModal
          open={showGoalModal} onClose={resetGoalForm} form={goalForm} setForm={setGoalForm}
          editingGoal={editingGoal} goals={data.goals} okrs={data.okrs} projects={data.projects}
          onSave={handleSaveGoal} isSaving={data.isSaving}
        />
        <MilestoneModal
          open={showMilestoneModal} onClose={() => setShowMilestoneModal(false)}
          form={milestoneForm} setForm={setMilestoneForm}
          onSave={handleSaveMilestone} isSaving={data.isSaving}
        />
      </div>
    </EMSLayout>
  );
};

export default Planning;
