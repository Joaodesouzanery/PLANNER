import { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useCompany } from "@/contexts/CompanyContext";
import { EMSLayout } from "@/components/ems/EMSLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { motion } from "framer-motion";
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";
import {
  Plus, LayoutGrid, GanttChart, Trash2, Edit2, CheckCircle, Calendar, X,
  GripVertical, Building2, FolderKanban, Clock, TrendingUp, AlertTriangle,
  FileText, Download, BarChart3, Network, Link as LinkIcon, Goal, DollarSign, ShieldCheck, Users, Target, Lightbulb,
} from "lucide-react";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { AttachmentManager } from "@/components/ems/AttachmentManager";
import { ConferenciaContent } from "./Conferencia";
import { OrgChartContent } from "./OrgChart";
import { OperationalMapPanel } from "@/components/ems/OperationalMapPanel";
import AddressAutocomplete from "@/components/ems/AddressAutocomplete";
import { ensureCoords } from "@/lib/geocode";
import { ProjectPlanningPanel } from "@/components/ems/projects/ProjectPlanningPanel";
import type { MapPinKind } from "@/components/ems/LocationMap";

interface Project {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  due_date: string | null;
  created_at: string;
  column_order: number | null;
  client: string | null;
  labels: string[] | null;
  company_id: string | null;
  notes: string | null;
  checklist: ChecklistItem[] | null;
  next_invoice_date?: string | null;
  invoice_alert_days?: number | null;
  invoice_notes?: string | null;
}

interface KanbanColumn {
  id: string;
  title: string;
  order_index: number;
  color?: string;
  isDefault?: boolean;
  dbId?: string; // UUID from kanban_columns table
}

const COLUMN_COLORS = [
  { value: "blue", label: "Azul", bg: "from-blue-500/10 to-transparent", dot: "bg-blue-400", text: "text-blue-400" },
  { value: "amber", label: "Âmbar", bg: "from-amber-500/10 to-transparent", dot: "bg-amber-400", text: "text-amber-400" },
  { value: "emerald", label: "Verde", bg: "from-emerald-500/10 to-transparent", dot: "bg-emerald-400", text: "text-emerald-400" },
  { value: "purple", label: "Roxo", bg: "from-purple-500/10 to-transparent", dot: "bg-purple-400", text: "text-purple-400" },
  { value: "pink", label: "Rosa", bg: "from-pink-500/10 to-transparent", dot: "bg-pink-400", text: "text-pink-400" },
  { value: "orange", label: "Laranja", bg: "from-orange-500/10 to-transparent", dot: "bg-orange-400", text: "text-orange-400" },
  { value: "cyan", label: "Ciano", bg: "from-cyan-500/10 to-transparent", dot: "bg-cyan-400", text: "text-cyan-400" },
  { value: "red", label: "Vermelho", bg: "from-red-500/10 to-transparent", dot: "bg-red-400", text: "text-red-400" },
];

interface ExecutionRecord {
  action_taken: string;
  result_obtained: string;
  lessons_learned: string;
  tags: string[];
}

interface ChecklistItem {
  id: string;
  text: string;
  done: boolean;
}

interface ProjectOpportunity {
  id: string;
  project_id: string;
  title: string;
  value: number | null;
  stage: string | null;
  probability: number | null;
  expected_close_date: string | null;
}

interface PlanningGoalLink {
  id: string;
  title: string;
  progress: number | null;
  project_id: string | null;
}

interface FinancialImpactLink {
  id: string;
  project_id: string | null;
  title: string;
  impact_type: string | null;
  expected_amount: number | null;
  expected_date: string | null;
  confidence: string | null;
  status: string | null;
}

interface ProjectPlanningSignal {
  id: string;
  project_id: string | null;
  title?: string;
  assumption?: string;
  risk?: string;
  status: string | null;
  score?: number | null;
}

const DEFAULT_COLUMNS: KanbanColumn[] = [
  { id: "todo", title: "A Fazer", order_index: 0, color: "blue", isDefault: true },
  { id: "in_progress", title: "Em Progresso", order_index: 1, color: "amber", isDefault: true },
  { id: "done", title: "Concluído", order_index: 2, color: "emerald", isDefault: true },
];

const getColumnStyle = (column: KanbanColumn) => {
  const c = COLUMN_COLORS.find(cc => cc.value === (column.color || "blue"));
  return c || COLUMN_COLORS[0];
};

const priorityConfig: Record<string, { label: string; color: string; border: string }> = {
  low: { label: "Baixa", color: "text-blue-400 bg-blue-500/10 border-blue-500/30", border: "border-l-blue-500" },
  medium: { label: "Média", color: "text-yellow-400 bg-yellow-500/10 border-yellow-500/30", border: "border-l-yellow-500" },
  high: { label: "Alta", color: "text-red-400 bg-red-500/10 border-red-500/30", border: "border-l-red-500" },
};

