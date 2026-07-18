import { useMemo, useState } from "react";
import { addMonths, format, startOfMonth } from "date-fns";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ShoppingCart, TrendingDown, CheckCircle2, Wallet } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { fmtCurrency } from "./useFinanceData";
import { useFinanceWorkspace } from "./useFinanceWorkspace";
import { useFinanceSettings } from "./useFinanceSettings";
import { useCategoryBudgets } from "./useCategoryBudgets";
import { computeCfo } from "./financeCfo";
import { buildBudgetLines } from "./financeBudget";
import { purchaseRows, purchaseImpact, type PurchasePlan } from "./financePurchase";

const db = supabase as any;
const todayIso = () => format(new Date(), "yyyy-MM-dd");

export const FinancePurchasePlanner = () => {
  const workspace = useFinanceWorkspace();
  const { settings } = useFinanceSettings();
  const qc = useQueryClient();
  const today = todayIso();
  const nextMonth1 = format(startOfMonth(addMonths(new Date(), 1)), "yyyy-MM-dd");

  const [form, setForm] = useState({ description: "", total: "", category: "", accountId: "", dueDate: nextMonth1, installments: "1", juros: "0" });

  const cfo = useMemo(() => computeCfo(workspace.canonical.rows, settings, workspace.reserveBalance, today, workspace.expectedMonthly), [workspace.canonical.rows, settings, workspace.reserveBalance, workspace.expectedMonthly, today]);

  const plan: PurchasePlan = {
    description: form.description.trim() || "Compra",
    total: Number(form.total) || 0,
    category: form.category || null,
    accountId: form.accountId || null,
    dueDate: form.dueDate,
    installments: Number(form.installments) || 1,
    interestMonthly: Number(form.juros) || 0,
  };
  const candidatas = useMemo(() => (plan.total > 0 ? purchaseRows(plan) : []), [form]);
  const impact = useMemo(() => purchaseImpact(workspace.canonical.rows, candidatas, today), [workspace.canonical.rows, candidatas, today]);

  const acctBal = form.accountId ? (workspace.accountBalances?.[form.accountId] ?? 0) : null;

  // Orçamento da categoria no mês-alvo (realizado pago + planejado, incluindo esta compra).
  const [ty, tm] = form.dueDate.split("-").map(Number);
  const { budgets } = useCategoryBudgets(ty, tm);
  const budgetLine = useMemo(() => {
    if (!form.category) return null;
    const monthKey = form.dueDate.slice(0, 7);
    const realizado: Record<string, number> = {};
    const planejado: Record<string, number> = {};
    for (const r of workspace.canonical.rows) {
      if (r.type !== "expense" || r.date.slice(0, 7) !== monthKey || !r.category) continue;
      if (r.paid) realizado[r.category] = (realizado[r.category] || 0) + r.amount;
      else planejado[r.category] = (planejado[r.category] || 0) + r.amount;
    }
    for (const c of candidatas) if (c.category && c.date.slice(0, 7) === monthKey) planejado[c.category] = (planejado[c.category] || 0) + c.amount;
    const lines = buildBudgetLines(budgets.map((b) => ({ category: b.category, teto: Number(b.teto) })), realizado, planejado);
    return lines.find((l) => l.category === form.category) ?? null;
  }, [form.category, form.dueDate, workspace.canonical.rows, candidatas, budgets]);

  const verdict = impact.floorAfter < 0
    ? { cls: "border-destructive/40 bg-destructive/10 text-destructive", label: "Não cabe — o caixa fica negativo" }
    : impact.floorAfter < cfo.reservaAlvo
      ? { cls: "border-warning/40 bg-warning/10 text-warning", label: "Cabe, mas come a reserva" }
      : { cls: "border-success/40 bg-success/10 text-success", label: "Cabe com folga" };

  const addToFlow = useMutation({
    mutationFn: async () => {
      const sourceId = crypto.randomUUID();
      const rows = purchaseRows(plan, sourceId).map((r) => ({
        description: r.description, amount: r.amount, type: "expense", category: r.category,
        date: r.date, due_date: r.date, status: "planned", finance_account_id: form.accountId || null,
        source_type: "purchase", source_id: sourceId,
      }));
      const { error } = await db.from("financial_transactions").insert(rows);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["finance-transactions"] });
      toast.success("Compra adicionada ao fluxo", { description: "Já aparece em Transações, Fluxo Futuro e no menor saldo." });
    },
    onError: (e: any) => toast.error("Falha ao adicionar", { description: e?.message }),
  });

  const n = Number(form.installments) || 1;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2"><ShoppingCart className="h-4 w-4 text-primary" />Compra futura — quanto impacta e de onde sai</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2"><Label className="text-xs">O que vou comprar</Label><Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Ex.: Notebook novo" /></div>
          <div><Label className="text-xs">Valor total (R$)</Label><Input type="number" value={form.total} onChange={(e) => setForm({ ...form, total: e.target.value })} placeholder="6000" /></div>
          <div><Label className="text-xs">Quando (mês)</Label><Input type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} /></div>
          <div>
            <Label className="text-xs">Categoria</Label>
            <Select value={form.category || "none"} onValueChange={(v) => setForm({ ...form, category: v === "none" ? "" : v })}>
              <SelectTrigger><SelectValue placeholder="Sem categoria" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sem categoria</SelectItem>
                {(workspace.allCategories as string[]).map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">De onde sai (conta)</Label>
            <Select value={form.accountId || "none"} onValueChange={(v) => setForm({ ...form, accountId: v === "none" ? "" : v })}>
              <SelectTrigger><SelectValue placeholder="Conta" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Não especificar</SelectItem>
                {workspace.selectedAccounts.map((a: any) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div><Label className="text-xs">Parcelas</Label><Input type="number" min={1} value={form.installments} onChange={(e) => setForm({ ...form, installments: e.target.value })} /></div>
          {n > 1 && <div><Label className="text-xs">Juros % a.m.</Label><Input type="number" step="0.1" value={form.juros} onChange={(e) => setForm({ ...form, juros: e.target.value })} placeholder="0" /></div>}
        </div>

        {plan.total > 0 && (
          <div className={cn("rounded-xl border p-3 space-y-2", verdict.cls)}>
            <p className="flex items-center gap-2 text-sm font-semibold"><TrendingDown className="h-4 w-4" />{verdict.label}</p>
            <div className="grid grid-cols-2 gap-3 font-mono text-xs sm:grid-cols-4">
              <div><p className="text-[10px] text-muted-foreground">Piso 90d antes</p><p className="font-bold">{fmtCurrency(impact.floorBefore)}</p></div>
              <div><p className="text-[10px] text-muted-foreground">Piso 90d depois</p><p className={cn("font-bold", verdict.cls.split(" ").pop())}>{fmtCurrency(impact.floorAfter)}</p><p className="text-[9px] text-muted-foreground">em {impact.diaAfter}</p></div>
              <div><p className="text-[10px] text-muted-foreground">Impacto no piso</p><p className="font-bold">{fmtCurrency(impact.delta)}</p></div>
              <div><p className="text-[10px] text-muted-foreground">{n > 1 ? `${n}× de` : "Total"}</p><p className="font-bold">{fmtCurrency(n > 1 ? impact.totalPago / n : impact.totalPago)}</p></div>
            </div>
            {acctBal != null && (
              <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground"><Wallet className="h-3.5 w-3.5" />Conta de origem: {fmtCurrency(acctBal)} → {fmtCurrency(acctBal - (n > 1 ? impact.totalPago / n : impact.totalPago))} após {n > 1 ? "a 1ª parcela" : "a compra"}</p>
            )}
            {budgetLine && budgetLine.orcada && (
              <p className="text-[11px] text-muted-foreground">Orçamento {form.category} no mês: {fmtCurrency(budgetLine.comprometido)} / {fmtCurrency(budgetLine.teto)} ({Math.round(budgetLine.comprometidoPct * 100)}% com esta compra){budgetLine.comprometido > budgetLine.teto ? <span className="text-destructive"> · estoura o teto</span> : null}</p>
            )}
            <div className="pt-1">
              <Button size="sm" disabled={addToFlow.isPending} onClick={() => addToFlow.mutate()}><CheckCircle2 className="h-3.5 w-3.5 mr-1" />Adicionar ao fluxo</Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default FinancePurchasePlanner;
