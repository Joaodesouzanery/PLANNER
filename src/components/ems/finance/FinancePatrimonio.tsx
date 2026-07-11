import { useMemo, useState } from "react";
import { differenceInCalendarMonths, format } from "date-fns";
import { Building2, Coins, Landmark, PiggyBank, Plus, Target, Trash2, TrendingUp, Wallet } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useConfirm } from "@/hooks/useConfirm";
import { fmtCurrency } from "./useFinanceData";
import { useFinanceWorkspace } from "./useFinanceWorkspace";
import { useFinanceSettings } from "./useFinanceSettings";
import { computeCfo, fvAportes } from "./financeCfo";
import { usePatrimonio, type NetworthItem, type SinkingFund } from "./usePatrimonio";

const todayIso = () => format(new Date(), "yyyy-MM-dd");
const CAT_ASSET = [["caixa", "Caixa"], ["investimento", "Investimento"], ["bem", "Bem"], ["outro", "Outro"]];
const CAT_LIAB = [["divida", "Dívida"], ["outro", "Outro"]];

export const FinancePatrimonio = () => {
  const workspace = useFinanceWorkspace();
  const { settings, missing: settingsMissing } = useFinanceSettings();
  const { items, funds, missing, saveItem, deleteItem, saveFund, deleteFund } = usePatrimonio();
  const confirm = useConfirm();

  const cfo = useMemo(() => computeCfo(workspace.canonical.rows, settings, workspace.reserveBalance, todayIso()), [workspace.canonical.rows, settings, workspace.reserveBalance]);
  const caixa = workspace.canonical.saldoRealHoje;
  // Passivo automático: parcelas ainda não pagas (Macbook etc.).
  const parcelasRestantes = useMemo(() => workspace.canonical.rows.filter((r) => r.sourceType === "installment" && !r.paid).reduce((a, r) => a + r.amount, 0), [workspace.canonical.rows]);

  const ativosManuais = items.filter((i) => i.kind === "asset").reduce((a, i) => a + Number(i.value), 0);
  const passivosManuais = items.filter((i) => i.kind === "liability").reduce((a, i) => a + Number(i.value), 0);
  const ativos = caixa + ativosManuais;
  const passivos = parcelasRestantes + passivosManuais;
  const patrimonioLiquido = ativos - passivos;

  const [itemForm, setItemForm] = useState<{ kind: "asset" | "liability"; label: string; category: string; value: string }>({ kind: "asset", label: "", category: "investimento", value: "" });
  const [fundForm, setFundForm] = useState<{ title: string; target: string; due_date: string; balance: string }>({ title: "", target: "", due_date: "", balance: "" });

  const addItem = () => {
    if (!itemForm.label.trim() || !itemForm.value) return;
    saveItem.mutate({ kind: itemForm.kind, label: itemForm.label.trim(), category: itemForm.category, value: Number(itemForm.value) }, { onSuccess: () => setItemForm({ ...itemForm, label: "", value: "" }) });
  };
  const addFund = () => {
    if (!fundForm.title.trim() || !fundForm.target) return;
    const months = fundForm.due_date ? Math.max(1, differenceInCalendarMonths(new Date(fundForm.due_date), new Date())) : 12;
    const monthly = Math.max(0, (Number(fundForm.target) - Number(fundForm.balance || 0)) / months);
    saveFund.mutate({ title: fundForm.title.trim(), target: Number(fundForm.target), due_date: fundForm.due_date || null, balance: Number(fundForm.balance || 0), monthly }, { onSuccess: () => setFundForm({ title: "", target: "", due_date: "", balance: "" }) });
  };
  const del = async (kind: "item" | "fund", id: string) => {
    if (await confirm({ title: "Excluir?", destructive: true, confirmText: "Excluir" })) (kind === "item" ? deleteItem : deleteFund).mutate(id);
  };

  // Sequenciador da sobra: 1º imposto (automático), 2º reserva, 3º sinking funds, 4º investimento.
  const sinkingMensal = funds.reduce((a, f) => a + Number(f.monthly || 0), 0);
  const reservaFalta = Math.max(0, cfo.reservaAlvo - cfo.reservaAtual);
  const sobra = cfo.sobraMensal;
  const paraReserva = reservaFalta > 0 ? Math.min(sobra, reservaFalta) : 0;
  const paraSinking = Math.min(Math.max(0, sobra - paraReserva), sinkingMensal);
  const paraInvestir = Math.max(0, sobra - paraReserva - paraSinking);
  const projInvest10 = fvAportes(paraInvestir, 120, settings.cdi_monthly_liquid);

  return (
    <div className="space-y-5">
      {missing && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 text-sm text-amber-400">
          Aplique a migration <code>20260712130000_finance_patrimonio.sql</code> na Lovable para salvar patrimônio e sinking funds. (O patrimônio líquido já usa seu caixa e parcelas automaticamente.)
        </div>
      )}

      {/* Patrimônio líquido */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><Landmark className="h-4 w-4 text-primary" />Patrimônio líquido</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3"><p className="text-xs text-muted-foreground">Ativos</p><p className="font-mono text-xl font-bold text-emerald-400">{fmtCurrency(ativos)}</p><p className="text-[10px] text-muted-foreground">caixa {fmtCurrency(caixa)} + itens {fmtCurrency(ativosManuais)}</p></div>
            <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-3"><p className="text-xs text-muted-foreground">Passivos</p><p className="font-mono text-xl font-bold text-destructive">{fmtCurrency(passivos)}</p><p className="text-[10px] text-muted-foreground">parcelas {fmtCurrency(parcelasRestantes)} + dívidas {fmtCurrency(passivosManuais)}</p></div>
            <div className="rounded-xl border border-primary/30 bg-primary/5 p-3"><p className="text-xs text-muted-foreground">Patrimônio líquido</p><p className={cn("font-mono text-xl font-bold", patrimonioLiquido >= 0 ? "text-primary" : "text-destructive")}>{fmtCurrency(patrimonioLiquido)}</p><p className="text-[10px] text-muted-foreground">ativos − passivos</p></div>
          </div>

          <div className="space-y-1.5">
            {items.map((i) => (
              <div key={i.id} className="flex items-center gap-2 rounded-lg border border-border/50 p-2 text-sm">
                {i.kind === "asset" ? (i.category === "caixa" ? <Wallet className="h-4 w-4 text-emerald-400" /> : i.category === "investimento" ? <TrendingUp className="h-4 w-4 text-emerald-400" /> : <Building2 className="h-4 w-4 text-emerald-400" />) : <Coins className="h-4 w-4 text-destructive" />}
                <span className="flex-1 truncate">{i.label} <span className="text-xs text-muted-foreground">· {i.category}</span></span>
                <span className={cn("font-mono font-semibold", i.kind === "asset" ? "text-emerald-400" : "text-destructive")}>{i.kind === "asset" ? "+" : "−"}{fmtCurrency(Number(i.value))}</span>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => del("item", i.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap items-end gap-2 rounded-xl border border-dashed border-border/50 p-3">
            <div><Label className="text-xs">Tipo</Label><Select value={itemForm.kind} onValueChange={(v) => setItemForm({ ...itemForm, kind: v as "asset" | "liability", category: v === "asset" ? "investimento" : "divida" })}><SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="asset">Ativo</SelectItem><SelectItem value="liability">Passivo</SelectItem></SelectContent></Select></div>
            <div><Label className="text-xs">Categoria</Label><Select value={itemForm.category} onValueChange={(v) => setItemForm({ ...itemForm, category: v })}><SelectTrigger className="w-[130px]"><SelectValue /></SelectTrigger><SelectContent>{(itemForm.kind === "asset" ? CAT_ASSET : CAT_LIAB).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent></Select></div>
            <div className="flex-1 min-w-[140px]"><Label className="text-xs">Descrição</Label><Input value={itemForm.label} onChange={(e) => setItemForm({ ...itemForm, label: e.target.value })} placeholder="Ex.: CDB Nubank / Apto / Financiamento" /></div>
            <div><Label className="text-xs">Valor</Label><Input type="number" className="w-[130px]" value={itemForm.value} onChange={(e) => setItemForm({ ...itemForm, value: e.target.value })} /></div>
            <Button variant="outline" onClick={addItem} disabled={!itemForm.label.trim() || !itemForm.value}><Plus className="h-4 w-4 mr-1" />Adicionar</Button>
          </div>
        </CardContent>
      </Card>

      {/* Sequenciador da sobra */}
      <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
        <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><Target className="h-4 w-4 text-primary" />Para onde vai a sobra ({fmtCurrency(sobra)}/mês)</CardTitle></CardHeader>
        <CardContent>
          {sobra <= 0 ? (
            <p className="text-sm text-muted-foreground">Sem sobra positiva na média dos últimos 3 meses.</p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-4">
              <div className="rounded-lg border border-border/50 p-3"><p className="text-[11px] text-muted-foreground">1º Imposto (automático)</p><p className="font-mono font-bold text-amber-400">{fmtCurrency(cfo.impostoMensal)}</p><p className="text-[10px] text-muted-foreground">{settings.tax_rate}% do faturamento</p></div>
              <div className="rounded-lg border border-border/50 p-3"><p className="text-[11px] text-muted-foreground">2º Reserva</p><p className="font-mono font-bold text-emerald-400">{fmtCurrency(paraReserva)}</p><p className="text-[10px] text-muted-foreground">{reservaFalta > 0 ? `faltam ${fmtCurrency(reservaFalta)}` : "alvo atingido"}</p></div>
              <div className="rounded-lg border border-border/50 p-3"><p className="text-[11px] text-muted-foreground">3º Sinking funds</p><p className="font-mono font-bold text-sky-400">{fmtCurrency(paraSinking)}</p><p className="text-[10px] text-muted-foreground">{funds.length} metas</p></div>
              <div className="rounded-lg border border-border/50 p-3"><p className="text-[11px] text-muted-foreground">4º Investir</p><p className="font-mono font-bold text-primary">{fmtCurrency(paraInvestir)}</p><p className="text-[10px] text-muted-foreground">~{fmtCurrency(projInvest10)} em 10a (CDI)</p></div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Sinking funds */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><PiggyBank className="h-4 w-4 text-primary" />Sinking funds (provisões)</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {funds.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma provisão. Ex.: IPVA, seguro anual, viagem — separe 1/12 por mês em vez de tomar o susto.</p>}
          {funds.map((f) => {
            const pct = f.target > 0 ? Math.min(100, (Number(f.balance) / Number(f.target)) * 100) : 0;
            return (
              <div key={f.id} className="rounded-lg border border-border/50 p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-sm">{f.title}</span>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm">{fmtCurrency(Number(f.balance))} / {fmtCurrency(Number(f.target))}</span>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => del("fund", f.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                  </div>
                </div>
                <Progress value={pct} className="h-1.5 mt-1.5" />
                <p className="text-[11px] text-muted-foreground mt-1">Aporte sugerido {fmtCurrency(Number(f.monthly))}/mês{f.due_date ? ` · até ${format(new Date(`${f.due_date}T12:00:00`), "MM/yyyy")}` : ""}</p>
              </div>
            );
          })}
          <div className="flex flex-wrap items-end gap-2 rounded-xl border border-dashed border-border/50 p-3">
            <div className="flex-1 min-w-[140px]"><Label className="text-xs">Meta</Label><Input value={fundForm.title} onChange={(e) => setFundForm({ ...fundForm, title: e.target.value })} placeholder="Ex.: IPVA 2027" /></div>
            <div><Label className="text-xs">Alvo</Label><Input type="number" className="w-[120px]" value={fundForm.target} onChange={(e) => setFundForm({ ...fundForm, target: e.target.value })} /></div>
            <div><Label className="text-xs">Já tenho</Label><Input type="number" className="w-[110px]" value={fundForm.balance} onChange={(e) => setFundForm({ ...fundForm, balance: e.target.value })} /></div>
            <div><Label className="text-xs">Até</Label><Input type="date" className="w-[150px]" value={fundForm.due_date} onChange={(e) => setFundForm({ ...fundForm, due_date: e.target.value })} /></div>
            <Button variant="outline" onClick={addFund} disabled={!fundForm.title.trim() || !fundForm.target}><Plus className="h-4 w-4 mr-1" />Criar</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default FinancePatrimonio;
