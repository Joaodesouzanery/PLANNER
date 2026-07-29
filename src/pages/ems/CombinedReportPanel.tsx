import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { FileText, Layers } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DateRangeFilter } from "@/components/ems/DateRangeFilter";
import { exportTablePdf } from "@/lib/exportPdf";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { useFinanceWorkspace } from "@/components/ems/finance/useFinanceWorkspace";
import { computeDre } from "@/components/ems/finance/financeDre";
import { useBoardHealth } from "@/hooks/useBoardHealth";
import { useCrm } from "@/components/ems/crm/useCrm";
import { useCrmStages } from "@/components/ems/crm/useCrmStages";
import { computeKanbanMetrics, type StageEvent, type DealLite } from "@/components/ems/crm/kanbanMetrics";

const db = supabase as any;
const safe = async (build: () => any): Promise<any[]> => {
  try { const { data, error } = await build(); if (error) return []; return data ?? []; } catch { return []; }
};
const brl = (v: number) => (Number(v) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const pct = (v: number | null) => (v == null ? "—" : `${Math.round(v * 100)}%`);
const dnum = (v: number | null) => (v == null ? "—" : `${v.toFixed(1)}d`);

/** Relatório combinado: Finanças (DRE do período) + Conselho (saúde) + CRM (funil), num PDF só. */
export const CombinedReportPanel = () => {
  const { selectedCompanyId } = useCompany();
  const scoped = selectedCompanyId && selectedCompanyId !== "all";
  const co = (q: any) => (scoped ? q.eq("company_id", selectedCompanyId) : q);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [gen, setGen] = useState(false);

  const ws = useFinanceWorkspace();
  const health = useBoardHealth();
  const crm = useCrm();
  const { stages } = useCrmStages();
  const { data: events = [] } = useQuery({
    queryKey: ["crm-stage-events", selectedCompanyId, "combined"],
    staleTime: 60_000,
    queryFn: () => safe(() => co(db.from("crm_stage_events").select("deal_id,from_stage,to_stage,moved_at")).order("moved_at", { ascending: true }).limit(5000)),
  });

  const gerar = async () => {
    if (!from || !to) { toast({ title: "Escolha o período" }); return; }
    setGen(true);
    try {
      const dre = computeDre(ws.canonical.rows, from, to);
      const m = computeKanbanMetrics(crm.deals as unknown as DealLite[], events as StageEvent[], stages, new Date().toISOString());
      await exportTablePdf({
        title: "Relatório combinado",
        subtitle: `Período ${from} a ${to} · gerado em ${format(new Date(), "dd/MM/yyyy HH:mm")}`,
        filename: `relatorio-combinado-${from}_${to}.pdf`,
        sections: [
          { heading: "Finanças — DRE do período", head: [["Indicador", "Valor"]], body: [
            ["Receita bruta", brl(dre.receitaBruta)],
            ["Receita líquida", brl(dre.receitaLiquida)],
            ["Despesa operacional", brl(dre.despesaOperacional)],
            ["EBITDA", brl(dre.ebitda)],
            ["Lucro líquido", brl(dre.lucroLiquido)],
            ["Margem líquida", pct(dre.margemLiquida)],
          ] },
          { heading: "Conselho — Saúde do negócio", head: [["Dimensão", "Score"]], body: [
            ["Geral", health.isLoading ? "—" : String(health.overall)],
            ...health.dimensions.map((d) => [d.label, String(d.score)]),
          ] },
          { heading: "CRM — Funil", head: [["Indicador", "Valor"]], body: [
            ["Deals no funil", String(m.totalDeals)],
            ["Valor total", brl(m.totalValue)],
            ["Win rate", pct(m.winRate)],
            ["Ciclo médio (ganhos)", dnum(m.avgCycleDays)],
            ["Gargalo", m.bottleneck ? `${m.bottleneck.title} (${dnum(m.bottleneck.avgDays)})` : "—"],
          ] },
        ],
      });
      toast({ title: "Relatório combinado gerado" });
    } catch (e: any) {
      toast({ title: "Falha ao gerar relatório", description: e?.message, variant: "destructive" });
    } finally {
      setGen(false);
    }
  };

  return (
    <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2"><Layers className="h-4 w-4 text-primary" />Relatório combinado (Finanças + Conselho + CRM)</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-wrap items-end gap-2">
        <DateRangeFilter dateFrom={from} dateTo={to} onDateFromChange={setFrom} onDateToChange={setTo} />
        <Button onClick={gerar} disabled={gen} className="gap-1.5"><FileText className="h-4 w-4" />{gen ? "Gerando..." : "Gerar PDF"}</Button>
        <p className="w-full text-[11px] text-muted-foreground">Finanças usam o período; saúde e funil são a foto atual. On-demand (não agendado).</p>
      </CardContent>
    </Card>
  );
};

export default CombinedReportPanel;
