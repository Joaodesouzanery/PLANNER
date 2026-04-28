import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  Archive,
  BarChart3,
  BookOpen,
  Briefcase,
  CalendarClock,
  FileText,
  Gavel,
  Link as LinkIcon,
  Megaphone,
  Plus,
  Save,
  ShieldCheck,
  Siren,
  Trash2,
  Wrench,
} from "lucide-react";
import { EMSLayout } from "@/components/ems/EMSLayout";
import { AttachmentManager } from "@/components/ems/AttachmentManager";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const CATEGORIES = [
  { id: "legal", label: "Jurídico", icon: Gavel, color: "text-violet-500", bg: "bg-violet-500/10" },
  { id: "accounting", label: "Contabilidade", icon: BookOpen, color: "text-blue-500", bg: "bg-blue-500/10" },
  { id: "optimization", label: "Otimizações", icon: Wrench, color: "text-emerald-500", bg: "bg-emerald-500/10" },
  { id: "marketing", label: "Marketing", icon: Megaphone, color: "text-pink-500", bg: "bg-pink-500/10" },
  { id: "stack_backup", label: "Stack & Backup", icon: Archive, color: "text-amber-500", bg: "bg-amber-500/10" },
  { id: "crisis", label: "Crises", icon: Siren, color: "text-red-500", bg: "bg-red-500/10" },
  { id: "admin", label: "Administrativo", icon: Briefcase, color: "text-cyan-500", bg: "bg-cyan-500/10" },
];

const STATUS_OPTIONS = [
  { value: "open", label: "Aberto" },
  { value: "in_review", label: "Em análise" },
  { value: "in_progress", label: "Em execução" },
  { value: "done", label: "Concluído" },
  { value: "archived", label: "Arquivado" },
];

const PRIORITY_OPTIONS = [
  { value: "low", label: "Baixa" },
  { value: "medium", label: "Média" },
  { value: "high", label: "Alta" },
  { value: "critical", label: "Crítica" },
];

const emptyItem = {
  title: "",
  description: "",
  status: "open",
  priority: "medium",
  owner: "",
  due_date: "",
  reference_url: "",
  impact: "",
  effort: "",
  roi: "",
  contingency: "",
};

const emptyLog = { title: "", notes: "", happened_at: new Date().toISOString().slice(0, 10) };
const emptyMetric = { name: "", value: "", unit: "", notes: "", metric_date: new Date().toISOString().slice(0, 10) };

