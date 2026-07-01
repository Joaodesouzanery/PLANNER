import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  Activity,
  Bot,
  BookOpen,
  Briefcase,
  Building2,
  CalendarClock,
  CheckCircle2,
  DollarSign,
  FileText,
  Flag,
  FolderKanban,
  Inbox,
  ListChecks,
  ListTodo,
  Save,
  ShieldCheck,
} from "lucide-react";
import { addDays, addMonths, endOfWeek, format, startOfWeek, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { AIBriefingPanel } from "@/components/ems/AIBriefingPanel";
import { CapacityCheckinPanel } from "@/components/ems/CapacityCheckinPanel";
import { DecisionLogPanel } from "@/components/ems/DecisionLogPanel";
import { EMSLayout } from "@/components/ems/EMSLayout";
import { InboxTriagePanel } from "@/components/ems/InboxTriagePanel";
import { TrueNorthPanel } from "@/components/ems/TrueNorthPanel";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const AREA_OPTIONS = ["geral", "projetos", "comercial", "financeiro", "academico", "administrativo"];

const isDone = (status?: string | null) => ["done", "completed", "concluido", "concluído"].includes(String(status || "").toLowerCase());
const money = (value: number) => value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const taskPriorityOrder: Record<string, number> = { urgent: 0, high: 1, medium: 2, low: 3 };
const taskPriorityLabel: Record<string, string> = { urgent: "Urgente", high: "Alta", medium: "Média", low: "Baixa" };
const taskPriorityClass: Record<string, string> = {
  urgent: "border-red-500/30 bg-red-500/10 text-red-500",
  high: "border-orange-500/30 bg-orange-500/10 text-orange-500",
  medium: "border-yellow-500/30 bg-yellow-500/10 text-yellow-500",
  low: "border-blue-500/30 bg-blue-500/10 text-blue-500",
};

const DailyReport = () => {
  const { selectedCompanyId, companies } = useCompany();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const today = format(new Date(), "yyyy-MM-dd");
  const [selectedDate, setSelectedDate] = useState(today);
  const [viewMode, setViewMode] = useState("daily");
  const [clientId, setClientId] = useState("all");
  const [projectId, setProjectId] = useState("all");
  const [area, setArea] = useState("geral");
  const [form, setForm] = useState({ decisions: "", notes: "", blockers: "" });
  const hasCompanyFilter = selectedCompanyId !== "all";
  const effectiveCompanyId = clientId !== "all" ? clientId : hasCompanyFilter ? selectedCompanyId : "all";
  const hasEffectiveCompanyFilter = effectiveCompanyId !== "all";
  const availableClients = hasCompanyFilter ? companies.filter((company) => company.id === selectedCompanyId) : companies;

  const dateWindow = useMemo(() => {
    const base = new Date(`${selectedDate}T12:00:00`);
    return {
      yesterday: format(subDays(base, 1), "yyyy-MM-dd"),
      today: selectedDate,
      tomorrow: format(addDays(base, 1), "yyyy-MM-dd"),
      weekStart: format(startOfWeek(base, { locale: ptBR }), "yyyy-MM-dd"),
      weekEnd: format(endOfWeek(base, { locale: ptBR }), "yyyy-MM-dd"),
      monthEnd: format(addMonths(base, 1), "yyyy-MM-dd"),
    };
  }, [selectedDate]);

  const companyFilter = (query: any) => hasEffectiveCompanyFilter ? query.eq("company_id", effectiveCompanyId) : query;

  const { data: projects = [] } = useQuery({
    queryKey: ["daily-projects", selectedCompanyId, clientId],
    staleTime: 1000 * 60 * 5,
    queryFn: async () => {
      let q = (supabase as any).from("projects").select("id,title,status,due_date,client,next_invoice_date,company_id").order("title");
      q = companyFilter(q);
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
  });

  const { data: tasks = [] } = useQuery({
    queryKey: ["daily-tasks", selectedCompanyId, clientId, projectId, dateWindow.weekStart, dateWindow.monthEnd],
    staleTime: 1000 * 60,
    queryFn: async () => {
      let q = (supabase as any)
        .from("tasks")
        .select("id,title,status,priority,due_date,project_id,company_id")
        .not("due_date", "is", null)
        .gte("due_date", dateWindow.yesterday)
        .lte("due_date", dateWindow.monthEnd)
        .order("due_date");
      q = companyFilter(q);
      if (projectId !== "all") q = q.eq("project_id", projectId);
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
  });

  const { data: transactions = [] } = useQuery({
    queryKey: ["daily-financial", selectedCompanyId, clientId, dateWindow.yesterday, dateWindow.monthEnd],
    staleTime: 1000 * 60 * 2,
    queryFn: async () => {
      let q = (supabase as any)
        .from("financial_transactions")
        .select("id,description,amount,type,date,category,company_id")
        .gte("date", dateWindow.yesterday)
        .lte("date", dateWindow.monthEnd)
        .order("date");
      q = companyFilter(q);
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
  });

  const { data: commercialActions = [] } = useQuery({
    queryKey: ["daily-commercial", selectedCompanyId, clientId, dateWindow.yesterday, dateWindow.monthEnd],
    staleTime: 1000 * 60 * 2,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("commercial_contact_meta")
        .select("id,next_action_date,next_action_description,temperature,priority,contact:contacts(name,company,company_id)")
        .not("next_action_date", "is", null)
        .gte("next_action_date", dateWindow.yesterday)
        .lte("next_action_date", dateWindow.monthEnd);
      if (error) throw error;
      return hasEffectiveCompanyFilter ? (data || []).filter((item: any) => item.contact?.company_id === effectiveCompanyId) : (data || []);
    },
  });

  const { data: faculdadeTasks = [] } = useQuery({
    queryKey: ["daily-faculdade-tarefas", dateWindow.weekStart, dateWindow.monthEnd],
    staleTime: 1000 * 60 * 3,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("faculdade_tarefas")
        .select("id,title,due_date,status")
        .not("due_date", "is", null)
        .gte("due_date", dateWindow.yesterday)
        .lte("due_date", dateWindow.monthEnd);
      if (error) throw error;
      return data || [];
    },
  });

  const { data: exams = [] } = useQuery({
    queryKey: ["daily-faculdade-provas", dateWindow.weekStart, dateWindow.monthEnd],
    staleTime: 1000 * 60 * 3,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("faculdade_provas")
        .select("id,title,exam_date")
        .gte("exam_date", dateWindow.yesterday)
        .lte("exam_date", dateWindow.monthEnd);
      if (error) throw error;
      return data || [];
    },
  });

  const { data: events = [] } = useQuery({
    queryKey: ["daily-events", selectedCompanyId, clientId, dateWindow.weekStart, dateWindow.monthEnd],
    staleTime: 1000 * 60 * 2,
    queryFn: async () => {
      let q = (supabase as any)
        .from("calendar_events")
        .select("id,title,start_date,color,company_id")
        .gte("start_date", dateWindow.yesterday)
        .lte("start_date", dateWindow.monthEnd)
        .order("start_date");
      q = companyFilter(q);
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
  });

  const { data: governance = [] } = useQuery({
    queryKey: ["daily-governance", selectedCompanyId, clientId, dateWindow.weekStart, dateWindow.monthEnd],
    staleTime: 1000 * 60 * 2,
    queryFn: async () => {
      let q = (supabase as any)
        .from("governance_items")
        .select("id,title,category,priority,status,due_date,company_id")
        .not("due_date", "is", null)
        .lte("due_date", dateWindow.monthEnd)
        .order("due_date");
      q = companyFilter(q);
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
  });

  // Rotinas sao user-scoped (sem company_id) — query direta.
  const { data: routineTasks = [] } = useQuery({
    queryKey: ["daily-routine-tasks"],
    staleTime: 1000 * 60,
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("routine_tasks").select("id,title,due_date,status,completed_at,client_id");
      if (error) return [];
      return data || [];
    },
  });

  const { data: routineClients = [] } = useQuery({
    queryKey: ["daily-routine-clients"],
    staleTime: 1000 * 60,
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("routine_clients").select("id,name,invoice_day,status");
      if (error) return [];
      return data || [];
    },
  });

  const { data: inboxPending = [] } = useQuery({
    queryKey: ["daily-inbox", selectedCompanyId, clientId],
    staleTime: 1000 * 30,
    queryFn: async () => {
      let q = (supabase as any)
        .from("unified_inbox")
        .select("id,title,priority,due_date,status")
        .neq("status", "triaged")
        .order("created_at", { ascending: false })
        .limit(12);
      q = companyFilter(q);
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
  });

  const { data: capacityCheckins = [] } = useQuery({
    queryKey: ["daily-capacity", selectedCompanyId, clientId],
    staleTime: 1000 * 60,
    queryFn: async () => {
      let q = (supabase as any)
        .from("capacity_checkins")
        .select("id,checkin_date,energy,workload,focus,mood")
        .order("checkin_date", { ascending: false })
        .limit(1);
      q = companyFilter(q);
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
  });

  const { data: expiringDocuments = [] } = useQuery({
    queryKey: ["daily-documents", selectedCompanyId, clientId, dateWindow.monthEnd],
    staleTime: 1000 * 60 * 2,
    queryFn: async () => {
      let q = (supabase as any)
        .from("attachments")
        .select("id,file_name,document_type,expires_at,alert_days,company_id,client_company_id")
        .not("expires_at", "is", null)
        .lte("expires_at", dateWindow.monthEnd)
        .order("expires_at", { ascending: true })
        .limit(20);
      if (hasEffectiveCompanyFilter) q = q.or(`company_id.eq.${effectiveCompanyId},client_company_id.eq.${effectiveCompanyId}`);
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
  });

  const { data: report = null } = useQuery({
    queryKey: ["daily-report-entry", selectedCompanyId, clientId, selectedDate, projectId, area],
    staleTime: 1000 * 30,
    queryFn: async () => {
      let q = (supabase as any)
        .from("daily_reports")
        .select("*")
        .eq("report_date", selectedDate)
        .eq("area", area);
      q = hasEffectiveCompanyFilter ? q.eq("company_id", effectiveCompanyId) : q.is("company_id", null);
      q = projectId !== "all" ? q.eq("project_id", projectId) : q.is("project_id", null);
      const { data, error } = await q.maybeSingle();
      if (error) throw error;
      setForm({ decisions: data?.decisions || "", notes: data?.notes || "", blockers: data?.blockers || "" });
      return data;
    },
  });

  const saveReport = useMutation({
    mutationFn: async () => {
      const payload = {
        report_date: selectedDate,
        area,
        project_id: projectId === "all" ? null : projectId,
        company_id: hasEffectiveCompanyFilter ? effectiveCompanyId : null,
        decisions: form.decisions || null,
        notes: form.notes || null,
        blockers: form.blockers || null,
      };
      const query = (supabase as any).from("daily_reports");
      const { error } = report?.id ? await query.update(payload).eq("id", report.id) : await query.insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["daily-report-entry"] });
      toast({ title: "Diário executivo salvo" });
    },
    onError: (error: any) => toast({ title: "Erro ao salvar", description: error?.message, variant: "destructive" }),
  });

  const projectFilteredProjects = useMemo(() => projectId === "all" ? projects : projects.filter((p: any) => p.id === projectId), [projects, projectId]);
  const todayTasks = tasks.filter((t: any) => t.due_date === selectedDate);
  const yesterdayTasks = tasks.filter((t: any) => t.due_date === dateWindow.yesterday);
  const weekTasks = tasks.filter((t: any) => t.due_date >= dateWindow.weekStart && t.due_date <= dateWindow.weekEnd);
  const sortTasksByPriority = (items: any[]) => [...items].sort((a, b) => {
    const priorityDiff = (taskPriorityOrder[a.priority] ?? 2) - (taskPriorityOrder[b.priority] ?? 2);
    if (priorityDiff !== 0) return priorityDiff;
    return String(a.due_date || "").localeCompare(String(b.due_date || "")) || String(a.title || "").localeCompare(String(b.title || ""));
  });
  const todayTasksByPriority = sortTasksByPriority(todayTasks);
  const weekTasksByPriority = sortTasksByPriority(weekTasks.filter((task: any) => task.due_date !== selectedDate));
  const overdueTasks = tasks.filter((t: any) => t.due_date < selectedDate && !isDone(t.status));
  const completedToday = todayTasks.filter((t: any) => isDone(t.status)).length;
  const incomeToday = transactions.filter((t: any) => t.date === selectedDate && t.type === "income").reduce((sum: number, item: any) => sum + Number(item.amount || 0), 0);
  const expenseToday = transactions.filter((t: any) => t.date === selectedDate && t.type === "expense").reduce((sum: number, item: any) => sum + Number(item.amount || 0), 0);
  const monthlyProjection = transactions.filter((t: any) => t.type === "income").reduce((sum: number, item: any) => sum + Number(item.amount || 0), 0);
  const invoices = projectFilteredProjects.filter((p: any) => p.next_invoice_date && p.next_invoice_date <= dateWindow.monthEnd);
  const delayedProjects = projectFilteredProjects.filter((p: any) => p.due_date && p.due_date < selectedDate && !isDone(p.status));
  const hotOpportunities = commercialActions.filter((a: any) => a.temperature === "hot" || a.priority === "high");
  const criticalGovernance = governance.filter((item: any) => item.due_date <= dateWindow.weekEnd && !isDone(item.status));
  const latestCapacity = capacityCheckins[0];
  const capacityRisk = latestCapacity && (Number(latestCapacity.energy) <= 2 || Number(latestCapacity.workload) >= 5);
  const documentAlerts = expiringDocuments.filter((doc: any) => {
    const due = Math.ceil((new Date(`${doc.expires_at}T12:00:00`).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
    return due >= 0 && due <= Number(doc.alert_days || 30);
  });
  const routineOpen = (routineTasks as any[]).filter((t) => !isDone(t.status)).length;
  const routineOverdue = (routineTasks as any[]).filter((t) => t.due_date && t.due_date < selectedDate && !isDone(t.status)).length;
  const routineDoneToday = (routineTasks as any[]).filter((t) => isDone(t.status) && String(t.completed_at || "").slice(0, 10) === selectedDate).length;

  const client360 = useMemo(() => {
    const clientList = clientId === "all" ? availableClients : availableClients.filter((company) => company.id === clientId);
    return clientList.map((company) => {
      const clientProjects = projects.filter((project: any) => project.company_id === company.id);
      const projectIds = new Set(clientProjects.map((project: any) => project.id));
      const clientTasks = tasks.filter((task: any) => task.company_id === company.id || projectIds.has(task.project_id));
      const clientDocs = expiringDocuments.filter((doc: any) => doc.company_id === company.id || doc.client_company_id === company.id);
      const clientGovernance = governance.filter((item: any) => item.company_id === company.id);
      const clientCommercial = commercialActions.filter((item: any) => item.contact?.company_id === company.id);
      return {
        id: company.id,
        name: company.name,
        projects: clientProjects,
        tasks: clientTasks,
        overdue: clientTasks.filter((task: any) => task.due_date < selectedDate && !isDone(task.status)),
        invoices: clientProjects.filter((project: any) => project.next_invoice_date && project.next_invoice_date <= dateWindow.monthEnd),
        documents: clientDocs,
        governance: clientGovernance.filter((item: any) => !isDone(item.status)),
        commercial: clientCommercial,
      };
    });
  }, [availableClients, clientId, commercialActions, dateWindow.monthEnd, expiringDocuments, governance, projects, selectedDate, tasks]);

  const project360 = projectFilteredProjects.map((project: any) => {
    const projectTasks = tasks.filter((task: any) => task.project_id === project.id);
    return {
      ...project,
      tasks: projectTasks,
      overdue: projectTasks.filter((task: any) => task.due_date < selectedDate && !isDone(task.status)),
      governance: governance.filter((item: any) => item.company_id === project.company_id && !isDone(item.status)),
      commercial: commercialActions.filter((item: any) => item.contact?.company_id === project.company_id),
      documents: expiringDocuments.filter((doc: any) => doc.company_id === project.company_id || doc.client_company_id === project.company_id),
    };
  });

  const timeline = [
    ...todayTasks.map((item: any) => ({ date: item.due_date, type: "Tarefa", title: item.title, tone: "blue" })),
    ...events.map((item: any) => ({ date: item.start_date?.slice(0, 10), type: "Evento", title: item.title, tone: "emerald" })),
    ...commercialActions.map((item: any) => ({ date: item.next_action_date, type: "Comercial", title: item.next_action_description || item.contact?.name || "Follow-up", tone: "amber" })),
    ...invoices.map((item: any) => ({ date: item.next_invoice_date, type: "Nota fiscal", title: item.title, tone: "purple" })),
    ...faculdadeTasks.map((item: any) => ({ date: item.due_date, type: "Faculdade", title: item.title, tone: "cyan" })),
    ...exams.map((item: any) => ({ date: item.exam_date, type: "Prova", title: item.title, tone: "red" })),
    ...governance.map((item: any) => ({ date: item.due_date, type: item.category, title: item.title, tone: "rose" })),
    ...documentAlerts.map((item: any) => ({ date: item.expires_at, type: "Documento", title: item.file_name, tone: "amber" })),
    ...(routineTasks as any[]).filter((t) => t.due_date && !isDone(t.status)).map((t) => ({ date: t.due_date, type: "Rotina", title: t.title, tone: "cyan" })),
    ...(routineClients as any[]).filter((c) => c.invoice_day && c.status !== "inactive").map((c) => {
      const base = new Date(`${selectedDate}T12:00:00`);
      const y = base.getFullYear();
      const m = base.getMonth();
      const day = Math.min(Number(c.invoice_day), new Date(y, m + 1, 0).getDate());
      return { date: `${y}-${String(m + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`, type: "Nota fiscal", title: `NF ${c.name}`, tone: "purple" };
    }),
  ]
    .filter((item) => item.date && item.date <= dateWindow.monthEnd)
    .sort((a, b) => String(a.date).localeCompare(String(b.date)))
    .slice(0, 28);

  const radar = [
    { label: "Tarefas", icon: ListTodo, value: `${todayTasks.length} hoje`, sub: `${overdueTasks.length} vencidas · ${completedToday} entregues`, tone: overdueTasks.length ? "red" : "blue" },
    { label: "Comercial", icon: Briefcase, value: `${hotOpportunities.length} quentes`, sub: `${commercialActions.length} follow-ups no radar`, tone: hotOpportunities.length ? "amber" : "emerald" },
    { label: "Financeiro", icon: DollarSign, value: money(incomeToday), sub: `${money(expenseToday)} despesas · ${money(monthlyProjection)} projeção`, tone: "emerald" },
    { label: "Projetos", icon: FolderKanban, value: `${projectFilteredProjects.length} projetos`, sub: `${delayedProjects.length} atrasados · ${invoices.length} próximas NFs`, tone: delayedProjects.length ? "red" : "purple" },
    { label: "Faculdade", icon: BookOpen, value: `${faculdadeTasks.length} tarefas`, sub: `${exams.length} provas próximas`, tone: "cyan" },
    { label: "Conselho", icon: ShieldCheck, value: `${criticalGovernance.length} alertas`, sub: "Jurídico, contábil, crises e stack", tone: criticalGovernance.length ? "red" : "emerald" },
    { label: "Rotinas", icon: ListChecks, value: `${routineOpen} abertas`, sub: `${routineOverdue} atrasadas · ${routineDoneToday} feitas hoje`, tone: routineOverdue ? "red" : "emerald" },
    { label: "Inbox", icon: Inbox, value: `${inboxPending.length} pendentes`, sub: "Capturas sem triagem", tone: inboxPending.length ? "amber" : "emerald" },
    { label: "Capacidade", icon: Activity, value: latestCapacity ? `Energia ${latestCapacity.energy}` : "Sem check-in", sub: latestCapacity ? `Carga ${latestCapacity.workload} · Foco ${latestCapacity.focus}` : "Pulso humano pendente", tone: capacityRisk ? "red" : "blue" },
    { label: "IA", icon: Bot, value: "Briefing", sub: "Síntese assistida, sem ações automáticas", tone: "purple" },
  ];

  const briefingStats = {
    todayTasks: todayTasks.length,
    weekTasks: weekTasks.length,
    overdueTasks: overdueTasks.length,
    delayedProjects: delayedProjects.length,
    criticalGovernance: criticalGovernance.length,
    expiringDocuments: documentAlerts.length,
    inboxPending: inboxPending.length,
    capacityRisk: Boolean(capacityRisk),
    hotOpportunities: hotOpportunities.length,
    invoices: invoices.length,
  };

  const projectTitle = (id?: string | null) => projects.find((project: any) => project.id === id)?.title || "Sem projeto";
  const renderPriorityTask = (task: any) => (
    <div key={task.id} className="rounded-lg border border-border/50 p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className={cn("truncate text-sm font-semibold", isDone(task.status) && "line-through text-muted-foreground")}>{task.title}</p>
          <p className="mt-1 text-xs text-muted-foreground">{projectTitle(task.project_id)} · {dateLabel(task.due_date)}</p>
        </div>
        <Badge variant="outline" className={cn("shrink-0 text-[10px]", taskPriorityClass[task.priority] || taskPriorityClass.medium)}>
          {taskPriorityLabel[task.priority] || "Média"}
        </Badge>
      </div>
      <div className="mt-2 flex items-center gap-2">
        <Badge variant={isDone(task.status) ? "secondary" : "outline"} className="text-[10px]">
          {isDone(task.status) ? "Concluída" : "Aberta"}
        </Badge>
      </div>
    </div>
  );

  return (
    <EMSLayout>
      <div className="space-y-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Flag className="h-6 w-6 text-primary" /> Daily Report
            </h1>
            <p className="text-sm text-muted-foreground">Visão 360° da operação, prioridades e decisões do dia.</p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-2">
            <Input type="date" value={selectedDate} onChange={(event) => setSelectedDate(event.target.value)} />
            <Select value={viewMode} onValueChange={setViewMode}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="daily">Diário</SelectItem>
                <SelectItem value="weekly">Semanal</SelectItem>
                <SelectItem value="monthly">Mensal</SelectItem>
              </SelectContent>
            </Select>
            <Select value={clientId} onValueChange={(value) => { setClientId(value); setProjectId("all"); }}>
              <SelectTrigger><SelectValue placeholder="Cliente/empresa" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os clientes</SelectItem>
                {availableClients.map((company) => <SelectItem key={company.id} value={company.id}>{company.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={projectId} onValueChange={setProjectId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os projetos</SelectItem>
                {projects.map((project: any) => <SelectItem key={project.id} value={project.id}>{project.title}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={area} onValueChange={setArea}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {AREA_OPTIONS.map((option) => <SelectItem key={option} value={option}>{option}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        <TrueNorthPanel compact />

        <div className="grid gap-3 md:grid-cols-4">
          {[
            { label: "Modo", value: viewMode === "daily" ? "Diário" : viewMode === "weekly" ? "Semanal" : "Mensal", sub: "Cadência selecionada" },
            { label: "Hoje", value: `${todayTasks.length} itens`, sub: `${completedToday} concluídos` },
            { label: "Ontem", value: `${yesterdayTasks.length} itens`, sub: `${yesterdayTasks.filter((t: any) => !isDone(t.status)).length} ficaram abertos` },
            { label: "Semana", value: `${weekTasks.length} itens`, sub: `${criticalGovernance.length + overdueTasks.length} alertas críticos` },
          ].map((item) => (
            <Card key={item.label}>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">{item.label}</p>
                <p className="text-2xl font-bold">{item.value}</p>
                <p className="text-xs text-muted-foreground">{item.sub}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {(overdueTasks.length > 0 || criticalGovernance.length > 0 || delayedProjects.length > 0 || documentAlerts.length > 0 || capacityRisk) && (
          <Card className="border-red-500/25 bg-red-500/5">
            <CardContent className="p-4 flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-red-500 shrink-0" />
              <div>
                <p className="font-semibold text-sm">Alertas críticos em destaque</p>
                <p className="text-xs text-muted-foreground">{overdueTasks.length} tarefas vencidas, {delayedProjects.length} projetos atrasados, {criticalGovernance.length} itens do Conselho, {documentAlerts.length} documentos críticos e {capacityRisk ? "capacidade em atenção" : "capacidade estável"}.</p>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid gap-4 xl:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <ListTodo className="h-4 w-4 text-primary" /> Tarefas de Hoje
                <Badge variant="outline" className="ml-auto text-[10px]">{todayTasksByPriority.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {todayTasksByPriority.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">Sem tarefas para hoje no filtro atual.</p>
              ) : todayTasksByPriority.map(renderPriorityTask)}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <CalendarClock className="h-4 w-4 text-primary" /> Tarefas da Semana
                <Badge variant="outline" className="ml-auto text-[10px]">{weekTasksByPriority.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {weekTasksByPriority.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">Sem outras tarefas nesta semana.</p>
              ) : weekTasksByPriority.map(renderPriorityTask)}
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 xl:grid-cols-[1fr_1fr_0.8fr]">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2"><Building2 className="h-4 w-4 text-primary" /> Cliente / Empresa</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {client360.slice(0, 4).map((client) => (
                <div key={client.id} className="rounded-lg border border-border/50 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-semibold">{client.name}</p>
                    <Badge variant="outline" className="text-[10px]">{client.projects.length} projetos</Badge>
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-2 text-[11px] text-muted-foreground">
                    <span>{client.tasks.length} tarefas</span>
                    <span>{client.overdue.length} vencidas</span>
                    <span>{client.invoices.length} NFs</span>
                    <span>{client.governance.length} conselho</span>
                    <span>{client.documents.length} docs</span>
                    <span>{client.commercial.length} follow-ups</span>
                  </div>
                </div>
              ))}
              {client360.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">Sem empresa/cliente no filtro.</p>}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2"><FolderKanban className="h-4 w-4 text-primary" /> Projeto</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {project360.slice(0, 5).map((project: any) => (
                <div key={project.id} className="rounded-lg border border-border/50 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-semibold">{project.title}</p>
                    {project.next_invoice_date && <Badge variant="secondary" className="text-[10px]">NF {dateLabel(project.next_invoice_date)}</Badge>}
                  </div>
                  <p className="mt-1 truncate text-xs text-muted-foreground">{project.client || "Sem cliente informado"}</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <Badge variant={project.overdue.length ? "destructive" : "outline"} className="text-[10px]">{project.overdue.length} atrasadas</Badge>
                    <Badge variant="outline" className="text-[10px]">{project.tasks.length} tarefas</Badge>
                    <Badge variant="outline" className="text-[10px]">{project.governance.length} riscos/decisões</Badge>
                    <Badge variant="outline" className="text-[10px]">{project.documents.length} docs</Badge>
                  </div>
                </div>
              ))}
              {project360.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">Sem projeto no filtro.</p>}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2"><Activity className="h-4 w-4 text-primary" /> Operação</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex justify-between gap-2"><span className="text-muted-foreground">Receitas no radar</span><strong>{money(monthlyProjection)}</strong></div>
              <div className="flex justify-between gap-2"><span className="text-muted-foreground">Inbox pendente</span><strong>{inboxPending.length}</strong></div>
              <div className="flex justify-between gap-2"><span className="text-muted-foreground">Docs críticos</span><strong>{documentAlerts.length}</strong></div>
              <div className="flex justify-between gap-2"><span className="text-muted-foreground">Capacidade</span><strong>{capacityRisk ? "Atenção" : "Estável"}</strong></div>
              <div className="rounded-lg border border-border/50 bg-muted/20 p-3 text-xs text-muted-foreground">
                O diário executivo abaixo grava o contexto filtrado por data, cliente, projeto e área.
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {radar.map((item) => (
            <Card key={item.label}>
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className={cn("p-2 rounded-lg", item.tone === "red" ? "bg-red-500/10 text-red-500" : item.tone === "amber" ? "bg-amber-500/10 text-amber-500" : "bg-primary/10 text-primary")}>
                    <item.icon className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">{item.label}</p>
                    <p className="text-xl font-bold">{item.value}</p>
                    <p className="text-xs text-muted-foreground">{item.sub}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2"><CalendarClock className="h-4 w-4 text-primary" /> Linha do Tempo</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {timeline.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">Sem vencimentos relevantes no período.</p>
              ) : timeline.map((item, index) => (
                <div key={`${item.type}-${item.title}-${index}`} className="flex items-center gap-3 rounded-lg border p-3">
                  <Badge variant="outline" className="w-24 justify-center text-[10px]">{dateLabel(item.date)}</Badge>
                  <Badge variant="secondary" className="text-[10px]">{item.type}</Badge>
                  <p className="text-sm truncate">{item.title}</p>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2"><FileText className="h-4 w-4 text-primary" /> Diário Executivo</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <label className="text-sm font-medium">Decisões tomadas</label>
                <Textarea value={form.decisions} onChange={(event) => setForm({ ...form, decisions: event.target.value })} className="mt-1 min-h-24" />
              </div>
              <div>
                <label className="text-sm font-medium">Notas e aprendizados</label>
                <Textarea value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} className="mt-1 min-h-24" />
              </div>
              <div>
                <label className="text-sm font-medium">Bloqueios e riscos</label>
                <Textarea value={form.blockers} onChange={(event) => setForm({ ...form, blockers: event.target.value })} className="mt-1 min-h-20" />
              </div>
              <Button className="w-full" onClick={() => saveReport.mutate()} disabled={saveReport.isPending}>
                <Save className="h-4 w-4 mr-2" /> {saveReport.isPending ? "Salvando..." : "Salvar diário"}
              </Button>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 xl:grid-cols-3">
          <InboxTriagePanel compact />
          <CapacityCheckinPanel />
          <AIBriefingPanel briefingDate={selectedDate} stats={briefingStats} />
        </div>

        <div className="grid gap-4 xl:grid-cols-2">
          <DecisionLogPanel compact />
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-primary" /> Modo Foco</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {[...overdueTasks, ...criticalGovernance, ...documentAlerts].slice(0, 3).map((item: any, index) => (
                <div key={`${item.id || item.title}-${index}`} className="rounded-lg border p-3">
                  <p className="text-sm font-semibold truncate">{item.title || item.file_name}</p>
                  <p className="text-xs text-muted-foreground">{item.due_date || item.expires_at ? dateLabel(item.due_date || item.expires_at) : "Sem data"}</p>
                </div>
              ))}
              {[...overdueTasks, ...criticalGovernance, ...documentAlerts].length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-8">Sem prioridade crítica detectada para o foco.</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </EMSLayout>
  );
};

const dateLabel = (date?: string | null) => {
  if (!date) return "Sem data";
  const [year, month, day] = date.slice(0, 10).split("-");
  if (!year || !month || !day) return date;
  return `${day}/${month}/${year}`;
};

export default DailyReport;
