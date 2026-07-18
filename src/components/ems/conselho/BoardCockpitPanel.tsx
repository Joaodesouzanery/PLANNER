import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle, Archive, Bot, CalendarClock, DollarSign,
  FileText, ShieldCheck, Target,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { cn } from "@/lib/utils";
import { dateLabel } from "./boardShared";
import { BoardAttentionFeed } from "./BoardAttentionFeed";

const DAY = 86400000;
const iso = (d: Date) => d.toISOString().slice(0, 10);
const money = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const toneBox = (tone: string) => tone === "red" ? "bg-red-500/10 text-red-500" : tone === "amber" ? "bg-amber-500/10 text-amber-500" : tone === "emerald" ? "bg-emerald-500/10 text-emerald-500" : "bg-primary/10 text-primary";

export const BoardCockpitPanel = ({ onNavigate }: { onNavigate: (tab: string) => void }) => {
  const { selectedCompanyId } = useCompany();
  const hasCompanyFilter = selectedCompanyId !== "all";
  const companyFilter = (q: any) => hasCompanyFilter ? q.eq("company_id", selectedCompanyId) : q;
  const todayStr = iso(new Date());
  const soon = iso(new Date(Date.now() + 30 * DAY));
  const safe = async (build: () => any): Promise<any[]> => {
    try { const { data, error } = await build(); return error ? [] : (data || []); } catch { return []; }
  };

  const { data: tx = [] } = useQuery({ queryKey: ["cockpit-tx", selectedCompanyId], staleTime: 1000 * 60 * 2,
    queryFn: () => safe(() => companyFilter((supabase as any).from("financial_transactions").select("amount,type,date").gte("date", iso(new Date(Date.now() - 30 * DAY))))) });
  const { data: risks = [] } = useQuery({ queryKey: ["cockpit-risks", selectedCompanyId], staleTime: 1000 * 60 * 2,
    queryFn: () => safe(() => companyFilter((supabase as any).from("board_risks").select("id,title,score,status,owner,review_date").neq("status", "closed"))) });
  const { data: occ = [] } = useQuery({ queryKey: ["cockpit-occ", selectedCompanyId], staleTime: 1000 * 60 * 2,
    queryFn: () => safe(() => companyFilter((supabase as any).from("board_obligation_occurrences").select("id,due_date,status,obligation_id").eq("status", "pending").lte("due_date", soon))) });
  const { data: obligations = [] } = useQuery({ queryKey: ["cockpit-obl", selectedCompanyId], staleTime: 1000 * 60 * 2,
    queryFn: () => safe(() => companyFilter((supabase as any).from("board_obligations").select("id,title").eq("status", "active"))) });
  const { data: backups = [] } = useQuery({ queryKey: ["cockpit-backups", selectedCompanyId], staleTime: 1000 * 60 * 5,
    queryFn: () => safe(() => companyFilter((supabase as any).from("board_backup_logs").select("backup_date,status").eq("status", "success").order("backup_date", { ascending: false }).limit(1))) });
  const { data: tools = [] } = useQuery({ queryKey: ["cockpit-tools", selectedCompanyId], staleTime: 1000 * 60 * 5,
    queryFn: () => safe(() => companyFilter((supabase as any).from("board_stack_items").select("cost,billing_cycle,status,renewal_date,name").eq("status", "active"))) });
  const { data: okrs = [] } = useQuery({ queryKey: ["cockpit-okrs", selectedCompanyId], staleTime: 1000 * 60 * 3,
    queryFn: () => safe(() => companyFilter((supabase as any).from("okrs").select("current_value,target_value,end_date,title"))) });
  const { data: gov = [] } = useQuery({ queryKey: ["cockpit-gov", selectedCompanyId], staleTime: 1000 * 60 * 2,
    queryFn: () => safe(() => companyFilter((supabase as any).from("governance_items").select("id,title,category,priority,status,due_date,metadata,owner"))) });
  const { data: docs = [] } = useQuery({ queryKey: ["cockpit-docs", selectedCompanyId], staleTime: 1000 * 60 * 2,
    queryFn: () => safe(() => companyFilter((supabase as any).from("attachments").select("id,file_name,expires_at").not("expires_at", "is", null).lte("expires_at", soon).order("expires_at"))) });

  const oblById: Record<string, string> = useMemo(() => Object.fromEntries((obligations as any[]).map((o) => [o.id, o.title])), [obligations]);

  const radar = useMemo(() => {
    const net30 = (tx as any[]).reduce((s, t) => s + (t.type === "income" ? Number(t.amount) : -Number(t.amount)), 0);
    const openRisks = (risks as any[]).length;
    const critRisks = (risks as any[]).filter((r) => Number(r.score) >= 16).length;
    const overdueObl = (occ as any[]).filter((o) => o.due_date < todayStr).length;
    const lastBackup = (backups as any[])[0]?.backup_date;
    const backupAge = lastBackup ? Math.floor((Date.now() - new Date(`${lastBackup}T12:00:00`).getTime()) / DAY) : null;
    const stackCost = (tools as any[]).reduce((s, t) => s + (t.billing_cycle === "annual" ? Number(t.cost || 0) / 12 : Number(t.cost || 0)), 0);
    const okrAvg = (okrs as any[]).length ? Math.round((okrs as any[]).reduce((s, o) => s + (o.target_value > 0 ? (o.current_value / o.target_value) * 100 : 0), 0) / (okrs as any[]).length) : 0;
    const okrRisk = (okrs as any[]).filter((o) => o.target_value > 0 && (o.current_value / o.target_value) < 0.5 && o.end_date).length;
    const govOpen = (gov as any[]).filter((g) => !["done", "archived"].includes(g.status));
    const govCrit = govOpen.filter((g) => ["high", "critical"].includes(g.priority)).length;
    const decisionsPending = govOpen.filter((g) => g.metadata?.decision_needed || g.category === "decisions").length;

    return [
      { label: "Financeiro", icon: DollarSign, value: money(net30), sub: "Caixa últimos 30d", tone: net30 < 0 ? "red" : "emerald", tab: null },
      { label: "Riscos", icon: AlertTriangle, value: `${openRisks} abertos`, sub: `${critRisks} críticos`, tone: critRisks ? "red" : openRisks ? "amber" : "emerald", tab: "risks" },
      { label: "Obrigações", icon: CalendarClock, value: `${(occ as any[]).length} no radar`, sub: `${overdueObl} atrasadas`, tone: overdueObl ? "red" : "amber", tab: "obligations" },
      { label: "Backup & Stack", icon: Archive, value: backupAge === null ? "Sem backup" : `Backup há ${backupAge}d`, sub: `${money(stackCost)}/mês de stack`, tone: backupAge === null || backupAge > 30 ? "red" : backupAge > 7 ? "amber" : "emerald", tab: "stack" },
      { label: "Estratégia/OKRs", icon: Target, value: `${okrAvg}% médio`, sub: `${okrRisk} OKRs em risco`, tone: okrRisk ? "amber" : "emerald", tab: "strategy" },
      { label: "Governança", icon: ShieldCheck, value: `${govCrit} críticas`, sub: `${govOpen.length} pendências`, tone: govCrit ? "red" : "emerald", tab: "legal" },
      { label: "Decisões", icon: Bot, value: `${decisionsPending} pendentes`, sub: "Aguardando deliberação", tone: decisionsPending ? "amber" : "emerald", tab: "decisions" },
      { label: "Documentos", icon: FileText, value: `${(docs as any[]).length} vencendo`, sub: "Próximos 30 dias", tone: (docs as any[]).length ? "amber" : "emerald", tab: "documents" },
    ];
  }, [tx, risks, occ, backups, tools, okrs, gov, docs, todayStr]);

  const nextActions = useMemo(() => {
    const govOpen = (gov as any[]).filter((g) => !["done", "archived"].includes(g.status) && (g.due_date || ["high", "critical"].includes(g.priority)));
    const items = [
      ...govOpen.map((g) => ({ id: `g-${g.id}`, title: g.title, kind: g.category, date: g.due_date, critical: ["high", "critical"].includes(g.priority) })),
      ...(risks as any[]).filter((r) => Number(r.score) >= 10).map((r) => ({ id: `r-${r.id}`, title: r.title, kind: "risco", date: r.review_date, critical: Number(r.score) >= 16 })),
    ];
    return items.sort((a, b) => (Number(b.critical) - Number(a.critical)) || String(a.date || "9999").localeCompare(String(b.date || "9999"))).slice(0, 6);
  }, [gov, risks]);

  const timeline = useMemo(() => {
    const items = [
      ...(occ as any[]).map((o) => ({ date: o.due_date, type: "Obrigação", title: oblById[o.obligation_id] || "Vencimento", tone: o.due_date < todayStr ? "red" : "amber" })),
      ...(risks as any[]).filter((r) => r.review_date).map((r) => ({ date: r.review_date, type: "Revisão de risco", title: r.title, tone: "rose" })),
      ...(tools as any[]).filter((t) => t.renewal_date && t.renewal_date <= soon).map((t) => ({ date: t.renewal_date, type: "Renovação", title: t.name, tone: "amber" })),
      ...(gov as any[]).filter((g) => g.due_date && !["done", "archived"].includes(g.status)).map((g) => ({ date: g.due_date, type: g.category, title: g.title, tone: "blue" })),
      ...(docs as any[]).map((d) => ({ date: d.expires_at, type: "Documento", title: d.file_name, tone: "amber" })),
    ];
    return items.filter((i) => i.date).sort((a, b) => String(a.date).localeCompare(String(b.date))).slice(0, 24);
  }, [occ, risks, tools, gov, docs, oblById, todayStr, soon]);

  return (
    <div className="space-y-4">
      {/* Central de Atenção — tudo que precisa de você, reds primeiro (Fase 2). */}
      <BoardAttentionFeed />

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {radar.map((item) => (
          <button
            key={item.label}
            type="button"
            disabled={!item.tab}
            onClick={() => item.tab && onNavigate(item.tab)}
            className={cn("text-left rounded-xl border bg-card p-4 transition-colors", item.tab ? "hover:border-primary/40 hover:bg-primary/5" : "cursor-default")}
          >
            <div className="flex items-start gap-3">
              <div className={cn("p-2 rounded-lg", toneBox(item.tone))}><item.icon className="h-5 w-5" /></div>
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">{item.label}</p>
                <p className="text-lg font-bold truncate">{item.value}</p>
                <p className="text-[11px] text-muted-foreground truncate">{item.sub}</p>
              </div>
            </div>
          </button>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><CalendarClock className="h-4 w-4 text-primary" /> Linha do tempo executiva</CardTitle></CardHeader>
          <CardContent className="space-y-2 max-h-[460px] overflow-y-auto">
            {timeline.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">Sem vencimentos relevantes no radar.</p>
            ) : timeline.map((item, idx) => (
              <div key={`${item.type}-${idx}`} className="flex items-center gap-3 rounded-lg border p-3">
                <Badge variant="outline" className="w-24 justify-center text-[10px] shrink-0">{dateLabel(item.date)}</Badge>
                <Badge variant="secondary" className="text-[10px] shrink-0">{item.type}</Badge>
                <p className="text-sm truncate">{item.title}</p>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-primary" /> Próximas decisões e riscos</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {nextActions.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">Sem ações urgentes do Conselho.</p>
            ) : nextActions.map((item) => (
              <button key={item.id} type="button" onClick={() => onNavigate(item.kind === "risco" ? "risks" : "cockpit")} className="w-full rounded-lg border p-3 text-left hover:border-primary/40 hover:bg-primary/5 transition-colors">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium truncate">{item.title}</span>
                  <Badge variant={item.critical ? "destructive" : "outline"} className="text-[10px] shrink-0">{item.kind}</Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-1">{item.date ? `Prazo: ${dateLabel(item.date)}` : "Sem prazo definido"}</p>
              </button>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
