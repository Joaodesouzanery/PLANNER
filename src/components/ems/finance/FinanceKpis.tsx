import { useMemo, type ReactNode } from "react";
import { endOfMonth, format, startOfMonth, subMonths } from "date-fns";
import { Gauge } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { fmtCurrency } from "./useFinanceData";
import { useFinanceWorkspace } from "./useFinanceWorkspace";
import { useFinanceSettings } from "./useFinanceSettings";
import { useClientes } from "./useClientes";
import { useDreCategories } from "./useDreCategories";
import { computeDre } from "./financeDre";
import { computeCfo } from "./financeCfo";
import { canonicalTotals } from "./financeCanonical";
import { activeIncomeContracts, mrrHeadline, mrrDeltas } from "./financeMrr";
import { buildClientRevenue } from "./financeClients";
import { computeKpis } from "./financeKpis";

const todayIso = () => format(new Date(), "yyyy-MM-dd");
const COMERCIAL_RE = /comercial|marketing|vendas|\bads\b|an[uú]ncio|tr[aá]fego|publicidade|m[ií]dia/i;

const fmtPct = (v: number | null) => (v == null ? "—" : `${(v * 100).toFixed(1)}%`);
const fmtNum = (v: number | null, suf: string) => (v == null ? "—" : `${v.toFixed(1)}${suf}`);

const Tile = ({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: string }) => (
  <div className="rounded-xl border border-border/50 bg-background/40 p-3">
    <p className="text-[11px] text-muted-foreground">{label}</p>
    <p className={cn("mt-1 font-mono text-base font-bold leading-tight", tone)}>{value}</p>
    {hint && <p className="text-[10px] text-muted-foreground mt-0.5 truncate">{hint}</p>}
  </div>
);

const Group = ({ title, children }: { title: string; children: ReactNode }) => (
  <div className="space-y-2">
    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{title}</p>
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">{children}</div>
  </div>
);

