import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Library, Search, Trash2, Copy, Check, Tag, Linkedin, FileText, Bot } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import ReactMarkdown from "react-markdown";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

interface AIGen {
  id: string;
  type: string;
  title: string | null;
  content: string;
  tags: string[];
  metadata: any;
  created_at: string;
}

const typeConfig: Record<string, { label: string; icon: typeof Linkedin; color: string }> = {
  linkedin_outreach: { label: "Outreach LinkedIn", icon: Linkedin, color: "text-blue-500 bg-blue-500/10 border-blue-500/30" },
  linkedin_post: { label: "Post LinkedIn", icon: FileText, color: "text-emerald-500 bg-emerald-500/10 border-emerald-500/30" },
  chat: { label: "Chat", icon: Bot, color: "text-purple-500 bg-purple-500/10 border-purple-500/30" },
};

export const AILibrary = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [tagFilter, setTagFilter] = useState<string>("all");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const { data: generations = [], isLoading } = useQuery({
    queryKey: ["ai_generations"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("ai_generations")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as AIGen[];
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("ai_generations").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ai_generations"] });
      toast({ title: "Removido" });
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const allTags = useMemo(() => {
    const set = new Set<string>();
    generations.forEach((g) => g.tags?.forEach((t) => set.add(t)));
    return Array.from(set).sort();
  }, [generations]);

  const filtered = useMemo(() => {
    return generations.filter((g) => {
      const matchSearch =
        !search ||
        g.content.toLowerCase().includes(search.toLowerCase()) ||
        (g.title && g.title.toLowerCase().includes(search.toLowerCase())) ||
        g.tags?.some((t) => t.toLowerCase().includes(search.toLowerCase()));
      const matchType = typeFilter === "all" || g.type === typeFilter;
      const matchTag = tagFilter === "all" || g.tags?.includes(tagFilter);
      return matchSearch && matchType && matchTag;
    });
  }, [generations, search, typeFilter, tagFilter]);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    toast({ title: "Copiado!" });
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Library className="h-4 w-4 text-primary" /> Biblioteca de Gerações IA
            <Badge variant="secondary" className="ml-auto">{generations.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por conteúdo, título, tag..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-full sm:w-[180px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os tipos</SelectItem>
                <SelectItem value="linkedin_outreach">Outreach</SelectItem>
                <SelectItem value="linkedin_post">Posts</SelectItem>
                <SelectItem value="chat">Chat</SelectItem>
              </SelectContent>
            </Select>
            <Select value={tagFilter} onValueChange={setTagFilter}>
              <SelectTrigger className="w-full sm:w-[160px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas tags</SelectItem>
                {allTags.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="space-y-2">
          {[...Array(3)].map((_, i) => <div key={i} className="h-32 rounded-xl bg-muted/30 animate-pulse" />)}
        </div>
      ) : filtered.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center">
            <Library className="h-10 w-10 mx-auto mb-2 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">
              {generations.length === 0 ? "Nenhuma geração salva ainda." : "Nenhum resultado para os filtros."}
            </p>
            <p className="text-xs text-muted-foreground/60 mt-1">
              Use "Salvar" nas abas Outreach e Posts para adicionar aqui.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          <AnimatePresence>
            {filtered.map((g) => {
              const conf = typeConfig[g.type] || typeConfig.chat;
              const Icon = conf.icon;
              return (
                <motion.div
                  key={g.id}
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                >
                  <Card className="hover:shadow-md transition-shadow">
                    <CardContent className="p-4 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant="outline" className={cn("text-[10px] gap-1", conf.color)}>
                            <Icon className="h-3 w-3" /> {conf.label}
                          </Badge>
                          {g.title && <span className="text-sm font-medium">{g.title}</span>}
                          <span className="text-[10px] text-muted-foreground">
                            {format(new Date(g.created_at), "dd/MM HH:mm", { locale: ptBR })}
                          </span>
                        </div>
                        <div className="flex gap-1 shrink-0">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => copyToClipboard(g.content, g.id)}
                          >
                            {copiedId === g.id ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-destructive"
                            onClick={() => deleteMutation.mutate(g.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                      {g.tags?.length > 0 && (
                        <div className="flex gap-1 flex-wrap">
                          {g.tags.map((t) => (
                            <Badge key={t} variant="secondary" className="text-[10px] gap-1">
                              <Tag className="h-2.5 w-2.5" />{t}
                            </Badge>
                          ))}
                        </div>
                      )}
                      <div className="prose prose-sm dark:prose-invert max-w-none prose-p:my-1 text-xs max-h-48 overflow-y-auto bg-muted/30 rounded-lg p-3">
                        <ReactMarkdown>{g.content}</ReactMarkdown>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
};

export default AILibrary;
