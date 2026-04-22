import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Plus, Edit2, Trash2, Save, FileUp, ExternalLink, Upload, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

export type StructureCategory = "onboarding_roteiro" | "implementation_roteiro" | "kpi_before_after";

interface Item {
  id: string;
  category: string;
  title: string;
  description: string | null;
  value_before: string | null;
  value_after: string | null;
  unit: string | null;
  status: string | null;
  order_index: number;
  attachment_url: string | null;
  attachment_name: string | null;
  company_id: string | null;
}

interface StructureSectionEditorProps {
  category: StructureCategory;
  title: string;
  description: string;
  showBeforeAfter?: boolean;
}

export const StructureSectionEditor = ({
  category,
  title,
  description,
  showBeforeAfter = false,
}: StructureSectionEditorProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { selectedCompanyId } = useCompany();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Item | null>(null);
  const [uploading, setUploading] = useState(false);
  const [form, setForm] = useState({
    title: "",
    description: "",
    value_before: "",
    value_after: "",
    unit: "",
    attachment_url: "",
    attachment_name: "",
  });

  const queryKey = ["commercial_structure_items", category, selectedCompanyId];

  const { data: items = [], isLoading } = useQuery({
    queryKey,
    queryFn: async () => {
      let q = (supabase as any)
        .from("commercial_structure_items")
        .select("*")
        .eq("category", category)
        .order("order_index");
      if (selectedCompanyId !== "all") q = q.eq("company_id", selectedCompanyId);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as Item[];
    },
  });

  const resetForm = () => {
    setForm({ title: "", description: "", value_before: "", value_after: "", unit: "", attachment_url: "", attachment_name: "" });
    setEditing(null);
  };

  const openEdit = (item: Item) => {
    setEditing(item);
    setForm({
      title: item.title,
      description: item.description || "",
      value_before: item.value_before || "",
      value_after: item.value_after || "",
      unit: item.unit || "",
      attachment_url: item.attachment_url || "",
      attachment_name: item.attachment_name || "",
    });
    setDialogOpen(true);
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload: any = {
        category,
        title: form.title,
        description: form.description || null,
        value_before: form.value_before || null,
        value_after: form.value_after || null,
        unit: form.unit || null,
        attachment_url: form.attachment_url || null,
        attachment_name: form.attachment_name || null,
        company_id: selectedCompanyId !== "all" ? selectedCompanyId : null,
      };
      if (editing) {
        const { error } = await (supabase as any)
          .from("commercial_structure_items")
          .update(payload)
          .eq("id", editing.id);
        if (error) throw error;
      } else {
        payload.order_index = items.length;
        const { error } = await (supabase as any).from("commercial_structure_items").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      setDialogOpen(false);
      resetForm();
      toast({ title: editing ? "Atualizado!" : "Criado!" });
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("commercial_structure_items").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast({ title: "Removido" });
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const handleFileUpload = async (file: File) => {
    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `commercial-structure/${category}/${Date.now()}-${Math.random().toString(36).substring(7)}.${ext}`;
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

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold">{title}</h3>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
        <Button size="sm" onClick={() => { resetForm(); setDialogOpen(true); }} className="gap-1.5 shrink-0">
          <Plus className="h-3.5 w-3.5" /> Adicionar
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[...Array(2)].map((_, i) => <div key={i} className="h-20 rounded-xl bg-muted/30 animate-pulse" />)}
        </div>
      ) : items.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            Nenhum item ainda. Clique em "Adicionar" para começar.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {items.map((item, idx) => (
            <Card key={item.id} className="hover:border-primary/30 transition-colors">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="outline" className="text-[10px]">#{idx + 1}</Badge>
                      <h4 className="font-medium text-sm">{item.title}</h4>
                    </div>
                    {item.description && (
                      <p className="text-xs text-muted-foreground mb-2">{item.description}</p>
                    )}
                    {showBeforeAfter && (item.value_before || item.value_after) && (
                      <div className="grid grid-cols-2 gap-2 mt-2">
                        <div className="bg-red-500/5 border border-red-500/20 rounded-lg p-2">
                          <p className="text-[10px] uppercase tracking-wider text-red-500 font-semibold mb-0.5">Antes</p>
                          <p className="text-sm font-mono">{item.value_before || "—"} {item.unit}</p>
                        </div>
                        <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-lg p-2">
                          <p className="text-[10px] uppercase tracking-wider text-emerald-500 font-semibold mb-0.5">Depois</p>
                          <p className="text-sm font-mono">{item.value_after || "—"} {item.unit}</p>
                        </div>
                      </div>
                    )}
                    {item.attachment_url && (
                      <a
                        href={item.attachment_url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-primary hover:underline mt-2"
                      >
                        <FileUp className="h-3 w-3" /> {item.attachment_name || "Arquivo"} <ExternalLink className="h-2.5 w-2.5" />
                      </a>
                    )}
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(item)}>
                      <Edit2 className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      onClick={() => deleteMutation.mutate(item.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) resetForm(); }}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar" : "Adicionar"} {title}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Título *</Label>
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="mt-1" />
            </div>
            <div>
              <Label className="text-xs">Descrição</Label>
              <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} className="mt-1" />
            </div>
            {showBeforeAfter && (
              <>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <Label className="text-xs">Antes</Label>
                    <Input value={form.value_before} onChange={(e) => setForm({ ...form, value_before: e.target.value })} placeholder="Ex: 38" className="mt-1" />
                  </div>
                  <div>
                    <Label className="text-xs">Depois</Label>
                    <Input value={form.value_after} onChange={(e) => setForm({ ...form, value_after: e.target.value })} placeholder="Ex: 72" className="mt-1" />
                  </div>
                  <div>
                    <Label className="text-xs">Unidade</Label>
                    <Input value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} placeholder="%, dias, R$" className="mt-1" />
                  </div>
                </div>
              </>
            )}
            <div>
              <Label className="text-xs">Anexo (PDF, doc, imagem)</Label>
              {form.attachment_url ? (
                <div className="flex items-center justify-between gap-2 mt-1 p-2 bg-muted/30 rounded-lg border">
                  <a href={form.attachment_url} target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline truncate flex-1">
                    <FileUp className="h-3 w-3 inline mr-1" /> {form.attachment_name || "Arquivo"}
                  </a>
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setForm({ ...form, attachment_url: "", attachment_name: "" })}>
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ) : (
                <div className="mt-1">
                  <input
                    id={`file-${category}`}
                    type="file"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleFileUpload(f);
                    }}
                    className="hidden"
                    accept=".pdf,.doc,.docx,.xls,.xlsx,image/*"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => document.getElementById(`file-${category}`)?.click()}
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
              {saveMutation.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default StructureSectionEditor;
