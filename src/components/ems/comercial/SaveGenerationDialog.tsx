import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Save, X, Tag as TagIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

interface SaveGenerationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  type: "linkedin_outreach" | "linkedin_post" | "chat";
  content: string;
  defaultTitle?: string;
  defaultTags?: string[];
}

export const SaveGenerationDialog = ({
  open,
  onOpenChange,
  type,
  content,
  defaultTitle = "",
  defaultTags = [],
}: SaveGenerationDialogProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [title, setTitle] = useState(defaultTitle);
  const [tags, setTags] = useState<string[]>(defaultTags);
  const [tagInput, setTagInput] = useState("");
  const [saving, setSaving] = useState(false);

  const addTag = () => {
    const t = tagInput.trim();
    if (t && !tags.includes(t)) {
      setTags([...tags, t]);
      setTagInput("");
    }
  };

  const handleSave = async () => {
    if (!content.trim()) return;
    setSaving(true);
    try {
      const { error } = await (supabase as any).from("ai_generations").insert({
        type,
        title: title.trim() || null,
        content,
        tags,
      });
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ["ai_generations"] });
      toast({ title: "Salvo na biblioteca!" });
      onOpenChange(false);
      setTitle("");
      setTags([]);
    } catch (e: any) {
      toast({ title: "Erro ao salvar", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Salvar na Biblioteca</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Título (opcional)</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex: Outreach Diretor de Engenharia"
              className="mt-1"
            />
          </div>
          <div>
            <Label className="text-xs">Tags</Label>
            <div className="flex gap-2 mt-1">
              <Input
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addTag();
                  }
                }}
                placeholder="Digite e pressione Enter"
              />
              <Button type="button" variant="outline" onClick={addTag}>+</Button>
            </div>
            {tags.length > 0 && (
              <div className="flex gap-1 flex-wrap mt-2">
                {tags.map((t) => (
                  <Badge key={t} variant="secondary" className="gap-1">
                    <TagIcon className="h-2.5 w-2.5" /> {t}
                    <button onClick={() => setTags(tags.filter((x) => x !== t))} className="ml-1">
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>
          <div className="text-xs text-muted-foreground bg-muted/30 rounded-lg p-2 max-h-32 overflow-y-auto">
            {content.slice(0, 300)}{content.length > 300 ? "..." : ""}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving} className="gap-2">
            <Save className="h-4 w-4" />
            {saving ? "Salvando..." : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default SaveGenerationDialog;
