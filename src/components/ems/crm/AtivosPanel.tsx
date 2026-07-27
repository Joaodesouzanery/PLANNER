import { useMemo, useRef, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { format } from "date-fns";
import { FileText, Trophy, Sparkles, Plus, Pencil, Trash2, FileDown, Sheet } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import { exportTablePdf, captureChart, exportCsv } from "@/lib/exportPdf";
import { useCrmAtivos } from "./useCrmAtivos";
import { useCrmModulos } from "./useCrmModulos";
import { ModuloFilter } from "./ModuloFilter";
import { computeAtivosMetrics, dealsPerAtivo, ATIVO_TIPO_LABEL, ATIVO_TIPOS, type CrmAtivo, type AtivoTipo } from "./crmAtivos";
import type { useCrm } from "./useCrm";

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

const tipoLabel = (t: AtivoTipo) => ATIVO_TIPO_LABEL[t] || t;
const tipoStyle: Record<AtivoTipo, string> = {
  pdf: "text-teal-400", vsl: "text-purple-400", video: "text-amber-400", post: "text-blue-400",
};
const emptyForm: Partial<CrmAtivo> = {
  modulo_id: null, tipo: "post", titulo: "", angulo_de_dor: "", variante_de_copy: "", canal: "",
  data: "", leads_gerados: 0, impressions: null, views: null, opens: null, notes: "",
};

const Tile = ({ icon: Icon, label, value, tone }: { icon: typeof Trophy; label: string; value: string; tone?: string }) => (
  <div className="rounded-xl border border-border/50 bg-background/40 p-3">
    <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground"><Icon className="h-3.5 w-3.5" />{label}</p>
    <p className={cn("mt-1 font-mono text-lg font-bold leading-tight truncate", tone)}>{value}</p>
  </div>
);

const tooltipStyle = { background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 };

/** Painel de ativos: mede conversão (leads) por ângulo de dor / variante de copy / tipo / módulo, por produto. */
export const AtivosPanel = ({ crm }: { crm?: ReturnType<typeof useCrm> }) => {
  const { ativos, saveAtivo, deleteAtivo } = useCrmAtivos();
  const { modulos } = useCrmModulos();
  // Loop fechado: deals/ganhos/R$ influenciado originados por cada ativo (ativo_origem_id).
  const dealStats = useMemo(() => dealsPerAtivo((crm?.deals ?? []) as any[]), [crm?.deals]);
  const [moduloId, setModuloId] = useState<string | null>(null);
  const [form, setForm] = useState<Partial<CrmAtivo> & { id?: string }>(emptyForm);
  const [dialog, setDialog] = useState(false);
  const [del, setDel] = useState<{ open: boolean; id?: string; titulo?: string }>({ open: false });
  const [exporting, setExporting] = useState(false);
  const chartAngulo = useRef<HTMLDivElement>(null);
  const chartCopy = useRef<HTMLDivElement>(null);

  const moduloName = useMemo(() => {
    const map = new Map(modulos.map((m) => [m.id, m.name]));
    return (id: string | null) => (id ? map.get(id) || "Módulo removido" : "Guarda-chuva");
  }, [modulos]);

  const m = useMemo(() => computeAtivosMetrics(ativos, moduloId), [ativos, moduloId]);
  const rows = useMemo(() => (moduloId ? ativos.filter((a) => a.modulo_id === moduloId) : ativos), [ativos, moduloId]);

  const openForm = (a?: CrmAtivo) => { setForm(a ? { ...a } : emptyForm); setDialog(true); };
  const submit = () => { saveAtivo.mutate(form); setDialog(false); };

  const exportPdf = async () => {
    setExporting(true);
    try {
      const [imgA, imgC] = await Promise.all([captureChart(chartAngulo.current), captureChart(chartCopy.current)]);
      const images = [
        imgA && { heading: "Leads por ângulo de dor", dataUrl: imgA, height: 65 },
        imgC && { heading: "Leads por variante de copy", dataUrl: imgC, height: 65 },
      ].filter(Boolean) as { heading: string; dataUrl: string; height?: number }[];
      await exportTablePdf({
        title: "Painel de ativos", subtitle: `Gerado em ${format(new Date(), "dd/MM/yyyy HH:mm")}`,
        filename: `ativos-${format(new Date(), "yyyy-MM-dd")}.pdf`, images,
        sections: [
          { heading: "Resumo", head: [["Indicador", "Valor"]], body: [
            ["Total de ativos", String(m.totalAtivos)],
            ["Leads gerados", String(m.totalLeads)],
            ["Melhor ângulo", m.bestAngulo ? `${m.bestAngulo.label} (${m.bestAngulo.leads})` : "—"],
            ["Melhor copy", m.bestCopy ? `${m.bestCopy.label} (${m.bestCopy.leads})` : "—"],
          ] },
          { heading: "Ativos", head: [["Tipo", "Título", "Módulo", "Ângulo", "Copy", "Leads"]],
            body: rows.length ? rows.map((a) => [tipoLabel(a.tipo), a.titulo, moduloName(a.modulo_id), a.angulo_de_dor || "—", a.variante_de_copy || "—", String(a.leads_gerados)]) : [["—", "—", "—", "—", "—", "—"]] },
        ],
      });
    } catch (e: any) {
      toast({ title: "Falha ao exportar", description: e?.message, variant: "destructive" });
    } finally {
      setExporting(false);
    }
  };

  const exportSheet = () => exportCsv(
    `ativos-${format(new Date(), "yyyy-MM-dd")}.csv`,
    ["Tipo", "Titulo", "Modulo", "Angulo", "Copy", "Canal", "Data", "Leads", "Impressions", "Views", "Opens"],
    rows.map((a) => [tipoLabel(a.tipo), a.titulo, moduloName(a.modulo_id), a.angulo_de_dor || "", a.variante_de_copy || "", a.canal || "", a.data || "", a.leads_gerados, a.impressions ?? "", a.views ?? "", a.opens ?? ""]),
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">A métrica que decide é <b>leads gerados</b> (o passo adiante), não views/curtidas. Cruze por ângulo e copy pra achar o que converte.</p>
        <div className="flex items-center gap-1.5 shrink-0">
          <ModuloFilter value={moduloId} onChange={setModuloId} />
          <Button size="sm" variant="outline" className="h-8 gap-1.5 text-xs" onClick={exportSheet}><Sheet className="h-3.5 w-3.5" />CSV</Button>
          <Button size="sm" variant="outline" className="h-8 gap-1.5 text-xs" onClick={exportPdf} disabled={exporting}><FileDown className="h-3.5 w-3.5" />{exporting ? "Gerando..." : "PDF"}</Button>
          <Button size="sm" className="h-8 gap-1.5 text-xs" onClick={() => openForm()}><Plus className="h-3.5 w-3.5" />Novo ativo</Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        <Tile icon={FileText} label="Ativos" value={String(m.totalAtivos)} />
        <Tile icon={Trophy} label="Leads gerados" value={String(m.totalLeads)} tone="text-emerald-400" />
        <Tile icon={Sparkles} label="Melhor ângulo" value={m.bestAngulo?.label || "—"} tone={m.bestAngulo ? "text-primary" : ""} />
        <Tile icon={Sparkles} label="Melhor copy" value={m.bestCopy?.label || "—"} tone={m.bestCopy ? "text-primary" : ""} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {([["Leads por ângulo de dor", m.porAngulo, chartAngulo], ["Leads por variante de copy", m.porCopy, chartCopy]] as const).map(([title, data, ref]) => (
          <Card key={title} className="border border-border/50 bg-card/80">
            <CardHeader className="pb-2"><CardTitle className="text-base">{title}</CardTitle></CardHeader>
            <CardContent>
              <div ref={ref} className="h-[240px]">
                {data.length ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data} margin={{ top: 6, right: 8, left: -12, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="label" stroke="hsl(var(--muted-foreground))" fontSize={10} interval={0} angle={-20} textAnchor="end" height={48} />
                      <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} allowDecimals={false} />
                      <Tooltip contentStyle={tooltipStyle} />
                      <Bar dataKey="leads" name="Leads" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-center text-sm text-muted-foreground italic px-4">Cadastre ativos com ângulo/copy e leads pra ver a conversão.</div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="border border-border/50 bg-card/80">
        <CardHeader className="pb-2"><CardTitle className="text-base">Ativos ({rows.length})</CardTitle></CardHeader>
        <CardContent className="space-y-1.5">
          {rows.length === 0 && <p className="text-sm text-muted-foreground text-center py-6">Nenhum ativo ainda. Cadastre PDFs, VSLs, vídeos e posts pra medir o que converte.</p>}
          {rows.map((a) => (
            <div key={a.id} className="flex items-center gap-2 rounded-lg border border-border/50 p-2 text-sm">
              <Badge variant="outline" className={cn("text-[10px] shrink-0", tipoStyle[a.tipo])}>{tipoLabel(a.tipo)}</Badge>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{a.titulo}</p>
                <p className="text-[10px] text-muted-foreground truncate">
                  {moduloName(a.modulo_id)}{a.angulo_de_dor ? ` · ${a.angulo_de_dor}` : ""}{a.variante_de_copy ? ` · copy ${a.variante_de_copy}` : ""}{a.canal ? ` · ${a.canal}` : ""}
                </p>
              </div>
              <span className="font-mono text-emerald-400 shrink-0">{a.leads_gerados} leads</span>
              {(() => {
                const st = a.id ? dealStats.get(a.id) : undefined;
                return st ? (
                  <span className="hidden shrink-0 text-[10px] text-muted-foreground sm:block" title="deals originados por este ativo">
                    {st.deals}d · {st.ganhos}✓{st.valorInfluenciado > 0 ? ` · ${brl(st.valorInfluenciado)}` : ""}
                  </span>
                ) : null;
              })()}
              <div className="flex gap-0.5 shrink-0">
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => openForm(a)}><Pencil className="h-3 w-3" /></Button>
                <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => setDel({ open: true, id: a.id, titulo: a.titulo })}><Trash2 className="h-3 w-3" /></Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Criar / editar ativo */}
      <Dialog open={dialog} onOpenChange={(o) => !o && setDialog(false)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>{form.id ? "Editar ativo" : "Novo ativo"}</DialogTitle></DialogHeader>
          <div className="space-y-2 py-1 max-h-[60vh] overflow-y-auto">
            <Input placeholder="Título do ativo" value={form.titulo || ""} onChange={(e) => setForm((f) => ({ ...f, titulo: e.target.value }))} />
            <div className="grid grid-cols-2 gap-2">
              <Select value={form.tipo || "post"} onValueChange={(v) => setForm((f) => ({ ...f, tipo: v as AtivoTipo }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{ATIVO_TIPOS.map((t) => <SelectItem key={t} value={t}>{tipoLabel(t)}</SelectItem>)}</SelectContent>
              </Select>
              <Select value={form.modulo_id || "none"} onValueChange={(v) => setForm((f) => ({ ...f, modulo_id: v === "none" ? null : v }))}>
                <SelectTrigger><SelectValue placeholder="Módulo" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Guarda-chuva (geral)</SelectItem>
                  {modulos.map((mo) => <SelectItem key={mo.id} value={mo.id!}>{mo.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Input placeholder="Ângulo de dor" value={form.angulo_de_dor || ""} onChange={(e) => setForm((f) => ({ ...f, angulo_de_dor: e.target.value }))} />
              <Input placeholder="Variante de copy" value={form.variante_de_copy || ""} onChange={(e) => setForm((f) => ({ ...f, variante_de_copy: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Input placeholder="Canal" value={form.canal || ""} onChange={(e) => setForm((f) => ({ ...f, canal: e.target.value }))} />
              <Input type="date" value={form.data || ""} onChange={(e) => setForm((f) => ({ ...f, data: e.target.value }))} />
            </div>
            <div className="grid grid-cols-4 gap-2">
              <div><label className="text-[10px] text-muted-foreground">Leads</label><Input type="number" inputMode="numeric" value={form.leads_gerados ?? 0} onChange={(e) => setForm((f) => ({ ...f, leads_gerados: e.target.value === "" ? 0 : Number(e.target.value) }))} /></div>
              <div><label className="text-[10px] text-muted-foreground">Impr.</label><Input type="number" inputMode="numeric" value={form.impressions ?? ""} onChange={(e) => setForm((f) => ({ ...f, impressions: e.target.value === "" ? null : Number(e.target.value) }))} /></div>
              <div><label className="text-[10px] text-muted-foreground">Views</label><Input type="number" inputMode="numeric" value={form.views ?? ""} onChange={(e) => setForm((f) => ({ ...f, views: e.target.value === "" ? null : Number(e.target.value) }))} /></div>
              <div><label className="text-[10px] text-muted-foreground">Opens</label><Input type="number" inputMode="numeric" value={form.opens ?? ""} onChange={(e) => setForm((f) => ({ ...f, opens: e.target.value === "" ? null : Number(e.target.value) }))} /></div>
            </div>
            <Textarea placeholder="Notas (opcional)" rows={2} value={form.notes || ""} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(false)}>Cancelar</Button>
            <Button onClick={submit} disabled={!(form.titulo || "").trim() || saveAtivo.isPending}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={del.open} onOpenChange={(o) => !o && setDel({ open: false })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir ativo?</AlertDialogTitle>
            <AlertDialogDescription>Excluir "{del.titulo}"? Não pode ser desfeito.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => { if (del.id) deleteAtivo.mutate(del.id); setDel({ open: false }); }} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AtivosPanel;
