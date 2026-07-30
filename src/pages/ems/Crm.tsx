import { useEffect, useMemo, useState, lazy, Suspense, type ReactNode } from "react";
import { useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { Users, Search, Phone, Mail, Briefcase, Repeat, CalendarClock, Plus, Target, LayoutGrid, List, BarChart3, TrendingUp, TrendingDown, Minus, Gift, ShieldCheck, HeartPulse, ChevronLeft } from "lucide-react";
import { EMSLayout } from "@/components/ems/EMSLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { useCompany } from "@/contexts/CompanyContext";
import { AttachmentManager } from "@/components/ems/AttachmentManager";
import { OperationalMapPanel } from "@/components/ems/OperationalMapPanel";
import { useCrm } from "@/components/ems/crm/useCrm";
import { OpportunityInbox } from "@/components/ems/crm/OpportunityInbox";
import { OnboardingPanel } from "@/components/ems/crm/OnboardingPanel";
import { ServicingTower } from "@/components/ems/crm/ServicingTower";
import { CustomerKanban } from "@/components/ems/crm/CustomerKanban";
import { DealKanban } from "@/components/ems/crm/DealKanban";
import { StageManager } from "@/components/ems/crm/StageManager";
import { ModuloManager } from "@/components/ems/crm/ModuloManager";
import { ModuloFilter } from "@/components/ems/crm/ModuloFilter";
import { AtivosPanel } from "@/components/ems/crm/AtivosPanel";
import { ProvaPanel } from "@/components/ems/crm/ProvaPanel";
import { AtividadesPanel } from "@/components/ems/crm/AtividadesPanel";
import { ExpansaoBoard } from "@/components/ems/crm/ExpansaoBoard";
import { RotinaSemanaPanel } from "@/components/ems/crm/RotinaSemanaPanel";
import { KanbanMetricsPanel } from "@/components/ems/crm/KanbanMetricsPanel";
import { useCrmStages } from "@/components/ems/crm/useCrmStages";
import { useCrmModulos } from "@/components/ems/crm/useCrmModulos";
import { useCrmAtivos } from "@/components/ems/crm/useCrmAtivos";
import { useCrmRealtime } from "@/components/ems/crm/useCrmRealtime";
import { OFERTA_LABEL, TREND_LABEL, type CustomerScore, type Trend } from "@/components/ems/crm/crmScores";
import { buildCustomer360, diasSemContato, type CustomerSpine, type Customer360 } from "@/components/ems/crm/crm360";

import { ContactsTab } from "@/components/ems/crm/ContactsTab";
const Prospecting = lazy(() => import("@/components/ems/commercial/Prospecting"));
const ContactBoards = lazy(() => import("@/components/ems/crm/ContactBoards"));
const CampaignManager = lazy(() => import("@/components/ems/crm/CampaignManager"));
const VisitRoutesContent = lazy(() => import("@/pages/ems/VisitRoutes").then((m) => ({ default: m.VisitRoutesContent })));
const AgileImplementation = lazy(() => import("@/pages/ems/AgileImplementation"));
const LazyFallback = () => <div className="p-8 text-center text-sm text-muted-foreground">Carregando…</div>;

const STAGES = [
  { id: "new", label: "Novo" }, { id: "onboarding", label: "Onboarding" }, { id: "active", label: "Ativo" },
  { id: "expansion", label: "Expansão" }, { id: "risk", label: "Risco" }, { id: "recovery", label: "Recuperação" },
];
const HEALTH: Record<string, { label: string; dot: string; cls: string }> = {
  green: { label: "Saudável", dot: "bg-emerald-500", cls: "text-emerald-500" },
  yellow: { label: "Atenção", dot: "bg-amber-500", cls: "text-amber-500" },
  red: { label: "Crítico", dot: "bg-red-500", cls: "text-red-500" },
};
const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const todayIso = () => new Date().toISOString().slice(0, 10);
const dateBR = (d?: string | null) => (d ? new Date(`${d.slice(0, 10)}T12:00:00`).toLocaleDateString("pt-BR") : "—");

// 6 grupos (consolidado das 13 telas). Cada grupo agrupa as antigas abas em sub-toggles.
const TAB_META: Record<string, { title: string; sub: string }> = {
  carteira: { title: "Carteira", sub: "Saúde da carteira + cada cliente no 360: receita, scorecard, deals, tarefas e histórico." },
  contatos: { title: "Contatos", sub: "As pessoas num kanban por segmento — ligue cada uma a um cliente pra aparecer no 360." },
  oportunidades: { title: "Oportunidades", sub: "Fila (NBA) · funil de deals · métricas · atividades (cadências) · expansão." },
  prospeccao: { title: "Prospecção", sub: "Empresas a prospectar — converta em cliente + contato + deal." },
  motor: { title: "Motor", sub: "Ativos, Prova, Rotina e Campanhas — o motor de conteúdo e outreach." },
  operacao: { title: "Operação", sub: "Mapa da carteira, rotas e a entrega (implementação ágil)." },
};

// Deep-links antigos (?tab=torre etc.) → novo grupo, pra não quebrar favoritos.
const TAB_ALIAS: Record<string, string> = {
  clientes: "carteira", torre: "carteira",
  quadros: "contatos", contatos: "contatos",
  oportunidades: "oportunidades", atividades: "oportunidades", expansao: "oportunidades",
  prospeccao: "prospeccao",
  ativos: "motor", prova: "motor", rotina: "motor", campanhas: "motor",
  mapa: "operacao", entrega: "operacao",
};

const Crm = () => {
  const crm = useCrm();
  useCrmRealtime();
  const { selectedCompanyId } = useCompany();
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedId, setSelectedId] = useState<string | null>(searchParams.get("client"));
  const rawTab = searchParams.get("tab") || "";
  const [tab, setTab] = useState(TAB_ALIAS[rawTab] || (TAB_META[rawTab] ? rawTab : "carteira"));
  const [search, setSearch] = useState("");
  const [healthFilter, setHealthFilter] = useState("all");
  const [view, setView] = useState<"list" | "kanban">(searchParams.get("view") === "kanban" ? "kanban" : "list");
  // Sub-views dos grupos consolidados (semeadas pelo ?tab= antigo p/ preservar deep-links).
  const [carteiraView, setCarteiraView] = useState<"clientes" | "visao">(rawTab === "torre" ? "visao" : "clientes");
  const [contatosView, setContatosView] = useState<"kanban" | "lista">(rawTab === "contatos" ? "lista" : "kanban");
  const [oppView, setOppView] = useState<"fila" | "kanban" | "metricas" | "atividades" | "expansao">(
    rawTab === "atividades" ? "atividades" : rawTab === "expansao" ? "expansao" : "fila");
  const [motorView, setMotorView] = useState<"ativos" | "prova" | "rotina" | "campanhas">(
    (["ativos", "prova", "rotina", "campanhas"] as const).includes(rawTab as any) ? (rawTab as any) : "ativos");
  const [opsView, setOpsView] = useState<"mapa" | "rotas" | "entrega">(rawTab === "entrega" ? "entrega" : "mapa");
  const [moduloId, setModuloId] = useState<string | null>(null);
  // Reseta o filtro de módulo ao trocar de solução/empresa (o módulo é company-scoped; senão o funil esvazia).
  useEffect(() => setModuloId(null), [selectedCompanyId]);
  const syncParam = (key: string, val: string | null) => setSearchParams((prev) => { const p = new URLSearchParams(prev); if (val) p.set(key, val); else p.delete(key); return p; }, { replace: true });
  const changeTab = (v: string) => { setTab(v); syncParam("tab", v === "carteira" ? null : v); };
  const changeView = (v: "list" | "kanban") => { setView(v); syncParam("view", v === "list" ? null : v); };
  const selectCustomer = (id: string) => { setSelectedId(id); setTab("carteira"); setCarteiraView("clientes"); setView("list"); };
  // Com empresa específica, os satélites vêm filtrados e a saúde recalculada seria falsa-baixa →
  // prefere a persistida (canônica). No view "todas", usa a calculada (que também é persistida pelo sync).
  const scoped = selectedCompanyId !== "all";
  const healthOf = (c: CustomerSpine) => (scoped ? (c.health || crm.scores.get(c.id)?.health) : (crm.scores.get(c.id)?.health || c.health)) || "green";

  const rows = useMemo(() =>
    crm.customers
      .map((c) => ({ c, rev: crm.revenueByCustomer.get(c.id) ?? { monthly: 0, ongoing: 0 }, health: healthOf(c) }))
      .filter(({ c, health }) => (healthFilter === "all" || health === healthFilter) && (!search || c.nome.toLowerCase().includes(search.toLowerCase())))
      .sort((a, b) => b.rev.monthly - a.rev.monthly),
    [crm.customers, crm.revenueByCustomer, crm.scores, healthFilter, search, scoped],
  );

  const selected = selectedId ? crm.customers.find((c) => c.id === selectedId) ?? null : null;
  const c360 = useMemo(
    () => (selected ? buildCustomer360(selected, crm.revenueByCustomer.get(selected.id) ?? { monthly: 0, ongoing: 0 }, crm.contacts, crm.deals, crm.routines, crm.interactions) : null),
    [selected, crm.revenueByCustomer, crm.contacts, crm.deals, crm.routines, crm.interactions],
  );

  const mrrTotal = rows.reduce((a, r) => a + r.rev.ongoing, 0);

  // Segmento dominante da carteira → sugere o template de funil ao gerar o quadro.
  const dominantSegment = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const c of crm.customers) { const seg = (c.segment || "").toLowerCase().trim(); if (seg) counts[seg] = (counts[seg] || 0) + 1; }
    return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0];
  }, [crm.customers]);

  return (
    <EMSLayout>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h1 className="text-2xl md:text-3xl font-heading font-bold flex items-center gap-2">
              <div className="p-2 rounded-xl bg-primary/10"><Users className="h-6 w-6 text-primary" /></div>
              CRM — {(TAB_META[tab] ?? TAB_META.carteira).title}
            </h1>
            <p className="text-muted-foreground mt-1 text-sm">{(TAB_META[tab] ?? TAB_META.carteira).sub}</p>
          </div>
          <div className="text-right hidden sm:block">
            <p className="font-mono text-lg font-bold text-primary">{brl(mrrTotal)}<span className="text-xs text-muted-foreground font-normal">/mês</span></p>
            <p className="text-[10px] text-muted-foreground">{crm.customers.length} clientes · receita recorrente</p>
          </div>
        </div>

        {crm.missing && !crm.isLoading && (
          <Card className="border-amber-500/30 bg-amber-500/5"><CardContent className="p-4 text-sm text-amber-400">Nenhum cliente ainda — cadastre clientes nas Transações (campo Cliente) ou aplique a migration <code>20260713120000_crm_customer_spine.sql</code>.</CardContent></Card>
        )}

        <Tabs value={tab} onValueChange={changeTab} className="space-y-4">
          <TabsList className="bg-card/80 border border-border/50 rounded-xl flex w-full justify-start overflow-x-auto">
            <TabsTrigger value="carteira" className="shrink-0 rounded-lg data-[state=active]:bg-primary/15 data-[state=active]:text-primary">Carteira</TabsTrigger>
            <TabsTrigger value="contatos" className="shrink-0 rounded-lg data-[state=active]:bg-primary/15 data-[state=active]:text-primary gap-1.5">Contatos {crm.contacts.filter((c) => !c.customer_id).length > 0 && <span className="rounded-full bg-amber-500/15 text-amber-500 px-1.5 text-[10px] font-mono" title="sem cliente ligado">{crm.contacts.filter((c) => !c.customer_id).length}</span>}</TabsTrigger>
            <TabsTrigger value="oportunidades" className="shrink-0 rounded-lg data-[state=active]:bg-primary/15 data-[state=active]:text-primary gap-1.5">Oportunidades {crm.nbaItems.length > 0 && <span className="rounded-full bg-primary/15 text-primary px-1.5 text-[10px] font-mono">{crm.nbaItems.length}</span>}</TabsTrigger>
            <TabsTrigger value="prospeccao" className="shrink-0 rounded-lg data-[state=active]:bg-primary/15 data-[state=active]:text-primary">Prospecção</TabsTrigger>
            <TabsTrigger value="motor" className="shrink-0 rounded-lg data-[state=active]:bg-primary/15 data-[state=active]:text-primary">Motor</TabsTrigger>
            <TabsTrigger value="operacao" className="shrink-0 rounded-lg data-[state=active]:bg-primary/15 data-[state=active]:text-primary">Operação</TabsTrigger>
          </TabsList>

          {/* CARTEIRA = Visão (Torre, agregado) + Clientes 360 (lista/kanban + detalhe) */}
          <TabsContent value="carteira" className="mt-0 space-y-3">
            <div className="flex flex-wrap items-center justify-end gap-2">
              {carteiraView === "clientes" && (
                <div className="inline-flex rounded-lg border border-border/50 bg-card/60 p-0.5">
                  <Button size="sm" variant={view === "list" ? "secondary" : "ghost"} className="h-7 gap-1.5 text-xs" onClick={() => changeView("list")}><List className="h-3.5 w-3.5" />Lista</Button>
                  <Button size="sm" variant={view === "kanban" ? "secondary" : "ghost"} className="h-7 gap-1.5 text-xs" onClick={() => changeView("kanban")}><LayoutGrid className="h-3.5 w-3.5" />Kanban</Button>
                </div>
              )}
              <div className="inline-flex rounded-lg border border-border/50 bg-card/60 p-0.5">
                <Button size="sm" variant={carteiraView === "clientes" ? "secondary" : "ghost"} className="h-7 gap-1.5 text-xs" onClick={() => setCarteiraView("clientes")}><Users className="h-3.5 w-3.5" />Clientes</Button>
                <Button size="sm" variant={carteiraView === "visao" ? "secondary" : "ghost"} className="h-7 gap-1.5 text-xs" onClick={() => setCarteiraView("visao")}><ShieldCheck className="h-3.5 w-3.5" />Visão</Button>
              </div>
            </div>
            {carteiraView === "visao" ? (
              <ServicingTower crm={crm} onSelectCustomer={selectCustomer} />
            ) : view === "kanban" ? (
              <CustomerKanban crm={crm} onSelect={selectCustomer} />
            ) : (
            <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.3fr)_minmax(360px,0.75fr)] gap-4">
          {/* LISTA (escondida no mobile só quando um cliente REAL está aberto — senão tela em branco) */}
          <Card className={cn(selected && "hidden xl:block")}>
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar cliente" className="pl-8 h-9" />
                </div>
                <Select value={healthFilter} onValueChange={setHealthFilter}><SelectTrigger className="h-9 w-[130px] text-xs"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Toda saúde</SelectItem><SelectItem value="green">Saudável</SelectItem><SelectItem value="yellow">Atenção</SelectItem><SelectItem value="red">Crítico</SelectItem></SelectContent></Select>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-border/50 xl:max-h-[70vh] xl:overflow-y-auto">
                {rows.map(({ c, rev, health }) => {
                  const h = HEALTH[health] ?? HEALTH.green;
                  return (
                    <button key={c.id} onClick={() => setSelectedId(c.id)} className={cn("w-full text-left px-3 py-2.5 hover:bg-muted/40 flex items-center gap-3", selectedId === c.id && "bg-primary/5")}>
                      <span className={cn("h-2 w-2 rounded-full shrink-0", h.dot)} />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">{c.nome} {!c.recorrente && <span className="text-[10px] text-amber-500">pontual</span>}</p>
                        <p className="text-[11px] text-muted-foreground">{STAGES.find((s) => s.id === (c.stage || "active"))?.label}{c.segment ? ` · ${c.segment}` : ""}{c.next_action_date ? ` · próxima ação ${dateBR(c.next_action_date)}` : ""}</p>
                      </div>
                      <span className="font-mono text-xs text-muted-foreground shrink-0">{brl(rev.monthly)}</span>
                    </button>
                  );
                })}
                {crm.isLoading && rows.length === 0 && <div className="p-3 space-y-2">{[...Array(6)].map((_, i) => <div key={i} className="h-12 rounded-lg bg-muted/40 animate-pulse" />)}</div>}
                {!crm.isLoading && rows.length === 0 && <p className="p-6 text-center text-sm text-muted-foreground">Nenhum cliente.</p>}
              </div>
            </CardContent>
          </Card>

          {/* DETALHE 360 */}
          {c360 && selected ? (
            <div>
              <Button variant="ghost" size="sm" className="xl:hidden mb-2 gap-1.5 h-8" onClick={() => setSelectedId(null)}><ChevronLeft className="h-4 w-4" />Voltar à lista</Button>
              <CustomerDetail key={selected.id} c360={c360} companyId={selectedCompanyId !== "all" ? selectedCompanyId : null} crm={crm} />
            </div>
          ) : (
            <Card className="hidden xl:block"><CardContent className="p-10 text-center text-sm text-muted-foreground">Selecione um cliente para ver o 360.</CardContent></Card>
          )}
        </div>
        )}
          </TabsContent>

          {/* CONTATOS = kanban de contatos (Bloco 3 troca por boards por segmento) */}
          {/* CONTATOS = kanban por segmento (padrão) + Lista (gestão: editar/excluir/ligar/360) */}
          <TabsContent value="contatos" className="mt-0 space-y-3">
            <div className="flex items-center justify-end">
              <div className="inline-flex rounded-lg border border-border/50 bg-card/60 p-0.5">
                <Button size="sm" variant={contatosView === "kanban" ? "secondary" : "ghost"} className="h-7 gap-1.5 text-xs" onClick={() => setContatosView("kanban")}><LayoutGrid className="h-3.5 w-3.5" />Kanban</Button>
                <Button size="sm" variant={contatosView === "lista" ? "secondary" : "ghost"} className="h-7 gap-1.5 text-xs" onClick={() => setContatosView("lista")}><List className="h-3.5 w-3.5" />Lista</Button>
              </div>
            </div>
            {contatosView === "kanban"
              ? <Suspense fallback={<LazyFallback />}><ContactBoards crm={crm} /></Suspense>
              : <ContactsTab crm={crm} onSelectCustomer={selectCustomer} />}
          </TabsContent>

          {/* OPORTUNIDADES = Fila · Kanban · Funil · Atividades · Expansão */}
          <TabsContent value="oportunidades" className="mt-0 space-y-3">
            <div className="flex flex-wrap items-center justify-end gap-2">
              {(oppView === "kanban" || oppView === "metricas") && <ModuloFilter value={moduloId} onChange={setModuloId} />}
              {oppView === "kanban" && <ModuloManager />}
              {oppView === "kanban" && <StageManager suggestedSegment={dominantSegment} />}
              <div className="inline-flex rounded-lg border border-border/50 bg-card/60 p-0.5">
                <Button size="sm" variant={oppView === "fila" ? "secondary" : "ghost"} className="h-7 gap-1.5 text-xs" onClick={() => setOppView("fila")}><List className="h-3.5 w-3.5" />Fila</Button>
                <Button size="sm" variant={oppView === "kanban" ? "secondary" : "ghost"} className="h-7 gap-1.5 text-xs" onClick={() => setOppView("kanban")}><LayoutGrid className="h-3.5 w-3.5" />Kanban</Button>
                <Button size="sm" variant={oppView === "metricas" ? "secondary" : "ghost"} className="h-7 gap-1.5 text-xs" onClick={() => setOppView("metricas")}><BarChart3 className="h-3.5 w-3.5" />Funil</Button>
                <Button size="sm" variant={oppView === "atividades" ? "secondary" : "ghost"} className="h-7 gap-1.5 text-xs" onClick={() => setOppView("atividades")}><CalendarClock className="h-3.5 w-3.5" />Atividades</Button>
                <Button size="sm" variant={oppView === "expansao" ? "secondary" : "ghost"} className="h-7 gap-1.5 text-xs" onClick={() => setOppView("expansao")}><TrendingUp className="h-3.5 w-3.5" />Expansão</Button>
              </div>
            </div>
            {oppView === "kanban" ? <DealKanban crm={crm} onSelect={selectCustomer} moduloId={moduloId} />
              : oppView === "metricas" ? <KanbanMetricsPanel crm={crm} moduloId={moduloId} />
              : oppView === "atividades" ? <AtividadesPanel crm={crm} />
              : oppView === "expansao" ? <ExpansaoBoard crm={crm} onSelectCustomer={selectCustomer} />
              : <OpportunityInbox crm={crm} onSelectCustomer={selectCustomer} />}
          </TabsContent>

          <TabsContent value="prospeccao" className="mt-0">
            <Suspense fallback={<LazyFallback />}><Prospecting /></Suspense>
          </TabsContent>

          {/* MOTOR = Ativos · Prova · Rotina · Campanhas */}
          <TabsContent value="motor" className="mt-0 space-y-3">
            <div className="flex items-center justify-end">
              <div className="inline-flex rounded-lg border border-border/50 bg-card/60 p-0.5">
                <Button size="sm" variant={motorView === "ativos" ? "secondary" : "ghost"} className="h-7 text-xs" onClick={() => setMotorView("ativos")}>Ativos</Button>
                <Button size="sm" variant={motorView === "prova" ? "secondary" : "ghost"} className="h-7 text-xs" onClick={() => setMotorView("prova")}>Prova</Button>
                <Button size="sm" variant={motorView === "rotina" ? "secondary" : "ghost"} className="h-7 text-xs" onClick={() => setMotorView("rotina")}>Rotina</Button>
                <Button size="sm" variant={motorView === "campanhas" ? "secondary" : "ghost"} className="h-7 text-xs" onClick={() => setMotorView("campanhas")}>Campanhas</Button>
              </div>
            </div>
            {motorView === "prova" ? <ProvaPanel crm={crm} />
              : motorView === "rotina" ? <RotinaSemanaPanel />
              : motorView === "campanhas" ? <Suspense fallback={<LazyFallback />}><CampaignManager crm={crm} /></Suspense>
              : <AtivosPanel crm={crm} />}
          </TabsContent>

          {/* OPERAÇÃO = Mapa · Rotas · Entrega */}
          <TabsContent value="operacao" className="mt-0 space-y-3">
            <div className="flex items-center justify-end">
              <div className="inline-flex rounded-lg border border-border/50 bg-card/60 p-0.5">
                <Button size="sm" variant={opsView === "mapa" ? "secondary" : "ghost"} className="h-7 text-xs" onClick={() => setOpsView("mapa")}>Mapa</Button>
                <Button size="sm" variant={opsView === "rotas" ? "secondary" : "ghost"} className="h-7 text-xs" onClick={() => setOpsView("rotas")}>Rotas</Button>
                <Button size="sm" variant={opsView === "entrega" ? "secondary" : "ghost"} className="h-7 text-xs" onClick={() => setOpsView("entrega")}>Entrega</Button>
              </div>
            </div>
            {opsView === "entrega"
              ? <Suspense fallback={<LazyFallback />}><AgileImplementation embedded /></Suspense>
              : opsView === "rotas"
                ? <Suspense fallback={<LazyFallback />}><VisitRoutesContent embedded /></Suspense>
                : <OperationalMapPanel title="Mapa da carteira" description="Clientes, projetos e tarefas num só mapa operacional." filterKinds={["client", "task", "project"]} height={540} />}
          </TabsContent>
        </Tabs>
      </motion.div>
    </EMSLayout>
  );
};

