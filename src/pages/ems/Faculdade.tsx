import { useState, useEffect, useMemo, useRef } from "react";
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
import { Progress } from "@/components/ui/progress";
import { motion, AnimatePresence } from "framer-motion";
import {
  GraduationCap, Plus, Trash2, Edit2, Calendar, BookOpen,
  AlertTriangle, CheckCircle, Clock, Star, ChevronDown, ChevronUp,
  ClipboardList, FileText, Upload, Download, Eye, X, FileUp,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format, differenceInDays, isPast, isToday, addDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import AddressAutocomplete from "@/components/ems/AddressAutocomplete";

// --- Types ---
interface Disciplina { id: string; name: string; professor: string | null; color: string; notes: string | null; address?: string | null; latitude?: number | null; longitude?: number | null; created_at: string; }
interface Prova { id: string; disciplina_id: string; title: string; exam_date: string; priority: string; status: string; notes: string | null; grade: number | null; created_at: string; }
interface Tarefa { id: string; disciplina_id: string | null; title: string; description: string | null; due_date: string | null; priority: string; status: string; created_at: string; }
interface Documento { id: string; entity_type: string; entity_id: string; file_name: string; file_url: string; file_size: number | null; content_type: string | null; created_at: string; }

// --- Constants ---
const COLORS = [
  { value: "blue", label: "Azul", dot: "bg-blue-400", text: "text-blue-400", bg: "bg-blue-500/10", border: "border-blue-500/30" },
  { value: "purple", label: "Roxo", dot: "bg-purple-400", text: "text-purple-400", bg: "bg-purple-500/10", border: "border-purple-500/30" },
  { value: "emerald", label: "Verde", dot: "bg-emerald-400", text: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/30" },
  { value: "amber", label: "Âmbar", dot: "bg-amber-400", text: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/30" },
  { value: "pink", label: "Rosa", dot: "bg-pink-400", text: "text-pink-400", bg: "bg-pink-500/10", border: "border-pink-500/30" },
  { value: "cyan", label: "Ciano", dot: "bg-cyan-400", text: "text-cyan-400", bg: "bg-cyan-500/10", border: "border-cyan-500/30" },
];
const getColor = (color: string) => COLORS.find(c => c.value === color) || COLORS[0];

const priorityConfig: Record<string, { label: string; color: string }> = {
  low: { label: "Baixa", color: "text-blue-400 bg-blue-500/10 border-blue-500/30" },
  medium: { label: "Média", color: "text-amber-400 bg-amber-500/10 border-amber-500/30" },
  high: { label: "Alta", color: "text-red-400 bg-red-500/10 border-red-500/30" },
};
const statusConfig: Record<string, { label: string; color: string; icon: typeof CheckCircle }> = {
  pending: { label: "Pendente", color: "text-muted-foreground bg-muted/50 border-border/50", icon: Clock },
  studying: { label: "Estudando", color: "text-amber-400 bg-amber-500/10 border-amber-500/30", icon: BookOpen },
  done: { label: "Concluída", color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/30", icon: CheckCircle },
};

const getDaysInfo = (dateStr: string | null, status: string) => {
  if (!dateStr || status === "done") return null;
  const d = new Date(dateStr + "T12:00:00");
  if (isToday(d)) return { label: "Hoje!", urgent: true, critical: true };
  if (isPast(d)) return { label: "Vencida", urgent: true, critical: true };
  const days = differenceInDays(d, new Date());
  if (days <= 3) return { label: `${days}d`, urgent: true, critical: true };
  if (days <= 7) return { label: `${days}d`, urgent: true, critical: false };
  return { label: `${days}d`, urgent: false, critical: false };
};

const getUserId = async () => {
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
};

const formatFileSize = (bytes: number | null) => {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

// --- Component ---
const Faculdade = () => {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [disciplinas, setDisciplinas] = useState<Disciplina[]>([]);
  const [provas, setProvas] = useState<Prova[]>([]);
  const [tarefas, setTarefas] = useState<Tarefa[]>([]);
  const [documentos, setDocumentos] = useState<Documento[]>([]);
  const [expandedDisciplinas, setExpandedDisciplinas] = useState<Set<string>>(new Set());
  const [tarefaFilter, setTarefaFilter] = useState<"all" | "pending" | "done">("pending");
  const [uploading, setUploading] = useState(false);
  const [uploadDiscId, setUploadDiscId] = useState<string | null>(null);

  // Disciplina dialog
  const [showDiscDialog, setShowDiscDialog] = useState(false);
  const [editingDisc, setEditingDisc] = useState<Disciplina | null>(null);
  const [discForm, setDiscForm] = useState({ name: "", professor: "", color: "blue", notes: "", address: "", latitude: "", longitude: "" });

  // Prova dialog
  const [showProvaDialog, setShowProvaDialog] = useState(false);
  const [editingProva, setEditingProva] = useState<Prova | null>(null);
  const [provaForm, setProvaForm] = useState({ disciplina_id: "", title: "", exam_date: "", priority: "medium", status: "pending", notes: "", grade: "" });

  // Tarefa dialog
  const [showTarefaDialog, setShowTarefaDialog] = useState(false);
  const [editingTarefa, setEditingTarefa] = useState<Tarefa | null>(null);
  const [tarefaForm, setTarefaForm] = useState({ disciplina_id: "", title: "", description: "", due_date: "", priority: "medium", status: "pending" });

  // Fetchers
  const fetchDisciplinas = async () => { const { data } = await supabase.from("faculdade_disciplinas").select("*").order("name"); if (data) setDisciplinas(data as Disciplina[]); };
  const fetchProvas = async () => { const { data } = await supabase.from("faculdade_provas").select("*").order("exam_date"); if (data) setProvas(data as Prova[]); };
  const fetchTarefas = async () => { const { data } = await supabase.from("faculdade_tarefas").select("*").order("due_date", { ascending: true, nullsFirst: false }); if (data) setTarefas(data as Tarefa[]); };
  const fetchDocumentos = async () => {
    const { data } = await supabase.from("attachments").select("*").eq("entity_type", "disciplina").order("created_at", { ascending: false });
    if (data) setDocumentos(data as Documento[]);
  };

  useEffect(() => { fetchDisciplinas(); fetchProvas(); fetchTarefas(); fetchDocumentos(); }, []);

  // Stats
  const stats = useMemo(() => {
    const upcomingProvas = provas.filter(p => p.status !== "done");
    const urgentProvas = upcomingProvas.filter(p => differenceInDays(new Date(p.exam_date + "T12:00:00"), new Date()) <= 7);
    const doneProvas = provas.filter(p => p.status === "done");
    const grades = doneProvas.filter(p => p.grade !== null).map(p => p.grade!);
    const avg = grades.length > 0 ? grades.reduce((a, b) => a + b, 0) / grades.length : null;
    const pendingTarefas = tarefas.filter(t => t.status === "pending");
    const overdueTarefas = pendingTarefas.filter(t => t.due_date && isPast(new Date(t.due_date + "T12:00:00")) && !isToday(new Date(t.due_date + "T12:00:00")));
    return { totalProvas: provas.length, urgentProvas: urgentProvas.length, doneProvas: doneProvas.length, avg, pendingTarefas: pendingTarefas.length, overdueTarefas: overdueTarefas.length };
  }, [provas, tarefas]);

  // Upcoming items (provas + tarefas with dates, sorted by date, not done)
  const upcomingItems = useMemo(() => {
    const items: { type: "prova" | "tarefa"; id: string; title: string; date: string; discId: string | null; priority: string; status: string }[] = [];
    provas.filter(p => p.status !== "done").forEach(p => items.push({ type: "prova", id: p.id, title: p.title, date: p.exam_date, discId: p.disciplina_id, priority: p.priority, status: p.status }));
    tarefas.filter(t => t.status !== "done" && t.due_date).forEach(t => items.push({ type: "tarefa", id: t.id, title: t.title, date: t.due_date!, discId: t.disciplina_id, priority: t.priority, status: t.status }));
    items.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    return items.slice(0, 8);
  }, [provas, tarefas]);

  // --- Disciplina CRUD ---
  const openAddDisc = () => { setEditingDisc(null); setDiscForm({ name: "", professor: "", color: "blue", notes: "", address: "", latitude: "", longitude: "" }); setShowDiscDialog(true); };
  const openEditDisc = (d: Disciplina) => { setEditingDisc(d); setDiscForm({ name: d.name, professor: d.professor || "", color: d.color, notes: d.notes || "", address: d.address || "", latitude: d.latitude != null ? String(d.latitude) : "", longitude: d.longitude != null ? String(d.longitude) : "" }); setShowDiscDialog(true); };
  const saveDisc = async () => {
    if (!discForm.name.trim()) { toast({ title: "Nome é obrigatório", variant: "destructive" }); return; }
    const userId = await getUserId();
    if (editingDisc) {
      await (supabase as any).from("faculdade_disciplinas").update({ name: discForm.name, professor: discForm.professor || null, color: discForm.color, notes: discForm.notes || null, address: discForm.address || null, latitude: discForm.latitude ? Number(discForm.latitude) : null, longitude: discForm.longitude ? Number(discForm.longitude) : null }).eq("id", editingDisc.id);
      toast({ title: "Disciplina atualizada!" });
    } else {
      await (supabase as any).from("faculdade_disciplinas").insert({ name: discForm.name, professor: discForm.professor || null, color: discForm.color, notes: discForm.notes || null, address: discForm.address || null, latitude: discForm.latitude ? Number(discForm.latitude) : null, longitude: discForm.longitude ? Number(discForm.longitude) : null, user_id: userId });
      toast({ title: "Disciplina criada!" });
    }
    setShowDiscDialog(false);
    fetchDisciplinas();
  };
  const deleteDisc = async (id: string) => {
    await supabase.from("faculdade_disciplinas").delete().eq("id", id);
    fetchDisciplinas(); fetchProvas(); fetchTarefas(); fetchDocumentos();
    toast({ title: "Disciplina removida!" });
  };

  // --- Prova CRUD ---
  const openAddProva = (discId?: string) => { setEditingProva(null); setProvaForm({ disciplina_id: discId || "", title: "", exam_date: "", priority: "medium", status: "pending", notes: "", grade: "" }); setShowProvaDialog(true); };
  const openEditProva = (p: Prova) => { setEditingProva(p); setProvaForm({ disciplina_id: p.disciplina_id, title: p.title, exam_date: p.exam_date, priority: p.priority, status: p.status, notes: p.notes || "", grade: p.grade !== null ? String(p.grade) : "" }); setShowProvaDialog(true); };
  const saveProva = async () => {
    if (!provaForm.title.trim() || !provaForm.exam_date || !provaForm.disciplina_id) { toast({ title: "Disciplina, título e data são obrigatórios", variant: "destructive" }); return; }
    const userId = await getUserId();
    const payload = { disciplina_id: provaForm.disciplina_id, title: provaForm.title, exam_date: provaForm.exam_date, priority: provaForm.priority, status: provaForm.status, notes: provaForm.notes || null, grade: provaForm.grade !== "" ? parseFloat(provaForm.grade) : null };
    if (editingProva) {
      await supabase.from("faculdade_provas").update(payload).eq("id", editingProva.id);
      toast({ title: "Prova atualizada!" });
    } else {
      await supabase.from("faculdade_provas").insert({ ...payload, user_id: userId });
      toast({ title: "Prova adicionada!" });
    }
    setShowProvaDialog(false);
    fetchProvas();
  };
  const deleteProva = async (id: string) => { await supabase.from("faculdade_provas").delete().eq("id", id); fetchProvas(); toast({ title: "Prova removida!" }); };

  // --- Tarefa CRUD ---
  const openAddTarefa = (discId?: string) => { setEditingTarefa(null); setTarefaForm({ disciplina_id: discId || "", title: "", description: "", due_date: "", priority: "medium", status: "pending" }); setShowTarefaDialog(true); };
  const openEditTarefa = (t: Tarefa) => { setEditingTarefa(t); setTarefaForm({ disciplina_id: t.disciplina_id || "", title: t.title, description: t.description || "", due_date: t.due_date || "", priority: t.priority, status: t.status }); setShowTarefaDialog(true); };
  const saveTarefa = async () => {
    if (!tarefaForm.title.trim()) { toast({ title: "Título é obrigatório", variant: "destructive" }); return; }
    const userId = await getUserId();
    const payload = { disciplina_id: tarefaForm.disciplina_id || null, title: tarefaForm.title, description: tarefaForm.description || null, due_date: tarefaForm.due_date || null, priority: tarefaForm.priority, status: tarefaForm.status };
    if (editingTarefa) {
      await supabase.from("faculdade_tarefas").update(payload).eq("id", editingTarefa.id);
      toast({ title: "Tarefa atualizada!" });
    } else {
      await supabase.from("faculdade_tarefas").insert({ ...payload, user_id: userId });
      toast({ title: "Tarefa criada!" });
    }
    setShowTarefaDialog(false);
    fetchTarefas();
  };
  const deleteTarefa = async (id: string) => { await supabase.from("faculdade_tarefas").delete().eq("id", id); fetchTarefas(); toast({ title: "Tarefa removida!" }); };
  const toggleTarefaStatus = async (t: Tarefa) => {
    const newStatus = t.status === "done" ? "pending" : "done";
    await supabase.from("faculdade_tarefas").update({ status: newStatus }).eq("id", t.id);
    fetchTarefas();
  };

  // --- Document upload ---
  const handleUploadClick = (discId: string) => {
    setUploadDiscId(discId);
    fileInputRef.current?.click();
  };
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || !uploadDiscId) return;
    setUploading(true);
    const userId = await getUserId();
    for (const file of Array.from(files)) {
      const filePath = `faculdade/${uploadDiscId}/${Date.now()}_${file.name}`;
      const { error: uploadError } = await supabase.storage.from("attachments").upload(filePath, file);
      if (uploadError) { toast({ title: `Erro ao enviar ${file.name}`, variant: "destructive" }); continue; }
      const { data: urlData } = supabase.storage.from("attachments").getPublicUrl(filePath);
      await supabase.from("attachments").insert({
        entity_type: "disciplina",
        entity_id: uploadDiscId,
        file_name: file.name,
        file_url: urlData.publicUrl,
        file_size: file.size,
        content_type: file.type,
        uploaded_by: userId,
      });
    }
    toast({ title: `${files.length} arquivo(s) enviado(s)!` });
    setUploading(false);
    setUploadDiscId(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    fetchDocumentos();
  };
  const deleteDoc = async (doc: Documento) => {
    const path = doc.file_url.split("/attachments/")[1];
    if (path) await supabase.storage.from("attachments").remove([decodeURIComponent(path)]);
    await supabase.from("attachments").delete().eq("id", doc.id);
    fetchDocumentos();
    toast({ title: "Documento removido!" });
  };

  const toggleExpand = (id: string) => {
    setExpandedDisciplinas(prev => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  };

  const provasSorted = [...provas].sort((a, b) => new Date(a.exam_date).getTime() - new Date(b.exam_date).getTime());
  const tarefasFiltered = tarefas.filter(t => tarefaFilter === "all" ? true : t.status === tarefaFilter);

  return (
    <EMSLayout>
      <input ref={fileInputRef} type="file" multiple accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.jpg,.jpeg,.png,.txt" className="hidden" onChange={handleFileChange} />
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-4 md:space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-3">
          <div>
            <h1 className="text-xl md:text-3xl font-heading font-bold text-foreground flex items-center gap-2">
              <div className="p-2 rounded-xl bg-primary/10"><GraduationCap className="h-5 w-5 md:h-6 md:w-6 text-primary" /></div>
              Faculdade
            </h1>
            <p className="text-xs md:text-base text-muted-foreground mt-1">Disciplinas, provas, tarefas, documentos e prioridades de estudo</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button size="sm" variant="outline" onClick={openAddDisc} className="text-xs md:text-sm"><Plus className="h-3.5 w-3.5 mr-1.5" />Disciplina</Button>
            <Button size="sm" variant="outline" onClick={() => openAddProva()} className="text-xs md:text-sm"><Plus className="h-3.5 w-3.5 mr-1.5" />Prova</Button>
            <Button size="sm" onClick={() => openAddTarefa()} className="text-xs md:text-sm"><Plus className="h-3.5 w-3.5 mr-1.5" />Tarefa</Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2 md:gap-3">
          {[
            { label: "Provas", value: stats.totalProvas, icon: BookOpen, color: "text-primary", gradient: "from-primary/10 to-primary/5" },
            { label: "Urgentes ≤7d", value: stats.urgentProvas, icon: AlertTriangle, color: "text-red-400", gradient: "from-red-500/10 to-red-500/5" },
            { label: "Concluídas", value: stats.doneProvas, icon: CheckCircle, color: "text-emerald-400", gradient: "from-emerald-500/10 to-emerald-500/5" },
            { label: "Média", value: stats.avg !== null ? stats.avg.toFixed(1) : "—", icon: Star, color: "text-purple-400", gradient: "from-purple-500/10 to-purple-500/5" },
            { label: "Tarefas pend.", value: stats.pendingTarefas, icon: ClipboardList, color: "text-amber-400", gradient: "from-amber-500/10 to-amber-500/5" },
            { label: "Documentos", value: documentos.length, icon: FileText, color: "text-cyan-400", gradient: "from-cyan-500/10 to-cyan-500/5" },
          ].map((s, i) => (
            <motion.div key={s.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
              <div className="stat-card">
                <div className="flex items-center gap-2 md:gap-3">
                  <div className={cn("p-1.5 md:p-2 rounded-lg bg-gradient-to-br shrink-0", s.gradient)}>
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

        {/* Upcoming Timeline */}
        {upcomingItems.length > 0 && (
          <Card className="border-border/50 bg-gradient-to-br from-card/80 to-card/40">
            <CardHeader className="pb-2 pt-3 px-4">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Calendar className="h-4 w-4 text-primary" />
                Próximos Compromissos
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-3">
              <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin">
                {upcomingItems.map((item, i) => {
                  const disc = disciplinas.find(d => d.id === item.discId);
                  const c = disc ? getColor(disc.color) : COLORS[0];
                  const dInfo = getDaysInfo(item.date, item.status);
                  const isProva = item.type === "prova";
                  return (
                    <motion.div
                      key={`${item.type}-${item.id}`}
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: i * 0.05 }}
                      className="shrink-0"
                    >
                      <div className={cn(
                        "relative p-3 rounded-xl border w-[160px] md:w-[180px] transition-all hover:scale-[1.02]",
                        dInfo?.critical ? "border-red-500/40 bg-red-500/5" : "border-border/50 bg-card/60",
                      )}>
                        <div className="flex items-center gap-1.5 mb-1.5">
                          <div className={cn("h-2 w-2 rounded-full shrink-0", c.dot)} />
                          <span className={cn("text-[10px] truncate", c.text)}>{disc?.name || "—"}</span>
                        </div>
                        <p className="text-xs font-medium leading-tight line-clamp-2">{item.title}</p>
                        <div className="flex items-center justify-between mt-2">
                          <span className="text-[10px] text-muted-foreground font-mono">
                            {format(new Date(item.date + "T12:00:00"), "dd/MM")}
                          </span>
                          <div className="flex items-center gap-1">
                            <Badge variant="secondary" className={cn("text-[9px] py-0 px-1", isProva ? "bg-primary/10 text-primary" : "bg-muted")}>
                              {isProva ? "Prova" : "Tarefa"}
                            </Badge>
                            {dInfo && (
                              <Badge variant={dInfo.critical ? "destructive" : "secondary"} className="text-[9px] py-0 px-1 font-mono">
                                {dInfo.label}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Tabs */}
        <Tabs defaultValue="tarefas" className="space-y-4">
          <TabsList className="w-full sm:w-auto">
            <TabsTrigger value="tarefas" className="gap-1.5 text-xs md:text-sm flex-1 sm:flex-none"><ClipboardList className="h-3.5 w-3.5" />Tarefas</TabsTrigger>
            <TabsTrigger value="provas" className="gap-1.5 text-xs md:text-sm flex-1 sm:flex-none"><Calendar className="h-3.5 w-3.5" />Provas</TabsTrigger>
            <TabsTrigger value="disciplinas" className="gap-1.5 text-xs md:text-sm flex-1 sm:flex-none"><BookOpen className="h-3.5 w-3.5" />Disciplinas</TabsTrigger>
            <TabsTrigger value="documentos" className="gap-1.5 text-xs md:text-sm flex-1 sm:flex-none"><FileText className="h-3.5 w-3.5" />Docs</TabsTrigger>
          </TabsList>

          {/* TAREFAS TAB */}
          <TabsContent value="tarefas" className="space-y-3 mt-4">
            <div className="flex gap-2 flex-wrap">
              {(["pending", "all", "done"] as const).map(f => (
                <Button key={f} variant={tarefaFilter === f ? "default" : "outline"} size="sm" onClick={() => setTarefaFilter(f)} className="text-xs h-7">
                  {f === "all" ? "Todas" : f === "pending" ? "Pendentes" : "Concluídas"}
                </Button>
              ))}
            </div>
            {tarefasFiltered.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <div className="p-4 rounded-full bg-muted/40 w-fit mx-auto mb-3"><ClipboardList className="h-7 w-7 text-muted-foreground/50" /></div>
                <p className="text-sm">Nenhuma tarefa aqui.</p>
                <Button size="sm" className="mt-3" onClick={() => openAddTarefa()}><Plus className="h-3.5 w-3.5 mr-1.5" />Adicionar tarefa</Button>
              </div>
            ) : tarefasFiltered.map((t, i) => {
              const disc = disciplinas.find(d => d.id === t.disciplina_id);
              const c = disc ? getColor(disc.color) : null;
              const pCfg = priorityConfig[t.priority] || priorityConfig.medium;
              const dInfo = getDaysInfo(t.due_date, t.status);
              const done = t.status === "done";
              return (
                <motion.div key={t.id} initial={{ opacity: 0, x: -15 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.03 }}>
                  <Card className={cn("border-border/50 bg-card/60 transition-colors hover:bg-card/80", done && "opacity-60")}>
                    <CardContent className="p-3 md:p-4 flex items-start gap-3">
                      <button onClick={() => toggleTarefaStatus(t)} className={cn("mt-0.5 shrink-0 h-4 w-4 rounded border transition-colors", done ? "bg-emerald-500 border-emerald-500 text-white flex items-center justify-center" : "border-border/60 hover:border-primary")}>
                        {done && <CheckCircle className="h-3 w-3" />}
                      </button>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <h4 className={cn("font-medium text-sm leading-tight", done && "line-through text-muted-foreground")}>{t.title}</h4>
                            {disc && <p className={cn("text-xs mt-0.5", c?.text)}>{disc.name}</p>}
                            {t.description && <p className="text-xs text-muted-foreground mt-1">{t.description}</p>}
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
                            <Badge variant="outline" className={cn("text-[10px] border", pCfg.color)}>{pCfg.label}</Badge>
                            {dInfo && (
                              <Badge variant={dInfo.critical ? "destructive" : "secondary"} className={cn("text-[10px] font-mono", !dInfo.critical && dInfo.urgent && "bg-amber-500/10 text-amber-400 border-amber-500/30")}>
                                {dInfo.label}
                              </Badge>
                            )}
                          </div>
                        </div>
                        {t.due_date && (
                          <p className="text-[10px] text-muted-foreground flex items-center gap-1 mt-1.5">
                            <Calendar className="h-3 w-3" />
                            {format(new Date(t.due_date + "T12:00:00"), "dd 'de' MMM 'de' yyyy", { locale: ptBR })}
                          </p>
                        )}
                      </div>
                      <div className="flex gap-0.5 shrink-0">
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={() => openEditTarefa(t)}><Edit2 className="h-3.5 w-3.5" /></Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => deleteTarefa(t.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </TabsContent>

          {/* PROVAS TAB */}
          <TabsContent value="provas" className="space-y-2 mt-4">
            {provasSorted.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <div className="p-4 rounded-full bg-muted/40 w-fit mx-auto mb-3"><Calendar className="h-7 w-7 text-muted-foreground/50" /></div>
                <p className="text-sm">Nenhuma prova cadastrada.</p>
                <Button size="sm" className="mt-3" onClick={() => openAddProva()}><Plus className="h-3.5 w-3.5 mr-1.5" />Adicionar prova</Button>
              </div>
            ) : provasSorted.map((prova, i) => {
              const disc = disciplinas.find(d => d.id === prova.disciplina_id);
              const c = disc ? getColor(disc.color) : COLORS[0];
              const pCfg = priorityConfig[prova.priority] || priorityConfig.medium;
              const sCfg = statusConfig[prova.status] || statusConfig.pending;
              const dInfo = getDaysInfo(prova.exam_date, prova.status);
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
                              {dInfo && <Badge variant={dInfo.critical ? "destructive" : "secondary"} className={cn("text-[10px] font-mono", !dInfo.critical && dInfo.urgent && "bg-amber-500/10 text-amber-400 border-amber-500/30")}>{dInfo.label}</Badge>}
                            </div>
                          </div>
                          <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground flex-wrap">
                            <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{format(new Date(prova.exam_date + "T12:00:00"), "dd 'de' MMM 'de' yyyy", { locale: ptBR })}</span>
                            {prova.grade !== null && <span className={cn("font-mono font-medium", prova.grade >= 7 ? "text-emerald-400" : prova.grade >= 5 ? "text-amber-400" : "text-red-400")}>Nota: {prova.grade.toFixed(1)}</span>}
                            {prova.notes && <span className="text-muted-foreground/70 truncate max-w-[180px]">{prova.notes}</span>}
                          </div>
                        </div>
                        <div className="flex gap-0.5 shrink-0">
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={() => openEditProva(prova)}><Edit2 className="h-3.5 w-3.5" /></Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => deleteProva(prova.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </TabsContent>

          {/* DISCIPLINAS TAB */}
          <TabsContent value="disciplinas" className="space-y-3 mt-4">
            {disciplinas.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <div className="p-4 rounded-full bg-muted/40 w-fit mx-auto mb-3"><BookOpen className="h-7 w-7 text-muted-foreground/50" /></div>
                <p className="text-sm">Nenhuma disciplina cadastrada.</p>
                <Button size="sm" className="mt-3" onClick={openAddDisc}><Plus className="h-3.5 w-3.5 mr-1.5" />Adicionar disciplina</Button>
              </div>
            ) : disciplinas.map((disc, i) => {
              const c = getColor(disc.color);
              const discProvas = provas.filter(p => p.disciplina_id === disc.id);
              const discTarefas = tarefas.filter(t => t.disciplina_id === disc.id);
              const discDocs = documentos.filter(d => d.entity_id === disc.id);
              const expanded = expandedDisciplinas.has(disc.id);
              const doneCount = discProvas.filter(p => p.status === "done").length;
              const progress = discProvas.length > 0 ? (doneCount / discProvas.length) * 100 : 0;
              return (
                <motion.div key={disc.id} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                  <Card className="border-border/50 bg-card/60">
                    <CardHeader className="py-3 px-4 flex flex-row items-center justify-between">
                      <div className="flex items-center gap-2.5 min-w-0 flex-1" onClick={() => toggleExpand(disc.id)} role="button">
                        <div className={cn("h-3 w-3 rounded-full shrink-0", c.dot)} />
                        <div className="min-w-0 flex-1">
                          <CardTitle className="text-sm font-medium">{disc.name}</CardTitle>
                          {disc.professor && <p className="text-xs text-muted-foreground">{disc.professor}</p>}
                          {discProvas.length > 0 && (
                            <div className="flex items-center gap-2 mt-1.5">
                              <Progress value={progress} className="h-1.5 flex-1 max-w-[120px]" />
                              <span className="text-[10px] text-muted-foreground font-mono">{doneCount}/{discProvas.length}</span>
                            </div>
                          )}
                        </div>
                        <div className="flex gap-1 ml-1 flex-wrap">
                          <Badge variant="secondary" className="text-[10px] font-mono">{discProvas.length} provas</Badge>
                          <Badge variant="secondary" className="text-[10px] font-mono">{discTarefas.length} tarefas</Badge>
                          {discDocs.length > 0 && <Badge variant="secondary" className="text-[10px] font-mono">{discDocs.length} docs</Badge>}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" title="Upload documento" onClick={() => handleUploadClick(disc.id)}><FileUp className="h-3.5 w-3.5" /></Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" title="Adicionar prova" onClick={() => openAddProva(disc.id)}><Calendar className="h-3.5 w-3.5" /></Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" title="Adicionar tarefa" onClick={() => openAddTarefa(disc.id)}><ClipboardList className="h-3.5 w-3.5" /></Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={() => openEditDisc(disc)}><Edit2 className="h-3.5 w-3.5" /></Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => deleteDisc(disc.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground" onClick={() => toggleExpand(disc.id)}>
                          {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                        </Button>
                      </div>
                    </CardHeader>
                    <AnimatePresence>
                      {expanded && (
                        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }}>
                          <CardContent className="px-4 pb-3 pt-0 space-y-1.5">
                            {discProvas.length > 0 && <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium pt-1">Provas</p>}
                            {discProvas.sort((a, b) => new Date(a.exam_date).getTime() - new Date(b.exam_date).getTime()).map(prova => {
                              const pCfg = priorityConfig[prova.priority] || priorityConfig.medium;
                              const dInfo = getDaysInfo(prova.exam_date, prova.status);
                              return (
                                <div key={prova.id} className="flex items-center gap-2 p-2 rounded-lg bg-primary/5 text-xs border border-primary/10">
                                  <Calendar className="h-3 w-3 text-primary shrink-0" />
                                  <span className={cn("flex-1 font-medium", prova.status === "done" && "line-through text-muted-foreground")}>{prova.title}</span>
                                  <span className="text-muted-foreground font-mono">{format(new Date(prova.exam_date + "T12:00:00"), "dd/MM/yy")}</span>
                                  {prova.grade !== null && <span className={cn("font-mono", prova.grade >= 7 ? "text-emerald-400" : "text-red-400")}>{prova.grade.toFixed(1)}</span>}
                                  <Badge variant="outline" className={cn("text-[10px] border py-0", pCfg.color)}>{pCfg.label}</Badge>
                                  {dInfo && <Badge variant={dInfo.critical ? "destructive" : "secondary"} className="text-[10px] font-mono py-0">{dInfo.label}</Badge>}
                                </div>
                              );
                            })}
                            {discTarefas.length > 0 && <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium pt-1">Tarefas</p>}
                            {discTarefas.map(t => {
                              const dInfo = getDaysInfo(t.due_date, t.status);
                              return (
                                <div key={t.id} className="flex items-center gap-2 p-2 rounded-lg bg-muted/30 text-xs">
                                  <ClipboardList className="h-3 w-3 text-muted-foreground shrink-0" />
                                  <span className={cn("flex-1", t.status === "done" && "line-through text-muted-foreground")}>{t.title}</span>
                                  {t.due_date && <span className="text-muted-foreground font-mono">{format(new Date(t.due_date + "T12:00:00"), "dd/MM/yy")}</span>}
                                  {dInfo && <Badge variant={dInfo.critical ? "destructive" : "secondary"} className="text-[10px] font-mono py-0">{dInfo.label}</Badge>}
                                </div>
                              );
                            })}
                            {discDocs.length > 0 && <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium pt-1">Documentos</p>}
                            {discDocs.map(doc => (
                              <div key={doc.id} className="flex items-center gap-2 p-2 rounded-lg bg-cyan-500/5 text-xs border border-cyan-500/10">
                                <FileText className="h-3 w-3 text-cyan-400 shrink-0" />
                                <span className="flex-1 truncate">{doc.file_name}</span>
                                {doc.file_size && <span className="text-muted-foreground font-mono text-[10px]">{formatFileSize(doc.file_size)}</span>}
                                <a href={doc.file_url} target="_blank" rel="noopener noreferrer" className="text-primary hover:text-primary/80"><Eye className="h-3.5 w-3.5" /></a>
                                <button onClick={() => deleteDoc(doc)} className="text-muted-foreground hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
                              </div>
                            ))}
                            {disc.notes && <p className="text-xs text-muted-foreground pt-1 border-t border-border/30">{disc.notes}</p>}
                          </CardContent>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </Card>
                </motion.div>
              );
            })}
          </TabsContent>

          {/* DOCUMENTOS TAB */}
          <TabsContent value="documentos" className="space-y-3 mt-4">
            {documentos.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <div className="p-4 rounded-full bg-muted/40 w-fit mx-auto mb-3"><FileText className="h-7 w-7 text-muted-foreground/50" /></div>
                <p className="text-sm">Nenhum documento salvo.</p>
                <p className="text-xs text-muted-foreground mt-1">Faça upload de PDFs, arquivos e materiais pelas disciplinas.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {disciplinas.filter(d => documentos.some(doc => doc.entity_id === d.id)).map(disc => {
                  const c = getColor(disc.color);
                  const discDocs = documentos.filter(d => d.entity_id === disc.id);
                  return (
                    <Card key={disc.id} className="border-border/50 bg-card/60">
                      <CardHeader className="py-2.5 px-4 flex flex-row items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className={cn("h-2.5 w-2.5 rounded-full", c.dot)} />
                          <span className="text-sm font-medium">{disc.name}</span>
                          <Badge variant="secondary" className="text-[10px] font-mono">{discDocs.length}</Badge>
                        </div>
                        <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => handleUploadClick(disc.id)} disabled={uploading}>
                          <Upload className="h-3.5 w-3.5 mr-1" />{uploading ? "Enviando..." : "Upload"}
                        </Button>
                      </CardHeader>
                      <CardContent className="px-4 pb-3 pt-0 space-y-1">
                        {discDocs.map(doc => (
                          <div key={doc.id} className="flex items-center gap-2 p-2.5 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors text-xs group">
                            <FileText className="h-4 w-4 text-cyan-400 shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="font-medium truncate">{doc.file_name}</p>
                              <p className="text-[10px] text-muted-foreground">
                                {formatFileSize(doc.file_size)} · {format(new Date(doc.created_at), "dd/MM/yy")}
                              </p>
                            </div>
                            <div className="flex gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
                              <a href={doc.file_url} target="_blank" rel="noopener noreferrer">
                                <Button variant="ghost" size="icon" className="h-7 w-7"><Eye className="h-3.5 w-3.5" /></Button>
                              </a>
                              <a href={doc.file_url} download>
                                <Button variant="ghost" size="icon" className="h-7 w-7"><Download className="h-3.5 w-3.5" /></Button>
                              </a>
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => deleteDoc(doc)}>
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* Disciplina Dialog */}
        <Dialog open={showDiscDialog} onOpenChange={setShowDiscDialog}>
          <DialogContent className="max-w-[95vw] sm:max-w-md">
            <DialogHeader><DialogTitle>{editingDisc ? "Editar Disciplina" : "Nova Disciplina"}</DialogTitle></DialogHeader>
            <div className="space-y-4 py-2">
              <div><Label className="text-xs md:text-sm">Nome *</Label><Input value={discForm.name} onChange={e => setDiscForm({ ...discForm, name: e.target.value })} placeholder="Ex: Cálculo I" className="text-sm" /></div>
              <div><Label className="text-xs md:text-sm">Professor</Label><Input value={discForm.professor} onChange={e => setDiscForm({ ...discForm, professor: e.target.value })} placeholder="Nome do professor" className="text-sm" /></div>
              <div>
                <Label className="text-xs md:text-sm">Endereco / campus</Label>
                <AddressAutocomplete
                  value={discForm.address}
                  onChange={(address) => setDiscForm((prev) => ({ ...prev, address }))}
                  onResolved={(result) => setDiscForm((prev) => ({ ...prev, address: result.label, latitude: result.lat.toString(), longitude: result.lng.toString() }))}
                  placeholder="Campus, predio ou endereco"
                  className="mt-1"
                />
                {(discForm.latitude || discForm.longitude) && (
                  <p className="mt-1 text-xs text-muted-foreground">Lat {discForm.latitude || "-"} / Lng {discForm.longitude || "-"}</p>
                )}
              </div>
              <div>
                <Label className="text-xs md:text-sm">Cor</Label>
                <div className="flex gap-2 mt-2">
                  {COLORS.map(c => (<button key={c.value} onClick={() => setDiscForm({ ...discForm, color: c.value })} className={cn("h-7 w-7 rounded-full border-2 transition-all", c.dot, discForm.color === c.value ? "border-foreground scale-110" : "border-transparent opacity-60 hover:opacity-100")} title={c.label} />))}
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
                  <SelectContent>{disciplinas.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label className="text-xs md:text-sm">Título *</Label><Input value={provaForm.title} onChange={e => setProvaForm({ ...provaForm, title: e.target.value })} placeholder="Ex: Prova 1, Trabalho Final..." className="text-sm" /></div>
              <div><Label className="text-xs md:text-sm">Data da Prova *</Label><Input type="date" value={provaForm.exam_date} onChange={e => setProvaForm({ ...provaForm, exam_date: e.target.value })} className="text-sm" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs md:text-sm">Prioridade</Label>
                  <Select value={provaForm.priority} onValueChange={v => setProvaForm({ ...provaForm, priority: v })}>
                    <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="low">Baixa</SelectItem><SelectItem value="medium">Média</SelectItem><SelectItem value="high">Alta</SelectItem></SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs md:text-sm">Status</Label>
                  <Select value={provaForm.status} onValueChange={v => setProvaForm({ ...provaForm, status: v })}>
                    <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="pending">Pendente</SelectItem><SelectItem value="studying">Estudando</SelectItem><SelectItem value="done">Concluída</SelectItem></SelectContent>
                  </Select>
                </div>
              </div>
              <div><Label className="text-xs md:text-sm">Nota (após a prova)</Label><Input type="number" min={0} max={10} step={0.1} value={provaForm.grade} onChange={e => setProvaForm({ ...provaForm, grade: e.target.value })} placeholder="0 – 10" className="text-sm" /></div>
              <div><Label className="text-xs md:text-sm">Observações</Label><Textarea value={provaForm.notes} onChange={e => setProvaForm({ ...provaForm, notes: e.target.value })} placeholder="Conteúdo, dicas, materiais..." className="text-sm" rows={2} /></div>
            </div>
            <DialogFooter className="gap-2">
              <Button variant="outline" size="sm" onClick={() => setShowProvaDialog(false)}>Cancelar</Button>
              <Button size="sm" onClick={saveProva}>{editingProva ? "Salvar" : "Adicionar"}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Tarefa Dialog */}
        <Dialog open={showTarefaDialog} onOpenChange={setShowTarefaDialog}>
          <DialogContent className="max-w-[95vw] sm:max-w-md">
            <DialogHeader><DialogTitle>{editingTarefa ? "Editar Tarefa" : "Nova Tarefa / Atividade"}</DialogTitle></DialogHeader>
            <div className="space-y-4 py-2">
              <div><Label className="text-xs md:text-sm">Título *</Label><Input value={tarefaForm.title} onChange={e => setTarefaForm({ ...tarefaForm, title: e.target.value })} placeholder="Ex: Trabalho de Álgebra, Relatório..." className="text-sm" /></div>
              <div>
                <Label className="text-xs md:text-sm">Disciplina (opcional)</Label>
                <Select value={tarefaForm.disciplina_id || "none"} onValueChange={v => setTarefaForm({ ...tarefaForm, disciplina_id: v === "none" ? "" : v })}>
                  <SelectTrigger className="text-sm"><SelectValue placeholder="Nenhuma" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhuma</SelectItem>
                    {disciplinas.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div><Label className="text-xs md:text-sm">Data de Entrega</Label><Input type="date" value={tarefaForm.due_date} onChange={e => setTarefaForm({ ...tarefaForm, due_date: e.target.value })} className="text-sm" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs md:text-sm">Prioridade</Label>
                  <Select value={tarefaForm.priority} onValueChange={v => setTarefaForm({ ...tarefaForm, priority: v })}>
                    <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="low">Baixa</SelectItem><SelectItem value="medium">Média</SelectItem><SelectItem value="high">Alta</SelectItem></SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs md:text-sm">Status</Label>
                  <Select value={tarefaForm.status} onValueChange={v => setTarefaForm({ ...tarefaForm, status: v })}>
                    <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="pending">Pendente</SelectItem><SelectItem value="done">Concluída</SelectItem></SelectContent>
                  </Select>
                </div>
              </div>
              <div><Label className="text-xs md:text-sm">Descrição</Label><Textarea value={tarefaForm.description} onChange={e => setTarefaForm({ ...tarefaForm, description: e.target.value })} placeholder="Detalhes da tarefa..." className="text-sm" rows={2} /></div>
            </div>
            <DialogFooter className="gap-2">
              <Button variant="outline" size="sm" onClick={() => setShowTarefaDialog(false)}>Cancelar</Button>
              <Button size="sm" onClick={saveTarefa}>{editingTarefa ? "Salvar" : "Criar"}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </motion.div>
    </EMSLayout>
  );
};

export default Faculdade;
