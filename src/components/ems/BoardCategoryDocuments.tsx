import { useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useCompany } from "@/contexts/CompanyContext";
import { FileText, Upload, Trash2, Download, Edit2, Save, X } from "lucide-react";

interface Props { category: string; }

const sanitize = (name: string) => {
  const parts = name.split(".");
  const ext = parts.length > 1 ? `.${parts.pop()}` : "";
  const base = parts.join(".") || "doc";
  return base.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 80) + ext;
};

export const BoardCategoryDocuments = ({ category }: Props) => {
  const { selectedCompanyId } = useCompany();
  const { toast } = useToast();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editNotes, setEditNotes] = useState("");

  const cf = selectedCompanyId !== "all";

  const { data: docs = [] } = useQuery({
    queryKey: ["board-docs", category, selectedCompanyId],
    queryFn: async () => {
      let q = (supabase as any).from("board_category_documents").select("*").eq("category", category).order("created_at", { ascending: false });
      if (cf) q = q.eq("company_id", selectedCompanyId);
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
  });

  const handleFiles = async (files: FileList | null) => {
    if (!files || !files.length) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const path = `board/${category}/${Date.now()}-${sanitize(file.name)}`;
        const { error: upErr } = await supabase.storage.from("attachments").upload(path, file);
        if (upErr) throw upErr;
        const { data: urlData } = supabase.storage.from("attachments").getPublicUrl(path);
        const { error: dbErr } = await (supabase as any).from("board_category_documents").insert({
          category,
          file_name: file.name,
          file_url: urlData.publicUrl,
          file_size: file.size,
          content_type: file.type,
          company_id: cf ? selectedCompanyId : null,
        });
        if (dbErr) throw dbErr;
      }
      qc.invalidateQueries({ queryKey: ["board-docs", category] });
      toast({ title: "Documento(s) salvos no Conselho" });
    } catch (e: any) {
      toast({ title: "Erro no upload", description: e.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const removeDoc = useMutation({
    mutationFn: async (doc: any) => {
      try {
        const url = new URL(doc.file_url);
        const parts = url.pathname.split("/storage/v1/object/public/attachments/");
        if (parts[1]) await supabase.storage.from("attachments").remove([decodeURIComponent(parts[1])]);
      } catch {}
      const { error } = await (supabase as any).from("board_category_documents").delete().eq("id", doc.id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["board-docs", category] }); toast({ title: "Documento removido" }); },
  });

  const updateNotes = useMutation({
    mutationFn: async ({ id, notes }: { id: string; notes: string }) => {
      const { error } = await (supabase as any).from("board_category_documents").update({ notes }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["board-docs", category] }); setEditingId(null); toast({ title: "Atualizado" }); },
  });

  return (
    <Card className="border-dashed">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium flex items-center gap-2"><FileText className="h-4 w-4 text-primary" />Documentos PDF da categoria ({docs.length})</p>
          <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()} disabled={uploading}>
            <Upload className="h-3.5 w-3.5 mr-1.5" />{uploading ? "Enviando..." : "Adicionar PDF"}
          </Button>
          <input ref={fileRef} type="file" multiple accept="application/pdf" className="hidden" onChange={(e) => handleFiles(e.target.files)} />
        </div>

        {docs.length === 0 ? (
          <p className="text-xs text-muted-foreground py-6 text-center">Nenhum documento nesta categoria. Faça upload para consulta futura.</p>
        ) : (
          <div className="space-y-2">
            {docs.map((doc: any) => (
              <div key={doc.id} className="flex flex-col gap-2 p-3 rounded-lg border border-border bg-card">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-primary shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{doc.file_name}</p>
                    <p className="text-[10px] text-muted-foreground">{new Date(doc.created_at).toLocaleDateString("pt-BR")} {doc.file_size ? `• ${(doc.file_size / 1024).toFixed(0)} KB` : ""}</p>
                  </div>
                  <a href={doc.file_url} target="_blank" rel="noopener noreferrer">
                    <Button variant="ghost" size="icon" className="h-8 w-8"><Download className="h-3.5 w-3.5" /></Button>
                  </a>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setEditingId(doc.id); setEditNotes(doc.notes || ""); }}>
                    <Edit2 className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => removeDoc.mutate(doc)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
                {editingId === doc.id ? (
                  <div className="space-y-2">
                    <Textarea placeholder="Notas / observações" value={editNotes} onChange={(e) => setEditNotes(e.target.value)} rows={2} className="text-xs" />
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => updateNotes.mutate({ id: doc.id, notes: editNotes })}><Save className="h-3 w-3 mr-1" />Salvar</Button>
                      <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}><X className="h-3 w-3 mr-1" />Cancelar</Button>
                    </div>
                  </div>
                ) : doc.notes ? (
                  <p className="text-xs text-muted-foreground italic">{doc.notes}</p>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
