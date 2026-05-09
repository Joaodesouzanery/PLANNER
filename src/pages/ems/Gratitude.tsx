import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { EMSLayout } from "@/components/ems/EMSLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Heart, Plus, Trash2, Calendar } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useCompany } from "@/contexts/CompanyContext";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Entry { id: string; entry_date: string; content: string; mood: string | null; tags: string[] | null; created_at: string; }

const Gratitude = () => {
  const { toast } = useToast();
  const { selectedCompanyId } = useCompany();
  const qc = useQueryClient();
  const [content, setContent] = useState("");
  const [mood, setMood] = useState("");
  const [tagsInput, setTagsInput] = useState("");

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
      if (!content.trim()) throw new Error("Escreva pelo que você é grato.");
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
      setContent(""); setMood(""); setTagsInput("");
      qc.invalidateQueries({ queryKey: ["gratitude-entries"] });
      toast({ title: "Gratidão registrada 💛" });
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

  return (
    <EMSLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Heart className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-heading font-bold">Diário de Gratidão</h1>
            <p className="text-sm text-muted-foreground">Anote pelo que você é grato. A memória fica salva para consulta futura.</p>
          </div>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2"><Plus className="h-4 w-4" />Nova entrada</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Textarea value={content} onChange={(e) => setContent(e.target.value)} placeholder="Hoje sou grato por..." rows={4} />
            <div className="grid sm:grid-cols-2 gap-2">
              <Input value={mood} onChange={(e) => setMood(e.target.value)} placeholder="Humor (opcional): grato, leve, em paz..." />
              <Input value={tagsInput} onChange={(e) => setTagsInput(e.target.value)} placeholder="Tags separadas por vírgula" />
            </div>
            <Button onClick={() => create.mutate()} disabled={create.isPending} className="w-full sm:w-auto">
              <Plus className="h-4 w-4 mr-2" />Salvar gratidão
            </Button>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Histórico</h2>
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
                    <CardContent className="p-4 space-y-2">
                      <div className="flex justify-between gap-2">
                        <p className="text-sm whitespace-pre-wrap flex-1">{e.content}</p>
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
      </div>
    </EMSLayout>
  );
};

export default Gratitude;
