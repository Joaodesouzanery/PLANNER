import { useState } from "react";
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
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus, Trash2, Calendar, Flag, Users, Phone, Mail, Building2,
  Search, Edit2, CheckCircle2, Clock, AlertTriangle, ListTodo, GripVertical, MessageSquare
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";

interface Contact {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  notes: string | null;
  pipeline_stage: string | null;
  project_id: string | null;
  created_at: string;
  project?: { title: string } | null;
}

interface Interaction {
  id: string;
  contact_id: string;
  type: string;
  description: string;
  date: string;
  created_at: string;
}

const pipelineStages = [
  { key: "lead", label: "Lead", color: "bg-blue-500/10 text-blue-500 border-blue-500/30" },
  { key: "qualified", label: "Qualificado", color: "bg-amber-500/10 text-amber-500 border-amber-500/30" },
  { key: "proposal", label: "Proposta", color: "bg-purple-500/10 text-purple-500 border-purple-500/30" },
  { key: "closed", label: "Fechado", color: "bg-emerald-500/10 text-emerald-500 border-emerald-500/30" },
];

const interactionTypes = [
  { key: "call", label: "Ligação" },
  { key: "meeting", label: "Reunião" },
  { key: "email", label: "Email" },
  { key: "proposal", label: "Proposta" },
  { key: "note", label: "Nota" },
];

interface Task {
  id: string;
  title: string;
  description: string | null;
  priority: string;
  status: string;
  due_date: string | null;
  completed_at: string | null;
  contact_id: string | null;
  project_id: string | null;
  created_at: string;
  contact?: { name: string } | null;
  project?: { title: string } | null;
}

interface Project {
  id: string;
  title: string;
}

