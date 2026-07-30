import { useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, PieChart, Pie } from "recharts";
import { format } from "date-fns";
import { Activity, AlertTriangle, FileDown, Sheet, Trophy, Timer, CalendarDays, Filter, TrendingUp, DollarSign } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { toast } from "@/hooks/use-toast";
import { exportTablePdf, captureChart, exportCsv } from "@/lib/exportPdf";
import type { useCrm } from "./useCrm";
import { useCrmStages } from "./useCrmStages";
import { computeKanbanMetrics, type StageEvent, type DealLite } from "./kanbanMetrics";
import { computeWeekSummary } from "./weeklyReport";

const db = supabase as any;
const safe = async (build: () => any): Promise<any[]> => {
  try { const { data, error } = await build(); if (error) return []; return data ?? []; } catch { return []; }
};
const nowIso = () => new Date().toISOString();
const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const days = (v: number | null) => (v == null ? "—" : `${v.toFixed(1)}d`);
const pct = (v: number | null) => (v == null ? "—" : `${Math.round(v * 100)}%`);

const KpiTile = ({ icon: Icon, label, value, tone }: { icon: typeof Activity; label: string; value: string; tone?: string }) => (
  <div className="rounded-xl border border-border/50 bg-background/40 p-3">
    <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground"><Icon className="h-3.5 w-3.5" />{label}</p>
    <p className={cn("mt-1 font-mono text-lg font-bold leading-tight", tone)}>{value}</p>
  </div>
);

const BAR = "hsl(var(--primary))";
const TIME_BAR = "hsl(38 92% 50%)";
const LOSS_COLORS = ["hsl(0 84% 60%)", "hsl(38 92% 50%)", "hsl(280 65% 60%)", "hsl(200 80% 55%)", "hsl(160 60% 45%)", "hsl(320 60% 55%)", "hsl(20 80% 55%)"];

