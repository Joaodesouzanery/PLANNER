import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { BookOpen, Brain, Calendar, CheckCircle2, Heart, Plus, Sparkles, Trash2 } from "lucide-react";
import { EMSLayout } from "@/components/ems/EMSLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useCompany } from "@/contexts/CompanyContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface Entry {
  id: string;
  entry_date: string;
  content: string;
  mood: string | null;
  tags: string[] | null;
  created_at: string;
}

interface SpiritualPhrase {
  id: string;
  content: string;
  tags: string[];
  created_at: string;
}

interface SpiritualRoutine {
  id: string;
  title: string;
  cadence: string;
  notes: string;
  completed: boolean;
  created_at: string;
}

interface TarantinoArea {
  id: string;
  name: string;
}

interface TarantinoItem {
  id: string;
  area_id: string;
  problem: string;
  solution: string;
  status: string;
  created_at: string;
}

const makeId = () => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const readLocal = <T,>(key: string, fallback: T): T => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
};

const Gratitude = () => {
  const { toast } = useToast();
  const { selectedCompanyId } = useCompany();
  const qc = useQueryClient();
  const [content, setContent] = useState("");
  const [mood, setMood] = useState("");
  const [tagsInput, setTagsInput] = useState("");

  const localScope = selectedCompanyId === "all" ? "global" : selectedCompanyId;
  const spiritualKey = `planner:gratitude:spiritual:${localScope}`;
  const tarantinoKey = `planner:gratitude:tarantino:${localScope}`;

  const [spiritualPhrase, setSpiritualPhrase] = useState("");
  const [spiritualTags, setSpiritualTags] = useState("");
  const [routineForm, setRoutineForm] = useState({ title: "", cadence: "diaria", notes: "" });
  const [spiritualPhrases, setSpiritualPhrases] = useState<SpiritualPhrase[]>([]);
  const [spiritualRoutines, setSpiritualRoutines] = useState<SpiritualRoutine[]>([]);
  const [localReady, setLocalReady] = useState(false);

  const [areaInput, setAreaInput] = useState("");
  const [areaFilter, setAreaFilter] = useState("all");
  const [tarantinoForm, setTarantinoForm] = useState({ area_id: "none", problem: "", solution: "", status: "aberto" });
  const [tarantinoAreas, setTarantinoAreas] = useState<TarantinoArea[]>([]);
  const [tarantinoItems, setTarantinoItems] = useState<TarantinoItem[]>([]);

  useEffect(() => {
    setLocalReady(false);
    const spiritual = readLocal<{ phrases: SpiritualPhrase[]; routines: SpiritualRoutine[] }>(spiritualKey, { phrases: [], routines: [] });
    setSpiritualPhrases(spiritual.phrases);
    setSpiritualRoutines(spiritual.routines);

    const tarantino = readLocal<{ areas: TarantinoArea[]; items: TarantinoItem[] }>(tarantinoKey, {
      areas: [
        { id: "relacionamento", name: "Relacionamento" },
        { id: "dinheiro", name: "Dinheiro" },
        { id: "familia", name: "Familia" },
      ],
      items: [],
    });
    setTarantinoAreas(tarantino.areas);
    setTarantinoItems(tarantino.items);
    setAreaFilter("all");
    setTarantinoForm((current) => ({ ...current, area_id: tarantino.areas[0]?.id || "none" }));
    setLocalReady(true);
  }, [spiritualKey, tarantinoKey]);

  useEffect(() => {
    if (!localReady) return;
    localStorage.setItem(spiritualKey, JSON.stringify({ phrases: spiritualPhrases, routines: spiritualRoutines }));
  }, [localReady, spiritualKey, spiritualPhrases, spiritualRoutines]);

  useEffect(() => {
    if (!localReady) return;
    localStorage.setItem(tarantinoKey, JSON.stringify({ areas: tarantinoAreas, items: tarantinoItems }));
  }, [localReady, tarantinoKey, tarantinoAreas, tarantinoItems]);

  const { data: entries = [], isLoading } = useQuery({
    queryKey: ["gratitude-entries", selectedCompanyId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("gratitude_entries")
        .select("*")
        .order("entry_date", { ascending: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as Entry[];
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      if (!content.trim()) throw new Error("Escreva pelo que voce e grato.");
      const tags = tagsInput.split(",").map((t) => t.trim()).filter(Boolean);
      const payload: any = {
        content: content.trim(),
        mood: mood.trim() || null,
        tags,
        entry_date: new Date().toISOString().slice(0, 10),
      };
      if (selectedCompanyId !== "all") payload.company_id = selectedCompanyId;
      const { error } = await (supabase as any).from("gratitude_entries").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      setContent("");
      setMood("");
      setTagsInput("");
      qc.invalidateQueries({ queryKey: ["gratitude-entries"] });
      toast({ title: "Gratidao registrada" });
    },
    onError: (e: any) => toast({ title: "Erro ao salvar", description: e.message, variant: "destructive" }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("gratitude_entries").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["gratitude-entries"] });
      toast({ title: "Entrada removida" });
    },
  });

  const grouped = entries.reduce<Record<string, Entry[]>>((acc, e) => {
    (acc[e.entry_date] ||= []).push(e);
    return acc;
  }, {});

  const addSpiritualPhrase = () => {
    if (!spiritualPhrase.trim()) {
      toast({ title: "Escreva uma frase espiritual", variant: "destructive" });
      return;
    }
    const tags = spiritualTags.split(",").map((tag) => tag.trim()).filter(Boolean);
    setSpiritualPhrases((current) => [{ id: makeId(), content: spiritualPhrase.trim(), tags, created_at: new Date().toISOString() }, ...current]);
    setSpiritualPhrase("");
    setSpiritualTags("");
    toast({ title: "Frase espiritual salva localmente" });
  };

  const addSpiritualRoutine = () => {
    if (!routineForm.title.trim()) {
      toast({ title: "Informe a rotina espiritual", variant: "destructive" });
      return;
    }
    setSpiritualRoutines((current) => [{
      id: makeId(),
      title: routineForm.title.trim(),
      cadence: routineForm.cadence,
      notes: routineForm.notes.trim(),
      completed: false,
      created_at: new Date().toISOString(),
    }, ...current]);
    setRoutineForm({ title: "", cadence: "diaria", notes: "" });
    toast({ title: "Rotina espiritual salva localmente" });
  };

  const addTarantinoArea = () => {
    const name = areaInput.trim();
    if (!name) return;
    const exists = tarantinoAreas.some((area) => area.name.toLowerCase() === name.toLowerCase());
    if (exists) {
      toast({ title: "Area ja existe", variant: "destructive" });
      return;
    }
    const area = { id: makeId(), name };
    setTarantinoAreas((current) => [...current, area]);
    setTarantinoForm((current) => ({ ...current, area_id: area.id }));
    setAreaInput("");
    toast({ title: "Filtro de area criado" });
  };

  const addTarantinoItem = () => {
    if (tarantinoForm.area_id === "none" || !tarantinoForm.problem.trim() || !tarantinoForm.solution.trim()) {
      toast({ title: "Preencha area, problema e solucao", variant: "destructive" });
      return;
    }
    setTarantinoItems((current) => [{
      id: makeId(),
      area_id: tarantinoForm.area_id,
      problem: tarantinoForm.problem.trim(),
      solution: tarantinoForm.solution.trim(),
      status: tarantinoForm.status,
      created_at: new Date().toISOString(),
    }, ...current]);
    setTarantinoForm((current) => ({ ...current, problem: "", solution: "", status: "aberto" }));
    toast({ title: "Problema e solucao salvos localmente" });
  };

  const areaName = (id: string) => tarantinoAreas.find((area) => area.id === id)?.name || "Sem area";
  const filteredTarantinoItems = useMemo(
    () => tarantinoItems.filter((item) => areaFilter === "all" || item.area_id === areaFilter),
    [areaFilter, tarantinoItems],
  );

  return (
    <EMSLayout>
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
            <Heart className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-heading font-bold">Diario de Gratidao</h1>
            <p className="text-sm text-muted-foreground">Anote gratidoes, frases espirituais, rotinas e mapas de problema x solucao.</p>
          </div>
        </div>

        <Tabs defaultValue="gratidao" className="space-y-4">
          <TabsList className="grid w-full grid-cols-3 md:w-auto">
            <TabsTrigger value="gratidao" className="gap-2"><Heart className="h-3.5 w-3.5" /> Gratidao</TabsTrigger>
            <TabsTrigger value="espiritual" className="gap-2"><Sparkles className="h-3.5 w-3.5" /> Espiritual</TabsTrigger>
            <TabsTrigger value="tarantino" className="gap-2"><Brain className="h-3.5 w-3.5" /> Tarantino</TabsTrigger>
          </TabsList>

          <TabsContent value="gratidao" className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base"><Plus className="h-4 w-4" />Nova entrada</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Textarea value={content} onChange={(e) => setContent(e.target.value)} placeholder="Hoje sou grato por..." rows={4} />
                <div className="grid gap-2 sm:grid-cols-2">
                  <Input value={mood} onChange={(e) => setMood(e.target.value)} placeholder="Humor (opcional): grato, leve, em paz..." />
                  <Input value={tagsInput} onChange={(e) => setTagsInput(e.target.value)} placeholder="Tags separadas por virgula" />
                </div>
                <Button onClick={() => create.mutate()} disabled={create.isPending} className="w-full sm:w-auto">
                  <Plus className="mr-2 h-4 w-4" />Salvar gratidao
                </Button>
              </CardContent>
            </Card>

            <div className="space-y-4">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Historico</h2>
              {isLoading ? (
                <div className="space-y-2"><Skeleton className="h-24 w-full" /><Skeleton className="h-24 w-full" /></div>
              ) : entries.length === 0 ? (
                <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">Nenhuma entrada ainda. Comece agora.</CardContent></Card>
              ) : (
                Object.entries(grouped).map(([date, list]) => (
                  <div key={date} className="space-y-2">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Calendar className="h-3.5 w-3.5" />
                      <span>{format(parseISO(date), "EEEE, d 'de' MMMM 'de' yyyy", { locale: ptBR })}</span>
                    </div>
                    {list.map((e) => (
                      <Card key={e.id} className="border-border/50">
                        <CardContent className="space-y-2 p-4">
                          <div className="flex justify-between gap-2">
                            <p className="flex-1 whitespace-pre-wrap text-sm">{e.content}</p>
                            <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => remove.mutate(e.id)}>
                              <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                            </Button>
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {e.mood && <Badge variant="outline" className="text-[10px]">{e.mood}</Badge>}
                            {e.tags?.map((t) => <Badge key={t} variant="secondary" className="text-[10px]">#{t}</Badge>)}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ))
              )}
            </div>
          </TabsContent>

          <TabsContent value="espiritual" className="space-y-4">
            <div className="grid gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base"><BookOpen className="h-4 w-4" />Frases espirituais</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Textarea value={spiritualPhrase} onChange={(event) => setSpiritualPhrase(event.target.value)} placeholder="Anote uma frase, oracao, insight ou principio espiritual..." rows={4} />
                  <Input value={spiritualTags} onChange={(event) => setSpiritualTags(event.target.value)} placeholder="Tags separadas por virgula" />
                  <Button onClick={addSpiritualPhrase} className="w-full sm:w-auto"><Plus className="mr-2 h-4 w-4" />Salvar frase</Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base"><CheckCircle2 className="h-4 w-4" />Rotinas espirituais</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Input value={routineForm.title} onChange={(event) => setRoutineForm({ ...routineForm, title: event.target.value })} placeholder="Ex: oracao, leitura, meditacao, exame de consciencia..." />
                  <div className="grid gap-2 sm:grid-cols-2">
                    <Select value={routineForm.cadence} onValueChange={(value) => setRoutineForm({ ...routineForm, cadence: value })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="diaria">Diaria</SelectItem>
                        <SelectItem value="semanal">Semanal</SelectItem>
                        <SelectItem value="mensal">Mensal</SelectItem>
                        <SelectItem value="livre">Livre</SelectItem>
                      </SelectContent>
                    </Select>
                    <Input value={routineForm.notes} onChange={(event) => setRoutineForm({ ...routineForm, notes: event.target.value })} placeholder="Notas rapidas" />
                  </div>
                  <Button onClick={addSpiritualRoutine} className="w-full sm:w-auto"><Plus className="mr-2 h-4 w-4" />Salvar rotina</Button>
                </CardContent>
              </Card>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader><CardTitle className="text-base">Frases salvas</CardTitle></CardHeader>
                <CardContent className="space-y-2">
                  {spiritualPhrases.length === 0 ? <p className="py-8 text-center text-sm text-muted-foreground">Nenhuma frase espiritual salva.</p> : spiritualPhrases.map((phrase) => (
                    <div key={phrase.id} className="rounded-lg border border-border/50 p-3">
                      <div className="flex justify-between gap-2">
                        <p className="whitespace-pre-wrap text-sm">{phrase.content}</p>
                        <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => setSpiritualPhrases((current) => current.filter((item) => item.id !== phrase.id))}>
                          <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                        </Button>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {phrase.tags.map((tag) => <Badge key={tag} variant="secondary" className="text-[10px]">#{tag}</Badge>)}
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle className="text-base">Rotinas salvas</CardTitle></CardHeader>
                <CardContent className="space-y-2">
                  {spiritualRoutines.length === 0 ? <p className="py-8 text-center text-sm text-muted-foreground">Nenhuma rotina espiritual salva.</p> : spiritualRoutines.map((routine) => (
                    <div key={routine.id} className="rounded-lg border border-border/50 p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-semibold">{routine.title}</p>
                          <p className="text-xs text-muted-foreground">{routine.cadence}{routine.notes ? ` - ${routine.notes}` : ""}</p>
                        </div>
                        <div className="flex gap-1">
                          <Button variant={routine.completed ? "default" : "outline"} size="sm" className="h-7 text-xs" onClick={() => setSpiritualRoutines((current) => current.map((item) => item.id === routine.id ? { ...item, completed: !item.completed } : item))}>
                            {routine.completed ? "Feita" : "Marcar"}
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setSpiritualRoutines((current) => current.filter((item) => item.id !== routine.id))}>
                            <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="tarantino" className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base"><Brain className="h-4 w-4" />Tarantino: Problemas x Solucoes</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                  <Input value={areaInput} onChange={(event) => setAreaInput(event.target.value)} placeholder="Criar filtro/area: relacionamento, dinheiro, familia..." />
                  <Button onClick={addTarantinoArea} variant="outline"><Plus className="mr-2 h-4 w-4" />Criar area</Button>
                </div>
                <div className="grid gap-3 md:grid-cols-3">
                  <div>
                    <Label className="text-xs">Area</Label>
                    <Select value={tarantinoForm.area_id} onValueChange={(value) => setTarantinoForm({ ...tarantinoForm, area_id: value })}>
                      <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Escolha uma area</SelectItem>
                        {tarantinoAreas.map((area) => <SelectItem key={area.id} value={area.id}>{area.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">Status</Label>
                    <Select value={tarantinoForm.status} onValueChange={(value) => setTarantinoForm({ ...tarantinoForm, status: value })}>
                      <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="aberto">Aberto</SelectItem>
                        <SelectItem value="testando">Testando</SelectItem>
                        <SelectItem value="resolvido">Resolvido</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">Filtrar tabela</Label>
                    <Select value={areaFilter} onValueChange={setAreaFilter}>
                      <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todas as areas</SelectItem>
                        {tarantinoAreas.map((area) => <SelectItem key={area.id} value={area.id}>{area.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <Textarea value={tarantinoForm.problem} onChange={(event) => setTarantinoForm({ ...tarantinoForm, problem: event.target.value })} placeholder="Problema..." rows={4} />
                  <Textarea value={tarantinoForm.solution} onChange={(event) => setTarantinoForm({ ...tarantinoForm, solution: event.target.value })} placeholder="Solucoes possiveis..." rows={4} />
                </div>
                <Button onClick={addTarantinoItem} className="w-full sm:w-auto"><Plus className="mr-2 h-4 w-4" />Adicionar na tabela</Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  Tabela
                  <Badge variant="outline" className="ml-auto text-[10px]">{filteredTarantinoItems.length}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {filteredTarantinoItems.length === 0 ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">Nenhum problema cadastrado neste filtro.</p>
                ) : filteredTarantinoItems.map((item) => (
                  <div key={item.id} className="grid gap-3 rounded-lg border border-border/50 p-3 lg:grid-cols-[0.8fr_1fr_auto]">
                    <div>
                      <div className="mb-2 flex flex-wrap gap-1.5">
                        <Badge variant="secondary" className="text-[10px]">{areaName(item.area_id)}</Badge>
                        <Badge variant={item.status === "resolvido" ? "default" : "outline"} className="text-[10px]">{item.status}</Badge>
                      </div>
                      <p className="whitespace-pre-wrap text-sm">{item.problem}</p>
                    </div>
                    <p className="whitespace-pre-wrap text-sm text-muted-foreground">{item.solution}</p>
                    <Button variant="ghost" size="icon" className="h-7 w-7 justify-self-end" onClick={() => setTarantinoItems((current) => current.filter((row) => row.id !== item.id))}>
                      <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </EMSLayout>
  );
};

export default Gratitude;
