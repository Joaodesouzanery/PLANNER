import { useMemo, useState } from "react";
import { ArrowRight, ShieldCheck, TrendingDown, Layers } from "lucide-react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { useCompany } from "@/contexts/CompanyContext";
import { PIE_COLORS, tooltipStyle } from "@/components/ems/finance/useFinanceData";
import type { useCrm } from "./useCrm";
import { crmPortfolio } from "./crmPortfolio";
import { towerKpis, towerGroups, type TowerCustomer } from "./crmTower";
import { groupCount } from "./crmCampaigns";

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const pct = (v: number) => `${Math.round(v * 100)}%`;
const todayIso = () => new Date().toISOString().slice(0, 10);
const DOT: Record<string, string> = { green: "bg-emerald-500", yellow: "bg-amber-500", red: "bg-red-500" };
const STAGE_LABEL: Record<string, string> = { new: "Novo", onboarding: "Onboarding", active: "Ativo", expansion: "Expansão", risk: "Risco", recovery: "Recuperação" };
const HEALTH_COLOR: Record<string, string> = { "Saudável": "hsl(142.1, 76.2%, 36.3%)", "Atenção": "hsl(45, 93%, 47%)", "Crítico": "hsl(0, 84.2%, 60.2%)" };

const Tile = ({ label, value, hint, tone }: { label: string; value: string | number; hint?: string; tone?: string }) => (
  <div className="rounded-xl border border-border/50 bg-background/40 p-3">
    <p className="text-[11px] text-muted-foreground">{label}</p>
    <p className={cn("mt-1 font-mono text-lg font-bold leading-tight", tone)}>{value}</p>
    {hint && <p className="text-[10px] text-muted-foreground mt-0.5 truncate">{hint}</p>}
  </div>
);

const Donut = ({ title, data, colorOf }: { title: string; data: { label: string; value: number }[]; colorOf?: (l: string, i: number) => string }) => (
  <div className="rounded-lg border border-border/50 p-2">
    <p className="text-[11px] text-muted-foreground mb-1">{title}</p>
    <div className="h-[150px]">
      {data.length === 0 ? <p className="text-xs text-muted-foreground py-12 text-center">Sem dados.</p> : (
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} cx="50%" cy="50%" innerRadius={32} outerRadius={60} paddingAngle={3} dataKey="value" nameKey="label" label={({ label, value }: any) => `${label} ${value}`} labelLine={false}>
              {data.map((d, i) => <Cell key={i} fill={colorOf ? colorOf(d.label, i) : PIE_COLORS[i % PIE_COLORS.length]} />)}
            </Pie>
            <Tooltip contentStyle={tooltipStyle} />
          </PieChart>
        </ResponsiveContainer>
      )}
    </div>
  </div>
);

