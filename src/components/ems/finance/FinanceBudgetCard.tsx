import { useMemo, useState } from "react";
import { format, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Wallet, Copy, Sparkles } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useConfirm } from "@/hooks/useConfirm";
import { fmtCurrency } from "./useFinanceData";
import { useFinanceWorkspace } from "./useFinanceWorkspace";
import { useCategoryBudgets } from "./useCategoryBudgets";
import { buildBudgetLines, budgetTotals, suggestTetos, type SpendSample } from "./financeBudget";
import { canonicalCategory } from "./financeCategories";

export const FinanceBudgetCard = () => {
  const workspace = useFinanceWorkspace();
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const curKey = format(now, "yyyy-MM");
  const { budgets, missing, setTeto, copyPrevMonth, applyTetos } = useCategoryBudgets(year, month);
  const confirm = useConfirm();
  const [newCat, setNewCat] = useState("");
  const [newTeto, setNewTeto] = useState("");

  // Sugere tetos a partir da média das saídas pagas dos 3 meses cheios anteriores (categoria canonizada).
  const suggestFromHistory = async () => {
    const meses = [1, 2, 3].map((k) => format(subMonths(now, k), "yyyy-MM"));
    const samples: SpendSample[] = [];
    for (const r of workspace.canonical.rows) {
      if (r.type !== "expense" || !r.paid) continue;
      const mk = r.date.slice(0, 7);
      if (!meses.includes(mk)) continue;
      samples.push({ category: canonicalCategory(r.category) || "Sem categoria", amount: r.amount, month: mk });
    }
    const sugeridos = suggestTetos(samples, meses);
    if (!sugeridos.length) { await confirm({ title: "Sem histórico", description: "Não há saídas pagas nos últimos 3 meses para estimar tetos.", confirmText: "Ok" }); return; }
    const ok = await confirm({
      title: `Sugerir ${sugeridos.length} tetos?`,
      description: `A partir da média dos últimos 3 meses (com corte leve p/ sobrar mais). Isso sobrescreve os tetos atuais das categorias com histórico. Ex.: ${sugeridos.slice(0, 3).map((s) => `${s.category} ${fmtCurrency(s.teto)}`).join(" · ")}.`,
      confirmText: "Aplicar",
    });
    if (ok) applyTetos.mutate(sugeridos);
  };

  const realizadoPorCat = useMemo(() => {
    const acc: Record<string, number> = {};
    for (const r of workspace.canonical.rows) {
      if (r.type !== "expense" || !r.paid || r.date.slice(0, 7) !== curKey) continue;
      const c = canonicalCategory(r.category) || "Sem categoria";
      acc[c] = (acc[c] || 0) + r.amount;
    }
    return acc;
  }, [workspace.canonical.rows, curKey]);

  const lines = useMemo(
    () => buildBudgetLines(budgets.map((b) => ({ category: b.category, teto: Number(b.teto) })), realizadoPorCat),
    [budgets, realizadoPorCat],
  );
  const totals = budgetTotals(lines);

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-base flex items-center gap-2"><Wallet className="h-4 w-4 text-primary" />Orçamento de {format(now, "MMM/yy", { locale: ptBR })}</CardTitle>
          <div className="flex items-center gap-2">
            {totals.tetoTotal > 0 && <span className="font-mono text-xs text-muted-foreground">{fmtCurrency(totals.realizadoOrcado)} / {fmtCurrency(totals.tetoTotal)}</span>}
            <Button variant="ghost" size="sm" className="h-7 gap-1 px-2 text-xs" onClick={suggestFromHistory} disabled={missing || applyTetos.isPending}><Sparkles className="h-3.5 w-3.5" />Sugerir do histórico</Button>
            <Button variant="ghost" size="sm" className="h-7 gap-1 px-2 text-xs" onClick={() => copyPrevMonth.mutate()} disabled={missing || copyPrevMonth.isPending}><Copy className="h-3.5 w-3.5" />Copiar mês anterior</Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {missing && <p className="text-[11px] text-amber-400">Aplique a migration <code>20260712160000_finance_category_budgets.sql</code> na Lovable para salvar tetos.</p>}
        {lines.length === 0 && <p className="text-sm text-muted-foreground">Defina um teto por categoria abaixo — aí o card mostra quanto sobrou/estourou no mês.</p>}

        {lines.map((l) => (
          <div key={l.category} className="flex items-center gap-2 text-sm">
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <span className="truncate flex items-center gap-1.5">{l.category}{!l.orcada && <Badge variant="outline" className="text-[9px] border-border/50 text-muted-foreground">não orçada</Badge>}</span>
                <span className={cn("font-mono text-xs shrink-0", l.estourou ? "text-destructive" : "text-muted-foreground")}>
                  {fmtCurrency(l.realizado)}{l.orcada && <> / {fmtCurrency(l.teto)} · {Math.round(l.usoPct * 100)}%</>}
                </span>
              </div>
              {l.orcada && (
                <div className="h-1.5 rounded bg-muted/40 mt-1 overflow-hidden">
                  <div className={cn("h-full rounded", l.estourou ? "bg-destructive" : l.usoPct > 0.8 ? "bg-amber-500" : "bg-emerald-500")} style={{ width: `${Math.min(100, l.usoPct * 100)}%` }} />
                </div>
              )}
            </div>
            <Input
              type="number"
              defaultValue={l.teto || ""}
              key={`${l.category}-${l.teto}`}
              onBlur={(e) => { const v = Number(e.target.value) || 0; if (v !== l.teto) setTeto.mutate({ category: l.category, teto: v }); }}
              placeholder="teto"
              className="w-24 h-8 text-xs shrink-0"
              disabled={missing}
            />
            {l.orcada && <span className={cn("w-20 text-right font-mono text-xs shrink-0", l.saldo < 0 ? "text-destructive" : "text-emerald-400")}>{l.saldo < 0 ? "" : "+"}{fmtCurrency(l.saldo)}</span>}
          </div>
        ))}

        <div className="flex items-end gap-2 pt-2 border-t border-border/40">
          <Input value={newCat} onChange={(e) => setNewCat(e.target.value)} placeholder="Nova categoria orçada" className="flex-1 h-8 text-xs" />
          <Input type="number" value={newTeto} onChange={(e) => setNewTeto(e.target.value)} placeholder="teto R$" className="w-24 h-8 text-xs" />
          <Button variant="outline" size="sm" className="h-8 text-xs" disabled={missing || !newCat.trim() || !newTeto} onClick={() => setTeto.mutate({ category: newCat.trim(), teto: Number(newTeto) }, { onSuccess: () => { setNewCat(""); setNewTeto(""); } })}>Orçar</Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default FinanceBudgetCard;
