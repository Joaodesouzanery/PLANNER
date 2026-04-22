import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Linkedin, Loader2, Wand2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface ParsedProfile {
  name?: string;
  role?: string;
  company?: string;
  headline?: string;
  about?: string;
}

interface LinkedInImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImport: (profileText: string) => void;
}

export const LinkedInImportDialog = ({ open, onOpenChange, onImport }: LinkedInImportDialogProps) => {
  const { toast } = useToast();
  const [mode, setMode] = useState<"url" | "text">("url");
  const [url, setUrl] = useState("");
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [parsed, setParsed] = useState<ParsedProfile | null>(null);

  const handleParse = async () => {
    setParsed(null);
    setLoading(true);
    try {
      const fnUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/linkedin-parser`;
      const resp = await fetch(fnUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify(mode === "url" ? { url } : { text }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        throw new Error(data.error || "Erro ao extrair");
      }
      setParsed(data);
    } catch (e: any) {
      toast({ title: "Erro ao extrair perfil", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = () => {
    if (!parsed) return;
    const lines: string[] = [];
    if (parsed.name) lines.push(`Nome: ${parsed.name}`);
    if (parsed.role) lines.push(`Cargo: ${parsed.role}`);
    if (parsed.company) lines.push(`Empresa: ${parsed.company}`);
    if (parsed.headline) lines.push(`Headline: ${parsed.headline}`);
    if (parsed.about) lines.push(`Sobre: ${parsed.about}`);
    onImport(lines.join("\n"));
    onOpenChange(false);
    setUrl("");
    setText("");
    setParsed(null);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Linkedin className="h-5 w-5 text-blue-500" /> Importar Perfil do LinkedIn
          </DialogTitle>
        </DialogHeader>
        <Tabs value={mode} onValueChange={(v) => { setMode(v as any); setParsed(null); }}>
          <TabsList className="grid grid-cols-2">
            <TabsTrigger value="url">URL do Perfil</TabsTrigger>
            <TabsTrigger value="text">Colar Texto</TabsTrigger>
          </TabsList>
          <TabsContent value="url" className="space-y-2 mt-3">
            <Label className="text-xs">URL do LinkedIn</Label>
            <Input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://www.linkedin.com/in/..."
            />
            <p className="text-[11px] text-muted-foreground">
              ⚠️ Muitos perfis exigem login no LinkedIn. Se não funcionar, use a aba "Colar Texto".
            </p>
          </TabsContent>
          <TabsContent value="text" className="space-y-2 mt-3">
            <Label className="text-xs">Texto copiado do perfil</Label>
            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Cole aqui nome, cargo, empresa, headline, e qualquer outra informação visível no perfil..."
              rows={6}
            />
          </TabsContent>
        </Tabs>

        <Button
          onClick={handleParse}
          disabled={loading || (mode === "url" ? !url.trim() : !text.trim())}
          className="w-full gap-2"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
          {loading ? "Extraindo com IA..." : "Extrair Dados"}
        </Button>

        {parsed && (
          <div className="space-y-2 bg-muted/30 rounded-lg p-3 text-sm">
            <p className="text-xs font-semibold text-primary mb-1">Dados extraídos:</p>
            {parsed.name && <p><strong>Nome:</strong> {parsed.name}</p>}
            {parsed.role && <p><strong>Cargo:</strong> {parsed.role}</p>}
            {parsed.company && <p><strong>Empresa:</strong> {parsed.company}</p>}
            {parsed.headline && <p><strong>Headline:</strong> {parsed.headline}</p>}
            {parsed.about && <p className="text-xs"><strong>Sobre:</strong> {parsed.about}</p>}
            {!parsed.name && !parsed.role && !parsed.company && (
              <p className="text-xs text-muted-foreground italic">Não foi possível extrair dados estruturados. Tente colar o texto.</p>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleConfirm} disabled={!parsed}>Usar no Formulário</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default LinkedInImportDialog;
