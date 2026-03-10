import { useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCompany } from "@/contexts/CompanyContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { parseISO, isBefore, addMonths, addYears } from "date-fns";

export interface PlanningGoal {
  id: string; title: string; description: string | null; category: string;
  start_date: string | null; end_date: string | null; progress: number;
  status: string; parent_id: string | null; order_index: number; created_at: string;
  company_id?: string | null; user_id?: string | null;
}

export interface PlanningMilestone {
  id: string; goal_id: string; title: string; description: string | null;
  due_date: string | null; completed: boolean; completed_at: string | null; order_index: number;
}

export type Horizon = "short" | "medium" | "long";

export interface GoalFormData {
  title: string; description: string; category: string; start_date: string;
  end_date: string; status: string; parent_id: string; okr_id: string; project_id: string;
}

export interface MilestoneFormData {
  title: string; description: string; due_date: string;
}

export const categories = [
  { value: "strategic", label: "Estratégico", color: "bg-primary", icon: "Target" },
  { value: "operational", label: "Operacional", color: "bg-blue-500", icon: "Zap" },
  { value: "financial", label: "Financeiro", color: "bg-emerald-500", icon: "BarChart3" },
  { value: "growth", label: "Crescimento", color: "bg-amber-500", icon: "Rocket" },
  { value: "team", label: "Equipe", color: "bg-purple-500", icon: "ListChecks" },
];

export const statusOptions = [
  { value: "pending", label: "Pendente", color: "text-muted-foreground" },
  { value: "in_progress", label: "Em Andamento", color: "text-primary" },
  { value: "completed", label: "Concluído", color: "text-emerald-500" },
  { value: "on_hold", label: "Pausado", color: "text-amber-500" },
  { value: "cancelled", label: "Cancelado", color: "text-destructive" },
];

export const horizonConfig = {
  short: { label: "Curto Prazo", sublabel: "0–3 meses", color: "text-emerald-500", bg: "bg-emerald-500/10", border: "border-emerald-500/20" },
  medium: { label: "Médio Prazo", sublabel: "3–12 meses", color: "text-amber-500", bg: "bg-amber-500/10", border: "border-amber-500/20" },
  long: { label: "Longo Prazo", sublabel: "1–5 anos", color: "text-purple-500", bg: "bg-purple-500/10", border: "border-purple-500/20" },
};

export const getHorizon = (goal: PlanningGoal): Horizon => {
  if (!goal.end_date) return "medium";
  const end = parseISO(goal.end_date);
  const now = new Date();
  if (isBefore(end, addMonths(now, 3))) return "short";
  if (isBefore(end, addYears(now, 1))) return "medium";
  return "long";
};

export const getCategoryInfo = (category: string) =>
  categories.find(c => c.value === category) || categories[0];

export const getStatusInfo = (status: string) =>
  statusOptions.find(s => s.value === status) || statusOptions[0];

