import { useState, useEffect, useMemo } from "react";
import { EMSLayout } from "@/components/ems/EMSLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { motion } from "framer-motion";
import {
  GraduationCap, Plus, Trash2, Edit2, Calendar, BookOpen,
  AlertTriangle, CheckCircle, Clock, Star, ChevronDown, ChevronUp,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format, differenceInDays, isPast, isToday } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface Disciplina {
  id: string;
  name: string;
  professor: string | null;
  color: string;
  notes: string | null;
  created_at: string;
}

interface Prova {
  id: string;
  disciplina_id: string;
  title: string;
  exam_date: string;
  priority: string;
  status: string;
  notes: string | null;
  grade: number | null;
  created_at: string;
}

const COLORS = [
  { value: "blue", label: "Azul", dot: "bg-blue-400", text: "text-blue-400", badge: "bg-blue-500/10 text-blue-400 border-blue-500/30" },
  { value: "purple", label: "Roxo", dot: "bg-purple-400", text: "text-purple-400", badge: "bg-purple-500/10 text-purple-400 border-purple-500/30" },
  { value: "emerald", label: "Verde", dot: "bg-emerald-400", text: "text-emerald-400", badge: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30" },
  { value: "amber", label: "Âmbar", dot: "bg-amber-400", text: "text-amber-400", badge: "bg-amber-500/10 text-amber-400 border-amber-500/30" },
  { value: "pink", label: "Rosa", dot: "bg-pink-400", text: "text-pink-400", badge: "bg-pink-500/10 text-pink-400 border-pink-500/30" },
  { value: "cyan", label: "Ciano", dot: "bg-cyan-400", text: "text-cyan-400", badge: "bg-cyan-500/10 text-cyan-400 border-cyan-500/30" },
];

const getColor = (color: string) => COLORS.find(c => c.value === color) || COLORS[0];

const priorityConfig: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  low: { label: "Baixa", color: "text-blue-400 bg-blue-500/10 border-blue-500/30", icon: <Star className="h-3 w-3" /> },
  medium: { label: "Média", color: "text-amber-400 bg-amber-500/10 border-amber-500/30", icon: <Star className="h-3 w-3" /> },
  high: { label: "Alta", color: "text-red-400 bg-red-500/10 border-red-500/30", icon: <AlertTriangle className="h-3 w-3" /> },
};

