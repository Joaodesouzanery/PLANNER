import { useMemo, useRef, useState } from "react";
import { format } from "date-fns";
import { FileText, FileDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { DateRangeFilter } from "@/components/ems/DateRangeFilter";
import { exportTablePdf, captureChart, type PdfSection, type PdfImage } from "@/lib/exportPdf";
import { toast } from "@/hooks/use-toast";
import { useFinanceWorkspace } from "./useFinanceWorkspace";
import { useFinanceData, fmtCurrency } from "./useFinanceData";
import { useFinanceSettings } from "./useFinanceSettings";
import { usePatrimonio } from "./usePatrimonio";
import { computeCfo } from "./financeCfo";
import { computeDre } from "./financeDre";
import { targetFor, monthsTo, mrate } from "./retirement";
import { FinanceReportCharts, type ReportChartRefs } from "./FinanceReportCharts";

const brl = fmtCurrency;
const pct = (v: number) => `${Math.round((v || 0) * 100)}%`;
const todayIso = () => new Date().toISOString().slice(0, 10);
const startOfYear = () => `${new Date().getFullYear()}-01-01`;

const SECTIONS: { key: string; label: string }[] = [
  { key: "visao", label: "Visão geral (resumo + CFO)" },
  { key: "revexp", label: "Receita × Despesa (gráfico + mês a mês)" },
  { key: "categorias", label: "Categorias (receita / despesa)" },
  { key: "dre", label: "DRE do período" },
  { key: "futuro", label: "Futuro / Fluxo (12 meses)" },
  { key: "patrimonio", label: "Patrimônio" },
  { key: "aposentadoria", label: "Aposentadoria (FIRE)" },
  { key: "transacoes", label: "Transações do período" },
];

/** Relatório financeiro completo: você marca as seções (com gráficos) → 1 PDF, compondo os motores. */
export const FinanceFullReport = () => {
  const ws = useFinanceWorkspace();
  const fd = useFinanceData();
  const { settings } = useFinanceSettings();
  const pat = usePatrimonio();

  const [open, setOpen] = useState(false);
  const [from, setFrom] = useState(startOfYear());
  const [to, setTo] = useState(todayIso());
  const [sel, setSel] = useState<Record<string, boolean>>(() => Object.fromEntries(SECTIONS.map((s) => [s.key, true])));
  const [gen, setGen] = useState(false);

  const refs: ReportChartRefs = { revExp: useRef<HTMLDivElement>(null), capital: useRef<HTMLDivElement>(null), income: useRef<HTMLDivElement>(null), expense: useRef<HTMLDivElement>(null) };
  const toggle = (k: string) => setSel((s) => ({ ...s, [k]: !s[k] }));

  const cfo = useMemo(() => computeCfo(ws.canonical.rows, settings, ws.reserveBalance, todayIso(), ws.expectedMonthly), [ws.canonical.rows, settings, ws.reserveBalance, ws.expectedMonthly]);

  // Dados de gráfico/categoria ESCOPADOS ao período (o dashboard usa janela fixa; aqui respeita from/to).
  const period = useMemo(() => {
    const rows = ws.canonical.rows.filter((r) => (r.realized || r.paid) && r.date >= from && r.date <= to);
    const monthMap = new Map<string, { income: number; expense: number }>();
    const catInc = new Map<string, number>();
    const catExp = new Map<string, number>();
    for (const r of rows) {
      const k = r.date.slice(0, 7);
      const c = monthMap.get(k) ?? { income: 0, expense: 0 };
      c[r.type] += r.amount;
      monthMap.set(k, c);
      const cat = r.category || "Sem categoria";
      if (r.type === "income") catInc.set(cat, (catInc.get(cat) || 0) + r.amount);
      else catExp.set(cat, (catExp.get(cat) || 0) + r.amount);
    }
    const toCat = (m: Map<string, number>) => [...m.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
    const monthlyData = [...monthMap.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([month, v]) => ({ month, income: v.income, expense: v.expense, balance: v.income - v.expense }));
    return { monthlyData, incomeByCat: toCat(catInc), expenseByCat: toCat(catExp) };
  }, [ws.canonical.rows, from, to]);

  const gerar = async () => {
    if (!from || !to) { toast({ title: "Escolha o período" }); return; }
    if (!Object.values(sel).some(Boolean)) { toast({ title: "Marque ao menos uma seção" }); return; }
    setGen(true);
    try {
      const sections: PdfSection[] = [];
      const images: PdfImage[] = [];
      const t = ws.canonical.totals(from, to);

      if (sel.visao) {
        sections.push({ heading: "Visão geral", head: [["Indicador", "Valor"]], body: [
          ["Saldo disponível", brl(cfo.saldoDisponivel)],
          ["Entradas no período (realizadas)", brl(t.entradasRealizadas)],
          ["Saídas no período (realizadas)", brl(t.saidasRealizadas)],
          ["A receber / A pagar", `${brl(t.aReceber)} / ${brl(t.aPagar)}`],
          ["Sobra mensal (CFO)", brl(cfo.sobraMensal)],
          ["Runway", cfo.burnMensal > 0 ? `${cfo.runwayMeses.toFixed(1)} meses` : "—"],
          ["Reserva vs alvo", `${brl(cfo.reservaAtual)} / ${brl(cfo.reservaAlvo)} (${pct(cfo.reservaPct)})`],
          ["Imposto a recolher", brl(cfo.impostoARecolher)],
        ] });
      }
      if (sel.revexp) {
        const [imgR, imgC] = await Promise.all([captureChart(refs.revExp.current), captureChart(refs.capital.current)]);
        if (imgR) images.push({ heading: "Receita × Despesa", dataUrl: imgR, height: 62 });
        if (imgC) images.push({ heading: "Evolução do capital", dataUrl: imgC, height: 62 });
        sections.push({ heading: "Mês a mês (período)", head: [["Mês", "Entradas", "Saídas", "Saldo"]], body: period.monthlyData.length ? period.monthlyData.map((m) => [m.month, brl(m.income), brl(m.expense), brl(m.balance)]) : [["—", "—", "—", "—"]] });
      }
      if (sel.categorias) {
        const [imgI, imgE] = await Promise.all([captureChart(refs.income.current), captureChart(refs.expense.current)]);
        if (imgI) images.push({ heading: "Receita por categoria", dataUrl: imgI, width: 100, height: 62 });
        if (imgE) images.push({ heading: "Despesas por categoria", dataUrl: imgE, width: 100, height: 62 });
        sections.push({ heading: "Receita por categoria (período)", head: [["Categoria", "Valor"]], body: period.incomeByCat.length ? period.incomeByCat.map((c) => [c.name, brl(c.value)]) : [["—", "—"]] });
        sections.push({ heading: "Despesas por categoria (período)", head: [["Categoria", "Valor"]], body: period.expenseByCat.length ? period.expenseByCat.map((c) => [c.name, brl(c.value)]) : [["—", "—"]] });
      }
      if (sel.dre) {
        const d = computeDre(ws.canonical.rows, from, to, { taxRate: (settings as any).tax_rate });
        sections.push({ heading: "DRE do período", head: [["Linha", "Valor"]], body: [
          ["Receita bruta", brl(d.receitaBruta)],
          [`Deduções${d.deducoesEstimada ? " (estimada)" : ""}`, brl(d.deducoes)],
          ["Receita líquida", brl(d.receitaLiquida)],
          ["Custo", brl(d.custo)],
          ["Lucro bruto", `${brl(d.lucroBruto)} (${pct(d.margemBruta)})`],
          ["Despesa operacional", brl(d.despesaOperacional)],
          ["EBITDA", `${brl(d.ebitda)} (${pct(d.margemEbitda)})`],
          ["Resultado financeiro", brl(d.resultadoFinanceiro)],
          ["Lucro líquido", `${brl(d.lucroLiquido)} (${pct(d.margemLiquida)})`],
        ] });
      }
      if (sel.futuro) {
        sections.push({ heading: "Fluxo futuro (12 meses)", head: [["Mês", "Entradas", "Saídas", "Saldo"]], body: (ws.monthlyForecast as any[]).slice(0, 12).map((m) => [m.month || m.label || "—", brl(m.income ?? m.entradas ?? 0), brl(m.expense ?? m.saidas ?? 0), brl(m.balance ?? m.saldo ?? 0)]) });
        sections.push({ heading: "Contas a pagar (45 dias)", head: [["Data", "Descrição", "Valor"]], body: (ws.upcomingPayables as any[]).slice(0, 20).map((p) => [p.date || p.dueDate || "—", p.description || p.descricao || "—", brl(Number(p.amount ?? p.valor ?? 0))]) });
      }
      if (sel.patrimonio) {
        const caixa = ws.canonical.saldoRealHoje;
        const ativosManuais = pat.items.filter((i: any) => i.kind === "asset").reduce((a: number, i: any) => a + Number(i.value), 0);
        const passivosManuais = pat.items.filter((i: any) => i.kind === "liability").reduce((a: number, i: any) => a + Number(i.value), 0);
        sections.push({ heading: "Patrimônio (resumo)", head: [["Item", "Valor"]], body: [
          ["Caixa (disponível)", brl(caixa)],
          ["Reserva / investimentos (contas)", brl(ws.reserveBalance)],
          ["Ativos manuais", brl(ativosManuais)],
          ["Passivos manuais", brl(passivosManuais)],
          ["Patrimônio (caixa + ativos − passivos)", brl(caixa + ativosManuais - passivosManuais)],
        ] });
      }
      if (sel.aposentadoria) {
        const ativosManuais = pat.items.filter((i: any) => i.kind === "asset").reduce((a: number, i: any) => a + Number(i.value), 0);
        const P0 = ws.canonical.saldoRealHoje + ws.reserveBalance + ativosManuais;
        const Z = cfo.despesaMensal;
        const target = targetFor(Z, 4); // SWR 4%
        const r = mrate(4); // 4% real a.a.
        const meses = monthsTo(target, P0, cfo.sobraMensal, r);
        sections.push({ heading: "Aposentadoria (FIRE — 4% real, SWR 4%)", head: [["Indicador", "Valor"]], body: [
          ["Patrimônio de partida", brl(P0)],
          ["Aporte mensal (sobra)", brl(cfo.sobraMensal)],
          ["Gasto mensal a sustentar", brl(Z)],
          ["Meta (independência)", brl(target)],
          ["Tempo estimado", Number.isFinite(meses) ? `${Math.floor(meses / 12)}a ${meses % 12}m` : "além de 100 anos"],
        ] });
      }
      if (sel.transacoes) {
        const rows = ws.canonical.rows.filter((r) => r.date >= from && r.date <= to).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 300);
        sections.push({ heading: "Transações do período", head: [["Data", "Descrição", "Categoria", "Tipo", "Valor"]], body: rows.map((r) => [r.date, r.description || "—", r.category || "—", r.type === "income" ? "Entrada" : "Saída", brl(r.amount)]) });
      }

      await exportTablePdf({
        title: "Relatório financeiro completo",
        subtitle: `Período ${from} a ${to} · gerado em ${format(new Date(), "dd/MM/yyyy HH:mm")}`,
        filename: `financas-completo-${from}_${to}.pdf`,
        images,
        sections,
      });
      toast({ title: "Relatório gerado" });
    } catch (e: any) {
      toast({ title: "Falha ao gerar relatório", description: e?.message, variant: "destructive" });
    } finally {
      setGen(false);
    }
  };

  return (
    <>
      <Button variant="outline" className="gap-2" onClick={() => setOpen(true)}><FileText className="h-4 w-4" />Relatório completo</Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><FileText className="h-4 w-4 text-primary" />Relatório financeiro completo</DialogTitle></DialogHeader>
          <p className="text-xs text-muted-foreground">Marque tudo que quer no PDF. Finanças/DRE usam o período; CFO/Patrimônio/Aposentadoria são a foto atual.</p>
          <DateRangeFilter dateFrom={from} dateTo={to} onDateFromChange={setFrom} onDateToChange={setTo} />
          <div className="grid grid-cols-1 gap-1.5 max-h-[40vh] overflow-y-auto">
            {SECTIONS.map((s) => (
              <label key={s.key} className="flex items-center gap-2 rounded-md border border-border/50 px-2 py-1.5 text-sm cursor-pointer hover:bg-muted/40">
                <Checkbox checked={!!sel[s.key]} onCheckedChange={() => toggle(s.key)} />
                {s.label}
              </label>
            ))}
          </div>
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setSel(Object.fromEntries(SECTIONS.map((s) => [s.key, true])))}>Tudo</Button>
            <Button size="sm" className="gap-1.5" onClick={gerar} disabled={gen}><FileDown className="h-4 w-4" />{gen ? "Gerando..." : "Gerar PDF"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Gráficos renderizados offscreen (só quando o diálogo está aberto) p/ captura. */}
      {open && (
        <div style={{ position: "fixed", left: -10000, top: 0, width: 720, zIndex: -1 }} aria-hidden>
          <FinanceReportCharts monthlyData={period.monthlyData} capitalEvolution={fd.capitalEvolution} incomeByCat={period.incomeByCat} expenseByCat={period.expenseByCat} refs={refs} />
        </div>
      )}
    </>
  );
};

export default FinanceFullReport;
