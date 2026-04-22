import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { EMSLayout } from "@/components/ems/EMSLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Plus, Edit2, Trash2, Save, Upload, FileUp, ExternalLink, X, Zap, CheckCircle2,
  Clock, ListChecks, Calendar
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface ChecklistItem {
  id: string;
  text: string;
  done: boolean;
}

interface AgileStep {
  id: string;
  title: string;
  description: string | null;
  sprint_number: number | null;
  status: string;
  checklist: ChecklistItem[];
  attachment_url: string | null;
  attachment_name: string | null;
  due_date: string | null;
  completed_at: string | null;
  order_index: number;
  company_id: string | null;
}

const statusConfig: Record<string, { label: string; color: string; icon: typeof Clock }> = {
  pending: { label: "Pendente", color: "text-amber-500 bg-amber-500/10 border-amber-500/30", icon: Clock },
  in_progress: { label: "Em Andamento", color: "text-blue-500 bg-blue-500/10 border-blue-500/30", icon: Zap },
  completed: { label: "Concluído", color: "text-emerald-500 bg-emerald-500/10 border-emerald-500/30", icon: CheckCircle2 },
};

const AgileImplementation = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { selectedCompanyId } = useCompany();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<AgileStep | null>(null);
  const [uploading, setUploading] = useState(false);
  const [form, setForm] = useState({
    title: "",
    description: "",
    sprint_number: "",
    status: "pending",
    due_date: "",
    attachment_url: "",
    attachment_name: "",
    checklist: [] as ChecklistItem[],
  });
  const [newChecklistItem, setNewChecklistItem] = useState("");

  const queryKey = ["agile_implementation_steps", selectedCompanyId];

  const { data: steps = [], isLoading } = useQuery({
    queryKey,
    queryFn: async () => {
      let q = (supabase as any)
        .from("agile_implementation_steps")
        .select("*")
        .order("order_index");
      if (selectedCompanyId !== "all") q = q.eq("company_id", selectedCompanyId);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []).map((s: any) => ({
        ...s,
        checklist: Array.isArray(s.checklist) ? s.checklist : [],
      })) as AgileStep[];
    },
  });

  const resetForm = () => {
    setForm({
      title: "", description: "", sprint_number: "", status: "pending",
      due_date: "", attachment_url: "", attachment_name: "", checklist: [],
    });
    setEditing(null);
  };

  const openEdit = (step: AgileStep) => {
    setEditing(step);
    setForm({
      title: step.title,
      description: step.description || "",
      sprint_number: step.sprint_number?.toString() || "",
      status: step.status,
      due_date: step.due_date || "",
      attachment_url: step.attachment_url || "",
      attachment_name: step.attachment_name || "",
      checklist: step.checklist || [],
    });
    setDialogOpen(true);
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload: any = {
        title: form.title,
        description: form.description || null,
        sprint_number: form.sprint_number ? parseInt(form.sprint_number) : null,
        status: form.status,
        due_date: form.due_date || null,
        completed_at: form.status === "completed" ? new Date().toISOString() : null,
        attachment_url: form.attachment_url || null,
        attachment_name: form.attachment_name || null,
        checklist: form.checklist,
        company_id: selectedCompanyId !== "all" ? selectedCompanyId : null,
      };
      if (editing) {
        const { error } = await (supabase as any)
          .from("agile_implementation_steps")
          .update(payload)
          .eq("id", editing.id);
        if (error) throw error;
      } else {
        payload.order_index = steps.length;
        const { error } = await (supabase as any).from("agile_implementation_steps").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      setDialogOpen(false);
      resetForm();
      toast({ title: editing ? "Etapa atualizada!" : "Etapa criada!" });
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("agile_implementation_steps").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast({ title: "Etapa removida" });
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await (supabase as any)
        .from("agile_implementation_steps")
        .update({
          status,
          completed_at: status === "completed" ? new Date().toISOString() : null,
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  const updateChecklistMutation = useMutation({
    mutationFn: async ({ id, checklist }: { id: string; checklist: ChecklistItem[] }) => {
      const { error } = await (supabase as any)
        .from("agile_implementation_steps")
        .update({ checklist })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  const handleFileUpload = async (file: File) => {
    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `agile-implementation/${Date.now()}-${Math.random().toString(36).substring(7)}.${ext}`;
      const { error: upErr } = await supabase.storage.from("attachments").upload(path, file);
      if (upErr) throw upErr;
      const { data: urlData } = supabase.storage.from("attachments").getPublicUrl(path);
      setForm((f) => ({ ...f, attachment_url: urlData.publicUrl, attachment_name: file.name }));
      toast({ title: "Arquivo enviado!" });
    } catch (e: any) {
      toast({ title: "Erro upload", description: e.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const addChecklistItemToForm = () => {
    if (!newChecklistItem.trim()) return;
    setForm({
      ...form,
      checklist: [...form.checklist, { id: crypto.randomUUID(), text: newChecklistItem.trim(), done: false }],
    });
    setNewChecklistItem("");
  };

  const toggleChecklistItem = (step: AgileStep, itemId: string) => {
    const updated = step.checklist.map((c) =>
      c.id === itemId ? { ...c, done: !c.done } : c
    );
    updateChecklistMutation.mutate({ id: step.id, checklist: updated });
  };

  const totalSteps = steps.length;
  const completedSteps = steps.filter((s) => s.status === "completed").length;
  const inProgressSteps = steps.filter((s) => s.status === "in_progress").length;
  const overallProgress = totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0;

  return (
    <EMSLayout>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-4 md:p-6 max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl md:text-3xl font-heading font-bold text-foreground flex items-center gap-2">
              <div className="p-2 rounded-xl bg-primary/10"><Zap className="h-6 w-6 text-primary" /></div>
              Implementação Ágil
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Gerencie sprints, etapas e checklists com anexos
            </p>
          </div>
          <Button onClick={() => { resetForm(); setDialogOpen(true); }} className="gap-2">
            <Plus className="h-4 w-4" /> Nova Etapa
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Total</p>
              <p className="text-2xl font-bold font-mono">{totalSteps}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Em Andamento</p>
              <p className="text-2xl font-bold font-mono text-blue-500">{inProgressSteps}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Concluídas</p>
              <p className="text-2xl font-bold font-mono text-emerald-500">{completedSteps}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs text-muted-foreground">Progresso</p>
                <span className="text-xs font-mono font-bold text-primary">{overallProgress}%</span>
              </div>
              <Progress value={overallProgress} className="h-2" />
            </CardContent>
          </Card>
        </div>

        {/* Steps List */}
        {isLoading ? (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => <div key={i} className="h-32 rounded-xl bg-muted/30 animate-pulse" />)}
          </div>
        ) : steps.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="py-16 text-center">
              <Zap className="h-12 w-12 mx-auto mb-3 text-muted-foreground/50" />
              <p className="text-muted-foreground font-medium">Nenhuma etapa cadastrada</p>
              <p className="text-xs text-muted-foreground mt-1 mb-4">
                Comece criando a primeira etapa do seu processo de implementação ágil
              </p>
              <Button onClick={() => { resetForm(); setDialogOpen(true); }}>
                <Plus className="h-4 w-4 mr-2" /> Criar primeira etapa
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            <AnimatePresence>
              {steps.map((step, idx) => {
                const sConf = statusConfig[step.status] || statusConfig.pending;
                const SIcon = sConf.icon;
                const checklistDone = step.checklist?.filter((c) => c.done).length || 0;
                const checklistTotal = step.checklist?.length || 0;
                const checklistProgress = checklistTotal > 0 ? Math.round((checklistDone / checklistTotal) * 100) : 0;
                return (
                  <motion.div
                    key={step.id}
                    layout
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                  >
                    <Card className={cn("border-l-[3px]", sConf.color.split(" ")[2].replace("border-", "border-l-"))}>
                      <CardContent className="p-4 space-y-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap mb-1">
                              {step.sprint_number && (
                                <Badge variant="secondary" className="text-[10px]">Sprint {step.sprint_number}</Badge>
                              )}
                              <Badge variant="outline" className="text-[10px]">#{idx + 1}</Badge>
                              <Badge variant="outline" className={cn("text-[10px] gap-1", sConf.color)}>
                                <SIcon className="h-3 w-3" /> {sConf.label}
                              </Badge>
                              {step.due_date && (
                                <Badge variant="outline" className="text-[10px] gap-1">
                                  <Calendar className="h-3 w-3" />
                                  {format(new Date(step.due_date + "T12:00:00"), "dd/MM/yyyy", { locale: ptBR })}
                                </Badge>
                              )}
                            </div>
                            <h3 className="font-semibold text-base">{step.title}</h3>
                            {step.description && (
                              <p className="text-xs text-muted-foreground mt-1">{step.description}</p>
                            )}
                          </div>
                          <div className="flex gap-1 shrink-0">
                            <Select value={step.status} onValueChange={(v) => updateStatusMutation.mutate({ id: step.id, status: v })}>
                              <SelectTrigger className="h-8 w-[130px] text-xs"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="pending">Pendente</SelectItem>
                                <SelectItem value="in_progress">Em Andamento</SelectItem>
                                <SelectItem value="completed">Concluída</SelectItem>
                              </SelectContent>
                            </Select>
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(step)}>
                              <Edit2 className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-destructive"
                              onClick={() => deleteMutation.mutate(step.id)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>

                        {/* Checklist */}
                        {step.checklist?.length > 0 && (
                          <div className="bg-muted/30 rounded-lg p-3 space-y-1.5">
                            <div className="flex items-center justify-between mb-1">
                              <p className="text-xs font-semibold flex items-center gap-1">
                                <ListChecks className="h-3.5 w-3.5" /> Checklist ({checklistDone}/{checklistTotal})
                              </p>
                              <span className="text-xs font-mono">{checklistProgress}%</span>
                            </div>
                            <Progress value={checklistProgress} className="h-1 mb-2" />
                            {step.checklist.map((c) => (
                              <div key={c.id} className="flex items-center gap-2">
                                <Checkbox
                                  checked={c.done}
                                  onCheckedChange={() => toggleChecklistItem(step, c.id)}
                                />
                                <span className={cn("text-xs", c.done && "line-through text-muted-foreground")}>
                                  {c.text}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}

                        {step.attachment_url && (
                          <a
                            href={step.attachment_url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                          >
                            <FileUp className="h-3 w-3" /> {step.attachment_name || "Anexo"}
                            <ExternalLink className="h-2.5 w-2.5" />
                          </a>
                        )}
                      </CardContent>
                    </Card>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </motion.div>

      {/* Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) resetForm(); }}>
        <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar Etapa" : "Nova Etapa Ágil"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-2">
                <Label className="text-xs">Título *</Label>
                <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="mt-1" />
              </div>
              <div>
                <Label className="text-xs">Sprint #</Label>
                <Input
                  type="number"
                  value={form.sprint_number}
                  onChange={(e) => setForm({ ...form, sprint_number: e.target.value })}
                  className="mt-1"
                  placeholder="1"
                />
              </div>
            </div>
            <div>
              <Label className="text-xs">Descrição</Label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={2}
                className="mt-1"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Status</Label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pendente</SelectItem>
                    <SelectItem value="in_progress">Em Andamento</SelectItem>
                    <SelectItem value="completed">Concluída</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Data Limite</Label>
                <Input
                  type="date"
                  value={form.due_date}
                  onChange={(e) => setForm({ ...form, due_date: e.target.value })}
                  className="mt-1"
                />
              </div>
            </div>
            <div>
              <Label className="text-xs">Checklist</Label>
              <div className="flex gap-2 mt-1">
                <Input
                  value={newChecklistItem}
                  onChange={(e) => setNewChecklistItem(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addChecklistItemToForm(); } }}
                  placeholder="Adicionar item ao checklist"
                />
                <Button type="button" variant="outline" onClick={addChecklistItemToForm}>+</Button>
              </div>
              {form.checklist.length > 0 && (
                <div className="mt-2 space-y-1.5 bg-muted/20 rounded-lg p-2">
                  {form.checklist.map((c, idx) => (
                    <div key={c.id} className="flex items-center gap-2 text-xs">
                      <span className="text-muted-foreground">{idx + 1}.</span>
                      <span className="flex-1">{c.text}</span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => setForm({ ...form, checklist: form.checklist.filter((x) => x.id !== c.id) })}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div>
              <Label className="text-xs">Anexo</Label>
              {form.attachment_url ? (
                <div className="flex items-center justify-between gap-2 mt-1 p-2 bg-muted/30 rounded-lg border">
                  <a href={form.attachment_url} target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline truncate flex-1">
                    <FileUp className="h-3 w-3 inline mr-1" /> {form.attachment_name}
                  </a>
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setForm({ ...form, attachment_url: "", attachment_name: "" })}>
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ) : (
                <div className="mt-1">
                  <input
                    id="agile-file"
                    type="file"
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileUpload(f); }}
                    className="hidden"
                    accept=".pdf,.doc,.docx,.xls,.xlsx,image/*"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => document.getElementById("agile-file")?.click()}
                    disabled={uploading}
                    className="w-full gap-2"
                  >
                    <Upload className="h-4 w-4" />
                    {uploading ? "Enviando..." : "Selecionar arquivo"}
                  </Button>
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button
              onClick={() => saveMutation.mutate()}
              disabled={!form.title.trim() || saveMutation.isPending}
              className="gap-2"
            >
              <Save className="h-4 w-4" />
              {saveMutation.isPending ? "Salvando..." : "Salvar Etapa"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </EMSLayout>
  );
};

export default AgileImplementation;
