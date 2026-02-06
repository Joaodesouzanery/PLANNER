import { useState, useEffect } from "react";
import { EMSLayout } from "@/components/ems/EMSLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { motion, AnimatePresence } from "framer-motion";
import {
  Target,
  Plus,
  Edit2,
  Trash2,
  Calendar,
  CheckCircle2,
  Clock,
  Flag,
  ChevronDown,
  ChevronRight,
  Milestone,
  TrendingUp,
  ListChecks,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format, parseISO, differenceInDays, isAfter, isBefore } from "date-fns";
import { ptBR } from "date-fns/locale";

interface PlanningGoal {
  id: string;
  title: string;
  description: string | null;
  category: string;
  start_date: string | null;
  end_date: string | null;
  progress: number;
  status: string;
  parent_id: string | null;
  order_index: number;
  created_at: string;
  milestones?: PlanningMilestone[];
  children?: PlanningGoal[];
}

interface PlanningMilestone {
  id: string;
  goal_id: string;
  title: string;
  description: string | null;
  due_date: string | null;
  completed: boolean;
  completed_at: string | null;
  order_index: number;
}

const categories = [
  { value: "strategic", label: "Estratégico", color: "bg-primary" },
  { value: "operational", label: "Operacional", color: "bg-blue-500" },
  { value: "financial", label: "Financeiro", color: "bg-emerald-500" },
  { value: "growth", label: "Crescimento", color: "bg-amber-500" },
  { value: "team", label: "Equipe", color: "bg-purple-500" },
];

const statusOptions = [
  { value: "pending", label: "Pendente", color: "text-muted-foreground" },
  { value: "in_progress", label: "Em Andamento", color: "text-primary" },
  { value: "completed", label: "Concluído", color: "text-emerald-500" },
  { value: "on_hold", label: "Pausado", color: "text-amber-500" },
  { value: "cancelled", label: "Cancelado", color: "text-destructive" },
];

