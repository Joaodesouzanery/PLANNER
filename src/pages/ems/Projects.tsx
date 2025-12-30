import { useState, useEffect } from "react";
import { EMSLayout } from "@/components/ems/EMSLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { motion, AnimatePresence, Reorder } from "framer-motion";
import {
  Plus,
  LayoutGrid,
  GanttChart,
  Trash2,
  Edit2,
  CheckCircle,
  Calendar,
  X,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Project {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  due_date: string | null;
  created_at: string;
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

const Projects = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [view, setView] = useState<"kanban" | "timeline">("kanban");
  const [projects, setProjects] = useState<Project[]>([]);
  const [columns, setColumns] = useState<KanbanColumn[]>(defaultColumns);
  const [showAddProject, setShowAddProject] = useState(false);
  const [showExecutionModal, setShowExecutionModal] = useState(false);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [showColumnModal, setShowColumnModal] = useState(false);
  const [newColumnTitle, setNewColumnTitle] = useState("");
  
  const [projectForm, setProjectForm] = useState({
    title: "",
    description: "",
    priority: "medium",
    due_date: "",
  });

  const [executionForm, setExecutionForm] = useState<ExecutionRecord>({
    action_taken: "",
    result_obtained: "",
    lessons_learned: "",
    tags: [],
  });
  const [tagInput, setTagInput] = useState("");

  useEffect(() => {
    if (user) {
      fetchProjects();
      fetchColumns();
    }
  }, [user]);

  const fetchProjects = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("projects")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    if (data) setProjects(data);
  };

  const fetchColumns = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("kanban_columns")
      .select("*")
      .eq("user_id", user.id)
      .order("order_index");
    if (data && data.length > 0) {
      setColumns(data);
    }
  };

  const handleAddProject = async () => {
    if (!user || !projectForm.title) return;
    
    await supabase.from("projects").insert({
      title: projectForm.title,
      description: projectForm.description || null,
      priority: projectForm.priority,
      due_date: projectForm.due_date || null,
      status: "todo",
      user_id: user.id,
    });

    setProjectForm({ title: "", description: "", priority: "medium", due_date: "" });
    setShowAddProject(false);
    fetchProjects();
    toast({ title: "Projeto criado!" });
  };

  const handleUpdateProject = async () => {
    if (!editingProject) return;
    
    await supabase
      .from("projects")
      .update({
        title: projectForm.title,
        description: projectForm.description,
        priority: projectForm.priority,
        due_date: projectForm.due_date || null,
      })
      .eq("id", editingProject.id);

    setEditingProject(null);
    setProjectForm({ title: "", description: "", priority: "medium", due_date: "" });
    fetchProjects();
    toast({ title: "Projeto atualizado!" });
  };

  const handleDeleteProject = async (id: string) => {
    await supabase.from("projects").delete().eq("id", id);
    fetchProjects();
    toast({ title: "Projeto removido!" });
  };

  const handleMoveProject = async (projectId: string, newStatus: string) => {
    const project = projects.find(p => p.id === projectId);
    if (!project) return;

    // If moving to done, open execution modal
    if (newStatus === "done" && project.status !== "done") {
      setSelectedProject(project);
      setShowExecutionModal(true);
      return;
    }

    await supabase
      .from("projects")
      .update({ status: newStatus })
      .eq("id", projectId);

    fetchProjects();
  };

  const handleCompleteWithExecution = async () => {
    if (!selectedProject || !user) return;
    if (!executionForm.action_taken || !executionForm.result_obtained || !executionForm.lessons_learned) {
      toast({ title: "Preencha todos os campos obrigatórios", variant: "destructive" });
      return;
    }

    // Save execution record
    await supabase.from("execution_records").insert({
      project_id: selectedProject.id,
      action_taken: executionForm.action_taken,
      result_obtained: executionForm.result_obtained,
      lessons_learned: executionForm.lessons_learned,
      tags: executionForm.tags,
      user_id: user.id,
    });

    // Update project status
    await supabase
      .from("projects")
      .update({ status: "done" })
      .eq("id", selectedProject.id);

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

  const addColumn = async () => {
    if (!user || !newColumnTitle) return;
    await supabase.from("kanban_columns").insert({
      title: newColumnTitle,
      order_index: columns.length,
      user_id: user.id,
    });
    setNewColumnTitle("");
    setShowColumnModal(false);
    fetchColumns();
    toast({ title: "Coluna adicionada!" });
  };

  const deleteColumn = async (columnId: string) => {
    await supabase.from("kanban_columns").delete().eq("id", columnId);
    fetchColumns();
    toast({ title: "Coluna removida!" });
  };

  const getProjectsByStatus = (status: string) => projects.filter(p => p.status === status);

  const priorityColors: Record<string, string> = {
    low: "bg-muted text-muted-foreground",
    medium: "bg-amber-500/10 text-amber-500",
    high: "bg-destructive/10 text-destructive",
  };

  return (
    <EMSLayout>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-6"
      >
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-heading font-bold text-foreground">Gestão de Projetos</h1>
            <p className="text-muted-foreground mt-1">Gerencie suas tarefas e projetos</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setShowColumnModal(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Coluna
            </Button>
            <Button onClick={() => setShowAddProject(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Novo Projeto
            </Button>
          </div>
        </div>

        {/* View Toggle */}
        <Tabs value={view} onValueChange={(v) => setView(v as "kanban" | "timeline")}>
          <TabsList>
            <TabsTrigger value="kanban" className="gap-2">
              <LayoutGrid className="h-4 w-4" />
              Kanban
            </TabsTrigger>
            <TabsTrigger value="timeline" className="gap-2">
              <GanttChart className="h-4 w-4" />
              Timeline
            </TabsTrigger>
          </TabsList>

          <TabsContent value="kanban" className="mt-6">
            <div className="flex gap-4 overflow-x-auto pb-4">
              {columns.map((column) => (
                <div key={column.id} className="flex-shrink-0 w-80">
                  <Card className="bg-card/50">
                    <CardHeader className="py-3 px-4 flex flex-row items-center justify-between">
                      <CardTitle className="text-sm font-medium">{column.title}</CardTitle>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="text-xs">
                          {getProjectsByStatus(column.id).length}
                        </Badge>
                        {!defaultColumns.find(c => c.id === column.id) && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => deleteColumn(column.id)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent className="p-2 space-y-2 min-h-[200px]">
                      <AnimatePresence mode="popLayout">
                        {getProjectsByStatus(column.id).map((project) => (
                          <motion.div
                            key={project.id}
                            layout
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.8 }}
                            className="bg-card border border-border rounded-lg p-3 cursor-pointer hover:border-primary/30 transition-colors"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <h4 className="font-medium text-sm">{project.title}</h4>
                              <div className="flex gap-1">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6"
                                  onClick={() => {
                                    setEditingProject(project);
                                    setProjectForm({
                                      title: project.title,
                                      description: project.description || "",
                                      priority: project.priority,
                                      due_date: project.due_date || "",
                                    });
                                  }}
                                >
                                  <Edit2 className="h-3 w-3" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6 text-destructive"
                                  onClick={() => handleDeleteProject(project.id)}
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                            </div>
                            {project.description && (
                              <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                                {project.description}
                              </p>
                            )}
                            <div className="flex items-center gap-2 mt-3">
                              <Badge className={priorityColors[project.priority]} variant="secondary">
                                {project.priority === "low" ? "Baixa" : project.priority === "medium" ? "Média" : "Alta"}
                              </Badge>
                              {project.due_date && (
                                <span className="text-xs text-muted-foreground flex items-center gap-1">
                                  <Calendar className="h-3 w-3" />
                                  {format(new Date(project.due_date), "dd MMM", { locale: ptBR })}
                                </span>
                              )}
                            </div>
                            {column.id !== "done" && (
                              <div className="mt-3 flex gap-1">
                                {columns
                                  .filter(c => c.id !== column.id)
                                  .map(c => (
                                    <Button
                                      key={c.id}
                                      variant="ghost"
                                      size="sm"
                                      className="text-xs h-7"
                                      onClick={() => handleMoveProject(project.id, c.id)}
                                    >
                                      → {c.title}
                                    </Button>
                                  ))}
                              </div>
                            )}
                            {column.id !== "done" && (
                              <Button
                                variant="outline"
                                size="sm"
                                className="w-full mt-2 text-xs gap-1"
                                onClick={() => handleMoveProject(project.id, "done")}
                              >
                                <CheckCircle className="h-3 w-3" />
                                Concluir
                              </Button>
                            )}
                          </motion.div>
                        ))}
                      </AnimatePresence>
                    </CardContent>
                  </Card>
                </div>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="timeline" className="mt-6">
            <Card>
              <CardContent className="p-6">
                <div className="space-y-4">
                  {projects
                    .filter(p => p.due_date)
                    .sort((a, b) => new Date(a.due_date!).getTime() - new Date(b.due_date!).getTime())
                    .map((project, index) => (
                      <motion.div
                        key={project.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.05 }}
                        className="flex items-center gap-4 p-4 border border-border rounded-lg"
                      >
                        <div className="flex-shrink-0 w-24 text-center">
                          <p className="text-sm font-medium">
                            {format(new Date(project.due_date!), "dd MMM", { locale: ptBR })}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(project.due_date!), "yyyy")}
                          </p>
                        </div>
                        <div className="w-px h-12 bg-border" />
                        <div className="flex-1">
                          <h4 className="font-medium">{project.title}</h4>
                          {project.description && (
                            <p className="text-sm text-muted-foreground">{project.description}</p>
                          )}
                        </div>
                        <Badge className={priorityColors[project.priority]} variant="secondary">
                          {project.status === "done" ? "Concluído" : project.status === "in_progress" ? "Em Progresso" : "A Fazer"}
                        </Badge>
                      </motion.div>
                    ))}
                  {projects.filter(p => p.due_date).length === 0 && (
                    <p className="text-center text-muted-foreground py-8">
                      Nenhum projeto com data de entrega definida.
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Add Project Dialog */}
        <Dialog open={showAddProject || !!editingProject} onOpenChange={(open) => {
          if (!open) {
            setShowAddProject(false);
            setEditingProject(null);
            setProjectForm({ title: "", description: "", priority: "medium", due_date: "" });
          }
        }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingProject ? "Editar Projeto" : "Novo Projeto"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <Label>Título</Label>
                <Input
                  value={projectForm.title}
                  onChange={(e) => setProjectForm({ ...projectForm, title: e.target.value })}
                  placeholder="Nome do projeto"
                />
              </div>
              <div>
                <Label>Descrição</Label>
                <Textarea
                  value={projectForm.description}
                  onChange={(e) => setProjectForm({ ...projectForm, description: e.target.value })}
                  placeholder="Descrição do projeto"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Prioridade</Label>
                  <select
                    value={projectForm.priority}
                    onChange={(e) => setProjectForm({ ...projectForm, priority: e.target.value })}
                    className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="low">Baixa</option>
                    <option value="medium">Média</option>
                    <option value="high">Alta</option>
                  </select>
                </div>
                <div>
                  <Label>Data de Entrega</Label>
                  <Input
                    type="date"
                    value={projectForm.due_date}
                    onChange={(e) => setProjectForm({ ...projectForm, due_date: e.target.value })}
                  />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => {
                setShowAddProject(false);
                setEditingProject(null);
              }}>
                Cancelar
              </Button>
              <Button onClick={editingProject ? handleUpdateProject : handleAddProject}>
                {editingProject ? "Salvar" : "Criar"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Execution Record Modal */}
        <Dialog open={showExecutionModal} onOpenChange={setShowExecutionModal}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-primary" />
                Registro de Execução
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <p className="text-sm text-muted-foreground">
                Complete o registro para arquivar este projeto na Knowledge Base.
              </p>
              <div>
                <Label>Ação Realizada *</Label>
                <Textarea
                  value={executionForm.action_taken}
                  onChange={(e) => setExecutionForm({ ...executionForm, action_taken: e.target.value })}
                  placeholder="O que foi feito para concluir este projeto?"
                />
              </div>
              <div>
                <Label>Resultado Obtido *</Label>
                <Textarea
                  value={executionForm.result_obtained}
                  onChange={(e) => setExecutionForm({ ...executionForm, result_obtained: e.target.value })}
                  placeholder="Quais métricas ou resultados foram alcançados?"
                />
              </div>
              <div>
                <Label>Lições Aprendidas *</Label>
                <Textarea
                  value={executionForm.lessons_learned}
                  onChange={(e) => setExecutionForm({ ...executionForm, lessons_learned: e.target.value })}
                  placeholder="O que você aprendeu com este projeto?"
                />
              </div>
              <div>
                <Label>Tags</Label>
                <div className="flex gap-2">
                  <Input
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    placeholder="Adicionar tag"
                    onKeyPress={(e) => e.key === "Enter" && (e.preventDefault(), addTag())}
                  />
                  <Button type="button" variant="outline" onClick={addTag}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                {executionForm.tags.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {executionForm.tags.map((tag) => (
                      <Badge key={tag} variant="secondary" className="gap-1">
                        {tag}
                        <button onClick={() => removeTag(tag)}>
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowExecutionModal(false)}>
                Cancelar
              </Button>
              <Button onClick={handleCompleteWithExecution}>
                Concluir e Registrar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Add Column Modal */}
        <Dialog open={showColumnModal} onOpenChange={setShowColumnModal}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nova Coluna</DialogTitle>
            </DialogHeader>
            <div className="py-4">
              <Label>Nome da Coluna</Label>
              <Input
                value={newColumnTitle}
                onChange={(e) => setNewColumnTitle(e.target.value)}
                placeholder="Ex: Em Revisão"
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowColumnModal(false)}>
                Cancelar
              </Button>
              <Button onClick={addColumn}>Criar Coluna</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </motion.div>
    </EMSLayout>
  );
};

export default Projects;
