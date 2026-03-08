import { useState } from "react";
import { useCompany } from "@/contexts/CompanyContext";
import { EMSLayout } from "@/components/ems/EMSLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus, Trash2, Calendar, Flag, Users, Phone, Mail, Building2,
  Search, Edit2, CheckCircle2, Clock, AlertTriangle, ListTodo, MessageSquare, Sparkles, ExternalLink
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface Contact {
  id: string; name: string; email: string | null; phone: string | null;
  company: string | null; notes: string | null; pipeline_stage: string | null;
  project_id: string | null; created_at: string; project?: { title: string } | null;
}
interface Interaction { id: string; contact_id: string; type: string; description: string; date: string; created_at: string; }
interface Task {
  id: string; title: string; description: string | null; priority: string; status: string;
  due_date: string | null; completed_at: string | null; contact_id: string | null;
  project_id: string | null; created_at: string; contact?: { name: string } | null; project?: { title: string } | null;
}
interface Project { id: string; title: string; }

const pipelineStages = [
  { key: "lead", label: "Lead", color: "bg-blue-500/15 text-blue-400 border-blue-500/30", dot: "bg-blue-500" },
  { key: "qualified", label: "Qualificado", color: "bg-amber-500/15 text-amber-400 border-amber-500/30", dot: "bg-amber-500" },
  { key: "proposal", label: "Proposta", color: "bg-purple-500/15 text-purple-400 border-purple-500/30", dot: "bg-purple-500" },
  { key: "closed", label: "Fechado", color: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30", dot: "bg-emerald-500" },
];

const interactionTypes = [
  { key: "call", label: "Ligação", icon: "📞" },
  { key: "meeting", label: "Reunião", icon: "🤝" },
  { key: "email", label: "Email", icon: "📧" },
  { key: "proposal", label: "Proposta", icon: "📄" },
  { key: "note", label: "Nota", icon: "📝" },
];

const priorityConfig: Record<string, { label: string; color: string; border: string; icon: typeof Flag }> = {
  urgent: { label: "Urgente", color: "bg-red-500/15 text-red-400 border-red-500/30", border: "border-l-red-500", icon: AlertTriangle },
  high: { label: "Alta", color: "bg-orange-500/15 text-orange-400 border-orange-500/30", border: "border-l-orange-500", icon: Flag },
  medium: { label: "Média", color: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30", border: "border-l-yellow-500", icon: Flag },
  low: { label: "Baixa", color: "bg-blue-500/15 text-blue-400 border-blue-500/30", border: "border-l-blue-500", icon: Flag },
};

const kanbanStatuses = [
  { key: "pending", label: "Pendentes", icon: Clock, gradient: "from-yellow-500/20 to-yellow-600/5", border: "border-yellow-500/40" },
  { key: "in_progress", label: "Em Andamento", icon: ListTodo, gradient: "from-blue-500/20 to-blue-600/5", border: "border-blue-500/40" },
  { key: "completed", label: "Concluídas", icon: CheckCircle2, gradient: "from-emerald-500/20 to-emerald-600/5", border: "border-emerald-500/40" },
];

const Contacts = () => {
  const queryClient = useQueryClient();
  const { selectedCompanyId } = useCompany();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("contacts");
  const [contactDialogOpen, setContactDialogOpen] = useState(false);
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [projectFilter, setProjectFilter] = useState<string>("all");
  const [viewMode, setViewMode] = useState<"list" | "kanban">("list");
  const [contactForm, setContactForm] = useState({ name: "", email: "", phone: "", company: "", notes: "", project_id: "", pipeline_stage: "lead" });
  const [taskForm, setTaskForm] = useState({ title: "", description: "", priority: "medium", due_date: null as Date | null, contact_id: "", project_id: "" });
  const [interactionDialogOpen, setInteractionDialogOpen] = useState(false);
  const [interactionContactId, setInteractionContactId] = useState<string | null>(null);
  const [interactionForm, setInteractionForm] = useState({ type: "note", description: "" });
  const [expandedContact, setExpandedContact] = useState<string | null>(null);

  const { data: projects = [] } = useQuery({ queryKey: ["projects", selectedCompanyId], queryFn: async () => { let q = supabase.from("projects").select("id, title").order("title"); if (selectedCompanyId !== "all") q = q.eq("company_id", selectedCompanyId); const { data, error } = await q; if (error) throw error; return data as Project[]; } });
  const { data: contacts = [], isLoading: contactsLoading } = useQuery({ queryKey: ["contacts", selectedCompanyId], queryFn: async () => { let q = supabase.from("contacts").select("*, project:projects(title)").order("name"); if (selectedCompanyId !== "all") q = q.eq("company_id", selectedCompanyId); const { data, error } = await q; if (error) throw error; return data as Contact[]; } });
  const { data: tasks = [], isLoading: tasksLoading } = useQuery({ queryKey: ["contact-tasks", selectedCompanyId], queryFn: async () => { let q = supabase.from("tasks").select("*, contact:contacts(name), project:projects(title)").not("contact_id", "is", null).order("created_at", { ascending: false }); if (selectedCompanyId !== "all") q = q.eq("company_id", selectedCompanyId); const { data, error } = await q; if (error) throw error; return data as Task[]; } });
  const { data: interactions = [] } = useQuery({ queryKey: ["contact-interactions"], queryFn: async () => { const { data, error } = await supabase.from("contact_interactions").select("*").order("date", { ascending: false }); if (error) throw error; return data as Interaction[]; } });

  const getContactInteractions = (contactId: string) => interactions.filter((i) => i.contact_id === contactId);

  const saveInteractionMutation = useMutation({
    mutationFn: async () => { if (!interactionContactId) return; const { error } = await supabase.from("contact_interactions").insert({ contact_id: interactionContactId, type: interactionForm.type, description: interactionForm.description }); if (error) throw error; },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["contact-interactions"] }); setInteractionDialogOpen(false); setInteractionForm({ type: "note", description: "" }); toast({ title: "Interação registrada!" }); },
    onError: (error: any) => { toast({ title: "Erro ao registrar interação", description: error?.message, variant: "destructive" }); },
  });
  const updatePipelineMutation = useMutation({
    mutationFn: async ({ id, stage }: { id: string; stage: string }) => { const { error } = await supabase.from("contacts").update({ pipeline_stage: stage }).eq("id", id); if (error) throw error; },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["contacts"] }),
  });
  const saveContactMutation = useMutation({
    mutationFn: async () => {
      const payload = { name: contactForm.name, email: contactForm.email || null, phone: contactForm.phone || null, company: contactForm.company || null, notes: contactForm.notes || null, project_id: contactForm.project_id || null, pipeline_stage: contactForm.pipeline_stage || "lead", company_id: selectedCompanyId !== "all" ? selectedCompanyId : null };
      if (editingContact) { const { error } = await supabase.from("contacts").update(payload).eq("id", editingContact.id); if (error) throw error; }
      else { const { error } = await supabase.from("contacts").insert(payload); if (error) throw error; }
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["contacts"] }); setContactDialogOpen(false); resetContactForm(); toast({ title: editingContact ? "Contato atualizado!" : "Contato criado!" }); },
    onError: (error: any) => { toast({ title: "Erro ao salvar contato", description: error?.message, variant: "destructive" }); },
  });
  const deleteContactMutation = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("contacts").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["contacts"] }); queryClient.invalidateQueries({ queryKey: ["contact-tasks"] }); toast({ title: "Contato removido" }); },
    onError: (error: any) => { toast({ title: "Erro ao remover contato", description: error?.message, variant: "destructive" }); },
  });
  const saveTaskMutation = useMutation({
    mutationFn: async () => {
      const payload = { title: taskForm.title, description: taskForm.description || null, priority: taskForm.priority, due_date: taskForm.due_date ? format(taskForm.due_date, "yyyy-MM-dd") : format(new Date(), "yyyy-MM-dd"), contact_id: taskForm.contact_id || null, project_id: taskForm.project_id || null, company_id: selectedCompanyId !== "all" ? selectedCompanyId : null };
      if (editingTask) { const { error } = await supabase.from("tasks").update(payload).eq("id", editingTask.id); if (error) throw error; }
      else { const { error } = await supabase.from("tasks").insert(payload); if (error) throw error; }
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["contact-tasks"] }); queryClient.invalidateQueries({ queryKey: ["tasks"] }); setTaskDialogOpen(false); resetTaskForm(); toast({ title: editingTask ? "Tarefa atualizada!" : "Tarefa criada!" }); },
    onError: (error: any) => { toast({ title: "Erro ao salvar tarefa", description: error?.message, variant: "destructive" }); },
  });
  const toggleTaskMutation = useMutation({
    mutationFn: async ({ id, completed }: { id: string; completed: boolean }) => { const { error } = await supabase.from("tasks").update({ status: completed ? "completed" : "pending", completed_at: completed ? new Date().toISOString() : null }).eq("id", id); if (error) throw error; },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["contact-tasks"] }),
  });
  const deleteTaskMutation = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("tasks").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["contact-tasks"] }); queryClient.invalidateQueries({ queryKey: ["tasks"] }); toast({ title: "Tarefa removida" }); },
    onError: (error: any) => { toast({ title: "Erro ao remover tarefa", description: error?.message, variant: "destructive" }); },
  });
  const updateTaskStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => { const { error } = await supabase.from("tasks").update({ status, completed_at: status === "completed" ? new Date().toISOString() : null }).eq("id", id); if (error) throw error; },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["contact-tasks"] }),
  });

  const resetContactForm = () => { setContactForm({ name: "", email: "", phone: "", company: "", notes: "", project_id: "", pipeline_stage: "lead" }); setEditingContact(null); };
  const resetTaskForm = () => { setTaskForm({ title: "", description: "", priority: "medium", due_date: null, contact_id: "", project_id: "" }); setEditingTask(null); };
  const openEditContact = (contact: Contact) => { setEditingContact(contact); setContactForm({ name: contact.name, email: contact.email || "", phone: contact.phone || "", company: contact.company || "", notes: contact.notes || "", project_id: contact.project_id || "", pipeline_stage: contact.pipeline_stage || "lead" }); setContactDialogOpen(true); };
  const openEditTask = (task: Task) => { setEditingTask(task); setTaskForm({ title: task.title, description: task.description || "", priority: task.priority, due_date: task.due_date ? new Date(task.due_date + "T00:00:00") : null, contact_id: task.contact_id || "", project_id: task.project_id || "" }); setTaskDialogOpen(true); };

  const filteredContacts = contacts.filter((c) => {
    const matchesSearch = !searchQuery || c.name.toLowerCase().includes(searchQuery.toLowerCase()) || c.company?.toLowerCase().includes(searchQuery.toLowerCase()) || c.email?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesProject = projectFilter === "all" || c.project_id === projectFilter;
    return matchesSearch && matchesProject;
  });
  const filteredTasks = tasks.filter((t) => {
    const matchesSearch = !searchQuery || t.title.toLowerCase().includes(searchQuery.toLowerCase()) || t.contact?.name?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesProject = projectFilter === "all" || t.project_id === projectFilter;
    return matchesSearch && matchesProject;
  });
  const getTasksByStatus = (status: string) => filteredTasks.filter((t) => {
    if (status === "in_progress") return t.status === "in_progress";
    if (status === "completed") return t.status === "completed";
    return t.status === "pending" || (t.status !== "completed" && t.status !== "in_progress");
  });

  // Pipeline stats
  const pipelineStats = pipelineStages.map(s => ({ ...s, count: contacts.filter(c => (c.pipeline_stage || "lead") === s.key).length }));
  const completedPercent = tasks.length > 0 ? Math.round((tasks.filter(t => t.status === "completed").length / tasks.length) * 100) : 0;

  const renderTaskCard = (task: Task, compact = false) => {
    const pConfig = priorityConfig[task.priority] || priorityConfig.medium;
    const PIcon = pConfig.icon;
    return (
      <motion.div key={task.id} layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: -100 }}
        className={cn("flex items-center gap-2 sm:gap-3 p-3 rounded-xl border-l-[3px] transition-all duration-300", pConfig.border,
          task.status === "completed" ? "opacity-50 bg-muted/20 border border-border/50" : "bg-card/80 border border-border/50 hover:bg-muted/40 hover:shadow-md hover:shadow-primary/5"
        )}>
        <Checkbox checked={task.status === "completed"} onCheckedChange={(checked) => toggleTaskMutation.mutate({ id: task.id, completed: !!checked })} className="shrink-0" />
        <div className="flex-1 min-w-0">
          <p className={cn("font-medium truncate text-sm", task.status === "completed" && "line-through text-muted-foreground")}>{task.title}</p>
          <div className="flex items-center gap-2 flex-wrap mt-0.5">
            {task.contact && <span className="text-xs text-muted-foreground truncate flex items-center gap-1"><Users className="h-3 w-3 shrink-0" />{task.contact.name}</span>}
            {!compact && task.project && <span className="text-xs text-muted-foreground truncate flex items-center gap-1"><Building2 className="h-3 w-3 shrink-0" />{task.project.title}</span>}
            {task.due_date && <span className="text-xs text-muted-foreground shrink-0 sm:hidden">{format(new Date(task.due_date + "T00:00:00"), "dd/MM", { locale: ptBR })}</span>}
          </div>
        </div>
        <Badge variant="outline" className={cn("text-[10px] sm:text-xs shrink-0 hidden sm:flex", pConfig.color)}><PIcon className="h-3 w-3 mr-1" />{pConfig.label}</Badge>
        {task.due_date && <span className="text-xs text-muted-foreground shrink-0 hidden sm:block"><Calendar className="h-3 w-3 inline mr-1" />{format(new Date(task.due_date + "T00:00:00"), "dd/MM", { locale: ptBR })}</span>}
        <div className="flex shrink-0">
          <Button variant="ghost" size="icon" className="h-7 w-7 sm:h-8 sm:w-8 hover:bg-primary/10 hover:text-primary" onClick={() => openEditTask(task)}><Edit2 className="h-3.5 w-3.5" /></Button>
          <Button variant="ghost" size="icon" className="h-7 w-7 sm:h-8 sm:w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10" onClick={() => deleteTaskMutation.mutate(task.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
        </div>
      </motion.div>
    );
  };

  return (
    <EMSLayout>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-heading font-bold text-foreground flex items-center gap-2">
              <div className="p-2 rounded-xl bg-primary/10"><Users className="h-6 w-6 text-primary" /></div>
              Contatos
            </h1>
            <p className="text-sm text-muted-foreground mt-1">Gerencie contatos, pipeline e tarefas vinculadas</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => { resetContactForm(); setContactDialogOpen(true); }} className="gap-2 rounded-xl border-primary/30 hover:border-primary/60 hover:bg-primary/5">
              <Plus className="h-4 w-4" /> Contato
            </Button>
            <Button onClick={() => { resetTaskForm(); setTaskDialogOpen(true); }} className="gap-2 rounded-xl shadow-lg shadow-primary/20 hover:shadow-primary/40">
              <Plus className="h-4 w-4" /> Tarefa
            </Button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Buscar contatos ou tarefas..." className="pl-10 rounded-xl bg-card/50 border-border/50 focus:border-primary/50" />
          </div>
          <Select value={projectFilter} onValueChange={setProjectFilter}>
            <SelectTrigger className="w-full sm:w-[200px] rounded-xl bg-card/50 border-border/50"><SelectValue placeholder="Projeto" /></SelectTrigger>
            <SelectContent><SelectItem value="all">Todos os Projetos</SelectItem>{projects.map((p) => <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>)}</SelectContent>
          </Select>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
          {pipelineStats.map((s, i) => (
            <motion.div key={s.key} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
              <Card className={cn("border transition-all duration-300 hover:scale-[1.03] cursor-default", s.color.replace("text-", "border-").split(" ")[2])}>
                <CardContent className="p-3 flex items-center gap-2.5">
                  <div className={cn("w-2.5 h-2.5 rounded-full", s.dot)} />
                  <div>
                    <p className="text-xl font-bold font-mono">{s.count}</p>
                    <p className="text-[10px] text-muted-foreground">{s.label}</p>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
          <Card className="border border-primary/20 col-span-2 lg:col-span-1">
            <CardContent className="p-3">
              <div className="flex items-center justify-between mb-1">
                <p className="text-[10px] text-muted-foreground">Tarefas</p>
                <span className="text-xs font-mono font-bold text-primary">{completedPercent}%</span>
              </div>
              <Progress value={completedPercent} className="h-2" />
              <p className="text-[10px] text-muted-foreground mt-1">{tasks.filter(t => t.status === "completed").length}/{tasks.length} concluídas</p>
            </CardContent>
          </Card>
          <Card className="border border-border/50">
            <CardContent className="p-3 flex items-center gap-2.5">
              <div className="p-1.5 rounded-lg bg-primary/10"><Users className="h-4 w-4 text-primary" /></div>
              <div>
                <p className="text-xl font-bold font-mono">{contacts.length}</p>
                <p className="text-[10px] text-muted-foreground">Total</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <TabsList className="w-full sm:w-auto bg-card/80 border border-border/50 rounded-xl p-1">
              <TabsTrigger value="contacts" className="gap-1.5 rounded-lg data-[state=active]:bg-primary/15 data-[state=active]:text-primary"><Users className="h-3.5 w-3.5" /> Contatos</TabsTrigger>
              <TabsTrigger value="tasks" className="gap-1.5 rounded-lg data-[state=active]:bg-primary/15 data-[state=active]:text-primary"><ListTodo className="h-3.5 w-3.5" /> Tarefas</TabsTrigger>
            </TabsList>
            {activeTab === "tasks" && (
              <div className="flex gap-1 bg-card/80 border border-border/50 p-1 rounded-xl self-end sm:self-auto">
                <Button variant={viewMode === "list" ? "default" : "ghost"} size="sm" className="rounded-lg text-xs h-8" onClick={() => setViewMode("list")}>Lista</Button>
                <Button variant={viewMode === "kanban" ? "default" : "ghost"} size="sm" className="rounded-lg text-xs h-8" onClick={() => setViewMode("kanban")}>Kanban</Button>
              </div>
            )}
          </div>

          {/* Contacts Tab */}
          <TabsContent value="contacts">
            <div className="space-y-3">
              {contactsLoading ? (
                <div className="space-y-3">{[...Array(3)].map((_, i) => <div key={i} className="h-24 rounded-xl bg-muted/30 animate-pulse" />)}</div>
              ) : filteredContacts.length === 0 ? (
                <Card className="border-dashed border-primary/20">
                  <CardContent className="py-16 text-center">
                    <div className="inline-flex p-4 rounded-2xl bg-gradient-to-br from-primary/10 to-primary/5 mb-4">
                      <Sparkles className="h-10 w-10 text-primary/60" />
                    </div>
                    <p className="text-muted-foreground text-lg font-medium">Nenhum contato encontrado</p>
                    <p className="text-muted-foreground/60 text-sm mt-1 mb-4">Comece adicionando seu primeiro contato</p>
                    <Button className="rounded-xl shadow-lg shadow-primary/20" onClick={() => { resetContactForm(); setContactDialogOpen(true); }}>
                      <Plus className="h-4 w-4 mr-2" /> Criar primeiro contato
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                <AnimatePresence>
                  {filteredContacts.map((contact, i) => {
                    const contactTasks = tasks.filter((t) => t.contact_id === contact.id);
                    const pendingTasks = contactTasks.filter((t) => t.status !== "completed").length;
                    const stage = pipelineStages.find((s) => s.key === (contact.pipeline_stage || "lead"));
                    return (
                      <motion.div key={contact.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ delay: i * 0.03 }}>
                        <Card className="border border-border/50 hover:border-primary/30 transition-all duration-300 hover:shadow-lg hover:shadow-primary/5 bg-card/80">
                          <CardContent className="p-4 sm:p-5">
                            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-2 flex-wrap">
                                  <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold", stage ? stage.color : "bg-muted")}>{contact.name.charAt(0).toUpperCase()}</div>
                                  <h3 className="font-semibold text-foreground">{contact.name}</h3>
                                  {stage && <Badge variant="outline" className={cn("text-[10px]", stage.color)}><div className={cn("w-1.5 h-1.5 rounded-full mr-1", stage.dot)} />{stage.label}</Badge>}
                                  {contact.project?.title && <Badge variant="outline" className="text-[10px] border-border/50 max-w-[120px] truncate">{contact.project.title}</Badge>}
                                  {pendingTasks > 0 && <Badge className="text-[10px] bg-amber-500/15 text-amber-400 border border-amber-500/30 hover:bg-amber-500/25">{pendingTasks} pendente{pendingTasks > 1 ? "s" : ""}</Badge>}
                                </div>
                                <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                                  {contact.email && <span className="flex items-center gap-1 truncate max-w-[180px]"><Mail className="h-3 w-3 shrink-0 text-primary/60" />{contact.email}</span>}
                                  {contact.phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3 shrink-0 text-primary/60" />{contact.phone}</span>}
                                  {contact.company && <span className="flex items-center gap-1 truncate max-w-[140px]"><Building2 className="h-3 w-3 shrink-0 text-primary/60" />{contact.company}</span>}
                                </div>
                                {contact.notes && <p className="text-xs text-muted-foreground/70 mt-1.5 truncate italic">{contact.notes}</p>}
                              </div>
                              <div className="flex gap-0.5 shrink-0">
                                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg hover:bg-primary/10 hover:text-primary" onClick={() => { setInteractionContactId(contact.id); setInteractionDialogOpen(true); }} title="Registrar interação"><MessageSquare className="h-4 w-4" /></Button>
                                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg hover:bg-blue-500/10 hover:text-blue-400" onClick={() => setExpandedContact(expandedContact === contact.id ? null : contact.id)} title="Histórico"><Clock className="h-4 w-4" /></Button>
                                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg hover:bg-muted" onClick={() => openEditContact(contact)}><Edit2 className="h-4 w-4" /></Button>
                                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10" onClick={() => deleteContactMutation.mutate(contact.id)}><Trash2 className="h-4 w-4" /></Button>
                              </div>
                            </div>

                            {/* Interaction History */}
                            <AnimatePresence>
                              {expandedContact === contact.id && (() => {
                                const cInteractions = getContactInteractions(contact.id);
                                return (
                                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="mt-3 pt-3 border-t border-border/50">
                                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-2">
                                      <p className="text-xs font-medium text-muted-foreground">Pipeline</p>
                                      <div className="flex gap-1 overflow-x-auto pb-1 sm:pb-0 -mx-1 px-1">
                                        {pipelineStages.map((s) => (
                                          <Badge key={s.key} variant={contact.pipeline_stage === s.key ? "default" : "outline"}
                                            className={cn("text-[10px] cursor-pointer whitespace-nowrap shrink-0 transition-all", contact.pipeline_stage === s.key ? "shadow-md" : s.color + " hover:scale-105")}
                                            onClick={() => updatePipelineMutation.mutate({ id: contact.id, stage: s.key })}>
                                            {s.label}
                                          </Badge>
                                        ))}
                                      </div>
                                    </div>
                                    {cInteractions.length === 0 ? (
                                      <p className="text-xs text-muted-foreground py-2 italic">Nenhuma interação registrada</p>
                                    ) : (
                                      <div className="space-y-1.5 max-h-40 overflow-y-auto">
                                        {cInteractions.slice(0, 5).map((interaction) => (
                                          <div key={interaction.id} className="flex items-start gap-2 text-xs bg-muted/30 rounded-lg p-2 border border-border/30">
                                            <span className="shrink-0">{interactionTypes.find((t) => t.key === interaction.type)?.icon || "📝"}</span>
                                            <span className="text-muted-foreground flex-1">{interaction.description}</span>
                                            <span className="text-[10px] text-muted-foreground/60 shrink-0 font-mono">{format(new Date(interaction.date), "dd/MM", { locale: ptBR })}</span>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </motion.div>
                                );
                              })()}
                            </AnimatePresence>

                            {/* Inline tasks */}
                            {contactTasks.length > 0 && (
                              <div className="mt-3 pt-3 border-t border-border/50 space-y-1.5">
                                {contactTasks.slice(0, 3).map((task) => renderTaskCard(task, true))}
                                {contactTasks.length > 3 && <p className="text-xs text-muted-foreground text-center pt-1">+{contactTasks.length - 3} tarefa(s)</p>}
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              )}
            </div>
          </TabsContent>

          {/* Tasks Tab */}
          <TabsContent value="tasks">
            {viewMode === "list" ? (
              <Card className="border border-border/50 bg-card/80">
                <CardHeader><CardTitle className="text-lg flex items-center gap-2"><ListTodo className="h-5 w-5 text-primary" />Tarefas de Contatos</CardTitle></CardHeader>
                <CardContent>
                  {tasksLoading ? (
                    <div className="space-y-3">{[...Array(3)].map((_, i) => <div key={i} className="h-16 rounded-xl bg-muted/30 animate-pulse" />)}</div>
                  ) : filteredTasks.length === 0 ? (
                    <div className="text-center py-16">
                      <div className="inline-flex p-4 rounded-2xl bg-gradient-to-br from-blue-500/10 to-blue-500/5 mb-4"><ListTodo className="h-10 w-10 text-blue-400/60" /></div>
                      <p className="text-muted-foreground text-lg font-medium">Nenhuma tarefa encontrada</p>
                      <Button className="rounded-xl shadow-lg shadow-primary/20 mt-4" onClick={() => { resetTaskForm(); setTaskDialogOpen(true); }}><Plus className="h-4 w-4 mr-2" /> Criar tarefa</Button>
                    </div>
                  ) : (
                    <div className="space-y-2"><AnimatePresence>{filteredTasks.map((task) => renderTaskCard(task))}</AnimatePresence></div>
                  )}
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {kanbanStatuses.map((col) => {
                  const colTasks = getTasksByStatus(col.key);
                  const ColIcon = col.icon;
                  return (
                    <Card key={col.key} className={cn("border", col.border, "overflow-hidden")}>
                      <CardHeader className={cn("pb-3 bg-gradient-to-b", col.gradient)}>
                        <CardTitle className="text-sm flex items-center gap-2">
                          <ColIcon className="h-4 w-4" />{col.label}
                          <Badge variant="secondary" className="ml-auto font-mono">{colTasks.length}</Badge>
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2 min-h-[200px] pt-3">
                        <AnimatePresence>
                          {colTasks.map((task) => {
                            const pConfig = priorityConfig[task.priority] || priorityConfig.medium;
                            return (
                              <motion.div key={task.id} layout initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
                                className={cn("p-3 rounded-xl border-l-[3px] border border-border/50 bg-card/80 hover:bg-muted/40 transition-all duration-300 hover:shadow-md", pConfig.border)}>
                                <div className="flex items-start justify-between gap-2 mb-2">
                                  <p className="font-medium text-sm">{task.title}</p>
                                  <Badge variant="outline" className={cn("text-[10px] shrink-0", pConfig.color)}>{pConfig.label}</Badge>
                                </div>
                                {task.contact && <p className="text-xs text-muted-foreground flex items-center gap-1 mb-1"><Users className="h-3 w-3" />{task.contact.name}</p>}
                                {task.project && <p className="text-xs text-muted-foreground flex items-center gap-1 mb-2"><Building2 className="h-3 w-3" />{task.project.title}</p>}
                                <div className="flex items-center justify-between flex-wrap gap-1">
                                  {task.due_date && <span className="text-xs text-muted-foreground font-mono"><Calendar className="h-3 w-3 inline mr-1" />{format(new Date(task.due_date + "T00:00:00"), "dd/MM", { locale: ptBR })}</span>}
                                  <div className="flex gap-0.5 ml-auto flex-wrap">
                                    {col.key !== "pending" && <Button variant="ghost" size="icon" className="h-7 w-7 hover:bg-yellow-500/10 hover:text-yellow-400" onClick={() => updateTaskStatusMutation.mutate({ id: task.id, status: "pending" })}><Clock className="h-3 w-3" /></Button>}
                                    {col.key !== "in_progress" && <Button variant="ghost" size="icon" className="h-7 w-7 hover:bg-blue-500/10 hover:text-blue-400" onClick={() => updateTaskStatusMutation.mutate({ id: task.id, status: "in_progress" })}><ListTodo className="h-3 w-3" /></Button>}
                                    {col.key !== "completed" && <Button variant="ghost" size="icon" className="h-7 w-7 hover:bg-emerald-500/10 hover:text-emerald-400" onClick={() => updateTaskStatusMutation.mutate({ id: task.id, status: "completed" })}><CheckCircle2 className="h-3 w-3" /></Button>}
                                    <Button variant="ghost" size="icon" className="h-7 w-7 hover:bg-primary/10 hover:text-primary" onClick={() => openEditTask(task)}><Edit2 className="h-3 w-3" /></Button>
                                    <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10" onClick={() => deleteTaskMutation.mutate(task.id)}><Trash2 className="h-3 w-3" /></Button>
                                  </div>
                                </div>
                              </motion.div>
                            );
                          })}
                        </AnimatePresence>
                        {colTasks.length === 0 && <p className="text-xs text-muted-foreground text-center py-8 italic">Nenhuma tarefa</p>}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </motion.div>

      {/* Contact Dialog */}
      <Dialog open={contactDialogOpen} onOpenChange={(open) => { setContactDialogOpen(open); if (!open) resetContactForm(); }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader><DialogTitle>{editingContact ? "Editar Contato" : "Novo Contato"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><label className="text-sm font-medium">Nome *</label><Input value={contactForm.name} onChange={(e) => setContactForm({ ...contactForm, name: e.target.value })} placeholder="Nome do contato" className="mt-1 rounded-xl" /></div>
            <div className="grid grid-cols-2 gap-4">
              <div><label className="text-sm font-medium">Email</label><Input value={contactForm.email} onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })} placeholder="email@exemplo.com" className="mt-1 rounded-xl" /></div>
              <div><label className="text-sm font-medium">Telefone</label><Input value={contactForm.phone} onChange={(e) => setContactForm({ ...contactForm, phone: e.target.value })} placeholder="(00) 00000-0000" className="mt-1 rounded-xl" /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><label className="text-sm font-medium">Empresa</label><Input value={contactForm.company} onChange={(e) => setContactForm({ ...contactForm, company: e.target.value })} placeholder="Nome da empresa" className="mt-1 rounded-xl" /></div>
              <div><label className="text-sm font-medium">Projeto</label><Select value={contactForm.project_id || "none"} onValueChange={(v) => setContactForm({ ...contactForm, project_id: v === "none" ? "" : v })}><SelectTrigger className="mt-1 rounded-xl"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">Nenhum</SelectItem>{projects.map((p) => <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>)}</SelectContent></Select></div>
            </div>
            <div><label className="text-sm font-medium">Estágio do Pipeline</label><Select value={contactForm.pipeline_stage} onValueChange={(v) => setContactForm({ ...contactForm, pipeline_stage: v })}><SelectTrigger className="mt-1 rounded-xl"><SelectValue /></SelectTrigger><SelectContent>{pipelineStages.map((s) => <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>)}</SelectContent></Select></div>
            <div><label className="text-sm font-medium">Observações</label><Textarea value={contactForm.notes} onChange={(e) => setContactForm({ ...contactForm, notes: e.target.value })} placeholder="Notas sobre o contato..." rows={2} className="mt-1 rounded-xl" /></div>
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" className="rounded-xl w-full sm:w-auto" onClick={() => { setContactDialogOpen(false); resetContactForm(); }}>Cancelar</Button>
            <Button className="rounded-xl shadow-lg shadow-primary/20 w-full sm:w-auto" onClick={() => saveContactMutation.mutate()} disabled={!contactForm.name.trim() || saveContactMutation.isPending}>{saveContactMutation.isPending ? "Salvando..." : editingContact ? "Salvar" : "Criar Contato"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Task Dialog */}
      <Dialog open={taskDialogOpen} onOpenChange={(open) => { setTaskDialogOpen(open); if (!open) resetTaskForm(); }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader><DialogTitle>{editingTask ? "Editar Tarefa" : "Nova Tarefa"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><label className="text-sm font-medium">Título *</label><Input value={taskForm.title} onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })} placeholder="O que precisa ser feito?" className="mt-1 rounded-xl" /></div>
            <div><label className="text-sm font-medium">Descrição</label><Textarea value={taskForm.description} onChange={(e) => setTaskForm({ ...taskForm, description: e.target.value })} placeholder="Detalhes..." rows={2} className="mt-1 rounded-xl" /></div>
            <div className="grid grid-cols-2 gap-4">
              <div><label className="text-sm font-medium">Contato</label><Select value={taskForm.contact_id || "none"} onValueChange={(v) => setTaskForm({ ...taskForm, contact_id: v === "none" ? "" : v })}><SelectTrigger className="mt-1 rounded-xl"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">Nenhum</SelectItem>{contacts.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent></Select></div>
              <div><label className="text-sm font-medium">Projeto</label><Select value={taskForm.project_id || "none"} onValueChange={(v) => setTaskForm({ ...taskForm, project_id: v === "none" ? "" : v })}><SelectTrigger className="mt-1 rounded-xl"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">Nenhum</SelectItem>{projects.map((p) => <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>)}</SelectContent></Select></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><label className="text-sm font-medium">Prioridade</label><Select value={taskForm.priority} onValueChange={(v) => setTaskForm({ ...taskForm, priority: v })}><SelectTrigger className="mt-1 rounded-xl"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="urgent">Urgente</SelectItem><SelectItem value="high">Alta</SelectItem><SelectItem value="medium">Média</SelectItem><SelectItem value="low">Baixa</SelectItem></SelectContent></Select></div>
              <div><label className="text-sm font-medium">Data</label><Popover><PopoverTrigger asChild><Button variant="outline" className={cn("w-full justify-start text-left font-normal mt-1 rounded-xl", !taskForm.due_date && "text-muted-foreground")}><Calendar className="h-4 w-4 mr-2" />{taskForm.due_date ? format(taskForm.due_date, "dd/MM/yyyy") : "Hoje"}</Button></PopoverTrigger><PopoverContent className="w-auto p-0" align="start"><CalendarComponent mode="single" selected={taskForm.due_date || undefined} onSelect={(d) => setTaskForm({ ...taskForm, due_date: d || null })} className="p-3 pointer-events-auto" /></PopoverContent></Popover></div>
            </div>
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" className="rounded-xl w-full sm:w-auto" onClick={() => { setTaskDialogOpen(false); resetTaskForm(); }}>Cancelar</Button>
            <Button className="rounded-xl shadow-lg shadow-primary/20 w-full sm:w-auto" onClick={() => saveTaskMutation.mutate()} disabled={!taskForm.title.trim() || saveTaskMutation.isPending}>{saveTaskMutation.isPending ? "Salvando..." : editingTask ? "Salvar" : "Criar Tarefa"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Interaction Dialog */}
      <Dialog open={interactionDialogOpen} onOpenChange={(open) => { setInteractionDialogOpen(open); if (!open) { setInteractionForm({ type: "note", description: "" }); setInteractionContactId(null); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Registrar Interação</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><label className="text-sm font-medium">Tipo</label><Select value={interactionForm.type} onValueChange={(v) => setInteractionForm({ ...interactionForm, type: v })}><SelectTrigger className="mt-1 rounded-xl"><SelectValue /></SelectTrigger><SelectContent>{interactionTypes.map((t) => <SelectItem key={t.key} value={t.key}>{t.icon} {t.label}</SelectItem>)}</SelectContent></Select></div>
            <div><label className="text-sm font-medium">Descrição *</label><Textarea value={interactionForm.description} onChange={(e) => setInteractionForm({ ...interactionForm, description: e.target.value })} placeholder="Descreva a interação..." rows={3} className="mt-1 rounded-xl" /></div>
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" className="rounded-xl w-full sm:w-auto" onClick={() => { setInteractionDialogOpen(false); setInteractionForm({ type: "note", description: "" }); }}>Cancelar</Button>
            <Button className="rounded-xl shadow-lg shadow-primary/20 w-full sm:w-auto" onClick={() => saveInteractionMutation.mutate()} disabled={!interactionForm.description.trim() || saveInteractionMutation.isPending}>{saveInteractionMutation.isPending ? "Registrando..." : "Registrar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </EMSLayout>
  );
};

export default Contacts;
