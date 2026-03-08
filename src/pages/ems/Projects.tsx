import { useState, useEffect, useMemo } from "react";
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
  FileText, Download, BarChart3, Palette,
} from "lucide-react";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

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
}

interface KanbanColumn {
  id: string;
  title: string;
  order_index: number;
}

interface ExecutionRecord {
  action_taken: string;
  result_obtained: string;
  lessons_learned: string;
  tags: string[];
}

const defaultColumns: KanbanColumn[] = [
  { id: "todo", title: "A Fazer", order_index: 0 },
  { id: "in_progress", title: "Em Progresso", order_index: 1 },
  { id: "done", title: "Concluído", order_index: 2 },
];

const priorityConfig: Record<string, { label: string; color: string; border: string }> = {
  low: { label: "Baixa", color: "text-blue-400 bg-blue-500/10 border-blue-500/30", border: "border-l-blue-500" },
  medium: { label: "Média", color: "text-yellow-400 bg-yellow-500/10 border-yellow-500/30", border: "border-l-yellow-500" },
  high: { label: "Alta", color: "text-red-400 bg-red-500/10 border-red-500/30", border: "border-l-red-500" },
};

const columnColors: Record<string, { header: string; accent: string }> = {
  todo: { header: "from-blue-500/10 to-transparent", accent: "text-blue-400" },
  in_progress: { header: "from-amber-500/10 to-transparent", accent: "text-amber-400" },
  done: { header: "from-emerald-500/10 to-transparent", accent: "text-emerald-400" },
};

