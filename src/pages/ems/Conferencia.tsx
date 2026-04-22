import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { EMSLayout } from "@/components/ems/EMSLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Plus,
  Edit2,
  Trash2,
  ShieldCheck,
  FileText,
  Sparkles,
  Paperclip,
  Search,
  Copy,
  Download,
} from "lucide-react";
import { toast } from "sonner";

interface Stage {
  id: string;
  title: string;
  description: string | null;
  icon: string;
  color: string;
  order_index: number | null;
  status: string | null;
  company_id: string | null;
}

interface Item {
  id: string;
  stage_id: string;
  type: string;
  title: string;
  content: string | null;
  attachment_url: string | null;
  attachment_name: string | null;
  tags: string[] | null;
  order_index: number | null;
  company_id: string | null;
}

const ITEM_TYPES = [
  { value: "text", label: "Texto", icon: FileText },
  { value: "prompt", label: "Prompt", icon: Sparkles },
  { value: "document", label: "Documento", icon: Paperclip },
];

const Conferencia = () => {
  const { selectedCompanyId } = useCompany();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");

  // Stage dialog
  const [stageDialog, setStageDialog] = useState(false);
  const [editingStage, setEditingStage] = useState<Stage | null>(null);
  const [stageForm, setStageForm] = useState({ title: "", description: "" });

  // Item dialog
  const [itemDialog, setItemDialog] = useState(false);
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [itemStageId, setItemStageId] = useState<string | null>(null);
  const [itemForm, setItemForm] = useState({
    type: "text",
    title: "",
    content: "",
    tags: "",
  });
  const [itemFile, setItemFile] = useState<File | null>(null);

  /* ---------------- queries ---------------- */
  const { data: stages = [], isLoading } = useQuery({
    queryKey: ["conference_stages", selectedCompanyId],
    queryFn: async () => {
      let q = supabase
        .from("conference_stages")
        .select("*")
        .order("order_index", { ascending: true })
        .order("created_at", { ascending: true });
      if (selectedCompanyId) q = q.eq("company_id", selectedCompanyId);
      const { data, error } = await q;
      if (error) throw error;
      return data as Stage[];
    },
  });

  const { data: items = [] } = useQuery({
    queryKey: ["conference_items", selectedCompanyId],
    queryFn: async () => {
      let q = supabase
        .from("conference_items")
        .select("*")
        .order("order_index", { ascending: true })
        .order("created_at", { ascending: true });
      if (selectedCompanyId) q = q.eq("company_id", selectedCompanyId);
      const { data, error } = await q;
      if (error) throw error;
      return data as Item[];
    },
  });

  /* ---------------- stage mutations ---------------- */
  const saveStage = useMutation({
    mutationFn: async () => {
      if (!stageForm.title.trim()) throw new Error("Título obrigatório");
      if (editingStage) {
        const { error } = await supabase
          .from("conference_stages")
          .update({
            title: stageForm.title,
            description: stageForm.description || null,
          })
          .eq("id", editingStage.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("conference_stages").insert({
          title: stageForm.title,
          description: stageForm.description || null,
          company_id: selectedCompanyId,
          order_index: stages.length,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["conference_stages"] });
      setStageDialog(false);
      setEditingStage(null);
      setStageForm({ title: "", description: "" });
      toast.success(editingStage ? "Etapa atualizada" : "Etapa criada");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteStage = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("conference_stages").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["conference_stages"] });
      queryClient.invalidateQueries({ queryKey: ["conference_items"] });
      toast.success("Etapa removida");
    },
  });

  /* ---------------- item mutations ---------------- */
  const saveItem = useMutation({
    mutationFn: async () => {
      if (!itemForm.title.trim()) throw new Error("Título obrigatório");
      if (!itemStageId && !editingItem) throw new Error("Etapa obrigatória");

      let attachment_url: string | null = editingItem?.attachment_url ?? null;
      let attachment_name: string | null = editingItem?.attachment_name ?? null;

      if (itemFile) {
        const path = `conference/${Date.now()}-${itemFile.name}`;
        const { error: upErr } = await supabase.storage
          .from("attachments")
          .upload(path, itemFile);
        if (upErr) throw upErr;
        const { data: pub } = supabase.storage.from("attachments").getPublicUrl(path);
        attachment_url = pub.publicUrl;
        attachment_name = itemFile.name;
      }

      const payload = {
        type: itemForm.type,
        title: itemForm.title,
        content: itemForm.content || null,
        tags: itemForm.tags
          ? itemForm.tags.split(",").map((t) => t.trim()).filter(Boolean)
          : [],
        attachment_url,
        attachment_name,
      };

      if (editingItem) {
        const { error } = await supabase
          .from("conference_items")
          .update(payload)
          .eq("id", editingItem.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("conference_items").insert({
          ...payload,
          stage_id: itemStageId!,
          company_id: selectedCompanyId,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["conference_items"] });
      setItemDialog(false);
      setEditingItem(null);
      setItemStageId(null);
      setItemFile(null);
      setItemForm({ type: "text", title: "", content: "", tags: "" });
      toast.success(editingItem ? "Item atualizado" : "Item criado");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteItem = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("conference_items").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["conference_items"] });
      toast.success("Item removido");
    },
  });

  /* ---------------- helpers ---------------- */
  const openNewStage = () => {
    setEditingStage(null);
    setStageForm({ title: "", description: "" });
    setStageDialog(true);
  };

  const openEditStage = (s: Stage) => {
    setEditingStage(s);
    setStageForm({ title: s.title, description: s.description ?? "" });
    setStageDialog(true);
  };

  const openNewItem = (stageId: string) => {
    setEditingItem(null);
    setItemStageId(stageId);
    setItemFile(null);
    setItemForm({ type: "text", title: "", content: "", tags: "" });
    setItemDialog(true);
  };

  const openEditItem = (item: Item) => {
    setEditingItem(item);
    setItemStageId(item.stage_id);
    setItemFile(null);
    setItemForm({
      type: item.type,
      title: item.title,
      content: item.content ?? "",
      tags: (item.tags ?? []).join(", "),
    });
    setItemDialog(true);
  };

  const copyContent = (text: string | null) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    toast.success("Conteúdo copiado");
  };

  const lower = search.toLowerCase();
  const filteredItems = (stageId: string) =>
    items
      .filter((i) => i.stage_id === stageId)
      .filter(
        (i) =>
          !search ||
          i.title.toLowerCase().includes(lower) ||
          (i.content ?? "").toLowerCase().includes(lower) ||
          (i.tags ?? []).some((t) => t.toLowerCase().includes(lower))
      );

  const iconForType = (type: string) => {
    const t = ITEM_TYPES.find((x) => x.value === type);
    return t?.icon ?? FileText;
  };

  return (
    <EMSLayout>
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
              <ShieldCheck className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold text-foreground">Conferência</h1>
              <p className="text-sm text-muted-foreground">
                Etapas de conferência e seus documentos, textos e prompts
              </p>
            </div>
          </div>
          <Button onClick={openNewStage} className="gap-2">
            <Plus className="h-4 w-4" /> Nova etapa
          </Button>
        </div>

        {/* Search */}
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar em títulos, conteúdo e tags..."
            className="pl-9"
          />
        </div>

        {/* Stages */}
        {isLoading ? (
          <Card className="p-8 text-center text-muted-foreground">Carregando...</Card>
        ) : stages.length === 0 ? (
          <Card className="p-12 text-center space-y-3">
            <ShieldCheck className="h-10 w-10 text-muted-foreground mx-auto" />
            <p className="text-foreground font-medium">Nenhuma etapa criada ainda</p>
            <p className="text-sm text-muted-foreground">
              Crie etapas como Segurança, QA, Performance, Backup, Ontologia de Dados...
            </p>
            <Button onClick={openNewStage} className="gap-2 mt-2">
              <Plus className="h-4 w-4" /> Criar primeira etapa
            </Button>
          </Card>
        ) : (
          <Accordion type="multiple" className="space-y-3">
            {stages.map((stage) => {
              const stageItems = filteredItems(stage.id);
              return (
                <AccordionItem
                  key={stage.id}
                  value={stage.id}
                  className="border border-border rounded-xl bg-card overflow-hidden"
                >
                  <div className="flex items-center justify-between px-4 hover:bg-accent/30 transition-colors">
                    <AccordionTrigger className="flex-1 hover:no-underline py-4">
                      <div className="flex items-center gap-3 text-left">
                        <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                          <ShieldCheck className="h-4 w-4 text-primary" />
                        </div>
                        <div>
                          <div className="font-semibold text-foreground">{stage.title}</div>
                          {stage.description && (
                            <div className="text-xs text-muted-foreground line-clamp-1">
                              {stage.description}
                            </div>
                          )}
                        </div>
                        <Badge variant="secondary" className="ml-2">
                          {stageItems.length} {stageItems.length === 1 ? "item" : "itens"}
                        </Badge>
                      </div>
                    </AccordionTrigger>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openEditStage(stage)}
                        className="h-8 w-8"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          if (confirm(`Excluir etapa "${stage.title}" e todos seus itens?`))
                            deleteStage.mutate(stage.id);
                        }}
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>

                  <AccordionContent className="px-4 pb-4 space-y-2">
                    <div className="flex justify-end">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openNewItem(stage.id)}
                        className="gap-2"
                      >
                        <Plus className="h-3.5 w-3.5" /> Adicionar item
                      </Button>
                    </div>

                    {stageItems.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-6">
                        Nenhum item nesta etapa ainda.
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {stageItems.map((item) => {
                          const Icon = iconForType(item.type);
                          return (
                            <Card key={item.id} className="p-4">
                              <div className="flex items-start justify-between gap-3">
                                <div className="flex items-start gap-3 flex-1 min-w-0">
                                  <div className="h-8 w-8 rounded-md bg-primary/10 flex items-center justify-center flex-shrink-0">
                                    <Icon className="h-4 w-4 text-primary" />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span className="font-medium text-foreground">
                                        {item.title}
                                      </span>
                                      <Badge variant="outline" className="text-[10px]">
                                        {ITEM_TYPES.find((t) => t.value === item.type)?.label ??
                                          item.type}
                                      </Badge>
                                      {item.tags?.map((t) => (
                                        <Badge key={t} variant="secondary" className="text-[10px]">
                                          {t}
                                        </Badge>
                                      ))}
                                    </div>
                                    {item.content && (
                                      <p className="mt-2 text-sm text-muted-foreground whitespace-pre-wrap break-words line-clamp-6">
                                        {item.content}
                                      </p>
                                    )}
                                    {item.attachment_url && (
                                      <a
                                        href={item.attachment_url}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="inline-flex items-center gap-1 mt-2 text-xs text-primary hover:underline"
                                      >
                                        <Download className="h-3 w-3" />
                                        {item.attachment_name ?? "Baixar anexo"}
                                      </a>
                                    )}
                                  </div>
                                </div>
                                <div className="flex items-center gap-1 flex-shrink-0">
                                  {item.content && (
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => copyContent(item.content)}
                                      className="h-8 w-8"
                                      title="Copiar conteúdo"
                                    >
                                      <Copy className="h-3.5 w-3.5" />
                                    </Button>
                                  )}
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => openEditItem(item)}
                                    className="h-8 w-8"
                                  >
                                    <Edit2 className="h-3.5 w-3.5" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => {
                                      if (confirm(`Excluir item "${item.title}"?`))
                                        deleteItem.mutate(item.id);
                                    }}
                                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                </div>
                              </div>
                            </Card>
                          );
                        })}
                      </div>
                    )}
                  </AccordionContent>
                </AccordionItem>
              );
            })}
          </Accordion>
        )}
      </div>

      {/* Stage Dialog */}
      <Dialog open={stageDialog} onOpenChange={setStageDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingStage ? "Editar etapa" : "Nova etapa"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Título</Label>
              <Input
                value={stageForm.title}
                onChange={(e) => setStageForm({ ...stageForm, title: e.target.value })}
                placeholder="Ex: Segurança, QA, Performance, Backup..."
              />
            </div>
            <div>
              <Label>Descrição (opcional)</Label>
              <Textarea
                value={stageForm.description}
                onChange={(e) =>
                  setStageForm({ ...stageForm, description: e.target.value })
                }
                rows={3}
                placeholder="O que esta conferência cobre?"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setStageDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={() => saveStage.mutate()} disabled={saveStage.isPending}>
              {editingStage ? "Salvar" : "Criar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Item Dialog */}
      <Dialog open={itemDialog} onOpenChange={setItemDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingItem ? "Editar item" : "Novo item"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Tipo</Label>
                <Select
                  value={itemForm.type}
                  onValueChange={(v) => setItemForm({ ...itemForm, type: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ITEM_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Título</Label>
                <Input
                  value={itemForm.title}
                  onChange={(e) => setItemForm({ ...itemForm, title: e.target.value })}
                  placeholder="Ex: Checklist OWASP Top 10"
                />
              </div>
            </div>
            <div>
              <Label>Conteúdo / Prompt</Label>
              <Textarea
                value={itemForm.content}
                onChange={(e) => setItemForm({ ...itemForm, content: e.target.value })}
                rows={8}
                placeholder="Cole aqui o texto, prompt ou roteiro..."
                className="font-mono text-sm"
              />
            </div>
            <div>
              <Label>Tags (separadas por vírgula)</Label>
              <Input
                value={itemForm.tags}
                onChange={(e) => setItemForm({ ...itemForm, tags: e.target.value })}
                placeholder="ex: owasp, auditoria, checklist"
              />
            </div>
            <div>
              <Label>Anexo (PDF, DOC, imagem...)</Label>
              <Input
                type="file"
                onChange={(e) => setItemFile(e.target.files?.[0] ?? null)}
              />
              {editingItem?.attachment_name && !itemFile && (
                <p className="text-xs text-muted-foreground mt-1">
                  Atual: {editingItem.attachment_name}
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setItemDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={() => saveItem.mutate()} disabled={saveItem.isPending}>
              {editingItem ? "Salvar" : "Criar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </EMSLayout>
  );
};

export default Conferencia;
