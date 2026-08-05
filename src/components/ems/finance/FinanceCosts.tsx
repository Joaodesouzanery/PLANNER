/* eslint-disable @typescript-eslint/no-explicit-any */
import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { ChevronLeft, ChevronRight, Edit2, Layers, Plus, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { fmtCurrency, type Transaction } from "./useFinanceData";
import { useFinanceWorkspace } from "./useFinanceWorkspace";
import { useCostBuckets } from "./useCostBuckets";
import { CategorySelect } from "./CategorySelect";
import { useConfirm } from "@/hooks/useConfirm";
import { buildCostMonth, shiftMonth, type CostTx } from "./financeCosts";
import FinanceDuplicateAlert from "./FinanceDuplicateAlert";

const KINDS = [
  { value: "fixo", label: "Fixo" },
  { value: "variavel", label: "Variável" },
  { value: "outro", label: "Outro" },
];

const emptyCost = () => ({
  description: "", amount: 0, category: "", cost_bucket_id: "", finance_account_id: "",
  day: 5, is_recurring: true, recurrence_interval: "monthly", recurrence_end_date: "",
});

const monthLabel = (m: string) => {
  const [y, mm] = m.split("-").map(Number);
  return format(new Date(y, mm - 1, 1), "MMMM 'de' yyyy", { locale: ptBR });
};

/**
 * Custos (fixos, variáveis e tipos personalizados). Cada custo é uma saída recorrente
 * classificada num tipo — entra em projeções, dashboard e DRE como qualquer lançamento.
 * O check mensal materializa/reconcilia a transação daquele mês.
 */
export const FinanceCosts = () => {
  const {
    rawTransactions, allCategories, selectedAccounts, txInScope,
    saveTransactionMutation, deleteTransactionMutation, reconcileTransactionMutation, materializeReceived,
  } = useFinanceWorkspace();
  const { buckets, save: saveBucket, remove: removeBucket } = useCostBuckets();
  const confirm = useConfirm();

  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [costModal, setCostModal] = useState(false);
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [form, setForm] = useState(emptyCost());
  const [bucketModal, setBucketModal] = useState(false);
  const [bucketForm, setBucketForm] = useState<{ id?: string; name: string; kind: string }>({ name: "", kind: "fixo" });

  const scoped = useMemo(() => rawTransactions.filter(txInScope) as unknown as CostTx[], [rawTransactions, txInScope]);
  // Custos = saídas recorrentes (com ou sem tipo definido) + qualquer saída já classificada num tipo.
  const costs = useMemo(
    () => scoped.filter((t) => t.type === "expense" && (t.is_recurring || t.cost_bucket_id) && !t.source_id),
    [scoped],
  );
  const report = useMemo(() => buildCostMonth(buckets, costs, scoped, month), [buckets, costs, scoped, month]);

  const openNew = (bucketId?: string) => {
    setEditing(null);
    setForm({ ...emptyCost(), cost_bucket_id: bucketId || buckets[0]?.id || "", finance_account_id: selectedAccounts[0]?.id || "" });
    setCostModal(true);
  };

  const openEdit = (t: Transaction) => {
    setEditing(t);
    setForm({
      description: t.description, amount: Number(t.amount), category: t.category || "",
      cost_bucket_id: (t as any).cost_bucket_id || "", finance_account_id: t.finance_account_id || "",
      day: Number(String(t.due_date || t.date).slice(8, 10)) || 1,
      is_recurring: t.is_recurring ?? true, recurrence_interval: t.recurrence_interval || "monthly",
      recurrence_end_date: t.recurrence_end_date || "",
    });
    setCostModal(true);
  };

  const handleSaveCost = () => {
    const baseMonth = editing ? String(editing.due_date || editing.date).slice(0, 7) : month;
    const day = String(Math.min(Math.max(form.day || 1, 1), 28)).padStart(2, "0");
    const date = `${baseMonth}-${day}`;
    saveTransactionMutation.mutate(
      {
        form: {
          description: form.description, amount: Number(form.amount), type: "expense",
          category: form.category || null, date, due_date: date, status: "confirmed",
          finance_account_id: form.finance_account_id || null,
          cost_bucket_id: form.cost_bucket_id || null,
          is_recurring: form.is_recurring,
          recurrence_interval: form.is_recurring ? form.recurrence_interval || "monthly" : null,
          recurrence_end_date: form.is_recurring ? form.recurrence_end_date || null : null,
        },
        editingId: editing?.id,
      },
      { onSuccess: () => { setCostModal(false); setEditing(null); setForm(emptyCost()); } },
    );
  };

  const toggleCheck = (occ: (typeof report.groups)[number]["items"][number]) => {
    if (occ.paid) {
      if (!occ.txId) return;
      saveTransactionMutation.mutate({ form: { status: "confirmed", settled_at: null }, editingId: occ.txId });
      return;
    }
    if (occ.txId) { reconcileTransactionMutation.mutate(occ.txId); return; }
    materializeReceived.mutate({
      sourceId: occ.cost.id, date: occ.due, amount: occ.amount, kind: "expense",
      description: occ.cost.description, category: occ.cost.category || null,
      accountId: (occ.cost as any).finance_account_id || null,
    });
  };

  return (
    <div className="space-y-4">
      <FinanceDuplicateAlert />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon" className="h-9 w-9 rounded-xl" onClick={() => setMonth(shiftMonth(month, -1))}><ChevronLeft className="h-4 w-4" /></Button>
          <span className="min-w-[150px] text-center text-sm font-medium capitalize">{monthLabel(month)}</span>
          <Button variant="outline" size="icon" className="h-9 w-9 rounded-xl" onClick={() => setMonth(shiftMonth(month, 1))}><ChevronRight className="h-4 w-4" /></Button>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" className="rounded-xl" onClick={() => { setBucketForm({ name: "", kind: "fixo" }); setBucketModal(true); }}>
            <Layers className="h-4 w-4 mr-1" />Novo tipo de custo
          </Button>
          <Button size="sm" className="rounded-xl shadow-lg shadow-primary/20" onClick={() => openNew()}><Plus className="h-4 w-4 mr-1" />Novo custo</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[
          { label: "Custos do mês", value: report.total },
          { label: "Já pagos (check)", value: report.paidTotal },
          { label: "Em aberto", value: report.pendingTotal },
        ].map((kpi) => (
          <Card key={kpi.label} className="border border-border/50 bg-card/80">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">{kpi.label}</p>
              <p className="text-xl font-bold mt-1">{fmtCurrency(kpi.value)}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {report.groups.length === 0 && (
        <Card className="border border-dashed border-border/60"><CardContent className="p-8 text-center text-sm text-muted-foreground">
          Nenhum custo cadastrado ainda. Crie um tipo (Fixos, Variáveis…) e adicione os custos — eles entram nas projeções e no dashboard.
        </CardContent></Card>
      )}

      {report.groups.map((g) => (
        <Card key={g.bucket?.id || "none"} className="border border-border/50 bg-card/80">
          <CardContent className="p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: g.bucket?.color || "hsl(var(--primary))" }} />
                <span className="font-medium text-sm">{g.bucket?.name || "Sem tipo"}</span>
                {g.bucket && <Badge variant="outline" className="text-[10px]">{KINDS.find((k) => k.value === g.bucket?.kind)?.label || g.bucket.kind}</Badge>}
                <span className="text-xs text-muted-foreground">{fmtCurrency(g.paidTotal)} / {fmtCurrency(g.total)}</span>
              </div>
              <div className="flex gap-1">
                {g.bucket && (
                  <>
                    <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => openNew(g.bucket!.id)}><Plus className="h-3.5 w-3.5 mr-1" />Custo</Button>
                    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => { setBucketForm({ id: g.bucket!.id, name: g.bucket!.name, kind: g.bucket!.kind }); setBucketModal(true); }}><Edit2 className="h-3.5 w-3.5" /></Button>
                    <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={async () => {
                      if (await confirm({ title: "Remover tipo de custo?", description: `Os lançamentos de "${g.bucket!.name}" continuam, apenas ficam sem tipo.`, destructive: true, confirmText: "Remover" }))
                        removeBucket.mutate(g.bucket!.id);
                    }}><Trash2 className="h-3.5 w-3.5" /></Button>
                  </>
                )}
              </div>
            </div>

            <div className="space-y-1">
              {g.items.length === 0 && <p className="text-xs text-muted-foreground">Nenhum custo neste mês.</p>}
              {g.items.map((occ) => (
                <div key={occ.cost.id} className="flex items-center gap-3 rounded-lg border border-border/40 px-3 py-2">
                  <Checkbox checked={occ.paid} onCheckedChange={() => toggleCheck(occ)} aria-label="Marcar como pago" />
                  <div className="min-w-0 flex-1">
                    <p className={`text-sm truncate ${occ.paid ? "line-through text-muted-foreground" : ""}`}>{occ.cost.description}</p>
                    <p className="text-[11px] text-muted-foreground">
                      vence {occ.due.slice(8, 10)}/{occ.due.slice(5, 7)} · {occ.cost.category || "sem categoria"}
                      {occ.cost.is_recurring ? " · recorrente" : ""}
                    </p>
                  </div>
                  <span className="text-sm font-medium">{fmtCurrency(occ.amount)}</span>
                  <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openEdit(occ.cost as unknown as Transaction)}><Edit2 className="h-3.5 w-3.5" /></Button>
                  <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={async () => {
                    if (await confirm({ title: "Excluir custo?", description: `${occ.cost.description} · ${fmtCurrency(occ.amount)}`, destructive: true, confirmText: "Excluir" }))
                      deleteTransactionMutation.mutate(occ.cost.id);
                  }}><Trash2 className="h-3.5 w-3.5" /></Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ))}

      {/* Tipo de custo */}
      <Dialog open={bucketModal} onOpenChange={setBucketModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>{bucketForm.id ? "Editar tipo de custo" : "Novo tipo de custo"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Nome</Label><Input value={bucketForm.name} onChange={(e) => setBucketForm({ ...bucketForm, name: e.target.value })} placeholder="Ex.: Custos de Software" /></div>
            <div>
              <Label>Natureza</Label>
              <Select value={bucketForm.kind} onValueChange={(v) => setBucketForm({ ...bucketForm, kind: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{KINDS.map((k) => <SelectItem key={k.value} value={k.value}>{k.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBucketModal(false)}>Cancelar</Button>
            <Button disabled={!bucketForm.name.trim()} onClick={() => { saveBucket.mutate({ ...bucketForm, sort_order: buckets.length }, { onSuccess: () => setBucketModal(false) }); }}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Custo */}
      <Dialog open={costModal} onOpenChange={setCostModal}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>{editing ? "Editar custo" : "Novo custo"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Descrição</Label><Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Valor</Label><Input type="number" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })} /></div>
              <div><Label>Dia do vencimento</Label><Input type="number" min={1} max={28} value={form.day} onChange={(e) => setForm({ ...form, day: Number(e.target.value) })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Tipo de custo</Label>
                <Select value={form.cost_bucket_id || "none"} onValueChange={(v) => setForm({ ...form, cost_bucket_id: v === "none" ? "" : v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sem tipo</SelectItem>
                    {buckets.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Categoria</Label><CategorySelect value={form.category} onChange={(v) => setForm({ ...form, category: v })} allCategories={allCategories} type="expense" /></div>
            </div>
            {selectedAccounts.length > 0 && (
              <div>
                <Label>Conta</Label>
                <Select value={form.finance_account_id || "none"} onValueChange={(v) => setForm({ ...form, finance_account_id: v === "none" ? "" : v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sem conta</SelectItem>
                    {selectedAccounts.map((a: any) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="flex items-center justify-between rounded-lg border border-border/50 p-3">
              <Label className="cursor-pointer">Custo recorrente (todo mês)</Label>
              <Switch checked={form.is_recurring} onCheckedChange={(v) => setForm({ ...form, is_recurring: v })} />
            </div>
            {form.is_recurring && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Frequência</Label>
                  <Select value={form.recurrence_interval} onValueChange={(v) => setForm({ ...form, recurrence_interval: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="monthly">Mensal</SelectItem>
                      <SelectItem value="yearly">Anual</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>Termina em (opcional)</Label><Input type="date" value={form.recurrence_end_date} onChange={(e) => setForm({ ...form, recurrence_end_date: e.target.value })} /></div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCostModal(false)}>Cancelar</Button>
            <Button disabled={!form.description.trim() || !form.amount} onClick={handleSaveCost}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default FinanceCosts;
