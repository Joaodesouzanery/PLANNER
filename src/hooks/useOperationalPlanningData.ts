import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCompany } from "@/contexts/CompanyContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export type Confidence = "high" | "medium" | "low";
export type HorizonKey = "h1" | "h2" | "h3";

export interface NorthMetric {
  id: string;
  project_id: string | null;
  metric_name: string;
  product_area: string | null;
  current_value: number | null;
  quarter_target: number | null;
  unit: string | null;
  history_note: string | null;
  change_reason: string | null;
  levers: string | null;
}

export interface Okr {
  id: string;
  title: string;
  description: string | null;
  target_value: number;
  current_value: number;
  unit: string | null;
  period: string | null;
  start_date: string | null;
  end_date: string | null;
}

export interface KeyResult {
  id: string;
  okr_id: string | null;
  title: string;
  target_value: number | null;
  current_value: number | null;
  unit: string | null;
  confidence: Confidence | string | null;
  owner: string | null;
  cycle: string | null;
  project_id: string | null;
  not_doing: string | null;
  learning: string | null;
  retrospective: string | null;
}

export interface PlanningAssumption {
  id: string;
  project_id: string | null;
  assumption: string;
  product_area: string | null;
  criticality: string | null;
  test_plan: string | null;
  status: string | null;
  learning: string | null;
  plan_impact: string | null;
}

export interface PlanningRisk {
  id: string;
  project_id: string | null;
  risk: string;
  product_area: string | null;
  probability: string | null;
  impact: string | null;
  score: number | null;
  mitigation: string | null;
  contingency_plan: string | null;
  owner: string | null;
  status: string | null;
}

export interface TimeAllocation {
  id: string;
  week_start: string;
  category: string;
  product_area: string | null;
  project_id: string | null;
  horizon: HorizonKey | string | null;
  planned_hours: number | null;
  actual_hours: number | null;
  notes: string | null;
}

export interface DecisionLog {
  id: string;
  project_id: string | null;
  title: string;
  context: string | null;
  options_considered: string | null;
  decision: string | null;
  expected_result: string | null;
  review_date: string | null;
  outcome: string | null;
  category: string | null;
  tags: string[] | null;
  decision_criteria: string | null;
  involved_people: string | null;
  result: string | null;
  created_at: string;
}

export interface FinancialImpact {
  id: string;
  project_id: string | null;
  okr_id: string | null;
  goal_id: string | null;
  key_result_id: string | null;
  title: string;
  impact_type: "revenue" | "cost" | "cash" | "margin" | string;
  expected_amount: number | null;
  expected_date: string | null;
  confidence: Confidence | string | null;
  status: string | null;
  notes: string | null;
}

export interface ReviewCycle {
  id: string;
  project_id: string | null;
  cycle_type: string;
  period_start: string;
  period_end: string;
  agenda: string | null;
  summary: string | null;
  decisions: string | null;
  next_actions: string | null;
  created_at: string;
}

export interface ProjectLite {
  id: string;
  title: string;
}

const missingTable = (error: any) =>
  error?.code === "42P01" || error?.code === "PGRST205" || String(error?.message || "").includes("Could not find the table");

const num = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const nullableId = (value: unknown) => value && value !== "none" ? value : null;