const Projects = () => {
  const { toast } = useToast();
  const { selectedCompanyId } = useCompany();
  const [view, setView] = useState<"kanban" | "timeline">("kanban");
  const [projects, setProjects] = useState<Project[]>([]);
  const [columns, setColumns] = useState<KanbanColumn[]>(defaultColumns);
  const [showAddProject, setShowAddProject] = useState(false);
  const [showExecutionModal, setShowExecutionModal] = useState(false);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [showColumnModal, setShowColumnModal] = useState(false);
  const [newColumnTitle, setNewColumnTitle] = useState("");
  const [clientFilter, setClientFilter] = useState<string>("all");
  const [isInitialized, setIsInitialized] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportFrom, setReportFrom] = useState("");
  const [reportTo, setReportTo] = useState("");
  const [reportCompanyId, setReportCompanyId] = useState<string>("current");
  const [allProjects, setAllProjects] = useState<(Project & { company_id?: string | null })[]>([]);

  const [projectForm, setProjectForm] = useState({ title: "", description: "", priority: "medium", due_date: "", client: "", labels: "" });
  const [executionForm, setExecutionForm] = useState<ExecutionRecord>({ action_taken: "", result_obtained: "", lessons_learned: "", tags: [] });
  const [tagInput, setTagInput] = useState("");

  useEffect(() => { 
    setColumns(defaultColumns);
    fetchProjects(); 
    setIsInitialized(true);
  }, [selectedCompanyId]);

  const { companies } = useCompany();

  const fetchProjects = async () => {
    let query = supabase.from("projects").select("*").order("column_order", { ascending: true, nullsFirst: false });
    if (selectedCompanyId !== "all") query = query.eq("company_id", selectedCompanyId);
    const { data } = await query;
    if (data) setProjects(data as Project[]);
  };

  const fetchReportProjects = async () => {
    const { data } = await supabase.from("projects").select("*").eq("status", "done");
    if (data) setAllProjects(data as any[]);
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
        p.title,
        p.client || "—",
        priorityConfig[p.priority]?.label || p.priority,
        getCompanyName(p.company_id),
        format(new Date(p.created_at), "dd/MM/yyyy"),
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
    a.href = url;
    a.download = "projetos-concluidos.csv";
    a.click();
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
    setProjectForm({ title: "", description: "", priority: "medium", due_date: "", client: "", labels: "" });
    setShowAddProject(false);
    fetchProjects();
    toast({ title: "Projeto criado!" });
  };

  const handleUpdateProject = async () => {
    if (!editingProject) return;
    await supabase.from("projects").update({
      title: projectForm.title, description: projectForm.description, priority: projectForm.priority,
      due_date: projectForm.due_date || null, client: projectForm.client || null,
      labels: projectForm.labels ? projectForm.labels.split(",").map(l => l.trim()).filter(Boolean) : [],
    }).eq("id", editingProject.id);
    setEditingProject(null);
    setProjectForm({ title: "", description: "", priority: "medium", due_date: "", client: "", labels: "" });
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

  const addColumn = () => {
    if (!newColumnTitle) return;
    const newCol: KanbanColumn = { id: newColumnTitle.toLowerCase().replace(/\s+/g, "_"), title: newColumnTitle, order_index: columns.length };
    setColumns([...columns, newCol]);
    setNewColumnTitle("");
    setShowColumnModal(false);
    toast({ title: "Coluna adicionada!" });
  };

  const deleteColumn = (columnId: string) => {
    setColumns(columns.filter(c => c.id !== columnId));
    toast({ title: "Coluna removida!" });
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
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-heading font-bold text-foreground">Gestão de Projetos</h1>
            <p className="text-sm md:text-base text-muted-foreground mt-1">Gerencie seus projetos com visão Kanban</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={openReport} className="border-border/50">
              <FileText className="h-4 w-4 mr-2" />Relatório
            </Button>
            <Button variant="outline" onClick={() => setShowColumnModal(true)} className="border-border/50">
              <Plus className="h-4 w-4 mr-2" />Coluna
            </Button>
            <Button onClick={() => setShowAddProject(true)}>
              <Plus className="h-4 w-4 mr-2" />Novo Projeto
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          {[
            { label: "Total", value: totalProjects, icon: FolderKanban, color: "text-primary", gradient: "from-primary/10 to-primary/5" },
            { label: "Em Progresso", value: inProgressProjects, icon: Clock, color: "text-amber-400", gradient: "from-amber-500/10 to-amber-500/5" },
            { label: "Concluídos", value: doneProjects, icon: CheckCircle, color: "text-emerald-400", gradient: "from-emerald-500/10 to-emerald-500/5" },
            { label: "Atrasados", value: overdueProjects, icon: AlertTriangle, color: "text-red-400", gradient: "from-red-500/10 to-red-500/5" },
          ].map((s, i) => (
            <motion.div key={s.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
              <div className="stat-card">
                <div className="flex items-center gap-3">
                  <div className={cn("p-2 rounded-lg bg-gradient-to-br", s.gradient)}>
                    <s.icon className={cn("h-4 w-4", s.color)} />
                  </div>
                  <div>
                    <p className="text-2xl font-bold font-mono">{s.value}</p>
                    <p className="text-xs text-muted-foreground">{s.label}</p>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="col-span-2 lg:col-span-1">
            <div className="stat-card">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 rounded-lg bg-gradient-to-br from-primary/10 to-primary/5">
                  <TrendingUp className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold font-mono">{completionRate}%</p>
                  <p className="text-xs text-muted-foreground">Conclusão</p>
                </div>
              </div>
              <Progress value={completionRate} className="h-1.5" />
            </div>
          </motion.div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-4 items-center">
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-muted-foreground" />
            <Select value={clientFilter} onValueChange={setClientFilter}>
              <SelectTrigger className="w-[180px] border-border/50">
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
        <Tabs value={view} onValueChange={(v) => setView(v as "kanban" | "timeline")}>
          <TabsList>
            <TabsTrigger value="kanban" className="gap-2"><LayoutGrid className="h-4 w-4" />Kanban</TabsTrigger>
            <TabsTrigger value="timeline" className="gap-2"><GanttChart className="h-4 w-4" />Timeline</TabsTrigger>
          </TabsList>

          <TabsContent value="kanban" className="mt-6">
            <DragDropContext onDragEnd={handleDragEnd}>
              <Droppable droppableId="columns" direction="horizontal" type="COLUMN">
                {(provided) => (
                  <div ref={provided.innerRef} {...provided.droppableProps} className="flex gap-4 overflow-x-auto pb-4 snap-x snap-mandatory">
                    {columns.map((column, columnIndex) => {
                      const colStyle = columnColors[column.id] || { header: "from-muted/30 to-transparent", accent: "text-muted-foreground" };
                      const colProjects = getProjectsByStatus(column.id);

                      return (
                        <Draggable key={column.id} draggableId={`column-${column.id}`} index={columnIndex}>
                          {(provided, snapshot) => (
                            <div ref={provided.innerRef} {...provided.draggableProps} className={cn("flex-shrink-0 w-[75vw] sm:w-80 snap-center", snapshot.isDragging && "opacity-75")}>
                              <Card className="bg-card/60 backdrop-blur-sm border-border/50 overflow-hidden">
                                <CardHeader {...provided.dragHandleProps} className={cn("py-3 px-4 flex flex-row items-center justify-between cursor-grab active:cursor-grabbing bg-gradient-to-r", colStyle.header)}>
                                  <div className="flex items-center gap-2">
                                    <div className={cn("h-2 w-2 rounded-full", column.id === "done" ? "bg-emerald-400" : column.id === "in_progress" ? "bg-amber-400" : "bg-blue-400")} />
                                    <CardTitle className="text-sm font-medium">{column.title}</CardTitle>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <Badge variant="secondary" className="text-xs font-mono bg-background/50">{colProjects.length}</Badge>
                                    {!defaultColumns.find(c => c.id === column.id) && (
                                      <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-destructive" onClick={() => deleteColumn(column.id)}>
                                        <Trash2 className="h-3 w-3" />
                                      </Button>
                                    )}
                                  </div>
                                </CardHeader>
                                <Droppable droppableId={column.id} type="CARD">
                                  {(provided, snapshot) => (
                                    <CardContent ref={provided.innerRef} {...provided.droppableProps} className={cn("p-2 space-y-2 min-h-[200px] transition-colors", snapshot.isDraggingOver && "bg-primary/5")}>
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
                                                    "bg-card border-l-[3px] border border-border/50 rounded-lg p-3 transition-shadow",
                                                    snapshot.isDragging ? "shadow-lg shadow-primary/10 border-primary/50" : "hover:border-border hover:bg-muted/20",
                                                    pConfig.border,
                                                    isOverdue && "ring-1 ring-red-500/20"
                                                  )}
                                                >
                                                  <div className="flex items-start justify-between gap-2">
                                                    <div className="flex items-start gap-2 flex-1">
                                                      <div {...provided.dragHandleProps} className="mt-1 cursor-grab active:cursor-grabbing text-muted-foreground/50 hover:text-foreground">
                                                        <GripVertical className="h-4 w-4" />
                                                      </div>
                                                      <div className="flex-1 min-w-0">
                                                        <h4 className="font-medium text-sm">{project.title}</h4>
                                                        {project.client && (
                                                          <p className="text-xs text-primary/80 mt-0.5 flex items-center gap-1">
                                                            <Building2 className="h-3 w-3" />{project.client}
                                                          </p>
                                                        )}
                                                      </div>
                                                    </div>
                                                    <div className="flex gap-0.5">
                                                      <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-foreground" onClick={() => {
                                                        setEditingProject(project);
                                                        setProjectForm({ title: project.title, description: project.description || "", priority: project.priority, due_date: project.due_date || "", client: project.client || "", labels: project.labels?.join(", ") || "" });
                                                      }}>
                                                        <Edit2 className="h-3 w-3" />
                                                      </Button>
                                                      <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-destructive" onClick={() => handleDeleteProject(project.id)}>
                                                        <Trash2 className="h-3 w-3" />
                                                      </Button>
                                                    </div>
                                                  </div>
                                                  {project.description && (
                                                    <p className="text-xs text-muted-foreground mt-1.5 ml-6 line-clamp-2">{project.description}</p>
                                                  )}
                                                  <div className="flex items-center gap-2 mt-3 ml-6 flex-wrap">
                                                    <Badge className={cn("text-[10px] border", pConfig.color)} variant="secondary">{pConfig.label}</Badge>
                                                    {project.labels?.map(label => (
                                                      <Badge key={label} variant="outline" className="text-[10px] border-border/50">{label}</Badge>
                                                    ))}
                                                    {project.due_date && (
                                                      <span className={cn("text-[10px] flex items-center gap-1", isOverdue ? "text-red-400" : "text-muted-foreground")}>
                                                        <Calendar className="h-2.5 w-2.5" />
                                                        {format(new Date(project.due_date), "dd MMM", { locale: ptBR })}
                                                      </span>
                                                    )}
                                                    {isOverdue && <Badge variant="destructive" className="text-[10px] px-1 py-0 animate-pulse">Atrasado</Badge>}
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

          <TabsContent value="timeline" className="mt-6">
            <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
              <CardContent className="p-6">
                <div className="space-y-3">
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
                            "flex items-center gap-4 p-4 border-l-[3px] border border-border/50 rounded-lg bg-card hover:bg-muted/20 transition-colors",
                            pConfig.border,
                            isOverdue && "ring-1 ring-red-500/20"
                          )}
                        >
                          <div className="flex-shrink-0 w-20 text-center">
                            <p className="text-sm font-bold font-mono">{format(new Date(project.due_date!), "dd MMM", { locale: ptBR })}</p>
                            <p className="text-[10px] text-muted-foreground font-mono">{format(new Date(project.due_date!), "yyyy")}</p>
                          </div>
                          <div className="w-px h-10 bg-border/50" />
                          <div className="flex-1 min-w-0">
                            <h4 className="font-medium text-sm">{project.title}</h4>
                            {project.client && (
                              <p className="text-xs text-primary/80 flex items-center gap-1 mt-0.5"><Building2 className="h-3 w-3" />{project.client}</p>
                            )}
                            {project.description && <p className="text-xs text-muted-foreground truncate mt-0.5">{project.description}</p>}
                          </div>
                          <div className="flex items-center gap-2 flex-wrap shrink-0">
                            <Badge variant="secondary" className={cn("text-[10px]", project.status === "done" ? "bg-emerald-500/10 text-emerald-400" : project.status === "in_progress" ? "bg-amber-500/10 text-amber-400" : "bg-blue-500/10 text-blue-400")}>
                              {project.status === "done" ? "Concluído" : project.status === "in_progress" ? "Em Progresso" : "A Fazer"}
                            </Badge>
                            {isOverdue && <Badge variant="destructive" className="text-[10px] px-1 py-0">Atrasado</Badge>}
                          </div>
                        </motion.div>
                      );
                    })}
                  {projects.filter(p => p.due_date).filter(p => clientFilter === "all" || p.client === clientFilter).length === 0 && (
                    <div className="text-center py-12">
                      <div className="p-4 rounded-full bg-muted/50 w-fit mx-auto mb-4">
                        <Calendar className="h-8 w-8 text-muted-foreground/50" />
                      </div>
                      <p className="text-muted-foreground">Nenhum projeto com data de entrega definida.</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Add/Edit Project Dialog */}
        <Dialog open={showAddProject || !!editingProject} onOpenChange={(open) => {
          if (!open) { setShowAddProject(false); setEditingProject(null); setProjectForm({ title: "", description: "", priority: "medium", due_date: "", client: "", labels: "" }); }
        }}>
          <DialogContent>
            <DialogHeader><DialogTitle>{editingProject ? "Editar Projeto" : "Novo Projeto"}</DialogTitle></DialogHeader>
            <div className="space-y-4 py-4">
              <div><Label>Título</Label><Input value={projectForm.title} onChange={(e) => setProjectForm({ ...projectForm, title: e.target.value })} placeholder="Nome do projeto" /></div>
              <div><Label>Descrição</Label><Textarea value={projectForm.description} onChange={(e) => setProjectForm({ ...projectForm, description: e.target.value })} placeholder="Descrição do projeto" /></div>
              <div><Label>Cliente / Empresa</Label><Input value={projectForm.client} onChange={(e) => setProjectForm({ ...projectForm, client: e.target.value })} placeholder="Nome do cliente ou empresa" /></div>
              <div><Label>Labels</Label><Input value={projectForm.labels} onChange={(e) => setProjectForm({ ...projectForm, labels: e.target.value })} placeholder="Ex: frontend, urgente, redesign (separados por vírgula)" /></div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label>Prioridade</Label>
                  <Select value={projectForm.priority} onValueChange={(v) => setProjectForm({ ...projectForm, priority: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Baixa</SelectItem>
                      <SelectItem value="medium">Média</SelectItem>
                      <SelectItem value="high">Alta</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>Data de Entrega</Label><Input type="date" value={projectForm.due_date} onChange={(e) => setProjectForm({ ...projectForm, due_date: e.target.value })} /></div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => { setShowAddProject(false); setEditingProject(null); }}>Cancelar</Button>
              <Button onClick={editingProject ? handleUpdateProject : handleAddProject}>{editingProject ? "Salvar" : "Criar"}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Execution Record Modal */}
        <Dialog open={showExecutionModal} onOpenChange={setShowExecutionModal}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2"><CheckCircle className="h-5 w-5 text-primary" />Registro de Execução</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <p className="text-sm text-muted-foreground">Complete o registro para arquivar este projeto na Knowledge Base.</p>
              <div><Label>Ação Realizada *</Label><Textarea value={executionForm.action_taken} onChange={(e) => setExecutionForm({ ...executionForm, action_taken: e.target.value })} placeholder="O que foi feito para concluir este projeto?" /></div>
              <div><Label>Resultado Obtido *</Label><Textarea value={executionForm.result_obtained} onChange={(e) => setExecutionForm({ ...executionForm, result_obtained: e.target.value })} placeholder="Quais métricas ou resultados foram alcançados?" /></div>
              <div><Label>Lições Aprendidas *</Label><Textarea value={executionForm.lessons_learned} onChange={(e) => setExecutionForm({ ...executionForm, lessons_learned: e.target.value })} placeholder="O que você aprendeu com este projeto?" /></div>
              <div>
                <Label>Tags</Label>
                <div className="flex gap-2">
                  <Input value={tagInput} onChange={(e) => setTagInput(e.target.value)} placeholder="Adicionar tag" onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTag(); } }} />
                  <Button type="button" variant="outline" onClick={addTag}><Plus className="h-4 w-4" /></Button>
                </div>
                {executionForm.tags.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {executionForm.tags.map((tag) => (
                      <Badge key={tag} variant="secondary" className="gap-1">{tag}<button onClick={() => removeTag(tag)}><X className="h-3 w-3" /></button></Badge>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowExecutionModal(false)}>Cancelar</Button>
              <Button onClick={handleCompleteWithExecution}>Concluir e Registrar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Add Column Modal */}
        <Dialog open={showColumnModal} onOpenChange={setShowColumnModal}>
          <DialogContent>
            <DialogHeader><DialogTitle>Nova Coluna</DialogTitle></DialogHeader>
            <div className="py-4"><Label>Nome da Coluna</Label><Input value={newColumnTitle} onChange={(e) => setNewColumnTitle(e.target.value)} placeholder="Ex: Em Revisão" /></div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowColumnModal(false)}>Cancelar</Button>
              <Button onClick={addColumn}>Criar Coluna</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        {/* Projects Report Dialog */}
        <Dialog open={reportOpen} onOpenChange={setReportOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2"><FileText className="h-5 w-5 text-primary" />Relatório de Projetos Concluídos</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div><Label>Data Início</Label><Input type="date" value={reportFrom} onChange={e => setReportFrom(e.target.value)} /></div>
                <div><Label>Data Fim</Label><Input type="date" value={reportTo} onChange={e => setReportTo(e.target.value)} /></div>
              </div>
              <div>
                <Label>Empresa</Label>
                <Select value={reportCompanyId} onValueChange={setReportCompanyId}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="current">Empresa Atual</SelectItem>
                    <SelectItem value="all">Todas</SelectItem>
                    {companies.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="p-3 rounded-lg bg-muted/50 border border-border/50">
                <p className="text-sm text-muted-foreground">{reportProjects.length} projeto(s) encontrado(s)</p>
              </div>
              {reportProjects.length > 0 && (
                <div className="max-h-48 overflow-y-auto space-y-1">
                  {reportProjects.map(p => (
                    <div key={p.id} className="flex items-center justify-between text-sm p-2 rounded bg-card border border-border/30">
                      <span className="truncate flex-1">{p.title}</span>
                      <span className="text-xs text-muted-foreground ml-2">{p.client || "—"}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setReportOpen(false)}>Fechar</Button>
              <Button variant="outline" onClick={generateProjectsCSV} disabled={reportProjects.length === 0}>
                <Download className="h-4 w-4 mr-2" />CSV
              </Button>
              <Button onClick={generateProjectsPDF} disabled={reportProjects.length === 0}>
                <Download className="h-4 w-4 mr-2" />PDF
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </motion.div>
    </EMSLayout>
  );
};

export default Projects;
