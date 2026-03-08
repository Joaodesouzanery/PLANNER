import { useState, useEffect, useMemo } from "react";
import { useCompany } from "@/contexts/CompanyContext";
import { EMSLayout } from "@/components/ems/EMSLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { motion, AnimatePresence } from "framer-motion";
import {
  Target, Plus, Edit2, Trash2, Calendar, CheckCircle2, Clock,
  Flag, ChevronDown, ChevronRight, Milestone, TrendingUp, ListChecks,
  Zap, Rocket, Eye, BarChart3,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format, parseISO, isBefore, addMonths, addYears } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface OKR { id: string; title: string; }
interface Project { id: string; title: string; }

interface PlanningGoal {
  id: string; title: string; description: string | null; category: string;
  start_date: string | null; end_date: string | null; progress: number;
  status: string; parent_id: string | null; okr_id?: string | null;
  project_id?: string | null; order_index: number; created_at: string;
  milestones?: PlanningMilestone[];
  children?: PlanningGoal[];
}

interface PlanningMilestone {
  id: string; goal_id: string; title: string; description: string | null;
  due_date: string | null; completed: boolean; completed_at: string | null; order_index: number;
}

const categories = [
  { value: "strategic", label: "Estratégico", color: "bg-primary", icon: Target },
  { value: "operational", label: "Operacional", color: "bg-blue-500", icon: Zap },
  { value: "financial", label: "Financeiro", color: "bg-emerald-500", icon: BarChart3 },
  { value: "growth", label: "Crescimento", color: "bg-amber-500", icon: Rocket },
  { value: "team", label: "Equipe", color: "bg-purple-500", icon: ListChecks },
];

const statusOptions = [
  { value: "pending", label: "Pendente", color: "text-muted-foreground" },
  { value: "in_progress", label: "Em Andamento", color: "text-primary" },
  { value: "completed", label: "Concluído", color: "text-emerald-500" },
  { value: "on_hold", label: "Pausado", color: "text-amber-500" },
  { value: "cancelled", label: "Cancelado", color: "text-destructive" },
];

const horizonConfig = {
  short: { label: "Curto Prazo", sublabel: "0–3 meses", icon: Zap, color: "text-emerald-500", bg: "bg-emerald-500/10", border: "border-emerald-500/20" },
  medium: { label: "Médio Prazo", sublabel: "3–12 meses", icon: TrendingUp, color: "text-amber-500", bg: "bg-amber-500/10", border: "border-amber-500/20" },
  long: { label: "Longo Prazo", sublabel: "1–5 anos", icon: Rocket, color: "text-purple-500", bg: "bg-purple-500/10", border: "border-purple-500/20" },
};

