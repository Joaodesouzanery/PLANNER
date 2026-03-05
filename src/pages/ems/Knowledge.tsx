import { useState, useEffect } from "react";
import { EMSLayout } from "@/components/ems/EMSLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search, BookOpen, ChevronDown, ChevronUp, Calendar, Tag,
  Lightbulb, Target, Trash2, Plus, X, Edit2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface ExecutionRecord {
  id: string;
  project_id: string;
  action_taken: string;
  result_obtained: string;
  lessons_learned: string;
  tags: string[];
  created_at: string;
  project?: { title: string };
}

interface Project {
  id: string;
  title: string;
}

const Knowledge = () => {
  const { toast } = useToast();
  const [records, setRecords] = useState<ExecutionRecord[]>([]);
  const [filteredRecords, setFilteredRecords] = useState<ExecutionRecord[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [expandedRecords, setExpandedRecords] = useState<Set<string>>(new Set());
  const [allTags, setAllTags] = useState<string[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<ExecutionRecord | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [form, setForm] = useState({
    action_taken: "",
    result_obtained: "",
    lessons_learned: "",
    project_id: "",
    tags: [] as string[],
  });

  useEffect(() => { fetchRecords(); fetchProjects(); }, []);
  useEffect(() => { filterRecords(); }, [records, searchQuery, selectedTag]);

  const fetchProjects = async () => {
    const { data } = await supabase.from("projects").select("id, title").order("title");
    if (data) setProjects(data);
  };

  const fetchRecords = async () => {
    const { data } = await supabase
      .from("execution_records")
      .select(`*, project:projects(title)`)
      .order("created_at", { ascending: false });
    if (data) {
      setRecords(data as ExecutionRecord[]);
      const tags = new Set<string>();
      data.forEach((record: ExecutionRecord) => { record.tags?.forEach((tag: string) => tags.add(tag)); });
      setAllTags(Array.from(tags));
    }
  };

  const filterRecords = () => {
    let filtered = records;
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((r) =>
        r.action_taken.toLowerCase().includes(query) ||
        r.result_obtained.toLowerCase().includes(query) ||
        r.lessons_learned.toLowerCase().includes(query) ||
        r.project?.title?.toLowerCase().includes(query)
      );
    }
    if (selectedTag) filtered = filtered.filter((r) => r.tags?.includes(selectedTag));
    setFilteredRecords(filtered);
  };

  const toggleExpanded = (id: string) => {
    const newExpanded = new Set(expandedRecords);
    if (newExpanded.has(id)) newExpanded.delete(id); else newExpanded.add(id);
    setExpandedRecords(newExpanded);
  };

  const deleteRecord = async (id: string) => {
    await supabase.from("execution_records").delete().eq("id", id);
    fetchRecords();
    toast({ title: "Registro removido!" });
  };

  const addTag = () => {
    const tag = tagInput.trim();
    if (tag && !form.tags.includes(tag)) { setForm({ ...form, tags: [...form.tags, tag] }); setTagInput(""); }
  };

  const removeTag = (tag: string) => { setForm({ ...form, tags: form.tags.filter((t) => t !== tag) }); };

  const resetForm = () => {
    setForm({ action_taken: "", result_obtained: "", lessons_learned: "", project_id: "", tags: [] });
    setEditingRecord(null);
    setTagInput("");
  };

  const openEdit = (record: ExecutionRecord) => {
    setEditingRecord(record);
    setForm({
      action_taken: record.action_taken,
      result_obtained: record.result_obtained,
      lessons_learned: record.lessons_learned,
      project_id: record.project_id || "",
      tags: record.tags || [],
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.action_taken.trim() || !form.result_obtained.trim() || !form.lessons_learned.trim()) {
      toast({ title: "Preencha todos os campos obrigatórios", variant: "destructive" });
      return;
    }
    const payload = {
      action_taken: form.action_taken,
      result_obtained: form.result_obtained,
      lessons_learned: form.lessons_learned,
      project_id: form.project_id || null,
      tags: form.tags,
    };
    const { error } = editingRecord
      ? await supabase.from("execution_records").update(payload).eq("id", editingRecord.id)
      : await supabase.from("execution_records").insert(payload);
    if (error) {
      toast({ title: "Erro ao salvar registro", variant: "destructive" });
      return;
    }
    toast({ title: editingRecord ? "Registro atualizado!" : "Registro criado com sucesso!" });
    setDialogOpen(false);
    resetForm();
    fetchRecords();
  };

  const containerVariants = { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.05 } } };
  const itemVariants = { hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0 } };

  return (
    <EMSLayout>
      <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-6">
        {/* Header */}
        <motion.div variants={itemVariants} className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl md:text-3xl font-heading font-bold text-foreground">Knowledge Base</h1>
            <p className="text-muted-foreground mt-1">Repositório de aprendizados e registros de execução</p>
          </div>
          <Button onClick={() => { resetForm(); setDialogOpen(true); }} className="gap-2">
            <Plus className="h-4 w-4" /> Novo Registro
          </Button>
        </motion.div>

        {/* Search */}
        <motion.div variants={itemVariants} className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Buscar por palavra-chave, projeto ou lição..." className="pl-10" />
          </div>
        </motion.div>

        {/* Tags Filter */}
        {allTags.length > 0 && (
          <motion.div variants={itemVariants} className="flex flex-wrap gap-2">
            <Button variant={selectedTag === null ? "default" : "outline"} size="sm" onClick={() => setSelectedTag(null)}>Todas</Button>
            {allTags.map((tag) => (
              <Button key={tag} variant={selectedTag === tag ? "default" : "outline"} size="sm" onClick={() => setSelectedTag(selectedTag === tag ? null : tag)}>
                <Tag className="h-3 w-3 mr-1" />{tag}
              </Button>
            ))}
          </motion.div>
        )}

        {/* Stats */}
        <motion.div variants={itemVariants} className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            { icon: BookOpen, value: records.length, label: "Total de Registros" },
            { icon: Tag, value: allTags.length, label: "Tags Únicas" },
            { icon: Lightbulb, value: filteredRecords.length, label: "Resultados Filtrados" },
          ].map((s) => (
            <Card key={s.label}>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10"><s.icon className="h-5 w-5 text-primary" /></div>
                  <div>
                    <p className="text-2xl font-bold">{s.value}</p>
                    <p className="text-sm text-muted-foreground">{s.label}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </motion.div>

        {/* Records List */}
        <motion.div variants={itemVariants} className="space-y-4">
          <AnimatePresence mode="popLayout">
            {filteredRecords.map((record) => (
              <motion.div key={record.id} layout initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
                <Collapsible open={expandedRecords.has(record.id)}>
                  <Card className="hover:border-primary/30 transition-colors">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <Calendar className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm text-muted-foreground">
                              {format(new Date(record.created_at), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                            </span>
                            {record.project?.title && (
                              <><span className="text-muted-foreground">•</span><Badge variant="outline">{record.project.title}</Badge></>
                            )}
                          </div>
                          <CardTitle className="text-lg font-medium line-clamp-2">{record.action_taken}</CardTitle>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(record)}>
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => deleteRecord(record.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                          <CollapsibleTrigger asChild>
                            <Button variant="ghost" size="icon" onClick={() => toggleExpanded(record.id)}>
                              {expandedRecords.has(record.id) ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                            </Button>
                          </CollapsibleTrigger>
                        </div>
                      </div>
                      {record.tags && record.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {record.tags.map((tag) => <Badge key={tag} variant="secondary" className="text-xs">{tag}</Badge>)}
                        </div>
                      )}
                    </CardHeader>
                    <CollapsibleContent>
                      <CardContent className="pt-0 space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="p-4 rounded-lg bg-muted/50">
                            <div className="flex items-center gap-2 mb-2">
                              <Target className="h-4 w-4 text-primary" />
                              <h4 className="font-medium text-sm">Resultado Obtido</h4>
                            </div>
                            <p className="text-sm text-muted-foreground">{record.result_obtained}</p>
                          </div>
                          <div className="p-4 rounded-lg bg-primary/5 border border-primary/10">
                            <div className="flex items-center gap-2 mb-2">
                              <Lightbulb className="h-4 w-4 text-primary" />
                              <h4 className="font-medium text-sm">Lições Aprendidas</h4>
                            </div>
                            <p className="text-sm text-muted-foreground">{record.lessons_learned}</p>
                          </div>
                        </div>
                      </CardContent>
                    </CollapsibleContent>
                  </Card>
                </Collapsible>
              </motion.div>
            ))}
          </AnimatePresence>

          {filteredRecords.length === 0 && (
            <Card className="border-dashed">
              <CardContent className="py-12 text-center">
                <BookOpen className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="font-medium text-foreground mb-2">Nenhum registro encontrado</h3>
                <p className="text-sm text-muted-foreground">
                  {records.length === 0 ? "Crie seu primeiro registro de conhecimento." : "Tente ajustar os filtros de busca."}
                </p>
                {records.length === 0 && (
                  <Button className="mt-4" onClick={() => { resetForm(); setDialogOpen(true); }}>
                    <Plus className="h-4 w-4 mr-2" /> Criar primeiro registro
                  </Button>
                )}
              </CardContent>
            </Card>
          )}
        </motion.div>
      </motion.div>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingRecord ? "Editar Registro" : "Novo Registro de Conhecimento"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Ação Realizada *</label>
              <Textarea value={form.action_taken} onChange={(e) => setForm({ ...form, action_taken: e.target.value })} placeholder="O que foi feito?" rows={2} />
            </div>
            <div>
              <label className="text-sm font-medium">Resultado Obtido *</label>
              <Textarea value={form.result_obtained} onChange={(e) => setForm({ ...form, result_obtained: e.target.value })} placeholder="Qual foi o resultado?" rows={2} />
            </div>
            <div>
              <label className="text-sm font-medium">Lições Aprendidas *</label>
              <Textarea value={form.lessons_learned} onChange={(e) => setForm({ ...form, lessons_learned: e.target.value })} placeholder="O que se aprendeu com isso?" rows={2} />
            </div>
            <div>
              <label className="text-sm font-medium">Projeto (opcional)</label>
              <Select value={form.project_id || "none"} onValueChange={(v) => setForm({ ...form, project_id: v === "none" ? "" : v })}>
                <SelectTrigger><SelectValue placeholder="Vincular a um projeto" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhum</SelectItem>
                  {projects.map((p) => <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">Tags</label>
              <div className="flex gap-2">
                <Input value={tagInput} onChange={(e) => setTagInput(e.target.value)} placeholder="Adicionar tag..."
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTag(); } }} />
                <Button variant="outline" size="icon" onClick={addTag} type="button"><Plus className="h-4 w-4" /></Button>
              </div>
              {form.tags.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {form.tags.map((tag) => (
                    <Badge key={tag} variant="secondary" className="gap-1">
                      {tag}<button onClick={() => removeTag(tag)}><X className="h-3 w-3" /></button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setDialogOpen(false); resetForm(); }}>Cancelar</Button>
            <Button onClick={handleSave} disabled={!form.action_taken.trim() || !form.result_obtained.trim() || !form.lessons_learned.trim()}>
              {editingRecord ? "Salvar Alterações" : "Criar Registro"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </EMSLayout>
  );
};

export default Knowledge;
