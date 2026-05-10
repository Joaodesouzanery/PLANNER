import { useCallback, useMemo, useState } from "react";
import type { ChangeEvent, ReactNode } from "react";
import { EMSLayout } from "@/components/ems/EMSLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Activity, AlertTriangle, BarChart3, CalendarClock, CheckCircle2, Clock, Compass,
  DollarSign, Edit2, Flame, Layers3, Lightbulb, Plus, Rocket, Scale, Target, Trash2, Zap,
} from "lucide-react";
import { addMonths, format, parseISO } from "date-fns";
import { cn } from "@/lib/utils";
import { TrueNorthPanel } from "@/components/ems/TrueNorthPanel";
import { GoalModal } from "@/components/ems/planning/PlanningModals";
import {
  GoalFormData, PlanningGoal, categories, getCategoryInfo, statusOptions, usePlanningData,
} from "@/hooks/usePlanningData";
import {
  operationalDefaults, scoreLabel, useOperationalPlanningData,
  type DecisionLog, type FinancialImpact, type KeyResult, type NorthMetric, type PlanningAssumption,
  type PlanningRisk, type ReviewCycle, type TimeAllocation,
} from "@/hooks/useOperationalPlanningData";

type FormState = Record<string, any>;
type FieldConfig = {
  name: string;
  label: string;
  type?: "text" | "number" | "date" | "textarea" | "select";
  options?: { value: string; label: string }[];
  required?: boolean;
  span?: "full";
};

const emptyGoalForm: GoalFormData = {
  title: "", description: "", category: "strategic", start_date: "",
  end_date: "", status: "pending", parent_id: "", okr_id: "", project_id: "",
};

const confidenceOptions = [
  { value: "high", label: "Alta" },
  { value: "medium", label: "Média" },
  { value: "low", label: "Baixa" },
];

const assumptionStatus = [
  { value: "not_tested", label: "Não testada" },
  { value: "testing", label: "Testando" },
  { value: "confirmed", label: "Confirmada" },
  { value: "refuted", label: "Refutada" },
];

const riskStatus = [
  { value: "open", label: "Aberto" },
  { value: "monitoring", label: "Monitorando" },
  { value: "mitigated", label: "Mitigado" },
];

const timeCategories = [
  { value: "produto", label: "Produto / Desenvolvimento" },
  { value: "vendas", label: "Vendas / Relacionamento" },
  { value: "administrativo", label: "Administrativo" },
  { value: "incendio", label: "Apagar incendio" },
  { value: "estrategia", label: "Estrategia / Aprendizado" },
];

const horizonOptions = [
  { value: "h1", label: "H1 - Hoje" },
  { value: "h2", label: "H2 - Amanha" },
  { value: "h3", label: "H3 - Futuro" },
];

const reviewTypes = [
  { value: "daily", label: "Diário" },
  { value: "weekly", label: "Semanal" },
  { value: "monthly", label: "Mensal" },
  { value: "quarterly", label: "Trimestral" },
  { value: "annual", label: "Anual" },
];

const hConfig = {
  h1: { label: "H1 - Hoje", sub: "0-6 meses", color: "text-emerald-400", border: "border-emerald-500/30", bg: "bg-emerald-500/10" },
  h2: { label: "H2 - Amanha", sub: "6-18 meses", color: "text-amber-400", border: "border-amber-500/30", bg: "bg-amber-500/10" },
  h3: { label: "H3 - Futuro", sub: "18m+", color: "text-blue-400", border: "border-blue-500/30", bg: "bg-blue-500/10" },
};