/** Painel de métricas do kanban de deals por empresa: lead/etapa, tempo/etapa, gargalo, win rate, ciclo, perdas. */
export const KanbanMetricsPanel = ({ crm, moduloId }: { crm: ReturnType<typeof useCrm>; moduloId?: string | null }) => {
  const { selectedCompanyId } = useCompany();
  const scoped = selectedCompanyId && selectedCompanyId !== "all";
  const co = (q: any) => (scoped ? q.eq("company_id", selectedCompanyId) : q);
  const { stages } = useCrmStages();
  const [exporting, setExporting] = useState(false);
  const chartLeads = useRef<HTMLDivElement>(null);
  const chartTime = useRef<HTMLDivElement>(null);

  const { data: events = [] } = useQuery({
    queryKey: ["crm-stage-events", selectedCompanyId, "metrics"],
    staleTime: 60_000,
    queryFn: () =>
      safe(() => co(db.from("crm_stage_events").select("deal_id,from_stage,to_stage,moved_at")).order("moved_at", { ascending: true }).limit(5000)),
  });

  const m = useMemo(
    () => computeKanbanMetrics(crm.deals as unknown as DealLite[], events as StageEvent[], stages, nowIso(), moduloId),
    [crm.deals, events, stages, moduloId],
  );

  const leadsData = m.perStage.map((s) => ({ name: s.title, count: s.count, offtrack: s.offtrack }));
  const timeData = m.perStage.filter((s) => !s.offtrack && s.avgDays != null).map((s) => ({ name: s.title, avgDays: Number((s.avgDays as number).toFixed(1)) }));
  const monthlyData = m.monthly.map((p) => ({ mes: p.month.slice(5), valor: p.valorGanho, ganhos: p.ganhos, criados: p.criados }));
  const lossData = m.lostReasons.map((r) => ({ name: r.reason, value: r.count }));
  const funnelMax = m.funnel[0]?.reached || 1;

  const exportPdf = async () => {
    setExporting(true);
    try {
      const [imgLeads, imgTime] = await Promise.all([captureChart(chartLeads.current), captureChart(chartTime.current)]);
      const images = [
        imgLeads && { heading: "Lead por etapa", dataUrl: imgLeads, height: 70 },
        imgTime && { heading: "Tempo médio por etapa (dias)", dataUrl: imgTime, height: 70 },
      ].filter(Boolean) as { heading: string; dataUrl: string; height?: number }[];
      await exportTablePdf({
        title: "Métricas do funil (kanban)",
        subtitle: `Gerado em ${format(new Date(), "dd/MM/yyyy HH:mm")}`,
        filename: `funil-metricas-${format(new Date(), "yyyy-MM-dd")}.pdf`,
        images,
        sections: [
          { heading: "Resumo", head: [["Indicador", "Valor"]], body: [
            ["Total de deals", String(m.totalDeals)],
            ["Valor total", brl(m.totalValue)],
            ["Ganhos (R$)", `${brl(m.wonValue)} · ${m.wonCount}`],
            ["Perdidos (R$)", `${brl(m.lostValue)} · ${m.lostCount}`],
            ["Em aberto (R$)", `${brl(m.openValue)} · ${m.openCount}`],
            ["Ticket médio", m.ticketMedio != null ? brl(m.ticketMedio) : "—"],
            ["Win rate", pct(m.winRate)],
            ["Ciclo médio (ganhos)", days(m.avgCycleDays)],
            ["Gargalo", m.bottleneck ? `${m.bottleneck.title} (${days(m.bottleneck.avgDays)})` : "—"],
          ] },
          { heading: "Funil de conversão", head: [["Etapa", "Chegou aqui", "Conversão"]], body: m.funnel.map((f) => [f.title, String(f.reached), f.convPct != null ? pct(f.convPct) : "—"]) },
          { heading: "Ganhos por mês", head: [["Mês", "Criados", "Ganhos", "Valor ganho"]], body: m.monthly.map((p) => [p.month, String(p.criados), String(p.ganhos), brl(p.valorGanho)]) },
          { heading: "Por etapa", head: [["Etapa", "Deals", "Valor", "Tempo médio"]], body: m.perStage.map((s) => [s.title, String(s.count), brl(s.totalValue), days(s.avgDays)]) },
          { heading: "Motivos de perda", head: [["Motivo", "Qtd"]], body: m.lostReasons.length ? m.lostReasons.map((r) => [r.reason, String(r.count)]) : [["—", "—"]] },
        ],
      });
      toast({ title: "PDF exportado" });
    } catch (e: any) {
      toast({ title: "Falha ao exportar", description: e?.message, variant: "destructive" });
    } finally {
      setExporting(false);
    }
  };

  const exportSheet = () => {
    exportCsv(
      `funil-metricas-${format(new Date(), "yyyy-MM-dd")}.csv`,
      ["Etapa", "Deals", "Valor", "Tempo medio (dias)"],
      m.perStage.map((s) => [s.title, s.count, s.totalValue, s.avgDays ?? ""]),
    );
  };

  // Relatório da semana (on-demand — não agendado): resumo dos últimos 7 dias + fila de ações.
  const exportWeek = async () => {
    setExporting(true);
    try {
      const week = computeWeekSummary(events as StageEvent[], stages, nowIso());
      const nba = (crm.nbaItems ?? [])
        .filter((i) => ["esfriando", "follow_up_48h", "deal_parado", "deal_fechando"].includes(i.tipo))
        .slice(0, 25);
      await exportTablePdf({
        title: "Relatório da semana",
        subtitle: `Últimos 7 dias · gerado em ${format(new Date(), "dd/MM/yyyy HH:mm")}`,
        filename: `relatorio-semana-${format(new Date(), "yyyy-MM-dd")}.pdf`,
        sections: [
          { heading: "Semana (últimos 7 dias)", head: [["Indicador", "Valor"]], body: [
            ["Movimentos no funil", String(week.movimentos)],
            ["Ganhos", String(week.ganhos)],
            ["Perdidos", String(week.perdidos)],
          ] },
          { heading: "Movimentos por etapa", head: [["Etapa", "Movimentos"]], body: week.porEtapa.length ? week.porEtapa.map((p) => [p.title, String(p.count)]) : [["—", "—"]] },
          { heading: "Ações sugeridas (fila NBA)", head: [["Cliente", "Ação"]], body: nba.length ? nba.map((i) => [i.customerName, i.titulo]) : [["—", "Nada pendente ✓"]] },
          { heading: "Funil (geral)", head: [["Indicador", "Valor"]], body: [
            ["Win rate", pct(m.winRate)],
            ["Ciclo médio (ganhos)", days(m.avgCycleDays)],
            ["Gargalo", m.bottleneck ? `${m.bottleneck.title} (${days(m.bottleneck.avgDays)})` : "—"],
          ] },
        ],
      });
      toast({ title: "Relatório da semana gerado" });
    } catch (e: any) {
      toast({ title: "Falha ao exportar", description: e?.message, variant: "destructive" });
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          Tempo por etapa, win rate e ciclo são <b>incrementais</b> — enchem conforme os deals se movem (a contagem por etapa vale desde já).
        </p>
        <div className="flex items-center gap-1.5 shrink-0">
          <Button size="sm" variant="outline" className="h-8 gap-1.5 text-xs" onClick={exportWeek} disabled={exporting}><CalendarDays className="h-3.5 w-3.5" />Semana</Button>
          <Button size="sm" variant="outline" className="h-8 gap-1.5 text-xs" onClick={exportSheet}><Sheet className="h-3.5 w-3.5" />CSV</Button>
          <Button size="sm" variant="outline" className="h-8 gap-1.5 text-xs" onClick={exportPdf} disabled={exporting}><FileDown className="h-3.5 w-3.5" />{exporting ? "Gerando..." : "PDF"}</Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        <KpiTile icon={Activity} label="Deals no funil" value={String(m.totalDeals)} />
        <KpiTile icon={Trophy} label="Win rate" value={pct(m.winRate)} tone={m.winRate != null && m.winRate >= 0.3 ? "text-emerald-400" : ""} />
        <KpiTile icon={Timer} label="Ciclo médio" value={days(m.avgCycleDays)} />
        <KpiTile icon={AlertTriangle} label="Gargalo" value={m.bottleneck ? m.bottleneck.title : "—"} tone={m.bottleneck ? "text-amber-400" : ""} />
        <KpiTile icon={Trophy} label="Ganhos / Perdidos" value={`${m.wonCount} / ${m.lostCount}`} />
      </div>

      {/* Resultado em R$ por outcome + ticket médio */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <KpiTile icon={Trophy} label="Ganhos (R$)" value={brl(m.wonValue)} tone="text-emerald-400" />
        <KpiTile icon={AlertTriangle} label="Perdidos (R$)" value={brl(m.lostValue)} tone="text-destructive" />
        <KpiTile icon={Activity} label="Em aberto (R$)" value={brl(m.openValue)} />
        <KpiTile icon={DollarSign} label="Ticket médio" value={m.ticketMedio != null ? brl(m.ticketMedio) : "—"} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Funil de conversão etapa a etapa */}
        <Card className="border border-border/50 bg-card/80">
          <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><Filter className="h-4 w-4 text-primary" />Funil de conversão</CardTitle></CardHeader>
          <CardContent className="space-y-2 pt-1">
            {m.funnel.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sem etapas na esteira.</p>
            ) : m.funnel.map((f) => (
              <div key={f.key}>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="truncate">{f.title}</span>
                  <span className="font-mono shrink-0"><span className="text-muted-foreground">{f.reached}</span>{f.convPct != null && <span className={cn("ml-2", f.convPct >= 0.6 ? "text-emerald-400" : f.convPct >= 0.3 ? "text-amber-400" : "text-destructive")}>{Math.round(f.convPct * 100)}%</span>}</span>
                </div>
                <div className="h-3 rounded bg-muted/40 overflow-hidden"><div className="h-full rounded bg-primary/80" style={{ width: `${Math.max(2, Math.round((f.reached / funnelMax) * 100))}%` }} /></div>
              </div>
            ))}
            <p className="text-[10px] text-muted-foreground pt-1">% = conversão da etapa anterior. "Chegou aqui" conta quem alcançou a etapa (ou além), pelos eventos de movimentação.</p>
          </CardContent>
        </Card>

        {/* Série mensal — valor ganho por mês (6 meses) */}
        <Card className="border border-border/50 bg-card/80">
          <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><TrendingUp className="h-4 w-4 text-primary" />Ganhos por mês (R$)</CardTitle></CardHeader>
          <CardContent>
            <div className="h-[260px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyData} margin={{ top: 6, right: 8, left: -4, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="mes" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                  <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} formatter={(v: number) => brl(v)} />
                  <Bar dataKey="valor" name="Ganho (R$)" fill={BAR} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="border border-border/50 bg-card/80">
          <CardHeader className="pb-2"><CardTitle className="text-base">Lead por etapa</CardTitle></CardHeader>
          <CardContent>
            <div ref={chartLeads} className="h-[260px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={leadsData} margin={{ top: 6, right: 8, left: -12, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={10} interval={0} angle={-25} textAnchor="end" height={54} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} allowDecimals={false} />
                  <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
                  <Bar dataKey="count" name="Deals" radius={[4, 4, 0, 0]}>
                    {leadsData.map((d, i) => <Cell key={i} fill={d.offtrack ? "hsl(var(--muted-foreground))" : BAR} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="border border-border/50 bg-card/80">
          <CardHeader className="pb-2"><CardTitle className="text-base">Tempo médio por etapa (dias)</CardTitle></CardHeader>
          <CardContent>
            <div ref={chartTime} className="h-[260px]">
              {timeData.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={timeData} margin={{ top: 6, right: 8, left: -12, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={10} interval={0} angle={-25} textAnchor="end" height={54} />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} />
                    <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} formatter={(v: number) => `${v} d`} />
                    <Bar dataKey="avgDays" name="Dias" fill={TIME_BAR} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-center text-sm text-muted-foreground italic px-4">
                  Ainda sem tempo de etapa — mova alguns deals entre colunas e a série aparece.
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {m.lostReasons.length > 0 && (
        <Card className="border border-border/50 bg-card/80">
          <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-destructive" />Motivos de perda</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={lossData} cx="50%" cy="50%" innerRadius={45} outerRadius={80} paddingAngle={3} dataKey="value" nameKey="name">
                    {lossData.map((_, i) => <Cell key={i} fill={LOSS_COLORS[i % LOSS_COLORS.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-1.5">
              {m.lostReasons.map((r, i) => (
                <div key={r.reason} className="flex items-center justify-between text-sm">
                  <span className="truncate flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: LOSS_COLORS[i % LOSS_COLORS.length] }} />{r.reason}</span>
                  <span className="font-mono text-muted-foreground">{r.count}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default KanbanMetricsPanel;
