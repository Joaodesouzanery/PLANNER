import { useState } from "react";
import { EMSLayout } from "@/components/ems/EMSLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus, Trash2, Calendar, Flag, ListTodo, CheckCircle2, Clock, AlertTriangle,
  Tag, MessageSquare, ChevronDown, ChevronRight, X,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface Task {
  id: string;
  title: string;
  description: string | null;
  priority: string;
  status: string;
  due_date: string | null;
  completed_at: string | null;
  order_index: number;
  tags: string[] | null;
  parent_task_id: string | null;
  created_at: string;
}

interface TaskNote {
  id: string;
  task_id: string;
  content: string;
  created_at: string;
}

const priorityConfig: Record<string, { label: string; color: string; icon: typeof Flag }> = {
  urgent: { label: "Urgente", color: "bg-red-500/20 text-red-400 border-red-500/30", icon: AlertTriangle },
  high: { label: "Alta", color: "bg-orange-500/20 text-orange-400 border-orange-500/30", icon: Flag },
  medium: { label: "Média", color: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30", icon: Flag },
  low: { label: "Baixa", color: "bg-blue-500/20 text-blue-400 border-blue-500/30", icon: Flag },
};

const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3 };

const Tasks = () => {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [filter, setFilter] = useState<"all" | "pending" | "completed">("all");
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [form, setForm] = useState({ title: "", description: "", priority: "medium", due_date: null as Date | null, tags: [] as string[] });
  const [tagInput, setTagInput] = useState("");
  const [expandedTask, setExpandedTask] = useState<string | null>(null);
  const [subtaskInput, setSubtaskInput] = useState("");
  const [noteInput, setNoteInput] = useState("");

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ["tasks"],
    queryFn: async () => {
      const { data, error } = await supabase.from("tasks").select("*").is("contact_id", null).order("order_index");
      if (error) throw error;
      return (data as Task[]).sort((a, b) => {
        if (a.status === "completed" && b.status !== "completed") return 1;
        if (a.status !== "completed" && b.status === "completed") return -1;
        return (priorityOrder[a.priority as keyof typeof priorityOrder] ?? 2) - (priorityOrder[b.priority as keyof typeof priorityOrder] ?? 2);
      });
    },
  });

  const { data: taskNotes = [] } = useQuery({
    queryKey: ["task-notes", expandedTask],
    queryFn: async () => {
      if (!expandedTask) return [];
      const { data } = await supabase.from("task_notes").select("*").eq("task_id", expandedTask).order("created_at", { ascending: false });
      return (data || []) as TaskNote[];
    },
    enabled: !!expandedTask,
  });

  const parentTasks = tasks.filter((t) => !t.parent_task_id);
  const getSubtasks = (parentId: string) => tasks.filter((t) => t.parent_task_id === parentId);

  const allTags = [...new Set(tasks.flatMap((t) => t.tags || []))].sort();

  const createMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("tasks").insert({
        title: form.title,
        description: form.description || null,
        priority: form.priority,
        due_date: form.due_date ? format(form.due_date, "yyyy-MM-dd") : format(new Date(), "yyyy-MM-dd"),
        tags: form.tags.length > 0 ? form.tags : null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      setDialogOpen(false);
      setForm({ title: "", description: "", priority: "medium", due_date: null, tags: [] });
      toast({ title: "Tarefa criada!" });
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, completed }: { id: string; completed: boolean }) => {
      const { error } = await supabase.from("tasks").update({
        status: completed ? "completed" : "pending",
        completed_at: completed ? new Date().toISOString() : null,
      }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["tasks"] }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("tasks").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      toast({ title: "Tarefa removida" });
    },
  });

  const addSubtask = async (parentId: string) => {
    if (!subtaskInput.trim()) return;
    await supabase.from("tasks").insert({
      title: subtaskInput,
      priority: "medium",
      parent_task_id: parentId,
      due_date: format(new Date(), "yyyy-MM-dd"),
    });
    setSubtaskInput("");
    queryClient.invalidateQueries({ queryKey: ["tasks"] });
    toast({ title: "Subtarefa adicionada!" });
  };

  const addNote = async (taskId: string) => {
    if (!noteInput.trim()) return;
    await supabase.from("task_notes").insert({ task_id: taskId, content: noteInput });
    setNoteInput("");
    queryClient.invalidateQueries({ queryKey: ["task-notes", taskId] });
    toast({ title: "Nota adicionada!" });
  };

  const addTagToForm = () => {
    if (tagInput && !form.tags.includes(tagInput)) {
      setForm({ ...form, tags: [...form.tags, tagInput] });
      setTagInput("");
    }
  };

  const filteredTasks = parentTasks.filter((t) => {
    if (filter === "pending" && t.status === "completed") return false;
    if (filter === "completed" && t.status !== "completed") return false;
    if (tagFilter && !(t.tags || []).includes(tagFilter)) return false;
    return true;
  });

  const stats = {
    total: parentTasks.length,
    pending: parentTasks.filter((t) => t.status !== "completed").length,
    completed: parentTasks.filter((t) => t.status === "completed").length,
    urgent: parentTasks.filter((t) => t.priority === "urgent" && t.status !== "completed").length,
  };

  return (
    <EMSLayout>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl md:text-3xl font-heading font-bold text-foreground">Tarefas</h1>
            <p className="text-sm md:text-base text-muted-foreground mt-1">Gerencie suas tarefas diárias por prioridade</p>
          </div>
          <Button onClick={() => setDialogOpen(true)} className="gap-2 w-full sm:w-auto">
            <Plus className="h-4 w-4" /> Nova Tarefa
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Total", value: stats.total, icon: ListTodo, color: "text-primary" },
            { label: "Pendentes", value: stats.pending, icon: Clock, color: "text-yellow-400" },
            { label: "Concluídas", value: stats.completed, icon: CheckCircle2, color: "text-green-400" },
            { label: "Urgentes", value: stats.urgent, icon: AlertTriangle, color: "text-red-400" },
          ].map((s) => (
            <Card key={s.label}>
              <CardContent className="p-4 flex items-center gap-3">
                <s.icon className={cn("h-5 w-5", s.color)} />
                <div>
                  <p className="text-2xl font-bold">{s.value}</p>
                  <p className="text-xs text-muted-foreground">{s.label}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-2">
          {(["all", "pending", "completed"] as const).map((f) => (
            <Button key={f} variant={filter === f ? "default" : "outline"} size="sm" onClick={() => setFilter(f)}>
              {f === "all" ? "Todas" : f === "pending" ? "Pendentes" : "Concluídas"}
            </Button>
          ))}
          {allTags.length > 0 && (
            <>
              <div className="w-px h-6 bg-border self-center mx-1" />
              {tagFilter && (
                <Button variant="ghost" size="sm" onClick={() => setTagFilter(null)} className="gap-1 text-xs">
                  <X className="h-3 w-3" /> Limpar tag
                </Button>
              )}
              {allTags.map((tag) => (
                <Badge
                  key={tag}
                  variant={tagFilter === tag ? "default" : "outline"}
                  className="cursor-pointer text-xs"
                  onClick={() => setTagFilter(tagFilter === tag ? null : tag)}
                >
                  <Tag className="h-3 w-3 mr-1" />{tag}
                </Badge>
              ))}
            </>
          )}
        </div>

        {/* Task List */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">
              {filter === "all" ? "Todas as Tarefas" : filter === "pending" ? "Tarefas Pendentes" : "Tarefas Concluídas"}
              {tagFilter && <span className="text-primary ml-2">#{tagFilter}</span>}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="text-muted-foreground text-center py-8">Carregando...</p>
            ) : filteredTasks.length === 0 ? (
              <div className="text-center py-12">
                <ListTodo className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
                <p className="text-muted-foreground">Nenhuma tarefa encontrada</p>
                <Button variant="outline" className="mt-4" onClick={() => setDialogOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" /> Criar primeira tarefa
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                <AnimatePresence>
                  {filteredTasks.map((task) => {
                    const pConfig = priorityConfig[task.priority] || priorityConfig.medium;
                    const PIcon = pConfig.icon;
                    const subtasks = getSubtasks(task.id);
                    const completedSubs = subtasks.filter((s) => s.status === "completed").length;
                    const isExpanded = expandedTask === task.id;

                    return (
                      <motion.div
                        key={task.id}
                        layout
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, x: -100 }}
                      >
                        <div
                          className={cn(
                            "p-3 rounded-lg border transition-colors",
                            task.status === "completed" ? "opacity-50 bg-muted/30" : "bg-card hover:bg-muted/50"
                          )}
                        >
                          <div className="flex items-center gap-3">
                            <Checkbox
                              checked={task.status === "completed"}
                              onCheckedChange={(checked) => toggleMutation.mutate({ id: task.id, completed: !!checked })}
                            />
                            <button className="flex-1 min-w-0 text-left" onClick={() => setExpandedTask(isExpanded ? null : task.id)}>
                              <div className="flex items-center gap-2">
                                {subtasks.length > 0 && (
                                  isExpanded ? <ChevronDown className="h-3 w-3 text-muted-foreground" /> : <ChevronRight className="h-3 w-3 text-muted-foreground" />
                                )}
                                <p className={cn("font-medium truncate", task.status === "completed" && "line-through text-muted-foreground")}>
                                  {task.title}
                                </p>
                              </div>
                              {task.description && (
                                <p className="text-xs text-muted-foreground truncate">{task.description}</p>
                              )}
                              <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                                {(task.tags || []).map((tag) => (
                                  <Badge key={tag} variant="secondary" className="text-[10px] px-1.5 py-0">
                                    {tag}
                                  </Badge>
                                ))}
                                {subtasks.length > 0 && (
                                  <span className="text-[10px] text-muted-foreground">
                                    {completedSubs}/{subtasks.length} subtarefas
                                  </span>
                                )}
                              </div>
                            </button>
                            <Badge variant="outline" className={cn("text-xs shrink-0 hidden sm:flex", pConfig.color)}>
                              <PIcon className="h-3 w-3 mr-1" />
                              {pConfig.label}
                            </Badge>
                            {task.due_date && (
                              <span className="text-xs text-muted-foreground shrink-0 hidden sm:block">
                                <Calendar className="h-3 w-3 inline mr-1" />
                                {format(new Date(task.due_date + "T00:00:00"), "dd/MM", { locale: ptBR })}
                              </span>
                            )}
                            <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive" onClick={() => deleteMutation.mutate(task.id)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>

                          {/* Expanded area: subtasks + notes */}
                          <AnimatePresence>
                            {isExpanded && (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: "auto", opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                className="overflow-hidden"
                              >
                                <div className="mt-3 ml-7 space-y-3">
                                  {/* Subtasks */}
                                  <div>
                                    <p className="text-xs font-medium text-muted-foreground mb-2">Subtarefas</p>
                                    {subtasks.map((sub) => (
                                      <div key={sub.id} className="flex items-center gap-2 py-1">
                                        <Checkbox
                                          className="h-3.5 w-3.5"
                                          checked={sub.status === "completed"}
                                          onCheckedChange={(checked) => toggleMutation.mutate({ id: sub.id, completed: !!checked })}
                                        />
                                        <span className={cn("text-sm", sub.status === "completed" && "line-through text-muted-foreground")}>
                                          {sub.title}
                                        </span>
                                        <Button variant="ghost" size="icon" className="h-5 w-5 ml-auto text-muted-foreground hover:text-destructive" onClick={() => deleteMutation.mutate(sub.id)}>
                                          <Trash2 className="h-3 w-3" />
                                        </Button>
                                      </div>
                                    ))}
                                    <div className="flex gap-2 mt-1">
                                      <Input
                                        className="h-8 text-sm"
                                        placeholder="Adicionar subtarefa..."
                                        value={subtaskInput}
                                        onChange={(e) => setSubtaskInput(e.target.value)}
                                        onKeyDown={(e) => e.key === "Enter" && addSubtask(task.id)}
                                      />
                                      <Button size="sm" variant="outline" className="h-8" onClick={() => addSubtask(task.id)}>
                                        <Plus className="h-3 w-3" />
                                      </Button>
                                    </div>
                                  </div>

                                  {/* Notes */}
                                  <div>
                                    <p className="text-xs font-medium text-muted-foreground mb-2">
                                      <MessageSquare className="h-3 w-3 inline mr-1" />
                                      Notas
                                    </p>
                                    {taskNotes.map((note) => (
                                      <div key={note.id} className="text-sm text-muted-foreground bg-muted/50 rounded p-2 mb-1">
                                        <p>{note.content}</p>
                                        <p className="text-[10px] mt-1 opacity-60">
                                          {format(new Date(note.created_at), "dd/MM HH:mm", { locale: ptBR })}
                                        </p>
                                      </div>
                                    ))}
                                    <div className="flex gap-2 mt-1">
                                      <Input
                                        className="h-8 text-sm"
                                        placeholder="Adicionar nota..."
                                        value={noteInput}
                                        onChange={(e) => setNoteInput(e.target.value)}
                                        onKeyDown={(e) => e.key === "Enter" && addNote(task.id)}
                                      />
                                      <Button size="sm" variant="outline" className="h-8" onClick={() => addNote(task.id)}>
                                        <MessageSquare className="h-3 w-3" />
                                      </Button>
                                    </div>
                                  </div>
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Create Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova Tarefa</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Título *</label>
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="O que precisa ser feito?" />
            </div>
            <div>
              <label className="text-sm font-medium">Descrição</label>
              <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Detalhes adicionais..." rows={2} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Prioridade</label>
                <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="urgent">Urgente</SelectItem>
                    <SelectItem value="high">Alta</SelectItem>
                    <SelectItem value="medium">Média</SelectItem>
                    <SelectItem value="low">Baixa</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium">Data</label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !form.due_date && "text-muted-foreground")}>
                      <Calendar className="h-4 w-4 mr-2" />
                      {form.due_date ? format(form.due_date, "dd/MM/yyyy") : "Hoje"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <CalendarComponent mode="single" selected={form.due_date || undefined} onSelect={(d) => setForm({ ...form, due_date: d || null })} className="p-3 pointer-events-auto" />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
            {/* Tags */}
            <div>
              <label className="text-sm font-medium">Tags</label>
              <div className="flex gap-2">
                <Input
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  placeholder="Ex: marketing, dev, vendas"
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTagToForm(); } }}
                />
                <Button type="button" variant="outline" onClick={addTagToForm}>
                  <Tag className="h-4 w-4" />
                </Button>
              </div>
              {form.tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {form.tags.map((tag) => (
                    <Badge key={tag} variant="secondary" className="gap-1 text-xs">
                      {tag}
                      <button onClick={() => setForm({ ...form, tags: form.tags.filter((t) => t !== tag) })}>
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={() => createMutation.mutate()} disabled={!form.title.trim()}>Criar Tarefa</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </EMSLayout>
  );
};

export default Tasks;