export const FinanceKpis = () => {
  const workspace = useFinanceWorkspace();
  const { settings } = useFinanceSettings();
  const { clientes } = useClientes();
  const { overrides } = useDreCategories();

  const k = useMemo(() => {
    const now = new Date();
    const from = format(startOfMonth(now), "yyyy-MM-dd");
    const to = format(endOfMonth(now), "yyyy-MM-dd");
    const curKey = format(now, "yyyy-MM");
    const prevKey = format(subMonths(now, 1), "yyyy-MM");
    const rows = workspace.canonical.rows;
    const txns = workspace.rawTransactions as any[];

    const dre = computeDre(rows, from, to, { taxRate: settings.tax_rate, overrides });
    const cfo = computeCfo(rows, settings, workspace.reserveBalance, todayIso(), workspace.expectedMonthly);
    const tot = canonicalTotals(rows, from, to);

    const cur = activeIncomeContracts(txns, curKey);
    const prev = activeIncomeContracts(txns, prevKey);
    const mrr = mrrHeadline(cur);
    const mrrPrev = mrrHeadline(prev);
    // Deltas na MESMA base do headline (recorrentes sem prazo) — senão contrato a prazo que acaba
    // vira churn absurdo e quebra NRR/LTV.
    const deltas = mrrDeltas(prev.filter((c) => c.ongoing), cur.filter((c) => c.ongoing));

    const { clients } = buildClientRevenue(txns, clientes);
    const nClientesRecorrentes = clients.filter((c) => c.ongoing > 0).length;

    const novosClientesMes = new Set(txns.filter((t) => t.type === "income" && t.is_recurring && (t.date || "").slice(0, 7) === curKey && t.cliente_id).map((t) => t.cliente_id)).size;
    const custoComercialMes = rows.reduce((a, r) => (r.type === "expense" && r.paid && r.date.slice(0, 7) === curKey && COMERCIAL_RE.test(r.category || "") ? a + r.amount : a), 0);
    const nEntradasMes = rows.filter((r) => r.type === "income" && r.paid && r.date.slice(0, 7) === curKey).length;

    const custosFixos = (workspace.expectedMonthly.fixo || 0) + dre.despesaOperacional;
    const margemContribuicaoPct = dre.receitaBruta > 0 ? 1 - (dre.custo + dre.deducoes) / dre.receitaBruta : 0;

    return computeKpis({
      receitaBruta: dre.receitaBruta, receitaLiquida: dre.receitaLiquida,
      margemBruta: dre.margemBruta, margemEbitda: dre.margemEbitda, margemLiquida: dre.margemLiquida,
      custosFixos, margemContribuicaoPct,
      // Exclui o mês corrente (parcial, só realizado até hoje) — senão MoM/YoY leem negativo à toa.
      monthlyIncome: (workspace.monthlyData as any[]).slice(0, -1).map((m) => m.income),
      mrr, mrrPrev, expansao: deltas.expansao, churn: deltas.churn, nClientesRecorrentes,
      novosClientesMes, custoComercialMes,
      receitaRecebidaMes: tot.entradasRealizadas, nEntradasMes,
      aReceber: tot.aReceber, aReceberVencido: cfo.aReceberVencido,
      saldoDisponivel: cfo.saldoDisponivel, despesaMensal: cfo.despesaMensal, runwayMeses: cfo.runwayMeses,
    });
  }, [workspace.canonical.rows, workspace.rawTransactions, workspace.expectedMonthly, workspace.reserveBalance, workspace.monthlyData, settings, clientes, overrides]);

  const growthTone = (v: number | null) => (v == null ? "" : v > 0 ? "text-emerald-400" : "text-destructive");
  const ltvCacTone = k.ltvCac == null ? "" : k.ltvCac >= 3 ? "text-emerald-400" : k.ltvCac >= 1 ? "text-amber-400" : "text-destructive";

  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><Gauge className="h-4 w-4 text-primary" />KPIs financeiros</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <Group title="Rentabilidade">
          <Tile label="Margem bruta" value={fmtPct(k.margemBruta)} />
          <Tile label="Margem EBITDA" value={fmtPct(k.margemEbitda)} hint="benchmark saudável ≥ 15%" tone={k.margemEbitda >= 0.15 ? "text-emerald-400" : "text-amber-400"} />
          <Tile label="Margem líquida" value={fmtPct(k.margemLiquida)} />
          <Tile label="Ponto de equilíbrio" value={k.pontoEquilibrio == null ? "—" : `${fmtCurrency(k.pontoEquilibrio)}/mês`} hint="faturamento mínimo" />
        </Group>
        <Group title="Crescimento & recorrência">
          <Tile label="Crescimento MoM" value={fmtPct(k.crescimentoMoM)} tone={growthTone(k.crescimentoMoM)} />
          <Tile label="Crescimento YoY" value={fmtPct(k.crescimentoYoY)} tone={growthTone(k.crescimentoYoY)} />
          <Tile label="MRR" value={fmtCurrency(k.mrr)} hint={`ARR ${fmtCurrency(k.arr)}`} />
          <Tile label="NRR" value={fmtPct(k.nrr)} hint="net revenue retention · ideal ≥ 100%" tone={k.nrr != null && k.nrr >= 1 ? "text-emerald-400" : "text-amber-400"} />
          <Tile label="Churn (MRR)" value={fmtPct(k.churnRate)} tone={k.churnRate != null && k.churnRate > 0.05 ? "text-destructive" : ""} />
        </Group>
        <Group title="SaaS / assinatura / consultoria">
          <Tile label="ARPU" value={k.arpu == null ? "—" : `${fmtCurrency(k.arpu)}/cliente`} />
          <Tile label="Ticket médio" value={k.ticketMedio == null ? "—" : fmtCurrency(k.ticketMedio)} />
          <Tile label="LTV" value={k.ltv == null ? "—" : fmtCurrency(k.ltv)} hint={k.ltv == null ? "precisa de churn > 0" : undefined} />
          <Tile label="CAC" value={k.cac == null ? "—" : fmtCurrency(k.cac)} hint={k.cac == null ? "marque categoria comercial + novos clientes" : undefined} />
          <Tile label="LTV / CAC" value={fmtNum(k.ltvCac, "x")} hint="ideal ≥ 3x" tone={ltvCacTone} />
          <Tile label="Payback CAC" value={k.paybackCacMeses == null ? "—" : `${k.paybackCacMeses.toFixed(1)} m`} />
        </Group>
        <Group title="Recebimento, liquidez & fôlego">
          <Tile label="DSO (prazo recebimento)" value={k.dso == null ? "—" : `${Math.round(k.dso)} dias`} />
          <Tile label="Inadimplência" value={fmtPct(k.inadimplencia)} tone={k.inadimplencia != null && k.inadimplencia > 0.1 ? "text-destructive" : ""} />
          <Tile label="Cobertura de caixa" value={fmtNum(k.coberturaMeses, " m")} hint="saldo ÷ despesa" />
          <Tile label="Runway" value={`${k.runwayMeses.toFixed(1)} m`} tone={k.runwayMeses < 3 ? "text-destructive" : k.runwayMeses < 6 ? "text-amber-400" : "text-emerald-400"} />
        </Group>
      </CardContent>
    </Card>
  );
};

export default FinanceKpis;