const TREND_ICON: Record<Trend, ReactNode> = {
  up: <TrendingUp className="h-3.5 w-3.5 text-emerald-400" />,
  down: <TrendingDown className="h-3.5 w-3.5 text-red-400" />,
  flat: <Minus className="h-3.5 w-3.5 text-muted-foreground" />,
};

const ScoreTile = ({ label, value, tone, hint }: { label: string; value: ReactNode; tone?: string; hint?: string }) => (
  <div className="rounded-lg border border-border/50 bg-background/40 p-2 text-center">
    <p className="text-[9px] text-muted-foreground uppercase tracking-wide">{label}</p>
    <p className={cn("font-mono text-sm font-bold leading-tight mt-0.5", tone)}>{value}</p>
    {hint && <p className="text-[9px] text-muted-foreground truncate">{hint}</p>}
  </div>
);

const CustomerDetail = ({ c360, companyId, crm }: { c360: Customer360; companyId: string | null; crm: ReturnType<typeof useCrm> }) => {
  const s = c360.spine;
  const sc = crm.scores.get(s.id) as CustomerScore | undefined;
  const onb = crm.onboardingByCustomer.get(s.id);
  // Etapas reais do funil (crm_stages) — deal novo nasce numa etapa DB-backed, não no vocabulário legado.
  const { stages: funnelStages } = useCrmStages();
  const onTrackStages = funnelStages.filter((x) => !x.is_offtrack);
  const firstStageKey = onTrackStages[0]?.key || "lista";
  const { modulos } = useCrmModulos();
  const { ativos } = useCrmAtivos();
  const [naDate, setNaDate] = useState(s.next_action_date || "");
  const [naDesc, setNaDesc] = useState(s.next_action_desc || "");
  const [intContact, setIntContact] = useState(c360.contatos[0]?.id || "");
  const [intType, setIntType] = useState("call");
  const [intDesc, setIntDesc] = useState("");
  const [showDeal, setShowDeal] = useState(false);
  const [deal, setDeal] = useState({ title: "", value: "", probability: "50", stage: firstStageKey, expected_close_date: "", contactId: "", moduloId: "", ativoOrigemId: "" });
  const [showTask, setShowTask] = useState(false);
  const [taskTitle, setTaskTitle] = useState("");
  const [taskContact, setTaskContact] = useState(c360.contatos[0]?.id || "");
  const [onbContact, setOnbContact] = useState(c360.contatos[0]?.id || "");
  const [showOnb, setShowOnb] = useState(false);
  const health = (companyId ? (s.health || sc?.health) : (sc?.health || s.health)) || "green";
  const h = HEALTH[health] ?? HEALTH.green;
  const dias = diasSemContato(c360, todayIso());
  const set = (patch: Partial<CustomerSpine>) => crm.updateCustomer.mutate({ id: s.id, patch });

  const contactIds = new Set(c360.contatos.map((p) => p.id));
  const clientTasks = crm.tasks.filter((t) => t.contact_id && contactIds.has(t.contact_id));
  const dealProjectIds = new Set(c360.deals.map((d) => d.project_id).filter(Boolean));
  const clientProjects = crm.projects.filter((p) => dealProjectIds.has(p.id));
  const clientTxns = crm.transactions.filter((t) => t.cliente_id === s.id).slice().sort((a, b) => (b.date || "").localeCompare(a.date || "")).slice(0, 6);

  const openDealForm = (title = "") => { setDeal((d) => ({ ...d, title })); setShowDeal(true); };
  const submitDeal = () => {
    if (!deal.title.trim()) return;
    crm.createDeal.mutate(
      { customerId: s.id, title: deal.title, value: deal.value, probability: deal.probability, stage: deal.stage || firstStageKey, expected_close_date: deal.expected_close_date || null, contactId: deal.contactId || null, moduloId: deal.moduloId || null, ativoOrigemId: deal.ativoOrigemId || null },
      { onSuccess: () => { setShowDeal(false); setDeal({ title: "", value: "", probability: "50", stage: firstStageKey, expected_close_date: "", contactId: "", moduloId: "", ativoOrigemId: "" }); } },
    );
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center justify-between gap-2">
          <span className="flex items-center gap-2"><span className={cn("h-2.5 w-2.5 rounded-full", h.dot)} />{s.nome}</span>
          <span className={cn("text-[11px] flex items-center gap-1.5", h.cls)}>{sc && <span className="font-mono">{sc.healthScore}</span>}{h.label}</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 xl:max-h-[70vh] xl:overflow-y-auto">
        {/* Estágio / saúde / prioridade */}
        <div className="grid grid-cols-3 gap-2">
          <div><Label className="text-[10px] text-muted-foreground">Estágio</Label><Select value={s.stage || "active"} onValueChange={(v) => set({ stage: v })}><SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger><SelectContent>{STAGES.map((x) => <SelectItem key={x.id} value={x.id}>{x.label}</SelectItem>)}</SelectContent></Select></div>
          <div><Label className="text-[10px] text-muted-foreground">Saúde <span className="text-muted-foreground/60">(auto)</span></Label><div className={cn("h-8 rounded-md border border-border/50 bg-background/40 flex items-center gap-1.5 px-2 text-xs", h.cls)}><span className={cn("h-2 w-2 rounded-full shrink-0", h.dot)} /><span className="truncate">{h.label}</span>{sc && <span className="text-muted-foreground ml-auto font-mono">{sc.healthScore}</span>}</div></div>
          <div><Label className="text-[10px] text-muted-foreground">Prioridade</Label><Select value={s.priority || "medium"} onValueChange={(v) => set({ priority: v })}><SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="low">Baixa</SelectItem><SelectItem value="medium">Média</SelectItem><SelectItem value="high">Alta</SelectItem></SelectContent></Select></div>
        </div>

        {/* Scorecard calculado */}
        {sc && (
          <div className="rounded-lg border border-border/50 p-2.5 space-y-2">
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5"><HeartPulse className="h-3.5 w-3.5" />Scorecard <span className="normal-case font-normal text-[10px]">(calculado dos sinais reais)</span></p>
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              <ScoreTile label="Saúde" value={sc.healthScore} tone={h.cls} />
              <ScoreTile label="Churn" value={`${sc.churnRisk}`} tone={sc.churnRisk >= 50 ? "text-red-400" : sc.churnRisk >= 25 ? "text-amber-400" : "text-emerald-400"} />
              <ScoreTile label="Engaj." value={sc.engagement} tone={sc.engagement >= 60 ? "text-emerald-400" : "text-muted-foreground"} />
              <ScoreTile label="Expansão" value={sc.expansionPropensity} tone={sc.expansionPropensity >= 50 ? "text-primary" : "text-muted-foreground"} />
              <ScoreTile label="Receita" value={<span className="flex items-center justify-center gap-1">{TREND_ICON[sc.revenueTrend]}</span>} hint={TREND_LABEL[sc.revenueTrend]} />
              <ScoreTile label="LTV" value={brl(sc.ltv)} />
              <ScoreTile label="Tempo" value={sc.tenureMonths != null ? `${sc.tenureMonths}m` : "—"} hint="de casa" />
              <ScoreTile label="Sem contato" value={sc.recencyDias != null ? `${sc.recencyDias}d` : "—"} tone={(sc.recencyDias ?? 0) > 30 ? "text-amber-400" : ""} />
            </div>
            {sc.reasons.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {sc.reasons.map((r, idx) => <Badge key={idx} variant="outline" className="text-[9px] font-normal">{r}</Badge>)}
              </div>
            )}
          </div>
        )}

        {/* Próxima melhor oferta */}
        {sc?.nextOffer && (
          <div className="rounded-lg border border-primary/25 bg-primary/5 p-2.5 flex items-center gap-2">
            <Gift className="h-4 w-4 text-primary shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-[10px] text-primary uppercase tracking-wide">{OFERTA_LABEL[sc.nextOffer.tipo]}</p>
              <p className="text-xs truncate">{sc.nextOffer.titulo}</p>
            </div>
            <Button size="sm" variant="outline" className="h-7 text-xs shrink-0" onClick={() => openDealForm()}>Criar deal</Button>
          </div>
        )}

        {/* Receita */}
        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-2"><p className="text-[10px] text-muted-foreground flex items-center gap-1"><Repeat className="h-3 w-3" />MRR (recorrente)</p><p className="font-mono font-bold text-emerald-400">{brl(c360.ongoing)}</p></div>
          <div className="rounded-lg border border-border/50 p-2"><p className="text-[10px] text-muted-foreground">Run-rate/mês</p><p className="font-mono font-bold">{brl(c360.monthly)}</p></div>
          <div className="rounded-lg border border-primary/20 bg-primary/5 p-2"><p className="text-[10px] text-muted-foreground flex items-center gap-1"><Target className="h-3 w-3" />Forecast deals</p><p className="font-mono font-bold text-primary">{brl(c360.forecastPonderado)}</p></div>
        </div>

        {/* Onboarding / KYC */}
        {onb && onb.total > 0 && (
          <div className="rounded-lg border border-border/50 p-2.5 space-y-1.5">
            <p className="text-xs font-medium flex items-center justify-between gap-1.5">
              <span className="flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5" />Onboarding / KYC</span>
              <span className="text-[10px] text-muted-foreground font-mono">{onb.completeness == null ? "não iniciado" : `${onb.completed}/${onb.total} passos`}</span>
            </p>
            <div className="h-1.5 rounded-full bg-muted overflow-hidden">
              <div className={cn("h-full rounded-full", onb.completeness === 1 ? "bg-emerald-500" : "bg-primary")} style={{ width: `${Math.round((onb.completeness ?? 0) * 100)}%` }} />
            </div>
            {onb.pendentes > 0 && <p className="text-[10px] text-amber-500">{onb.pendentes} passo(s) pendente(s)</p>}
            {c360.contatos.length > 0 && (
              <div className="pt-1 space-y-2">
                <div className="flex items-center gap-2">
                  <Select value={onbContact} onValueChange={setOnbContact}><SelectTrigger className="h-7 text-xs flex-1"><SelectValue placeholder="Contato" /></SelectTrigger><SelectContent>{c360.contatos.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent></Select>
                  <Button size="sm" variant="outline" className="h-7 text-xs shrink-0" onClick={() => setShowOnb((v) => !v)}>{showOnb ? "Fechar" : "Gerenciar"}</Button>
                </div>
                {showOnb && onbContact && <OnboardingPanel contactId={onbContact} />}
              </div>
            )}
          </div>
        )}

        {/* Próxima ação */}
        <div className="rounded-lg border border-border/50 p-2.5 space-y-2">
          <p className="text-xs font-medium flex items-center gap-1.5"><CalendarClock className="h-3.5 w-3.5" />Próxima ação {dias != null && <span className="text-[10px] text-muted-foreground">· {dias}d sem contato</span>}</p>
          <div className="flex gap-2">
            <Input type="date" value={naDate} onChange={(e) => setNaDate(e.target.value)} className="h-8 w-[150px] text-xs" />
            <Input value={naDesc} onChange={(e) => setNaDesc(e.target.value)} placeholder="O que fazer" className="h-8 flex-1 text-xs" />
            <Button size="sm" variant="outline" className="h-8" onClick={() => set({ next_action_date: naDate || null, next_action_desc: naDesc || null })}>Salvar</Button>
          </div>
        </div>

        {/* Rede de relacionamento */}
        {(c360.contatos.length > 0 || c360.deals.length > 0) && (
          <Section title="Rede de relacionamento">
            <RelationshipNetwork nome={s.nome} contatos={c360.contatos.map((p) => p.name)} deals={c360.deals.map((d) => d.title)} />
          </Section>
        )}

        {/* Contatos */}
        <Section title={`Contatos (${c360.contatos.length})`}>
          {c360.contatos.map((p) => (
            <div key={p.id} className="flex items-center gap-2 text-sm py-1"><Briefcase className="h-3.5 w-3.5 text-muted-foreground shrink-0" /><span className="flex-1 truncate">{p.name}</span>{p.phone && <Phone className="h-3 w-3 text-muted-foreground" />}{p.email && <Mail className="h-3 w-3 text-muted-foreground" />}</div>
          ))}
          {c360.contatos.length === 0 && <p className="text-xs text-muted-foreground">Nenhum contato ligado. Ligue contatos ao cliente na aba <b>Contatos</b>.</p>}
        </Section>

        {/* Deals */}
        <Section title={`Deals abertos (${c360.dealsAbertos})`}>
          <div className="flex items-center justify-end -mt-6 mb-1">
            <Button size="sm" variant="ghost" className="h-6 text-[11px] gap-1" onClick={() => openDealForm()}><Plus className="h-3 w-3" />Novo deal</Button>
          </div>
          {showDeal && (
            <div className="rounded-lg border border-primary/20 bg-primary/5 p-2 space-y-2 mb-2">
              <Input value={deal.title} onChange={(e) => setDeal({ ...deal, title: e.target.value })} placeholder="Título do deal" className="h-8 text-xs" />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <Input value={deal.value} onChange={(e) => setDeal({ ...deal, value: e.target.value })} placeholder="Valor R$" inputMode="numeric" className="h-8 text-xs" />
                <Input value={deal.probability} onChange={(e) => setDeal({ ...deal, probability: e.target.value })} placeholder="Prob %" inputMode="numeric" className="h-8 text-xs" />
                <Select value={deal.stage} onValueChange={(v) => setDeal({ ...deal, stage: v })}><SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger><SelectContent>{onTrackStages.map((x) => <SelectItem key={x.key} value={x.key}>{x.title}</SelectItem>)}</SelectContent></Select>
                <Input type="date" value={deal.expected_close_date} onChange={(e) => setDeal({ ...deal, expected_close_date: e.target.value })} className="h-8 text-xs" />
              </div>
              {c360.contatos.length > 0 && (
                <Select value={deal.contactId || "none"} onValueChange={(v) => setDeal({ ...deal, contactId: v === "none" ? "" : v })}><SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Contato (opcional)" /></SelectTrigger><SelectContent><SelectItem value="none">Sem contato</SelectItem>{c360.contatos.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent></Select>
              )}
              {modulos.length > 0 && (
                <Select value={deal.moduloId || "none"} onValueChange={(v) => setDeal({ ...deal, moduloId: v === "none" ? "" : v })}><SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Módulo (opcional)" /></SelectTrigger><SelectContent><SelectItem value="none">Sem módulo</SelectItem>{modulos.map((m) => <SelectItem key={m.id} value={m.id!}>{m.name}</SelectItem>)}</SelectContent></Select>
              )}
              {ativos.length > 0 && (
                <Select value={deal.ativoOrigemId || "none"} onValueChange={(v) => setDeal({ ...deal, ativoOrigemId: v === "none" ? "" : v })}><SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Ativo de origem (opcional)" /></SelectTrigger><SelectContent><SelectItem value="none">Sem ativo de origem</SelectItem>{ativos.map((a) => <SelectItem key={a.id} value={a.id!}>{a.titulo}</SelectItem>)}</SelectContent></Select>
              )}
              <div className="flex justify-end gap-2">
                <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setShowDeal(false)}>Cancelar</Button>
                <Button size="sm" className="h-7 text-xs" disabled={!deal.title.trim() || crm.createDeal.isPending} onClick={submitDeal}>Salvar deal</Button>
              </div>
            </div>
          )}
          {c360.deals.map((d) => (
            <div key={d.id} className="flex items-center justify-between gap-2 text-sm py-1"><span className="truncate">{d.title} <span className="text-[10px] text-muted-foreground">· {d.stage}</span></span><span className="font-mono text-xs">{brl(Number(d.value) || 0)}{d.probability != null ? ` · ${d.probability}%` : ""}</span></div>
          ))}
          {c360.deals.length === 0 && !showDeal && <p className="text-xs text-muted-foreground">Sem deals. Use <b>Novo deal</b> pra abrir um.</p>}
        </Section>

        {/* Projetos do cliente (via deals com projeto) */}
        {clientProjects.length > 0 && (
          <Section title={`Projetos (${clientProjects.length})`}>
            {clientProjects.map((p) => (
              <div key={p.id} className="flex items-center justify-between gap-2 text-sm py-1">
                <span className="truncate">{p.title} <span className="text-[10px] text-muted-foreground">· {p.status}</span></span>
                {p.next_invoice_date && <span className="text-[10px] text-muted-foreground shrink-0">fatura {dateBR(p.next_invoice_date)}</span>}
              </div>
            ))}
          </Section>
        )}

        {/* Tarefas do cliente (tasks ligadas aos contatos) */}
        <Section title={`Tarefas abertas (${clientTasks.length})`}>
          <div className="flex items-center justify-end -mt-6 mb-1">
            <Button size="sm" variant="ghost" className="h-6 text-[11px] gap-1" onClick={() => setShowTask((v) => !v)}><Plus className="h-3 w-3" />Nova</Button>
          </div>
          {showTask && (
            <div className="rounded-lg border border-primary/20 bg-primary/5 p-2 space-y-2 mb-2">
              <Input value={taskTitle} onChange={(e) => setTaskTitle(e.target.value)} placeholder="O que fazer" className="h-8 text-xs" />
              <div className="flex gap-2">
                {c360.contatos.length > 0 && (
                  <Select value={taskContact} onValueChange={setTaskContact}><SelectTrigger className="h-8 text-xs flex-1"><SelectValue placeholder="Contato" /></SelectTrigger><SelectContent>{c360.contatos.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent></Select>
                )}
                <Button size="sm" className="h-8 text-xs" disabled={!taskTitle.trim() || crm.createTask.isPending} onClick={() => crm.createTask.mutate({ title: taskTitle, contactId: taskContact || null }, { onSuccess: () => { setTaskTitle(""); setShowTask(false); } })}>Salvar</Button>
              </div>
            </div>
          )}
          {clientTasks.map((t) => (
            <div key={t.id} className="flex items-center justify-between gap-2 text-sm py-1">
              <span className="truncate">{t.title}</span>
              {t.due_date && <span className={cn("text-[10px] shrink-0", t.due_date < todayIso() ? "text-red-400" : "text-muted-foreground")}>{dateBR(t.due_date)}</span>}
            </div>
          ))}
          {clientTasks.length === 0 && !showTask && <p className="text-xs text-muted-foreground">Sem tarefas abertas.</p>}
        </Section>

        {/* Financeiro (últimas transações do cliente) */}
        {clientTxns.length > 0 && (
          <Section title="Financeiro (últimas)">
            {clientTxns.map((t) => (
              <div key={t.id} className="flex items-center justify-between gap-2 text-xs py-1">
                <span className="text-muted-foreground shrink-0 w-14">{dateBR(t.date)}</span>
                <span className="flex-1 truncate">{t.description || (t.type === "income" ? "Entrada" : "Saída")}</span>
                <span className={cn("font-mono shrink-0", t.type === "income" ? "text-emerald-400" : "text-muted-foreground")}>{t.type === "income" ? "+" : "−"}{brl(Number(t.amount) || 0)}</span>
              </div>
            ))}
          </Section>
        )}

        {/* Rotinas */}
        {c360.rotinas.length > 0 && (
          <Section title={`Rotinas (${c360.rotinas.length})`}>
            {c360.rotinas.map((r) => <p key={r.id} className="text-sm py-0.5">{r.name}</p>)}
          </Section>
        )}

        {/* Timeline de interações + registrar */}
        <Section title="Histórico">
          {c360.contatos.length > 0 && (
            <div className="flex gap-2 mb-2">
              <Select value={intContact} onValueChange={setIntContact}><SelectTrigger className="h-8 w-[120px] text-xs"><SelectValue placeholder="Contato" /></SelectTrigger><SelectContent>{c360.contatos.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent></Select>
              <Select value={intType} onValueChange={setIntType}><SelectTrigger className="h-8 w-[100px] text-xs"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="call">Ligação</SelectItem><SelectItem value="meeting">Reunião</SelectItem><SelectItem value="email">Email</SelectItem><SelectItem value="note">Nota</SelectItem></SelectContent></Select>
              <Input value={intDesc} onChange={(e) => setIntDesc(e.target.value)} placeholder="Resumo" className="h-8 flex-1 text-xs" />
              <Button size="sm" className="h-8" disabled={!intContact || !intDesc.trim()} onClick={() => crm.addInteraction.mutate({ contact_id: intContact, type: intType, description: intDesc.trim() }, { onSuccess: () => setIntDesc("") })}><Plus className="h-3.5 w-3.5" /></Button>
            </div>
          )}
          <div className="space-y-1">
            {c360.interacoes.slice(0, 15).map((i) => (
              <div key={i.id} className="text-xs flex gap-2"><span className="text-muted-foreground shrink-0 w-16">{dateBR(i.date)}</span><Badge variant="outline" className="text-[9px] shrink-0">{i.type}</Badge><span className="truncate">{i.description}</span></div>
            ))}
            {c360.interacoes.length === 0 && <p className="text-xs text-muted-foreground">Sem histórico ainda.</p>}
          </div>
        </Section>

        {/* Documentos / KYC */}
        <Section title="Documentos / KYC">
          <AttachmentManager entityType="client" entityId={s.id} companyId={companyId} title="" />
        </Section>
      </CardContent>
    </Card>
  );
};

const Section = ({ title, children }: { title: string; children: ReactNode }) => (
  <div className="rounded-lg border border-border/40 p-2.5">
    <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">{title}</p>
    {children}
  </div>
);

// Rede de relacionamento — SVG leve: cliente no centro, contatos à esquerda, deals à direita.
// Adaptação do "network graph" das telas de referência, sem lib de grafo.
const RelationshipNetwork = ({ nome, contatos, deals }: { nome: string; contatos: string[]; deals: string[] }) => {
  const trunc = (s: string, n = 16) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);
  const cx = 160, cy = 90;
  const col = (items: string[], x: number) => {
    const n = items.length;
    return items.map((label, i) => ({ label, x, y: n === 1 ? cy : 24 + (i * (132 / Math.max(1, n - 1))) }));
  };
  const left = col(contatos.slice(0, 5), 34);
  const right = col(deals.slice(0, 5), 286);
  return (
    <div className="w-full overflow-x-auto">
      <svg viewBox="0 0 320 180" className="w-full max-w-[420px] h-[160px] mx-auto" role="img" aria-label="Rede de relacionamento">
        {[...left, ...right].map((p, i) => (
          <line key={`l${i}`} x1={cx} y1={cy} x2={p.x} y2={p.y} className="stroke-border" strokeWidth={1} />
        ))}
        {left.map((p, i) => (
          <g key={`c${i}`}>
            <circle cx={p.x} cy={p.y} r={5} className="fill-emerald-500/70" />
            <text x={p.x + 9} y={p.y + 3} className="fill-muted-foreground" fontSize={8} textAnchor="start">{trunc(p.label, 12)}</text>
          </g>
        ))}
        {right.map((p, i) => (
          <g key={`d${i}`}>
            <circle cx={p.x} cy={p.y} r={5} className="fill-primary/70" />
            <text x={p.x - 9} y={p.y + 3} className="fill-muted-foreground" fontSize={8} textAnchor="end">{trunc(p.label, 12)}</text>
          </g>
        ))}
        <circle cx={cx} cy={cy} r={22} className="fill-primary/15 stroke-primary/40" strokeWidth={1.5} />
        <text x={cx} y={cy + 3} className="fill-foreground" fontSize={9} fontWeight="600" textAnchor="middle">{trunc(nome, 12)}</text>
      </svg>
      <p className="text-[10px] text-muted-foreground flex items-center justify-center gap-3 -mt-1">
        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-500/70" />{contatos.length} contato(s)</span>
        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-primary/70" />{deals.length} deal(s)</span>
      </p>
    </div>
  );
};

export default Crm;