const statusConfig: Record<string, { label: string; color: string }> = {
  pending: { label: "Pendente", color: "text-muted-foreground bg-muted/50 border-border/50" },
  studying: { label: "Estudando", color: "text-amber-400 bg-amber-500/10 border-amber-500/30" },
  done: { label: "Concluída", color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/30" },
};

const getDaysLabel = (dateStr: string, status: string) => {
  if (status === "done") return null;
  const d = new Date(dateStr);
  if (isToday(d)) return { label: "Hoje!", urgent: true };
  if (isPast(d)) return { label: "Passou", urgent: true };
  const days = differenceInDays(d, new Date());
  if (days <= 7) return { label: `${days}d`, urgent: true };
  return { label: `${days}d`, urgent: false };
};

const Faculdade = () => {
  const { toast } = useToast();
  const [disciplinas, setDisciplinas] = useState<Disciplina[]>([]);
  const [provas, setProvas] = useState<Prova[]>([]);
  const [expandedDisciplinas, setExpandedDisciplinas] = useState<Set<string>>(new Set());

  // Dialogs
  const [showDiscDialog, setShowDiscDialog] = useState(false);
  const [editingDisc, setEditingDisc] = useState<Disciplina | null>(null);
  const [discForm, setDiscForm] = useState({ name: "", professor: "", color: "blue", notes: "" });

  const [showProvaDialog, setShowProvaDialog] = useState(false);
  const [editingProva, setEditingProva] = useState<Prova | null>(null);
  const [provaForm, setProvaForm] = useState({ disciplina_id: "", title: "", exam_date: "", priority: "medium", status: "pending", notes: "", grade: "" });

  const fetchDisciplinas = async () => {
    const { data } = await supabase.from("faculdade_disciplinas").select("*").order("name");
    if (data) setDisciplinas(data as Disciplina[]);
  };

  const fetchProvas = async () => {
    const { data } = await supabase.from("faculdade_provas").select("*").order("exam_date");
    if (data) setProvas(data as Prova[]);
  };

  useEffect(() => {
    fetchDisciplinas();
    fetchProvas();
  }, []);

  // Stats
  const stats = useMemo(() => {
    const upcoming = provas.filter(p => p.status !== "done");
    const urgent = upcoming.filter(p => {
      const days = differenceInDays(new Date(p.exam_date), new Date());
      return days <= 7;
    });
    const done = provas.filter(p => p.status === "done");
    const grades = done.filter(p => p.grade !== null).map(p => p.grade!);
    const avg = grades.length > 0 ? grades.reduce((a, b) => a + b, 0) / grades.length : null;
    return { total: provas.length, upcoming: upcoming.length, urgent: urgent.length, done: done.length, avg };
  }, [provas]);

  // Disciplina CRUD
  const openAddDisc = () => { setEditingDisc(null); setDiscForm({ name: "", professor: "", color: "blue", notes: "" }); setShowDiscDialog(true); };
  const openEditDisc = (d: Disciplina) => { setEditingDisc(d); setDiscForm({ name: d.name, professor: d.professor || "", color: d.color, notes: d.notes || "" }); setShowDiscDialog(true); };

  const saveDisc = async () => {
    if (!discForm.name.trim()) { toast({ title: "Nome é obrigatório", variant: "destructive" }); return; }
    if (editingDisc) {
      await supabase.from("faculdade_disciplinas").update({ name: discForm.name, professor: discForm.professor || null, color: discForm.color, notes: discForm.notes || null }).eq("id", editingDisc.id);
      toast({ title: "Disciplina atualizada!" });
    } else {
      await supabase.from("faculdade_disciplinas").insert({ name: discForm.name, professor: discForm.professor || null, color: discForm.color, notes: discForm.notes || null });
      toast({ title: "Disciplina criada!" });
    }
    setShowDiscDialog(false);
    fetchDisciplinas();
  };

  const deleteDisc = async (id: string) => {
    await supabase.from("faculdade_disciplinas").delete().eq("id", id);
    fetchDisciplinas();
    fetchProvas();
    toast({ title: "Disciplina removida!" });
  };

  // Prova CRUD
  const openAddProva = (discId?: string) => {
    setEditingProva(null);
    setProvaForm({ disciplina_id: discId || "", title: "", exam_date: "", priority: "medium", status: "pending", notes: "", grade: "" });
    setShowProvaDialog(true);
  };
  const openEditProva = (p: Prova) => {
    setEditingProva(p);
    setProvaForm({ disciplina_id: p.disciplina_id, title: p.title, exam_date: p.exam_date, priority: p.priority, status: p.status, notes: p.notes || "", grade: p.grade !== null ? String(p.grade) : "" });
    setShowProvaDialog(true);
  };

  const saveProva = async () => {
    if (!provaForm.title.trim() || !provaForm.exam_date || !provaForm.disciplina_id) {
      toast({ title: "Disciplina, título e data são obrigatórios", variant: "destructive" }); return;
    }
    const payload = {
      disciplina_id: provaForm.disciplina_id, title: provaForm.title, exam_date: provaForm.exam_date,
      priority: provaForm.priority, status: provaForm.status, notes: provaForm.notes || null,
      grade: provaForm.grade !== "" ? parseFloat(provaForm.grade) : null,
    };
    if (editingProva) {
      await supabase.from("faculdade_provas").update(payload).eq("id", editingProva.id);
      toast({ title: "Prova atualizada!" });
    } else {
      await supabase.from("faculdade_provas").insert(payload);
      toast({ title: "Prova adicionada!" });
    }
    setShowProvaDialog(false);
    fetchProvas();
  };

  const deleteProva = async (id: string) => {
    await supabase.from("faculdade_provas").delete().eq("id", id);
    fetchProvas();
    toast({ title: "Prova removida!" });
  };

  const toggleExpand = (id: string) => {
    setExpandedDisciplinas(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  // All provas sorted by date for the "Provas" tab
  const provasSorted = [...provas].sort((a, b) => new Date(a.exam_date).getTime() - new Date(b.exam_date).getTime());

  return (
    <EMSLayout>
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-4 md:space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-3">
          <div>
            <h1 className="text-xl md:text-3xl font-heading font-bold text-foreground flex items-center gap-2">
              <div className="p-2 rounded-xl bg-primary/10"><GraduationCap className="h-5 w-5 md:h-6 md:w-6 text-primary" /></div>
              Faculdade
            </h1>
            <p className="text-xs md:text-base text-muted-foreground mt-1">Acompanhe disciplinas, provas e prioridades de estudo</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button size="sm" variant="outline" onClick={openAddDisc} className="text-xs md:text-sm">
              <Plus className="h-3.5 w-3.5 mr-1.5" />Disciplina
            </Button>
            <Button size="sm" onClick={() => openAddProva()} className="text-xs md:text-sm">
              <Plus className="h-3.5 w-3.5 mr-1.5" />Nova Prova
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2 md:gap-3">
          {[
            { label: "Total de Provas", value: stats.total, icon: BookOpen, color: "text-primary", gradient: "from-primary/10 to-primary/5" },
            { label: "Pendentes", value: stats.upcoming, icon: Clock, color: "text-amber-400", gradient: "from-amber-500/10 to-amber-500/5" },
            { label: "Urgentes (≤7d)", value: stats.urgent, icon: AlertTriangle, color: "text-red-400", gradient: "from-red-500/10 to-red-500/5" },
            { label: "Concluídas", value: stats.done, icon: CheckCircle, color: "text-emerald-400", gradient: "from-emerald-500/10 to-emerald-500/5" },
            { label: "Média Geral", value: stats.avg !== null ? stats.avg.toFixed(1) : "—", icon: Star, color: "text-purple-400", gradient: "from-purple-500/10 to-purple-500/5" },
          ].map((s, i) => (
            <motion.div key={s.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className={i === 4 ? "col-span-2 md:col-span-1" : ""}>
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
        </div>

        {/* Tabs */}
        <Tabs defaultValue="provas" className="space-y-4">
          <TabsList className="w-full sm:w-auto">
            <TabsTrigger value="provas" className="gap-1.5 text-xs md:text-sm flex-1 sm:flex-none"><Calendar className="h-3.5 w-3.5" />Provas</TabsTrigger>
            <TabsTrigger value="disciplinas" className="gap-1.5 text-xs md:text-sm flex-1 sm:flex-none"><BookOpen className="h-3.5 w-3.5" />Disciplinas</TabsTrigger>
          </TabsList>

          {/* Provas tab */}
          <TabsContent value="provas" className="space-y-2 mt-4">
            {provasSorted.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <div className="p-4 rounded-full bg-muted/40 w-fit mx-auto mb-3">
                  <Calendar className="h-7 w-7 text-muted-foreground/50" />
                </div>
                <p className="text-sm">Nenhuma prova cadastrada.</p>
                <p className="text-xs mt-1">Crie uma disciplina e adicione suas provas.</p>
              </div>
            ) : provasSorted.map((prova, i) => {
              const disc = disciplinas.find(d => d.id === prova.disciplina_id);
              const c = disc ? getColor(disc.color) : COLORS[0];
              const pCfg = priorityConfig[prova.priority] || priorityConfig.medium;
              const sCfg = statusConfig[prova.status] || statusConfig.pending;
              const daysInfo = getDaysLabel(prova.exam_date, prova.status);

              return (
                <motion.div key={prova.id} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }}>
                  <Card className={cn("border-border/50 bg-card/60 hover:bg-card/80 transition-colors", prova.status === "done" && "opacity-60")}>
                    <CardContent className="p-3 md:p-4">
                      <div className="flex items-start gap-3">
                        <div className={cn("w-1 self-stretch rounded-full shrink-0", c.dot)} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <h4 className={cn("font-medium text-sm leading-tight", prova.status === "done" && "line-through text-muted-foreground")}>{prova.title}</h4>
                              {disc && <p className={cn("text-xs mt-0.5", c.text)}>{disc.name}</p>}
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
                              <Badge variant="outline" className={cn("text-[10px] border", pCfg.color)}>{pCfg.label}</Badge>
                              <Badge variant="outline" className={cn("text-[10px] border", sCfg.color)}>{sCfg.label}</Badge>
                              {daysInfo && (
                                <Badge variant={daysInfo.urgent ? "destructive" : "secondary"} className="text-[10px] font-mono">
                                  {daysInfo.label}
                                </Badge>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground flex-wrap">
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {format(new Date(prova.exam_date), "dd 'de' MMM 'de' yyyy", { locale: ptBR })}
                            </span>
                            {prova.grade !== null && (
                              <span className={cn("font-mono font-medium", prova.grade >= 7 ? "text-emerald-400" : prova.grade >= 5 ? "text-amber-400" : "text-red-400")}>
                                Nota: {prova.grade.toFixed(1)}
                              </span>
                            )}
                            {prova.notes && <span className="text-muted-foreground/70 truncate max-w-[200px]">{prova.notes}</span>}
                          </div>
                        </div>
                        <div className="flex gap-0.5 shrink-0">
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={() => openEditProva(prova)}>
                            <Edit2 className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => deleteProva(prova.id)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </TabsContent>

          {/* Disciplinas tab */}
          <TabsContent value="disciplinas" className="space-y-3 mt-4">
            {disciplinas.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <div className="p-4 rounded-full bg-muted/40 w-fit mx-auto mb-3">
                  <BookOpen className="h-7 w-7 text-muted-foreground/50" />
                </div>
                <p className="text-sm">Nenhuma disciplina cadastrada.</p>
                <Button size="sm" className="mt-3" onClick={openAddDisc}><Plus className="h-3.5 w-3.5 mr-1.5" />Adicionar disciplina</Button>
              </div>
            ) : disciplinas.map((disc, i) => {
              const c = getColor(disc.color);
              const discProvas = provas.filter(p => p.disciplina_id === disc.id);
              const expanded = expandedDisciplinas.has(disc.id);

              return (
                <motion.div key={disc.id} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                  <Card className="border-border/50 bg-card/60">
                    <CardHeader className="py-3 px-4 flex flex-row items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className={cn("h-3 w-3 rounded-full", c.dot)} />
                        <div>
                          <CardTitle className="text-sm font-medium">{disc.name}</CardTitle>
                          {disc.professor && <p className="text-xs text-muted-foreground">{disc.professor}</p>}
                        </div>
                        <Badge variant="secondary" className="text-[10px] font-mono ml-1">{discProvas.length} prova(s)</Badge>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={() => openAddProva(disc.id)}>
                          <Plus className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={() => openEditDisc(disc)}>
                          <Edit2 className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => deleteDisc(disc.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                        {discProvas.length > 0 && (
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground" onClick={() => toggleExpand(disc.id)}>
                            {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                          </Button>
                        )}
                      </div>
                    </CardHeader>
                    {expanded && discProvas.length > 0 && (
                      <CardContent className="px-4 pb-3 pt-0 space-y-1.5">
                        {discProvas.map(prova => {
                          const pCfg = priorityConfig[prova.priority] || priorityConfig.medium;
                          const sCfg = statusConfig[prova.status] || statusConfig.pending;
                          const daysInfo = getDaysLabel(prova.exam_date, prova.status);
                          return (
                            <div key={prova.id} className="flex items-center gap-2 p-2 rounded-lg bg-muted/30 text-xs">
                              <Calendar className="h-3 w-3 text-muted-foreground shrink-0" />
                              <span className={cn("flex-1 font-medium", prova.status === "done" && "line-through text-muted-foreground")}>{prova.title}</span>
                              <span className="text-muted-foreground font-mono">{format(new Date(prova.exam_date), "dd/MM/yy")}</span>
                              <Badge variant="outline" className={cn("text-[10px] border py-0", pCfg.color)}>{pCfg.label}</Badge>
                              <Badge variant="outline" className={cn("text-[10px] border py-0", sCfg.color)}>{sCfg.label}</Badge>
                              {daysInfo && <Badge variant={daysInfo.urgent ? "destructive" : "secondary"} className="text-[10px] font-mono py-0">{daysInfo.label}</Badge>}
                              <Button variant="ghost" size="icon" className="h-5 w-5 text-muted-foreground hover:text-foreground shrink-0" onClick={() => openEditProva(prova)}><Edit2 className="h-3 w-3" /></Button>
                            </div>
                          );
                        })}
                      </CardContent>
                    )}
                    {disc.notes && !expanded && (
                      <CardContent className="px-4 pb-3 pt-0">
                        <p className="text-xs text-muted-foreground">{disc.notes}</p>
                      </CardContent>
                    )}
                  </Card>
                </motion.div>
              );
            })}
          </TabsContent>
        </Tabs>

        {/* Disciplina Dialog */}
        <Dialog open={showDiscDialog} onOpenChange={setShowDiscDialog}>
          <DialogContent className="max-w-[95vw] sm:max-w-md">
            <DialogHeader><DialogTitle>{editingDisc ? "Editar Disciplina" : "Nova Disciplina"}</DialogTitle></DialogHeader>
            <div className="space-y-4 py-2">
              <div><Label className="text-xs md:text-sm">Nome da Disciplina *</Label><Input value={discForm.name} onChange={e => setDiscForm({ ...discForm, name: e.target.value })} placeholder="Ex: Cálculo I" className="text-sm" /></div>
              <div><Label className="text-xs md:text-sm">Professor</Label><Input value={discForm.professor} onChange={e => setDiscForm({ ...discForm, professor: e.target.value })} placeholder="Nome do professor" className="text-sm" /></div>
              <div>
                <Label className="text-xs md:text-sm">Cor</Label>
                <div className="flex gap-2 mt-2">
                  {COLORS.map(c => (
                    <button key={c.value} onClick={() => setDiscForm({ ...discForm, color: c.value })} className={cn("h-7 w-7 rounded-full border-2 transition-all", c.dot, discForm.color === c.value ? "border-foreground scale-110" : "border-transparent opacity-60 hover:opacity-100")} title={c.label} />
                  ))}
                </div>
              </div>
              <div><Label className="text-xs md:text-sm">Notas</Label><Textarea value={discForm.notes} onChange={e => setDiscForm({ ...discForm, notes: e.target.value })} placeholder="Observações sobre a disciplina..." className="text-sm" rows={2} /></div>
            </div>
            <DialogFooter className="gap-2">
              <Button variant="outline" size="sm" onClick={() => setShowDiscDialog(false)}>Cancelar</Button>
              <Button size="sm" onClick={saveDisc}>{editingDisc ? "Salvar" : "Criar"}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Prova Dialog */}
        <Dialog open={showProvaDialog} onOpenChange={setShowProvaDialog}>
          <DialogContent className="max-w-[95vw] sm:max-w-md">
            <DialogHeader><DialogTitle>{editingProva ? "Editar Prova" : "Nova Prova / Avaliação"}</DialogTitle></DialogHeader>
            <div className="space-y-4 py-2">
              <div>
                <Label className="text-xs md:text-sm">Disciplina *</Label>
                <Select value={provaForm.disciplina_id} onValueChange={v => setProvaForm({ ...provaForm, disciplina_id: v })}>
                  <SelectTrigger className="text-sm"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>
                    {disciplinas.map(d => (
                      <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div><Label className="text-xs md:text-sm">Título / Tipo de Avaliação *</Label><Input value={provaForm.title} onChange={e => setProvaForm({ ...provaForm, title: e.target.value })} placeholder="Ex: Prova 1, Trabalho Final..." className="text-sm" /></div>
              <div><Label className="text-xs md:text-sm">Data da Prova *</Label><Input type="date" value={provaForm.exam_date} onChange={e => setProvaForm({ ...provaForm, exam_date: e.target.value })} className="text-sm" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs md:text-sm">Prioridade</Label>
                  <Select value={provaForm.priority} onValueChange={v => setProvaForm({ ...provaForm, priority: v })}>
                    <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Baixa</SelectItem>
                      <SelectItem value="medium">Média</SelectItem>
                      <SelectItem value="high">Alta</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs md:text-sm">Status</Label>
                  <Select value={provaForm.status} onValueChange={v => setProvaForm({ ...provaForm, status: v })}>
                    <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">Pendente</SelectItem>
                      <SelectItem value="studying">Estudando</SelectItem>
                      <SelectItem value="done">Concluída</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div><Label className="text-xs md:text-sm">Nota (após a prova)</Label><Input type="number" min={0} max={10} step={0.1} value={provaForm.grade} onChange={e => setProvaForm({ ...provaForm, grade: e.target.value })} placeholder="0 – 10" className="text-sm" /></div>
              <div><Label className="text-xs md:text-sm">Notas / Observações</Label><Textarea value={provaForm.notes} onChange={e => setProvaForm({ ...provaForm, notes: e.target.value })} placeholder="Conteúdo, dicas, materiais..." className="text-sm" rows={2} /></div>
            </div>
            <DialogFooter className="gap-2">
              <Button variant="outline" size="sm" onClick={() => setShowProvaDialog(false)}>Cancelar</Button>
              <Button size="sm" onClick={saveProva}>{editingProva ? "Salvar" : "Adicionar"}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </motion.div>
    </EMSLayout>
  );
};

export default Faculdade;
