import { useState, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { Paperclip, Upload, Trash2, Download, File, Image, FileText } from "lucide-react";
import { cn } from "@/lib/utils";

interface AttachmentManagerProps {
  entityType: "project" | "project_contract" | "project_invoice" | "task" | "contact" | "governance";
  entityId: string;
  companyId?: string | null;
  title?: string;
  accept?: string;
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

export const AttachmentManager = ({ entityType, entityId, companyId, title = "Anexos", accept }: AttachmentManagerProps) => {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);

  const { data: attachments = [] } = useQuery({
    queryKey: ["attachments", entityType, entityId],
    queryFn: async () => {
      const { data, error } = await supabase
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

      const { error: dbErr } = await supabase.from("attachments").insert({
        entity_type: entityType,
        entity_id: entityId,
        file_name: file.name,
        file_url: urlData.publicUrl,
        file_size: file.size,
        content_type: file.type,
        company_id: companyId || null,
      });
      if (dbErr) throw dbErr;

      queryClient.invalidateQueries({ queryKey: ["attachments", entityType, entityId] });
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
      const { error } = await supabase.from("attachments").delete().eq("id", att.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["attachments", entityType, entityId] });
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
