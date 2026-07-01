import { useMemo, useState } from "react";
import { ClipboardPaste } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { GENERAL_TARGET, type useRotinas } from "@/hooks/useRotinas";

type Rotinas = ReturnType<typeof useRotinas>;

const parseLines = (text: string) =>
  text.split(/\r?\n/).map((line) => line.replace(/^\s*[-*•]\s*/, "").trim()).filter(Boolean);

export const RotinaPasteDialog = ({ rotinas, open, onClose }: { rotinas: Rotinas; open: boolean; onClose: () => void }) => {
  const [text, setText] = useState("");
  const [target, setTarget] = useState<string>(GENERAL_TARGET);

  const parsed = useMemo(() => parseLines(text), [text]);

  const submit = () => {
    rotinas.pasteTasks.mutate(
      { target, text },
      { onSuccess: () => { setText(""); onClose(); } },
    );
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-[95vw] sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><ClipboardPaste className="h-4 w-4 text-primary" /> Colar texto → Tarefas do dia</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Enviar para</Label>
            <Select value={target} onValueChange={setTarget}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={GENERAL_TARGET}>Pessoal (lista geral)</SelectItem>
                {rotinas.clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Cole seu texto (uma tarefa por linha)</Label>
            <Textarea
              autoFocus
              value={text}
              onChange={(e) => setText(e.target.value)}
              className="h-56 font-mono text-xs"
              placeholder={"- Abrir CNPJ\n- Resolver pendências bancos\n- Procurar escritório de advocacia\n\n- Repositório CONAB"}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            {parsed.length} tarefa(s) detectada(s). Linhas em branco são ignoradas; marcadores <code>-</code>, <code>*</code> e <code>•</code> são removidos.
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={submit} disabled={parsed.length === 0 || rotinas.pasteTasks.isPending} className="gap-1">
            <ClipboardPaste className="h-4 w-4" /> Adicionar {parsed.length || ""} tarefa(s)
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default RotinaPasteDialog;
