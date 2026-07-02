import { Fragment, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Plus, ShieldAlert, ShieldX, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { useConfirm } from "@/hooks/useConfirm";
import { RISK_CATEGORIES, dateLabel, riskBand } from "./boardShared";

const RISK_STATUS = [
  { value: "open", label: "Aberto" },
  { value: "mitigating", label: "Mitigando" },
  { value: "monitored", label: "Monitorado" },
  { value: "closed", label: "Encerrado" },
];
const SCALE = [1, 2, 3, 4, 5];
const cellTone = (score: number) => {
  const band = riskBand(score).tone;
  return band === "red" ? "bg-red-500/80 text-white" : band === "amber" ? "bg-amber-500/80 text-white"
    : band === "yellow" ? "bg-yellow-400/70" : "bg-emerald-500/70 text-white";
};

const emptyRisk = {
  title: "", description: "", category: "operational", probability: "3", impact: "3",
  status: "open", owner: "", mitigation: "", contingency: "", review_date: "",
};

export const RiskMatrixPanel = () => {
  const { selectedCompanyId } = useCompany();
  const { toast } = useToast();
  const confirm = useConfirm();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [form, setForm] = useState(emptyRisk);
  const [cellFilter, setCellFilter] = useState<{ p: number; i: number } | null>(null);
  const hasCompanyFilter = selectedCompanyId !== "all";
  const companyFilter = (q: any) => hasCompanyFilter ? q.eq("company_id", selectedCompanyId) : q;

  const { data: risks = [] } = useQuery({
    queryKey: ["board-risks", selectedCompanyId],
    staleTime: 1000 * 60 * 2,
    queryFn: async () => {
      const { data, error } = await companyFilter(
        (supabase as any).from("board_risks").select("*").order("score", { ascending: false }),
      );
      if (error) throw error;
      return data || [];
    },
  });

  const matrix = useMemo(() => {
    const map: Record<string, number> = {};
    (risks as any[]).filter((r) => r.status !== "closed").forEach((r) => {
      const key = `${r.probability}:${r.impact}`;
      map[key] = (map[key] || 0) + 1;
    });
    return map;
  }, [risks]);

  const visibleRisks = useMemo(() => {
    if (!cellFilter) return risks as any[];
    return (risks as any[]).filter((r) => r.probability === cellFilter.p && r.impact === cellFilter.i);
  }, [risks, cellFilter]);

  const summary = useMemo(() => {
    const open = (risks as any[]).filter((r) => r.status !== "closed");
    return {
      total: open.length,
      critical: open.filter((r) => Number(r.score) >= 16).length,
      unmitigated: open.filter((r) => !r.mitigation).length,
    };
  }, [risks]);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["board-risks"] });
    queryClient.invalidateQueries({ queryKey: ["health-risks"] });
  };

  const saveRisk = useMutation({
    mutationFn: async () => {
      const payload = {
        title: form.title,
        description: form.description || null,
        category: form.category,
        probability: Number(form.probability),
        impact: Number(form.impact),
        status: form.status,
        owner: form.owner || null,
        mitigation: form.mitigation || null,
        contingency: form.contingency || null,
        review_date: form.review_date || null,
        company_id: hasCompanyFilter ? selectedCompanyId : null,
      };
      const table = (supabase as any).from("board_risks");
      const { error } = editing?.id ? await table.update(payload).eq("id", editing.id) : await table.insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      setDialogOpen(false);
      setEditing(null);
      setForm(emptyRisk);
      toast({ title: "Risco salvo" });
    },
    onError: (e: any) => toast({ title: "Erro ao salvar risco", description: e?.message, variant: "destructive" }),
  });

  const deleteRisk = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("board_risks").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { invalidate(); toast({ title: "Risco removido" }); },
  });

  const openNew = () => { setEditing(null); setForm(emptyRisk); setDialogOpen(true); };
  const openEdit = (r: any) => {
    setEditing(r);
    setForm({
      title: r.title || "", description: r.description || "", category: r.category || "operational",
      probability: String(r.probability || 3), impact: String(r.impact || 3), status: r.status || "open",
      owner: r.owner || "", mitigation: r.mitigation || "", contingency: r.contingency || "", review_date: r.review_date || "",
    });
    setDialogOpen(true);
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-3">
        {[
          { label: "Riscos abertos", value: summary.total, icon: AlertTriangle },
          { label: "Críticos", value: summary.critical, icon: ShieldX },
          { label: "Sem mitigação", value: summary.unmitigated, icon: ShieldAlert },
        ].map((c) => (
          <Card key={c.label}>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10 text-primary"><c.icon className="h-5 w-5" /></div>
              <div><p className="text-2xl font-bold">{c.value}</p><p className="text-xs text-muted-foreground">{c.label}</p></div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
        <Card>
          <CardHeader className="pb-2 flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-primary" /> Matriz de risco</CardTitle>
            {cellFilter && <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setCellFilter(null)}>Limpar filtro</Button>}
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              <div className="flex flex-col justify-around py-6 text-[10px] font-medium text-muted-foreground">
                <span className="-rotate-90 whitespace-nowrap">Probabilidade</span>
              </div>
              <div className="flex-1">
                <div className="grid grid-cols-[auto_repeat(5,1fr)] gap-1">
                  <div />
                  {SCALE.map((i) => <div key={i} className="text-center text-[10px] text-muted-foreground">{i}</div>)}
                  {[5, 4, 3, 2, 1].map((p) => (
                    <Fragment key={`row-${p}`}>
                      <div className="flex items-center justify-center text-[10px] text-muted-foreground pr-1">{p}</div>
                      {SCALE.map((i) => {
                        const score = p * i;
                        const count = matrix[`${p}:${i}`] || 0;
                        const selected = cellFilter?.p === p && cellFilter?.i === i;
                        return (
                          <button
                            key={`${p}:${i}`}
                            type="button"
                            onClick={() => setCellFilter(selected ? null : { p, i })}
                            className={cn("aspect-square rounded flex items-center justify-center text-sm font-bold transition-all hover:ring-2 hover:ring-primary/50",
                              cellTone(score), selected && "ring-2 ring-foreground")}
                            title={`Prob ${p} × Impacto ${i} = ${score}`}
                          >
                            {count > 0 ? count : ""}
                          </button>
                        );
                      })}
                    </Fragment>
                  ))}
                </div>
                <p className="mt-2 text-center text-[10px] text-muted-foreground">Impacto →</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2 flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">Riscos priorizados {cellFilter && <span className="text-xs text-muted-foreground">(P{cellFilter.p}×I{cellFilter.i})</span>}</CardTitle>
            <Button size="sm" onClick={openNew}><Plus className="h-4 w-4 mr-1" /> Novo risco</Button>
          </CardHeader>
          <CardContent className="space-y-2">
            {visibleRisks.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">Nenhum risco {cellFilter ? "nesta célula" : "cadastrado"}.</p>
            ) : visibleRisks.map((r: any) => {
              const band = riskBand(Number(r.score));
              return (
                <div key={r.id} className="rounded-lg border p-3 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold truncate">{r.title}</p>
                      {r.description && <p className="text-xs text-muted-foreground line-clamp-2">{r.description}</p>}
                    </div>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={async () => { if (await confirm({ title: `Excluir risco "${r.title}"?`, destructive: true, confirmText: "Excluir" })) deleteRisk.mutate(r.id); }}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <Badge variant={band.tone === "red" ? "destructive" : "secondary"} className="text-[10px]">{band.label} ({r.score})</Badge>
                    <Badge variant="outline" className="text-[10px]">{RISK_CATEGORIES.find((c) => c.value === r.category)?.label || r.category}</Badge>
                    <Badge variant="outline" className="text-[10px]">P{r.probability}×I{r.impact}</Badge>
                    {r.owner && <Badge variant="secondary" className="text-[10px]">{r.owner}</Badge>}
                    {r.review_date && <Badge variant="outline" className="text-[10px]">Revisar {dateLabel(r.review_date)}</Badge>}
                  </div>
                  {r.mitigation && <p className="text-xs text-muted-foreground"><span className="font-medium text-foreground">Mitigação:</span> {r.mitigation}</p>}
                  <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => openEdit(r)}>Editar</Button>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>{editing ? "Editar risco" : "Novo risco"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <Input placeholder="Título do risco" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            <Textarea placeholder="Descrição" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            <div className="grid sm:grid-cols-2 gap-3">
              <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{RISK_CATEGORIES.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
              </Select>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{RISK_STATUS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
              </Select>
              <div>
                <label className="text-xs text-muted-foreground">Probabilidade (1-5)</label>
                <Select value={form.probability} onValueChange={(v) => setForm({ ...form, probability: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{SCALE.map((n) => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Impacto (1-5)</label>
                <Select value={form.impact} onValueChange={(v) => setForm({ ...form, impact: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{SCALE.map((n) => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <Input placeholder="Responsável" value={form.owner} onChange={(e) => setForm({ ...form, owner: e.target.value })} />
              <Input type="date" value={form.review_date} onChange={(e) => setForm({ ...form, review_date: e.target.value })} />
            </div>
            <Textarea placeholder="Plano de mitigação" value={form.mitigation} onChange={(e) => setForm({ ...form, mitigation: e.target.value })} />
            <Textarea placeholder="Plano de contingência" value={form.contingency} onChange={(e) => setForm({ ...form, contingency: e.target.value })} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={() => saveRisk.mutate()} disabled={!form.title.trim() || saveRisk.isPending}>
              {saveRisk.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
