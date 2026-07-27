import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Settings2, Plus, Pencil, Trash2, ChevronUp, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCrmStages } from "./useCrmStages";
import { STAGE_COLOR_OPTIONS, DEFAULT_STAGE_COLOR, type CrmStage } from "./crmStages";
import { STAGE_TEMPLATES, suggestTemplate } from "./crmStageTemplates";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const OUTCOME_OPTS = [
  { v: "none", label: "Aberta" },
  { v: "won", label: "Ganho (won)" },
  { v: "lost", label: "Perdido (lost)" },
];

/** Gerencia as colunas do funil de deals (crm_stages): gerar quadro por template, add/renomear/reordenar/recolorir/excluir. */
export const StageManager = ({ suggestedSegment }: { suggestedSegment?: string | null }) => {
  const { stages, rows, isDefault, saveStage, deleteStage, reorderStages, seedStages } = useCrmStages();
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<{ open: boolean; stage?: CrmStage }>({ open: false });
  const [form, setForm] = useState({ title: "", color: DEFAULT_STAGE_COLOR, outcome: "none", is_offtrack: false });
  const [del, setDel] = useState<{ open: boolean; id?: string; title?: string }>({ open: false });
  // Template escolhido pra gerar o quadro; null = segue a sugestão por segmento (que pode carregar depois).
  const suggested = suggestTemplate(suggestedSegment);
  const [templateKey, setTemplateKey] = useState<string | null>(null);
  const activeTemplate = STAGE_TEMPLATES.find((t) => t.key === (templateKey ?? suggested.key)) ?? suggested;

  const openEdit = (s?: CrmStage) => {
    setForm(
      s
        ? { title: s.title, color: s.color, outcome: s.outcome ?? "none", is_offtrack: !!s.is_offtrack }
        : { title: "", color: DEFAULT_STAGE_COLOR, outcome: "none", is_offtrack: false },
    );
    setEdit({ open: true, stage: s });
  };

  const submit = () => {
    saveStage.mutate({
      id: edit.stage?.id,
      title: form.title.trim(),
      color: form.color,
      outcome: form.outcome === "none" ? null : (form.outcome as "won" | "lost"),
      is_offtrack: form.is_offtrack,
    });
    setEdit({ open: false });
  };

  const move = (idx: number, dir: -1 | 1) => {
    const ids = rows.map((r) => r.id!).filter(Boolean);
    const j = idx + dir;
    if (j < 0 || j >= ids.length) return;
    [ids[idx], ids[j]] = [ids[j], ids[idx]];
    reorderStages.mutate(ids);
  };

  return (
    <>
      <Button size="sm" variant="ghost" className="h-7 gap-1.5 text-xs" onClick={() => setOpen(true)}>
        <Settings2 className="h-3.5 w-3.5" />Etapas
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings2 className="h-4 w-4 text-primary" />Etapas do funil
            </DialogTitle>
          </DialogHeader>

          {isDefault && (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-2.5 space-y-2">
              <p className="text-xs">Funil padrão. Gere um quadro a partir de um template pra personalizar as colunas por empresa.</p>
              <div className="flex items-center gap-2">
                <Select value={activeTemplate.key} onValueChange={setTemplateKey}>
                  <SelectTrigger className="h-8 text-xs flex-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STAGE_TEMPLATES.map((t) => (
                      <SelectItem key={t.key} value={t.key}>
                        {t.name}{t.key === suggested.key && suggestedSegment ? " · sugerido" : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button size="sm" onClick={() => seedStages.mutate(activeTemplate.stages)} disabled={seedStages.isPending}>
                  Gerar quadro
                </Button>
              </div>
              <p className="text-[11px] text-muted-foreground">{activeTemplate.description}</p>
            </div>
          )}

          <div className="space-y-1.5 max-h-[45vh] overflow-y-auto">
            {stages.map((s, i) => (
              <div key={s.key} className="flex items-center gap-2 rounded-lg border border-border/50 p-2">
                <span className={cn("h-4 w-4 rounded shrink-0 bg-gradient-to-r to-transparent border", s.color)} />
                <span className="text-sm flex-1 truncate">{s.title}</span>
                {s.outcome && <Badge variant="outline" className="text-[10px]">{s.outcome}</Badge>}
                {s.is_offtrack && <Badge variant="secondary" className="text-[10px]">fora da esteira</Badge>}
                {!isDefault && (
                  <div className="flex gap-0.5 shrink-0">
                    <Button variant="ghost" size="icon" className="h-6 w-6" disabled={i === 0 || reorderStages.isPending} onClick={() => move(i, -1)}>
                      <ChevronUp className="h-3 w-3" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-6 w-6" disabled={i === stages.length - 1 || reorderStages.isPending} onClick={() => move(i, 1)}>
                      <ChevronDown className="h-3 w-3" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => openEdit(s)}>
                      <Pencil className="h-3 w-3" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => setDel({ open: true, id: s.id, title: s.title })}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>

          {!isDefault && (
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => openEdit()}>
              <Plus className="h-3.5 w-3.5" />Nova etapa
            </Button>
          )}
        </DialogContent>
      </Dialog>

      {/* Criar / editar etapa */}
      <Dialog open={edit.open} onOpenChange={(o) => !o && setEdit({ open: false })}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{edit.stage ? "Editar etapa" : "Nova etapa"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <Input placeholder="Título da etapa" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
            <div>
              <p className="text-xs text-muted-foreground mb-1">Cor</p>
              <div className="flex flex-wrap gap-1.5">
                {STAGE_COLOR_OPTIONS.map((c) => (
                  <button
                    key={c.key}
                    type="button"
                    title={c.label}
                    onClick={() => setForm((f) => ({ ...f, color: c.cls }))}
                    className={cn(
                      "h-6 w-6 rounded bg-gradient-to-r to-transparent border-2",
                      c.cls,
                      form.color === c.cls && "ring-2 ring-primary ring-offset-1 ring-offset-background",
                    )}
                  />
                ))}
              </div>
            </div>
            <Select value={form.outcome} onValueChange={(v) => setForm((f) => ({ ...f, outcome: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {OUTCOME_OPTS.map((o) => <SelectItem key={o.v} value={o.v}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={form.is_offtrack} onCheckedChange={(v) => setForm((f) => ({ ...f, is_offtrack: !!v }))} />
              Fora da esteira (Perdido / Em nutrição)
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEdit({ open: false })}>Cancelar</Button>
            <Button onClick={submit} disabled={!form.title.trim() || saveStage.isPending}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Excluir */}
      <AlertDialog open={del.open} onOpenChange={(o) => !o && setDel({ open: false })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir etapa?</AlertDialogTitle>
            <AlertDialogDescription>
              Excluir "{del.title}"? Deals nesta etapa passam a aparecer na primeira coluna. Não pode ser desfeito.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => { if (del.id) deleteStage.mutate(del.id); setDel({ open: false }); }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default StageManager;
