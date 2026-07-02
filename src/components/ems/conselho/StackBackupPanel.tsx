import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { Archive, DatabaseBackup, Plus, Save, Trash2 } from "lucide-react";
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
import { CRITICALITY_OPTIONS, dateLabel, today } from "./boardShared";

const money = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const PIE_COLORS = ["hsl(var(--primary))", "hsl(142 76% 36%)", "hsl(38 92% 50%)", "hsl(0 84% 60%)", "hsl(217 91% 60%)", "hsl(280 65% 60%)"];
const daysSince = (date?: string | null) => date ? Math.floor((Date.now() - new Date(`${date}T12:00:00`).getTime()) / 86400000) : null;

const emptyBackup = { scope: "", backup_type: "full", status: "success", backup_date: today(), destination: "", is_automated: "false", notes: "" };
const emptyTool = {
  name: "", category: "", vendor: "", url: "", criticality: "medium", status: "active",
  cost: "", billing_cycle: "monthly", renewal_date: "", vault_reference: "", owner: "", has_backup: "false", notes: "",
};

export const StackBackupPanel = () => {
  const { selectedCompanyId } = useCompany();
  const { toast } = useToast();
  const confirm = useConfirm();
  const queryClient = useQueryClient();
  const [backupForm, setBackupForm] = useState(emptyBackup);
  const [toolDialogOpen, setToolDialogOpen] = useState(false);
  const [editingTool, setEditingTool] = useState<any | null>(null);
  const [toolForm, setToolForm] = useState(emptyTool);
  const hasCompanyFilter = selectedCompanyId !== "all";
  const companyFilter = (q: any) => hasCompanyFilter ? q.eq("company_id", selectedCompanyId) : q;
  const todayStr = today();

  const { data: backups = [] } = useQuery({
    queryKey: ["board-backups", selectedCompanyId],
    staleTime: 1000 * 60 * 2,
    queryFn: async () => {
      const { data, error } = await companyFilter(
        (supabase as any).from("board_backup_logs").select("*").order("backup_date", { ascending: false }).limit(60),
      );
      if (error) throw error;
      return data || [];
    },
  });

  const { data: tools = [] } = useQuery({
    queryKey: ["board-stack", selectedCompanyId],
    staleTime: 1000 * 60 * 2,
    queryFn: async () => {
      const { data, error } = await companyFilter((supabase as any).from("board_stack_items").select("*").order("name"));
      if (error) throw error;
      return data || [];
    },
  });

  // Saude por escopo: ultimo backup de sucesso por scope.
  const sources = useMemo(() => {
    const map: Record<string, any> = {};
    (backups as any[]).filter((b) => b.status === "success").forEach((b) => {
      const scope = b.scope || "geral";
      if (!map[scope] || b.backup_date > map[scope].backup_date) map[scope] = b;
    });
    return Object.entries(map).map(([scope, b]: [string, any]) => {
      const age = daysSince(b.backup_date) ?? 999;
      const tone = age <= 7 ? "emerald" : age <= 30 ? "amber" : "red";
      return { scope, last: b.backup_date, age, tone, destination: b.destination };
    }).sort((a, b) => b.age - a.age);
  }, [backups]);

  const lastGlobal = (backups as any[]).filter((b) => b.status === "success")[0]?.backup_date;
  const monthlyCost = useMemo(() => (tools as any[]).filter((t) => t.status === "active").reduce((s, t) => {
    const c = Number(t.cost || 0);
    return s + (t.billing_cycle === "annual" ? c / 12 : t.billing_cycle === "one_time" ? 0 : c);
  }, 0), [tools]);

  const costByCategory = useMemo(() => {
    const map: Record<string, number> = {};
    (tools as any[]).filter((t) => t.status === "active" && t.cost).forEach((t) => {
      const c = Number(t.cost || 0);
      const monthly = t.billing_cycle === "annual" ? c / 12 : c;
      const key = t.category || "outros";
      map[key] = (map[key] || 0) + monthly;
    });
    return Object.entries(map).map(([name, value]) => ({ name, value: Math.round(value) }));
  }, [tools]);

  const invalidate = (keys: string[]) => keys.forEach((k) => queryClient.invalidateQueries({ queryKey: [k] }));

  const saveBackup = useMutation({
    mutationFn: async () => {
      const { error } = await (supabase as any).from("board_backup_logs").insert({
        scope: backupForm.scope || null, backup_type: backupForm.backup_type, status: backupForm.status,
        backup_date: backupForm.backup_date, destination: backupForm.destination || null,
        is_automated: backupForm.is_automated === "true", notes: backupForm.notes || null,
        company_id: hasCompanyFilter ? selectedCompanyId : null,
      });
      if (error) throw error;
    },
    onSuccess: () => { invalidate(["board-backups", "health-backups"]); setBackupForm(emptyBackup); toast({ title: "Backup registrado" }); },
    onError: (e: any) => toast({ title: "Erro ao registrar backup", description: e?.message, variant: "destructive" }),
  });

  const saveTool = useMutation({
    mutationFn: async () => {
      const payload = {
        name: toolForm.name, category: toolForm.category || null, vendor: toolForm.vendor || null, url: toolForm.url || null,
        criticality: toolForm.criticality, status: toolForm.status, cost: toolForm.cost ? Number(toolForm.cost) : null,
        billing_cycle: toolForm.billing_cycle, renewal_date: toolForm.renewal_date || null,
        vault_reference: toolForm.vault_reference || null, owner: toolForm.owner || null,
        has_backup: toolForm.has_backup === "true", notes: toolForm.notes || null,
        company_id: hasCompanyFilter ? selectedCompanyId : null,
      };
      const table = (supabase as any).from("board_stack_items");
      const { error } = editingTool?.id ? await table.update(payload).eq("id", editingTool.id) : await table.insert(payload);
      if (error) throw error;
    },
    onSuccess: () => { invalidate(["board-stack"]); setToolDialogOpen(false); setEditingTool(null); setToolForm(emptyTool); toast({ title: "Ferramenta salva" }); },
    onError: (e: any) => toast({ title: "Erro ao salvar ferramenta", description: e?.message, variant: "destructive" }),
  });

  const deleteTool = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("board_stack_items").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { invalidate(["board-stack"]); toast({ title: "Ferramenta removida" }); },
  });

  const openNewTool = () => { setEditingTool(null); setToolForm(emptyTool); setToolDialogOpen(true); };
  const openEditTool = (t: any) => {
    setEditingTool(t);
    setToolForm({
      name: t.name || "", category: t.category || "", vendor: t.vendor || "", url: t.url || "",
      criticality: t.criticality || "medium", status: t.status || "active", cost: t.cost ? String(t.cost) : "",
      billing_cycle: t.billing_cycle || "monthly", renewal_date: t.renewal_date || "", vault_reference: t.vault_reference || "",
      owner: t.owner || "", has_backup: t.has_backup ? "true" : "false", notes: t.notes || "",
    });
    setToolDialogOpen(true);
  };

  const critTone = (c: string) => c === "critical" ? "text-red-500 border-red-500/30" : c === "high" ? "text-amber-500 border-amber-500/30" : "text-muted-foreground";
  const toneDot = (t: string) => t === "emerald" ? "bg-emerald-500" : t === "amber" ? "bg-amber-500" : "bg-red-500";

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      {/* BACKUP HEALTH */}
      <div className="space-y-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><DatabaseBackup className="h-4 w-4 text-primary" /> Saúde dos dados</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-lg border bg-muted/20 p-3">
              <p className="text-xs text-muted-foreground">Último backup global</p>
              <p className="text-lg font-bold">{lastGlobal ? `${dateLabel(lastGlobal)} (há ${daysSince(lastGlobal)}d)` : "Nenhum registro"}</p>
            </div>
            {sources.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">Registre um backup para acompanhar a saúde por fonte.</p>
            ) : sources.map((s) => (
              <div key={s.scope} className="flex items-center justify-between gap-2 rounded-lg border p-2.5">
                <div className="flex items-center gap-2 min-w-0">
                  <span className={cn("h-2.5 w-2.5 rounded-full shrink-0", toneDot(s.tone))} />
                  <span className="text-sm font-medium truncate">{s.scope}</span>
                </div>
                <span className="text-xs text-muted-foreground shrink-0">{dateLabel(s.last)} · {s.age}d</span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Registrar backup</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <Input placeholder="Escopo (database, financeiro...)" value={backupForm.scope} onChange={(e) => setBackupForm({ ...backupForm, scope: e.target.value })} />
              <Input type="date" value={backupForm.backup_date} onChange={(e) => setBackupForm({ ...backupForm, backup_date: e.target.value })} />
              <Select value={backupForm.status} onValueChange={(v) => setBackupForm({ ...backupForm, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="success">Sucesso</SelectItem>
                  <SelectItem value="partial">Parcial</SelectItem>
                  <SelectItem value="failed">Falhou</SelectItem>
                  <SelectItem value="scheduled">Agendado</SelectItem>
                </SelectContent>
              </Select>
              <Input placeholder="Destino (Drive, S3...)" value={backupForm.destination} onChange={(e) => setBackupForm({ ...backupForm, destination: e.target.value })} />
            </div>
            <Button size="sm" onClick={() => saveBackup.mutate()} disabled={!backupForm.scope.trim() || saveBackup.isPending}><Save className="h-3.5 w-3.5 mr-1" /> Registrar</Button>
          </CardContent>
        </Card>
      </div>

      {/* STACK INVENTORY */}
      <div className="space-y-4">
        <Card>
          <CardHeader className="pb-2 flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base flex items-center gap-2"><Archive className="h-4 w-4 text-primary" /> Stack · {money(monthlyCost)}/mês</CardTitle>
            <Button size="sm" onClick={openNewTool}><Plus className="h-4 w-4 mr-1" /> Ferramenta</Button>
          </CardHeader>
          <CardContent className="space-y-2">
            {costByCategory.length > 0 && (
              <ResponsiveContainer width="100%" height={140}>
                <PieChart>
                  <Pie data={costByCategory} dataKey="value" nameKey="name" innerRadius={32} outerRadius={56} paddingAngle={2}>
                    {costByCategory.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v: any) => money(Number(v))} contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            )}
            {(tools as any[]).length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">Nenhuma ferramenta cadastrada.</p>
            ) : (tools as any[]).map((t) => {
              const renewalSoon = t.renewal_date && t.renewal_date <= new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
              return (
                <div key={t.id} className="rounded-lg border p-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold truncate">{t.name}</p>
                      <div className="flex flex-wrap gap-1.5 mt-1">
                        {t.category && <Badge variant="outline" className="text-[10px]">{t.category}</Badge>}
                        <Badge variant="outline" className={cn("text-[10px]", critTone(t.criticality))}>{CRITICALITY_OPTIONS.find((c) => c.value === t.criticality)?.label || t.criticality}</Badge>
                        {t.cost && <Badge variant="secondary" className="text-[10px]">{money(Number(t.cost))}/{t.billing_cycle === "annual" ? "ano" : "mês"}</Badge>}
                        {t.renewal_date && <Badge variant={renewalSoon ? "destructive" : "outline"} className="text-[10px]">Renova {dateLabel(t.renewal_date)}</Badge>}
                        {t.vault_reference && <Badge variant="outline" className="text-[10px]">🔑 cofre</Badge>}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => openEditTool(t)}>Editar</Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={async () => { if (await confirm({ title: `Excluir "${t.name}"?`, description: "Remove a ferramenta do stack.", destructive: true, confirmText: "Excluir" })) deleteTool.mutate(t.id); }}><Trash2 className="h-3.5 w-3.5" /></Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>

      <Dialog open={toolDialogOpen} onOpenChange={setToolDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>{editingTool ? "Editar ferramenta" : "Nova ferramenta"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-3">
              <Input placeholder="Nome (ex: Supabase, Figma)" value={toolForm.name} onChange={(e) => setToolForm({ ...toolForm, name: e.target.value })} />
              <Input placeholder="Categoria (infra, design...)" value={toolForm.category} onChange={(e) => setToolForm({ ...toolForm, category: e.target.value })} />
              <Input placeholder="Fornecedor" value={toolForm.vendor} onChange={(e) => setToolForm({ ...toolForm, vendor: e.target.value })} />
              <Input placeholder="URL" value={toolForm.url} onChange={(e) => setToolForm({ ...toolForm, url: e.target.value })} />
              <Select value={toolForm.criticality} onValueChange={(v) => setToolForm({ ...toolForm, criticality: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{CRITICALITY_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
              </Select>
              <Select value={toolForm.status} onValueChange={(v) => setToolForm({ ...toolForm, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Ativa</SelectItem>
                  <SelectItem value="trial">Trial</SelectItem>
                  <SelectItem value="deprecated">Em desuso</SelectItem>
                  <SelectItem value="churned">Cancelada</SelectItem>
                </SelectContent>
              </Select>
              <Input placeholder="Custo" type="number" value={toolForm.cost} onChange={(e) => setToolForm({ ...toolForm, cost: e.target.value })} />
              <Select value={toolForm.billing_cycle} onValueChange={(v) => setToolForm({ ...toolForm, billing_cycle: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="monthly">Mensal</SelectItem>
                  <SelectItem value="annual">Anual</SelectItem>
                  <SelectItem value="one_time">Única</SelectItem>
                  <SelectItem value="usage">Por uso</SelectItem>
                </SelectContent>
              </Select>
              <div><label className="text-xs text-muted-foreground">Renovação</label><Input type="date" value={toolForm.renewal_date} onChange={(e) => setToolForm({ ...toolForm, renewal_date: e.target.value })} /></div>
              <Input placeholder="Responsável" value={toolForm.owner} onChange={(e) => setToolForm({ ...toolForm, owner: e.target.value })} />
            </div>
            <Input placeholder="Referência do cofre (1Password/Bitwarden) — NUNCA a senha" value={toolForm.vault_reference} onChange={(e) => setToolForm({ ...toolForm, vault_reference: e.target.value })} />
            <Textarea placeholder="Observações" value={toolForm.notes} onChange={(e) => setToolForm({ ...toolForm, notes: e.target.value })} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setToolDialogOpen(false)}>Cancelar</Button>
            <Button onClick={() => saveTool.mutate()} disabled={!toolForm.name.trim() || saveTool.isPending}>{saveTool.isPending ? "Salvando..." : "Salvar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
