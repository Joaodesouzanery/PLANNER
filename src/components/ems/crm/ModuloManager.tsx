import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Boxes, Plus, Pencil, Trash2, ChevronUp, ChevronDown, Link2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCompany } from "@/contexts/CompanyContext";
import { useCrmModulos } from "./useCrmModulos";
import { useRotinasByModulo } from "./useRotinasByModulo";
import { MODULO_COLOR_OPTIONS, DEFAULT_MODULO_COLOR, MODULO_TIPO_LABEL, type CrmModulo, type ModuloTipo } from "./crmModulos";
import { MODULO_TEMPLATES, suggestModuloTemplate } from "./crmModuloTemplates";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type Form = { name: string; dor: string; comprador: string; canal_forte: string; tipo: ModuloTipo; color: string };
const emptyForm: Form = { name: "", dor: "", comprador: "", canal_forte: "", tipo: "aquisicao", color: DEFAULT_MODULO_COLOR };

/** Gerencia o catálogo de módulos do produto (crm_modulos): gerar do template, add/editar/reordenar/excluir. */
export const ModuloManager = () => {
  const { selectedCompany } = useCompany();
  const { modulos, isEmpty, saveModulo, deleteModulo, reorderModulos, seedModulos } = useCrmModulos();
  const { byModulo: rotinasByModulo } = useRotinasByModulo();
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<{ open: boolean; modulo?: CrmModulo }>({ open: false });
  const [form, setForm] = useState<Form>(emptyForm);
  const [del, setDel] = useState<{ open: boolean; id?: string; name?: string }>({ open: false });

  const suggested = suggestModuloTemplate(selectedCompany?.name);
  const [templateKey, setTemplateKey] = useState<string | null>(null);
  const activeTemplate = MODULO_TEMPLATES.find((t) => t.key === (templateKey ?? suggested?.key)) ?? MODULO_TEMPLATES[0];

  const openEdit = (m?: CrmModulo) => {
    setForm(
      m
        ? { name: m.name, dor: m.dor || "", comprador: m.comprador || "", canal_forte: m.canal_forte || "", tipo: m.tipo, color: m.color }
        : emptyForm,
    );
    setEdit({ open: true, modulo: m });
  };
  const submit = () => {
    saveModulo.mutate({
      id: edit.modulo?.id,
      name: form.name.trim(),
      dor: form.dor.trim() || null,
      comprador: form.comprador.trim() || null,
      canal_forte: form.canal_forte.trim() || null,
      tipo: form.tipo,
      color: form.color,
    });
    setEdit({ open: false });
  };
  const move = (idx: number, dir: -1 | 1) => {
    const ids = modulos.map((r) => r.id!).filter(Boolean);
    const j = idx + dir;
    if (j < 0 || j >= ids.length) return;
    [ids[idx], ids[j]] = [ids[j], ids[idx]];
    reorderModulos.mutate(ids);
  };

  return (
    <>
      <Button size="sm" variant="ghost" className="h-7 gap-1.5 text-xs" onClick={() => setOpen(true)}>
        <Boxes className="h-3.5 w-3.5" />Módulos
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Boxes className="h-4 w-4 text-primary" />Módulos {selectedCompany?.name ? `· ${selectedCompany.name}` : ""}
            </DialogTitle>
          </DialogHeader>

          {isEmpty && (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-2.5 space-y-2">
              <p className="text-xs">Este produto ainda não tem módulos. Gere a partir de um template pra começar.</p>
              <div className="flex items-center gap-2">
                <Select value={activeTemplate.key} onValueChange={setTemplateKey}>
                  <SelectTrigger className="h-8 text-xs flex-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {MODULO_TEMPLATES.map((t) => (
                      <SelectItem key={t.key} value={t.key}>
                        {t.name}{t.key === suggested?.key ? " · sugerido" : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button size="sm" onClick={() => seedModulos.mutate(activeTemplate.modulos)} disabled={seedModulos.isPending}>
                  Gerar módulos
                </Button>
              </div>
            </div>
          )}

          <div className="space-y-1.5 max-h-[50vh] overflow-y-auto">
            {modulos.map((m, i) => (
              <div key={m.id || m.key} className="flex items-center gap-2 rounded-lg border border-border/50 p-2">
                <span className={cn("h-4 w-4 rounded shrink-0 bg-gradient-to-r to-transparent border", m.color)} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm truncate">
                    {m.name} <Badge variant={m.tipo === "retencao" ? "secondary" : "outline"} className="ml-1 text-[9px]">{MODULO_TIPO_LABEL[m.tipo]}</Badge>
                    {(rotinasByModulo.get(m.id!)?.length ?? 0) > 0 && (
                      <Badge variant="outline" className="ml-1 gap-0.5 text-[9px] text-primary border-primary/40" title={rotinasByModulo.get(m.id!)!.map((r) => r.title).join(" · ")}>
                        <Link2 className="h-2.5 w-2.5" />{rotinasByModulo.get(m.id!)!.length} rotina{rotinasByModulo.get(m.id!)!.length > 1 ? "s" : ""}
                      </Badge>
                    )}
                  </p>
                  {(m.dor || m.canal_forte) && <p className="text-[10px] text-muted-foreground truncate">{m.dor}{m.canal_forte ? ` · ${m.canal_forte}` : ""}</p>}
                </div>
                <div className="flex gap-0.5 shrink-0">
                  <Button variant="ghost" size="icon" className="h-6 w-6" disabled={i === 0 || reorderModulos.isPending} onClick={() => move(i, -1)}><ChevronUp className="h-3 w-3" /></Button>
                  <Button variant="ghost" size="icon" className="h-6 w-6" disabled={i === modulos.length - 1 || reorderModulos.isPending} onClick={() => move(i, 1)}><ChevronDown className="h-3 w-3" /></Button>
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => openEdit(m)}><Pencil className="h-3 w-3" /></Button>
                  <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => setDel({ open: true, id: m.id, name: m.name })}><Trash2 className="h-3 w-3" /></Button>
                </div>
              </div>
            ))}
          </div>

          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => openEdit()}>
            <Plus className="h-3.5 w-3.5" />Novo módulo
          </Button>
        </DialogContent>
      </Dialog>

      {/* Criar / editar módulo */}
      <Dialog open={edit.open} onOpenChange={(o) => !o && setEdit({ open: false })}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>{edit.modulo ? "Editar módulo" : "Novo módulo"}</DialogTitle></DialogHeader>
          <div className="space-y-3 py-1">
            <Input placeholder="Nome do módulo (ex.: Medição)" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
            <Input placeholder="Dor que resolve" value={form.dor} onChange={(e) => setForm((f) => ({ ...f, dor: e.target.value }))} />
            <Input placeholder="Comprador provável (cargo/tipo)" value={form.comprador} onChange={(e) => setForm((f) => ({ ...f, comprador: e.target.value }))} />
            <Input placeholder="Canal mais forte" value={form.canal_forte} onChange={(e) => setForm((f) => ({ ...f, canal_forte: e.target.value }))} />
            <div className="grid grid-cols-2 gap-2">
              <Select value={form.tipo} onValueChange={(v) => setForm((f) => ({ ...f, tipo: v as ModuloTipo }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="aquisicao">Aquisição</SelectItem>
                  <SelectItem value="retencao">Retenção</SelectItem>
                </SelectContent>
              </Select>
              <div className="flex flex-wrap items-center gap-1.5">
                {MODULO_COLOR_OPTIONS.map((c) => (
                  <button key={c.key} type="button" title={c.label} onClick={() => setForm((f) => ({ ...f, color: c.cls }))}
                    className={cn("h-6 w-6 rounded bg-gradient-to-r to-transparent border-2", c.cls, form.color === c.cls && "ring-2 ring-primary ring-offset-1 ring-offset-background")} />
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEdit({ open: false })}>Cancelar</Button>
            <Button onClick={submit} disabled={!form.name.trim() || saveModulo.isPending}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={del.open} onOpenChange={(o) => !o && setDel({ open: false })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir módulo?</AlertDialogTitle>
            <AlertDialogDescription>Excluir "{del.name}"? Deals com esse módulo ficam sem tag (aparecem em "Sem módulo"). Não pode ser desfeito.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => { if (del.id) deleteModulo.mutate(del.id); setDel({ open: false }); }} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default ModuloManager;