const Planning = () => {
  const { toast } = useToast();
  const { selectedCompanyId } = useCompany();
  const [goals, setGoals] = useState<PlanningGoal[]>([]);
  const [milestones, setMilestones] = useState<PlanningMilestone[]>([]);
  const [loading, setLoading] = useState(true);
  const [showGoalModal, setShowGoalModal] = useState(false);
  const [showMilestoneModal, setShowMilestoneModal] = useState(false);
  const [editingGoal, setEditingGoal] = useState<PlanningGoal | null>(null);
  const [selectedGoalId, setSelectedGoalId] = useState<string | null>(null);
  const [expandedGoals, setExpandedGoals] = useState<Set<string>>(new Set());
  const [okrs, setOkrs] = useState<OKR[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeTab, setActiveTab] = useState("dashboard");
  const [goalForm, setGoalForm] = useState({
    title: "", description: "", category: "strategic", start_date: "", end_date: "",
    status: "pending", parent_id: "", okr_id: "", project_id: "",
  });
  const [milestoneForm, setMilestoneForm] = useState({ title: "", description: "", due_date: "" });

  const fetchOkrsAndProjects = async () => {
    const [okrsRes, projectsRes] = await Promise.all([
      supabase.from("okrs").select("id, title").order("title"),
      supabase.from("projects").select("id, title").order("title"),
    ]);
    if (okrsRes.data) setOkrs(okrsRes.data);
    if (projectsRes.data) setProjects(projectsRes.data);
  };

  useEffect(() => { fetchGoals(); fetchMilestones(); fetchOkrsAndProjects(); }, []);

  const fetchGoals = async () => {
    const { data } = await supabase.from("planning_goals").select("*").order("order_index");
    if (data) setGoals(data);
    setLoading(false);
  };

  const fetchMilestones = async () => {
    const { data } = await supabase.from("planning_milestones").select("*").order("order_index");
    if (data) setMilestones(data);
  };

  const handleSaveGoal = async () => {
    if (!goalForm.title.trim()) { toast({ title: "Erro", description: "Título é obrigatório", variant: "destructive" }); return; }
    const goalData = {
      title: goalForm.title, description: goalForm.description || null, category: goalForm.category,
      start_date: goalForm.start_date || null, end_date: goalForm.end_date || null,
      status: goalForm.status, parent_id: goalForm.parent_id || null,
    };
    if (editingGoal) {
      await supabase.from("planning_goals").update(goalData).eq("id", editingGoal.id);
      toast({ title: "Meta atualizada!" });
    } else {
      await supabase.from("planning_goals").insert(goalData);
      toast({ title: "Meta criada!" });
    }
    resetGoalForm(); fetchGoals();
  };

  const handleDeleteGoal = async (id: string) => {
    await supabase.from("planning_goals").delete().eq("id", id);
    toast({ title: "Meta excluída" }); fetchGoals();
  };

  const handleSaveMilestone = async () => {
    if (!milestoneForm.title.trim() || !selectedGoalId) return;
    await supabase.from("planning_milestones").insert({
      goal_id: selectedGoalId, title: milestoneForm.title,
      description: milestoneForm.description || null, due_date: milestoneForm.due_date || null,
    });
    toast({ title: "Marco criado!" });
    setMilestoneForm({ title: "", description: "", due_date: "" });
    setShowMilestoneModal(false); fetchMilestones(); updateGoalProgress(selectedGoalId);
  };

  const toggleMilestoneComplete = async (milestone: PlanningMilestone) => {
    await supabase.from("planning_milestones").update({
      completed: !milestone.completed, completed_at: !milestone.completed ? new Date().toISOString() : null,
    }).eq("id", milestone.id);
    fetchMilestones();
    if (milestone.goal_id) updateGoalProgress(milestone.goal_id);
  };

  const updateGoalProgress = async (goalId: string) => {
    const goalMilestones = milestones.filter(m => m.goal_id === goalId);
    if (goalMilestones.length === 0) return;
    const completed = goalMilestones.filter(m => m.completed).length;
    const progress = Math.round((completed / goalMilestones.length) * 100);
    await supabase.from("planning_goals").update({
      progress, status: progress === 100 ? "completed" : progress > 0 ? "in_progress" : "pending",
    }).eq("id", goalId);
    fetchGoals();
  };

  const deleteMilestone = async (id: string, goalId: string) => {
    await supabase.from("planning_milestones").delete().eq("id", id);
    toast({ title: "Marco excluído" }); fetchMilestones(); updateGoalProgress(goalId);
  };

  const resetGoalForm = () => {
    setGoalForm({ title: "", description: "", category: "strategic", start_date: "", end_date: "", status: "pending", parent_id: "", okr_id: "", project_id: "" });
    setEditingGoal(null); setShowGoalModal(false);
  };

  const toggleExpand = (goalId: string) => {
    const n = new Set(expandedGoals);
    n.has(goalId) ? n.delete(goalId) : n.add(goalId);
    setExpandedGoals(n);
  };

  const getGoalMilestones = (goalId: string) => milestones.filter(m => m.goal_id === goalId);
  const getRootGoals = () => goals.filter(g => !g.parent_id);
  const getChildGoals = (parentId: string) => goals.filter(g => g.parent_id === parentId);
  const getCategoryInfo = (category: string) => categories.find(c => c.value === category) || categories[0];
  const getStatusInfo = (status: string) => statusOptions.find(s => s.value === status) || statusOptions[0];

  // Determine horizon based on end_date
  const getHorizon = (goal: PlanningGoal): "short" | "medium" | "long" => {
    if (!goal.end_date) return "medium";
    const end = parseISO(goal.end_date);
    const now = new Date();
    const threeMonths = addMonths(now, 3);
    const oneYear = addYears(now, 1);
    if (isBefore(end, threeMonths)) return "short";
    if (isBefore(end, oneYear)) return "medium";
    return "long";
  };

  const goalsByHorizon = useMemo(() => {
    const root = getRootGoals();
    return {
      short: root.filter(g => getHorizon(g) === "short"),
      medium: root.filter(g => getHorizon(g) === "medium"),
      long: root.filter(g => getHorizon(g) === "long"),
    };
  }, [goals]);

  const stats = {
    total: goals.length,
    completed: goals.filter(g => g.status === "completed").length,
    inProgress: goals.filter(g => g.status === "in_progress").length,
    pending: goals.filter(g => g.status === "pending").length,
    avgProgress: goals.length > 0 ? Math.round(goals.reduce((a, g) => a + g.progress, 0) / goals.length) : 0,
  };

  const horizonStats = useMemo(() => ({
    short: { total: goalsByHorizon.short.length, avg: goalsByHorizon.short.length > 0 ? Math.round(goalsByHorizon.short.reduce((a, g) => a + g.progress, 0) / goalsByHorizon.short.length) : 0 },
    medium: { total: goalsByHorizon.medium.length, avg: goalsByHorizon.medium.length > 0 ? Math.round(goalsByHorizon.medium.reduce((a, g) => a + g.progress, 0) / goalsByHorizon.medium.length) : 0 },
    long: { total: goalsByHorizon.long.length, avg: goalsByHorizon.long.length > 0 ? Math.round(goalsByHorizon.long.reduce((a, g) => a + g.progress, 0) / goalsByHorizon.long.length) : 0 },
  }), [goalsByHorizon]);

  const openGoalModalForHorizon = (horizon: "short" | "medium" | "long") => {
    const now = new Date();
    let end_date = "";
    if (horizon === "short") end_date = format(addMonths(now, 2), "yyyy-MM-dd");
    else if (horizon === "medium") end_date = format(addMonths(now, 6), "yyyy-MM-dd");
    else end_date = format(addYears(now, 2), "yyyy-MM-dd");
    setGoalForm({ ...goalForm, start_date: format(now, "yyyy-MM-dd"), end_date, status: "pending" });
    setShowGoalModal(true);
  };

  const renderGoalCard = (goal: PlanningGoal, depth = 0) => {
    const categoryInfo = getCategoryInfo(goal.category);
    const statusInfo = getStatusInfo(goal.status);
    const goalMilestones = getGoalMilestones(goal.id);
    const childGoals = getChildGoals(goal.id);
    const hasChildren = childGoals.length > 0 || goalMilestones.length > 0;
    const isExpanded = expandedGoals.has(goal.id);

    return (
      <motion.div key={goal.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
        className={cn(depth > 0 && "ml-4 sm:ml-6 border-l-2 border-border pl-4")}>
        <Card className="mb-3 hover:border-primary/30 transition-colors">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              {hasChildren ? (
                <button onClick={() => toggleExpand(goal.id)} className="p-1 hover:bg-muted rounded mt-1">
                  {isExpanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                </button>
              ) : <div className="w-6" />}
              <div className={cn("w-1 h-12 rounded-full", categoryInfo.color)} />
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h4 className="font-medium text-foreground">{goal.title}</h4>
                    {goal.description && <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{goal.description}</p>}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Badge variant="outline" className="text-xs">{categoryInfo.label}</Badge>
                    <Badge variant="outline" className={cn("text-xs", statusInfo.color)}>{statusInfo.label}</Badge>
                  </div>
                </div>
                <div className="mt-3 flex items-center gap-4">
                  <div className="flex-1"><Progress value={goal.progress} className="h-2" /></div>
                  <span className="text-sm font-medium text-muted-foreground">{goal.progress}%</span>
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    {goal.start_date && <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />Início: {format(parseISO(goal.start_date), "dd/MM/yy")}</span>}
                    {goal.end_date && <span className="flex items-center gap-1"><Flag className="h-3 w-3" />Fim: {format(parseISO(goal.end_date), "dd/MM/yy")}</span>}
                    {goalMilestones.length > 0 && <span className="flex items-center gap-1"><Milestone className="h-3 w-3" />{goalMilestones.filter(m => m.completed).length}/{goalMilestones.length} marcos</span>}
                  </div>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setSelectedGoalId(goal.id); setShowMilestoneModal(true); }}><Plus className="h-3 w-3" /></Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => {
                      setEditingGoal(goal);
                      setGoalForm({ title: goal.title, description: goal.description || "", category: goal.category, start_date: goal.start_date || "", end_date: goal.end_date || "", status: goal.status, parent_id: goal.parent_id || "", okr_id: goal.okr_id || "", project_id: goal.project_id || "" });
                      setShowGoalModal(true);
                    }}><Edit2 className="h-3 w-3" /></Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDeleteGoal(goal.id)}><Trash2 className="h-3 w-3" /></Button>
                  </div>
                </div>
              </div>
            </div>
            <AnimatePresence>
              {isExpanded && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                  {goalMilestones.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-border">
                      <h5 className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-2"><Milestone className="h-4 w-4" />Marcos</h5>
                      <div className="space-y-2">
                        {goalMilestones.map(milestone => (
                          <div key={milestone.id} className="flex items-center gap-3 p-2 rounded-lg bg-muted/50">
                            <Checkbox checked={milestone.completed} onCheckedChange={() => toggleMilestoneComplete(milestone)} />
                            <div className="flex-1">
                              <span className={milestone.completed ? "line-through text-muted-foreground" : ""}>{milestone.title}</span>
                              {milestone.due_date && <span className="text-xs text-muted-foreground ml-2">• {format(parseISO(milestone.due_date), "dd/MM/yy")}</span>}
                            </div>
                            <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => deleteMilestone(milestone.id, goal.id)}><Trash2 className="h-3 w-3" /></Button>
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
        {isExpanded && childGoals.map(child => renderGoalCard(child, depth + 1))}
      </motion.div>
    );
  };

  const renderHorizonSection = (horizonKey: "short" | "medium" | "long") => {
    const config = horizonConfig[horizonKey];
    const horizonGoals = goalsByHorizon[horizonKey];
    const hs = horizonStats[horizonKey];
    const Icon = config.icon;

    return (
      <div className="space-y-4">
        {/* Horizon Summary */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <Card className={cn("border", config.border)}>
            <CardContent className="p-4 flex items-center gap-3">
              <div className={cn("p-2 rounded-lg", config.bg)}><Icon className={cn("h-5 w-5", config.color)} /></div>
              <div><p className="text-2xl font-bold">{hs.total}</p><p className="text-xs text-muted-foreground">Metas</p></div>
            </CardContent>
          </Card>
          <Card className={cn("border", config.border)}>
            <CardContent className="p-4 flex items-center gap-3">
              <div className={cn("p-2 rounded-lg", config.bg)}><TrendingUp className={cn("h-5 w-5", config.color)} /></div>
              <div><p className="text-2xl font-bold">{hs.avg}%</p><p className="text-xs text-muted-foreground">Progresso Médio</p></div>
            </CardContent>
          </Card>
          <Card className={cn("border", config.border, "col-span-2 sm:col-span-1")}>
            <CardContent className="p-4 flex items-center gap-3">
              <div className={cn("p-2 rounded-lg", config.bg)}><CheckCircle2 className={cn("h-5 w-5", config.color)} /></div>
              <div><p className="text-2xl font-bold">{horizonGoals.filter(g => g.status === "completed").length}</p><p className="text-xs text-muted-foreground">Concluídas</p></div>
            </CardContent>
          </Card>
        </div>

        <div className="flex justify-end">
          <Button size="sm" onClick={() => openGoalModalForHorizon(horizonKey)}><Plus className="h-4 w-4 mr-1" />Nova Meta</Button>
        </div>

        {horizonGoals.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="py-12 text-center">
              <Icon className={cn("h-10 w-10 mx-auto mb-3", config.color, "opacity-50")} />
              <p className="text-muted-foreground">Nenhuma meta de {config.label.toLowerCase()} ainda</p>
              <p className="text-xs text-muted-foreground mt-1">{config.sublabel}</p>
              <Button className="mt-4" size="sm" variant="outline" onClick={() => openGoalModalForHorizon(horizonKey)}>
                <Plus className="h-4 w-4 mr-1" />Criar Meta
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">{horizonGoals.map(g => renderGoalCard(g))}</div>
        )}
      </div>
    );
  };

  return (
    <EMSLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-heading font-bold text-foreground">Planejamento</h1>
            <p className="text-muted-foreground mt-1">Plano de curto, médio e longo prazo</p>
          </div>
          <Button onClick={() => setShowGoalModal(true)}><Plus className="h-4 w-4 mr-2" />Nova Meta</Button>
        </div>

        {/* Dashboard Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {[
            { label: "Total", value: stats.total, icon: Target, color: "text-primary", bg: "bg-primary/10" },
            { label: "Concluídas", value: stats.completed, icon: CheckCircle2, color: "text-emerald-500", bg: "bg-emerald-500/10" },
            { label: "Em Andamento", value: stats.inProgress, icon: TrendingUp, color: "text-blue-500", bg: "bg-blue-500/10" },
            { label: "Pendentes", value: stats.pending, icon: Clock, color: "text-amber-500", bg: "bg-amber-500/10" },
            { label: "Progresso", value: `${stats.avgProgress}%`, icon: ListChecks, color: "text-purple-500", bg: "bg-purple-500/10" },
          ].map(s => (
            <Card key={s.label}>
              <CardContent className="p-4 flex items-center gap-3">
                <div className={cn("p-2 rounded-lg", s.bg)}><s.icon className={cn("h-5 w-5", s.color)} /></div>
                <div><p className="text-2xl font-bold">{s.value}</p><p className="text-xs text-muted-foreground">{s.label}</p></div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Horizon Overview Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {(["short", "medium", "long"] as const).map(h => {
            const config = horizonConfig[h];
            const hs = horizonStats[h];
            const Icon = config.icon;
            return (
              <Card key={h} className={cn("border cursor-pointer hover:shadow-md transition-all", config.border)}
                onClick={() => setActiveTab(h)}>
                <CardContent className="p-5">
                  <div className="flex items-center gap-3 mb-3">
                    <div className={cn("p-2.5 rounded-xl", config.bg)}><Icon className={cn("h-6 w-6", config.color)} /></div>
                    <div>
                      <h3 className="font-semibold">{config.label}</h3>
                      <p className="text-xs text-muted-foreground">{config.sublabel}</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-sm text-muted-foreground">{hs.total} metas</span>
                    <span className={cn("text-sm font-bold", config.color)}>{hs.avg}%</span>
                  </div>
                  <Progress value={hs.avg} className="h-2 mt-2" />
                </CardContent>
              </Card>
            );
          })}
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-6">
            <TabsTrigger value="dashboard" className="gap-1"><Eye className="h-4 w-4" /><span className="hidden sm:inline">Visão Geral</span></TabsTrigger>
            <TabsTrigger value="short" className="gap-1"><Zap className="h-4 w-4" /><span className="hidden sm:inline">Curto</span></TabsTrigger>
            <TabsTrigger value="medium" className="gap-1"><TrendingUp className="h-4 w-4" /><span className="hidden sm:inline">Médio</span></TabsTrigger>
            <TabsTrigger value="long" className="gap-1"><Rocket className="h-4 w-4" /><span className="hidden sm:inline">Longo</span></TabsTrigger>
            <TabsTrigger value="by-category" className="gap-1"><BarChart3 className="h-4 w-4" /><span className="hidden sm:inline">Categorias</span></TabsTrigger>
            <TabsTrigger value="timeline" className="gap-1"><Calendar className="h-4 w-4" /><span className="hidden sm:inline">Timeline</span></TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard" className="mt-4">
            {loading ? (
              <div className="space-y-4">{[...Array(3)].map((_, i) => <Card key={i} className="animate-pulse"><CardContent className="p-4"><div className="h-20 bg-muted rounded" /></CardContent></Card>)}</div>
            ) : getRootGoals().length === 0 ? (
              <Card><CardContent className="p-12 text-center">
                <Target className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium">Nenhuma meta cadastrada</h3>
                <p className="text-muted-foreground mt-1">Comece criando sua primeira meta estratégica</p>
                <Button className="mt-4" onClick={() => setShowGoalModal(true)}><Plus className="h-4 w-4 mr-2" />Criar Meta</Button>
              </CardContent></Card>
            ) : (
              <div className="space-y-2">{getRootGoals().map(g => renderGoalCard(g))}</div>
            )}
          </TabsContent>

          <TabsContent value="short" className="mt-4">{renderHorizonSection("short")}</TabsContent>
          <TabsContent value="medium" className="mt-4">{renderHorizonSection("medium")}</TabsContent>
          <TabsContent value="long" className="mt-4">{renderHorizonSection("long")}</TabsContent>

          <TabsContent value="by-category" className="mt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {categories.map(cat => {
                const catGoals = goals.filter(g => g.category === cat.value);
                const CatIcon = cat.icon;
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
                              <span className="text-xs text-muted-foreground ml-2">{g.progress}%</span>
                            </div>
                          ))}
                          {catGoals.length > 5 && <p className="text-xs text-muted-foreground text-center">+{catGoals.length - 5} mais</p>}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </TabsContent>

          <TabsContent value="timeline" className="mt-4">
            <Card><CardContent className="p-6">
              <div className="relative">
                <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-border" />
                <div className="space-y-6">
                  {goals.filter(g => g.end_date).sort((a, b) => new Date(a.end_date!).getTime() - new Date(b.end_date!).getTime()).map((goal, index) => {
                    const categoryInfo = getCategoryInfo(goal.category);
                    const isPast = goal.end_date && isBefore(parseISO(goal.end_date), new Date());
                    const horizon = getHorizon(goal);
                    const hConfig = horizonConfig[horizon];
                    return (
                      <motion.div key={goal.id} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: index * 0.05 }} className="relative pl-10">
                        <div className={cn("absolute left-2 w-5 h-5 rounded-full border-2 border-background",
                          goal.status === "completed" ? "bg-emerald-500" : isPast ? "bg-destructive" : categoryInfo.color)} />
                        <div className="bg-card border border-border rounded-lg p-4">
                          <div className="flex items-start justify-between">
                            <div>
                              <div className="flex items-center gap-2">
                                <h4 className="font-medium">{goal.title}</h4>
                                <Badge variant="outline" className={cn("text-[10px]", hConfig.color)}>{hConfig.label}</Badge>
                              </div>
                              <p className="text-sm text-muted-foreground mt-1">{goal.end_date && format(parseISO(goal.end_date), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}</p>
                            </div>
                            <Badge variant="outline" className={getStatusInfo(goal.status).color}>{getStatusInfo(goal.status).label}</Badge>
                          </div>
                          <Progress value={goal.progress} className="h-1.5 mt-3" />
                        </div>
                      </motion.div>
                    );
                  })}
                  {goals.filter(g => g.end_date).length === 0 && <p className="text-muted-foreground text-center py-8">Adicione datas de término às metas para visualizar a timeline</p>}
                </div>
              </div>
            </CardContent></Card>
          </TabsContent>
        </Tabs>

        {/* Goal Modal */}
        <Dialog open={showGoalModal} onOpenChange={open => !open && resetGoalForm()}>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>{editingGoal ? "Editar Meta" : "Nova Meta"}</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div><label className="text-sm font-medium">Título *</label><Input value={goalForm.title} onChange={e => setGoalForm({ ...goalForm, title: e.target.value })} placeholder="Ex: Aumentar receita em 30%" /></div>
              <div><label className="text-sm font-medium">Descrição</label><Textarea value={goalForm.description} onChange={e => setGoalForm({ ...goalForm, description: e.target.value })} placeholder="Descreva a meta..." rows={3} /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="text-sm font-medium">Categoria</label>
                  <Select value={goalForm.category} onValueChange={v => setGoalForm({ ...goalForm, category: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{categories.map(c => <SelectItem key={c.value} value={c.value}><div className="flex items-center gap-2"><div className={cn("w-2 h-2 rounded-full", c.color)} />{c.label}</div></SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><label className="text-sm font-medium">Status</label>
                  <Select value={goalForm.status} onValueChange={v => setGoalForm({ ...goalForm, status: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{statusOptions.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="text-sm font-medium">Data de Início</label><Input type="date" value={goalForm.start_date} onChange={e => setGoalForm({ ...goalForm, start_date: e.target.value })} /></div>
                <div><label className="text-sm font-medium">Data de Término</label><Input type="date" value={goalForm.end_date} onChange={e => setGoalForm({ ...goalForm, end_date: e.target.value })} /></div>
              </div>
              <div><label className="text-sm font-medium">Meta Pai (opcional)</label>
                <Select value={goalForm.parent_id || "none"} onValueChange={v => setGoalForm({ ...goalForm, parent_id: v === "none" ? "" : v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione uma meta pai" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhuma (meta raiz)</SelectItem>
                    {goals.filter(g => g.id !== editingGoal?.id).map(g => <SelectItem key={g.id} value={g.id}>{g.title}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="text-sm font-medium">OKR Vinculado</label>
                  <Select value={goalForm.okr_id || "none"} onValueChange={v => setGoalForm({ ...goalForm, okr_id: v === "none" ? "" : v })}>
                    <SelectTrigger><SelectValue placeholder="Nenhum" /></SelectTrigger>
                    <SelectContent><SelectItem value="none">Nenhum</SelectItem>{okrs.map(o => <SelectItem key={o.id} value={o.id}>{o.title}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><label className="text-sm font-medium">Projeto Vinculado</label>
                  <Select value={goalForm.project_id || "none"} onValueChange={v => setGoalForm({ ...goalForm, project_id: v === "none" ? "" : v })}>
                    <SelectTrigger><SelectValue placeholder="Nenhum" /></SelectTrigger>
                    <SelectContent><SelectItem value="none">Nenhum</SelectItem>{projects.map(p => <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <Button variant="outline" onClick={resetGoalForm}>Cancelar</Button>
                <Button onClick={handleSaveGoal}>{editingGoal ? "Salvar" : "Criar Meta"}</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Milestone Modal */}
        <Dialog open={showMilestoneModal} onOpenChange={setShowMilestoneModal}>
          <DialogContent>
            <DialogHeader><DialogTitle>Novo Marco</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div><label className="text-sm font-medium">Título *</label><Input value={milestoneForm.title} onChange={e => setMilestoneForm({ ...milestoneForm, title: e.target.value })} placeholder="Ex: Entregar MVP" /></div>
              <div><label className="text-sm font-medium">Descrição</label><Textarea value={milestoneForm.description} onChange={e => setMilestoneForm({ ...milestoneForm, description: e.target.value })} rows={2} /></div>
              <div><label className="text-sm font-medium">Data de Vencimento</label><Input type="date" value={milestoneForm.due_date} onChange={e => setMilestoneForm({ ...milestoneForm, due_date: e.target.value })} /></div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setShowMilestoneModal(false)}>Cancelar</Button>
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