export const operationalDefaults = {
  northMetric: { metric_name: "", product_area: "", current_value: "", quarter_target: "", unit: "", history_note: "", change_reason: "", levers: "", project_id: "none" },
  okr: { title: "", description: "", target_value: "", current_value: "", unit: "", period: "", start_date: "", end_date: "" },
  keyResult: { okr_id: "", title: "", target_value: "", current_value: "", unit: "", confidence: "medium", owner: "", cycle: "", project_id: "none", not_doing: "", learning: "", retrospective: "" },
  assumption: { assumption: "", product_area: "", criticality: "medium", test_plan: "", status: "not_tested", learning: "", plan_impact: "", project_id: "none" },
  risk: { risk: "", product_area: "", probability: "medium", impact: "medium", mitigation: "", contingency_plan: "", owner: "", status: "open", project_id: "none" },
  time: { week_start: new Date().toISOString().slice(0, 10), category: "produto", product_area: "", project_id: "none", horizon: "h1", planned_hours: "", actual_hours: "", notes: "" },
  decision: { title: "", context: "", options_considered: "", decision: "", expected_result: "", review_date: "", outcome: "", category: "Produto", tags: "", decision_criteria: "", involved_people: "", result: "", project_id: "none" },
  financialImpact: { title: "", impact_type: "revenue", expected_amount: "", expected_date: "", confidence: "medium", status: "planned", notes: "", project_id: "none", okr_id: "none", goal_id: "none", key_result_id: "none" },
  review: { cycle_type: "weekly", period_start: new Date().toISOString().slice(0, 10), period_end: new Date().toISOString().slice(0, 10), agenda: "", summary: "", decisions: "", next_actions: "", project_id: "none" },
};

export const scoreLabel = (value?: string | null) => value === "high" ? "Alta" : value === "low" ? "Baixa" : "Media";

