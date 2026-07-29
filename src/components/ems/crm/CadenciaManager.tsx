import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Repeat, Plus, Trash2, ChevronDown, ChevronRight } from "lucide-react";
import { useCrmCadencias } from "./useCrmCadencias";
import { CADENCIA_TIPO_LABEL, CANAL_LABEL, CANAIS, type CadenciaTipo, type Canal } from "./cadencias";

const TIPOS: CadenciaTipo[] = ["inbound", "outbound_frio", "expansao", "reativacao"];

/** Gerencia cadências (templates de followup) e seus passos (canal + dia_offset + modelo). */
export const CadenciaManager = () => {
  const { cadencias, passosByCad, saveCadencia, deleteCadencia, savePasso, deletePasso } = useCrmCadencias();
  const [open, setOpen] = useState(false);
  const [nova, setNova] = useState({ nome: "", tipo: "outbound_frio" as CadenciaTipo });
  const [expanded, setExpanded] = useState<string | null>(null);
  const [passo, setPasso] = useState({ canal: "email" as Canal, dia_offset: "0" });

  const addCadencia = () => { if (!nova.nome.trim()) return; saveCadencia.mutate({ nome: nova.nome.trim(), tipo: nova.tipo }); setNova({ nome: "", tipo: "outbound_frio" }); };
  const addPasso = (cadId: string) => { savePasso.mutate({ cadencia_id: cadId, canal: passo.canal, dia_offset: Number(passo.dia_offset) || 0 }); setPasso({ canal: "email", dia_offset: "0" }); };

  return (
    <>
      <Button size="sm" variant="ghost" className="h-8 gap-1.5 text-xs" onClick={() => setOpen(true)}><Repeat className="h-3.5 w-3.5" />Cadências</Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Repeat className="h-4 w-4 text-primary" />Cadências de followup</DialogTitle></DialogHeader>

          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-dashed border-primary/40 p-2">
            <Input value={nova.nome} onChange={(e) => setNova((n) => ({ ...n, nome: e.target.value }))} placeholder="Nome da cadência" className="h-8 flex-1 text-xs" />
            <Select value={nova.tipo} onValueChange={(v) => setNova((n) => ({ ...n, tipo: v as CadenciaTipo }))}>
              <SelectTrigger className="h-8 w-[150px] text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>{TIPOS.map((t) => <SelectItem key={t} value={t}>{CADENCIA_TIPO_LABEL[t]}</SelectItem>)}</SelectContent>
            </Select>
            <Button size="sm" className="h-8" onClick={addCadencia} disabled={!nova.nome.trim()}><Plus className="h-3.5 w-3.5" /></Button>
          </div>

          <div className="space-y-1.5 max-h-[50vh] overflow-y-auto">
            {cadencias.length === 0 && <p className="text-sm text-muted-foreground text-center py-6">Nenhuma cadência ainda. Ex.: "Outbound frio" com passos e-mail dia 0, LinkedIn dia 2, follow-up dia 5.</p>}
            {cadencias.map((c) => {
              const passos = passosByCad.get(c.id) ?? [];
              const isOpen = expanded === c.id;
              return (
                <div key={c.id} className="rounded-lg border border-border/50">
                  <div className="flex items-center gap-2 p-2">
                    <button onClick={() => setExpanded(isOpen ? null : c.id)} className="text-muted-foreground">{isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}</button>
                    <span className="text-sm font-medium flex-1 truncate">{c.nome}</span>
                    <Badge variant="outline" className="text-[9px]">{CADENCIA_TIPO_LABEL[c.tipo as CadenciaTipo] || c.tipo}</Badge>
                    <Badge variant="secondary" className="text-[9px]">{passos.length} passo{passos.length === 1 ? "" : "s"}</Badge>
                    <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => deleteCadencia.mutate(c.id)}><Trash2 className="h-3 w-3" /></Button>
                  </div>
                  {isOpen && (
                    <div className="border-t border-border/50 p-2 space-y-1">
                      {passos.map((p) => (
                        <div key={p.id} className="flex items-center gap-2 text-xs">
                          <Badge variant="outline" className="text-[9px]">#{p.passo_n}</Badge>
                          <span className="w-16">{CANAL_LABEL[p.canal as Canal] || p.canal}</span>
                          <span className="text-muted-foreground">dia +{p.dia_offset}</span>
                          <span className="flex-1 truncate text-muted-foreground">{p.modelo_mensagem || ""}</span>
                          <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => deletePasso.mutate(p.id)}><Trash2 className="h-3 w-3" /></Button>
                        </div>
                      ))}
                      <div className="flex items-center gap-1.5 pt-1">
                        <Select value={passo.canal} onValueChange={(v) => setPasso((s) => ({ ...s, canal: v as Canal }))}>
                          <SelectTrigger className="h-7 w-[110px] text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>{CANAIS.map((k) => <SelectItem key={k} value={k}>{CANAL_LABEL[k]}</SelectItem>)}</SelectContent>
                        </Select>
                        <Input type="number" value={passo.dia_offset} onChange={(e) => setPasso((s) => ({ ...s, dia_offset: e.target.value }))} className="h-7 w-[64px] text-xs" placeholder="dia +" />
                        <Button size="sm" variant="outline" className="h-7 gap-1 text-xs" onClick={() => addPasso(c.id)}><Plus className="h-3 w-3" />passo</Button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default CadenciaManager;
