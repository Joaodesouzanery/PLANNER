import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BarChart3, FileText, Link as LinkIcon, Plus, Save, Trash2 } from "lucide-react";
import { AttachmentManager } from "@/components/ems/AttachmentManager";
import { BoardCategoryDocuments } from "@/components/ems/BoardCategoryDocuments";
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
import { GOV_CATEGORIES, PRIORITY_OPTIONS, STATUS_OPTIONS, dateLabel, today } from "./boardShared";

const emptyItem = {
  title: "", description: "", status: "open", priority: "medium", owner: "", due_date: "",
  reference_url: "", impact: "", effort: "", roi: "", contingency: "",
  meeting_topic: "", decision_needed: "", follow_up: "",
};
const emptyLog = { title: "", notes: "", happened_at: today() };
const emptyMetric = { name: "", value: "", unit: "", notes: "", metric_date: today() };

export const BoardDomainPanel = ({ category: initialCategory }: { category: string }) => {
  const { selectedCompanyId } = useCompany();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [category, setCategory] = useState(initialCategory);
  const [itemDialogOpen, setItemDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any | null>(null);
  const [itemForm, setItemForm] = useState(emptyItem);
  const [logForm, setLogForm] = useState(emptyLog);
  const [metricForm, setMetricForm] = useState(emptyMetric);
  const hasCompanyFilter = selectedCompanyId !== "all";
  const active = GOV_CATEGORIES.find((c) => c.id === category) || GOV_CATEGORIES[0];
  const companyFilter = (query: any) => hasCompanyFilter ? query.eq("company_id", selectedCompanyId) : query;

  const { data: items = [] } = useQuery({
    queryKey: ["governance-items", selectedCompanyId, category],
    staleTime: 1000 * 60 * 2,
    queryFn: async () => {
      let q = (supabase as any).from("governance_items").select("*").eq("category", category)
        .order("due_date", { ascending: true, nullsFirst: false });
      const { data, error } = await companyFilter(q);
      if (error) throw error;
      return data || [];
    },
  });

  const { data: logs = [] } = useQuery({
    queryKey: ["governance-logs", selectedCompanyId, category],
    staleTime: 1000 * 60 * 2,
    queryFn: async () => {
      let q = (supabase as any).from("governance_logs").select("*").eq("category", category)
        .order("happened_at", { ascending: false }).limit(12);
      const { data, error } = await companyFilter(q);
      if (error) throw error;
      return data || [];
    },
  });

  const { data: metrics = [] } = useQuery({
    queryKey: ["governance-metrics", selectedCompanyId, category],
    staleTime: 1000 * 60 * 3,
    queryFn: async () => {
      let q = (supabase as any).from("governance_metrics").select("*").eq("category", category)
        .order("metric_date", { ascending: false }).limit(12);
      const { data, error } = await companyFilter(q);
      if (error) throw error;
      return data || [];
    },
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["governance-items"] });
    queryClient.invalidateQueries({ queryKey: ["governance-items-overview"] });
    queryClient.invalidateQueries({ queryKey: ["governance-logs"] });
    queryClient.invalidateQueries({ queryKey: ["governance-metrics"] });
  };

  const saveItem = useMutation({
    mutationFn: async () => {
      const payload = {
        category,
        title: itemForm.title,
        description: itemForm.description || null,
        status: itemForm.status,
        priority: itemForm.priority,
        owner: itemForm.owner || null,
        due_date: itemForm.due_date || null,
        company_id: hasCompanyFilter ? selectedCompanyId : null,
        metadata: {
          reference_url: itemForm.reference_url || null,
          impact: itemForm.impact || null,
          effort: itemForm.effort || null,
          roi: itemForm.roi || null,
          contingency: itemForm.contingency || null,
          meeting_topic: itemForm.meeting_topic || null,
          decision_needed: itemForm.decision_needed || null,
          follow_up: itemForm.follow_up || null,
        },
      };
      const query = (supabase as any).from("governance_items");
      const { error } = editingItem?.id ? await query.update(payload).eq("id", editingItem.id) : await query.insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      setItemDialogOpen(false);
      setEditingItem(null);
      setItemForm(emptyItem);
      toast({ title: "Item do Conselho salvo" });
    },
    onError: (error: any) => toast({ title: "Erro ao salvar", description: error?.message, variant: "destructive" }),
  });

  const deleteItem = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("governance_items").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { invalidate(); toast({ title: "Item removido" }); },
  });

  const saveLog = useMutation({
    mutationFn: async () => {
      const { error } = await (supabase as any).from("governance_logs").insert({
        category, title: logForm.title, notes: logForm.notes || null,
        happened_at: logForm.happened_at, company_id: hasCompanyFilter ? selectedCompanyId : null,
      });
      if (error) throw error;
    },
    onSuccess: () => { invalidate(); setLogForm(emptyLog); toast({ title: "Registro adicionado ao histórico" }); },
  });

  const saveMetric = useMutation({
    mutationFn: async () => {
      const { error } = await (supabase as any).from("governance_metrics").insert({
        category, name: metricForm.name, value: metricForm.value ? Number(metricForm.value) : null,
        unit: metricForm.unit || null, notes: metricForm.notes || null,
        metric_date: metricForm.metric_date, company_id: hasCompanyFilter ? selectedCompanyId : null,
      });
      if (error) throw error;
    },
    onSuccess: () => { invalidate(); setMetricForm(emptyMetric); toast({ title: "Métrica registrada" }); },
  });

  const openNew = () => { setEditingItem(null); setItemForm(emptyItem); setItemDialogOpen(true); };
  const openEdit = (item: any) => {
    setEditingItem(item);
    setItemForm({
      title: item.title || "", description: item.description || "", status: item.status || "open",
      priority: item.priority || "medium", owner: item.owner || "", due_date: item.due_date || "",
      reference_url: item.metadata?.reference_url || "", impact: item.metadata?.impact || "",
      effort: item.metadata?.effort || "", roi: item.metadata?.roi || "", contingency: item.metadata?.contingency || "",
      meeting_topic: item.metadata?.meeting_topic || "", decision_needed: item.metadata?.decision_needed || "",
      follow_up: item.metadata?.follow_up || "",
    });
    setItemDialogOpen(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger className="w-full sm:w-64"><SelectValue /></SelectTrigger>
          <SelectContent>{GOV_CATEGORIES.map((c) => <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>)}</SelectContent>
        </Select>
        <Button onClick={openNew}><Plus className="h-4 w-4 mr-2" /> Novo item</Button>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.25fr_0.75fr]">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <span className={cn("p-1.5 rounded-lg", active.bg)}><active.icon className={cn("h-4 w-4", active.color)} /></span>
              {active.label}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {items.length === 0 ? (
              <div className="py-12 text-center text-sm text-muted-foreground">Nenhum item cadastrado nesta área.</div>
            ) : items.map((item: any) => (
              <div key={item.id} className="rounded-lg border p-3 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="font-semibold text-sm truncate">{item.title}</h3>
                    {item.description && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{item.description}</p>}
                  </div>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteItem.mutate(item.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <Badge variant="outline" className="text-[10px]">{STATUS_OPTIONS.find((o) => o.value === item.status)?.label || item.status}</Badge>
                  <Badge variant="outline" className={cn("text-[10px]", item.priority === "critical" || item.priority === "high" ? "text-red-500 border-red-500/30" : "text-muted-foreground")}>
                    {PRIORITY_OPTIONS.find((o) => o.value === item.priority)?.label || item.priority}
                  </Badge>
                  {item.owner && <Badge variant="secondary" className="text-[10px]">{item.owner}</Badge>}
                  {item.due_date && <Badge variant="secondary" className="text-[10px]">{dateLabel(item.due_date)}</Badge>}
                </div>
                {item.metadata?.reference_url && (
                  <a href={item.metadata.reference_url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary flex items-center gap-1 hover:underline">
                    <LinkIcon className="h-3 w-3" /> Referência/cofre externo
                  </a>
                )}
                {item.metadata?.contingency && <p className="text-xs text-muted-foreground">Contingência: {item.metadata.contingency}</p>}
                {(item.metadata?.meeting_topic || item.metadata?.decision_needed || item.metadata?.follow_up) && (
                  <div className="grid gap-2 rounded-lg border border-border/50 bg-muted/20 p-2 text-xs text-muted-foreground">
                    {item.metadata?.meeting_topic && <p><span className="font-medium text-foreground">Pauta:</span> {item.metadata.meeting_topic}</p>}
                    {item.metadata?.decision_needed && <p><span className="font-medium text-foreground">Decisão:</span> {item.metadata.decision_needed}</p>}
                    {item.metadata?.follow_up && <p><span className="font-medium text-foreground">Follow-up:</span> {item.metadata.follow_up}</p>}
                  </div>
                )}
                <div className="flex justify-between items-center gap-2">
                  <Button variant="outline" size="sm" className="h-8" onClick={() => openEdit(item)}>Editar</Button>
                </div>
                <AttachmentManager entityType="governance" entityId={item.id} companyId={item.company_id} clientCompanyId={item.company_id} governanceItemId={item.id} documentType={category} title="Anexos" accept="application/pdf" showMetadata />
              </div>
            ))}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2"><BarChart3 className="h-4 w-4 text-primary" /> Métricas</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <Input placeholder="Métrica" value={metricForm.name} onChange={(e) => setMetricForm({ ...metricForm, name: e.target.value })} />
                <Input placeholder="Valor" type="number" value={metricForm.value} onChange={(e) => setMetricForm({ ...metricForm, value: e.target.value })} />
                <Input placeholder="Unidade" value={metricForm.unit} onChange={(e) => setMetricForm({ ...metricForm, unit: e.target.value })} />
                <Input type="date" value={metricForm.metric_date} onChange={(e) => setMetricForm({ ...metricForm, metric_date: e.target.value })} />
              </div>
              <Textarea placeholder="Observações" value={metricForm.notes} onChange={(e) => setMetricForm({ ...metricForm, notes: e.target.value })} />
              <Button size="sm" onClick={() => saveMetric.mutate()} disabled={!metricForm.name.trim() || saveMetric.isPending}>
                <Save className="h-3.5 w-3.5 mr-1" /> Registrar métrica
              </Button>
              <div className="space-y-2 pt-2">
                {metrics.slice(0, 5).map((metric: any) => (
                  <div key={metric.id} className="text-xs rounded border p-2 flex justify-between gap-2">
                    <span>{metric.name}</span>
                    <strong>{metric.value ?? "-"} {metric.unit}</strong>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2"><FileText className="h-4 w-4 text-primary" /> Histórico</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Input placeholder="Título do registro" value={logForm.title} onChange={(e) => setLogForm({ ...logForm, title: e.target.value })} />
              <Input type="date" value={logForm.happened_at} onChange={(e) => setLogForm({ ...logForm, happened_at: e.target.value })} />
              <Textarea placeholder="Negociação, decisão, comunicado, crise resolvida..." value={logForm.notes} onChange={(e) => setLogForm({ ...logForm, notes: e.target.value })} />
              <Button size="sm" onClick={() => saveLog.mutate()} disabled={!logForm.title.trim() || saveLog.isPending}>
                <Save className="h-3.5 w-3.5 mr-1" /> Adicionar histórico
              </Button>
              <div className="space-y-2 pt-2">
                {logs.slice(0, 6).map((log: any) => (
                  <div key={log.id} className="rounded border p-2">
                    <div className="flex justify-between gap-2 text-xs">
                      <strong>{log.title}</strong>
                      <span className="text-muted-foreground">{dateLabel(log.happened_at)}</span>
                    </div>
                    {log.notes && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{log.notes}</p>}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <BoardCategoryDocuments category={category} />

      <Dialog open={itemDialogOpen} onOpenChange={setItemDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingItem ? "Editar item" : `Novo item em ${active.label}`}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Input placeholder="Título" value={itemForm.title} onChange={(e) => setItemForm({ ...itemForm, title: e.target.value })} />
            <Textarea placeholder="Descrição" value={itemForm.description} onChange={(e) => setItemForm({ ...itemForm, description: e.target.value })} />
            <div className="grid sm:grid-cols-2 gap-3">
              <Select value={itemForm.status} onValueChange={(v) => setItemForm({ ...itemForm, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{STATUS_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
              </Select>
              <Select value={itemForm.priority} onValueChange={(v) => setItemForm({ ...itemForm, priority: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{PRIORITY_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
              </Select>
              <Input placeholder="Responsável" value={itemForm.owner} onChange={(e) => setItemForm({ ...itemForm, owner: e.target.value })} />
              <Input type="date" value={itemForm.due_date} onChange={(e) => setItemForm({ ...itemForm, due_date: e.target.value })} />
            </div>
            <Input placeholder="Link/referência do cofre externo, Drive ou sistema" value={itemForm.reference_url} onChange={(e) => setItemForm({ ...itemForm, reference_url: e.target.value })} />
            <div className="grid sm:grid-cols-3 gap-3">
              <Input placeholder="Impacto" value={itemForm.impact} onChange={(e) => setItemForm({ ...itemForm, impact: e.target.value })} />
              <Input placeholder="Esforço" value={itemForm.effort} onChange={(e) => setItemForm({ ...itemForm, effort: e.target.value })} />
              <Input placeholder="ROI estimado" value={itemForm.roi} onChange={(e) => setItemForm({ ...itemForm, roi: e.target.value })} />
            </div>
            <div className="grid sm:grid-cols-3 gap-3">
              <Input placeholder="Assunto de pauta" value={itemForm.meeting_topic} onChange={(e) => setItemForm({ ...itemForm, meeting_topic: e.target.value })} />
              <Input placeholder="Decisão necessária" value={itemForm.decision_needed} onChange={(e) => setItemForm({ ...itemForm, decision_needed: e.target.value })} />
              <Input placeholder="Follow-up" value={itemForm.follow_up} onChange={(e) => setItemForm({ ...itemForm, follow_up: e.target.value })} />
            </div>
            <Textarea placeholder="Plano de contingência / observações de prontidão" value={itemForm.contingency} onChange={(e) => setItemForm({ ...itemForm, contingency: e.target.value })} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setItemDialogOpen(false)}>Cancelar</Button>
            <Button onClick={() => saveItem.mutate()} disabled={!itemForm.title.trim() || saveItem.isPending}>
              {saveItem.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