export function useOperationalPlanningData() {
  const { selectedCompanyId } = useCompany();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const companyId = selectedCompanyId !== "all" ? selectedCompanyId : null;

  const scoped = (query: any) => companyId ? query.eq("company_id", companyId) : query;
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["operational-planning"] });
    queryClient.invalidateQueries({ queryKey: ["planning_goals"] });
    queryClient.invalidateQueries({ queryKey: ["finance-okrs"] });
  };

  const listQuery = <T,>(key: string, table: string, order = "created_at", ascending = false) => useQuery({
    queryKey: ["operational-planning", key, selectedCompanyId],
    queryFn: async () => {
      const { data, error } = await scoped((supabase as any).from(table).select("*").order(order, { ascending }));
      if (missingTable(error)) return [] as T[];
      if (error) throw error;
      return (data || []) as T[];
    },
    retry: false,
  });

  const northMetricsQuery = listQuery<NorthMetric>("north-metrics", "planning_north_metrics");
  const keyResultsQuery = listQuery<KeyResult>("key-results", "okr_key_results");
  const assumptionsQuery = listQuery<PlanningAssumption>("assumptions", "planning_assumptions");
  const risksQuery = listQuery<PlanningRisk>("risks", "planning_risks", "score");
  const timeQuery = listQuery<TimeAllocation>("time", "planning_time_allocations", "week_start");
  const decisionsQuery = listQuery<DecisionLog>("decisions", "decision_logs");
  const financialImpactsQuery = listQuery<FinancialImpact>("financial-impacts", "planning_financial_impacts", "expected_date");
  const reviewsQuery = listQuery<ReviewCycle>("reviews", "review_cycles", "period_start");

  const okrsQuery = useQuery({
    queryKey: ["operational-planning", "okrs", selectedCompanyId],
    queryFn: async () => {
      let query = supabase.from("okrs").select("*").order("created_at", { ascending: false });
      if (companyId) query = query.eq("company_id", companyId);
      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as Okr[];
    },
  });

  const projectsQuery = useQuery({
    queryKey: ["operational-planning", "projects", selectedCompanyId],
    queryFn: async () => {
      let query = supabase.from("projects").select("id,title").order("title");
      if (companyId) query = query.eq("company_id", companyId);
      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as ProjectLite[];
    },
  });

  const saveRecord = useMutation({
    mutationFn: async ({ table, payload, id }: { table: string; payload: Record<string, any>; id?: string | null }) => {
      const body = { ...payload, company_id: companyId };
      const query = (supabase as any).from(table);
      const { error } = id ? await query.update(body).eq("id", id) : await query.insert(body);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast({ title: "Registro salvo" });
    },
    onError: (error: any) => toast({ title: "Erro ao salvar", description: error?.message, variant: "destructive" }),
  });

  const deleteRecord = useMutation({
    mutationFn: async ({ table, id }: { table: string; id: string }) => {
      const { error } = await (supabase as any).from(table).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast({ title: "Registro excluido" });
    },
    onError: (error: any) => toast({ title: "Erro ao excluir", description: error?.message, variant: "destructive" }),
  });

  const saveOkr = async (form: Record<string, any>, id?: string | null) => saveRecord.mutateAsync({
    table: "okrs",
    id,
    payload: {
      title: form.title,
      description: form.description || null,
      target_value: num(form.target_value),
      current_value: num(form.current_value),
      unit: form.unit || null,
      period: form.period || null,
      start_date: form.start_date || null,
      end_date: form.end_date || null,
    },
  });

  const saveKeyResult = async (form: Record<string, any>, id?: string | null) => saveRecord.mutateAsync({
    table: "okr_key_results",
    id,
    payload: {
      okr_id: form.okr_id || null,
      title: form.title,
      target_value: num(form.target_value),
      current_value: num(form.current_value),
      unit: form.unit || null,
      confidence: form.confidence || "medium",
      owner: form.owner || null,
      cycle: form.cycle || null,
      project_id: nullableId(form.project_id),
      not_doing: form.not_doing || null,
      learning: form.learning || null,
      retrospective: form.retrospective || null,
    },
  });

  const saveNorthMetric = async (form: Record<string, any>, id?: string | null) => saveRecord.mutateAsync({
    table: "planning_north_metrics",
    id,
    payload: {
      metric_name: form.metric_name,
      product_area: form.product_area || null,
      current_value: num(form.current_value),
      quarter_target: num(form.quarter_target),
      unit: form.unit || null,
      history_note: form.history_note || null,
      change_reason: form.change_reason || null,
      levers: form.levers || null,
      project_id: nullableId(form.project_id),
    },
  });

  const saveAssumption = async (form: Record<string, any>, id?: string | null) => saveRecord.mutateAsync({
    table: "planning_assumptions",
    id,
    payload: {
      assumption: form.assumption,
      product_area: form.product_area || null,
      criticality: form.criticality || "medium",
      test_plan: form.test_plan || null,
      status: form.status || "not_tested",
      learning: form.learning || null,
      plan_impact: form.plan_impact || null,
      project_id: nullableId(form.project_id),
    },
  });

  const saveRisk = async (form: Record<string, any>, id?: string | null) => saveRecord.mutateAsync({
    table: "planning_risks",
    id,
    payload: {
      risk: form.risk,
      product_area: form.product_area || null,
      probability: form.probability || "medium",
      impact: form.impact || "medium",
      mitigation: form.mitigation || null,
      contingency_plan: form.contingency_plan || null,
      owner: form.owner || null,
      status: form.status || "open",
      project_id: nullableId(form.project_id),
    },
  });

  const saveTime = async (form: Record<string, any>, id?: string | null) => saveRecord.mutateAsync({
    table: "planning_time_allocations",
    id,
    payload: {
      week_start: form.week_start,
      category: form.category,
      product_area: form.product_area || null,
      project_id: nullableId(form.project_id),
      horizon: form.horizon || "h1",
      planned_hours: num(form.planned_hours),
      actual_hours: num(form.actual_hours),
      notes: form.notes || null,
    },
  });

  const saveDecision = async (form: Record<string, any>, id?: string | null) => saveRecord.mutateAsync({
    table: "decision_logs",
    id,
    payload: {
      title: form.title,
      context: form.context || null,
      options_considered: form.options_considered || null,
      decision: form.decision || null,
      expected_result: form.expected_result || null,
      review_date: form.review_date || null,
      outcome: form.outcome || null,
      category: form.category || null,
      tags: String(form.tags || "").split(",").map((tag) => tag.trim()).filter(Boolean),
      decision_criteria: form.decision_criteria || null,
      involved_people: form.involved_people || null,
      result: form.result || null,
      project_id: nullableId(form.project_id),
    },
  });

  const saveFinancialImpact = async (form: Record<string, any>, id?: string | null) => saveRecord.mutateAsync({
    table: "planning_financial_impacts",
    id,
    payload: {
      title: form.title,
      impact_type: form.impact_type || "revenue",
      expected_amount: num(form.expected_amount),
      expected_date: form.expected_date || null,
      confidence: form.confidence || "medium",
      status: form.status || "planned",
      notes: form.notes || null,
      project_id: nullableId(form.project_id),
      okr_id: nullableId(form.okr_id),
      goal_id: nullableId(form.goal_id),
      key_result_id: nullableId(form.key_result_id),
    },
  });

  const saveReview = async (form: Record<string, any>, id?: string | null) => saveRecord.mutateAsync({
    table: "review_cycles",
    id,
    payload: {
      cycle_type: form.cycle_type,
      period_start: form.period_start,
      period_end: form.period_end,
      agenda: form.agenda || null,
      summary: form.summary || null,
      decisions: form.decisions || null,
      next_actions: form.next_actions || null,
      project_id: nullableId(form.project_id),
    },
  });

  const krByOkr = useMemo(() => {
    const map: Record<string, KeyResult[]> = {};
    (keyResultsQuery.data || []).forEach((kr) => {
      const key = kr.okr_id || "__none";
      map[key] = [...(map[key] || []), kr];
    });
    return map;
  }, [keyResultsQuery.data]);

  const timeTotals = useMemo(() => {
    const rows = timeQuery.data || [];
    return rows.reduce((acc, item) => {
      acc.planned += num(item.planned_hours);
      acc.actual += num(item.actual_hours);
      acc.byCategory[item.category] = (acc.byCategory[item.category] || 0) + num(item.actual_hours);
      acc.byHorizon[item.horizon || "h1"] = (acc.byHorizon[item.horizon || "h1"] || 0) + num(item.actual_hours);
      return acc;
    }, { planned: 0, actual: 0, byCategory: {} as Record<string, number>, byHorizon: {} as Record<string, number> });
  }, [timeQuery.data]);

  const financialImpactTotals = useMemo(() => {
    const empty = { revenue: 0, cost: 0, cash: 0, margin: 0, net: 0, byProject: {} as Record<string, number> };
    return (financialImpactsQuery.data || []).reduce((acc, item) => {
      const amount = num(item.expected_amount);
      const signed = item.impact_type === "cost" ? -amount : amount;
      if (item.impact_type === "revenue") acc.revenue += amount;
      if (item.impact_type === "cost") acc.cost += amount;
      if (item.impact_type === "cash") acc.cash += amount;
      if (item.impact_type === "margin") acc.margin += amount;
      acc.net += signed;
      if (item.project_id) acc.byProject[item.project_id] = (acc.byProject[item.project_id] || 0) + signed;
      return acc;
    }, empty);
  }, [financialImpactsQuery.data]);

  return {
    selectedCompanyId,
    companyId,
    northMetrics: northMetricsQuery.data || [],
    okrs: okrsQuery.data || [],
    keyResults: keyResultsQuery.data || [],
    krByOkr,
    assumptions: assumptionsQuery.data || [],
    risks: risksQuery.data || [],
    timeAllocations: timeQuery.data || [],
    timeTotals,
    decisions: decisionsQuery.data || [],
    financialImpacts: financialImpactsQuery.data || [],
    financialImpactTotals,
    reviews: reviewsQuery.data || [],
    projects: projectsQuery.data || [],
    isLoading: northMetricsQuery.isLoading || okrsQuery.isLoading || keyResultsQuery.isLoading || assumptionsQuery.isLoading || risksQuery.isLoading || timeQuery.isLoading || decisionsQuery.isLoading || financialImpactsQuery.isLoading || reviewsQuery.isLoading,
    isSaving: saveRecord.isPending || deleteRecord.isPending,
    saveNorthMetric,
    saveOkr,
    saveKeyResult,
    saveAssumption,
    saveRisk,
    saveTime,
    saveDecision,
    saveFinancialImpact,
    saveReview,
    deleteRecord: (table: string, id: string) => deleteRecord.mutateAsync({ table, id }),
  };
}