export function usePlanningData() {
  const { selectedCompanyId } = useCompany();
  const { toast } = useToast();
  const qc = useQueryClient();

  const goalsQuery = useQuery({
    queryKey: ["planning_goals", selectedCompanyId],
    queryFn: async () => {
      let q = supabase.from("planning_goals").select("*").order("order_index");
      if (selectedCompanyId !== "all") q = q.eq("company_id", selectedCompanyId);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as PlanningGoal[];
    },
  });

  const milestonesQuery = useQuery({
    queryKey: ["planning_milestones", selectedCompanyId],
    queryFn: async () => {
      let q = supabase.from("planning_milestones").select("*").order("order_index");
      if (selectedCompanyId !== "all") q = q.eq("company_id", selectedCompanyId);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as PlanningMilestone[];
    },
  });

  const okrsQuery = useQuery({
    queryKey: ["okrs_list"],
    queryFn: async () => {
      const { data } = await supabase.from("okrs").select("id, title").order("title");
      return data ?? [];
    },
    staleTime: 60_000,
  });

  const projectsQuery = useQuery({
    queryKey: ["projects_list"],
    queryFn: async () => {
      const { data } = await supabase.from("projects").select("id, title").order("title");
      return data ?? [];
    },
    staleTime: 60_000,
  });

  const goals = goalsQuery.data ?? [];
  const milestones = milestonesQuery.data ?? [];

  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: ["planning_goals"] });
    qc.invalidateQueries({ queryKey: ["planning_milestones"] });
  };

  const saveGoalMutation = useMutation({
    mutationFn: async ({ form, editId }: { form: GoalFormData; editId?: string }) => {
      const goalData = {
        title: form.title, description: form.description || null, category: form.category,
        start_date: form.start_date || null, end_date: form.end_date || null,
        status: form.status, parent_id: form.parent_id || null,
      };
      if (editId) {
        const { error } = await supabase.from("planning_goals").update(goalData).eq("id", editId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("planning_goals").insert(goalData);
        if (error) throw error;
      }
    },
    onSuccess: (_, { editId }) => {
      toast({ title: editId ? "Meta atualizada!" : "Meta criada!" });
      invalidateAll();
    },
    onError: () => toast({ title: "Erro ao salvar meta", variant: "destructive" }),
  });

  const deleteGoalMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("planning_goals").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast({ title: "Meta excluída" }); invalidateAll(); },
  });

  const saveMilestoneMutation = useMutation({
    mutationFn: async ({ form, goalId }: { form: MilestoneFormData; goalId: string }) => {
      const { error } = await supabase.from("planning_milestones").insert({
        goal_id: goalId, title: form.title,
        description: form.description || null, due_date: form.due_date || null,
      });
      if (error) throw error;
      // recalc progress
      const ms = [...milestones.filter(m => m.goal_id === goalId), { completed: false } as any];
      const completed = ms.filter(m => m.completed).length;
      const progress = Math.round((completed / ms.length) * 100);
      await supabase.from("planning_goals").update({ progress, status: progress === 100 ? "completed" : progress > 0 ? "in_progress" : "pending" }).eq("id", goalId);
    },
    onSuccess: () => { toast({ title: "Marco criado!" }); invalidateAll(); },
  });

  const toggleMilestoneMutation = useMutation({
    mutationFn: async (milestone: PlanningMilestone) => {
      const newCompleted = !milestone.completed;
      await supabase.from("planning_milestones").update({
        completed: newCompleted, completed_at: newCompleted ? new Date().toISOString() : null,
      }).eq("id", milestone.id);
      // recalc
      const goalMs = milestones.filter(m => m.goal_id === milestone.goal_id);
      const completedCount = goalMs.filter(m => m.id === milestone.id ? newCompleted : m.completed).length;
      const progress = Math.round((completedCount / goalMs.length) * 100);
      await supabase.from("planning_goals").update({ progress, status: progress === 100 ? "completed" : progress > 0 ? "in_progress" : "pending" }).eq("id", milestone.goal_id);
    },
    onSuccess: () => invalidateAll(),
  });

  const deleteMilestoneMutation = useMutation({
    mutationFn: async ({ id, goalId }: { id: string; goalId: string }) => {
      await supabase.from("planning_milestones").delete().eq("id", id);
      const goalMs = milestones.filter(m => m.goal_id === goalId && m.id !== id);
      const completedCount = goalMs.filter(m => m.completed).length;
      const progress = goalMs.length > 0 ? Math.round((completedCount / goalMs.length) * 100) : 0;
      await supabase.from("planning_goals").update({ progress, status: progress === 100 ? "completed" : progress > 0 ? "in_progress" : "pending" }).eq("id", goalId);
    },
    onSuccess: () => { toast({ title: "Marco excluído" }); invalidateAll(); },
  });

  // Derived data
  const rootGoals = useMemo(() => goals.filter(g => !g.parent_id), [goals]);
  const getChildGoals = (parentId: string) => goals.filter(g => g.parent_id === parentId);
  const getGoalMilestones = (goalId: string) => milestones.filter(m => m.goal_id === goalId);

  const goalsByHorizon = useMemo(() => ({
    short: rootGoals.filter(g => getHorizon(g) === "short"),
    medium: rootGoals.filter(g => getHorizon(g) === "medium"),
    long: rootGoals.filter(g => getHorizon(g) === "long"),
  }), [rootGoals]);

  const stats = useMemo(() => ({
    total: goals.length,
    completed: goals.filter(g => g.status === "completed").length,
    inProgress: goals.filter(g => g.status === "in_progress").length,
    pending: goals.filter(g => g.status === "pending").length,
    avgProgress: goals.length > 0 ? Math.round(goals.reduce((a, g) => a + g.progress, 0) / goals.length) : 0,
  }), [goals]);

  const horizonStats = useMemo(() => {
    const calc = (arr: PlanningGoal[]) => ({
      total: arr.length,
      avg: arr.length > 0 ? Math.round(arr.reduce((a, g) => a + g.progress, 0) / arr.length) : 0,
      completed: arr.filter(g => g.status === "completed").length,
    });
    return { short: calc(goalsByHorizon.short), medium: calc(goalsByHorizon.medium), long: calc(goalsByHorizon.long) };
  }, [goalsByHorizon]);

  return {
    goals, milestones, rootGoals, goalsByHorizon, stats, horizonStats,
    isLoading: goalsQuery.isLoading || milestonesQuery.isLoading,
    okrs: okrsQuery.data ?? [], projects: projectsQuery.data ?? [],
    getChildGoals, getGoalMilestones,
    saveGoal: saveGoalMutation.mutateAsync,
    deleteGoal: deleteGoalMutation.mutateAsync,
    saveMilestone: saveMilestoneMutation.mutateAsync,
    toggleMilestone: toggleMilestoneMutation.mutateAsync,
    deleteMilestone: deleteMilestoneMutation.mutateAsync,
    isSaving: saveGoalMutation.isPending || saveMilestoneMutation.isPending,
  };
}