const Planning = () => {
  const { toast } = useToast();
  const [goals, setGoals] = useState<PlanningGoal[]>([]);
  const [milestones, setMilestones] = useState<PlanningMilestone[]>([]);
  const [loading, setLoading] = useState(true);
  const [showGoalModal, setShowGoalModal] = useState(false);
  const [showMilestoneModal, setShowMilestoneModal] = useState(false);
  const [editingGoal, setEditingGoal] = useState<PlanningGoal | null>(null);
  const [selectedGoalId, setSelectedGoalId] = useState<string | null>(null);
  const [expandedGoals, setExpandedGoals] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState("overview");

  const [goalForm, setGoalForm] = useState({
    title: "",
    description: "",
    category: "strategic",
    start_date: "",
    end_date: "",
    status: "pending",
    parent_id: "",
  });

  const [milestoneForm, setMilestoneForm] = useState({
    title: "",
    description: "",
    due_date: "",
  });

  useEffect(() => {
    fetchGoals();
    fetchMilestones();
  }, []);

  const fetchGoals = async () => {
    const { data, error } = await supabase
      .from("planning_goals")
      .select("*")
      .order("order_index");
    
    if (data) {
      setGoals(data);
    }
    setLoading(false);
  };

  const fetchMilestones = async () => {
    const { data } = await supabase
      .from("planning_milestones")
      .select("*")
      .order("order_index");
    
    if (data) {
      setMilestones(data);
    }
  };

  const handleSaveGoal = async () => {
    if (!goalForm.title.trim()) {
      toast({ title: "Erro", description: "Título é obrigatório", variant: "destructive" });
      return;
    }

    const goalData = {
      title: goalForm.title,
      description: goalForm.description || null,
      category: goalForm.category,
      start_date: goalForm.start_date || null,
      end_date: goalForm.end_date || null,
      status: goalForm.status,
      parent_id: goalForm.parent_id || null,
    };

    if (editingGoal) {
      await supabase.from("planning_goals").update(goalData).eq("id", editingGoal.id);
      toast({ title: "Meta atualizada!" });
    } else {
      await supabase.from("planning_goals").insert(goalData);
      toast({ title: "Meta criada!" });
    }

    resetGoalForm();
    fetchGoals();
  };

  const handleDeleteGoal = async (id: string) => {
    await supabase.from("planning_goals").delete().eq("id", id);
    toast({ title: "Meta excluída" });
    fetchGoals();
  };

  const handleSaveMilestone = async () => {
    if (!milestoneForm.title.trim() || !selectedGoalId) return;

    await supabase.from("planning_milestones").insert({
      goal_id: selectedGoalId,
      title: milestoneForm.title,
      description: milestoneForm.description || null,
      due_date: milestoneForm.due_date || null,
    });

    toast({ title: "Marco criado!" });
    setMilestoneForm({ title: "", description: "", due_date: "" });
    setShowMilestoneModal(false);
    fetchMilestones();
    updateGoalProgress(selectedGoalId);
  };

  const toggleMilestoneComplete = async (milestone: PlanningMilestone) => {
    await supabase
      .from("planning_milestones")
      .update({
        completed: !milestone.completed,
        completed_at: !milestone.completed ? new Date().toISOString() : null,
      })
      .eq("id", milestone.id);

    fetchMilestones();
    if (milestone.goal_id) {
      updateGoalProgress(milestone.goal_id);
    }
  };

  const updateGoalProgress = async (goalId: string) => {
    const goalMilestones = milestones.filter((m) => m.goal_id === goalId);
    if (goalMilestones.length === 0) return;

    const completed = goalMilestones.filter((m) => m.completed).length;
    const progress = Math.round((completed / goalMilestones.length) * 100);

    await supabase
      .from("planning_goals")
      .update({ 
        progress,
        status: progress === 100 ? "completed" : progress > 0 ? "in_progress" : "pending"
      })
      .eq("id", goalId);

    fetchGoals();
  };

  const deleteMilestone = async (id: string, goalId: string) => {
    await supabase.from("planning_milestones").delete().eq("id", id);
    toast({ title: "Marco excluído" });
    fetchMilestones();
    updateGoalProgress(goalId);
  };

  const resetGoalForm = () => {
    setGoalForm({
      title: "",
      description: "",
      category: "strategic",
      start_date: "",
      end_date: "",
      status: "pending",
      parent_id: "",
    });
    setEditingGoal(null);
    setShowGoalModal(false);
  };

  const toggleExpand = (goalId: string) => {
    const newExpanded = new Set(expandedGoals);
    if (newExpanded.has(goalId)) {
      newExpanded.delete(goalId);
    } else {
      newExpanded.add(goalId);
    }
    setExpandedGoals(newExpanded);
  };

  const getGoalMilestones = (goalId: string) => {
    return milestones.filter((m) => m.goal_id === goalId);
  };

  const getRootGoals = () => goals.filter((g) => !g.parent_id);
  const getChildGoals = (parentId: string) => goals.filter((g) => g.parent_id === parentId);

  const getCategoryInfo = (category: string) => 
    categories.find((c) => c.value === category) || categories[0];

  const getStatusInfo = (status: string) => 
    statusOptions.find((s) => s.value === status) || statusOptions[0];

  const stats = {
    total: goals.length,
    completed: goals.filter((g) => g.status === "completed").length,
    inProgress: goals.filter((g) => g.status === "in_progress").length,
    pending: goals.filter((g) => g.status === "pending").length,
    avgProgress: goals.length > 0 
      ? Math.round(goals.reduce((acc, g) => acc + g.progress, 0) / goals.length)
      : 0,
  };

  const renderGoalCard = (goal: PlanningGoal, depth = 0) => {
    const categoryInfo = getCategoryInfo(goal.category);
    const statusInfo = getStatusInfo(goal.status);
    const goalMilestones = getGoalMilestones(goal.id);
    const childGoals = getChildGoals(goal.id);
    const hasChildren = childGoals.length > 0 || goalMilestones.length > 0;
    const isExpanded = expandedGoals.has(goal.id);

    return (
      <motion.div
        key={goal.id}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className={`${depth > 0 ? "ml-6 border-l-2 border-border pl-4" : ""}`}
      >
        <Card className="mb-3 hover:border-primary/30 transition-colors">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              {/* Expand/Collapse */}
              {hasChildren && (
                <button
                  onClick={() => toggleExpand(goal.id)}
                  className="p-1 hover:bg-muted rounded mt-1"
                >
                  {isExpanded ? (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  )}
                </button>
              )}
              {!hasChildren && <div className="w-6" />}

              {/* Category indicator */}
              <div className={`w-1 h-12 rounded-full ${categoryInfo.color}`} />

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h4 className="font-medium text-foreground">{goal.title}</h4>
                    {goal.description && (
                      <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                        {goal.description}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Badge variant="outline" className="text-xs">
                      {categoryInfo.label}
                    </Badge>
                    <Badge variant="outline" className={`text-xs ${statusInfo.color}`}>
                      {statusInfo.label}
                    </Badge>
                  </div>
                </div>

                {/* Progress */}
                <div className="mt-3 flex items-center gap-4">
                  <div className="flex-1">
                    <Progress value={goal.progress} className="h-2" />
                  </div>
                  <span className="text-sm font-medium text-muted-foreground">
                    {goal.progress}%
                  </span>
                </div>

                {/* Dates and Actions */}
                <div className="mt-3 flex items-center justify-between">
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    {goal.start_date && (
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        Início: {format(parseISO(goal.start_date), "dd/MM/yy")}
                      </span>
                    )}
                    {goal.end_date && (
                      <span className="flex items-center gap-1">
                        <Flag className="h-3 w-3" />
                        Fim: {format(parseISO(goal.end_date), "dd/MM/yy")}
                      </span>
                    )}
                    {goalMilestones.length > 0 && (
                      <span className="flex items-center gap-1">
                        <Milestone className="h-3 w-3" />
                        {goalMilestones.filter((m) => m.completed).length}/{goalMilestones.length} marcos
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => {
                        setSelectedGoalId(goal.id);
                        setShowMilestoneModal(true);
                      }}
                    >
                      <Plus className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => {
                        setEditingGoal(goal);
                        setGoalForm({
                          title: goal.title,
                          description: goal.description || "",
                          category: goal.category,
                          start_date: goal.start_date || "",
                          end_date: goal.end_date || "",
                          status: goal.status,
                          parent_id: goal.parent_id || "",
                        });
                        setShowGoalModal(true);
                      }}
                    >
                      <Edit2 className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive"
                      onClick={() => handleDeleteGoal(goal.id)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            {/* Expanded content */}
            <AnimatePresence>
              {isExpanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  {/* Milestones */}
                  {goalMilestones.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-border">
                      <h5 className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-2">
                        <Milestone className="h-4 w-4" />
                        Marcos
                      </h5>
                      <div className="space-y-2">
                        {goalMilestones.map((milestone) => (
                          <div
                            key={milestone.id}
                            className="flex items-center gap-3 p-2 rounded-lg bg-muted/50"
                          >
                            <Checkbox
                              checked={milestone.completed}
                              onCheckedChange={() => toggleMilestoneComplete(milestone)}
                            />
                            <div className="flex-1">
                              <span className={milestone.completed ? "line-through text-muted-foreground" : ""}>
                                {milestone.title}
                              </span>
                              {milestone.due_date && (
                                <span className="text-xs text-muted-foreground ml-2">
                                  • {format(parseISO(milestone.due_date), "dd/MM/yy")}
                                </span>
                              )}
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 text-destructive"
                              onClick={() => deleteMilestone(milestone.id, goal.id)}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </CardContent>
        </Card>

        {/* Child goals */}
        {isExpanded && childGoals.map((child) => renderGoalCard(child, depth + 1))}
      </motion.div>
    );
  };

  return (
    <EMSLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-heading font-bold text-foreground">
              Planejamento
            </h1>
            <p className="text-muted-foreground mt-1">
              Gerencie metas, objetivos e marcos estratégicos
            </p>
          </div>
          <Button onClick={() => setShowGoalModal(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Nova Meta
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Target className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.total}</p>
                  <p className="text-xs text-muted-foreground">Total de Metas</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-emerald-500/10">
                  <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.completed}</p>
                  <p className="text-xs text-muted-foreground">Concluídas</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-500/10">
                  <TrendingUp className="h-5 w-5 text-blue-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.inProgress}</p>
                  <p className="text-xs text-muted-foreground">Em Andamento</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-amber-500/10">
                  <Clock className="h-5 w-5 text-amber-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.pending}</p>
                  <p className="text-xs text-muted-foreground">Pendentes</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-purple-500/10">
                  <ListChecks className="h-5 w-5 text-purple-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.avgProgress}%</p>
                  <p className="text-xs text-muted-foreground">Progresso Médio</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="overview">Visão Geral</TabsTrigger>
            <TabsTrigger value="by-category">Por Categoria</TabsTrigger>
            <TabsTrigger value="timeline">Timeline</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-4">
            {loading ? (
              <div className="space-y-4">
                {[...Array(3)].map((_, i) => (
                  <Card key={i} className="animate-pulse">
                    <CardContent className="p-4">
                      <div className="h-20 bg-muted rounded" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : getRootGoals().length === 0 ? (
              <Card>
                <CardContent className="p-12 text-center">
                  <Target className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium">Nenhuma meta cadastrada</h3>
                  <p className="text-muted-foreground mt-1">
                    Comece criando sua primeira meta estratégica
                  </p>
                  <Button className="mt-4" onClick={() => setShowGoalModal(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Criar Meta
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-2">
                {getRootGoals().map((goal) => renderGoalCard(goal))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="by-category" className="mt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {categories.map((category) => {
                const categoryGoals = goals.filter((g) => g.category === category.value);
                return (
                  <Card key={category.value}>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base flex items-center gap-2">
                        <div className={`w-3 h-3 rounded-full ${category.color}`} />
                        {category.label}
                        <Badge variant="outline" className="ml-auto">
                          {categoryGoals.length}
                        </Badge>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {categoryGoals.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-4">
                          Nenhuma meta nesta categoria
                        </p>
                      ) : (
                        <div className="space-y-2">
                          {categoryGoals.slice(0, 5).map((goal) => (
                            <div
                              key={goal.id}
                              className="flex items-center justify-between p-2 rounded-lg bg-muted/50"
                            >
                              <span className="text-sm truncate flex-1">{goal.title}</span>
                              <span className="text-xs text-muted-foreground ml-2">
                                {goal.progress}%
                              </span>
                            </div>
                          ))}
                          {categoryGoals.length > 5 && (
                            <p className="text-xs text-muted-foreground text-center">
                              +{categoryGoals.length - 5} mais
                            </p>
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
            <Card>
              <CardContent className="p-6">
                <div className="relative">
                  {/* Timeline line */}
                  <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-border" />

                  <div className="space-y-6">
                    {goals
                      .filter((g) => g.end_date)
                      .sort((a, b) => 
                        new Date(a.end_date!).getTime() - new Date(b.end_date!).getTime()
                      )
                      .map((goal, index) => {
                        const categoryInfo = getCategoryInfo(goal.category);
                        const isPast = goal.end_date && isBefore(parseISO(goal.end_date), new Date());
                        
                        return (
                          <motion.div
                            key={goal.id}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: index * 0.05 }}
                            className="relative pl-10"
                          >
                            {/* Timeline dot */}
                            <div className={`absolute left-2 w-5 h-5 rounded-full border-2 border-background ${
                              goal.status === "completed" 
                                ? "bg-emerald-500" 
                                : isPast 
                                  ? "bg-destructive" 
                                  : categoryInfo.color
                            }`} />

                            <div className="bg-card border border-border rounded-lg p-4">
                              <div className="flex items-start justify-between">
                                <div>
                                  <h4 className="font-medium">{goal.title}</h4>
                                  <p className="text-sm text-muted-foreground mt-1">
                                    {goal.end_date && format(parseISO(goal.end_date), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                                  </p>
                                </div>
                                <Badge variant="outline" className={getStatusInfo(goal.status).color}>
                                  {getStatusInfo(goal.status).label}
                                </Badge>
                              </div>
                              <Progress value={goal.progress} className="h-1.5 mt-3" />
                            </div>
                          </motion.div>
                        );
                      })}

                    {goals.filter((g) => g.end_date).length === 0 && (
                      <p className="text-muted-foreground text-center py-8">
                        Adicione datas de término às metas para visualizar a timeline
                      </p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Goal Modal */}
        <Dialog open={showGoalModal} onOpenChange={(open) => !open && resetGoalForm()}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{editingGoal ? "Editar Meta" : "Nova Meta"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">Título *</label>
                <Input
                  value={goalForm.title}
                  onChange={(e) => setGoalForm({ ...goalForm, title: e.target.value })}
                  placeholder="Ex: Aumentar receita em 30%"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Descrição</label>
                <Textarea
                  value={goalForm.description}
                  onChange={(e) => setGoalForm({ ...goalForm, description: e.target.value })}
                  placeholder="Descreva a meta..."
                  rows={3}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Categoria</label>
                  <Select
                    value={goalForm.category}
                    onValueChange={(v) => setGoalForm({ ...goalForm, category: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((cat) => (
                        <SelectItem key={cat.value} value={cat.value}>
                          <div className="flex items-center gap-2">
                            <div className={`w-2 h-2 rounded-full ${cat.color}`} />
                            {cat.label}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium">Status</label>
                  <Select
                    value={goalForm.status}
                    onValueChange={(v) => setGoalForm({ ...goalForm, status: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {statusOptions.map((status) => (
                        <SelectItem key={status.value} value={status.value}>
                          {status.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Data de Início</label>
                  <Input
                    type="date"
                    value={goalForm.start_date}
                    onChange={(e) => setGoalForm({ ...goalForm, start_date: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Data de Término</label>
                  <Input
                    type="date"
                    value={goalForm.end_date}
                    onChange={(e) => setGoalForm({ ...goalForm, end_date: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium">Meta Pai (opcional)</label>
                <Select
                  value={goalForm.parent_id || "none"}
                  onValueChange={(v) => setGoalForm({ ...goalForm, parent_id: v === "none" ? "" : v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione uma meta pai" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhuma (meta raiz)</SelectItem>
                    {goals
                      .filter((g) => g.id !== editingGoal?.id)
                      .map((g) => (
                        <SelectItem key={g.id} value={g.id}>
                          {g.title}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <Button variant="outline" onClick={resetGoalForm}>
                  Cancelar
                </Button>
                <Button onClick={handleSaveGoal}>
                  {editingGoal ? "Salvar" : "Criar Meta"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Milestone Modal */}
        <Dialog open={showMilestoneModal} onOpenChange={setShowMilestoneModal}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Novo Marco</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">Título *</label>
                <Input
                  value={milestoneForm.title}
                  onChange={(e) => setMilestoneForm({ ...milestoneForm, title: e.target.value })}
                  placeholder="Ex: Entregar MVP"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Descrição</label>
                <Textarea
                  value={milestoneForm.description}
                  onChange={(e) => setMilestoneForm({ ...milestoneForm, description: e.target.value })}
                  placeholder="Descreva o marco..."
                  rows={2}
                />
              </div>
              <div>
                <label className="text-sm font-medium">Data de Entrega</label>
                <Input
                  type="date"
                  value={milestoneForm.due_date}
                  onChange={(e) => setMilestoneForm({ ...milestoneForm, due_date: e.target.value })}
                />
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <Button variant="outline" onClick={() => setShowMilestoneModal(false)}>
                  Cancelar
                </Button>
                <Button onClick={handleSaveMilestone}>Criar Marco</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </EMSLayout>
  );
};

export default Planning;
