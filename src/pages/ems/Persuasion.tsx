import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { EMSLayout } from "@/components/ems/EMSLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useCompany } from "@/contexts/CompanyContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { BrainCircuit, Edit2, Filter, Network, Plus, Search, Sparkles, Trash2 } from "lucide-react";

interface PersuasionNote {
  id: string;
  storage?: "persuasion_notes" | "quick_notes";
  title: string;
  category: string | null;
  principle: string | null;
  content: string | null;
  example: string | null;
  source: string | null;
  tags: string[] | null;
  confidence: string | null;
  updated_at: string;
}

const emptyForm = {
  title: "",
  category: "principio",
  principle: "",
  content: "",
  example: "",
  source: "",
  tags: "",
  confidence: "medium",
};

const categories = [
  { value: "principio", label: "Principio" },
  { value: "copywriting", label: "Copywriting" },
  { value: "negociacao", label: "Negociacao" },
  { value: "vendas", label: "Vendas" },
  { value: "storytelling", label: "Storytelling" },
  { value: "gatilho", label: "Gatilho" },
  { value: "objeção", label: "Objecao" },
];

const confidenceLabel: Record<string, string> = {
  high: "Alta confianca",
  medium: "Media confianca",
  low: "A testar",
};

const missingTable = (error: any) =>
  error?.code === "42P01" || error?.code === "PGRST205" || String(error?.message || "").includes("Could not find the table");

const fallbackMarker = "__PERSUASION_NOTE__";

const encodeFallbackNote = (payload: Record<string, any>) => `${fallbackMarker}${JSON.stringify(payload)}`;

const decodeFallbackNote = (row: any): PersuasionNote | null => {
  const content = String(row.content || "");
  if (!content.startsWith(fallbackMarker)) return null;
  try {
    const payload = JSON.parse(content.slice(fallbackMarker.length));
    return {
      id: row.id,
      storage: "quick_notes",
      title: payload.title || "Estudo sem titulo",
      category: payload.category || "principio",
      principle: payload.principle || null,
      content: payload.content || null,
      example: payload.example || null,
      source: payload.source || null,
      tags: Array.isArray(payload.tags) ? payload.tags : [],
      confidence: payload.confidence || "medium",
      updated_at: row.updated_at || row.created_at,
    };
  } catch {
    return null;
  }
};