const priorityConfig: Record<string, { label: string; color: string; icon: typeof Flag }> = {
  urgent: { label: "Urgente", color: "bg-red-500/20 text-red-400 border-red-500/30", icon: AlertTriangle },
  high: { label: "Alta", color: "bg-orange-500/20 text-orange-400 border-orange-500/30", icon: Flag },
  medium: { label: "Média", color: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30", icon: Flag },
  low: { label: "Baixa", color: "bg-blue-500/20 text-blue-400 border-blue-500/30", icon: Flag },
};

const kanbanStatuses = [
  { key: "pending", label: "Pendentes", icon: Clock, color: "border-yellow-500/50" },
  { key: "in_progress", label: "Em Andamento", icon: ListTodo, color: "border-blue-500/50" },
  { key: "completed", label: "Concluídas", icon: CheckCircle2, color: "border-green-500/50" },
];

const Contacts = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();
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

  const { data: projects = [] } = useQuery({
    queryKey: ["projects"],
    queryFn: async () => {
      const { data, error } = await supabase.from("projects").select("id, title").order("title");
      if (error) throw error;
      return data as Project[];
    },
  });

  const { data: contacts = [], isLoading: contactsLoading } = useQuery({
    queryKey: ["contacts"],
    queryFn: async () => {
      const { data, error } = await supabase.from("contacts").select("*, project:projects(title)").order("name");
      if (error) throw error;
      return data as Contact[];
    },
  });

  const { data: tasks = [], isLoading: tasksLoading } = useQuery({
    queryKey: ["contact-tasks"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks")
        .select("*, contact:contacts(name), project:projects(title)")
        .not("contact_id", "is", null)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Task[];
    },
  });

  const { data: interactions = [] } = useQuery({
    queryKey: ["contact-interactions"],
    queryFn: async () => {
      const { data, error } = await supabase.from("contact_interactions").select("*").order("date", { ascending: false });
      if (error) throw error;
      return data as Interaction[];
    },
  });

  const getContactInteractions = (contactId: string) => interactions.filter((i) => i.contact_id === contactId);

  const saveInteractionMutation = useMutation({
    mutationFn: async () => {
      if (!interactionContactId) return;
      const { error } = await supabase.from("contact_interactions").insert({
        contact_id: interactionContactId,
        type: interactionForm.type,
        description: interactionForm.description,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contact-interactions"] });
      setInteractionDialogOpen(false);
      setInteractionForm({ type: "note", description: "" });
      toast({ title: "Interação registrada!" });
    },
    onError: (error: any) => {
      toast({ title: "Erro ao registrar interação", description: error?.message || "Tente novamente", variant: "destructive" });
    },
  });

  const updatePipelineMutation = useMutation({
    mutationFn: async ({ id, stage }: { id: string; stage: string }) => {
      const { error } = await supabase.from("contacts").update({ pipeline_stage: stage }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["contacts"] }),
  });

  // Contact mutations
  const saveContactMutation = useMutation({
    mutationFn: async () => {
      const payload: any = {
        name: contactForm.name,
        email: contactForm.email || null,
        phone: contactForm.phone || null,
        company: contactForm.company || null,
        notes: contactForm.notes || null,
        project_id: contactForm.project_id || null,
        pipeline_stage: contactForm.pipeline_stage || "lead",
      };
      if (editingContact) {
        const { error } = await supabase.from("contacts").update(payload).eq("id", editingContact.id);
        if (error) throw error;
      } else {
        if (user?.id) payload.user_id = user.id;
        const { error } = await supabase.from("contacts").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
      setContactDialogOpen(false);
      resetContactForm();
      toast({ title: editingContact ? "Contato atualizado!" : "Contato criado!" });
    },
    onError: (error: any) => {
      console.error("Erro ao salvar contato:", error);
      toast({ title: "Erro ao salvar contato", description: error?.message || "Tente novamente", variant: "destructive" });
    },
  });

  const deleteContactMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("contacts").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
      queryClient.invalidateQueries({ queryKey: ["contact-tasks"] });
      toast({ title: "Contato removido" });
    },
    onError: (error: any) => {
      toast({ title: "Erro ao remover contato", description: error?.message || "Tente novamente", variant: "destructive" });
    },
  });

  // Task mutations
  const saveTaskMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        title: taskForm.title,
        description: taskForm.description || null,
        priority: taskForm.priority,
        due_date: taskForm.due_date ? format(taskForm.due_date, "yyyy-MM-dd") : format(new Date(), "yyyy-MM-dd"),
        contact_id: taskForm.contact_id || null,
        project_id: taskForm.project_id || null,
      };
      if (editingTask) {
        const { error } = await supabase.from("tasks").update(payload).eq("id", editingTask.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("tasks").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contact-tasks"] });
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      setTaskDialogOpen(false);
      resetTaskForm();
      toast({ title: editingTask ? "Tarefa atualizada!" : "Tarefa criada!" });
    },
    onError: (error: any) => {
      toast({ title: "Erro ao salvar tarefa", description: error?.message || "Tente novamente", variant: "destructive" });
    },
  });

  const toggleTaskMutation = useMutation({
    mutationFn: async ({ id, completed }: { id: string; completed: boolean }) => {
      const { error } = await supabase.from("tasks").update({
        status: completed ? "completed" : "pending",
        completed_at: completed ? new Date().toISOString() : null,
      }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["contact-tasks"] }),
  });

  const deleteTaskMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("tasks").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contact-tasks"] });
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      toast({ title: "Tarefa removida" });
    },
    onError: (error: any) => {
      toast({ title: "Erro ao remover tarefa", description: error?.message || "Tente novamente", variant: "destructive" });
    },
  });

  const updateTaskStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("tasks").update({
        status,
        completed_at: status === "completed" ? new Date().toISOString() : null,
      }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["contact-tasks"] }),
  });

  const resetContactForm = () => {
    setContactForm({ name: "", email: "", phone: "", company: "", notes: "", project_id: "", pipeline_stage: "lead" });
    setEditingContact(null);
  };

  const resetTaskForm = () => {
    setTaskForm({ title: "", description: "", priority: "medium", due_date: null, contact_id: "", project_id: "" });
    setEditingTask(null);
  };

  const openEditContact = (contact: Contact) => {
    setEditingContact(contact);
    setContactForm({
      name: contact.name,
      email: contact.email || "",
      phone: contact.phone || "",
      company: contact.company || "",
      notes: contact.notes || "",
      project_id: contact.project_id || "",
      pipeline_stage: contact.pipeline_stage || "lead",
    });
    setContactDialogOpen(true);
  };

  const openEditTask = (task: Task) => {
    setEditingTask(task);
    setTaskForm({
      title: task.title,
      description: task.description || "",
      priority: task.priority,
      due_date: task.due_date ? new Date(task.due_date + "T00:00:00") : null,
      contact_id: task.contact_id || "",
      project_id: task.project_id || "",
    });
    setTaskDialogOpen(true);
  };

  const filteredContacts = contacts.filter((c) => {
    const matchesSearch = !searchQuery || c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.company?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.email?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesProject = projectFilter === "all" || c.project_id === projectFilter;
    return matchesSearch && matchesProject;
  });

  const filteredTasks = tasks.filter((t) => {
    const matchesSearch = !searchQuery || t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.contact?.name?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesProject = projectFilter === "all" || t.project_id === projectFilter;
    return matchesSearch && matchesProject;
  });

  const getTasksByStatus = (status: string) => filteredTasks.filter((t) => {
    if (status === "in_progress") return t.status === "in_progress";
    if (status === "completed") return t.status === "completed";
    return t.status === "pending" || (t.status !== "completed" && t.status !== "in_progress");
  });

  const renderTaskCard = (task: Task, compact = false) => {
    const pConfig = priorityConfig[task.priority] || priorityConfig.medium;
    const PIcon = pConfig.icon;
    return (
      <motion.div
        key={task.id}
        layout
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, x: -100 }}
        className={cn(
          "flex items-center gap-3 p-3 rounded-xl border transition-all duration-300",
          task.status === "completed" ? "opacity-50 bg-muted/30" : "bg-card hover:bg-muted/50 hover:shadow-sm"
        )}
      >
        <Checkbox
          checked={task.status === "completed"}
          onCheckedChange={(checked) => toggleTaskMutation.mutate({ id: task.id, completed: !!checked })}
        />
        <div className="flex-1 min-w-0">
          <p className={cn("font-medium truncate", task.status === "completed" && "line-through text-muted-foreground")}>
            {task.title}
          </p>
          {task.contact && (
            <p className="text-xs text-muted-foreground truncate flex items-center gap-1">
              <Users className="h-3 w-3" /> {task.contact.name}
            </p>
          )}
          {!compact && task.project && (
            <p className="text-xs text-muted-foreground truncate flex items-center gap-1">
              <Building2 className="h-3 w-3" /> {task.project.title}
            </p>
          )}
        </div>
        <Badge variant="outline" className={cn("text-xs shrink-0", pConfig.color)}>
          <PIcon className="h-3 w-3 mr-1" />{pConfig.label}
        </Badge>
        {task.due_date && (
          <span className="text-xs text-muted-foreground shrink-0 hidden sm:block">
            <Calendar className="h-3 w-3 inline mr-1" />
            {format(new Date(task.due_date + "T00:00:00"), "dd/MM", { locale: ptBR })}
          </span>
        )}
        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => openEditTask(task)}>
          <Edit2 className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive" onClick={() => deleteTaskMutation.mutate(task.id)}>
          <Trash2 className="h-4 w-4" />
        </Button>
      </motion.div>
    );
  };

  return (
    <EMSLayout>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-heading font-bold text-foreground">Contatos</h1>
            <p className="text-sm md:text-base text-muted-foreground mt-1">Gerencie contatos e suas tarefas</p>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => { resetContactForm(); setContactDialogOpen(true); }} className="gap-2 flex-1 sm:flex-none rounded-xl border-primary/30 hover:border-primary/60 hover:bg-primary/5 transition-all duration-300">
              <Plus className="h-4 w-4" /> Novo Contato
            </Button>
            <Button onClick={() => { resetTaskForm(); setTaskDialogOpen(true); }} className="gap-2 flex-1 sm:flex-none rounded-xl shadow-lg hover:shadow-primary transition-all duration-300">
              <Plus className="h-4 w-4" /> Nova Tarefa
            </Button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Buscar contatos ou tarefas..." className="pl-10" />
          </div>
          <Select value={projectFilter} onValueChange={setProjectFilter}>
            <SelectTrigger className="w-full sm:w-[200px]">
              <SelectValue placeholder="Projeto" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os Projetos</SelectItem>
              {projects.map((p) => (
                <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Contatos", value: contacts.length, icon: Users, color: "text-primary", bg: "bg-primary/10", border: "border-primary/20" },
            { label: "Tarefas", value: tasks.length, icon: ListTodo, color: "text-blue-400", bg: "bg-blue-500/10", border: "border-blue-500/20" },
            { label: "Pendentes", value: tasks.filter((t) => t.status !== "completed").length, icon: Clock, color: "text-yellow-400", bg: "bg-yellow-500/10", border: "border-yellow-500/20" },
            { label: "Concluídas", value: tasks.filter((t) => t.status === "completed").length, icon: CheckCircle2, color: "text-green-400", bg: "bg-green-500/10", border: "border-green-500/20" },
          ].map((s) => (
            <Card key={s.label} className={cn("border transition-all duration-300 hover:scale-[1.02]", s.border)}>
              <CardContent className="p-4 flex items-center gap-3">
                <div className={cn("p-2 rounded-lg", s.bg)}>
                  <s.icon className={cn("h-5 w-5", s.color)} />
                </div>
                <div>
                  <p className="text-2xl font-bold">{s.value}</p>
                  <p className="text-xs text-muted-foreground">{s.label}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <div className="flex items-center justify-between">
            <TabsList>
              <TabsTrigger value="contacts" className="gap-2"><Users className="h-4 w-4" /> Contatos</TabsTrigger>
              <TabsTrigger value="tasks" className="gap-2"><ListTodo className="h-4 w-4" /> Tarefas</TabsTrigger>
            </TabsList>
            {activeTab === "tasks" && (
              <div className="flex gap-1 bg-muted/50 p-1 rounded-xl">
                <Button variant={viewMode === "list" ? "default" : "ghost"} size="sm" className="rounded-lg" onClick={() => setViewMode("list")}>Lista</Button>
                <Button variant={viewMode === "kanban" ? "default" : "ghost"} size="sm" className="rounded-lg" onClick={() => setViewMode("kanban")}>Kanban</Button>
              </div>
            )}
          </div>

          {/* Contacts Tab */}
          <TabsContent value="contacts">
            <div className="space-y-3">
              {contactsLoading ? (
                <p className="text-muted-foreground text-center py-8">Carregando...</p>
              ) : filteredContacts.length === 0 ? (
                <Card className="border-dashed border-primary/20">
                  <CardContent className="py-16 text-center">
                    <div className="inline-flex p-4 rounded-2xl bg-primary/10 mb-4">
                      <Users className="h-10 w-10 text-primary/60" />
                    </div>
                    <p className="text-muted-foreground text-lg font-medium">Nenhum contato encontrado</p>
                    <p className="text-muted-foreground/60 text-sm mt-1 mb-4">Comece adicionando seu primeiro contato</p>
                    <Button className="rounded-xl shadow-lg hover:shadow-primary transition-all duration-300" onClick={() => { resetContactForm(); setContactDialogOpen(true); }}>
                      <Plus className="h-4 w-4 mr-2" /> Criar primeiro contato
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                <AnimatePresence>
                  {filteredContacts.map((contact) => {
                    const contactTasks = tasks.filter((t) => t.contact_id === contact.id);
                    const pendingTasks = contactTasks.filter((t) => t.status !== "completed").length;
                    return (
                      <motion.div key={contact.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                        <Card className="hover:border-primary/30 transition-all duration-300 hover:shadow-md hover:shadow-primary/5">
                          <CardContent className="p-5">
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-2 flex-wrap">
                                  <h3 className="font-semibold text-foreground text-base">{contact.name}</h3>
                                  {(() => {
                                    const stage = pipelineStages.find((s) => s.key === (contact.pipeline_stage || "lead"));
                                    return stage ? (
                                      <Badge variant="outline" className={cn("text-xs", stage.color)}>{stage.label}</Badge>
                                    ) : null;
                                  })()}
                                  {contact.project?.title && <Badge variant="outline" className="text-xs">{contact.project.title}</Badge>}
                                  {pendingTasks > 0 && (
                                    <Badge variant="secondary" className="text-xs">
                                      {pendingTasks} pendente{pendingTasks > 1 ? "s" : ""}
                                    </Badge>
                                  )}
                                </div>
                                <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                                  {contact.email && <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{contact.email}</span>}
                                  {contact.phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{contact.phone}</span>}
                                  {contact.company && <span className="flex items-center gap-1"><Building2 className="h-3 w-3" />{contact.company}</span>}
                                </div>
                                {contact.notes && <p className="text-xs text-muted-foreground mt-1 truncate">{contact.notes}</p>}
                              </div>
                              <div className="flex gap-1">
                                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg hover:bg-primary/10 hover:text-primary transition-colors" onClick={() => { setInteractionContactId(contact.id); setInteractionDialogOpen(true); }} title="Registrar interação">
                                  <MessageSquare className="h-4 w-4" />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg hover:bg-blue-500/10 hover:text-blue-400 transition-colors" onClick={() => setExpandedContact(expandedContact === contact.id ? null : contact.id)} title="Histórico">
                                  <Clock className="h-4 w-4" />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg hover:bg-muted transition-colors" onClick={() => openEditContact(contact)}>
                                  <Edit2 className="h-4 w-4" />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors" onClick={() => deleteContactMutation.mutate(contact.id)}>
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                            {/* Interaction History */}
                            {expandedContact === contact.id && (() => {
                              const cInteractions = getContactInteractions(contact.id);
                              return (
                                <div className="mt-3 pt-3 border-t">
                                  <div className="flex items-center justify-between mb-2">
                                    <p className="text-xs font-medium text-muted-foreground">Histórico de Interações</p>
                                    {/* Pipeline stage selector */}
                                    <div className="flex gap-1">
                                      {pipelineStages.map((s) => (
                                        <Badge
                                          key={s.key}
                                          variant={contact.pipeline_stage === s.key ? "default" : "outline"}
                                          className={cn("text-[10px] cursor-pointer", contact.pipeline_stage === s.key ? "" : s.color)}
                                          onClick={() => updatePipelineMutation.mutate({ id: contact.id, stage: s.key })}
                                        >
                                          {s.label}
                                        </Badge>
                                      ))}
                                    </div>
                                  </div>
                                  {cInteractions.length === 0 ? (
                                    <p className="text-xs text-muted-foreground py-2">Nenhuma interação registrada</p>
                                  ) : (
                                    <div className="space-y-1.5 max-h-40 overflow-y-auto">
                                      {cInteractions.slice(0, 5).map((interaction) => (
                                        <div key={interaction.id} className="flex items-start gap-2 text-xs bg-muted/50 rounded p-2">
                                          <Badge variant="secondary" className="text-[10px] shrink-0">
                                            {interactionTypes.find((t) => t.key === interaction.type)?.label || interaction.type}
                                          </Badge>
                                          <span className="text-muted-foreground flex-1">{interaction.description}</span>
                                          <span className="text-[10px] text-muted-foreground/60 shrink-0">
                                            {format(new Date(interaction.date), "dd/MM", { locale: ptBR })}
                                          </span>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              );
                            })()}

                            {/* Inline tasks for this contact */}
                            {contactTasks.length > 0 && (
                              <div className="mt-3 pt-3 border-t space-y-1">
                                {contactTasks.slice(0, 3).map((task) => renderTaskCard(task, true))}
                                {contactTasks.length > 3 && (
                                  <p className="text-xs text-muted-foreground text-center pt-1">
                                    +{contactTasks.length - 3} tarefa(s) mais
                                  </p>
                                )}
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
              <Card>
                <CardHeader><CardTitle className="text-lg">Tarefas de Contatos</CardTitle></CardHeader>
                <CardContent>
                  {tasksLoading ? (
                    <p className="text-muted-foreground text-center py-8">Carregando...</p>
                  ) : filteredTasks.length === 0 ? (
                    <div className="text-center py-16">
                      <div className="inline-flex p-4 rounded-2xl bg-blue-500/10 mb-4">
                        <ListTodo className="h-10 w-10 text-blue-400/60" />
                      </div>
                      <p className="text-muted-foreground text-lg font-medium">Nenhuma tarefa de contato encontrada</p>
                      <p className="text-muted-foreground/60 text-sm mt-1 mb-4">Crie tarefas para acompanhar seus contatos</p>
                      <Button className="rounded-xl shadow-lg hover:shadow-primary transition-all duration-300" onClick={() => { resetTaskForm(); setTaskDialogOpen(true); }}>
                        <Plus className="h-4 w-4 mr-2" /> Criar tarefa
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <AnimatePresence>{filteredTasks.map((task) => renderTaskCard(task))}</AnimatePresence>
                    </div>
                  )}
                </CardContent>
              </Card>
            ) : (
              /* Kanban View */
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {kanbanStatuses.map((col) => {
                  const colTasks = getTasksByStatus(col.key);
                  const ColIcon = col.icon;
                  return (
                    <Card key={col.key} className={cn("border-t-2", col.color)}>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <ColIcon className="h-4 w-4" />
                          {col.label}
                          <Badge variant="secondary" className="ml-auto">{colTasks.length}</Badge>
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2 min-h-[200px]">
                        <AnimatePresence>
                          {colTasks.map((task) => {
                            const pConfig = priorityConfig[task.priority] || priorityConfig.medium;
                            return (
                              <motion.div
                                key={task.id}
                                layout
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.95 }}
                                className="p-3 rounded-xl border bg-card hover:bg-muted/50 transition-all duration-300 hover:shadow-sm"
                              >
                                <div className="flex items-start justify-between gap-2 mb-2">
                                  <p className="font-medium text-sm">{task.title}</p>
                                  <Badge variant="outline" className={cn("text-xs shrink-0", pConfig.color)}>
                                    {pConfig.label}
                                  </Badge>
                                </div>
                                {task.contact && (
                                  <p className="text-xs text-muted-foreground flex items-center gap-1 mb-1">
                                    <Users className="h-3 w-3" /> {task.contact.name}
                                  </p>
                                )}
                                {task.project && (
                                  <p className="text-xs text-muted-foreground flex items-center gap-1 mb-2">
                                    <Building2 className="h-3 w-3" /> {task.project.title}
                                  </p>
                                )}
                                <div className="flex items-center justify-between">
                                  {task.due_date && (
                                    <span className="text-xs text-muted-foreground">
                                      <Calendar className="h-3 w-3 inline mr-1" />
                                      {format(new Date(task.due_date + "T00:00:00"), "dd/MM", { locale: ptBR })}
                                    </span>
                                  )}
                                  <div className="flex gap-1 ml-auto">
                                    {col.key !== "pending" && (
                                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => updateTaskStatusMutation.mutate({ id: task.id, status: "pending" })}>
                                        <Clock className="h-3 w-3" />
                                      </Button>
                                    )}
                                    {col.key !== "in_progress" && (
                                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => updateTaskStatusMutation.mutate({ id: task.id, status: "in_progress" })}>
                                        <ListTodo className="h-3 w-3" />
                                      </Button>
                                    )}
                                    {col.key !== "completed" && (
                                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => updateTaskStatusMutation.mutate({ id: task.id, status: "completed" })}>
                                        <CheckCircle2 className="h-3 w-3" />
                                      </Button>
                                    )}
                                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => openEditTask(task)}>
                                      <Edit2 className="h-3 w-3" />
                                    </Button>
                                    <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-destructive" onClick={() => deleteTaskMutation.mutate(task.id)}>
                                      <Trash2 className="h-3 w-3" />
                                    </Button>
                                  </div>
                                </div>
                              </motion.div>
                            );
                          })}
                        </AnimatePresence>
                        {colTasks.length === 0 && (
                          <p className="text-xs text-muted-foreground text-center py-8">Nenhuma tarefa</p>
                        )}
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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingContact ? "Editar Contato" : "Novo Contato"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Nome *</label>
              <Input value={contactForm.name} onChange={(e) => setContactForm({ ...contactForm, name: e.target.value })} placeholder="Nome do contato" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Email</label>
                <Input value={contactForm.email} onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })} placeholder="email@exemplo.com" />
              </div>
              <div>
                <label className="text-sm font-medium">Telefone</label>
                <Input value={contactForm.phone} onChange={(e) => setContactForm({ ...contactForm, phone: e.target.value })} placeholder="(00) 00000-0000" />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Empresa</label>
                <Input value={contactForm.company} onChange={(e) => setContactForm({ ...contactForm, company: e.target.value })} placeholder="Nome da empresa" />
              </div>
              <div>
                <label className="text-sm font-medium">Projeto</label>
                <Select value={contactForm.project_id || "none"} onValueChange={(v) => setContactForm({ ...contactForm, project_id: v === "none" ? "" : v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhum</SelectItem>
                    {projects.map((p) => <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">Estágio do Pipeline</label>
              <Select value={contactForm.pipeline_stage} onValueChange={(v) => setContactForm({ ...contactForm, pipeline_stage: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {pipelineStages.map((s) => <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">Observações</label>
              <Textarea value={contactForm.notes} onChange={(e) => setContactForm({ ...contactForm, notes: e.target.value })} placeholder="Notas sobre o contato..." rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" className="rounded-xl" onClick={() => { setContactDialogOpen(false); resetContactForm(); }}>Cancelar</Button>
            <Button className="rounded-xl shadow-lg hover:shadow-primary transition-all duration-300" onClick={() => saveContactMutation.mutate()} disabled={!contactForm.name.trim() || saveContactMutation.isPending}>
              {saveContactMutation.isPending ? "Salvando..." : editingContact ? "Salvar" : "Criar Contato"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Task Dialog */}
      <Dialog open={taskDialogOpen} onOpenChange={(open) => { setTaskDialogOpen(open); if (!open) resetTaskForm(); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingTask ? "Editar Tarefa" : "Nova Tarefa"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Título *</label>
              <Input value={taskForm.title} onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })} placeholder="O que precisa ser feito?" />
            </div>
            <div>
              <label className="text-sm font-medium">Descrição</label>
              <Textarea value={taskForm.description} onChange={(e) => setTaskForm({ ...taskForm, description: e.target.value })} placeholder="Detalhes..." rows={2} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Contato</label>
                <Select value={taskForm.contact_id || "none"} onValueChange={(v) => setTaskForm({ ...taskForm, contact_id: v === "none" ? "" : v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhum</SelectItem>
                    {contacts.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium">Projeto</label>
                <Select value={taskForm.project_id || "none"} onValueChange={(v) => setTaskForm({ ...taskForm, project_id: v === "none" ? "" : v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhum</SelectItem>
                    {projects.map((p) => <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Prioridade</label>
                <Select value={taskForm.priority} onValueChange={(v) => setTaskForm({ ...taskForm, priority: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="urgent">🔴 Urgente</SelectItem>
                    <SelectItem value="high">🟠 Alta</SelectItem>
                    <SelectItem value="medium">🟡 Média</SelectItem>
                    <SelectItem value="low">🔵 Baixa</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium">Data</label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !taskForm.due_date && "text-muted-foreground")}>
                      <Calendar className="h-4 w-4 mr-2" />
                      {taskForm.due_date ? format(taskForm.due_date, "dd/MM/yyyy") : "Hoje"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <CalendarComponent mode="single" selected={taskForm.due_date || undefined} onSelect={(d) => setTaskForm({ ...taskForm, due_date: d || null })} className="p-3 pointer-events-auto" />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" className="rounded-xl" onClick={() => { setTaskDialogOpen(false); resetTaskForm(); }}>Cancelar</Button>
            <Button className="rounded-xl shadow-lg hover:shadow-primary transition-all duration-300" onClick={() => saveTaskMutation.mutate()} disabled={!taskForm.title.trim() || saveTaskMutation.isPending}>
              {saveTaskMutation.isPending ? "Salvando..." : editingTask ? "Salvar" : "Criar Tarefa"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Interaction Dialog */}
      <Dialog open={interactionDialogOpen} onOpenChange={(open) => { setInteractionDialogOpen(open); if (!open) { setInteractionForm({ type: "note", description: "" }); setInteractionContactId(null); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar Interação</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Tipo</label>
              <Select value={interactionForm.type} onValueChange={(v) => setInteractionForm({ ...interactionForm, type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {interactionTypes.map((t) => <SelectItem key={t.key} value={t.key}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">Descrição *</label>
              <Textarea value={interactionForm.description} onChange={(e) => setInteractionForm({ ...interactionForm, description: e.target.value })} placeholder="Descreva a interação..." rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" className="rounded-xl" onClick={() => { setInteractionDialogOpen(false); setInteractionForm({ type: "note", description: "" }); }}>Cancelar</Button>
            <Button className="rounded-xl shadow-lg hover:shadow-primary transition-all duration-300" onClick={() => saveInteractionMutation.mutate()} disabled={!interactionForm.description.trim() || saveInteractionMutation.isPending}>
              {saveInteractionMutation.isPending ? "Registrando..." : "Registrar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </EMSLayout>
  );
};

export default Contacts;
