import { useMemo, useState } from "react";
import { Award, Trophy, ShieldCheck, Plus, Pencil, Trash2, Lock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import type { useCrm } from "./useCrm";
import { useCrmModulos } from "./useCrmModulos";
import { useCrmProvas, type CrmProva } from "./useCrmProvas";

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const emptyForm: Partial<CrmProva> = { customer_id: null, modulo_id: null, titulo: "", resultado_valor: null, evidencia: "", permissao_uso: false, data: "", descricao: "" };

const Tile = ({ icon: Icon, label, value, tone }: { icon: typeof Trophy; label: string; value: string; tone?: string }) => (
  <div className="rounded-xl border border-border/50 bg-background/40 p-3">
    <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground"><Icon className="h-3.5 w-3.5" />{label}</p>
    <p className={cn("mt-1 font-mono text-lg font-bold leading-tight truncate", tone)}>{value}</p>
  </div>
);

/** Motor de Prova: casos com resultado R$ + evidência + permissão de uso. Realimenta a "prova" dos PDFs-ímã. */
export const ProvaPanel = ({ crm }: { crm: ReturnType<typeof useCrm> }) => {
  const { provas, saveProva, deleteProva } = useCrmProvas();
  const { modulos } = useCrmModulos();
  const [form, setForm] = useState<Partial<CrmProva> & { id?: string }>(emptyForm);
  const [dialog, setDialog] = useState(false);
  const [del, setDel] = useState<{ open: boolean; id?: string; titulo?: string }>({ open: false });

  const customerName = useMemo(() => {
    const map = new Map(crm.customers.map((c) => [c.id, c.nome]));
    return (id: string | null) => (id ? map.get(id) || "Cliente removido" : "—");
  }, [crm.customers]);
  const moduloName = useMemo(() => {
    const map = new Map(modulos.map((m) => [m.id, m.name]));
    return (id: string | null) => (id ? map.get(id) || null : null);
  }, [modulos]);

  const totalValor = provas.reduce((s, p) => s + (Number(p.resultado_valor) || 0), 0);
  const comPermissao = provas.filter((p) => p.permissao_uso).length;

  const openForm = (p?: CrmProva) => { setForm(p ? { ...p } : emptyForm); setDialog(true); };
  const submit = () => { saveProva.mutate(form); setDialog(false); };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">Cada resultado de cliente vira prova estruturada (resultado R$ + evidência + permissão). É o que alimenta a seção "prova" dos seus PDFs.</p>
        <Button size="sm" className="h-8 gap-1.5 text-xs shrink-0" onClick={() => openForm()}><Plus className="h-3.5 w-3.5" />Nova prova</Button>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <Tile icon={Award} label="Provas" value={String(provas.length)} />
        <Tile icon={Trophy} label="R$ comprovado" value={brl(totalValor)} tone="text-emerald-400" />
        <Tile icon={ShieldCheck} label="Com permissão de uso" value={String(comPermissao)} tone={comPermissao ? "text-primary" : ""} />
      </div>

      <Card className="border border-border/50 bg-card/80">
        <CardHeader className="pb-2"><CardTitle className="text-base">Provas ({provas.length})</CardTitle></CardHeader>
        <CardContent className="space-y-1.5">
          {provas.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">Nenhuma prova ainda. Cada cliente com resultado medido (R$ economizado/ganho) vira uma prova aqui — a isca para vender o próximo módulo.</p>
          )}
          {provas.map((p) => {
            const mod = moduloName(p.modulo_id);
            return (
              <div key={p.id} className="flex items-start gap-2 rounded-lg border border-border/50 p-2 text-sm">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{p.titulo}</p>
                  <p className="text-[10px] text-muted-foreground truncate">
                    {customerName(p.customer_id)}{mod ? ` · ${mod}` : ""}{p.data ? ` · ${p.data}` : ""}{p.evidencia ? " · evidência ✓" : ""}
                  </p>
                </div>
                {p.resultado_valor != null && <span className="font-mono text-emerald-400 shrink-0">{brl(Number(p.resultado_valor))}</span>}
                <Badge variant="outline" className={cn("gap-1 text-[9px] shrink-0", p.permissao_uso ? "text-emerald-400 border-emerald-500/30" : "text-muted-foreground")}>
                  {p.permissao_uso ? <ShieldCheck className="h-2.5 w-2.5" /> : <Lock className="h-2.5 w-2.5" />}{p.permissao_uso ? "público" : "privado"}
                </Badge>
                <div className="flex gap-0.5 shrink-0">
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => openForm(p)}><Pencil className="h-3 w-3" /></Button>
                  <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => setDel({ open: true, id: p.id, titulo: p.titulo })}><Trash2 className="h-3 w-3" /></Button>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Criar / editar prova */}
      <Dialog open={dialog} onOpenChange={(o) => !o && setDialog(false)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>{form.id ? "Editar prova" : "Nova prova"}</DialogTitle></DialogHeader>
          <div className="space-y-2 py-1 max-h-[60vh] overflow-y-auto">
            <Input placeholder="Título do caso (ex.: Reduziu glosa em 40%)" value={form.titulo || ""} onChange={(e) => setForm((f) => ({ ...f, titulo: e.target.value }))} />
            <div className="grid grid-cols-2 gap-2">
              <Select value={form.customer_id || "none"} onValueChange={(v) => setForm((f) => ({ ...f, customer_id: v === "none" ? null : v }))}>
                <SelectTrigger><SelectValue placeholder="Cliente" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sem cliente</SelectItem>
                  {crm.customers.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={form.modulo_id || "none"} onValueChange={(v) => setForm((f) => ({ ...f, modulo_id: v === "none" ? null : v }))}>
                <SelectTrigger><SelectValue placeholder="Módulo" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sem módulo</SelectItem>
                  {modulos.map((m) => <SelectItem key={m.id} value={m.id!}>{m.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Input type="number" inputMode="numeric" placeholder="Resultado R$" value={form.resultado_valor ?? ""} onChange={(e) => setForm((f) => ({ ...f, resultado_valor: e.target.value === "" ? null : Number(e.target.value) }))} />
              <Input type="date" value={form.data || ""} onChange={(e) => setForm((f) => ({ ...f, data: e.target.value }))} />
            </div>
            <Input placeholder="Evidência (link/print/descrição)" value={form.evidencia || ""} onChange={(e) => setForm((f) => ({ ...f, evidencia: e.target.value }))} />
            <Textarea placeholder="Descrição do caso (o antes/depois, o número)" rows={2} value={form.descricao || ""} onChange={(e) => setForm((f) => ({ ...f, descricao: e.target.value }))} />
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={!!form.permissao_uso} onCheckedChange={(v) => setForm((f) => ({ ...f, permissao_uso: !!v }))} />
              Tenho permissão pra usar como prova pública (caso/depoimento)
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(false)}>Cancelar</Button>
            <Button onClick={submit} disabled={!(form.titulo || "").trim() || saveProva.isPending}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={del.open} onOpenChange={(o) => !o && setDel({ open: false })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir prova?</AlertDialogTitle>
            <AlertDialogDescription>Excluir "{del.titulo}"? Não pode ser desfeito.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => { if (del.id) deleteProva.mutate(del.id); setDel({ open: false }); }} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default ProvaPanel;