const Persuasion = () => {
  const { selectedCompanyId } = useCompany();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<PersuasionNote | null>(null);
  const [form, setForm] = useState(emptyForm);

  const { data: notes = [], isLoading } = useQuery({
    queryKey: ["persuasion_notes", selectedCompanyId],
    queryFn: async () => {
      let query = (supabase as any).from("persuasion_notes").select("*").order("updated_at", { ascending: false });
      if (selectedCompanyId !== "all") query = query.eq("company_id", selectedCompanyId);
      const { data, error } = await query;
      if (missingTable(error)) {
        let fallbackQuery = supabase
          .from("quick_notes")
          .select("id, content, created_at, updated_at")
          .ilike("content", `${fallbackMarker}%`)
          .order("updated_at", { ascending: false });
        if (selectedCompanyId !== "all") fallbackQuery = fallbackQuery.eq("company_id", selectedCompanyId);
        const fallback = await fallbackQuery;
        if (fallback.error) throw fallback.error;
        return (fallback.data || []).map(decodeFallbackNote).filter(Boolean) as PersuasionNote[];
      }
      if (error) throw error;
      return (data || []).map((note: PersuasionNote) => ({ ...note, storage: "persuasion_notes" as const })) as PersuasionNote[];
    },
    retry: false,
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        title: form.title.trim(),
        category: form.category,
        principle: form.principle.trim() || null,
        content: form.content.trim() || null,
        example: form.example.trim() || null,
        source: form.source.trim() || null,
        tags: form.tags.split(",").map((tag) => tag.trim()).filter(Boolean),
        confidence: form.confidence,
        company_id: selectedCompanyId !== "all" ? selectedCompanyId : null,
      };
      if (!payload.title) throw new Error("Informe um titulo.");
      const query = (supabase as any).from("persuasion_notes");
      const { error } = editing ? await query.update(payload).eq("id", editing.id) : await query.insert(payload);
      if (!missingTable(error)) {
        if (error) throw error;
        return;
      }

      const fallbackPayload = {
        content: encodeFallbackNote(payload),
        color: "purple",
        pinned: false,
        company_id: selectedCompanyId !== "all" ? selectedCompanyId : null,
      };
      const fallbackQuery = supabase.from("quick_notes");
      const fallbackResult = editing?.storage === "quick_notes"
        ? await fallbackQuery.update(fallbackPayload).eq("id", editing.id)
        : await fallbackQuery.insert(fallbackPayload);
      if (fallbackResult.error) throw fallbackResult.error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["persuasion_notes"] });
      setDialogOpen(false);
      setEditing(null);
      setForm(emptyForm);
      toast({ title: "Estudo salvo" });
    },
    onError: (error: any) => toast({ title: "Erro ao salvar", description: error?.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (note: PersuasionNote) => {
      if (note.storage === "quick_notes") {
        const { error } = await supabase.from("quick_notes").delete().eq("id", note.id);
        if (error) throw error;
        return;
      }
      const { error } = await (supabase as any).from("persuasion_notes").delete().eq("id", note.id);
      if (!missingTable(error)) {
        if (error) throw error;
        return;
      }
      const { error: fallbackError } = await supabase.from("quick_notes").delete().eq("id", note.id);
      if (fallbackError) throw fallbackError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["persuasion_notes"] });
      toast({ title: "Estudo excluido" });
    },
    onError: (error: any) => toast({ title: "Erro ao excluir", description: error?.message, variant: "destructive" }),
  });

  const filteredNotes = useMemo(() => notes.filter((note) => {
    const term = search.trim().toLowerCase();
    const matchesSearch = !term || [note.title, note.principle, note.content, note.example, note.source, ...(note.tags || [])]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(term));
    const matchesCategory = categoryFilter === "all" || note.category === categoryFilter;
    return matchesSearch && matchesCategory;
  }), [notes, search, categoryFilter]);

  const categoryTotals = useMemo(() => categories.map((category) => ({
    ...category,
    count: notes.filter((note) => note.category === category.value).length,
  })), [notes]);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (note: PersuasionNote) => {
    setEditing(note);
    setForm({
      title: note.title,
      category: note.category || "principio",
      principle: note.principle || "",
      content: note.content || "",
      example: note.example || "",
      source: note.source || "",
      tags: (note.tags || []).join(", "),
      confidence: note.confidence || "medium",
    });
    setDialogOpen(true);
  };

  const graphNodes = filteredNotes.slice(0, 10);

  return (
    <EMSLayout>
      <div className="space-y-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl md:text-3xl font-heading font-bold flex items-center gap-2">
              <BrainCircuit className="h-7 w-7 text-primary" />Persuasao
            </h1>
            <p className="text-sm text-muted-foreground">Estudos, principios, gatilhos e exemplos prontos para consultar.</p>
          </div>
          <Button onClick={openCreate} className="w-full md:w-auto">
            <Plus className="h-4 w-4 mr-2" />Novo estudo
          </Button>
        </div>

        <div className="grid gap-3 md:grid-cols-[1fr_220px]">
          <div className="relative">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar por titulo, tag, fonte ou exemplo" className="pl-9" />
          </div>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger><Filter className="h-4 w-4 mr-2" /><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas categorias</SelectItem>
              {categories.map((category) => <SelectItem key={category.value} value={category.value}>{category.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7">
          {categoryTotals.map((category) => (
            <Card key={category.value} className="border-border/60">
              <CardContent className="p-3">
                <p className="text-xs text-muted-foreground truncate">{category.label}</p>
                <p className="text-xl font-bold">{category.count}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <Tabs defaultValue="graph" className="space-y-4">
          <TabsList className="grid w-full grid-cols-2 md:w-[360px]">
            <TabsTrigger value="graph" className="gap-1.5"><Network className="h-4 w-4" />Grafo</TabsTrigger>
            <TabsTrigger value="list" className="gap-1.5"><Sparkles className="h-4 w-4" />Lista</TabsTrigger>
          </TabsList>

          <TabsContent value="graph">
            <Card className="overflow-hidden">
              <CardContent className="p-0">
                <div
                  className="relative min-h-[520px] overflow-x-auto bg-background"
                  style={{
                    backgroundImage: "linear-gradient(hsl(var(--border) / .18) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--border) / .18) 1px, transparent 1px)",
                    backgroundSize: "20px 20px",
                  }}
                >
                  <div className="relative min-w-[760px] h-[520px]">
                    <svg className="absolute inset-0 h-full w-full pointer-events-none" viewBox="0 0 100 100" preserveAspectRatio="none">
                      {graphNodes.map((_, index) => {
                        const angle = (Math.PI * 2 * index) / Math.max(graphNodes.length, 1);
                        const x = 50 + Math.cos(angle) * 31;
                        const y = 50 + Math.sin(angle) * 34;
                        return <line key={index} x1="50" y1="50" x2={x} y2={y} stroke="hsl(var(--border))" strokeWidth="0.3" strokeDasharray="1.5 1.5" />;
                      })}
                    </svg>
                    <div className="absolute left-1/2 top-1/2 z-10 w-44 -translate-x-1/2 -translate-y-1/2 rounded-xl border border-primary/40 bg-card/95 p-4 text-center shadow-lg">
                      <BrainCircuit className="h-6 w-6 mx-auto text-primary mb-2" />
                      <p className="font-semibold">Biblioteca de Persuasao</p>
                      <p className="text-xs text-muted-foreground">{filteredNotes.length} estudos filtrados</p>
                    </div>
                    {graphNodes.map((note, index) => {
                      const angle = (Math.PI * 2 * index) / Math.max(graphNodes.length, 1);
                      const left = 50 + Math.cos(angle) * 35;
                      const top = 50 + Math.sin(angle) * 37;
                      return (
                        <button
                          key={note.id}
                          className="absolute z-20 w-52 -translate-x-1/2 -translate-y-1/2 rounded-xl border border-border/70 bg-card/95 p-3 text-left shadow-md transition hover:border-primary/50 hover:bg-primary/5"
                          style={{ left: `${left}%`, top: `${top}%` }}
                          onClick={() => openEdit(note)}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-sm font-semibold line-clamp-2">{note.title}</p>
                            <Badge variant="outline" className="shrink-0 text-[10px]">{categories.find((c) => c.value === note.category)?.label || note.category}</Badge>
                          </div>
                          <p className="text-xs text-muted-foreground mt-2 line-clamp-2">{note.principle || note.content || "Sem resumo"}</p>
                        </button>
                      );
                    })}
                    {!isLoading && graphNodes.length === 0 && (
                      <div className="absolute left-1/2 top-[70%] -translate-x-1/2 text-center text-sm text-muted-foreground">
                        Nenhum estudo encontrado.
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="list">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {filteredNotes.map((note) => (
                <Card key={note.id} className="border-border/60">
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <CardTitle className="text-base line-clamp-2">{note.title}</CardTitle>
                        <p className="text-xs text-muted-foreground">{note.source || "Sem fonte informada"}</p>
                      </div>
                      <Badge variant="secondary" className="shrink-0">{confidenceLabel[note.confidence || "medium"] || note.confidence}</Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <p className="text-sm text-muted-foreground line-clamp-3">{note.principle || note.content || "Sem anotacao."}</p>
                    {note.example && <p className="text-sm rounded-lg bg-muted/40 p-2 line-clamp-3">{note.example}</p>}
                    <div className="flex flex-wrap gap-1">
                      {(note.tags || []).map((tag) => <Badge key={tag} variant="outline" className="text-[10px]">{tag}</Badge>)}
                    </div>
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(note)}><Edit2 className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" className="text-destructive" onClick={() => deleteMutation.mutate(note)}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
            {!isLoading && filteredNotes.length === 0 && (
              <Card className="border-dashed">
                <CardContent className="py-12 text-center text-sm text-muted-foreground">Nenhum estudo encontrado.</CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-[95vw] sm:max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>{editing ? "Editar estudo" : "Novo estudo de persuasao"}</DialogTitle></DialogHeader>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Titulo *</Label>
                <Input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="Ex: Reciprocidade em negociacoes" />
              </div>
              <div className="space-y-1.5">
                <Label>Categoria</Label>
                <Select value={form.category} onValueChange={(value) => setForm({ ...form, category: value })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{categories.map((category) => <SelectItem key={category.value} value={category.value}>{category.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Confianca</Label>
                <Select value={form.confidence} onValueChange={(value) => setForm({ ...form, confidence: value })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="high">Alta</SelectItem>
                    <SelectItem value="medium">Media</SelectItem>
                    <SelectItem value="low">A testar</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Principio / tese</Label>
                <Textarea rows={3} value={form.principle} onChange={(event) => setForm({ ...form, principle: event.target.value })} />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Anotacoes do estudo</Label>
                <Textarea rows={5} value={form.content} onChange={(event) => setForm({ ...form, content: event.target.value })} />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Exemplo / aplicacao</Label>
                <Textarea rows={3} value={form.example} onChange={(event) => setForm({ ...form, example: event.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Fonte</Label>
                <Input value={form.source} onChange={(event) => setForm({ ...form, source: event.target.value })} placeholder="Livro, curso, video..." />
              </div>
              <div className="space-y-1.5">
                <Label>Tags</Label>
                <Input value={form.tags} onChange={(event) => setForm({ ...form, tags: event.target.value })} placeholder="separadas por virgula" />
              </div>
            </div>
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
              <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>Salvar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </EMSLayout>
  );
};

export default Persuasion;
