import { useState, useEffect, useCallback } from "react";
import { EMSLayout } from "@/components/ems/EMSLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus,
  Trash2,
  Edit2,
  Save,
  X,
  ArrowDown,
  ArrowRight,
  CheckCircle2,
  XCircle,
  CircleDot,
  GitBranch,
  Route,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface RoadMapStep {
  id: string;
  label: string;
  description: string;
  status: "pending" | "success" | "failed" | "in_progress";
}

interface RoadMapPath {
  id: string;
  name: string;
  description: string;
  steps: RoadMapStep[];
  isActive: boolean;
  parentPathId: string | null;
  failedStepId: string | null;
}

interface RoadMapData {
  id: string;
  title: string;
  description: string;
  paths: RoadMapPath[];
  createdAt: string;
  updatedAt: string;
}

const STORAGE_KEY = "ems-roadmaps";

const generateId = () => crypto.randomUUID();

const getStoredRoadMaps = (): RoadMapData[] => {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
};

const saveRoadMaps = (roadmaps: RoadMapData[]) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(roadmaps));
};

const statusConfig = {
  pending: { label: "Pendente", color: "bg-muted text-muted-foreground", icon: CircleDot },
  in_progress: { label: "Em Andamento", color: "bg-primary/10 text-primary", icon: CircleDot },
  success: { label: "Sucesso", color: "bg-emerald-500/10 text-emerald-600", icon: CheckCircle2 },
  failed: { label: "Falhou", color: "bg-destructive/10 text-destructive", icon: XCircle },
};