const BoardCouncil = () => {
  const { selectedCompanyId } = useCompany();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeCategory, setActiveCategory] = useState("legal");
  const [itemDialogOpen, setItemDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any | null>(null);
  const [itemForm, setItemForm] = useState(emptyItem);
  const [logForm, setLogForm] = useState(emptyLog);
  const [metricForm, setMetricForm] = useState(emptyMetric);
  const hasCompanyFilter = selectedCompanyId !== "all";
  const active = CATEGORIES.find((category) => category.id === activeCategory) || CATEGORIES[0];

  const companyFilter = (query: any) => hasCompanyFilter ? query.eq("company_id", selectedCompanyId) : query;

  const { data: items = [] } = useQuery({
    queryKey: ["governance-items", selectedCompanyId, activeCategory],
    staleTime: 1000 * 60 * 2,
    queryFn: async () => {
      let q = (supabase as any)
        .from("governance_items")
        .select("*")
        .eq("category", activeCategory)
        .order("due_date", { ascending: true, nullsFirst: false });
      q = companyFilter(q);
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
  });

  const { data: logs = [] } = useQuery({
    queryKey: ["governance-logs", selectedCompanyId, activeCategory],
    staleTime: 1000 * 60 * 2,
    queryFn: async () => {
      let q = (supabase as any)
        .from("governance_logs")
        .select("*")
        .eq("category", activeCategory)
        .order("happened_at", { ascending: false })
        .limit(12);
      q = companyFilter(q);
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
  });

  const { data: metrics = [] } = useQuery({
    queryKey: ["governance-metrics", selectedCompanyId, activeCategory],
    staleTime: 1000 * 60 * 3,
    queryFn: async () => {
      let q = (supabase as any)
        .from("governance_metrics")
        .select("*")
        .eq("category", activeCategory)
        .order("metric_date", { ascending: false })
        .limit(12);
      q = companyFilter(q);
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
  });

  const summary = useMemo(() => {
    const open = items.filter((item: any) => !["done", "archived"].includes(item.status)).length;
    const critical = items.filter((item: any) => item.priority === "critical" || item.priority === "high").length;
    const dueSoon = items.filter((item: any) => item.due_date && item.due_date <= new Date(Date.now() + 1000 * 60 * 60 * 24 * 15).toISOString().slice(0, 10) && !["done", "archived"].includes(item.status)).length;
    return { open, critical, dueSoon };
  }, [items]);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["governance-items"] });
    queryClient.invalidateQueries({ queryKey: ["governance-logs"] });
    queryClient.invalidateQueries({ queryKey: ["governance-metrics"] });
  };

  const saveItem = useMutation({
    mutationFn: async () => {
      const payload = {
        category: activeCategory,
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
        category: activeCategory,
        title: logForm.title,
        notes: logForm.notes || null,
        happened_at: logForm.happened_at,
        company_id: hasCompanyFilter ? selectedCompanyId : null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      setLogForm(emptyLog);
      toast({ title: "Registro adicionado ao histórico" });
    },
  });

  const saveMetric = useMutation({
    mutationFn: async () => {
      const { error } = await (supabase as any).from("governance_metrics").insert({
        category: activeCategory,
        name: metricForm.name,
        value: metricForm.value ? Number(metricForm.value) : null,
        unit: metricForm.unit || null,
        notes: metricForm.notes || null,
        metric_date: metricForm.metric_date,
        company_id: hasCompanyFilter ? selectedCompanyId : null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      setMetricForm(emptyMetric);
      toast({ title: "Métrica registrada" });
    },
  });

  const openNew = () => {
    setEditingItem(null);
    setItemForm(emptyItem);
    setItemDialogOpen(true);
  };

  const openEdit = (item: any) => {
    setEditingItem(item);
    setItemForm({
      title: item.title || "",
      description: item.description || "",
      status: item.status || "open",
      priority: item.priority || "medium",
      owner: item.owner || "",
      due_date: item.due_date || "",
      reference_url: item.metadata?.reference_url || "",
      impact: item.metadata?.impact || "",
      effort: item.metadata?.effort || "",
      roi: item.metadata?.roi || "",
      contingency: item.metadata?.contingency || "",
    });
    setItemDialogOpen(true);
  };

  return (
    <EMSLayout>
      <div className="space-y-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <ShieldCheck className="h-6 w-6 text-primary" /> Conselho de Administração
            </h1>
            <p className="text-sm text-muted-foreground">Governança, riscos, obrigações, estratégia e memória executiva.</p>
          </div>
          <Button onClick={openNew}><Plus className="h-4 w-4 mr-2" /> Novo item</Button>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          {[
            { label: "Pendências abertas", value: summary.open, icon: FileText },
            { label: "Alta prioridade", value: summary.critical, icon: AlertTriangle },
            { label: "Vence em 15 dias", value: summary.dueSoon, icon: CalendarClock },
          ].map((card) => (
            <Card key={card.label}>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10 text-primary"><card.icon className="h-5 w-5" /></div>
                <div>
                  <p className="text-2xl font-bold">{card.value}</p>
                  <p className="text-xs text-muted-foreground">{card.label}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Tabs value={activeCategory} onValueChange={setActiveCategory}>
          <TabsList className="grid w-full grid-cols-2 md:grid-cols-4 xl:grid-cols-7 h-auto">
            {CATEGORIES.map((category) => (
              <TabsTrigger key={category.id} value={category.id} className="gap-1.5">
                <category.icon className="h-3.5 w-3.5" />
                <span className="truncate">{category.label}</span>
              </TabsTrigger>
            ))}
          </TabsList>

          {CATEGORIES.map((category) => (
            <TabsContent key={category.id} value={category.id} className="mt-4">
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
                          <Badge variant="outline" className="text-[10px]">{STATUS_OPTIONS.find((option) => option.value === item.status)?.label || item.status}</Badge>
                          <Badge variant="outline" className={cn("text-[10px]", item.priority === "critical" || item.priority === "high" ? "text-red-500 border-red-500/30" : "text-muted-foreground")}>
                            {PRIORITY_OPTIONS.find((option) => option.value === item.priority)?.label || item.priority}
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
                        <div className="flex justify-between items-center gap-2">
                          <Button variant="outline" size="sm" className="h-8" onClick={() => openEdit(item)}>Editar</Button>
                        </div>
                        <AttachmentManager entityType="governance" entityId={item.id} companyId={item.company_id} title="Anexos" />
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
            </TabsContent>
          ))}
        </Tabs>
      </div>

      <Dialog open={itemDialogOpen} onOpenChange={setItemDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingItem ? "Editar item" : `Novo item em ${active.label}`}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Input placeholder="Título" value={itemForm.title} onChange={(e) => setItemForm({ ...itemForm, title: e.target.value })} />
            <Textarea placeholder="Descrição" value={itemForm.description} onChange={(e) => setItemForm({ ...itemForm, description: e.target.value })} />
            <div className="grid sm:grid-cols-2 gap-3">
              <Select value={itemForm.status} onValueChange={(value) => setItemForm({ ...itemForm, status: value })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{STATUS_OPTIONS.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent>
              </Select>
              <Select value={itemForm.priority} onValueChange={(value) => setItemForm({ ...itemForm, priority: value })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{PRIORITY_OPTIONS.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent>
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
    </EMSLayout>
  );
};

const dateLabel = (date?: string | null) => {
  if (!date) return "Sem data";
  const [year, month, day] = date.slice(0, 10).split("-");
  if (!year || !month || !day) return date;
  return `${day}/${month}/${year}`;
};

export default BoardCouncil;
