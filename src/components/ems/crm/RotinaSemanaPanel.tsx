import { useMemo, useState } from "react";
import { CalendarDays, Plus, Pencil, Trash2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useCrmRotina } from "./useCrmRotina";
import { useCrmModulos } from "./useCrmModulos";
import { DEFAULT_ROTINA, WEEKDAY_LABEL, CANAL_SUGGESTIONS, type RotinaBloco } from "./crmRotina";

type Form = { weekday: number; canal: string; titulo: string; modulo_id: string | null };
const emptyForm: Form = { weekday: 1, canal: "", titulo: "", modulo_id: null };

/** Rotina semanal por canal (crm_rotina_blocos): a semana operacional, editável, com "feito nesta semana". */
export const RotinaSemanaPanel = () => {
  const { blocos, isEmpty, isDone, saveBloco, deleteBloco, toggleDone, seedDefault } = useCrmRotina();
  const { modulos } = useCrmModulos();
  const [dialog, setDialog] = useState<{ open: boolean; id?: string }>({ open: false });
  const [form, setForm] = useState<Form>(emptyForm);
  const [del, setDel] = useState<{ id: string; titulo: string } | null>(null);

  const moduloName = useMemo(() => {
    const map = new Map(modulos.map((m) => [m.id, m.name]));
    return (id: string | null) => (id ? map.get(id) || null : null);
  }, [modulos]);

  const grouped = useMemo(() => {
    const map = new Map<number, RotinaBloco[]>();
    for (const b of blocos) {
      const arr = map.get(b.weekday);
      if (arr) arr.push(b);
      else map.set(b.weekday, [b]);
    }
    return [...map.entries()].sort((a, b) => a[0] - b[0]);
  }, [blocos]);

  const doneCount = blocos.filter(isDone).length;

  const openForm = (b?: RotinaBloco) => {
    setForm(b ? { weekday: b.weekday, canal: b.canal || "", titulo: b.titulo, modulo_id: b.modulo_id } : emptyForm);
    setDialog({ open: true, id: b?.id });
  };
  const submit = () => {
    saveBloco.mutate({ id: dialog.id, weekday: form.weekday, canal: form.canal.trim() || null, titulo: form.titulo.trim(), modulo_id: form.modulo_id });
    setDialog({ open: false });
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          A semana operacional por canal (Seg abre · Ter–Qui contato · Sex fecha). {blocos.length > 0 && <b className="text-foreground">{doneCount}/{blocos.length} feitos nesta semana.</b>}
        </p>
        <div className="flex items-center gap-1.5 shrink-0">
          {isEmpty && <Button size="sm" onClick={() => seedDefault.mutate(DEFAULT_ROTINA)} disabled={seedDefault.isPending}>Gerar rotina padrão</Button>}
          <Button size="sm" variant="outline" className="h-8 gap-1.5 text-xs" onClick={() => openForm()}><Plus className="h-3.5 w-3.5" />Novo bloco</Button>
        </div>
      </div>

      {isEmpty ? (
        <p className="text-sm text-muted-foreground text-center py-10">
          Sem rotina ainda. Gere a rotina padrão (a semana dos docs) e edite os blocos por canal/módulo.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {grouped.map(([weekday, items]) => (
            <Card key={weekday} className="border border-border/50 bg-card/80">
              <CardContent className="p-3">
                <p className="mb-2 flex items-center gap-1.5 text-sm font-semibold"><CalendarDays className="h-4 w-4 text-primary" />{WEEKDAY_LABEL[weekday]}</p>
                <div className="space-y-1.5">
                  {items.map((b) => {
                    const done = isDone(b);
                    const mod = moduloName(b.modulo_id);
                    return (
                      <div key={b.id} className={cn("group flex items-start gap-2 rounded-lg border border-border/50 p-2", done && "opacity-60")}>
                        <Checkbox checked={done} onCheckedChange={() => toggleDone.mutate(b)} className="mt-0.5" />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-1">
                            {b.canal && <Badge variant="outline" className="text-[9px]">{b.canal}</Badge>}
                            {mod && <Badge variant="secondary" className="text-[9px] bg-primary/10 text-primary">{mod}</Badge>}
                          </div>
                          <p className={cn("text-xs mt-0.5 leading-snug", done && "line-through")}>{b.titulo}</p>
                        </div>
                        <div className="flex gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => openForm(b)}><Pencil className="h-3 w-3" /></Button>
                          <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => setDel({ id: b.id!, titulo: b.titulo })}><Trash2 className="h-3 w-3" /></Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Criar / editar bloco */}
      <Dialog open={dialog.open} onOpenChange={(o) => !o && setDialog({ open: false })}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>{dialog.id ? "Editar bloco" : "Novo bloco"}</DialogTitle></DialogHeader>
          <div className="space-y-2 py-1">
            <Input placeholder="O que fazer (título)" value={form.titulo} onChange={(e) => setForm((f) => ({ ...f, titulo: e.target.value }))} />
            <div className="grid grid-cols-2 gap-2">
              <Select value={String(form.weekday)} onValueChange={(v) => setForm((f) => ({ ...f, weekday: Number(v) }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{[1, 2, 3, 4, 5, 6, 7].map((d) => <SelectItem key={d} value={String(d)}>{WEEKDAY_LABEL[d]}</SelectItem>)}</SelectContent>
              </Select>
              <Select value={form.modulo_id || "none"} onValueChange={(v) => setForm((f) => ({ ...f, modulo_id: v === "none" ? null : v }))}>
                <SelectTrigger><SelectValue placeholder="Módulo" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sem módulo</SelectItem>
                  {modulos.map((m) => <SelectItem key={m.id} value={m.id!}>{m.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <Input list="canal-sugestoes" placeholder="Canal (ex.: Posts, E-mail…)" value={form.canal} onChange={(e) => setForm((f) => ({ ...f, canal: e.target.value }))} />
            <datalist id="canal-sugestoes">{CANAL_SUGGESTIONS.map((c) => <option key={c} value={c} />)}</datalist>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog({ open: false })}>Cancelar</Button>
            <Button onClick={submit} disabled={!form.titulo.trim() || saveBloco.isPending}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!del} onOpenChange={(o) => !o && setDel(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Excluir bloco?</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Excluir "{del?.titulo}"?</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDel(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={() => { if (del) deleteBloco.mutate(del.id); setDel(null); }}>Excluir</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default RotinaSemanaPanel;