const RoadMap = () => {
  const { toast } = useToast();
  const [roadmaps, setRoadmaps] = useState<RoadMapData[]>([]);
  const [selectedRoadmap, setSelectedRoadmap] = useState<RoadMapData | null>(null);
  const [showNewRoadmap, setShowNewRoadmap] = useState(false);
  const [newRoadmapForm, setNewRoadmapForm] = useState({ title: "", description: "" });
  const [showNewPath, setShowNewPath] = useState(false);
  const [newPathForm, setNewPathForm] = useState({ name: "", description: "" });
  const [editingStep, setEditingStep] = useState<{ pathId: string; stepId: string } | null>(null);
  const [stepForm, setStepForm] = useState({ label: "", description: "" });
  const [showNewStep, setShowNewStep] = useState<string | null>(null);
  const [newStepForm, setNewStepForm] = useState({ label: "", description: "" });
  const [branchFromStep, setBranchFromStep] = useState<{ pathId: string; stepId: string } | null>(null);
  const [branchForm, setBranchForm] = useState({ name: "", description: "" });
  const [collapsedPaths, setCollapsedPaths] = useState<Set<string>>(new Set());

  useEffect(() => {
    const stored = getStoredRoadMaps();
    setRoadmaps(stored);
    if (stored.length > 0 && !selectedRoadmap) {
      setSelectedRoadmap(stored[0]);
    }
  }, []);

  const persist = useCallback(
    (updated: RoadMapData[]) => {
      setRoadmaps(updated);
      saveRoadMaps(updated);
      if (selectedRoadmap) {
        const found = updated.find((r) => r.id === selectedRoadmap.id);
        if (found) setSelectedRoadmap(found);
      }
    },
    [selectedRoadmap]
  );

  const createRoadmap = () => {
    if (!newRoadmapForm.title.trim()) return;
    const newRoadmap: RoadMapData = {
      id: generateId(),
      title: newRoadmapForm.title,
      description: newRoadmapForm.description,
      paths: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const updated = [...roadmaps, newRoadmap];
    persist(updated);
    setSelectedRoadmap(newRoadmap);
    setNewRoadmapForm({ title: "", description: "" });
    setShowNewRoadmap(false);
    toast({ title: "RoadMap criado!" });
  };

  const deleteRoadmap = (id: string) => {
    const updated = roadmaps.filter((r) => r.id !== id);
    persist(updated);
    if (selectedRoadmap?.id === id) {
      setSelectedRoadmap(updated[0] || null);
    }
    toast({ title: "RoadMap removido!" });
  };

  const addPath = () => {
    if (!selectedRoadmap || !newPathForm.name.trim()) return;
    const newPath: RoadMapPath = {
      id: generateId(),
      name: newPathForm.name,
      description: newPathForm.description,
      steps: [],
      isActive: selectedRoadmap.paths.length === 0,
      parentPathId: null,
      failedStepId: null,
    };
    const updated = roadmaps.map((r) =>
      r.id === selectedRoadmap.id
        ? { ...r, paths: [...r.paths, newPath], updatedAt: new Date().toISOString() }
        : r
    );
    persist(updated);
    setNewPathForm({ name: "", description: "" });
    setShowNewPath(false);
    toast({ title: "Caminho adicionado!" });
  };

  const deletePath = (pathId: string) => {
    if (!selectedRoadmap) return;
    const updated = roadmaps.map((r) =>
      r.id === selectedRoadmap.id
        ? {
            ...r,
            paths: r.paths.filter((p) => p.id !== pathId && p.parentPathId !== pathId),
            updatedAt: new Date().toISOString(),
          }
        : r
    );
    persist(updated);
    toast({ title: "Caminho removido!" });
  };

  const addStep = (pathId: string) => {
    if (!selectedRoadmap || !newStepForm.label.trim()) return;
    const newStep: RoadMapStep = {
      id: generateId(),
      label: newStepForm.label,
      description: newStepForm.description,
      status: "pending",
    };
    const updated = roadmaps.map((r) =>
      r.id === selectedRoadmap.id
        ? {
            ...r,
            paths: r.paths.map((p) =>
              p.id === pathId ? { ...p, steps: [...p.steps, newStep] } : p
            ),
            updatedAt: new Date().toISOString(),
          }
        : r
    );
    persist(updated);
    setNewStepForm({ label: "", description: "" });
    setShowNewStep(null);
    toast({ title: "Etapa adicionada!" });
  };

  const updateStepStatus = (pathId: string, stepId: string, status: RoadMapStep["status"]) => {
    if (!selectedRoadmap) return;
    const updated = roadmaps.map((r) =>
      r.id === selectedRoadmap.id
        ? {
            ...r,
            paths: r.paths.map((p) =>
              p.id === pathId
                ? {
                    ...p,
                    steps: p.steps.map((s) => (s.id === stepId ? { ...s, status } : s)),
                  }
                : p
            ),
            updatedAt: new Date().toISOString(),
          }
        : r
    );
    persist(updated);
  };

  const updateStep = (pathId: string, stepId: string) => {
    if (!selectedRoadmap) return;
    const updated = roadmaps.map((r) =>
      r.id === selectedRoadmap.id
        ? {
            ...r,
            paths: r.paths.map((p) =>
              p.id === pathId
                ? {
                    ...p,
                    steps: p.steps.map((s) =>
                      s.id === stepId ? { ...s, label: stepForm.label, description: stepForm.description } : s
                    ),
                  }
                : p
            ),
            updatedAt: new Date().toISOString(),
          }
        : r
    );
    persist(updated);
    setEditingStep(null);
    toast({ title: "Etapa atualizada!" });
  };

  const deleteStep = (pathId: string, stepId: string) => {
    if (!selectedRoadmap) return;
    const updated = roadmaps.map((r) =>
      r.id === selectedRoadmap.id
        ? {
            ...r,
            paths: r.paths.map((p) =>
              p.id === pathId
                ? { ...p, steps: p.steps.filter((s) => s.id !== stepId) }
                : p
            ),
            updatedAt: new Date().toISOString(),
          }
        : r
    );
    persist(updated);
    toast({ title: "Etapa removida!" });
  };

  const createBranch = () => {
    if (!selectedRoadmap || !branchFromStep || !branchForm.name.trim()) return;
    const newPath: RoadMapPath = {
      id: generateId(),
      name: branchForm.name,
      description: branchForm.description,
      steps: [],
      isActive: true,
      parentPathId: branchFromStep.pathId,
      failedStepId: branchFromStep.stepId,
    };
    const updated = roadmaps.map((r) =>
      r.id === selectedRoadmap.id
        ? {
            ...r,
            paths: r.paths.map((p) =>
              p.id === branchFromStep.pathId ? { ...p, isActive: false } : p
            ).concat(newPath),
            updatedAt: new Date().toISOString(),
          }
        : r
    );
    persist(updated);
    setBranchFromStep(null);
    setBranchForm({ name: "", description: "" });
    toast({ title: "Caminho alternativo criado!" });
  };

  const togglePathCollapse = (pathId: string) => {
    setCollapsedPaths((prev) => {
      const next = new Set(prev);
      if (next.has(pathId)) next.delete(pathId);
      else next.add(pathId);
      return next;
    });
  };

  const getPathChildren = (pathId: string) => {
    return selectedRoadmap?.paths.filter((p) => p.parentPathId === pathId) || [];
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.1 } },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 },
  };

  const renderPath = (path: RoadMapPath, depth: number = 0) => {
    const children = getPathChildren(path.id);
    const isCollapsed = collapsedPaths.has(path.id);
    const parentPath = path.parentPathId
      ? selectedRoadmap?.paths.find((p) => p.id === path.parentPathId)
      : null;
    const failedStep = path.failedStepId && parentPath
      ? parentPath.steps.find((s) => s.id === path.failedStepId)
      : null;

    return (
      <motion.div
        key={path.id}
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        className={cn("relative", depth > 0 && "ml-6 mt-4")}
      >
        {depth > 0 && (
          <div className="absolute -left-6 top-0 bottom-0 w-px bg-border" />
        )}
        {depth > 0 && (
          <div className="absolute -left-6 top-6 w-6 h-px bg-border" />
        )}

        <Card className={cn(
          "border-2 transition-colors",
          path.isActive ? "border-primary/30 bg-primary/5" : "border-border"
        )}>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={cn(
                  "p-2 rounded-lg",
                  path.isActive ? "bg-primary/10" : "bg-muted"
                )}>
                  <Route className={cn("h-5 w-5", path.isActive ? "text-primary" : "text-muted-foreground")} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-lg">{path.name}</CardTitle>
                    {path.isActive && (
                      <Badge className="bg-primary/10 text-primary text-xs">Ativo</Badge>
                    )}
                    {!path.isActive && children.length > 0 && (
                      <Badge variant="secondary" className="text-xs">Substituído</Badge>
                    )}
                  </div>
                  {path.description && (
                    <p className="text-sm text-muted-foreground mt-0.5">{path.description}</p>
                  )}
                  {failedStep && (
                    <p className="text-xs text-destructive mt-1">
                      Alternativa criada após falha em: "{failedStep.label}"
                    </p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => togglePathCollapse(path.id)}
                >
                  {isCollapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-destructive"
                  onClick={() => deletePath(path.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardHeader>

          <AnimatePresence>
            {!isCollapsed && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <CardContent className="pt-0">
                  {/* Steps */}
                  <div className="space-y-3">
                    {path.steps.map((step, index) => {
                      const StatusIcon = statusConfig[step.status].icon;
                      const isEditing = editingStep?.pathId === path.id && editingStep?.stepId === step.id;

                      return (
                        <div key={step.id}>
                          <div className="flex items-start gap-3">
                            {/* Step connector line */}
                            <div className="flex flex-col items-center flex-shrink-0 pt-1">
                              <div className={cn(
                                "w-8 h-8 rounded-full flex items-center justify-center border-2",
                                step.status === "success" && "border-emerald-500 bg-emerald-500/10",
                                step.status === "failed" && "border-destructive bg-destructive/10",
                                step.status === "in_progress" && "border-primary bg-primary/10",
                                step.status === "pending" && "border-muted-foreground/30 bg-muted"
                              )}>
                                <StatusIcon className={cn(
                                  "h-4 w-4",
                                  step.status === "success" && "text-emerald-500",
                                  step.status === "failed" && "text-destructive",
                                  step.status === "in_progress" && "text-primary",
                                  step.status === "pending" && "text-muted-foreground"
                                )} />
                              </div>
                              {index < path.steps.length - 1 && (
                                <div className={cn(
                                  "w-0.5 h-6 mt-1",
                                  step.status === "success" ? "bg-emerald-500/50" : "bg-border"
                                )} />
                              )}
                            </div>

                            {/* Step content */}
                            <div className="flex-1 min-w-0 pb-2">
                              {isEditing ? (
                                <div className="space-y-2">
                                  <Input
                                    value={stepForm.label}
                                    onChange={(e) => setStepForm({ ...stepForm, label: e.target.value })}
                                    placeholder="Nome da etapa"
                                  />
                                  <Textarea
                                    value={stepForm.description}
                                    onChange={(e) => setStepForm({ ...stepForm, description: e.target.value })}
                                    placeholder="Descrição"
                                    rows={2}
                                  />
                                  <div className="flex gap-2">
                                    <Button size="sm" onClick={() => updateStep(path.id, step.id)}>
                                      <Save className="h-3 w-3 mr-1" /> Salvar
                                    </Button>
                                    <Button size="sm" variant="ghost" onClick={() => setEditingStep(null)}>
                                      <X className="h-3 w-3 mr-1" /> Cancelar
                                    </Button>
                                  </div>
                                </div>
                              ) : (
                                <div>
                                  <div className="flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-2">
                                      <span className="font-medium text-sm">{step.label}</span>
                                      <Badge variant="outline" className={cn("text-xs", statusConfig[step.status].color)}>
                                        {statusConfig[step.status].label}
                                      </Badge>
                                    </div>
                                    <div className="flex items-center gap-1 flex-shrink-0">
                                      <Select
                                        value={step.status}
                                        onValueChange={(value) =>
                                          updateStepStatus(path.id, step.id, value as RoadMapStep["status"])
                                        }
                                      >
                                        <SelectTrigger className="h-7 w-[120px] text-xs">
                                          <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="pending">Pendente</SelectItem>
                                          <SelectItem value="in_progress">Em Andamento</SelectItem>
                                          <SelectItem value="success">Sucesso</SelectItem>
                                          <SelectItem value="failed">Falhou</SelectItem>
                                        </SelectContent>
                                      </Select>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-7 w-7"
                                        onClick={() => {
                                          setEditingStep({ pathId: path.id, stepId: step.id });
                                          setStepForm({ label: step.label, description: step.description });
                                        }}
                                      >
                                        <Edit2 className="h-3 w-3" />
                                      </Button>
                                      {step.status === "failed" && (
                                        <Button
                                          variant="outline"
                                          size="icon"
                                          className="h-7 w-7 text-amber-500 border-amber-500/30"
                                          title="Criar caminho alternativo"
                                          onClick={() => {
                                            setBranchFromStep({ pathId: path.id, stepId: step.id });
                                            setBranchForm({ name: "", description: "" });
                                          }}
                                        >
                                          <GitBranch className="h-3 w-3" />
                                        </Button>
                                      )}
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-7 w-7 text-destructive"
                                        onClick={() => deleteStep(path.id, step.id)}
                                      >
                                        <Trash2 className="h-3 w-3" />
                                      </Button>
                                    </div>
                                  </div>
                                  {step.description && (
                                    <p className="text-xs text-muted-foreground mt-1">{step.description}</p>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Add Step */}
                  {showNewStep === path.id ? (
                    <div className="mt-4 p-3 border border-dashed rounded-lg space-y-2">
                      <Input
                        placeholder="Nome da etapa (ex: ConstruData + IRIS)"
                        value={newStepForm.label}
                        onChange={(e) => setNewStepForm({ ...newStepForm, label: e.target.value })}
                      />
                      <Textarea
                        placeholder="Descrição (opcional)"
                        value={newStepForm.description}
                        onChange={(e) => setNewStepForm({ ...newStepForm, description: e.target.value })}
                        rows={2}
                      />
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => addStep(path.id)}>
                          <Plus className="h-3 w-3 mr-1" /> Adicionar
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => {
                          setShowNewStep(null);
                          setNewStepForm({ label: "", description: "" });
                        }}>
                          Cancelar
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-4 w-full border-dashed"
                      onClick={() => setShowNewStep(path.id)}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Adicionar Etapa
                    </Button>
                  )}
                </CardContent>
              </motion.div>
            )}
          </AnimatePresence>
        </Card>

        {/* Render children paths (branches) */}
        {children.map((child) => renderPath(child, depth + 1))}
      </motion.div>
    );
  };

  const rootPaths = selectedRoadmap?.paths.filter((p) => !p.parentPathId) || [];

  return (
    <EMSLayout>
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="space-y-8"
      >
        {/* Header */}
        <motion.div variants={itemVariants} className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-heading font-bold text-foreground">RoadMap</h1>
            <p className="text-muted-foreground mt-1">
              Visualize seus caminhos estratégicos e alternativas
            </p>
          </div>
          <Button onClick={() => setShowNewRoadmap(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Novo RoadMap
          </Button>
        </motion.div>

        {/* Roadmap selector */}
        {roadmaps.length > 0 && (
          <motion.div variants={itemVariants} className="flex flex-wrap gap-2">
            {roadmaps.map((rm) => (
              <div key={rm.id} className="flex items-center gap-1">
                <Button
                  variant={selectedRoadmap?.id === rm.id ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedRoadmap(rm)}
                >
                  <Route className="h-4 w-4 mr-2" />
                  {rm.title}
                  <Badge variant="secondary" className="ml-2 text-xs">
                    {rm.paths.length}
                  </Badge>
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-destructive"
                  onClick={() => deleteRoadmap(rm.id)}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            ))}
          </motion.div>
        )}

        {/* New Roadmap dialog */}
        <Dialog open={showNewRoadmap} onOpenChange={setShowNewRoadmap}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Novo RoadMap</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <Input
                placeholder="Nome do RoadMap (ex: Carreira Profissional)"
                value={newRoadmapForm.title}
                onChange={(e) => setNewRoadmapForm({ ...newRoadmapForm, title: e.target.value })}
              />
              <Textarea
                placeholder="Descrição (opcional)"
                value={newRoadmapForm.description}
                onChange={(e) => setNewRoadmapForm({ ...newRoadmapForm, description: e.target.value })}
              />
              <div className="flex gap-2 justify-end">
                <Button variant="ghost" onClick={() => setShowNewRoadmap(false)}>
                  Cancelar
                </Button>
                <Button onClick={createRoadmap}>Criar</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Branch dialog */}
        <Dialog open={!!branchFromStep} onOpenChange={(open) => !open && setBranchFromStep(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <GitBranch className="h-5 w-5 text-amber-500" />
                Criar Caminho Alternativo
              </DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">
              Crie um novo caminho a partir da falha. O caminho atual será marcado como substituído.
            </p>
            <div className="space-y-4">
              <Input
                placeholder="Nome do caminho alternativo (ex: Cibersegurança + OSINT)"
                value={branchForm.name}
                onChange={(e) => setBranchForm({ ...branchForm, name: e.target.value })}
              />
              <Textarea
                placeholder="Descrição (opcional)"
                value={branchForm.description}
                onChange={(e) => setBranchForm({ ...branchForm, description: e.target.value })}
              />
              <div className="flex gap-2 justify-end">
                <Button variant="ghost" onClick={() => setBranchFromStep(null)}>
                  Cancelar
                </Button>
                <Button onClick={createBranch}>
                  <GitBranch className="h-4 w-4 mr-2" />
                  Criar Alternativa
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Flowchart display */}
        {selectedRoadmap ? (
          <motion.div variants={itemVariants} className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-heading font-semibold">{selectedRoadmap.title}</h2>
                {selectedRoadmap.description && (
                  <p className="text-sm text-muted-foreground">{selectedRoadmap.description}</p>
                )}
              </div>
              <Button variant="outline" size="sm" onClick={() => setShowNewPath(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Novo Caminho
              </Button>
            </div>

            {/* New Path Form */}
            <AnimatePresence>
              {showNewPath && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <Card className="border-dashed">
                    <CardContent className="pt-6 space-y-3">
                      <Input
                        placeholder="Nome do caminho (ex: Empresa ConstruData + IRIS + Administração)"
                        value={newPathForm.name}
                        onChange={(e) => setNewPathForm({ ...newPathForm, name: e.target.value })}
                      />
                      <Textarea
                        placeholder="Descrição (opcional)"
                        value={newPathForm.description}
                        onChange={(e) => setNewPathForm({ ...newPathForm, description: e.target.value })}
                      />
                      <div className="flex gap-2">
                        <Button size="sm" onClick={addPath}>
                          <Plus className="h-3 w-3 mr-1" /> Adicionar
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => {
                          setShowNewPath(false);
                          setNewPathForm({ name: "", description: "" });
                        }}>
                          Cancelar
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Paths */}
            {rootPaths.length > 0 ? (
              <div className="space-y-4">
                {rootPaths.map((path) => renderPath(path))}
              </div>
            ) : (
              <Card className="border-dashed">
                <CardContent className="py-12 text-center text-muted-foreground">
                  <Route className="h-12 w-12 mx-auto mb-4 opacity-30" />
                  <p className="text-lg font-medium mb-2">Nenhum caminho definido</p>
                  <p className="text-sm mb-4">
                    Comece adicionando seu primeiro caminho estratégico com etapas.
                  </p>
                  <Button variant="outline" onClick={() => setShowNewPath(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Adicionar Primeiro Caminho
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Legend */}
            {rootPaths.length > 0 && (
              <Card className="bg-muted/30">
                <CardContent className="pt-4 pb-3">
                  <p className="text-xs font-medium text-muted-foreground mb-2">Legenda:</p>
                  <div className="flex flex-wrap gap-4">
                    {Object.entries(statusConfig).map(([key, config]) => {
                      const Icon = config.icon;
                      return (
                        <div key={key} className="flex items-center gap-1.5">
                          <Icon className={cn("h-3.5 w-3.5", config.color.replace("bg-", "").split(" ")[1] || "text-muted-foreground")} />
                          <span className="text-xs text-muted-foreground">{config.label}</span>
                        </div>
                      );
                    })}
                    <div className="flex items-center gap-1.5">
                      <GitBranch className="h-3.5 w-3.5 text-amber-500" />
                      <span className="text-xs text-muted-foreground">Criar alternativa (ao falhar)</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </motion.div>
        ) : (
          <motion.div variants={itemVariants}>
            <Card className="border-dashed">
              <CardContent className="py-16 text-center text-muted-foreground">
                <Route className="h-16 w-16 mx-auto mb-4 opacity-20" />
                <p className="text-xl font-medium mb-2">Crie seu primeiro RoadMap</p>
                <p className="text-sm mb-6 max-w-md mx-auto">
                  Defina caminhos estratégicos com etapas. Se algo der errado, crie caminhos alternativos a partir do ponto de falha.
                </p>
                <Button onClick={() => setShowNewRoadmap(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Criar RoadMap
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </motion.div>
    </EMSLayout>
  );
};

export default RoadMap;
