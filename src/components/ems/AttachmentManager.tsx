import { useState, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { Paperclip, Upload, Trash2, Download, File, Image, FileText, CalendarClock } from "lucide-react";
import { cn } from "@/lib/utils";

interface AttachmentManagerProps {
  entityType: "project" | "project_contract" | "project_invoice" | "task" | "contact" | "governance" | "client";
  entityId: string;
  companyId?: string | null;
  clientCompanyId?: string | null;
  projectId?: string | null;
  governanceItemId?: string | null;
  documentType?: string;
  title?: string;
  accept?: string;
  showMetadata?: boolean;
}

const iconForType = (contentType: string) => {
  if (contentType?.startsWith("image/")) return Image;
  if (contentType?.includes("pdf")) return FileText;
  return File;
};

const formatSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const inferDocumentType = (entityType: string, explicit?: string) => {
  if (explicit) return explicit;
  if (entityType === "project_contract") return "contract";
  if (entityType === "project_invoice") return "invoice";
  if (entityType === "governance") return "governance";
  if (entityType === "client") return "contract";
  return "other";
};

export const AttachmentManager = ({
  entityType,
  entityId,
  companyId,
  clientCompanyId,
  projectId,
  governanceItemId,
  documentType,
  title = "Anexos",
  accept,
  showMetadata = false,
}: AttachmentManagerProps) => {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [meta, setMeta] = useState({ expires_at: "", alert_days: "30", notes: "" });

  const { data: attachments = [] } = useQuery({
    queryKey: ["attachments", entityType, entityId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("attachments")
        .select("*")
        .eq("entity_type", entityType)
        .eq("entity_id", entityId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const uploadFile = async (file: globalThis.File) => {
    setUploading(true);
    try {
      const path = `${entityType}/${entityId}/${Date.now()}-${file.name}`;
      const { error: uploadErr } = await supabase.storage.from("attachments").upload(path, file);
      if (uploadErr) throw uploadErr;

      const { data: urlData } = supabase.storage.from("attachments").getPublicUrl(path);

      const { error: dbErr } = await (supabase as any).from("attachments").insert({
        entity_type: entityType,
        entity_id: entityId,
        file_name: file.name,
        file_url: urlData.publicUrl,
        file_size: file.size,
        content_type: file.type,
        company_id: companyId || null,
        document_type: inferDocumentType(entityType, documentType),
        client_company_id: clientCompanyId || companyId || null,
        project_id: projectId || (entityType.startsWith("project") ? entityId : null),
        governance_item_id: governanceItemId || (entityType === "governance" ? entityId : null),
        expires_at: meta.expires_at || null,
        alert_days: Number(meta.alert_days) || 30,
        notes: meta.notes || null,
      });
      if (dbErr) throw dbErr;

      queryClient.invalidateQueries({ queryKey: ["attachments", entityType, entityId] });
      queryClient.invalidateQueries({ queryKey: ["document-library"] });
      toast({ title: "Arquivo enviado" });
    } catch (err: any) {
      toast({ title: "Erro no upload", description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const deleteAttachment = useMutation({
    mutationFn: async (att: any) => {
      // Extract path from URL
      const url = new URL(att.file_url);
      const pathParts = url.pathname.split("/storage/v1/object/public/attachments/");
      if (pathParts[1]) {
        await supabase.storage.from("attachments").remove([decodeURIComponent(pathParts[1])]);
      }
      const { error } = await (supabase as any).from("attachments").delete().eq("id", att.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["attachments", entityType, entityId] });
      queryClient.invalidateQueries({ queryKey: ["document-library"] });
      toast({ title: "Arquivo removido" });
    },
  });

  const handleFiles = (files: FileList | null) => {
    if (!files) return;
    Array.from(files).forEach(uploadFile);
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    handleFiles(e.dataTransfer.files);
  }, [entityType, entityId]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
          <Paperclip className="h-3 w-3" /> {title} ({attachments.length})
        </p>
        <Button
          variant="outline"
          size="sm"
          className="h-7 text-xs"
          disabled={uploading}
          onClick={() => fileInputRef.current?.click()}
        >
          <Upload className="h-3 w-3 mr-1" /> {uploading ? "Enviando..." : "Upload"}
        </Button>
        <input ref={fileInputRef} type="file" multiple accept={accept} className="hidden" onChange={(e) => handleFiles(e.target.files)} />
      </div>

      {/* Drop zone */}
      {showMetadata && (
        <div className="grid gap-2 sm:grid-cols-[1fr_100px]">
          <Input type="date" value={meta.expires_at} onChange={(e) => setMeta({ ...meta, expires_at: e.target.value })} />
          <Input type="number" min={0} value={meta.alert_days} onChange={(e) => setMeta({ ...meta, alert_days: e.target.value })} placeholder="Alerta" />
          <Textarea className="sm:col-span-2 min-h-16 text-xs" value={meta.notes} onChange={(e) => setMeta({ ...meta, notes: e.target.value })} placeholder="Observações do documento" />
        </div>
      )}

      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        className={cn(
          "border-2 border-dashed rounded-md p-3 text-center text-xs text-muted-foreground transition-colors",
          dragging ? "border-primary bg-primary/5" : "border-border"
        )}
      >
        Arraste arquivos aqui
      </div>

      {/* File list */}
      <div className="space-y-1">
        {attachments.map((att: any) => {
          const Icon = iconForType(att.content_type);
          const isImage = att.content_type?.startsWith("image/");
          return (
            <div key={att.id} className="flex items-center gap-2 p-2 rounded border border-border bg-card">
              {isImage ? (
                <img src={att.file_url} alt={att.file_name} className="h-8 w-8 object-cover rounded" />
              ) : (
                <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-xs truncate">{att.file_name}</p>
                {att.file_size && <p className="text-[10px] text-muted-foreground">{formatSize(att.file_size)}</p>}
                {att.expires_at && <p className="text-[10px] text-muted-foreground flex items-center gap-1"><CalendarClock className="h-2.5 w-2.5" />Vence em {new Date(att.expires_at + "T12:00:00").toLocaleDateString("pt-BR")}</p>}
                {att.notes && <p className="text-[10px] text-muted-foreground truncate">{att.notes}</p>}
              </div>
              <a href={att.file_url} target="_blank" rel="noopener noreferrer">
                <Button variant="ghost" size="icon" className="h-6 w-6">
                  <Download className="h-3 w-3" />
                </Button>
              </a>
              <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => deleteAttachment.mutate(att)}>
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          );
        })}
      </div>
    </div>
  );
};