const CHART_COLORS = ["hsl(var(--primary))", "#f59e0b", "#10b981", "#8b5cf6", "#ec4899", "#f97316", "#06b6d4", "#ef4444"];
const fmtMoney = (value: number) => `R$ ${value.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

type GraphTone = "document" | "revenue" | "risk" | "plan" | "governance" | "org";

const GRAPH_TONES: Record<GraphTone, { node: string; icon: string; stroke: string }> = {
  document: { node: "border-border/60 bg-muted/30", icon: "text-muted-foreground", stroke: "hsl(var(--border))" },
  revenue:  { node: "border-primary/40 bg-primary/5",  icon: "text-primary",          stroke: "hsl(var(--primary) / 0.55)" },
  risk:     { node: "border-destructive/45 bg-destructive/5", icon: "text-destructive", stroke: "hsl(var(--destructive) / 0.55)" },
  plan:     { node: "border-border/60 bg-card",        icon: "text-foreground/80",     stroke: "hsl(var(--border))" },
  governance:{ node: "border-border/60 bg-muted/20",   icon: "text-muted-foreground",  stroke: "hsl(var(--border))" },
  org:      { node: "border-border/60 bg-muted/20",    icon: "text-muted-foreground",  stroke: "hsl(var(--border))" },
};

const emptyProjectForm = {
  title: "",
  description: "",
  priority: "medium",
  due_date: "",
  client: "",
  client_company_id: "",
  labels: "",
  status: "todo",
  notes: "",
  next_invoice_date: "",
  invoice_alert_days: "7",
  invoice_notes: "",
  address: "",
  latitude: "",
  longitude: "",
};

const Projects = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { selectedCompanyId, companies } = useCompany();
  const initialView = searchParams.get("tab") === "planning" ? "planning" : "graph";
  const [view, setView] = useState<"graph" | "kanban" | "timeline" | "dashboard" | "planning">(initialView);
  const [projects, setProjects] = useState<Project[]>([]);
  const [columns, setColumns] = useState<KanbanColumn[]>(DEFAULT_COLUMNS);
  const [showAddProject, setShowAddProject] = useState(false);
  const [showExecutionModal, setShowExecutionModal] = useState(false);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [showColumnModal, setShowColumnModal] = useState(false);
  const [newColumnTitle, setNewColumnTitle] = useState("");
  const [newColumnColor, setNewColumnColor] = useState("purple");
  const [clientFilter, setClientFilter] = useState<string>("all");
  const [mapProjectId, setMapProjectId] = useState<string>("all");
  const [mapVisibleKinds, setMapVisibleKinds] = useState({ project: true, client: true, task: true });
  const [graphStatusFilter, setGraphStatusFilter] = useState<string>("in_progress");
  const [graphMinProgress, setGraphMinProgress] = useState("0");
  const [graphMinOpportunity, setGraphMinOpportunity] = useState("0");
  const [graphVisibleNodes, setGraphVisibleNodes] = useState({
    contracts: true,
    opportunities: true,
    goals: true,
    finance: true,
    plan: true,
    financialImpact: true,
    risks: true,
    assumptions: true,
    conference: true,
    orgchart: true,
  });
  const [reportOpen, setReportOpen] = useState(false);
  const [reportFrom, setReportFrom] = useState("");
  const [reportTo, setReportTo] = useState("");
  const [reportCompanyId, setReportCompanyId] = useState<string>("current");
  const [allProjects, setAllProjects] = useState<Project[]>([]);
  const [pendingTaskCounts, setPendingTaskCounts] = useState<Record<string, number>>({});
  const [totalTaskCounts, setTotalTaskCounts] = useState<Record<string, number>>({});
  const [dashFrom, setDashFrom] = useState("");
  const [dashTo, setDashTo] = useState("");
  const [opportunities, setOpportunities] = useState<ProjectOpportunity[]>([]);
  const [projectContractCounts, setProjectContractCounts] = useState<Record<string, number>>({});
  const [projectGoals, setProjectGoals] = useState<PlanningGoalLink[]>([]);
  const [projectFinancialImpacts, setProjectFinancialImpacts] = useState<FinancialImpactLink[]>([]);
  const [projectRisks, setProjectRisks] = useState<ProjectPlanningSignal[]>([]);
  const [projectAssumptions, setProjectAssumptions] = useState<ProjectPlanningSignal[]>([]);
  const [financeSummary, setFinanceSummary] = useState({ now: 0, months6to12: 0, longTerm: 0 });
  const [showOpportunityModal, setShowOpportunityModal] = useState(false);
  const [conferenceProject, setConferenceProject] = useState<Project | null>(null);
  const [orgChartProject, setOrgChartProject] = useState<Project | null>(null);
  const [planningProject, setPlanningProject] = useState<Project | null>(null);
  const [project360, setProject360] = useState<Project | null>(null);
  const [opportunityProjectId, setOpportunityProjectId] = useState("");
  const [opportunityForm, setOpportunityForm] = useState({ title: "", value: "", stage: "nova", probability: "50", expected_close_date: "" });

  const [projectForm, setProjectForm] = useState(emptyProjectForm);
  const [checklistItems, setChecklistItems] = useState<ChecklistItem[]>([]);
  const [newCheckItem, setNewCheckItem] = useState("");
  const [editingColumn, setEditingColumn] = useState<string | null>(null);
  const [editColumnTitle, setEditColumnTitle] = useState("");
  const [executionForm, setExecutionForm] = useState<ExecutionRecord>({ action_taken: "", result_obtained: "", lessons_learned: "", tags: [] });
  const [tagInput, setTagInput] = useState("");

  // Fetch columns from DB + merge with defaults
  const fetchColumns = async () => {
    const { data } = await supabase
      .from("kanban_columns")
      .select("*")
      .order("order_index", { ascending: true });
    
    const dbCols: KanbanColumn[] = (data || []).map((c: any) => ({
      id: c.title.toLowerCase().replace(/\s+/g, "_"),
      title: c.title,
      order_index: c.order_index,
      color: c.color || "purple",
      isDefault: false,
      dbId: c.id,
    }));
    
    // Merge: defaults first, then DB custom columns
    const defaultIds = DEFAULT_COLUMNS.map(c => c.id);
    const customCols = dbCols.filter(c => !defaultIds.includes(c.id));
    setColumns([...DEFAULT_COLUMNS, ...customCols.map((c, i) => ({ ...c, order_index: DEFAULT_COLUMNS.length + i }))]);
  };

  useEffect(() => {
    fetchProjects();
    fetchColumns();
    fetchPendingTaskCounts();
    fetchProjectGraphData();
  }, [selectedCompanyId]);

  const fetchProjectGraphData = async () => {
    let oppQ = (supabase as any).from("project_opportunities").select("*").order("created_at", { ascending: false });
    let attQ = (supabase as any).from("attachments").select("project_id, document_type").eq("document_type", "contract").not("project_id", "is", null);
    let goalsQ = supabase.from("planning_goals").select("id, title, progress, project_id").not("project_id", "is", null);
    let impactsQ = (supabase as any).from("planning_financial_impacts").select("id, project_id, title, impact_type, expected_amount, expected_date, confidence, status").not("project_id", "is", null);
    let risksQ = (supabase as any).from("planning_risks").select("id, project_id, risk, status, score").not("project_id", "is", null);
    let assumptionsQ = (supabase as any).from("planning_assumptions").select("id, project_id, assumption, status").not("project_id", "is", null);
    let txQ = supabase.from("financial_transactions").select("amount, type, date");
    if (selectedCompanyId !== "all") {
      oppQ = oppQ.eq("company_id", selectedCompanyId);
      attQ = attQ.eq("company_id", selectedCompanyId);
      goalsQ = goalsQ.eq("company_id", selectedCompanyId);
      impactsQ = impactsQ.eq("company_id", selectedCompanyId);
      risksQ = risksQ.eq("company_id", selectedCompanyId);
      assumptionsQ = assumptionsQ.eq("company_id", selectedCompanyId);
      txQ = txQ.eq("company_id", selectedCompanyId);
    }
    const safe = async (q: any) => { try { return await q; } catch { return { data: [] }; } };
    const [oppRes, attRes, goalsRes, impactsRes, risksRes, assumptionsRes, txRes] = await Promise.all([safe(oppQ), safe(attQ), safe(goalsQ), safe(impactsQ), safe(risksQ), safe(assumptionsQ), safe(txQ)]);
    setOpportunities((oppRes.data || []) as ProjectOpportunity[]);
    const contractCounts: Record<string, number> = {};
    (attRes.data || []).forEach((att: any) => {
      if (att.project_id) contractCounts[att.project_id] = (contractCounts[att.project_id] || 0) + 1;
    });
    setProjectContractCounts(contractCounts);
    setProjectGoals((goalsRes.data || []) as PlanningGoalLink[]);
    setProjectFinancialImpacts((impactsRes.data || []) as FinancialImpactLink[]);
    setProjectRisks((risksRes.data || []).map((item: any) => ({ id: item.id, project_id: item.project_id, risk: item.risk, status: item.status, score: item.score })) as ProjectPlanningSignal[]);
    setProjectAssumptions((assumptionsRes.data || []).map((item: any) => ({ id: item.id, project_id: item.project_id, assumption: item.assumption, status: item.status })) as ProjectPlanningSignal[]);

    const now = new Date();
    const in6 = new Date(now); in6.setMonth(in6.getMonth() + 6);
    const in12 = new Date(now); in12.setMonth(in12.getMonth() + 12);
    const summary = { now: 0, months6to12: 0, longTerm: 0 };
    (txRes.data || []).forEach((tx: any) => {
      const amount = Number(tx.amount) * (tx.type === "expense" ? -1 : 1);
      const date = new Date(tx.date);
      if (date <= now) summary.now += amount;
      else if (date > in6 && date <= in12) summary.months6to12 += amount;
      else if (date > in12) summary.longTerm += amount;
    });
    setFinanceSummary(summary);
  };

  const fetchPendingTaskCounts = async () => {
    let q = supabase.from("tasks").select("project_id, status").not("project_id", "is", null);
    if (selectedCompanyId !== "all") q = q.eq("company_id", selectedCompanyId);
    const { data } = await q;
    if (!data) return;
    const pending: Record<string, number> = {};
    const total: Record<string, number> = {};
    for (const row of data as { project_id: string | null; status: string }[]) {
      if (!row.project_id) continue;
      total[row.project_id] = (total[row.project_id] || 0) + 1;
      if (row.status !== "completed") pending[row.project_id] = (pending[row.project_id] || 0) + 1;
    }
    setPendingTaskCounts(pending);
    setTotalTaskCounts(total);
  };

  const fetchProjects = async () => {
    let query = supabase.from("projects").select("*").order("column_order", { ascending: true, nullsFirst: false });
    if (selectedCompanyId !== "all") query = query.eq("company_id", selectedCompanyId);
    const { data } = await query;
    if (data) setProjects(data as unknown as Project[]);
  };

  const fetchReportProjects = async () => {
    const { data } = await supabase.from("projects").select("*").eq("status", "done");
    if (data) setAllProjects(data as unknown as Project[]);
  };

  const openReport = () => {
    fetchReportProjects();
    setReportOpen(true);
  };

  const reportProjects = useMemo(() => {
    let filtered = allProjects;
    if (reportCompanyId === "current" && selectedCompanyId !== "all") {
      filtered = filtered.filter(p => p.company_id === selectedCompanyId);
    } else if (reportCompanyId !== "current" && reportCompanyId !== "all") {
      filtered = filtered.filter(p => p.company_id === reportCompanyId);
    }
    if (reportFrom) filtered = filtered.filter(p => p.created_at >= reportFrom);
    if (reportTo) filtered = filtered.filter(p => p.created_at <= reportTo + "T23:59:59");
    return filtered;
  }, [allProjects, reportCompanyId, reportFrom, reportTo, selectedCompanyId]);

  // Dashboard filtered projects
  const dashProjects = useMemo(() => {
    let filtered = projects;
    if (dashFrom) filtered = filtered.filter(p => p.created_at >= dashFrom);
    if (dashTo) filtered = filtered.filter(p => p.created_at <= dashTo + "T23:59:59");
    return filtered;
  }, [projects, dashFrom, dashTo]);

  const getCompanyName = (companyId: string | null | undefined) => {
    if (!companyId) return "—";
    return companies.find(c => c.id === companyId)?.name || "—";
  };

  const generateProjectsPDF = async () => {
    const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
      import("jspdf"),
      import("jspdf-autotable"),
    ]);
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text("Relatório de Projetos Concluídos", 14, 20);
    doc.setFontSize(10);
    const period = [reportFrom && `De: ${format(new Date(reportFrom), "dd/MM/yyyy")}`, reportTo && `Até: ${format(new Date(reportTo), "dd/MM/yyyy")}`].filter(Boolean).join("  ");
    if (period) doc.text(period, 14, 28);
    doc.text(`Total: ${reportProjects.length} projetos`, 14, period ? 34 : 28);
    autoTable(doc, {
      startY: period ? 40 : 34,
      head: [["Título", "Cliente", "Prioridade", "Empresa", "Data Criação"]],
      body: reportProjects.map(p => [
        p.title, p.client || "—", priorityConfig[p.priority]?.label || p.priority,
        getCompanyName(p.company_id), format(new Date(p.created_at), "dd/MM/yyyy"),
      ]),
    });
    doc.save("projetos-concluidos.pdf");
    toast({ title: "PDF gerado com sucesso!" });
  };

  const generateProjectsCSV = () => {
    const header = "Título;Cliente;Prioridade;Empresa;Data Criação\n";
    const rows = reportProjects.map(p =>
      `"${p.title}";"${p.client || ""}";"${priorityConfig[p.priority]?.label || p.priority}";"${getCompanyName(p.company_id)}";"${format(new Date(p.created_at), "dd/MM/yyyy")}"`
    ).join("\n");
    const blob = new Blob([header + rows], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "projetos-concluidos.csv"; a.click();
    URL.revokeObjectURL(url);
    toast({ title: "CSV gerado com sucesso!" });
  };

  const uniqueClients = [...new Set(projects.map(p => p.client).filter(Boolean))] as string[];
  const mapFilterKinds = (Object.entries(mapVisibleKinds)
    .filter(([, visible]) => visible)
    .map(([kind]) => kind)) as MapPinKind[];

  const handleAddProject = async () => {
    if (!projectForm.title) return;
    const maxOrder = projects.filter(p => p.status === "todo").length;
    await (supabase as any).from("projects").insert({
      title: projectForm.title, description: projectForm.description || null, priority: projectForm.priority,
      due_date: projectForm.due_date || null, status: "todo", column_order: maxOrder,
      company_id: projectForm.client_company_id || (selectedCompanyId !== "all" ? selectedCompanyId : null),
      client: projectForm.client || null, labels: projectForm.labels ? projectForm.labels.split(",").map(l => l.trim()).filter(Boolean) : [],
      next_invoice_date: projectForm.next_invoice_date || null,
      invoice_alert_days: Number(projectForm.invoice_alert_days) || 7,
      invoice_notes: projectForm.invoice_notes || null,
      address: projectForm.address || null,
      latitude: projectForm.latitude ? Number(projectForm.latitude) : null,
      longitude: projectForm.longitude ? Number(projectForm.longitude) : null,
    });
    setProjectForm(emptyProjectForm);
    setShowAddProject(false);
    fetchProjects();
    toast({ title: "Projeto criado!" });
  };

  const handleUpdateProject = async () => {
    if (!editingProject) return;
    const newStatus = projectForm.status;
    if (newStatus === "done" && editingProject.status !== "done") {
      setSelectedProject({ ...editingProject, status: newStatus });
      setEditingProject(null);
      setShowExecutionModal(true);
      return;
    }
    await (supabase as any).from("projects").update({
      title: projectForm.title, description: projectForm.description, priority: projectForm.priority,
      due_date: projectForm.due_date || null, client: projectForm.client || null,
      company_id: projectForm.client_company_id || editingProject.company_id || (selectedCompanyId !== "all" ? selectedCompanyId : null),
      labels: projectForm.labels ? projectForm.labels.split(",").map(l => l.trim()).filter(Boolean) : [],
      status: newStatus, notes: projectForm.notes || null, checklist: checklistItems as unknown as any,
      next_invoice_date: projectForm.next_invoice_date || null,
      invoice_alert_days: Number(projectForm.invoice_alert_days) || 7,
      invoice_notes: projectForm.invoice_notes || null,
      address: projectForm.address || null,
      latitude: projectForm.latitude ? Number(projectForm.latitude) : null,
      longitude: projectForm.longitude ? Number(projectForm.longitude) : null,
    }).eq("id", editingProject.id);
    setEditingProject(null);
    setProjectForm(emptyProjectForm);
    setChecklistItems([]);
    fetchProjects();
    toast({ title: "Projeto atualizado!" });
  };

  const handleDeleteProject = async (id: string) => {
    await supabase.from("projects").delete().eq("id", id);
    fetchProjects();
    toast({ title: "Projeto removido!" });
  };

  const openOpportunityModal = (projectId?: string) => {
    setOpportunityProjectId(projectId || "");
    setOpportunityForm({ title: "", value: "", stage: "nova", probability: "50", expected_close_date: "" });
    setShowOpportunityModal(true);
  };

  const saveOpportunity = async () => {
    if (!opportunityProjectId || !opportunityForm.title.trim()) {
      toast({ title: "Escolha um projeto e informe a oportunidade", variant: "destructive" });
      return;
    }
    const { error } = await (supabase as any).from("project_opportunities").insert({
      project_id: opportunityProjectId,
      title: opportunityForm.title.trim(),
      value: opportunityForm.value ? Number(opportunityForm.value) : null,
      stage: opportunityForm.stage || null,
      probability: opportunityForm.probability ? Number(opportunityForm.probability) : null,
      expected_close_date: opportunityForm.expected_close_date || null,
      company_id: selectedCompanyId !== "all" ? selectedCompanyId : null,
    });
    if (error) {
      toast({ title: "Erro ao salvar oportunidade", description: error.message, variant: "destructive" });
      return;
    }
    setShowOpportunityModal(false);
    fetchProjectGraphData();
    toast({ title: "Oportunidade cadastrada!" });
  };

  const handleDragEnd = async (result: DropResult) => {
    const { destination, source, draggableId, type } = result;
    if (!destination) return;
    if (destination.droppableId === source.droppableId && destination.index === source.index) return;

    if (type === "COLUMN") {
      const newColumns = Array.from(columns);
      const [removed] = newColumns.splice(source.index, 1);
      newColumns.splice(destination.index, 0, removed);
      setColumns(newColumns.map((col, index) => ({ ...col, order_index: index })));
      return;
    }

    const project = projects.find(p => p.id === draggableId);
    if (!project) return;
    const newStatus = destination.droppableId;

    if (newStatus === "done" && project.status !== "done") {
      setSelectedProject(project);
      setShowExecutionModal(true);
      return;
    }

    const newProjects = [...projects];
    const projectIndex = newProjects.findIndex(p => p.id === draggableId);
    newProjects[projectIndex] = { ...newProjects[projectIndex], status: newStatus };
    setProjects(newProjects);
    await supabase.from("projects").update({ status: newStatus, column_order: destination.index }).eq("id", draggableId);
    fetchProjects();
  };

  const handleCompleteWithExecution = async () => {
    if (!selectedProject) return;
    if (!executionForm.action_taken || !executionForm.result_obtained || !executionForm.lessons_learned) {
      toast({ title: "Preencha todos os campos obrigatórios", variant: "destructive" });
      return;
    }
    await supabase.from("execution_records").insert({
      project_id: selectedProject.id, action_taken: executionForm.action_taken,
      result_obtained: executionForm.result_obtained, lessons_learned: executionForm.lessons_learned, tags: executionForm.tags,
    });
    await supabase.from("projects").update({ status: "done" }).eq("id", selectedProject.id);
    setShowExecutionModal(false);
    setSelectedProject(null);
    setExecutionForm({ action_taken: "", result_obtained: "", lessons_learned: "", tags: [] });
    fetchProjects();
    toast({ title: "Projeto concluído e registrado na Knowledge Base!" });
  };

  const addTag = () => {
    if (tagInput && !executionForm.tags.includes(tagInput)) {
      setExecutionForm({ ...executionForm, tags: [...executionForm.tags, tagInput] });
      setTagInput("");
    }
  };

  const removeTag = (tag: string) => {
    setExecutionForm({ ...executionForm, tags: executionForm.tags.filter(t => t !== tag) });
  };

  // Persist custom column to DB
  const addColumn = async () => {
    if (!newColumnTitle) return;
    const colId = newColumnTitle.toLowerCase().replace(/\s+/g, "_");
    
    const { data, error } = await supabase.from("kanban_columns").insert({
      title: newColumnTitle,
      order_index: columns.length,
      color: newColumnColor,
      company_id: selectedCompanyId !== "all" ? selectedCompanyId : null,
    }).select().single();

    if (error) {
      toast({ title: "Erro ao criar coluna", variant: "destructive" });
      return;
    }

    const newCol: KanbanColumn = {
      id: colId, title: newColumnTitle, order_index: columns.length,
      color: newColumnColor, isDefault: false, dbId: data.id,
    };
    setColumns([...columns, newCol]);
    setNewColumnTitle("");
    setNewColumnColor("purple");
    setShowColumnModal(false);
    toast({ title: "Coluna adicionada!" });
  };

  const deleteColumn = async (columnId: string) => {
    const col = columns.find(c => c.id === columnId);
    if (col?.dbId) {
      await supabase.from("kanban_columns").delete().eq("id", col.dbId);
    }
    setColumns(columns.filter(c => c.id !== columnId));
    toast({ title: "Coluna removida!" });
  };

  const renameColumn = async (columnId: string, newTitle: string) => {
    if (!newTitle.trim()) return;
    const col = columns.find(c => c.id === columnId);
    if (col?.dbId) {
      await supabase.from("kanban_columns").update({ title: newTitle }).eq("id", col.dbId);
    }
    setColumns(columns.map(c => c.id === columnId ? { ...c, title: newTitle } : c));
    setEditingColumn(null);
    setEditColumnTitle("");
    toast({ title: "Coluna renomeada!" });
  };

  const addChecklistItem = () => {
    if (!newCheckItem.trim()) return;
    setChecklistItems([...checklistItems, { id: Date.now().toString(), text: newCheckItem.trim(), done: false }]);
    setNewCheckItem("");
  };

  const toggleChecklistItem = (id: string) => {
    setChecklistItems(checklistItems.map(item => item.id === id ? { ...item, done: !item.done } : item));
  };

  const removeChecklistItem = (id: string) => {
    setChecklistItems(checklistItems.filter(item => item.id !== id));
  };

  const getProjectsByStatus = (status: string) => {
    let filteredProjects = projects.filter(p => p.status === status);
    if (clientFilter !== "all") filteredProjects = filteredProjects.filter(p => p.client === clientFilter);
    return filteredProjects.sort((a, b) => (a.column_order ?? 0) - (b.column_order ?? 0));
  };

  // Stats
  const totalProjects = projects.length;
  const doneProjects = projects.filter(p => p.status === "done").length;
  const inProgressProjects = projects.filter(p => p.status === "in_progress").length;
  const overdueProjects = projects.filter(p => p.due_date && new Date(p.due_date) < new Date() && p.status !== "done").length;
  const invoiceAlertProjects = projects.filter(p => {
    if (!p.next_invoice_date) return false;
    const alertDays = p.invoice_alert_days ?? 7;
    const alertDate = new Date(p.next_invoice_date + "T12:00:00");
    alertDate.setDate(alertDate.getDate() - alertDays);
    return alertDate <= new Date();
  }).length;
  const completionRate = totalProjects > 0 ? Math.round((doneProjects / totalProjects) * 100) : 0;
  const getGraphMetrics = useCallback((project: Project) => {
    const total = totalTaskCounts[project.id] || 0;
    const pending = pendingTaskCounts[project.id] || 0;
    const taskProgress = total > 0 ? Math.round(((total - pending) / total) * 100) : project.status === "in_progress" ? 45 : project.status === "done" ? 100 : 10;
    const linkedGoals = projectGoals.filter(goal => goal.project_id === project.id);
    const goalProgress = linkedGoals.length > 0 ? Math.round(linkedGoals.reduce((a, g) => a + Number(g.progress || 0), 0) / linkedGoals.length) : taskProgress;
    const progress = Math.round((taskProgress + goalProgress) / 2);
    const projectOpps = opportunities.filter(opp => opp.project_id === project.id);
    const opportunityValue = projectOpps.reduce((sum, opp) => sum + Number(opp.value || 0), 0);
    const financialImpacts = projectFinancialImpacts.filter(impact => impact.project_id === project.id);
    const plannedFinancial = financialImpacts.reduce((sum, impact) => {
      const amount = Number(impact.expected_amount || 0);
      return sum + (impact.impact_type === "cost" ? -amount : amount);
    }, 0);
    const risks = projectRisks.filter(risk => risk.project_id === project.id);
    const assumptions = projectAssumptions.filter(assumption => assumption.project_id === project.id);
    return { total, pending, taskProgress, linkedGoals, goalProgress, progress, projectOpps, opportunityValue, financialImpacts, plannedFinancial, risks, assumptions };
  }, [opportunities, pendingTaskCounts, projectFinancialImpacts, projectGoals, projectRisks, projectAssumptions, totalTaskCounts]);

  const activeProjects = useMemo(() => projects.filter(project => {
    if (clientFilter !== "all" && project.client !== clientFilter) return false;
    if (graphStatusFilter !== "all" && project.status !== graphStatusFilter) return false;
    const metrics = getGraphMetrics(project);
    if (metrics.progress < Number(graphMinProgress || 0)) return false;
    if (metrics.opportunityValue < Number(graphMinOpportunity || 0)) return false;
    return true;
  }), [projects, clientFilter, graphStatusFilter, graphMinProgress, graphMinOpportunity, getGraphMetrics]);
  const graphTotals = useMemo(() => {
    const activeIds = new Set(activeProjects.map(project => project.id));
    const opportunityValue = opportunities.filter(opp => activeIds.has(opp.project_id)).reduce((sum, opp) => sum + Number(opp.value || 0), 0);
    const plannedFinancial = projectFinancialImpacts.filter(impact => impact.project_id && activeIds.has(impact.project_id)).reduce((sum, impact) => {
      const amount = Number(impact.expected_amount || 0);
      return sum + (impact.impact_type === "cost" ? -amount : amount);
    }, 0);
    const averageProgress = activeProjects.length > 0
      ? Math.round(activeProjects.reduce((sum, project) => sum + getGraphMetrics(project).progress, 0) / activeProjects.length)
      : 0;
    return { opportunityValue, plannedFinancial, averageProgress };
  }, [activeProjects, opportunities, projectFinancialImpacts, getGraphMetrics]);

  const toggleGraphNode = (key: keyof typeof graphVisibleNodes) => {
    setGraphVisibleNodes(prev => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <EMSLayout>
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-4 md:space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-3">
          <div>
            <h1 className="text-xl md:text-3xl font-heading font-bold text-foreground">Gestão de Projetos</h1>
            <p className="text-xs md:text-base text-muted-foreground mt-1">Gerencie seus projetos com visão Kanban</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={openReport} className="border-border/50 text-xs md:text-sm">
              <FileText className="h-3.5 w-3.5 mr-1.5" />Relatório
            </Button>
            <Button variant="outline" size="sm" onClick={() => setShowColumnModal(true)} className="border-border/50 text-xs md:text-sm">
              <Plus className="h-3.5 w-3.5 mr-1.5" />Coluna
            </Button>
            <Button size="sm" onClick={() => setShowAddProject(true)} className="text-xs md:text-sm">
              <Plus className="h-3.5 w-3.5 mr-1.5" />Novo Projeto
            </Button>
          </div>
        </div>

        {/* Stats - responsive grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2 md:gap-3">
          {[
            { label: "Total", value: totalProjects, icon: FolderKanban, color: "text-primary", gradient: "from-primary/10 to-primary/5" },
            { label: "Em Progresso", value: inProgressProjects, icon: Clock, color: "text-amber-400", gradient: "from-amber-500/10 to-amber-500/5" },
            { label: "Concluídos", value: doneProjects, icon: CheckCircle, color: "text-emerald-400", gradient: "from-emerald-500/10 to-emerald-500/5" },
            { label: "Atrasados", value: overdueProjects, icon: AlertTriangle, color: "text-red-400", gradient: "from-red-500/10 to-red-500/5" },
            { label: "Alertas NF", value: invoiceAlertProjects, icon: FileText, color: "text-cyan-400", gradient: "from-cyan-500/10 to-cyan-500/5" },
          ].map((s, i) => (
            <motion.div key={s.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
              <div className="stat-card">
                <div className="flex items-center gap-2 md:gap-3">
                  <div className={cn("p-1.5 md:p-2 rounded-lg bg-gradient-to-br", s.gradient)}>
                    <s.icon className={cn("h-3.5 w-3.5 md:h-4 md:w-4", s.color)} />
                  </div>
                  <div>
                    <p className="text-lg md:text-2xl font-bold font-mono">{s.value}</p>
                    <p className="text-[10px] md:text-xs text-muted-foreground">{s.label}</p>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="col-span-2 md:col-span-1">
            <div className="stat-card">
              <div className="flex items-center gap-2 md:gap-3 mb-2">
                <div className="p-1.5 md:p-2 rounded-lg bg-gradient-to-br from-primary/10 to-primary/5">
                  <TrendingUp className="h-3.5 w-3.5 md:h-4 md:w-4 text-primary" />
                </div>
                <div>
                  <p className="text-lg md:text-2xl font-bold font-mono">{completionRate}%</p>
                  <p className="text-[10px] md:text-xs text-muted-foreground">Conclusão</p>
                </div>
              </div>
              <Progress value={completionRate} className="h-1.5" />
            </div>
          </motion.div>
        </div>

        <OperationalMapPanel
          title="Mapa de projetos"
          description="Filtre um projeto e ligue/desligue camadas para ver clientes, obra e tarefas separadamente."
          projectId={mapProjectId === "all" ? undefined : mapProjectId}
          filterKinds={mapFilterKinds}
          height={320}
          maxSidebarHeight="320px"
          headerActions={
            <>
              <Select value={mapProjectId} onValueChange={setMapProjectId}>
                <SelectTrigger className="h-8 w-full text-xs sm:w-[240px]">
                  <SelectValue placeholder="Projeto no mapa" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os projetos</SelectItem>
                  {projects.map((project) => <SelectItem key={project.id} value={project.id}>{project.title}</SelectItem>)}
                </SelectContent>
              </Select>
              <div className="flex flex-wrap gap-1.5">
                {[
                  ["project", "Projetos"],
                  ["client", "Clientes"],
                  ["task", "Tarefas"],
                ].map(([kind, label]) => (
                  <Button
                    key={kind}
                    type="button"
                    size="sm"
                    variant={mapVisibleKinds[kind as keyof typeof mapVisibleKinds] ? "default" : "outline"}
                    className="h-8 text-xs"
                    onClick={() => setMapVisibleKinds((current) => ({ ...current, [kind]: !current[kind as keyof typeof current] }))}
                  >
                    {label}
                  </Button>
                ))}
              </div>
            </>
          }
        />

        {/* Filters */}
        <div className="flex flex-wrap gap-2 md:gap-4 items-center">
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-muted-foreground hidden sm:block" />
            <Select value={clientFilter} onValueChange={setClientFilter}>
              <SelectTrigger className="w-[150px] md:w-[180px] border-border/50 text-xs md:text-sm h-9">
                <SelectValue placeholder="Filtrar por cliente" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os clientes</SelectItem>
                {uniqueClients.map(client => (
                  <SelectItem key={client} value={client}>{client}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* View Toggle */}
        <Tabs value={view} onValueChange={(v) => setView(v as "graph" | "kanban" | "timeline" | "dashboard" | "planning")}>
          <TabsList className="w-full sm:w-auto">
            <TabsTrigger value="graph" className="gap-1.5 text-xs md:text-sm flex-1 sm:flex-none"><Network className="h-3.5 w-3.5 md:h-4 md:w-4" />Vinculos</TabsTrigger>
            <TabsTrigger value="kanban" className="gap-1.5 text-xs md:text-sm flex-1 sm:flex-none"><LayoutGrid className="h-3.5 w-3.5 md:h-4 md:w-4" />Kanban</TabsTrigger>
            <TabsTrigger value="timeline" className="gap-1.5 text-xs md:text-sm flex-1 sm:flex-none"><GanttChart className="h-3.5 w-3.5 md:h-4 md:w-4" />Timeline</TabsTrigger>
            <TabsTrigger value="planning" className="gap-1.5 text-xs md:text-sm flex-1 sm:flex-none"><Target className="h-3.5 w-3.5 md:h-4 md:w-4" />Plano e Metas</TabsTrigger>
            <TabsTrigger value="dashboard" className="gap-1.5 text-xs md:text-sm flex-1 sm:flex-none"><BarChart3 className="h-3.5 w-3.5 md:h-4 md:w-4" />Dashboard</TabsTrigger>
          </TabsList>

          <TabsContent value="graph" className="mt-4 md:mt-6 space-y-4 md:space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              {[
                { label: "Caixa agora", value: fmtMoney(financeSummary.now), icon: DollarSign, color: "text-emerald-400" },
                { label: "Caixa 6-12 meses", value: fmtMoney(financeSummary.months6to12), icon: Clock, color: "text-blue-400" },
                { label: "Impacto planejado", value: fmtMoney(graphTotals.plannedFinancial), icon: TrendingUp, color: "text-primary" },
                { label: "Progresso medio", value: `${graphTotals.averageProgress}%`, icon: Goal, color: "text-amber-400" },
              ].map((item) => (
                <Card key={item.label} className="border-border/50 bg-card/80">
                  <CardContent className="p-4 flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-primary/10"><item.icon className={cn("h-4 w-4", item.color)} /></div>
                    <div>
                      <p className="text-lg font-bold font-mono">{item.value}</p>
                      <p className="text-xs text-muted-foreground">{item.label}</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            <Card className="border-border/50 bg-card/80">
              <CardContent className="p-4 space-y-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 flex-1">
                    <div>
                      <Label className="text-xs text-muted-foreground">Status no grafo</Label>
                      <Select value={graphStatusFilter} onValueChange={setGraphStatusFilter}>
                        <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="in_progress">Em progresso</SelectItem>
                          <SelectItem value="todo">A fazer</SelectItem>
                          <SelectItem value="done">Concluido</SelectItem>
                          <SelectItem value="all">Todos</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Progresso minimo (%)</Label>
                      <Input className="h-9 text-xs" type="number" min="0" max="100" value={graphMinProgress} onChange={(e) => setGraphMinProgress(e.target.value)} />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Oportunidade minima (R$)</Label>
                      <Input className="h-9 text-xs" type="number" min="0" value={graphMinOpportunity} onChange={(e) => setGraphMinOpportunity(e.target.value)} />
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {[
                      ["contracts", "Contratos"],
                      ["opportunities", "Oportunidades"],
                      ["goals", "Metas"],
                      ["finance", "Caixa"],
                      ["plan", "Plano + Metas"],
                      ["financialImpact", "Impacto"],
                      ["risks", "Riscos"],
                      ["assumptions", "Suposicoes"],
                      ["conference", "Conferencia"],
                      ["orgchart", "Organograma"],
                    ].map(([key, label]) => (
                      <Button
                        key={key}
                        type="button"
                        size="sm"
                        variant={graphVisibleNodes[key as keyof typeof graphVisibleNodes] ? "default" : "outline"}
                        className="h-8 text-xs"
                        onClick={() => toggleGraphNode(key as keyof typeof graphVisibleNodes)}
                      >
                        {label}
                      </Button>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="flex justify-end">
              <Button size="sm" onClick={() => openOpportunityModal()} className="text-xs md:text-sm">
                <Plus className="h-3.5 w-3.5 mr-1.5" />Nova Oportunidade
              </Button>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              {activeProjects.map((project, index) => {
                const { linkedGoals, goalProgress, progress, projectOpps, opportunityValue: oppValue, financialImpacts, plannedFinancial, risks, assumptions } = getGraphMetrics(project);
                const graphNodes = [
                  graphVisibleNodes.contracts && { key: "contracts", tone: "document", label: `${projectContractCounts[project.id] || 0} contratos`, sub: "PDFs e anexos", icon: FileText, x: 3, y: 8, onClick: () => setEditingProject(project) },
                  graphVisibleNodes.opportunities && { key: "opportunities", tone: "revenue", label: `${projectOpps.length} oportunidades`, sub: fmtMoney(oppValue), icon: LinkIcon, x: 68, y: 8, onClick: () => openOpportunityModal(project.id) },
                  graphVisibleNodes.goals && { key: "goals", tone: "plan", label: `${linkedGoals.length} metas`, sub: `${goalProgress}% medio`, icon: Goal, x: 3, y: 40, onClick: () => setPlanningProject(project) },
                  graphVisibleNodes.finance && { key: "finance", tone: "revenue", label: fmtMoney(oppValue), sub: "oportunidades", icon: DollarSign, x: 68, y: 40, onClick: () => openOpportunityModal(project.id) },
                  graphVisibleNodes.plan && { key: "plan", tone: "plan", label: "Plano + Metas", sub: linkedGoals.length ? `${linkedGoals.length} iniciativas` : "criar plano rapido", icon: Target, x: 36, y: 5, onClick: () => setPlanningProject(project) },
                  graphVisibleNodes.financialImpact && { key: "financialImpact", tone: "revenue", label: fmtMoney(plannedFinancial), sub: `${financialImpacts.length} impactos`, icon: TrendingUp, x: 36, y: 86, onClick: () => setPlanningProject(project) },
                  graphVisibleNodes.risks && { key: "risks", tone: "risk", label: `${risks.length} riscos`, sub: risks[0]?.risk || "monitoramento", icon: AlertTriangle, x: 3, y: 73, onClick: () => setPlanningProject(project) },
                  graphVisibleNodes.assumptions && { key: "assumptions", tone: "plan", label: `${assumptions.length} suposicoes`, sub: assumptions[0]?.assumption || "apostas do plano", icon: Lightbulb, x: 68, y: 73, onClick: () => setPlanningProject(project) },
                  graphVisibleNodes.conference && { key: "conference", tone: "governance", label: "Conferencia", sub: "controle por projeto", icon: ShieldCheck, x: 36, y: 25, onClick: () => setConferenceProject(project) },
                  graphVisibleNodes.orgchart && { key: "orgchart", tone: "org", label: "Organograma", sub: "estrutura vinculada", icon: Users, x: 36, y: 64, onClick: () => setOrgChartProject(project) },
                ].filter(Boolean) as { key: string; tone: GraphTone; label: string; sub: string; icon: any; x: number; y: number; onClick: () => void }[];
                return (
                  <motion.div key={project.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.03 }}>
                    <Card className="border-border/50 bg-card/80 overflow-hidden">
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <CardTitle className="text-base truncate flex items-center gap-2"><FolderKanban className="h-4 w-4 text-primary" />{project.title}</CardTitle>
                            <p className="text-xs text-muted-foreground mt-1 truncate">{project.client || "Sem cliente informado"}</p>
                          </div>
                          <Badge variant="outline" className="text-xs font-mono">{progress}%</Badge>
                        </div>
                        <Progress value={progress} className="h-2 mt-3" />
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div
                          className="relative min-h-[430px] rounded-lg border border-border/70 overflow-hidden bg-background"
                          style={{
                            backgroundImage: "linear-gradient(hsl(var(--border) / .22) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--border) / .22) 1px, transparent 1px)",
                            backgroundSize: "18px 18px",
                          }}
                        >
                          <svg className="absolute inset-0 h-full w-full pointer-events-none" viewBox="0 0 100 100" preserveAspectRatio="none">
                            {graphNodes.map((node) => (
                              <line
                                key={node.key}
                                x1="50"
                                y1="50"
                                x2={node.x + 11}
                                y2={node.y + 5}
                                stroke={GRAPH_TONES[node.tone].stroke}
                                strokeWidth="0.65"
                                strokeDasharray={node.key === "conference" || node.key === "orgchart" ? "1.6 1.4" : "0"}
                              />
                            ))}
                          </svg>
                          <button
                            className="absolute left-1/2 top-1/2 z-10 w-44 -translate-x-1/2 -translate-y-1/2 rounded-lg border-2 border-primary/70 bg-background/95 p-3 text-left shadow-lg shadow-primary/10"
                            onClick={() => setEditingProject(project)}
                          >
                            <div className="flex items-center gap-2">
                              <FolderKanban className="h-4 w-4 text-primary" />
                              <span className="text-xs font-semibold leading-tight line-clamp-2">{project.title}</span>
                            </div>
                            <p className="text-[11px] text-muted-foreground mt-1.5">{project.client || "Sem cliente"}</p>
                            <Progress value={progress} className="h-1.5 mt-2" />
                          </button>
                          {graphNodes.map((node) => (
                            <button
                              key={node.key}
                              className={cn(
                                "absolute z-20 w-32 rounded-lg border p-2.5 text-left shadow-md transition hover:-translate-y-0.5 hover:bg-card sm:w-40",
                                GRAPH_TONES[node.tone].node
                              )}
                              style={{ left: `${node.x}%`, top: `${node.y}%` }}
                              onClick={node.onClick}
                            >
                              <div className="flex items-center gap-1.5 text-xs font-semibold">
                                <node.icon className={cn("h-3.5 w-3.5 shrink-0", GRAPH_TONES[node.tone].icon)} />
                                <span className="truncate">{node.label}</span>
                              </div>
                              <p className="text-[11px] text-muted-foreground truncate mt-1">{node.sub}</p>
                            </button>
                          ))}
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div className="rounded-lg border border-border/50 p-2">
                            <p className="text-muted-foreground">Contratos</p>
                            <p className="font-semibold">{projectContractCounts[project.id] || 0} anexados</p>
                          </div>
                          <div className="rounded-lg border border-border/50 p-2">
                            <p className="text-muted-foreground">Oportunidades</p>
                            <p className="font-semibold">{projectOpps.length} - {fmtMoney(oppValue)}</p>
                          </div>
                          <div className="rounded-lg border border-border/50 p-2">
                            <p className="text-muted-foreground">Metas</p>
                            <p className="font-semibold">{linkedGoals.length} vinculadas</p>
                          </div>
                          <div className="rounded-lg border border-border/50 p-2">
                            <p className="text-muted-foreground">Planejamento</p>
                            <p className="font-semibold">{goalProgress}% medio</p>
                          </div>
                          <div className="rounded-lg border border-border/50 p-2">
                            <p className="text-muted-foreground">Impacto planejado</p>
                            <p className="font-semibold">{fmtMoney(plannedFinancial)}</p>
                          </div>
                          <div className="rounded-lg border border-border/50 p-2">
                            <p className="text-muted-foreground">Riscos / suposicoes</p>
                            <p className="font-semibold">{risks.length} / {assumptions.length}</p>
                          </div>
                        </div>

                        <div className="flex flex-wrap justify-between gap-2">
                          <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => setPlanningProject(project)}>
                            <Target className="h-3.5 w-3.5 mr-1" />Plano
                          </Button>
                          <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => openOpportunityModal(project.id)}>
                            <Plus className="h-3.5 w-3.5 mr-1" />Oportunidade
                          </Button>
                          <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => setConferenceProject(project)}>
                            <ShieldCheck className="h-3.5 w-3.5 mr-1" />Conferencia
                          </Button>
                          <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => setOrgChartProject(project)}>
                            <Users className="h-3.5 w-3.5 mr-1" />Organograma
                          </Button>
                          <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => setProject360(project)}>
                            <BarChart3 className="h-3.5 w-3.5 mr-1" />360
                          </Button>
                          <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => setView("kanban")}>Ir ao Kanban</Button>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                );
              })}
              {activeProjects.length === 0 && (
                <Card className="xl:col-span-2 border-dashed">
                  <CardContent className="py-12 text-center text-sm text-muted-foreground">Nenhum projeto ativo para exibir nesta visao.</CardContent>
                </Card>
              )}
            </div>
          </TabsContent>

          <TabsContent value="planning" className="mt-4 md:mt-6">
            <ProjectPlanningPanel initialProjectId={mapProjectId === "all" ? "all" : mapProjectId} />
          </TabsContent>

          <TabsContent value="kanban" className="mt-4 md:mt-6">
            <DragDropContext onDragEnd={handleDragEnd}>
              <Droppable droppableId="columns" direction="horizontal" type="COLUMN">
                {(provided) => (
                  <div ref={provided.innerRef} {...provided.droppableProps} className="flex gap-3 md:gap-4 overflow-x-auto pb-4 snap-x snap-mandatory -mx-2 px-2">
                    {columns.map((column, columnIndex) => {
                      const colStyle = getColumnStyle(column);
                      const colProjects = getProjectsByStatus(column.id);

                      return (
                        <Draggable key={column.id} draggableId={`column-${column.id}`} index={columnIndex}>
                          {(provided, snapshot) => (
                            <div ref={provided.innerRef} {...provided.draggableProps} className={cn("flex-shrink-0 w-[72vw] sm:w-72 md:w-80 snap-center", snapshot.isDragging && "opacity-75")}>
                              <Card className="bg-card/60 backdrop-blur-sm border-border/50 overflow-hidden">
                                <CardHeader {...provided.dragHandleProps} className={cn("py-2.5 md:py-3 px-3 md:px-4 flex flex-row items-center justify-between cursor-grab active:cursor-grabbing bg-gradient-to-r", colStyle.bg)}>
                                  <div className="flex items-center gap-2 flex-1 min-w-0">
                                    <div className={cn("h-2 w-2 rounded-full shrink-0", colStyle.dot)} />
                                    {editingColumn === column.id ? (
                                      <Input
                                        value={editColumnTitle}
                                        onChange={e => setEditColumnTitle(e.target.value)}
                                        onKeyDown={e => { if (e.key === "Enter") renameColumn(column.id, editColumnTitle); if (e.key === "Escape") setEditingColumn(null); }}
                                        onBlur={() => renameColumn(column.id, editColumnTitle)}
                                        className="h-6 text-xs px-1 py-0 font-medium"
                                        autoFocus
                                        onClick={e => e.stopPropagation()}
                                      />
                                    ) : (
                                      <CardTitle className="text-xs md:text-sm font-medium truncate">{column.title}</CardTitle>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <Badge variant="secondary" className="text-[10px] md:text-xs font-mono bg-background/50 px-1.5">{colProjects.length}</Badge>
                                    <Button variant="ghost" size="icon" className="h-5 w-5 md:h-6 md:w-6 text-muted-foreground hover:text-foreground" onClick={e => { e.stopPropagation(); setEditingColumn(column.id); setEditColumnTitle(column.title); }}>
                                      <Edit2 className="h-3 w-3" />
                                    </Button>
                                    {!column.isDefault && (
                                      <Button variant="ghost" size="icon" className="h-5 w-5 md:h-6 md:w-6 text-muted-foreground hover:text-destructive" onClick={() => deleteColumn(column.id)}>
                                        <Trash2 className="h-3 w-3" />
                                      </Button>
                                    )}
                                  </div>
                                </CardHeader>
                                <Droppable droppableId={column.id} type="CARD">
                                  {(provided, snapshot) => (
                                    <CardContent ref={provided.innerRef} {...provided.droppableProps} className={cn("p-1.5 md:p-2 space-y-1.5 md:space-y-2 min-h-[150px] md:min-h-[200px] transition-colors", snapshot.isDraggingOver && "bg-primary/5")}>
                                      {colProjects.map((project, index) => {
                                        const pConfig = priorityConfig[project.priority] || priorityConfig.medium;
                                        const isOverdue = project.due_date && new Date(project.due_date) < new Date() && project.status !== "done";

                                        return (
                                          <Draggable key={project.id} draggableId={project.id} index={index}>
                                            {(provided, snapshot) => (
                                              <div
                                                ref={provided.innerRef}
                                                {...provided.draggableProps}
                                                className={cn(
                                                  "bg-card border-l-[3px] border border-border/50 rounded-lg p-2 md:p-3 transition-shadow",
                                                  snapshot.isDragging ? "shadow-lg shadow-primary/10 border-primary/50" : "hover:border-border hover:bg-muted/20",
                                                  pConfig.border,
                                                  isOverdue && "ring-1 ring-red-500/20"
                                                )}
                                              >
                                                <div className="flex items-start justify-between gap-1.5">
                                                  <div className="flex items-start gap-1.5 flex-1 min-w-0">
                                                    <div {...provided.dragHandleProps} className="mt-0.5 cursor-grab active:cursor-grabbing text-muted-foreground/50 hover:text-foreground shrink-0">
                                                      <GripVertical className="h-3.5 w-3.5 md:h-4 md:w-4" />
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                      <h4 className="font-medium text-xs md:text-sm leading-tight">{project.title}</h4>
                                                      {project.client && (
                                                        <p className="text-[10px] md:text-xs text-primary/80 mt-0.5 flex items-center gap-1 truncate">
                                                          <Building2 className="h-2.5 w-2.5 md:h-3 md:w-3 shrink-0" /><span className="truncate">{project.client}</span>
                                                        </p>
                                                      )}
                                                    </div>
                                                  </div>
                                                  <div className="flex gap-0.5 shrink-0">
                                                    <Button variant="ghost" size="icon" className="h-5 w-5 md:h-6 md:w-6 text-muted-foreground hover:text-foreground" onClick={() => {
                                                      setEditingProject(project);
                                                      setProjectForm({
                                                        title: project.title,
                                                        description: project.description || "",
                                                        priority: project.priority || "medium",
                                                        due_date: project.due_date || "",
                                                        client: project.client || "",
                                                        client_company_id: project.company_id || "",
                                                        labels: project.labels?.join(", ") || "",
                                                        status: project.status,
                                                        notes: project.notes || "",
                                                        next_invoice_date: project.next_invoice_date || "",
                                                        invoice_alert_days: String(project.invoice_alert_days ?? 7),
                                                        invoice_notes: project.invoice_notes || "",
                                                        address: (project as any).address || "",
                                                        latitude: (project as any).latitude != null ? String((project as any).latitude) : "",
                                                        longitude: (project as any).longitude != null ? String((project as any).longitude) : "",
                                                      });
                                                      setChecklistItems(Array.isArray(project.checklist) ? project.checklist : []);
                                                    }}>
                                                      <Edit2 className="h-2.5 w-2.5 md:h-3 md:w-3" />
                                                    </Button>
                                                    <Button variant="ghost" size="icon" className="h-5 w-5 md:h-6 md:w-6 text-muted-foreground hover:text-destructive" onClick={() => handleDeleteProject(project.id)}>
                                                      <Trash2 className="h-2.5 w-2.5 md:h-3 md:w-3" />
                                                    </Button>
                                                  </div>
                                                </div>
                                                {project.description && (
                                                  <p className="text-[10px] md:text-xs text-muted-foreground mt-1 ml-5 md:ml-6 line-clamp-2">{project.description}</p>
                                                )}
                                                <div className="flex items-center gap-1.5 md:gap-2 mt-2 md:mt-3 ml-5 md:ml-6 flex-wrap">
                                                  <Badge className={cn("text-[9px] md:text-[10px] border px-1 md:px-1.5", pConfig.color)} variant="secondary">{pConfig.label}</Badge>
                                                  {project.labels?.slice(0, 2).map(label => (
                                                    <Badge key={label} variant="outline" className="text-[9px] md:text-[10px] border-border/50 px-1 md:px-1.5">{label}</Badge>
                                                  ))}
                                                  {(project.labels?.length || 0) > 2 && (
                                                    <Badge variant="outline" className="text-[9px] md:text-[10px] border-border/50 px-1">+{(project.labels?.length || 0) - 2}</Badge>
                                                  )}
                                                  {project.due_date && (
                                                    <span className={cn("text-[9px] md:text-[10px] flex items-center gap-0.5", isOverdue ? "text-red-400" : "text-muted-foreground")}>
                                                      <Calendar className="h-2.5 w-2.5" />
                                                      {format(new Date(project.due_date), "dd MMM", { locale: ptBR })}
                                                    </span>
                                                  )}
                                                  {isOverdue && <Badge variant="destructive" className="text-[9px] md:text-[10px] px-1 py-0 animate-pulse">Atrasado</Badge>}
                                                  {project.next_invoice_date && (
                                                    <Badge variant="outline" className="text-[9px] md:text-[10px] px-1 md:px-1.5 gap-0.5 border-emerald-500/30 text-emerald-300 bg-emerald-500/10">
                                                      <DollarSign className="h-2.5 w-2.5" />
                                                      NF {format(new Date(project.next_invoice_date + "T00:00:00"), "dd/MM", { locale: ptBR })}
                                                    </Badge>
                                                  )}
                                                  {projectRisks.filter((risk) => risk.project_id === project.id).length > 0 && (
                                                    <Badge variant="outline" className="text-[9px] md:text-[10px] px-1 md:px-1.5 gap-0.5 border-red-500/30 text-red-300 bg-red-500/10">
                                                      <AlertTriangle className="h-2.5 w-2.5" />
                                                      {projectRisks.filter((risk) => risk.project_id === project.id).length} riscos
                                                    </Badge>
                                                  )}
                                                  {project.notes && <span title="Tem notas" className="text-muted-foreground/60"><FileText className="h-2.5 w-2.5" /></span>}
                                                  {Array.isArray(project.checklist) && project.checklist.length > 0 && (
                                                    <span className="text-[9px] md:text-[10px] text-muted-foreground font-mono">
                                                      ☑ {project.checklist.filter(i => i.done).length}/{project.checklist.length}
                                                    </span>
                                                  )}
                                                  {(pendingTaskCounts[project.id] || 0) > 0 && (
                                                    <button
                                                      type="button"
                                                      onClick={(e) => { e.stopPropagation(); navigate(`/ems/tasks?project=${project.id}`); }}
                                                      title="Ver tarefas pendentes deste projeto"
                                                    >
                                                      <Badge variant="secondary" className="text-[9px] md:text-[10px] px-1 md:px-1.5 gap-0.5 bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 cursor-pointer transition-colors">
                                                        <Clock className="h-2.5 w-2.5" />
                                                        {pendingTaskCounts[project.id]} {pendingTaskCounts[project.id] === 1 ? "tarefa" : "tarefas"}
                                                      </Badge>
                                                    </button>
                                                  )}
                                                </div>
                                                <Button
                                                  variant="ghost"
                                                  size="sm"
                                                  className="mt-2 ml-5 md:ml-6 h-7 px-2 text-[10px] text-primary hover:bg-primary/10"
                                                  onClick={(e) => { e.stopPropagation(); setProject360(project); }}
                                                >
                                                  <BarChart3 className="h-3 w-3 mr-1" />360 do projeto
                                                </Button>
                                                {(totalTaskCounts[project.id] || 0) > 0 && (() => {
                                                  const total = totalTaskCounts[project.id];
                                                  const pending = pendingTaskCounts[project.id] || 0;
                                                  const completed = total - pending;
                                                  const pct = Math.round((completed / total) * 100);
                                                  return (
                                                    <button
                                                      type="button"
                                                      onClick={(e) => { e.stopPropagation(); navigate(`/ems/tasks?project=${project.id}`); }}
                                                      className="mt-2 ml-5 md:ml-6 w-[calc(100%-1.25rem)] md:w-[calc(100%-1.5rem)] text-left group/prog hover:bg-primary/5 rounded p-1 -m-1 transition-colors block"
                                                      title="Ver tarefas deste projeto"
                                                    >
                                                      <div className="flex items-center justify-between mb-1">
                                                        <span className="text-[9px] md:text-[10px] text-muted-foreground group-hover/prog:text-primary transition-colors">Tarefas</span>
                                                        <span className="text-[9px] md:text-[10px] font-mono text-muted-foreground group-hover/prog:text-primary transition-colors">{completed}/{total} · {pct}%</span>
                                                      </div>
                                                      <Progress value={pct} className="h-1 group-hover/prog:h-1.5 transition-all" />
                                                    </button>
                                                  );
                                                })()}
                                              </div>
                                            )}
                                          </Draggable>
                                        );
                                      })}
                                      {provided.placeholder}
                                    </CardContent>
                                  )}
                                </Droppable>
                              </Card>
                            </div>
                          )}
                        </Draggable>
                      );
                    })}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </DragDropContext>
          </TabsContent>

          <TabsContent value="timeline" className="mt-4 md:mt-6">
            <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
              <CardContent className="p-3 md:p-6">
                <div className="space-y-2 md:space-y-3">
                  {projects
                    .filter(p => p.due_date)
                    .filter(p => clientFilter === "all" || p.client === clientFilter)
                    .sort((a, b) => new Date(a.due_date!).getTime() - new Date(b.due_date!).getTime())
                    .map((project, index) => {
                      const pConfig = priorityConfig[project.priority] || priorityConfig.medium;
                      const isOverdue = project.due_date && new Date(project.due_date) < new Date() && project.status !== "done";

                      return (
                        <motion.div
                          key={project.id}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: index * 0.03 }}
                          className={cn(
                            "flex items-center gap-2 md:gap-4 p-2.5 md:p-4 border-l-[3px] border border-border/50 rounded-lg bg-card hover:bg-muted/20 transition-colors",
                            pConfig.border,
                            isOverdue && "ring-1 ring-red-500/20"
                          )}
                        >
                          <div className="flex-shrink-0 w-14 md:w-20 text-center">
                            <p className="text-xs md:text-sm font-bold font-mono">{format(new Date(project.due_date!), "dd MMM", { locale: ptBR })}</p>
                            <p className="text-[9px] md:text-[10px] text-muted-foreground font-mono">{format(new Date(project.due_date!), "yyyy")}</p>
                          </div>
                          <div className="w-px h-8 md:h-10 bg-border/50" />
                          <div className="flex-1 min-w-0">
                            <h4 className="font-medium text-xs md:text-sm">{project.title}</h4>
                            {project.client && (
                              <p className="text-[10px] md:text-xs text-primary/80 flex items-center gap-1 mt-0.5 truncate"><Building2 className="h-2.5 w-2.5 md:h-3 md:w-3 shrink-0" />{project.client}</p>
                            )}
                            {project.description && <p className="text-[10px] md:text-xs text-muted-foreground truncate mt-0.5 hidden sm:block">{project.description}</p>}
                          </div>
                          <div className="flex items-center gap-1 flex-wrap shrink-0">
                            <Badge variant="secondary" className={cn("text-[9px] md:text-[10px] px-1", project.status === "done" ? "bg-emerald-500/10 text-emerald-400" : project.status === "in_progress" ? "bg-amber-500/10 text-amber-400" : "bg-blue-500/10 text-blue-400")}>
                              {project.status === "done" ? "Concluído" : project.status === "in_progress" ? "Em Progresso" : "A Fazer"}
                            </Badge>
                            {isOverdue && <Badge variant="destructive" className="text-[9px] md:text-[10px] px-1 py-0">Atrasado</Badge>}
                          </div>
                        </motion.div>
                      );
                    })}
                  {projects.filter(p => p.due_date).filter(p => clientFilter === "all" || p.client === clientFilter).length === 0 && (
                    <div className="text-center py-8 md:py-12">
                      <div className="p-3 md:p-4 rounded-full bg-muted/50 w-fit mx-auto mb-3 md:mb-4">
                        <Calendar className="h-6 w-6 md:h-8 md:w-8 text-muted-foreground/50" />
                      </div>
                      <p className="text-sm text-muted-foreground">Nenhum projeto com data de entrega definida.</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="dashboard" className="mt-4 md:mt-6 space-y-4 md:space-y-6">
            {/* Period filter */}
            <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
              <CardContent className="p-3 md:p-4">
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 md:gap-4">
                  <Label className="text-xs md:text-sm text-muted-foreground whitespace-nowrap">Filtrar período:</Label>
                  <div className="flex gap-2 w-full sm:w-auto">
                    <Input type="date" value={dashFrom} onChange={e => setDashFrom(e.target.value)} className="h-8 md:h-9 text-xs md:text-sm flex-1 sm:w-36 md:w-40" placeholder="De" />
                    <Input type="date" value={dashTo} onChange={e => setDashTo(e.target.value)} className="h-8 md:h-9 text-xs md:text-sm flex-1 sm:w-36 md:w-40" placeholder="Até" />
                    {(dashFrom || dashTo) && (
                      <Button variant="ghost" size="sm" onClick={() => { setDashFrom(""); setDashTo(""); }} className="h-8 md:h-9 px-2">
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                  <span className="text-[10px] md:text-xs text-muted-foreground">{dashProjects.length} projeto(s)</span>
                </div>
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
              {/* By Status */}
              <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
                <CardHeader className="p-3 md:p-6 pb-0"><CardTitle className="text-sm md:text-base">Projetos por Status</CardTitle></CardHeader>
                <CardContent className="p-3 md:p-6">
                  {(() => {
                    const statusData = columns.map(col => ({
                      name: col.title,
                      value: dashProjects.filter(p => p.status === col.id).length,
                    })).filter(d => d.value > 0);
                    return statusData.length > 0 ? (
                      <ResponsiveContainer width="100%" height={220}>
                        <PieChart>
                          <Pie data={statusData} cx="50%" cy="50%" outerRadius={70} innerRadius={40} dataKey="value" label={({ name, value }) => `${name}: ${value}`} labelLine={false}>
                            {statusData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                          </Pie>
                          <Tooltip />
                        </PieChart>
                      </ResponsiveContainer>
                    ) : <p className="text-center text-muted-foreground py-8 md:py-12 text-sm">Sem dados</p>;
                  })()}
                </CardContent>
              </Card>

              {/* By Priority */}
              <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
                <CardHeader className="p-3 md:p-6 pb-0"><CardTitle className="text-sm md:text-base">Projetos por Prioridade</CardTitle></CardHeader>
                <CardContent className="p-3 md:p-6">
                  {(() => {
                    const prioData = Object.entries(priorityConfig).map(([key, cfg]) => ({
                      name: cfg.label,
                      value: dashProjects.filter(p => p.priority === key).length,
                    })).filter(d => d.value > 0);
                    return prioData.length > 0 ? (
                      <ResponsiveContainer width="100%" height={220}>
                        <BarChart data={prioData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                          <XAxis dataKey="name" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                          <YAxis allowDecimals={false} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} width={30} />
                          <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
                          <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                            {prioData.map((_, i) => <Cell key={i} fill={["#3b82f6", "#f59e0b", "#ef4444"][i] || CHART_COLORS[i]} />)}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    ) : <p className="text-center text-muted-foreground py-8 md:py-12 text-sm">Sem dados</p>;
                  })()}
                </CardContent>
              </Card>

              {/* By Company */}
              <Card className="border-border/50 bg-card/80 backdrop-blur-sm lg:col-span-2">
                <CardHeader className="p-3 md:p-6 pb-0"><CardTitle className="text-sm md:text-base">Projetos por Empresa</CardTitle></CardHeader>
                <CardContent className="p-3 md:p-6">
                  {(() => {
                    const companyData = companies.map(c => ({
                      name: c.name,
                      total: dashProjects.filter(p => p.company_id === c.id).length,
                      concluidos: dashProjects.filter(p => p.company_id === c.id && p.status === "done").length,
                      em_progresso: dashProjects.filter(p => p.company_id === c.id && p.status === "in_progress").length,
                    })).filter(d => d.total > 0);
                    return companyData.length > 0 ? (
                      <ResponsiveContainer width="100%" height={250}>
                        <BarChart data={companyData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                          <XAxis dataKey="name" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                          <YAxis allowDecimals={false} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} width={30} />
                          <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
                          <Legend wrapperStyle={{ fontSize: 11 }} />
                          <Bar dataKey="total" name="Total" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                          <Bar dataKey="em_progresso" name="Em Progresso" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                          <Bar dataKey="concluidos" name="Concluídos" fill="#10b981" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    ) : <p className="text-center text-muted-foreground py-8 md:py-12 text-sm">Sem dados por empresa</p>;
                  })()}
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>

        {/* Add/Edit Project Dialog */}
        <Dialog open={showAddProject || !!editingProject} onOpenChange={(open) => {
          if (!open) { setShowAddProject(false); setEditingProject(null); setProjectForm(emptyProjectForm); setChecklistItems([]); setNewCheckItem(""); }
        }}>
          <DialogContent className="max-w-[95vw] sm:max-w-2xl max-h-[90vh] flex flex-col">
            <DialogHeader><DialogTitle className="text-base md:text-lg">{editingProject ? "Editar Projeto" : "Novo Projeto"}</DialogTitle></DialogHeader>
            <div className="space-y-3 md:space-y-4 py-2 md:py-4 overflow-y-auto flex-1 pr-1">
              <div><Label className="text-xs md:text-sm">Título</Label><Input value={projectForm.title} onChange={(e) => setProjectForm({ ...projectForm, title: e.target.value })} placeholder="Nome do projeto" className="text-sm" /></div>
              <div><Label className="text-xs md:text-sm">Descrição</Label><Textarea value={projectForm.description} onChange={(e) => setProjectForm({ ...projectForm, description: e.target.value })} placeholder="Descrição do projeto" className="text-sm" /></div>
              <div>
                <Label className="text-xs md:text-sm">Cliente / Empresa</Label>
                <Select
                  value={projectForm.client_company_id || "custom"}
                  onValueChange={(value) => {
                    if (value === "custom") {
                      setProjectForm({ ...projectForm, client_company_id: "" });
                      return;
                    }
                    const company = companies.find((item) => item.id === value);
                    setProjectForm({ ...projectForm, client_company_id: value, client: company?.name || projectForm.client });
                  }}
                >
                  <SelectTrigger className="text-sm"><SelectValue placeholder="Escolha um cliente" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="custom">Informar manualmente</SelectItem>
                    {companies.map((company) => <SelectItem key={company.id} value={company.id}>{company.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Input value={projectForm.client} onChange={(e) => setProjectForm({ ...projectForm, client: e.target.value })} placeholder="Nome do cliente ou empresa" className="mt-2 text-sm" />
              </div>
              <div><Label className="text-xs md:text-sm">Labels</Label><Input value={projectForm.labels} onChange={(e) => setProjectForm({ ...projectForm, labels: e.target.value })} placeholder="Ex: frontend, urgente (separados por vírgula)" className="text-sm" /></div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
                <div>
                  <Label className="text-xs md:text-sm">Prioridade</Label>
                  <Select value={projectForm.priority} onValueChange={(v) => setProjectForm({ ...projectForm, priority: v })}>
                    <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Baixa</SelectItem>
                      <SelectItem value="medium">Média</SelectItem>
                      <SelectItem value="high">Alta</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div><Label className="text-xs md:text-sm">Data de Entrega</Label><Input type="date" value={projectForm.due_date} onChange={(e) => setProjectForm({ ...projectForm, due_date: e.target.value })} className="text-sm" /></div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
                <div><Label className="text-xs md:text-sm">PrÃ³xima Nota Fiscal</Label><Input type="date" value={projectForm.next_invoice_date} onChange={(e) => setProjectForm({ ...projectForm, next_invoice_date: e.target.value })} className="text-sm" /></div>
                <div><Label className="text-xs md:text-sm">Alertar com antecedÃªncia (dias)</Label><Input type="number" min="0" value={projectForm.invoice_alert_days} onChange={(e) => setProjectForm({ ...projectForm, invoice_alert_days: e.target.value })} className="text-sm" /></div>
              </div>
              <div><Label className="text-xs md:text-sm">Observações da Nota Fiscal</Label><Textarea value={projectForm.invoice_notes} onChange={(e) => setProjectForm({ ...projectForm, invoice_notes: e.target.value })} placeholder="Competência, valor previsto, dados de faturamento..." className="text-sm" rows={2} /></div>
              <div>
                <Label className="text-xs md:text-sm">Endereco</Label>
                <AddressAutocomplete
                  value={projectForm.address}
                  onChange={(address) => setProjectForm((prev) => ({ ...prev, address }))}
                  onResolved={(result) => setProjectForm((prev) => ({ ...prev, address: result.label, latitude: result.lat.toString(), longitude: result.lng.toString() }))}
                  placeholder="Rua, numero, cidade, UF"
                  className="mt-1"
                />
                {(projectForm.latitude || projectForm.longitude) && (
                  <p className="mt-1 text-xs text-muted-foreground">Lat {projectForm.latitude || "-"} / Lng {projectForm.longitude || "-"}</p>
                )}
              </div>
              {editingProject && (
                <div>
                  <Label className="text-xs md:text-sm">Coluna / Status</Label>
                  <Select value={projectForm.status} onValueChange={(v) => setProjectForm({ ...projectForm, status: v })}>
                    <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {columns.map(col => (
                        <SelectItem key={col.id} value={col.id}>{col.title}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div><Label className="text-xs md:text-sm">Notas internas</Label><Textarea value={projectForm.notes} onChange={(e) => setProjectForm({ ...projectForm, notes: e.target.value })} placeholder="Anotações, contexto, observações..." className="text-sm" rows={3} /></div>
              <div>
                <Label className="text-xs md:text-sm">Checklist</Label>
                <div className="flex gap-2 mt-1.5">
                  <Input value={newCheckItem} onChange={e => setNewCheckItem(e.target.value)} placeholder="Novo item..." className="text-sm" onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addChecklistItem(); } }} />
                  <Button type="button" variant="outline" size="sm" onClick={addChecklistItem}><Plus className="h-3.5 w-3.5" /></Button>
                </div>
                {checklistItems.length > 0 && (
                  <div className="space-y-1 mt-2 max-h-32 overflow-y-auto">
                    {checklistItems.map(item => (
                      <div key={item.id} className="flex items-center gap-2 p-1.5 rounded bg-muted/30">
                        <input type="checkbox" checked={item.done} onChange={() => toggleChecklistItem(item.id)} className="h-3.5 w-3.5 accent-primary" />
                        <span className={cn("flex-1 text-xs", item.done && "line-through text-muted-foreground")}>{item.text}</span>
                        <Button type="button" variant="ghost" size="icon" className="h-5 w-5 text-muted-foreground hover:text-destructive" onClick={() => removeChecklistItem(item.id)}><X className="h-3 w-3" /></Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              {editingProject && (
                <div className="border-t border-border pt-3 space-y-4">
                  <AttachmentManager entityType="project_contract" entityId={editingProject.id} companyId={editingProject.company_id} clientCompanyId={editingProject.company_id} projectId={editingProject.id} documentType="contract" title="Contratos em PDF" accept="application/pdf" showMetadata />
                  <AttachmentManager entityType="project_invoice" entityId={editingProject.id} companyId={editingProject.company_id} clientCompanyId={editingProject.company_id} projectId={editingProject.id} documentType="invoice" title="Notas Fiscais em PDF" accept="application/pdf" showMetadata />
                  <AttachmentManager entityType="project" entityId={editingProject.id} companyId={editingProject.company_id} clientCompanyId={editingProject.company_id} projectId={editingProject.id} documentType="other" title="Outros anexos" showMetadata />
                </div>
              )}
            </div>
            <DialogFooter className="gap-2">
              <Button variant="outline" size="sm" onClick={() => { setShowAddProject(false); setEditingProject(null); }}>Cancelar</Button>
              <Button size="sm" onClick={editingProject ? handleUpdateProject : handleAddProject}>{editingProject ? "Salvar" : "Criar"}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Execution Record Modal */}
        <Dialog open={showExecutionModal} onOpenChange={setShowExecutionModal}>
          <DialogContent className="max-w-[95vw] sm:max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-base md:text-lg"><CheckCircle className="h-4 w-4 md:h-5 md:w-5 text-primary" />Registro de Execução</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 md:space-y-4 py-2 md:py-4">
              <p className="text-xs md:text-sm text-muted-foreground">Complete o registro para arquivar este projeto na Knowledge Base.</p>
              <div><Label className="text-xs md:text-sm">Ação Realizada *</Label><Textarea value={executionForm.action_taken} onChange={(e) => setExecutionForm({ ...executionForm, action_taken: e.target.value })} placeholder="O que foi feito?" className="text-sm" /></div>
              <div><Label className="text-xs md:text-sm">Resultado Obtido *</Label><Textarea value={executionForm.result_obtained} onChange={(e) => setExecutionForm({ ...executionForm, result_obtained: e.target.value })} placeholder="Quais resultados?" className="text-sm" /></div>
              <div><Label className="text-xs md:text-sm">Lições Aprendidas *</Label><Textarea value={executionForm.lessons_learned} onChange={(e) => setExecutionForm({ ...executionForm, lessons_learned: e.target.value })} placeholder="O que aprendeu?" className="text-sm" /></div>
              <div>
                <Label className="text-xs md:text-sm">Tags</Label>
                <div className="flex gap-2">
                  <Input value={tagInput} onChange={(e) => setTagInput(e.target.value)} placeholder="Adicionar tag" className="text-sm" onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTag(); } }} />
                  <Button type="button" variant="outline" size="sm" onClick={addTag}><Plus className="h-4 w-4" /></Button>
                </div>
                {executionForm.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {executionForm.tags.map((tag) => (
                      <Badge key={tag} variant="secondary" className="gap-1 text-xs">{tag}<button onClick={() => removeTag(tag)}><X className="h-3 w-3" /></button></Badge>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <DialogFooter className="gap-2">
              <Button variant="outline" size="sm" onClick={() => setShowExecutionModal(false)}>Cancelar</Button>
              <Button size="sm" onClick={handleCompleteWithExecution}>Concluir e Registrar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Add Column Modal */}
        <Dialog open={showColumnModal} onOpenChange={setShowColumnModal}>
          <DialogContent className="max-w-[95vw] sm:max-w-md">
            <DialogHeader><DialogTitle className="text-base md:text-lg">Nova Coluna</DialogTitle></DialogHeader>
            <div className="space-y-4 py-2 md:py-4">
              <div><Label className="text-xs md:text-sm">Nome da Coluna</Label><Input value={newColumnTitle} onChange={(e) => setNewColumnTitle(e.target.value)} placeholder="Ex: Em Revisão" className="text-sm" /></div>
              <div>
                <Label className="text-xs md:text-sm">Cor</Label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {COLUMN_COLORS.map(c => (
                    <button
                      key={c.value}
                      onClick={() => setNewColumnColor(c.value)}
                      className={cn("h-7 w-7 md:h-8 md:w-8 rounded-full border-2 transition-all", c.dot, newColumnColor === c.value ? "border-foreground scale-110" : "border-transparent opacity-60 hover:opacity-100")}
                      title={c.label}
                    />
                  ))}
                </div>
              </div>
            </div>
            <DialogFooter className="gap-2">
              <Button variant="outline" size="sm" onClick={() => setShowColumnModal(false)}>Cancelar</Button>
              <Button size="sm" onClick={addColumn}>Criar Coluna</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={!!project360} onOpenChange={(open) => !open && setProject360(null)}>
          <DialogContent className="max-w-[95vw] sm:max-w-3xl">
            <DialogHeader>
              <DialogTitle className="text-base md:text-lg">360 do projeto</DialogTitle>
            </DialogHeader>
            {project360 && (() => {
              const metrics = getGraphMetrics(project360);
              const openTasks = pendingTaskCounts[project360.id] || 0;
              const totalTasks = totalTaskCounts[project360.id] || 0;
              const projectRiskList = projectRisks.filter((risk) => risk.project_id === project360.id);
              return (
                <div className="space-y-4">
                  <div className="rounded-lg border border-border/50 bg-muted/20 p-4">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <h3 className="text-lg font-semibold">{project360.title}</h3>
                        <p className="text-sm text-muted-foreground">{project360.client || "Sem cliente informado"}</p>
                      </div>
                      <Badge variant="outline" className="w-fit font-mono">{metrics.progress}%</Badge>
                    </div>
                    <Progress value={metrics.progress} className="mt-3 h-2" />
                  </div>
                  <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                    {[
                      { label: "Tarefas abertas", value: openTasks, hint: `${totalTasks} totais`, icon: Clock, color: "text-amber-300" },
                      { label: "Oportunidades", value: fmtMoney(metrics.opportunityValue), hint: `${metrics.projectOpps.length} registros`, icon: DollarSign, color: "text-emerald-300" },
                      { label: "Proxima NF", value: project360.next_invoice_date ? format(new Date(project360.next_invoice_date + "T00:00:00"), "dd/MM", { locale: ptBR }) : "Sem data", hint: project360.invoice_notes || "alerta financeiro", icon: FileText, color: "text-blue-300" },
                      { label: "Riscos", value: projectRiskList.length, hint: projectRiskList[0]?.risk || "monitoramento", icon: AlertTriangle, color: "text-red-300" },
                    ].map((item) => (
                      <Card key={item.label} className="border-border/50">
                        <CardContent className="p-3">
                          <item.icon className={cn("mb-2 h-4 w-4", item.color)} />
                          <p className="truncate text-lg font-bold font-mono">{item.value}</p>
                          <p className="text-xs font-medium">{item.label}</p>
                          <p className="mt-1 truncate text-[10px] text-muted-foreground">{item.hint}</p>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <Card className="border-border/50">
                      <CardHeader className="pb-2"><CardTitle className="text-sm">Plano e metas</CardTitle></CardHeader>
                      <CardContent className="space-y-2 text-sm">
                        <div className="flex justify-between"><span className="text-muted-foreground">Metas vinculadas</span><strong>{metrics.linkedGoals.length}</strong></div>
                        <div className="flex justify-between"><span className="text-muted-foreground">Progresso medio</span><strong>{metrics.goalProgress}%</strong></div>
                        <div className="flex justify-between"><span className="text-muted-foreground">Impacto planejado</span><strong>{fmtMoney(metrics.plannedFinancial)}</strong></div>
                      </CardContent>
                    </Card>
                    <Card className="border-border/50">
                      <CardHeader className="pb-2"><CardTitle className="text-sm">Acoes rapidas</CardTitle></CardHeader>
                      <CardContent className="flex flex-wrap gap-2">
                        <Button size="sm" variant="outline" onClick={() => { setPlanningProject(project360); setProject360(null); }}>Plano</Button>
                        <Button size="sm" variant="outline" onClick={() => { openOpportunityModal(project360.id); setProject360(null); }}>Oportunidade</Button>
                        <Button size="sm" variant="outline" onClick={() => navigate(`/ems/tasks?project=${project360.id}`)}>Tarefas</Button>
                        <Button size="sm" variant="outline" onClick={() => { setEditingProject(project360); setProject360(null); }}>Editar</Button>
                      </CardContent>
                    </Card>
                  </div>
                </div>
              );
            })()}
          </DialogContent>
        </Dialog>

        <Dialog open={showOpportunityModal} onOpenChange={setShowOpportunityModal}>
          <DialogContent className="max-w-[95vw] sm:max-w-md">
            <DialogHeader><DialogTitle className="text-base md:text-lg">Nova Oportunidade</DialogTitle></DialogHeader>
            <div className="space-y-3 py-2 md:py-4">
              <div>
                <Label className="text-xs md:text-sm">Projeto</Label>
                <Select value={opportunityProjectId} onValueChange={setOpportunityProjectId}>
                  <SelectTrigger className="text-sm"><SelectValue placeholder="Escolha o projeto" /></SelectTrigger>
                  <SelectContent>
                    {projects.filter(p => p.status !== "done").map(project => (
                      <SelectItem key={project.id} value={project.id}>{project.title}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div><Label className="text-xs md:text-sm">Oportunidade</Label><Input value={opportunityForm.title} onChange={(e) => setOpportunityForm({ ...opportunityForm, title: e.target.value })} placeholder="Ex: Expansao de contrato" className="text-sm" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label className="text-xs md:text-sm">Valor estimado</Label><Input type="number" value={opportunityForm.value} onChange={(e) => setOpportunityForm({ ...opportunityForm, value: e.target.value })} placeholder="0" className="text-sm font-mono" /></div>
                <div><Label className="text-xs md:text-sm">Probabilidade %</Label><Input type="number" min="0" max="100" value={opportunityForm.probability} onChange={(e) => setOpportunityForm({ ...opportunityForm, probability: e.target.value })} className="text-sm font-mono" /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs md:text-sm">Etapa</Label>
                  <Select value={opportunityForm.stage} onValueChange={(stage) => setOpportunityForm({ ...opportunityForm, stage })}>
                    <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="nova">Nova</SelectItem>
                      <SelectItem value="qualificacao">Qualificacao</SelectItem>
                      <SelectItem value="proposta">Proposta</SelectItem>
                      <SelectItem value="negociacao">Negociacao</SelectItem>
                      <SelectItem value="ganha">Ganha</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div><Label className="text-xs md:text-sm">Fechamento previsto</Label><Input type="date" value={opportunityForm.expected_close_date} onChange={(e) => setOpportunityForm({ ...opportunityForm, expected_close_date: e.target.value })} className="text-sm" /></div>
              </div>
            </div>
            <DialogFooter className="gap-2">
              <Button variant="outline" size="sm" onClick={() => setShowOpportunityModal(false)}>Cancelar</Button>
              <Button size="sm" onClick={saveOpportunity}>Salvar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={!!planningProject} onOpenChange={(open) => !open && setPlanningProject(null)}>
          <DialogContent className="max-w-[95vw] sm:max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Plano + Metas do Projeto</DialogTitle></DialogHeader>
            {planningProject && (() => {
              const metrics = getGraphMetrics(planningProject);
              return (
                <div className="space-y-4">
                  <div className="rounded-lg border border-border/60 p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <h3 className="font-semibold">{planningProject.title}</h3>
                        <p className="text-sm text-muted-foreground">{planningProject.client || "Sem cliente"} - {metrics.progress}% de progresso</p>
                      </div>
                      <Button size="sm" onClick={() => navigate("/ems/planning")}>Abrir Planejamento e Metas</Button>
                    </div>
                    <Progress value={metrics.progress} className="h-2 mt-3" />
                  </div>

                  <div className="grid gap-3 md:grid-cols-4">
                    <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">Metas</p><p className="text-xl font-bold">{metrics.linkedGoals.length}</p></CardContent></Card>
                    <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">Impacto planejado</p><p className="text-xl font-bold font-mono">{fmtMoney(metrics.plannedFinancial)}</p></CardContent></Card>
                    <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">Riscos</p><p className="text-xl font-bold">{metrics.risks.length}</p></CardContent></Card>
                    <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">Suposicoes</p><p className="text-xl font-bold">{metrics.assumptions.length}</p></CardContent></Card>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <Card>
                      <CardHeader><CardTitle className="text-base">Metas vinculadas</CardTitle></CardHeader>
                      <CardContent className="space-y-2">
                        {metrics.linkedGoals.map(goal => (
                          <div key={goal.id} className="rounded-lg border border-border/50 p-2">
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-sm font-semibold truncate">{goal.title}</p>
                              <Badge variant="outline">{goal.progress || 0}%</Badge>
                            </div>
                            <Progress value={Number(goal.progress || 0)} className="h-1.5 mt-2" />
                          </div>
                        ))}
                        {metrics.linkedGoals.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">Sem metas vinculadas ainda.</p>}
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader><CardTitle className="text-base">Impactos financeiros</CardTitle></CardHeader>
                      <CardContent className="space-y-2">
                        {metrics.financialImpacts.map(impact => (
                          <div key={impact.id} className="flex items-start justify-between gap-3 rounded-lg border border-border/50 p-2">
                            <div className="min-w-0">
                              <p className="text-sm font-semibold truncate">{impact.title}</p>
                              <p className="text-xs text-muted-foreground">{impact.expected_date ? format(new Date(`${impact.expected_date}T12:00:00`), "dd/MM/yyyy") : "Sem data"} - {impact.confidence || "media"}</p>
                            </div>
                            <Badge variant={impact.impact_type === "cost" ? "destructive" : "secondary"}>{fmtMoney(Number(impact.expected_amount || 0))}</Badge>
                          </div>
                        ))}
                        {metrics.financialImpacts.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">Sem impactos planejados ainda.</p>}
                      </CardContent>
                    </Card>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <Card>
                      <CardHeader><CardTitle className="text-base">Riscos</CardTitle></CardHeader>
                      <CardContent className="space-y-2">
                        {metrics.risks.map(risk => (
                          <div key={risk.id} className="flex items-center justify-between gap-2 rounded-lg border border-border/50 p-2">
                            <span className="text-sm truncate">{risk.risk}</span>
                            <Badge variant="outline">score {risk.score || 0}</Badge>
                          </div>
                        ))}
                        {metrics.risks.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">Nenhum risco vinculado.</p>}
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader><CardTitle className="text-base">Suposicoes / gaps</CardTitle></CardHeader>
                      <CardContent className="space-y-2">
                        {metrics.assumptions.map(assumption => (
                          <div key={assumption.id} className="flex items-center justify-between gap-2 rounded-lg border border-border/50 p-2">
                            <span className="text-sm truncate">{assumption.assumption}</span>
                            <Badge variant="outline">{assumption.status || "a testar"}</Badge>
                          </div>
                        ))}
                        {metrics.assumptions.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">Nenhuma suposicao vinculada.</p>}
                      </CardContent>
                    </Card>
                  </div>
                </div>
              );
            })()}
          </DialogContent>
        </Dialog>

        <Dialog open={!!conferenceProject} onOpenChange={(open) => !open && setConferenceProject(null)}>
          <DialogContent className="max-w-[95vw] max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Conferencia do Projeto</DialogTitle></DialogHeader>
            {conferenceProject && (
              <ConferenciaContent embedded projectId={conferenceProject.id} projectTitle={conferenceProject.title} />
            )}
          </DialogContent>
        </Dialog>

        <Dialog open={!!orgChartProject} onOpenChange={(open) => !open && setOrgChartProject(null)}>
          <DialogContent className="max-w-[95vw] max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Organograma do Projeto</DialogTitle></DialogHeader>
            {orgChartProject && (
              <OrgChartContent embedded projectId={orgChartProject.id} projectTitle={orgChartProject.title} />
            )}
          </DialogContent>
        </Dialog>

        {/* Projects Report Dialog */}
        <Dialog open={reportOpen} onOpenChange={setReportOpen}>
          <DialogContent className="max-w-[95vw] sm:max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-base md:text-lg"><FileText className="h-4 w-4 md:h-5 md:w-5 text-primary" />Relatório de Projetos Concluídos</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 md:space-y-4 py-2 md:py-4">
              <div className="grid grid-cols-2 gap-3 md:gap-4">
                <div><Label className="text-xs md:text-sm">Data Início</Label><Input type="date" value={reportFrom} onChange={e => setReportFrom(e.target.value)} className="text-sm" /></div>
                <div><Label className="text-xs md:text-sm">Data Fim</Label><Input type="date" value={reportTo} onChange={e => setReportTo(e.target.value)} className="text-sm" /></div>
              </div>
              <div>
                <Label className="text-xs md:text-sm">Empresa</Label>
                <Select value={reportCompanyId} onValueChange={setReportCompanyId}>
                  <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="current">Empresa Atual</SelectItem>
                    <SelectItem value="all">Todas</SelectItem>
                    {companies.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="p-2.5 md:p-3 rounded-lg bg-muted/50 border border-border/50">
                <p className="text-xs md:text-sm text-muted-foreground">{reportProjects.length} projeto(s) encontrado(s)</p>
              </div>
              {reportProjects.length > 0 && (
                <div className="max-h-36 md:max-h-48 overflow-y-auto space-y-1">
                  {reportProjects.map(p => (
                    <div key={p.id} className="flex items-center justify-between text-xs md:text-sm p-1.5 md:p-2 rounded bg-card border border-border/30">
                      <span className="truncate flex-1">{p.title}</span>
                      <span className="text-[10px] md:text-xs text-muted-foreground ml-2">{p.client || "—"}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <DialogFooter className="gap-2">
              <Button variant="outline" size="sm" onClick={() => setReportOpen(false)}>Fechar</Button>
              <Button variant="outline" size="sm" onClick={generateProjectsCSV} disabled={reportProjects.length === 0}>
                <Download className="h-3.5 w-3.5 mr-1.5" />CSV
              </Button>
              <Button size="sm" onClick={generateProjectsPDF} disabled={reportProjects.length === 0}>
                <Download className="h-3.5 w-3.5 mr-1.5" />PDF
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </motion.div>
    </EMSLayout>
  );
};

export default Projects;