export const ServicingTower = ({ crm, onSelectCustomer }: { crm: ReturnType<typeof useCrm>; onSelectCustomer: (id: string) => void }) => {
  const [by, setBy] = useState<"segment" | "tier">("segment");
  const { selectedCompanyId } = useCompany();
  // Escopado (empresa específica) → prefere a saúde PERSISTIDA (canônica); a calculada fica falsa-baixa
  // porque os satélites vêm filtrados. Consistente com Crm.tsx.healthOf, senão Torre × 360 divergem.
  const scoped = selectedCompanyId !== "all";
  const healthOf = (c: { id: string; health?: string | null }) =>
    (scoped ? (c.health || crm.scores.get(c.id)?.health) : (crm.scores.get(c.id)?.health || c.health)) || "green";

  const rows: TowerCustomer[] = useMemo(() => crm.customers.map((c) => {
    const sc = crm.scores.get(c.id);
    const rev = crm.revenueByCustomer.get(c.id);
    return {
      id: c.id, nome: c.nome, segment: c.segment, tier: c.tier, stage: c.stage,
      health: healthOf(c),
      healthScore: sc?.healthScore ?? 0,
      churnRisk: sc?.churnRisk ?? 0,
      recencyDias: sc?.recencyDias ?? null,
      recorrente: c.recorrente,
      ongoing: rev?.ongoing ?? 0,
      nextActionDate: c.next_action_date ?? null,
      priority: c.priority ?? null,
    };
  }), [crm.customers, crm.scores, crm.revenueByCustomer, scoped]);

  const p = useMemo(() => {
    const custs = crm.customers.map((c) => ({ id: c.id, nome: c.nome, recorrente: c.recorrente, health: healthOf(c), ongoing: crm.revenueByCustomer.get(c.id)?.ongoing ?? 0 }));
    return crmPortfolio(custs, crm.deals as any[], crm.nbaItems);
  }, [crm.customers, crm.deals, crm.nbaItems, crm.revenueByCustomer, crm.scores, scoped]);

  const k = useMemo(() => towerKpis(rows, todayIso()), [rows]);
  const groups = useMemo(() => towerGroups(rows, by, todayIso()), [rows, by]);

  const healthData = useMemo(() => groupCount(rows, (r) => (r.health === "green" ? "Saudável" : r.health === "yellow" ? "Atenção" : "Crítico")), [rows]);
  const stageData = useMemo(() => groupCount(rows, (r) => STAGE_LABEL[r.stage || "active"] || "—"), [rows]);
  const segData = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of rows) if (r.ongoing > 0) m.set(r.segment || "—", (m.get(r.segment || "—") ?? 0) + r.ongoing);
    return [...m.entries()].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);
  }, [rows]);

  const sev = useMemo(() => ({
    red: crm.nbaItems.filter((i) => i.severidade === "red").length,
    yellow: crm.nbaItems.filter((i) => i.severidade === "yellow").length,
    low: crm.nbaItems.filter((i) => i.severidade === "low").length,
  }), [crm.nbaItems]);

  const atRisk = useMemo(() => rows.filter((r) => r.health !== "green").sort((a, b) => (a.health === "red" ? -1 : 1) - (b.health === "red" ? -1 : 1) || b.ongoing - a.ongoing), [rows]);

  return (
    <div className="space-y-4">
      {/* KPIs de carteira */}
      <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-6 gap-2">
        <Tile label="Clientes" value={p.totalClientes} hint={`${p.ativos} saudáveis`} />
        <Tile label="Em risco" value={p.emRisco} tone={p.emRisco > 0 ? "text-destructive" : "text-emerald-400"} hint={`${p.atencao} em atenção`} />
        <Tile label="MRR" value={brl(p.mrr)} hint="receita recorrente" />
        <Tile label="Concentração top-1" value={pct(p.top1Share)} tone={p.top1Share > 0.3 ? "text-amber-400" : ""} hint={`HHI ${p.hhi.toFixed(2)}`} />
        <Tile label="Deals abertos" value={p.dealsAbertos} hint={`forecast ${brl(p.forecast)}`} />
        <Tile label="Prioridade alta" value={k.prioridadeAlta} tone={k.prioridadeAlta > 0 ? "text-amber-400" : ""} />
      </div>

      {/* KPIs de servicing */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <Tile label="SLA em dia" value={pct(k.slaAdherence)} tone={k.slaAdherence < 0.7 ? "text-red-400" : k.slaAdherence < 0.9 ? "text-amber-400" : "text-emerald-400"} hint={`${k.foraSla} vencido(s) · ${k.proxSla} vencendo`} />
        <Tile label="Resposta média" value={`${k.avgResponseDias}d`} tone={k.avgResponseDias > 30 ? "text-amber-400" : ""} hint="desde o último contato" />
        <Tile label="MRR em risco" value={brl(k.mrrEmRisco)} tone={k.mrrEmRisco > 0 ? "text-red-400" : "text-emerald-400"} hint="dos clientes críticos" />
        <Tile label="Churn risk médio" value={k.churnRiskMedio} tone={k.churnRiskMedio >= 50 ? "text-red-400" : k.churnRiskMedio >= 25 ? "text-amber-400" : "text-emerald-400"} hint="recorrentes (0-100)" />
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Donut title="Saúde da carteira" data={healthData} colorOf={(l) => HEALTH_COLOR[l] || PIE_COLORS[0]} />
        <Donut title="Por estágio" data={stageData} />
        <div className="rounded-lg border border-border/50 p-2">
          <p className="text-[11px] text-muted-foreground mb-1">MRR por segmento</p>
          <div className="h-[150px]">
            {segData.length === 0 ? <p className="text-xs text-muted-foreground py-12 text-center">Sem MRR.</p> : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={segData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="label" stroke="hsl(var(--muted-foreground))" fontSize={10} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={10} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                  <Tooltip contentStyle={tooltipStyle} formatter={(v: any) => brl(Number(v))} />
                  <Bar dataKey="value" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      {/* Manager workbench: grupos por segmento/tier */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="text-base flex items-center gap-2"><Layers className="h-4 w-4 text-primary" />Grupos</CardTitle>
            <div className="inline-flex rounded-lg border border-border/50 bg-card/60 p-0.5">
              <Button size="sm" variant={by === "segment" ? "secondary" : "ghost"} className="h-7 text-xs" onClick={() => setBy("segment")}>Segmento</Button>
              <Button size="sm" variant={by === "tier" ? "secondary" : "ghost"} className="h-7 text-xs" onClick={() => setBy("tier")}>Tier</Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">{by === "segment" ? "Segmento" : "Tier"}</TableHead>
                  <TableHead className="text-xs text-right">Clientes</TableHead>
                  <TableHead className="text-xs text-right">MRR</TableHead>
                  <TableHead className="text-xs text-right">Em risco</TableHead>
                  <TableHead className="text-xs text-right">SLA</TableHead>
                  <TableHead className="text-xs text-right">Fora SLA</TableHead>
                  <TableHead className="text-xs text-right">Prior. alta</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {groups.map((g) => (
                  <TableRow key={g.chave} className="hover:bg-muted/30">
                    <TableCell className="text-sm font-medium">{g.chave}</TableCell>
                    <TableCell className="text-right font-mono text-xs">{g.count}</TableCell>
                    <TableCell className="text-right font-mono text-xs">{brl(g.mrr)}</TableCell>
                    <TableCell className={cn("text-right font-mono text-xs", g.emRisco > 0 && "text-red-400")}>{g.emRisco}</TableCell>
                    <TableCell className={cn("text-right font-mono text-xs", g.slaAdherence < 0.7 && "text-red-400")}>{pct(g.slaAdherence)}</TableCell>
                    <TableCell className={cn("text-right font-mono text-xs", g.foraSla > 0 && "text-amber-400")}>{g.foraSla}</TableCell>
                    <TableCell className="text-right font-mono text-xs">{g.prioridadeAlta}</TableCell>
                  </TableRow>
                ))}
                {groups.length === 0 && <TableRow><TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-6">Sem clientes.</TableCell></TableRow>}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Alertas por severidade + clientes em risco */}
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)] gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-primary" />Alertas por severidade</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {[{ k: "red", label: "Críticos", n: sev.red, cls: "text-red-400", dot: "bg-red-500" }, { k: "yellow", label: "Atenção", n: sev.yellow, cls: "text-amber-400", dot: "bg-amber-500" }, { k: "low", label: "Oportunidades", n: sev.low, cls: "text-muted-foreground", dot: "bg-muted-foreground" }].map((s) => (
              <div key={s.k} className="flex items-center gap-2 rounded-lg border border-border/50 p-2">
                <span className={cn("h-2 w-2 rounded-full", s.dot)} />
                <span className="text-sm flex-1">{s.label}</span>
                <span className={cn("font-mono text-lg font-bold", s.cls)}>{s.n}</span>
              </div>
            ))}
            <p className="text-[10px] text-muted-foreground">Da fila de Oportunidades (NBA).</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><TrendingDown className="h-4 w-4 text-primary" />Clientes exigindo atenção</CardTitle></CardHeader>
          <CardContent className="space-y-1">
            {atRisk.length === 0 ? (
              <p className="text-sm text-muted-foreground">Toda a carteira saudável. ✓</p>
            ) : (
              atRisk.map((c) => (
                <div key={c.id} className="flex items-center gap-2 rounded-lg border border-border/50 p-2 text-sm">
                  <span className={cn("h-2 w-2 shrink-0 rounded-full", DOT[c.health])} />
                  <span className="flex-1 truncate">{c.nome}<span className="text-xs text-muted-foreground"> · churn {c.churnRisk}{c.recencyDias != null ? ` · ${c.recencyDias}d sem contato` : ""}</span></span>
                  <span className="font-mono text-xs text-muted-foreground shrink-0">{brl(c.ongoing)}/mês</span>
                  <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => onSelectCustomer(c.id)}><ArrowRight className="h-3.5 w-3.5" /></Button>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ServicingTower;