const asDate = (value?: string | null) => value ? format(parseISO(value), "dd/MM/yyyy") : "-";
const asNumber = (value?: number | null, unit?: string | null) => `${Number(value || 0).toLocaleString("pt-BR")}${unit ? ` ${unit}` : ""}`;
const fmtMoney = (value: number) => `R$ ${value.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

const formFrom = (defaults: FormState, item: FormState, transforms?: Record<string, (value: any) => any>) =>
  Object.keys(defaults).reduce((acc, key) => {
    const value = item[key];
    acc[key] = transforms?.[key] ? transforms[key](value) : value ?? defaults[key];
    return acc;
  }, {} as FormState);

const Field = ({ field, form, setForm }: { field: FieldConfig; form: FormState; setForm: (form: FormState) => void }) => {
  const common = {
    value: form[field.name] ?? "",
    onChange: (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm({ ...form, [field.name]: event.target.value }),
  };
  return (
    <div className={cn("space-y-1.5", field.span === "full" && "sm:col-span-2")}>
      <label className="text-xs font-medium text-muted-foreground">{field.label}{field.required ? " *" : ""}</label>
      {field.type === "textarea" ? (
        <Textarea {...common} rows={3} />
      ) : field.type === "select" ? (
        <Select value={String(form[field.name] || "")} onValueChange={(value) => setForm({ ...form, [field.name]: value })}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>{field.options?.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent>
        </Select>
      ) : (
        <Input {...common} type={field.type || "text"} />
      )}
    </div>
  );
};

const CrudDialog = ({
  title, open, onOpenChange, fields, form, setForm, onSave, isSaving,
}: {
  title: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fields: FieldConfig[];
  form: FormState;
  setForm: (form: FormState) => void;
  onSave: () => void;
  isSaving: boolean;
}) => (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
      <DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>
      <div className="grid gap-3 sm:grid-cols-2">
        {fields.map((field) => <Field key={field.name} field={field} form={form} setForm={setForm} />)}
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
        <Button onClick={onSave} disabled={isSaving}>Salvar</Button>
      </div>
    </DialogContent>
  </Dialog>
);

const EmptyState = ({ label }: { label: string }) => (
  <Card className="border-dashed">
    <CardContent className="py-10 text-center text-sm text-muted-foreground">{label}</CardContent>
  </Card>
);

const SectionHeader = ({ title, description, action }: { title: string; description: string; action?: ReactNode }) => (
  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
    <div>
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="text-sm text-muted-foreground">{description}</p>
    </div>
    {action}
  </div>
);

const Planning = () => {
  const planning = usePlanningData();
  const operational = useOperationalPlanningData();
  const [pageMode, setPageMode] = useState<"planning" | "goals">("planning");
  const [activeTab, setActiveTab] = useState("north");
  const [goalsTab, setGoalsTab] = useState("overview");
  const [scopeProjectId, setScopeProjectId] = useState("all");
  const [editing, setEditing] = useState<{ table: string; id: string | null; type: string } | null>(null);
  const [form, setForm] = useState<FormState>({});
  const [showGoalModal, setShowGoalModal] = useState(false);
  const [editingGoal, setEditingGoal] = useState<PlanningGoal | null>(null);
  const [goalForm, setGoalForm] = useState<GoalFormData>(emptyGoalForm);

  const openForm = (type: string, defaults: FormState, item?: FormState, transforms?: Record<string, (value: any) => any>) => {
    setEditing({ table: type, id: item?.id || null, type });
    const scopedDefaults = scopeProjectId === "all" ? defaults : { ...defaults, project_id: scopeProjectId };
    setForm(item ? formFrom(scopedDefaults, item, transforms) : scopedDefaults);
  };

  const closeForm = () => {
    setEditing(null);
    setForm({});
  };

  const saveCurrent = async () => {
    if (!editing) return;
    const id = editing.id;
    if (editing.type === "north") await operational.saveNorthMetric(form, id);
    if (editing.type === "okr") await operational.saveOkr(form, id);
    if (editing.type === "kr") await operational.saveKeyResult(form, id);
    if (editing.type === "assumption") await operational.saveAssumption(form, id);
    if (editing.type === "risk") await operational.saveRisk(form, id);
    if (editing.type === "time") await operational.saveTime(form, id);
    if (editing.type === "decision") await operational.saveDecision(form, id);
    if (editing.type === "financialImpact") await operational.saveFinancialImpact(form, id);
    if (editing.type === "review") await operational.saveReview(form, id);
    closeForm();
  };

  const openGoal = useCallback((goal?: PlanningGoal, horizon?: "h1" | "h2" | "h3") => {
    const now = new Date();
    const end = horizon === "h1" ? addMonths(now, 4) : horizon === "h2" ? addMonths(now, 12) : addMonths(now, 24);
    setEditingGoal(goal || null);
    setGoalForm(goal ? {
      title: goal.title,
      description: goal.description || "",
      category: goal.category,
      start_date: goal.start_date || "",
      end_date: goal.end_date || "",
      status: goal.status,
      parent_id: goal.parent_id || "",
      okr_id: (goal as any).okr_id || "",
      project_id: (goal as any).project_id || "",
    } : { ...emptyGoalForm, project_id: scopeProjectId === "all" ? "" : scopeProjectId, start_date: format(now, "yyyy-MM-dd"), end_date: format(end, "yyyy-MM-dd") });
    setShowGoalModal(true);
  }, [scopeProjectId]);

  const saveGoal = async () => {
    if (!goalForm.title.trim()) return;
    await planning.saveGoal({ form: goalForm, editId: editingGoal?.id });
    setShowGoalModal(false);
    setEditingGoal(null);
    setGoalForm(emptyGoalForm);
  };

  const selectedProject = scopeProjectId === "all" ? null : operational.projects.find((project) => project.id === scopeProjectId) || null;
  const scopedItem = (item: { project_id?: string | null }) => scopeProjectId === "all" || !item.project_id || item.project_id === scopeProjectId;
  const scopedProjectItem = (item: { project_id?: string | null }) => scopeProjectId === "all" || item.project_id === scopeProjectId;
  const scopedNorthMetrics = useMemo(() => operational.northMetrics.filter(scopedItem), [operational.northMetrics, scopeProjectId]);
  const scopedKeyResults = useMemo(() => operational.keyResults.filter(scopedItem), [operational.keyResults, scopeProjectId]);
  const scopedAssumptions = useMemo(() => operational.assumptions.filter(scopedItem), [operational.assumptions, scopeProjectId]);
  const scopedRisks = useMemo(() => operational.risks.filter(scopedItem), [operational.risks, scopeProjectId]);
  const scopedTimeAllocations = useMemo(() => operational.timeAllocations.filter(scopedItem), [operational.timeAllocations, scopeProjectId]);
  const scopedDecisions = useMemo(() => operational.decisions.filter(scopedItem), [operational.decisions, scopeProjectId]);
  const scopedFinancialImpacts = useMemo(() => operational.financialImpacts.filter(scopedItem), [operational.financialImpacts, scopeProjectId]);
  const scopedGoals = useMemo(() => planning.goals.filter(scopedProjectItem), [planning.goals, scopeProjectId]);
  const scopedRootGoals = useMemo(() => planning.rootGoals.filter(scopedProjectItem), [planning.rootGoals, scopeProjectId]);
  const scopedKrByOkr = useMemo(() => scopedKeyResults.reduce((acc, kr) => {
    const key = kr.okr_id || "__none";
    acc[key] = [...(acc[key] || []), kr];
    return acc;
  }, {} as Record<string, KeyResult[]>), [scopedKeyResults]);
  const scopedTimeTotals = useMemo(() => scopedTimeAllocations.reduce((acc, item) => {
    acc.planned += Number(item.planned_hours || 0);
    acc.actual += Number(item.actual_hours || 0);
    return acc;
  }, { planned: 0, actual: 0 }), [scopedTimeAllocations]);
  const scopedFinancialTotals = useMemo(() => scopedFinancialImpacts.reduce((acc, item) => {
    const amount = Number(item.expected_amount || 0);
    const signed = item.impact_type === "cost" ? -amount : amount;
    if (item.impact_type === "revenue") acc.revenue += amount;
    if (item.impact_type === "cost") acc.cost += amount;
    if (item.impact_type === "cash") acc.cash += amount;
    if (item.impact_type === "margin") acc.margin += amount;
    acc.net += signed;
    return acc;
  }, { revenue: 0, cost: 0, cash: 0, margin: 0, net: 0 }), [scopedFinancialImpacts]);

  const goalsByHorizon = useMemo(() => {
    const now = new Date();
    const h1End = addMonths(now, 6);
    const h2End = addMonths(now, 18);
    const buckets = { h1: [] as PlanningGoal[], h2: [] as PlanningGoal[], h3: [] as PlanningGoal[] };
    scopedRootGoals.forEach((goal) => {
      if (!goal.end_date) buckets.h2.push(goal);
      else {
        const end = parseISO(goal.end_date);
        if (end <= h1End) buckets.h1.push(goal);
        else if (end <= h2End) buckets.h2.push(goal);
        else buckets.h3.push(goal);
      }
    });
    return buckets;
  }, [scopedRootGoals]);

  const okrProgress = (okrId: string, fallback: number) => {
    const krs = scopedKrByOkr[okrId] || [];
    if (!krs.length) return fallback;
    return Math.round(krs.reduce((sum, kr) => {
      const target = Number(kr.target_value || 0);
      const current = Number(kr.current_value || 0);
      return sum + (target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 0);
    }, 0) / krs.length);
  };

  const metaInitiatives = useMemo(() => scopedGoals
    .filter((goal) => goal.title)
    .sort((a, b) => String(a.start_date || a.created_at).localeCompare(String(b.start_date || b.created_at))),
  [scopedGoals]);

  const groupedMetaInitiatives = useMemo(() => metaInitiatives.reduce((acc, goal) => {
    const category = getCategoryInfo(goal.category).label;
    acc[category] = [...(acc[category] || []), goal];
    return acc;
  }, {} as Record<string, PlanningGoal[]>), [metaInitiatives]);

  const metaOverviewCards = useMemo(() => {
    const northCards = scopedNorthMetrics.slice(0, 6).map((metric) => {
      const current = Number(metric.current_value || 0);
      const target = Number(metric.quarter_target || 0);
      const progress = target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 0;
      return {
        title: metric.metric_name,
        value: asNumber(metric.current_value, metric.unit),
        meta: `Meta: ${asNumber(metric.quarter_target, metric.unit)}`,
        status: target > 0 && current >= target ? "No ritmo" : target > 0 ? "Atencao" : "Sem meta",
        progress,
      };
    });
    if (northCards.length) return northCards;
    return operational.okrs.slice(0, 6).map((okr) => {
      const progress = okrProgress(okr.id, okr.target_value > 0 ? Math.round((okr.current_value / okr.target_value) * 100) : 0);
      return {
        title: okr.title,
        value: asNumber(okr.current_value, okr.unit),
        meta: `Meta: ${asNumber(okr.target_value, okr.unit)}`,
        status: progress >= 80 ? "No ritmo" : progress >= 40 ? "Atenção" : "Não iniciado",
        progress,
      };
    });
  }, [scopedNorthMetrics, operational.okrs, scopedKrByOkr]);

  const gapRows = useMemo(() => {
    const metricRows = scopedNorthMetrics.map((metric) => {
      const current = Number(metric.current_value || 0);
      const target = Number(metric.quarter_target || 0);
      return {
        name: metric.metric_name,
        today: asNumber(metric.current_value, metric.unit),
        projected: asNumber(current, metric.unit),
        target: asNumber(metric.quarter_target, metric.unit),
        gap: target - current,
        closes: metric.levers || metric.change_reason || "Definir alavanca",
        unit: metric.unit,
      };
    });
    const krRows = scopedKeyResults.map((kr) => {
      const current = Number(kr.current_value || 0);
      const target = Number(kr.target_value || 0);
      return {
        name: kr.title,
        today: asNumber(kr.current_value, kr.unit),
        projected: asNumber(current, kr.unit),
        target: asNumber(kr.target_value, kr.unit),
        gap: target - current,
        closes: kr.learning || kr.not_doing || "Vincular iniciativa",
        unit: kr.unit,
      };
    });
    return [...metricRows, ...krRows].filter((row) => row.name).slice(0, 8);
  }, [scopedNorthMetrics, scopedKeyResults]);

  const assumptionsByArea = useMemo(() => scopedAssumptions.reduce((acc, item) => {
    const key = item.product_area || "Empresa";
    acc[key] = [...(acc[key] || []), item];
    return acc;
  }, {} as Record<string, PlanningAssumption[]>), [scopedAssumptions]);

  const monthLabels = ["Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
  const monthIndex = (date?: string | null) => {
    if (!date) return 0;
    const month = new Date(`${date}T12:00:00`).getMonth();
    return Math.max(0, Math.min(7, month - 4));
  };

  const dialogConfig = {
    north: {
      title: "Metrica North Star",
      fields: [
        { name: "metric_name", label: "Metrica", required: true },
        { name: "product_area", label: "Produto / área" },
        { name: "current_value", label: "Valor atual", type: "number" },
        { name: "quarter_target", label: "Meta do trimestre", type: "number" },
        { name: "unit", label: "Unidade" },
        { name: "history_note", label: "Histórico / variação", type: "textarea", span: "full" },
        { name: "change_reason", label: "Por que subiu ou caiu", type: "textarea", span: "full" },
        { name: "levers", label: "Alavancas da semana", type: "textarea", span: "full" },
        { name: "project_id", label: "Projeto", type: "select", options: [{ value: "none", label: "Empresa inteira" }, ...operational.projects.map((project) => ({ value: project.id, label: project.title }))], span: "full" },
      ] as FieldConfig[],
    },
    okr: {
      title: "OKR",
      fields: [
        { name: "title", label: "Objetivo", required: true, span: "full" },
        { name: "description", label: "Descrição", type: "textarea", span: "full" },
        { name: "target_value", label: "Alvo", type: "number" },
        { name: "current_value", label: "Atual", type: "number" },
        { name: "unit", label: "Unidade" },
        { name: "period", label: "Ciclo" },
        { name: "start_date", label: "Inicio", type: "date" },
        { name: "end_date", label: "Fim", type: "date" },
      ] as FieldConfig[],
    },
    kr: {
      title: "Key Result",
      fields: [
        { name: "okr_id", label: "OKR", type: "select", options: operational.okrs.map((okr) => ({ value: okr.id, label: okr.title })), required: true, span: "full" },
        { name: "title", label: "Key Result", required: true, span: "full" },
        { name: "target_value", label: "Alvo", type: "number" },
        { name: "current_value", label: "Atual", type: "number" },
        { name: "unit", label: "Unidade" },
        { name: "confidence", label: "Confianca", type: "select", options: confidenceOptions },
        { name: "owner", label: "Dono" },
        { name: "cycle", label: "Ciclo" },
        { name: "project_id", label: "Projeto vinculado", type: "select", options: [{ value: "none", label: "Nenhum" }, ...operational.projects.map((project) => ({ value: project.id, label: project.title }))], span: "full" },
        { name: "not_doing", label: "O que não vamos fazer", type: "textarea", span: "full" },
        { name: "learning", label: "O que queremos aprender", type: "textarea", span: "full" },
        { name: "retrospective", label: "Retrospectiva", type: "textarea", span: "full" },
      ] as FieldConfig[],
    },
    assumption: {
      title: "Suposicao",
      fields: [
        { name: "assumption", label: "Suposicao", required: true, span: "full" },
        { name: "product_area", label: "Produto / área" },
        { name: "criticality", label: "Criticidade", type: "select", options: confidenceOptions },
        { name: "status", label: "Status", type: "select", options: assumptionStatus },
        { name: "test_plan", label: "Como testar", type: "textarea", span: "full" },
        { name: "learning", label: "O que aprendemos", type: "textarea", span: "full" },
        { name: "plan_impact", label: "Impacto no plano", type: "textarea", span: "full" },
        { name: "project_id", label: "Projeto", type: "select", options: [{ value: "none", label: "Empresa inteira" }, ...operational.projects.map((project) => ({ value: project.id, label: project.title }))], span: "full" },
      ] as FieldConfig[],
    },
    risk: {
      title: "Risco",
      fields: [
        { name: "risk", label: "Risco", required: true, span: "full" },
        { name: "product_area", label: "Produto / área" },
        { name: "probability", label: "Probabilidade", type: "select", options: confidenceOptions },
        { name: "impact", label: "Impacto", type: "select", options: confidenceOptions },
        { name: "owner", label: "Dono" },
        { name: "status", label: "Status", type: "select", options: riskStatus },
        { name: "mitigation", label: "Mitigacao", type: "textarea", span: "full" },
        { name: "contingency_plan", label: "Plano de contingencia", type: "textarea", span: "full" },
        { name: "project_id", label: "Projeto", type: "select", options: [{ value: "none", label: "Empresa inteira" }, ...operational.projects.map((project) => ({ value: project.id, label: project.title }))], span: "full" },
      ] as FieldConfig[],
    },
    time: {
      title: "Alocacao de tempo",
      fields: [
        { name: "week_start", label: "Semana", type: "date", required: true },
        { name: "category", label: "Categoria", type: "select", options: timeCategories },
        { name: "product_area", label: "Produto / área" },
        { name: "horizon", label: "Horizonte", type: "select", options: horizonOptions },
        { name: "planned_hours", label: "Horas planejadas", type: "number" },
        { name: "actual_hours", label: "Horas reais", type: "number" },
        { name: "project_id", label: "Projeto", type: "select", options: [{ value: "none", label: "Nenhum" }, ...operational.projects.map((project) => ({ value: project.id, label: project.title }))], span: "full" },
        { name: "notes", label: "Observacoes", type: "textarea", span: "full" },
      ] as FieldConfig[],
    },
    decision: {
      title: "Decisão",
      fields: [
        { name: "title", label: "Tema", required: true, span: "full" },
        { name: "decision", label: "Decisão tomada", type: "textarea", span: "full" },
        { name: "context", label: "Contexto", type: "textarea", span: "full" },
        { name: "options_considered", label: "Opcoes consideradas", type: "textarea", span: "full" },
        { name: "decision_criteria", label: "Critério de decisão", type: "textarea", span: "full" },
        { name: "involved_people", label: "Quem envolveu" },
        { name: "category", label: "Categoria" },
        { name: "tags", label: "Tags separadas por virgula" },
        { name: "project_id", label: "Projeto", type: "select", options: [{ value: "none", label: "Empresa inteira" }, ...operational.projects.map((project) => ({ value: project.id, label: project.title }))], span: "full" },
        { name: "review_date", label: "Revisao programada", type: "date" },
        { name: "expected_result", label: "Resultado esperado", type: "textarea", span: "full" },
        { name: "result", label: "Resultado", type: "textarea", span: "full" },
      ] as FieldConfig[],
    },
    financialImpact: {
      title: "Impacto financeiro planejado",
      fields: [
        { name: "title", label: "Impacto", required: true, span: "full" },
        { name: "impact_type", label: "Tipo", type: "select", options: [
          { value: "revenue", label: "Receita" },
          { value: "cost", label: "Custo" },
          { value: "cash", label: "Caixa" },
          { value: "margin", label: "Margem" },
        ] },
        { name: "expected_amount", label: "Valor previsto", type: "number" },
        { name: "expected_date", label: "Data prevista", type: "date" },
        { name: "confidence", label: "Confianca", type: "select", options: confidenceOptions },
        { name: "status", label: "Status", type: "select", options: [
          { value: "planned", label: "Planejado" },
          { value: "committed", label: "Comprometido" },
          { value: "realized", label: "Realizado" },
          { value: "dropped", label: "Descartado" },
        ] },
        { name: "project_id", label: "Projeto", type: "select", options: [{ value: "none", label: "Empresa inteira" }, ...operational.projects.map((project) => ({ value: project.id, label: project.title }))], span: "full" },
        { name: "okr_id", label: "OKR", type: "select", options: [{ value: "none", label: "Nenhum" }, ...operational.okrs.map((okr) => ({ value: okr.id, label: okr.title }))], span: "full" },
        { name: "key_result_id", label: "Key Result", type: "select", options: [{ value: "none", label: "Nenhum" }, ...scopedKeyResults.map((kr) => ({ value: kr.id, label: kr.title }))], span: "full" },
        { name: "goal_id", label: "Meta / iniciativa", type: "select", options: [{ value: "none", label: "Nenhuma" }, ...scopedGoals.map((goal) => ({ value: goal.id, label: goal.title }))], span: "full" },
        { name: "notes", label: "Observacoes", type: "textarea", span: "full" },
      ] as FieldConfig[],
    },
    review: {
      title: "Ritmo de revisao",
      fields: [
        { name: "cycle_type", label: "Cadencia", type: "select", options: reviewTypes },
        { name: "period_start", label: "Inicio", type: "date" },
        { name: "period_end", label: "Fim", type: "date" },
        { name: "agenda", label: "Agenda / perguntas", type: "textarea", span: "full" },
        { name: "summary", label: "Resumo", type: "textarea", span: "full" },
        { name: "decisions", label: "Decisoes", type: "textarea", span: "full" },
        { name: "next_actions", label: "Próximas ações", type: "textarea", span: "full" },
      ] as FieldConfig[],
    },
  } as Record<string, { title: string; fields: FieldConfig[] }>;

  const currentDialog = editing ? dialogConfig[editing.type] : null;

  return (
    <EMSLayout>
      <div className="space-y-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl md:text-3xl font-heading font-bold">Planejamento e Metas</h1>
            <p className="text-muted-foreground">Planejamento operacional, metas, iniciativas e gaps em um unico cockpit.</p>
          </div>
          <Button onClick={() => openForm("review", operationalDefaults.review)}>
            <CalendarClock className="h-4 w-4 mr-2" />Nova revisao
          </Button>
        </div>

        {operational.isLoading ? <Skeleton className="h-24 rounded-lg" /> : null}

        <div className="grid grid-cols-2 gap-2 rounded-lg border bg-muted/20 p-1 sm:w-[420px]">
          <Button variant={pageMode === "planning" ? "default" : "ghost"} onClick={() => setPageMode("planning")}>Planejamento</Button>
          <Button variant={pageMode === "goals" ? "default" : "ghost"} onClick={() => setPageMode("goals")}>Metas</Button>
        </div>

        <Card className="border-border/60">
          <CardContent className="p-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm font-semibold">{selectedProject ? `Plano do projeto: ${selectedProject.title}` : "Plano geral da empresa"}</p>
              <p className="text-xs text-muted-foreground">Registros da empresa inteira aparecem como base; itens vinculados ao projeto alimentam o grafo de vinculos.</p>
            </div>
            <Select value={scopeProjectId} onValueChange={setScopeProjectId}>
              <SelectTrigger className="w-full md:w-[320px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Empresa inteira</SelectItem>
                {operational.projects.map((project) => <SelectItem key={project.id} value={project.id}>{project.title}</SelectItem>)}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {pageMode === "planning" ? (
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-4 lg:grid-cols-8 h-auto">
            <TabsTrigger value="north"><Compass className="h-4 w-4 mr-1" />North</TabsTrigger>
            <TabsTrigger value="okrs"><Target className="h-4 w-4 mr-1" />OKRs</TabsTrigger>
            <TabsTrigger value="horizons"><Layers3 className="h-4 w-4 mr-1" />Horizontes</TabsTrigger>
            <TabsTrigger value="assumptions"><Lightbulb className="h-4 w-4 mr-1" />Suposicoes</TabsTrigger>
            <TabsTrigger value="decisions"><Scale className="h-4 w-4 mr-1" />Decisoes</TabsTrigger>
            <TabsTrigger value="risks"><AlertTriangle className="h-4 w-4 mr-1" />Riscos</TabsTrigger>
            <TabsTrigger value="time"><Clock className="h-4 w-4 mr-1" />Tempo</TabsTrigger>
            <TabsTrigger value="reviews"><CalendarClock className="h-4 w-4 mr-1" />Revisao</TabsTrigger>
          </TabsList>

          <TabsContent value="north" className="mt-5 space-y-4">
            <TrueNorthPanel />
            <SectionHeader
              title="Metricas North Star"
              description="Registre valor atual, meta trimestral, variacao e alavancas que realmente movem a empresa."
              action={<Button size="sm" onClick={() => openForm("north", operationalDefaults.northMetric)}><Plus className="h-4 w-4 mr-1" />Metrica</Button>}
            />
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {scopedNorthMetrics.map((metric: NorthMetric) => (
                <Card key={metric.id}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-start justify-between gap-2">
                      <span>{metric.metric_name}</span>
                      <Badge variant="outline">{metric.product_area || "Empresa"}</Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm">
                    <div className="grid grid-cols-2 gap-2">
                      <div className="rounded-lg border p-2"><p className="text-xs text-muted-foreground">Atual</p><p className="font-bold">{asNumber(metric.current_value, metric.unit)}</p></div>
                      <div className="rounded-lg border p-2"><p className="text-xs text-muted-foreground">Meta tri</p><p className="font-bold">{asNumber(metric.quarter_target, metric.unit)}</p></div>
                    </div>
                    {metric.history_note && <p className="text-muted-foreground line-clamp-2">{metric.history_note}</p>}
                    {metric.levers && <p><span className="font-medium">Alavancas:</span> {metric.levers}</p>}
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openForm("north", operationalDefaults.northMetric, metric)}><Edit2 className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" className="text-destructive" onClick={() => operational.deleteRecord("planning_north_metrics", metric.id)}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
            {scopedNorthMetrics.length === 0 && <EmptyState label="Nenhuma metrica North Star registrada neste escopo." />}
          </TabsContent>

          <TabsContent value="okrs" className="mt-5 space-y-4">
            <SectionHeader
              title="OKRs operacionais"
              description="Objetivos com Key Results, dono, confianca, aprendizado e iniciativas vinculadas."
              action={<div className="flex gap-2"><Button size="sm" variant="outline" onClick={() => openForm("kr", operationalDefaults.keyResult)}><Plus className="h-4 w-4 mr-1" />KR</Button><Button size="sm" onClick={() => openForm("okr", operationalDefaults.okr)}><Plus className="h-4 w-4 mr-1" />OKR</Button></div>}
            />
            <div className="space-y-3">
              {operational.okrs.map((okr) => {
                const progress = okrProgress(okr.id, okr.target_value > 0 ? Math.round((okr.current_value / okr.target_value) * 100) : 0);
                const krs = scopedKrByOkr[okr.id] || [];
                return (
                  <Card key={okr.id}>
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <CardTitle className="text-base">{okr.title}</CardTitle>
                          <p className="text-xs text-muted-foreground">{okr.period || "Sem ciclo"} - {asDate(okr.start_date)} a {asDate(okr.end_date)}</p>
                        </div>
                        <Badge variant="outline">{progress}%</Badge>
                      </div>
                      <Progress value={progress} className="h-2 mt-3" />
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {krs.map((kr: KeyResult) => {
                        const krProgress = Number(kr.target_value || 0) > 0 ? Math.min(100, Math.round((Number(kr.current_value || 0) / Number(kr.target_value || 0)) * 100)) : 0;
                        return (
                          <div key={kr.id} className="rounded-lg border p-3">
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <p className="font-medium text-sm">{kr.title}</p>
                                <p className="text-xs text-muted-foreground">{kr.owner || "Você"} - confiança {scoreLabel(kr.confidence)}</p>
                              </div>
                              <Badge variant="secondary">{krProgress}%</Badge>
                            </div>
                            <Progress value={krProgress} className="h-1.5 mt-2" />
                            {(kr.not_doing || kr.learning) && <p className="text-xs text-muted-foreground mt-2 line-clamp-2">{kr.not_doing || kr.learning}</p>}
                            <div className="flex justify-end gap-1 mt-1">
                              <Button variant="ghost" size="icon" onClick={() => openForm("kr", operationalDefaults.keyResult, kr)}><Edit2 className="h-3.5 w-3.5" /></Button>
                              <Button variant="ghost" size="icon" className="text-destructive" onClick={() => operational.deleteRecord("okr_key_results", kr.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                            </div>
                          </div>
                        );
                      })}
                      {krs.length === 0 && <p className="text-sm text-muted-foreground">Sem Key Results vinculados.</p>}
                      <div className="flex justify-end gap-1 pt-1">
                        <Button variant="ghost" size="sm" onClick={() => openForm("kr", { ...operationalDefaults.keyResult, okr_id: okr.id })}>Adicionar KR</Button>
                        <Button variant="ghost" size="icon" onClick={() => openForm("okr", operationalDefaults.okr, okr)}><Edit2 className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" className="text-destructive" onClick={() => operational.deleteRecord("okrs", okr.id)}><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
            {operational.okrs.length === 0 && <EmptyState label="Nenhum OKR cadastrado." />}
          </TabsContent>

          <TabsContent value="horizons" className="mt-5 space-y-4">
            <SectionHeader
              title="Horizontes H1/H2/H3"
              description="Proteja o que existe, construa os proximos motores e reserve energia para o futuro."
              action={<Button size="sm" onClick={() => openGoal(undefined, "h1")}><Plus className="h-4 w-4 mr-1" />Meta</Button>}
            />
            <div className="grid gap-3 lg:grid-cols-3">
              {(["h1", "h2", "h3"] as const).map((key) => {
                const config = hConfig[key];
                const goals = goalsByHorizon[key];
                const avg = goals.length ? Math.round(goals.reduce((sum, goal) => sum + Number(goal.progress || 0), 0) / goals.length) : 0;
                return (
                  <Card key={key} className={cn("border", config.border)}>
                    <CardHeader>
                      <CardTitle className={cn("text-base", config.color)}>{config.label} <span className="text-xs text-muted-foreground">({config.sub})</span></CardTitle>
                      <Progress value={avg} className="h-2" />
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {goals.map((goal) => {
                        const category = getCategoryInfo(goal.category);
                        return (
                          <div key={goal.id} className="rounded-lg border p-3">
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <p className="text-sm font-medium">{goal.title}</p>
                                <p className="text-xs text-muted-foreground">{category.label} - {goal.progress}%</p>
                              </div>
                              <Badge variant="outline">{goal.status}</Badge>
                            </div>
                            <div className="flex justify-end gap-1 mt-2">
                              <Button variant="ghost" size="icon" onClick={() => openGoal(goal)}><Edit2 className="h-3.5 w-3.5" /></Button>
                              <Button variant="ghost" size="icon" className="text-destructive" onClick={() => planning.deleteGoal(goal.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                            </div>
                          </div>
                        );
                      })}
                      {goals.length === 0 && <p className="text-sm text-muted-foreground py-4 text-center">Sem metas neste horizonte.</p>}
                      <Button variant="outline" size="sm" className="w-full" onClick={() => openGoal(undefined, key)}><Plus className="h-4 w-4 mr-1" />Nova meta {config.label}</Button>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </TabsContent>

          <TabsContent value="assumptions" className="mt-5 space-y-4">
            <SectionHeader title="Suposicoes criticas" description="Transforme apostas invisiveis em testes e aprendizados." action={<Button size="sm" onClick={() => openForm("assumption", operationalDefaults.assumption)}><Plus className="h-4 w-4 mr-1" />Suposicao</Button>} />
            <div className="grid gap-3 md:grid-cols-2">
              {scopedAssumptions.map((item: PlanningAssumption) => (
                <Card key={item.id}>
                  <CardContent className="p-4 space-y-3">
                    <div className="flex justify-between gap-3"><h3 className="font-semibold">{item.assumption}</h3><Badge variant="outline">{item.status}</Badge></div>
                    <p className="text-sm text-muted-foreground">{item.product_area || "Empresa"} - criticidade {scoreLabel(item.criticality)}</p>
                    {item.test_plan && <p className="text-sm"><span className="font-medium">Teste:</span> {item.test_plan}</p>}
                    {item.learning && <p className="text-sm"><span className="font-medium">Aprendizado:</span> {item.learning}</p>}
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openForm("assumption", operationalDefaults.assumption, item)}><Edit2 className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" className="text-destructive" onClick={() => operational.deleteRecord("planning_assumptions", item.id)}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
            {scopedAssumptions.length === 0 && <EmptyState label="Nenhuma suposicao registrada neste escopo." />}
          </TabsContent>

          <TabsContent value="decisions" className="mt-5 space-y-4">
            <SectionHeader title="Decision log" description="Registre contexto, opções, critério, envolvidos e resultado para não reabrir debates já decididos." action={<Button size="sm" onClick={() => openForm("decision", operationalDefaults.decision)}><Plus className="h-4 w-4 mr-1" />Decisão</Button>} />
            <div className="space-y-3">
              {scopedDecisions.map((item: DecisionLog) => (
                <Card key={item.id}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="font-semibold">{item.title}</h3>
                        <p className="text-sm text-muted-foreground">{item.category || "Sem categoria"} - revisar em {asDate(item.review_date)}</p>
                      </div>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openForm("decision", operationalDefaults.decision, item, { tags: (tags) => (tags || []).join(", ") })}><Edit2 className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" className="text-destructive" onClick={() => operational.deleteRecord("decision_logs", item.id)}><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    </div>
                    {item.decision && <p className="text-sm mt-2">{item.decision}</p>}
                    <div className="flex flex-wrap gap-1.5 mt-3">{(item.tags || []).map((tag) => <Badge key={tag} variant="secondary">{tag}</Badge>)}</div>
                  </CardContent>
                </Card>
              ))}
            </div>
            {scopedDecisions.length === 0 && <EmptyState label="Nenhuma decisão registrada neste escopo." />}
          </TabsContent>

          <TabsContent value="risks" className="mt-5 space-y-4">
            <SectionHeader title="Registro de riscos" description="Score automático por probabilidade x impacto, com mitigação e contingência." action={<Button size="sm" onClick={() => openForm("risk", operationalDefaults.risk)}><Plus className="h-4 w-4 mr-1" />Risco</Button>} />
            <div className="grid gap-3 md:grid-cols-2">
              {scopedRisks.map((item: PlanningRisk) => (
                <Card key={item.id} className={cn(Number(item.score || 0) >= 6 && "border-destructive/40")}>
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-3"><h3 className="font-semibold">{item.risk}</h3><Badge variant={Number(item.score || 0) >= 6 ? "destructive" : "outline"}>Score {item.score || 0}</Badge></div>
                    <p className="text-sm text-muted-foreground">{item.product_area || "Empresa"} - prob. {scoreLabel(item.probability)} / impacto {scoreLabel(item.impact)}</p>
                    {item.mitigation && <p className="text-sm"><span className="font-medium">Mitigacao:</span> {item.mitigation}</p>}
                    {item.contingency_plan && <p className="text-sm"><span className="font-medium">48h:</span> {item.contingency_plan}</p>}
                    <div className="flex items-center justify-between">
                      <Badge variant="secondary">{item.owner || "Você"}</Badge>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openForm("risk", operationalDefaults.risk, item)}><Edit2 className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" className="text-destructive" onClick={() => operational.deleteRecord("planning_risks", item.id)}><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
            {scopedRisks.length === 0 && <EmptyState label="Nenhum risco registrado neste escopo." />}
          </TabsContent>

          <TabsContent value="time" className="mt-5 space-y-4">
            <SectionHeader title="Tempo leve" description="Acompanhe alocacao planejada vs real sem restaurar o Timesheet como modulo separado." action={<Button size="sm" onClick={() => openForm("time", operationalDefaults.time)}><Plus className="h-4 w-4 mr-1" />Tempo</Button>} />
            <div className="grid gap-3 md:grid-cols-3">
              <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Planejado</p><p className="text-2xl font-bold">{scopedTimeTotals.planned}h</p></CardContent></Card>
              <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Real</p><p className="text-2xl font-bold">{scopedTimeTotals.actual}h</p></CardContent></Card>
              <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Gap</p><p className="text-2xl font-bold">{scopedTimeTotals.actual - scopedTimeTotals.planned}h</p></CardContent></Card>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              {scopedTimeAllocations.map((item: TimeAllocation) => (
                <Card key={item.id}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="font-semibold">{timeCategories.find((cat) => cat.value === item.category)?.label || item.category}</h3>
                        <p className="text-sm text-muted-foreground">{asDate(item.week_start)} - {horizonOptions.find((h) => h.value === item.horizon)?.label}</p>
                      </div>
                      <Badge variant="outline">{item.actual_hours || 0}/{item.planned_hours || 0}h</Badge>
                    </div>
                    {item.notes && <p className="text-sm mt-2 text-muted-foreground">{item.notes}</p>}
                    <div className="flex justify-end gap-1 mt-2">
                      <Button variant="ghost" size="icon" onClick={() => openForm("time", operationalDefaults.time, item)}><Edit2 className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" className="text-destructive" onClick={() => operational.deleteRecord("planning_time_allocations", item.id)}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
            {scopedTimeAllocations.length === 0 && <EmptyState label="Nenhuma alocacao de tempo registrada neste escopo." />}
          </TabsContent>

          <TabsContent value="reviews" className="mt-5 space-y-4">
            <div className="grid gap-3 lg:grid-cols-5">
              {[
                { type: "daily", icon: Zap, title: "Check de pulso", hint: "15 min" },
                { type: "weekly", icon: Activity, title: "Metricas + prioridades", hint: "45 min" },
                { type: "monthly", icon: BarChart3, title: "Financeiro + produto", hint: "2-3h" },
                { type: "quarterly", icon: CheckCircle2, title: "OKRs + proximo ciclo", hint: "1 dia" },
                { type: "annual", icon: Rocket, title: "Planejamento estrategico", hint: "2 dias" },
              ].map((item) => (
                <Card key={item.type} className="border-border/60">
                  <CardContent className="p-4">
                    <item.icon className="h-5 w-5 text-primary mb-3" />
                    <p className="font-semibold text-sm">{item.title}</p>
                    <p className="text-xs text-muted-foreground">{item.hint}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
            <SectionHeader title="Histórico de revisões" description="Registre o que mudou, decidiu e precisa acontecer antes da próxima cadência." action={<Button size="sm" onClick={() => openForm("review", operationalDefaults.review)}><Plus className="h-4 w-4 mr-1" />Revisão</Button>} />
            <div className="space-y-3">
              {operational.reviews.map((item: ReviewCycle) => (
                <Card key={item.id}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="font-semibold">{reviewTypes.find((type) => type.value === item.cycle_type)?.label || item.cycle_type}</h3>
                        <p className="text-sm text-muted-foreground">{asDate(item.period_start)} - {asDate(item.period_end)}</p>
                      </div>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openForm("review", operationalDefaults.review, item)}><Edit2 className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" className="text-destructive" onClick={() => operational.deleteRecord("review_cycles", item.id)}><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    </div>
                    {item.summary && <p className="text-sm mt-2">{item.summary}</p>}
                    {item.next_actions && <p className="text-sm text-muted-foreground mt-1"><span className="font-medium">Proximas:</span> {item.next_actions}</p>}
                  </CardContent>
                </Card>
              ))}
            </div>
            {operational.reviews.length === 0 && <EmptyState label="Nenhuma revisao registrada." />}
          </TabsContent>
        </Tabs>
        ) : (
          <Tabs value={goalsTab} onValueChange={setGoalsTab}>
            <TabsList className="grid w-full grid-cols-2 md:grid-cols-5 h-auto">
              <TabsTrigger value="overview">Visao Geral</TabsTrigger>
              <TabsTrigger value="plan">Objetivos + Plano</TabsTrigger>
              <TabsTrigger value="timeline">Linha do Tempo</TabsTrigger>
              <TabsTrigger value="gap">Gap Analysis</TabsTrigger>
              <TabsTrigger value="ifthen">Se -&gt; Entao</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="mt-5 space-y-4">
              <Card className="bg-muted/30">
                <CardContent className="p-4 text-sm text-muted-foreground">
                  Este é o painel de segunda-feira: em poucos minutos você vê onde estão as metas, o que está em execução e o que está travado.
                </CardContent>
              </Card>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {metaOverviewCards.map((card) => (
                  <Card key={card.title}>
                    <CardContent className="p-4 space-y-3">
                      <p className="text-xs font-semibold uppercase text-muted-foreground">{card.title}</p>
                      <p className="text-2xl font-bold">{card.value || "--"}</p>
                      <p className="text-sm text-muted-foreground">{card.meta}</p>
                      <div className="flex items-center gap-2">
                        <Badge variant={card.status === "No ritmo" ? "secondary" : "outline"}>{card.status}</Badge>
                        <Progress value={card.progress} className="h-2 flex-1" />
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
              {metaOverviewCards.length === 0 && <EmptyState label="Cadastre metricas North Star ou OKRs para montar a visao geral das metas." />}

              <Card>
                <CardHeader className="pb-2">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <CardTitle className="text-base">Impacto financeiro planejado</CardTitle>
                      <p className="text-xs text-muted-foreground">Projecoes por meta ou projeto, separadas dos lancamentos reais do Financeiro.</p>
                    </div>
                    <Button size="sm" onClick={() => openForm("financialImpact", operationalDefaults.financialImpact)}>
                      <DollarSign className="h-4 w-4 mr-1" />Impacto
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-3 sm:grid-cols-4">
                    {[
                      ["Receita", scopedFinancialTotals.revenue],
                      ["Custo", scopedFinancialTotals.cost],
                      ["Caixa", scopedFinancialTotals.cash],
                      ["Liquido", scopedFinancialTotals.net],
                    ].map(([label, value]) => (
                      <div key={label as string} className="rounded-lg border border-border/60 p-3">
                        <p className="text-xs text-muted-foreground">{label}</p>
                        <p className="text-lg font-bold font-mono">{fmtMoney(Number(value))}</p>
                      </div>
                    ))}
                  </div>
                  <div className="space-y-2">
                    {scopedFinancialImpacts.slice(0, 6).map((item: FinancialImpact) => (
                      <div key={item.id} className="flex items-start justify-between gap-3 border-b border-border/60 pb-2 last:border-0">
                        <div>
                          <p className="text-sm font-semibold">{item.title}</p>
                          <p className="text-xs text-muted-foreground">{fmtMoney(Number(item.expected_amount || 0))} - {asDate(item.expected_date)} - {scoreLabel(item.confidence)}</p>
                        </div>
                        <div className="flex gap-1">
                          <Badge variant="outline">{item.impact_type}</Badge>
                          <Button variant="ghost" size="icon" onClick={() => openForm("financialImpact", operationalDefaults.financialImpact, item)}><Edit2 className="h-4 w-4" /></Button>
                          <Button variant="ghost" size="icon" className="text-destructive" onClick={() => operational.deleteRecord("planning_financial_impacts", item.id)}><Trash2 className="h-4 w-4" /></Button>
                        </div>
                      </div>
                    ))}
                    {scopedFinancialImpacts.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">Nenhum impacto financeiro planejado neste escopo.</p>}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle className="text-base">Iniciativas em execução agora</CardTitle></CardHeader>
                <CardContent className="space-y-2">
                  {metaInitiatives.slice(0, 8).map((goal) => (
                    <div key={goal.id} className="flex items-start justify-between gap-3 border-b border-border/60 pb-3 last:border-0">
                      <div>
                        <p className="font-semibold text-sm">{goal.title}</p>
                        <p className="text-xs text-muted-foreground">{getCategoryInfo(goal.category).label} - meta vinculada ao planejamento</p>
                      </div>
                      <Badge variant={goal.status === "completed" ? "secondary" : goal.status === "on_hold" ? "destructive" : "outline"}>
                        {statusOptions.find((item) => item.value === goal.status)?.label || goal.status}
                      </Badge>
                    </div>
                  ))}
                  {metaInitiatives.length === 0 && <p className="text-sm text-muted-foreground text-center py-5">Nenhuma iniciativa em execução.</p>}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="plan" className="mt-5 space-y-4">
              <Card className="bg-muted/30">
                <CardContent className="p-4 text-sm text-muted-foreground">
                  Cada objetivo tem meta numerica, Key Results que provam chegada e iniciativas concretas. A logica e: Meta -&gt; KR -&gt; Iniciativa -&gt; Tarefa.
                </CardContent>
              </Card>
              <div className="space-y-3">
                {operational.okrs.map((okr) => {
                  const krs = scopedKrByOkr[okr.id] || [];
                  const progress = okrProgress(okr.id, okr.target_value > 0 ? Math.round((okr.current_value / okr.target_value) * 100) : 0);
                  const initiatives = metaInitiatives.filter((goal) => (goal as any).okr_id === okr.id || krs.some((kr) => kr.project_id && kr.project_id === (goal as any).project_id));
                  return (
                    <Card key={okr.id}>
                      <CardHeader className="pb-2">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <CardTitle className="text-base">{okr.title}</CardTitle>
                            <p className="text-xs text-muted-foreground">{okr.period || "Ciclo aberto"} - {progress}%</p>
                          </div>
                          <Badge variant="secondary">{progress >= 80 ? "No ritmo" : progress >= 40 ? "Atencao" : "A iniciar"}</Badge>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        {krs.map((kr) => {
                          const krProgress = Number(kr.target_value || 0) > 0 ? Math.min(100, Math.round((Number(kr.current_value || 0) / Number(kr.target_value || 0)) * 100)) : 0;
                          return (
                            <div key={kr.id} className="space-y-1">
                              <div className="flex items-center justify-between gap-2">
                                <p className="text-sm font-semibold">{kr.title}</p>
                                <Badge variant="outline">{scoreLabel(kr.confidence)}</Badge>
                              </div>
                              <p className="text-xs text-muted-foreground">Atual: {asNumber(kr.current_value, kr.unit)} - Meta: {asNumber(kr.target_value, kr.unit)}</p>
                              <Progress value={krProgress} className="h-2" />
                            </div>
                          );
                        })}
                        <div className="border-t pt-3">
                          <p className="text-xs font-semibold uppercase text-muted-foreground mb-2">Iniciativas que movem esses KRs</p>
                          {initiatives.slice(0, 5).map((goal) => (
                            <div key={goal.id} className="flex items-center justify-between gap-2 py-1.5">
                              <span className="text-sm">{goal.title}</span>
                              <Badge variant="outline">{goal.status}</Badge>
                            </div>
                          ))}
                          {initiatives.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma iniciativa vinculada diretamente.</p>}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
                {operational.okrs.length === 0 && <EmptyState label="Cadastre OKRs para construir Objetivos + Plano." />}
              </div>
            </TabsContent>

            <TabsContent value="timeline" className="mt-5 space-y-4">
              <Card className="bg-muted/30">
                <CardContent className="p-4 text-sm text-muted-foreground">
                  Este mapa mostra quando cada iniciativa acontece e como elas se encaixam sem se destruir.
                </CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle className="text-base">2026 - iniciativas por produto</CardTitle></CardHeader>
                <CardContent className="space-y-5 overflow-x-auto">
                  <div className="min-w-[720px] space-y-4">
                    <div className="grid grid-cols-[120px_repeat(8,1fr)] gap-2 text-xs font-semibold text-muted-foreground">
                      <span />
                      {monthLabels.map((month) => <span key={month}>{month}</span>)}
                    </div>
                    {Object.entries(groupedMetaInitiatives).map(([group, goals]) => (
                      <div key={group} className="space-y-2">
                        <p className="text-xs font-semibold uppercase text-muted-foreground">{group}</p>
                        {goals.map((goal) => {
                          const start = monthIndex(goal.start_date);
                          const end = Math.max(start + 1, monthIndex(goal.end_date) + 1);
                          return (
                            <div key={goal.id} className="grid grid-cols-[120px_1fr] gap-2 items-center">
                              <p className="text-xs font-medium truncate">{goal.title}</p>
                              <div className="relative h-7 rounded bg-muted">
                                <div
                                  className="absolute top-1 h-5 rounded bg-primary/70 px-2 text-[10px] leading-5 text-primary-foreground truncate"
                                  style={{ left: `${start * 12.5}%`, width: `${Math.max(12.5, (end - start) * 12.5)}%` }}
                                >
                                  {goal.title}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ))}
                    {metaInitiatives.length === 0 && <p className="text-sm text-muted-foreground text-center py-6">Sem iniciativas com data para exibir.</p>}
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 grid gap-3 md:grid-cols-2 text-sm text-muted-foreground">
                  <p>O mapa responde: estou fazendo coisas demais ao mesmo tempo?</p>
                  <p>Qual iniciativa comeca quando a anterior termina?</p>
                  <p>Tem trimestre vazio ou sobrecarregado?</p>
                  <p>O que precisa estar pronto para o proximo passo acontecer?</p>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="gap" className="mt-5 space-y-4">
              <Card className="bg-muted/30">
                <CardContent className="p-4 text-sm text-muted-foreground">
                  Gap analysis pergunta: se eu continuar fazendo o que estou fazendo, vou chegar onde quero?
                </CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle className="text-base">Como ler o gap</CardTitle></CardHeader>
                <CardContent className="overflow-x-auto">
                  <table className="w-full min-w-[720px] text-sm">
                    <thead className="text-xs uppercase text-muted-foreground">
                      <tr className="border-b">
                        <th className="py-2 text-left">Meta</th>
                        <th className="py-2 text-left">Hoje</th>
                        <th className="py-2 text-left">Projecao atual</th>
                        <th className="py-2 text-left">Meta</th>
                        <th className="py-2 text-left">Gap</th>
                        <th className="py-2 text-left">O que fecha</th>
                      </tr>
                    </thead>
                    <tbody>
                      {gapRows.map((row) => (
                        <tr key={row.name} className="border-b last:border-0">
                          <td className="py-2 font-medium">{row.name}</td>
                          <td className="py-2">{row.today}</td>
                          <td className="py-2">{row.projected}</td>
                          <td className="py-2">{row.target}</td>
                          <td className="py-2"><Badge variant={row.gap > 0 ? "destructive" : "secondary"}>{row.gap > 0 ? asNumber(row.gap, row.unit) : "Fechado"}</Badge></td>
                          <td className="py-2 text-muted-foreground">{row.closes}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {gapRows.length === 0 && <p className="text-sm text-muted-foreground text-center py-6">Cadastre metricas ou KRs para calcular gaps.</p>}
                </CardContent>
              </Card>
              {gapRows.some((row) => row.gap > 0) && (
                <Card className="border-destructive/50 bg-destructive/10">
                  <CardContent className="p-4">
                    <p className="font-semibold text-sm text-destructive mb-2"><Flame className="h-4 w-4 inline mr-1" />Gaps criticos precisam de acao agora</p>
                    <ol className="list-decimal pl-5 text-sm space-y-1">
                      {gapRows.filter((row) => row.gap > 0).slice(0, 4).map((row) => <li key={row.name}>{row.name} - falta {asNumber(row.gap, row.unit)}</li>)}
                    </ol>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="ifthen" className="mt-5 space-y-4">
              <Card className="bg-muted/30">
                <CardContent className="p-4 text-sm text-muted-foreground">
                  Todo planejamento é uma cadeia de apostas: se eu fizer X, então Y acontece. Quando a hipótese cai, você sabe exatamente o que revisar.
                </CardContent>
              </Card>
              <div className="space-y-3">
                {Object.entries(assumptionsByArea).map(([area, items]) => (
                  <Card key={area}>
                    <CardHeader><CardTitle className="text-sm uppercase text-muted-foreground">{area}</CardTitle></CardHeader>
                    <CardContent className="space-y-3">
                      {items.map((item) => (
                        <div key={item.id} className="flex items-start justify-between gap-3 border-b border-border/60 pb-3 last:border-0">
                          <div>
                            <p className="text-sm font-semibold">Se {item.assumption}</p>
                            <p className="text-sm text-muted-foreground">Entao {item.plan_impact || item.test_plan || "a meta precisa ser revisada com base no teste"}</p>
                          </div>
                          <Badge variant={item.status === "confirmed" ? "secondary" : item.status === "refuted" ? "destructive" : "outline"}>{item.status || "A testar"}</Badge>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                ))}
                {scopedAssumptions.length === 0 && <EmptyState label="Cadastre suposicoes para montar a tela Se -> Entao neste escopo." />}
              </div>
            </TabsContent>
          </Tabs>
        )}

        {currentDialog && (
          <CrudDialog
            title={currentDialog.title}
            open={!!editing}
            onOpenChange={(open) => !open && closeForm()}
            fields={currentDialog.fields}
            form={form}
            setForm={setForm}
            onSave={saveCurrent}
            isSaving={operational.isSaving}
          />
        )}

        <GoalModal
          open={showGoalModal}
          onClose={() => setShowGoalModal(false)}
          form={goalForm}
          setForm={setGoalForm}
          editingGoal={editingGoal}
          goals={planning.goals}
          okrs={operational.okrs}
          projects={operational.projects}
          onSave={saveGoal}
          isSaving={planning.isSaving}
        />
      </div>
    </EMSLayout>
  );
};

export default Planning;
