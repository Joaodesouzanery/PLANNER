import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarClock, Plus, RefreshCw, CheckCircle2, Trash2, Lock, Unlock, Anchor, Wrench, Compass } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useEstrategia, type Ciclo } from "./useEstrategia";

const HORIZONTES = ["quinzenal", "mensal", "trimestral", "semestral", "anual"];
const DECISAO: Record<string, { label: string; icon: typeof Anchor; tone: string }> = {
  manter: { label: "Manter o rumo", icon: Anchor, tone: "text-emerald-400 border-emerald-500/40 bg-emerald-500/10" },
  ajustar: { label: "Ajustar", icon: Wrench, tone: "text-amber-400 border-amber-500/40 bg-amber-500/10" },
  pivotar: { label: "Pivotar", icon: Compass, tone: "text-destructive border-destructive/40 bg-destructive/10" },
};
const fmtD = (d: string | null) => (d ? format(new Date(d + "T00:00:00"), "dd/MM/yy", { locale: ptBR }) : "—");
const todayIso = () => format(new Date(), "yyyy-MM-dd");

// Ciclos de revisão guiados: fecham o loop da estratégia (o que fiz / aprendi → manter, ajustar ou pivotar).
export const EstrategiaCiclos = () => {
  const est = useEstrategia();
  const [cicloForm, setCicloForm] = useState<null | Partial<Ciclo>>(null);
  const [revisando, setRevisando] = useState<null | Ciclo>(null);

  const revsByCiclo = useMemo(() => {
    const m = new Map<string, typeof est.revisoes>();
    for (const r of est.revisoes) {
      if (!r.ciclo_id) continue;
      const arr = m.get(r.ciclo_id); if (arr) arr.push(r); else m.set(r.ciclo_id, [r]);
    }
    return m;
  }, [est.revisoes]);

  const toggleStatus = (c: Ciclo) => est.saveCiclo.mutate({ id: c.id, ...c, status: c.status === "aberto" ? "fechado" : "aberto" });

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold flex items-center gap-1.5"><CalendarClock className="h-4 w-4 text-primary" />Ciclos de revisão</h3>
          <p className="text-[11px] text-muted-foreground">A cadência que fecha o loop: no fim de cada ciclo, você revisa e decide manter, ajustar ou pivotar.</p>
        </div>
        <Button size="sm" variant="outline" onClick={() => setCicloForm({ horizonte: "trimestral", inicio: todayIso(), fim: "" })} className="gap-1 shrink-0"><Plus className="h-3.5 w-3.5" />Novo ciclo</Button>
      </div>

      {est.ciclos.length === 0 ? (
        <Card className="border-dashed border-border/60 bg-card/40">
          <CardContent className="py-8 text-center text-muted-foreground">
            <p className="text-sm">Nenhum ciclo ainda.</p>
            <p className="text-xs mt-1">Um ciclo trimestral é um bom começo — revise a cada 90 dias.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {est.ciclos.map((c) => {
            const revs = revsByCiclo.get(c.id) ?? [];
            const aberto = c.status === "aberto";
            return (
              <Card key={c.id} className="border-border/50 bg-card/60">
                <CardContent className="p-3 space-y-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline" className="text-[10px] capitalize">{c.horizonte}</Badge>
                    <span className="text-xs text-muted-foreground">{fmtD(c.inicio)} — {fmtD(c.fim)}</span>
                    <Badge variant="outline" className={cn("text-[9px]", aberto ? "text-primary border-primary/30" : "text-muted-foreground")}>{aberto ? "aberto" : "fechado"}</Badge>
                    <div className="ml-auto flex gap-0.5">
                      <Button size="sm" variant="ghost" className="h-7 gap-1 text-xs text-muted-foreground hover:text-primary" onClick={() => setRevisando(c)}><RefreshCw className="h-3 w-3" />Revisar</Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground hover:text-foreground" title={aberto ? "Fechar ciclo" : "Reabrir ciclo"} onClick={() => toggleStatus(c)}>{aberto ? <Lock className="h-3.5 w-3.5" /> : <Unlock className="h-3.5 w-3.5" />}</Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => est.deleteCiclo.mutate(c.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                    </div>
                  </div>

                  {revs.length > 0 && (
                    <div className="space-y-1.5 pl-1 border-l border-border/40">
                      {revs.map((r) => {
                        const d = DECISAO[r.decisao] || DECISAO.manter;
                        const Icon = d.icon;
                        return (
                          <div key={r.id} className="pl-2 text-xs group flex items-start gap-2">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] text-muted-foreground">{fmtD(r.data)}</span>
                                <Badge variant="outline" className={cn("text-[9px] gap-0.5", d.tone)}><Icon className="h-2.5 w-2.5" />{d.label}</Badge>
                              </div>
                              {r.fiz && <p className="text-[11px] mt-0.5"><span className="text-muted-foreground">Fiz:</span> {r.fiz}</p>}
                              {r.aprendi && <p className="text-[11px]"><span className="text-muted-foreground">Aprendi:</span> {r.aprendi}</p>}
                              {r.nota && <p className="text-[11px] text-muted-foreground italic">{r.nota}</p>}
                            </div>
                            <Button size="icon" variant="ghost" className="h-6 w-6 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100" onClick={() => est.deleteRevisao.mutate(r.id)}><Trash2 className="h-3 w-3" /></Button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <CicloDialog form={cicloForm} onClose={() => setCicloForm(null)} onSave={(f) => { est.saveCiclo.mutate(f); setCicloForm(null); }} />
      <RevisaoDialog ciclo={revisando} onClose={() => setRevisando(null)} est={est} />
    </div>
  );
};

// ── Novo ciclo ────────────────────────────────────────────────────────────────────────────────
const CicloDialog = ({ form, onClose, onSave }: { form: Partial<Ciclo> | null; onClose: () => void; onSave: (f: Partial<Ciclo>) => void }) => {
  const [f, setF] = useState<Partial<Ciclo>>({});
  useEffect(() => { if (form) setF(form); }, [form]);
  if (!form) return null;
  return (
    <Dialog open={!!form} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>Novo ciclo</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label className="text-[11px] text-muted-foreground">Horizonte</Label>
            <Select value={f.horizonte || "trimestral"} onValueChange={(v) => setF((s) => ({ ...s, horizonte: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{HORIZONTES.map((h) => <SelectItem key={h} value={h} className="capitalize">{h}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1"><Label className="text-[11px] text-muted-foreground">Início</Label><Input type="date" value={f.inicio || ""} onChange={(e) => setF((s) => ({ ...s, inicio: e.target.value }))} /></div>
            <div className="space-y-1"><Label className="text-[11px] text-muted-foreground">Fim</Label><Input type="date" value={f.fim || ""} onChange={(e) => setF((s) => ({ ...s, fim: e.target.value }))} /></div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={() => onSave(f)}>Criar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// ── Revisão guiada ────────────────────────────────────────────────────────────────────────────
const RevisaoDialog = ({ ciclo, onClose, est }: { ciclo: Ciclo | null; onClose: () => void; est: ReturnType<typeof useEstrategia> }) => {
  const [r, setR] = useState<{ fiz: string; aprendi: string; nota: string; decisao: string; fecharCiclo: boolean }>({ fiz: "", aprendi: "", nota: "", decisao: "manter", fecharCiclo: false });
  useEffect(() => { if (ciclo) setR({ fiz: "", aprendi: "", nota: "", decisao: "manter", fecharCiclo: false }); }, [ciclo]);
  if (!ciclo) return null;

  const salvar = () => {
    est.saveRevisao.mutate({ ciclo_id: ciclo.id, data: todayIso(), fiz: r.fiz, aprendi: r.aprendi, nota: r.nota, decisao: r.decisao });
    if (r.fecharCiclo && ciclo.status === "aberto") est.saveCiclo.mutate({ id: ciclo.id, ...ciclo, status: "fechado" });
    onClose();
  };

  return (
    <Dialog open={!!ciclo} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle className="flex items-center gap-2"><RefreshCw className="h-4 w-4 text-primary" />Revisão do ciclo</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1"><Label className="text-[11px] text-muted-foreground">O que eu fiz neste ciclo?</Label><Textarea rows={2} value={r.fiz} onChange={(e) => setR((s) => ({ ...s, fiz: e.target.value }))} placeholder="Entreguei… avancei em…" /></div>
          <div className="space-y-1"><Label className="text-[11px] text-muted-foreground">O que eu aprendi?</Label><Textarea rows={2} value={r.aprendi} onChange={(e) => setR((s) => ({ ...s, aprendi: e.target.value }))} placeholder="Descobri que… funcionou/não funcionou…" /></div>
          <div className="space-y-1">
            <Label className="text-[11px] text-muted-foreground">Decisão</Label>
            <div className="grid grid-cols-3 gap-2">
              {Object.entries(DECISAO).map(([k, d]) => {
                const Icon = d.icon; const active = r.decisao === k;
                return (
                  <button key={k} onClick={() => setR((s) => ({ ...s, decisao: k }))} className={cn("rounded-lg border p-2 text-[11px] flex flex-col items-center gap-1 transition-colors", active ? d.tone : "border-border/50 text-muted-foreground hover:text-foreground")}>
                    <Icon className="h-4 w-4" />{d.label}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="space-y-1"><Label className="text-[11px] text-muted-foreground">Nota (opcional)</Label><Input value={r.nota} onChange={(e) => setR((s) => ({ ...s, nota: e.target.value }))} placeholder="algo pra lembrar" /></div>
          {ciclo.status === "aberto" && (
            <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
              <input type="checkbox" checked={r.fecharCiclo} onChange={(e) => setR((s) => ({ ...s, fecharCiclo: e.target.checked }))} className="accent-primary" />
              <Lock className="h-3 w-3" /> Fechar o ciclo ao salvar
            </label>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={salvar} className="gap-1"><CheckCircle2 className="h-3.5 w-3.5" />Registrar revisão</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default EstrategiaCiclos;
