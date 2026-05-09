import { useEffect, useMemo, useState } from "react";
import { addMonths, format } from "date-fns";
import { BarChart3, CalendarClock, Clock, DollarSign, Edit2, Lightbulb, Plus, Target, Trash2, AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { GoalModal, MilestoneModal } from "@/components/ems/planning/PlanningModals";
import { GoalCard } from "@/components/ems/planning/GoalCard";
import { GoalFormData, MilestoneFormData, PlanningGoal, categories, getCategoryInfo, statusOptions, usePlanningData } from "@/hooks/usePlanningData";
import { operationalDefaults, scoreLabel, useOperationalPlanningData } from "@/hooks/useOperationalPlanningData";

type FormState = Record<string, any>;
type DialogType = "time" | "review" | "risk" | "assumption" | "impact";

const money = (value: number) => `R$ ${value.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
const today = () => new Date().toISOString().slice(0, 10);
const emptyGoalForm: GoalFormData = { title: "", description: "", category: "strategic", start_date: "", end_date: "", status: "pending", parent_id: "", okr_id: "", project_id: "" };
const emptyMilestoneForm: MilestoneFormData = { title: "", description: "", due_date: "" };

interface ProjectPlanningPanelProps {
  initialProjectId?: string;
}

export const ProjectPlanningPanel = ({ initialProjectId = "all" }: ProjectPlanningPanelProps) => {
  const planning = usePlanningData();
  const operational = useOperationalPlanningData();
  const [scopeProjectId, setScopeProjectId] = useState(initialProjectId || "all");
  const [expandedGoals, setExpandedGoals] = useState<Set<string>>(new Set());
  const [showGoalModal, setShowGoalModal] = useState(false);
  const [editingGoal, setEditingGoal] = useState<PlanningGoal | null>(null);
  const [goalForm, setGoalForm] = useState<GoalFormData>(emptyGoalForm);
  const [milestoneGoalId, setMilestoneGoalId] = useState<string | null>(null);
  const [milestoneForm, setMilestoneForm] = useState<MilestoneFormData>(emptyMilestoneForm);
  const [dialogType, setDialogType] = useState<DialogType | null>(null);
  const [editingRecord, setEditingRecord] = useState<{ id: string; type: DialogType } | null>(null);
  const [form, setForm] = useState<FormState>({});

  useEffect(() => {
    setScopeProjectId(initialProjectId || "all");
  }, [initialProjectId]);

  const selectedProject = scopeProjectId === "all" ? null : operational.projects.find((project) => project.id === scopeProjectId) || null;
  const scoped = (item: { project_id?: string | null }) => scopeProjectId === "all" || item.project_id === scopeProjectId;
  const scopedWithCompanyBase = (item: { project_id?: string | null }) => scopeProjectId === "all" || !item.project_id || item.project_id === scopeProjectId;
  const scopedGoals = useMemo(() => planning.goals.filter(scoped), [planning.goals, scopeProjectId]);
  const scopedRootGoals = useMemo(() => scopedGoals.filter((goal) => !goal.parent_id), [scopedGoals]);
  const scopedTime = useMemo(() => operational.timeAllocations.filter(scoped), [operational.timeAllocations, scopeProjectId]);
  const scopedReviews = useMemo(() => operational.reviews.filter(scoped), [operational.reviews, scopeProjectId]);
  const scopedRisks = useMemo(() => operational.risks.filter(scopedWithCompanyBase), [operational.risks, scopeProjectId]);
  const scopedAssumptions = useMemo(() => operational.assumptions.filter(scopedWithCompanyBase), [operational.assumptions, scopeProjectId]);
  const scopedImpacts = useMemo(() => operational.financialImpacts.filter(scoped), [operational.financialImpacts, scopeProjectId]);
  const avgProgress = scopedGoals.length ? Math.round(scopedGoals.reduce((sum, goal) => sum + Number(goal.progress || 0), 0) / scopedGoals.length) : 0;
  const timeTotals = scopedTime.reduce((acc, item) => {
    acc.planned += Number(item.planned_hours || 0);
    acc.actual += Number(item.actual_hours || 0);
    return acc;
  }, { planned: 0, actual: 0 });
  const impactTotals = scopedImpacts.reduce((acc, item) => {
    const amount = Number(item.expected_amount || 0);
    if (item.impact_type === "cost") acc.cost += amount;
    else acc.revenue += amount;
    acc.net += item.impact_type === "cost" ? -amount : amount;
    return acc;
  }, { revenue: 0, cost: 0, net: 0 });

  const scopeDefaults = (defaults: FormState) => ({
    ...defaults,
    project_id: scopeProjectId === "all" ? "none" : scopeProjectId,
  });

  const openGoal = (goal?: PlanningGoal) => {
    const now = new Date();
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
      project_id: goal.project_id || "",
    } : { ...emptyGoalForm, project_id: scopeProjectId === "all" ? "" : scopeProjectId, start_date: format(now, "yyyy-MM-dd"), end_date: format(addMonths(now, 1), "yyyy-MM-dd") });
    setShowGoalModal(true);
  };

  const saveGoal = async () => {
    if (!goalForm.title.trim()) return;
    await planning.saveGoal({ form: goalForm, editId: editingGoal?.id });
    setShowGoalModal(false);
    setEditingGoal(null);
    setGoalForm(emptyGoalForm);
  };

  const saveMilestone = async () => {
    if (!milestoneGoalId || !milestoneForm.title.trim()) return;
    await planning.saveMilestone({ form: milestoneForm, goalId: milestoneGoalId });
    setMilestoneGoalId(null);
    setMilestoneForm(emptyMilestoneForm);
  };

  const openDialog = (type: DialogType, defaults: FormState, item?: FormState) => {
    setDialogType(type);
    setEditingRecord(item?.id ? { id: item.id, type } : null);
    setForm(item ? { ...scopeDefaults(defaults), ...item, project_id: item.project_id || "none" } : scopeDefaults(defaults));
  };

  const saveDialog = async () => {
    const id = editingRecord?.id || null;
    if (dialogType === "time") await operational.saveTime(form, id);
    if (dialogType === "review") await operational.saveReview(form, id);
    if (dialogType === "risk") await operational.saveRisk(form, id);
    if (dialogType === "assumption") await operational.saveAssumption(form, id);
    if (dialogType === "impact") await operational.saveFinancialImpact(form, id);
    setDialogType(null);
    setEditingRecord(null);
    setForm({});
  };

  const deleteRecord = (type: DialogType, id: string) => {
    const tables: Record<DialogType, string> = {
      time: "planning_time_allocations",
      review: "review_cycles",
      risk: "planning_risks",
      assumption: "planning_assumptions",
      impact: "planning_financial_impacts",
    };
    return operational.deleteRecord(tables[type], id);
  };

  return (
    <div className="space-y-4">
      <Card className="border-border/60">
        <CardContent className="flex flex-col gap-3 p-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-semibold">{selectedProject ? `Plano do projeto: ${selectedProject.title}` : "Plano de todos os projetos"}</p>
            <p className="text-xs text-muted-foreground">Metas, marcos, planejamento semanal/mensal e riscos vinculados alimentam o grafo de vínculos.</p>
          </div>
          <Select value={scopeProjectId} onValueChange={setScopeProjectId}>
            <SelectTrigger className="w-full lg:w-[340px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os projetos</SelectItem>
              {operational.projects.map((project) => <SelectItem key={project.id} value={project.id}>{project.title}</SelectItem>)}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <div className="grid gap-3 md:grid-cols-5">
        {[
          { label: "Metas", value: scopedGoals.length, icon: Target },
          { label: "Progresso", value: `${avgProgress}%`, icon: BarChart3 },
          { label: "Planejado", value: `${timeTotals.planned}h`, icon: Clock },
          { label: "Real", value: `${timeTotals.actual}h`, icon: CalendarClock },
          { label: "Impacto", value: money(impactTotals.net), icon: DollarSign },
        ].map((item) => (
          <Card key={item.label} className="border-border/60">
            <CardContent className="p-3">
              <item.icon className="mb-2 h-4 w-4 text-primary" />
              <p className="text-xl font-bold tabular-nums">{item.value}</p>
              <p className="text-xs text-muted-foreground">{item.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="goals">
        <TabsList className="grid h-auto w-full grid-cols-2 md:grid-cols-5">
          <TabsTrigger value="goals">Metas</TabsTrigger>
          <TabsTrigger value="time">Semanal/Mensal</TabsTrigger>
          <TabsTrigger value="risks">Riscos</TabsTrigger>
          <TabsTrigger value="assumptions">Suposições</TabsTrigger>
          <TabsTrigger value="impact">Impacto</TabsTrigger>
        </TabsList>

        <TabsContent value="goals" className="mt-4 space-y-3">
          <div className="flex justify-end"><Button size="sm" onClick={() => openGoal()}><Plus className="mr-1 h-4 w-4" />Meta</Button></div>
          {scopedRootGoals.map((goal) => (
            <GoalCard
              key={goal.id}
              goal={goal}
              milestones={planning.getGoalMilestones(goal.id)}
              childGoals={planning.getChildGoals(goal.id)}
              isExpanded={expandedGoals.has(goal.id)}
              onToggleExpand={(id) => setExpandedGoals((current) => {
                const next = new Set(current);
                next.has(id) ? next.delete(id) : next.add(id);
                return next;
              })}
              onEdit={openGoal}
              onDelete={(id) => planning.deleteGoal(id)}
              onAddMilestone={(goalId) => setMilestoneGoalId(goalId)}
              onToggleMilestone={(milestone) => planning.toggleMilestone(milestone)}
              onDeleteMilestone={(id, goalId) => planning.deleteMilestone({ id, goalId })}
              getChildGoals={planning.getChildGoals}
              getGoalMilestones={planning.getGoalMilestones}
              expandedGoals={expandedGoals}
            />
          ))}
          {scopedRootGoals.length === 0 && <Empty label="Nenhuma meta vinculada a este escopo." />}
        </TabsContent>

        <TabsContent value="time" className="mt-4 space-y-3">
          <div className="flex flex-wrap justify-end gap-2">
            <Button size="sm" variant="outline" onClick={() => openDialog("time", operationalDefaults.time)}><Plus className="mr-1 h-4 w-4" />Horas</Button>
            <Button size="sm" onClick={() => openDialog("review", operationalDefaults.review)}><Plus className="mr-1 h-4 w-4" />Revisão</Button>
          </div>
          <div className="grid gap-3 lg:grid-cols-2">
            {scopedTime.map((item) => (
              <Card key={item.id}><CardContent className="p-4">
                <div className="flex justify-between gap-3">
                  <div><p className="font-semibold">{item.category}</p><p className="text-xs text-muted-foreground">{item.week_start} - {item.horizon}</p></div>
                  <Badge variant="outline">{item.actual_hours || 0}/{item.planned_hours || 0}h</Badge>
                </div>
                {item.notes && <p className="mt-2 text-sm text-muted-foreground">{item.notes}</p>}
                <Actions onEdit={() => openDialog("time", operationalDefaults.time, item)} onDelete={() => deleteRecord("time", item.id)} />
              </CardContent></Card>
            ))}
            {scopedReviews.map((item) => (
              <Card key={item.id}><CardContent className="p-4">
                <div className="flex justify-between gap-3">
                  <div><p className="font-semibold">{item.cycle_type === "monthly" ? "Revisão mensal" : "Revisão semanal"}</p><p className="text-xs text-muted-foreground">{item.period_start} - {item.period_end}</p></div>
                  <Badge variant="secondary">{item.cycle_type}</Badge>
                </div>
                {item.summary && <p className="mt-2 text-sm">{item.summary}</p>}
                {item.next_actions && <p className="mt-1 text-sm text-muted-foreground">{item.next_actions}</p>}
                <Actions onEdit={() => openDialog("review", operationalDefaults.review, item)} onDelete={() => deleteRecord("review", item.id)} />
              </CardContent></Card>
            ))}
          </div>
          {scopedTime.length + scopedReviews.length === 0 && <Empty label="Nenhum planejamento semanal ou mensal neste escopo." />}
        </TabsContent>

        <TabsContent value="risks" className="mt-4 space-y-3">
          <div className="flex justify-end"><Button size="sm" onClick={() => openDialog("risk", operationalDefaults.risk)}><Plus className="mr-1 h-4 w-4" />Risco</Button></div>
          <div className="grid gap-3 md:grid-cols-2">
            {scopedRisks.map((item) => (
              <Card key={item.id} className={Number(item.score || 0) >= 6 ? "border-destructive/40" : ""}><CardContent className="p-4">
                <div className="flex justify-between gap-3"><p className="font-semibold">{item.risk}</p><Badge variant={Number(item.score || 0) >= 6 ? "destructive" : "outline"}>Score {item.score || 0}</Badge></div>
                <p className="mt-1 text-sm text-muted-foreground">Prob. {scoreLabel(item.probability)} / impacto {scoreLabel(item.impact)}</p>
                {item.mitigation && <p className="mt-2 text-sm">{item.mitigation}</p>}
                <Actions onEdit={() => openDialog("risk", operationalDefaults.risk, item)} onDelete={() => deleteRecord("risk", item.id)} />
              </CardContent></Card>
            ))}
          </div>
          {scopedRisks.length === 0 && <Empty label="Nenhum risco registrado." />}
        </TabsContent>

        <TabsContent value="assumptions" className="mt-4 space-y-3">
          <div className="flex justify-end"><Button size="sm" onClick={() => openDialog("assumption", operationalDefaults.assumption)}><Plus className="mr-1 h-4 w-4" />Suposição</Button></div>
          <div className="grid gap-3 md:grid-cols-2">
            {scopedAssumptions.map((item) => (
              <Card key={item.id}><CardContent className="p-4">
                <div className="flex justify-between gap-3"><p className="font-semibold">{item.assumption}</p><Badge variant="outline">{item.status}</Badge></div>
                {item.test_plan && <p className="mt-2 text-sm text-muted-foreground">{item.test_plan}</p>}
                {item.learning && <p className="mt-2 text-sm">{item.learning}</p>}
                <Actions onEdit={() => openDialog("assumption", operationalDefaults.assumption, item)} onDelete={() => deleteRecord("assumption", item.id)} />
              </CardContent></Card>
            ))}
          </div>
          {scopedAssumptions.length === 0 && <Empty label="Nenhuma suposição registrada." />}
        </TabsContent>

        <TabsContent value="impact" className="mt-4 space-y-3">
          <div className="grid gap-3 md:grid-cols-3">
            <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">Receita</p><p className="text-xl font-bold">{money(impactTotals.revenue)}</p></CardContent></Card>
            <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">Custo</p><p className="text-xl font-bold">{money(impactTotals.cost)}</p></CardContent></Card>
            <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">Líquido</p><p className="text-xl font-bold">{money(impactTotals.net)}</p></CardContent></Card>
          </div>
          <div className="flex justify-end"><Button size="sm" onClick={() => openDialog("impact", operationalDefaults.financialImpact)}><Plus className="mr-1 h-4 w-4" />Impacto</Button></div>
          {scopedImpacts.map((item) => (
            <Card key={item.id}><CardContent className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div><p className="font-semibold">{item.title}</p><p className="text-xs text-muted-foreground">{item.expected_date || "Sem data"} - {scoreLabel(item.confidence)}</p></div>
              <div className="flex items-center gap-2"><Badge variant={item.impact_type === "cost" ? "destructive" : "secondary"}>{money(Number(item.expected_amount || 0))}</Badge><Actions compact onEdit={() => openDialog("impact", operationalDefaults.financialImpact, item)} onDelete={() => deleteRecord("impact", item.id)} /></div>
            </CardContent></Card>
          ))}
          {scopedImpacts.length === 0 && <Empty label="Nenhum impacto financeiro planejado." />}
        </TabsContent>
      </Tabs>

      <GoalModal open={showGoalModal} onClose={() => setShowGoalModal(false)} form={goalForm} setForm={setGoalForm} editingGoal={editingGoal} goals={planning.goals} okrs={operational.okrs} projects={operational.projects} onSave={saveGoal} isSaving={planning.isSaving} />
      <MilestoneModal open={!!milestoneGoalId} onClose={() => setMilestoneGoalId(null)} form={milestoneForm} setForm={setMilestoneForm} onSave={saveMilestone} isSaving={planning.isSaving} />
      <PlanningRecordDialog type={dialogType} form={form} setForm={setForm} projects={operational.projects} onClose={() => setDialogType(null)} onSave={saveDialog} />
    </div>
  );
};

const Empty = ({ label }: { label: string }) => (
  <Card className="border-dashed"><CardContent className="py-8 text-center text-sm text-muted-foreground">{label}</CardContent></Card>
);

const Actions = ({ onEdit, onDelete, compact = false }: { onEdit: () => void; onDelete: () => void; compact?: boolean }) => (
  <div className={`flex justify-end gap-1 ${compact ? "" : "mt-2"}`}>
    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onEdit}><Edit2 className="h-3.5 w-3.5" /></Button>
    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={onDelete}><Trash2 className="h-3.5 w-3.5" /></Button>
  </div>
);

const PlanningRecordDialog = ({ type, form, setForm, projects, onClose, onSave }: {
  type: DialogType | null;
  form: FormState;
  setForm: (form: FormState) => void;
  projects: { id: string; title: string }[];
  onClose: () => void;
  onSave: () => void;
}) => {
  const title = type === "time" ? "Planejamento semanal" : type === "review" ? "Revisão mensal/semanal" : type === "risk" ? "Risco" : type === "assumption" ? "Suposição" : "Impacto financeiro";
  return (
    <Dialog open={!!type} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-[95vw] overflow-y-auto sm:max-w-xl">
        <DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>
        <div className="grid gap-3">
          {type === "time" && (
            <>
              <Field label="Semana" type="date" value={form.week_start || today()} onChange={(week_start) => setForm({ ...form, week_start })} />
              <Field label="Categoria" value={form.category || ""} onChange={(category) => setForm({ ...form, category })} />
              <div className="grid grid-cols-2 gap-3">
                <Field label="Horas planejadas" type="number" value={form.planned_hours || ""} onChange={(planned_hours) => setForm({ ...form, planned_hours })} />
                <Field label="Horas reais" type="number" value={form.actual_hours || ""} onChange={(actual_hours) => setForm({ ...form, actual_hours })} />
              </div>
              <Textarea value={form.notes || ""} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Notas" />
            </>
          )}
          {type === "review" && (
            <>
              <Select value={form.cycle_type || "weekly"} onValueChange={(cycle_type) => setForm({ ...form, cycle_type })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="weekly">Semanal</SelectItem><SelectItem value="monthly">Mensal</SelectItem><SelectItem value="quarterly">Trimestral</SelectItem></SelectContent>
              </Select>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Início" type="date" value={form.period_start || today()} onChange={(period_start) => setForm({ ...form, period_start })} />
                <Field label="Fim" type="date" value={form.period_end || today()} onChange={(period_end) => setForm({ ...form, period_end })} />
              </div>
              <Textarea value={form.summary || ""} onChange={(e) => setForm({ ...form, summary: e.target.value })} placeholder="Resumo" />
              <Textarea value={form.next_actions || ""} onChange={(e) => setForm({ ...form, next_actions: e.target.value })} placeholder="Próximas ações" />
            </>
          )}
          {type === "risk" && (
            <>
              <Field label="Risco" value={form.risk || ""} onChange={(risk) => setForm({ ...form, risk })} />
              <div className="grid grid-cols-2 gap-3">
                <SimpleSelect label="Probabilidade" value={form.probability || "medium"} onChange={(probability) => setForm({ ...form, probability })} />
                <SimpleSelect label="Impacto" value={form.impact || "medium"} onChange={(impact) => setForm({ ...form, impact })} />
              </div>
              <Textarea value={form.mitigation || ""} onChange={(e) => setForm({ ...form, mitigation: e.target.value })} placeholder="Mitigação" />
            </>
          )}
          {type === "assumption" && (
            <>
              <Field label="Suposição" value={form.assumption || ""} onChange={(assumption) => setForm({ ...form, assumption })} />
              <Textarea value={form.test_plan || ""} onChange={(e) => setForm({ ...form, test_plan: e.target.value })} placeholder="Plano de teste" />
              <Textarea value={form.learning || ""} onChange={(e) => setForm({ ...form, learning: e.target.value })} placeholder="Aprendizado" />
            </>
          )}
          {type === "impact" && (
            <>
              <Field label="Título" value={form.title || ""} onChange={(title) => setForm({ ...form, title })} />
              <Select value={form.impact_type || "revenue"} onValueChange={(impact_type) => setForm({ ...form, impact_type })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="revenue">Receita</SelectItem><SelectItem value="cost">Custo</SelectItem><SelectItem value="cash">Caixa</SelectItem><SelectItem value="margin">Margem</SelectItem></SelectContent>
              </Select>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Valor esperado" type="number" value={form.expected_amount || ""} onChange={(expected_amount) => setForm({ ...form, expected_amount })} />
                <Field label="Data esperada" type="date" value={form.expected_date || ""} onChange={(expected_date) => setForm({ ...form, expected_date })} />
              </div>
            </>
          )}
          <Select value={form.project_id || "none"} onValueChange={(project_id) => setForm({ ...form, project_id })}>
            <SelectTrigger><SelectValue placeholder="Projeto" /></SelectTrigger>
            <SelectContent><SelectItem value="none">Todos/empresa</SelectItem>{projects.map((project) => <SelectItem key={project.id} value={project.id}>{project.title}</SelectItem>)}</SelectContent>
          </Select>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={onClose}>Cancelar</Button>
            <Button onClick={onSave}>Salvar</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

const Field = ({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (value: string) => void; type?: string }) => (
  <div>
    <Label className="text-xs text-muted-foreground">{label}</Label>
    <Input type={type} value={value} onChange={(e) => onChange(e.target.value)} />
  </div>
);

const SimpleSelect = ({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) => (
  <div>
    <Label className="text-xs text-muted-foreground">{label}</Label>
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger><SelectValue /></SelectTrigger>
      <SelectContent><SelectItem value="low">Baixa</SelectItem><SelectItem value="medium">Média</SelectItem><SelectItem value="high">Alta</SelectItem></SelectContent>
    </Select>
  </div>
);
