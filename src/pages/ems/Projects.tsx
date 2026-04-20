import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
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
  FileText, Download, BarChart3,
} from "lucide-react";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { AttachmentManager } from "@/components/ems/AttachmentManager";

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

const Projects = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const { selectedCompanyId, companies } = useCompany();
  const [view, setView] = useState<"kanban" | "timeline" | "dashboard">("kanban");
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
  const [reportOpen, setReportOpen] = useState(false);
  const [reportFrom, setReportFrom] = useState("");
  const [reportTo, setReportTo] = useState("");
  const [reportCompanyId, setReportCompanyId] = useState<string>("current");
  const [allProjects, setAllProjects] = useState<Project[]>([]);
  const [pendingTaskCounts, setPendingTaskCounts] = useState<Record<string, number>>({});
  const [totalTaskCounts, setTotalTaskCounts] = useState<Record<string, number>>({});
  const [dashFrom, setDashFrom] = useState("");
  const [dashTo, setDashTo] = useState("");

  const [projectForm, setProjectForm] = useState({ title: "", description: "", priority: "medium", due_date: "", client: "", labels: "", status: "todo", notes: "" });
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
  }, [selectedCompanyId]);

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

  const generateProjectsPDF = () => {
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

  const handleAddProject = async () => {
    if (!projectForm.title) return;
    const maxOrder = projects.filter(p => p.status === "todo").length;
    await supabase.from("projects").insert({
      title: projectForm.title, description: projectForm.description || null, priority: projectForm.priority,
      due_date: projectForm.due_date || null, status: "todo", column_order: maxOrder,
      company_id: selectedCompanyId !== "all" ? selectedCompanyId : null,
      client: projectForm.client || null, labels: projectForm.labels ? projectForm.labels.split(",").map(l => l.trim()).filter(Boolean) : [],
    });
    setProjectForm({ title: "", description: "", priority: "medium", due_date: "", client: "", labels: "", status: "todo", notes: "" });
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
    await supabase.from("projects").update({
      title: projectForm.title, description: projectForm.description, priority: projectForm.priority,
      due_date: projectForm.due_date || null, client: projectForm.client || null,
      labels: projectForm.labels ? projectForm.labels.split(",").map(l => l.trim()).filter(Boolean) : [],
      status: newStatus, notes: projectForm.notes || null, checklist: checklistItems as unknown as any,
    }).eq("id", editingProject.id);
    setEditingProject(null);
    setProjectForm({ title: "", description: "", priority: "medium", due_date: "", client: "", labels: "", status: "todo", notes: "" });
    setChecklistItems([]);
    fetchProjects();
    toast({ title: "Projeto atualizado!" });
  };

  const handleDeleteProject = async (id: string) => {
    await supabase.from("projects").delete().eq("id", id);
    fetchProjects();
    toast({ title: "Projeto removido!" });
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
  const completionRate = totalProjects > 0 ? Math.round((doneProjects / totalProjects) * 100) : 0;

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
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2 md:gap-3">
          {[
            { label: "Total", value: totalProjects, icon: FolderKanban, color: "text-primary", gradient: "from-primary/10 to-primary/5" },
            { label: "Em Progresso", value: inProgressProjects, icon: Clock, color: "text-amber-400", gradient: "from-amber-500/10 to-amber-500/5" },
            { label: "Concluídos", value: doneProjects, icon: CheckCircle, color: "text-emerald-400", gradient: "from-emerald-500/10 to-emerald-500/5" },
            { label: "Atrasados", value: overdueProjects, icon: AlertTriangle, color: "text-red-400", gradient: "from-red-500/10 to-red-500/5" },
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
        <Tabs value={view} onValueChange={(v) => setView(v as "kanban" | "timeline" | "dashboard")}>
          <TabsList className="w-full sm:w-auto">
            <TabsTrigger value="kanban" className="gap-1.5 text-xs md:text-sm flex-1 sm:flex-none"><LayoutGrid className="h-3.5 w-3.5 md:h-4 md:w-4" />Kanban</TabsTrigger>
            <TabsTrigger value="timeline" className="gap-1.5 text-xs md:text-sm flex-1 sm:flex-none"><GanttChart className="h-3.5 w-3.5 md:h-4 md:w-4" />Timeline</TabsTrigger>
            <TabsTrigger value="dashboard" className="gap-1.5 text-xs md:text-sm flex-1 sm:flex-none"><BarChart3 className="h-3.5 w-3.5 md:h-4 md:w-4" />Dashboard</TabsTrigger>
          </TabsList>

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
                                                      setProjectForm({ title: project.title, description: project.description || "", priority: project.priority, due_date: project.due_date || "", client: project.client || "", labels: project.labels?.join(", ") || "", status: project.status, notes: project.notes || "" });
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
          if (!open) { setShowAddProject(false); setEditingProject(null); setProjectForm({ title: "", description: "", priority: "medium", due_date: "", client: "", labels: "", status: "todo", notes: "" }); setChecklistItems([]); setNewCheckItem(""); }
        }}>
          <DialogContent className="max-w-[95vw] sm:max-w-lg max-h-[90vh] flex flex-col">
            <DialogHeader><DialogTitle className="text-base md:text-lg">{editingProject ? "Editar Projeto" : "Novo Projeto"}</DialogTitle></DialogHeader>
            <div className="space-y-3 md:space-y-4 py-2 md:py-4 overflow-y-auto flex-1 pr-1">
              <div><Label className="text-xs md:text-sm">Título</Label><Input value={projectForm.title} onChange={(e) => setProjectForm({ ...projectForm, title: e.target.value })} placeholder="Nome do projeto" className="text-sm" /></div>
              <div><Label className="text-xs md:text-sm">Descrição</Label><Textarea value={projectForm.description} onChange={(e) => setProjectForm({ ...projectForm, description: e.target.value })} placeholder="Descrição do projeto" className="text-sm" /></div>
              <div><Label className="text-xs md:text-sm">Cliente / Empresa</Label><Input value={projectForm.client} onChange={(e) => setProjectForm({ ...projectForm, client: e.target.value })} placeholder="Nome do cliente ou empresa" className="text-sm" /></div>
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
            </div>
              {editingProject && (
                <div className="border-t border-border pt-3">
                  <AttachmentManager entityType="project" entityId={editingProject.id} companyId={editingProject.company_id} />
                </div>
              )}
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
