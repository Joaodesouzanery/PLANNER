import { useMemo, useState, type ReactNode } from "react";
import { useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { Users, Search, Phone, Mail, Briefcase, Repeat, CalendarClock, Plus, Target } from "lucide-react";
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
import { useCrm } from "@/components/ems/crm/useCrm";
import { OpportunityInbox } from "@/components/ems/crm/OpportunityInbox";
import { ServicingTower } from "@/components/ems/crm/ServicingTower";
import { buildCustomer360, diasSemContato, type CustomerSpine, type Customer360 } from "@/components/ems/crm/crm360";

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

const Crm = () => {
  const crm = useCrm();
  const { selectedCompanyId } = useCompany();
  const [searchParams] = useSearchParams();
  const [selectedId, setSelectedId] = useState<string | null>(searchParams.get("client"));
  const [tab, setTab] = useState(searchParams.get("tab") || "clientes");
  const [search, setSearch] = useState("");
  const [healthFilter, setHealthFilter] = useState("all");
  const selectCustomer = (id: string) => { setSelectedId(id); setTab("clientes"); };

  const rows = useMemo(() =>
    crm.customers
      .map((c) => ({ c, rev: crm.revenueByCustomer.get(c.id) ?? { monthly: 0, ongoing: 0 } }))
      .filter(({ c }) => (healthFilter === "all" || (c.health || "green") === healthFilter) && (!search || c.nome.toLowerCase().includes(search.toLowerCase())))
      .sort((a, b) => b.rev.monthly - a.rev.monthly),
    [crm.customers, crm.revenueByCustomer, healthFilter, search],
  );

  const selected = selectedId ? crm.customers.find((c) => c.id === selectedId) ?? null : null;
  const c360 = useMemo(
    () => (selected ? buildCustomer360(selected, crm.revenueByCustomer.get(selected.id) ?? { monthly: 0, ongoing: 0 }, crm.contacts, crm.deals, crm.routines, crm.interactions) : null),
    [selected, crm.revenueByCustomer, crm.contacts, crm.deals, crm.routines, crm.interactions],
  );

  const mrrTotal = rows.reduce((a, r) => a + r.rev.ongoing, 0);

  return (
    <EMSLayout>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h1 className="text-2xl md:text-3xl font-heading font-bold flex items-center gap-2">
              <div className="p-2 rounded-xl bg-primary/10"><Users className="h-6 w-6 text-primary" /></div>
              CRM — Clientes 360
            </h1>
            <p className="text-muted-foreground mt-1 text-sm">Cada cliente num lugar só: receita, contatos, deals, rotinas, documentos e histórico.</p>
          </div>
          <div className="text-right hidden sm:block">
            <p className="font-mono text-lg font-bold text-primary">{brl(mrrTotal)}<span className="text-xs text-muted-foreground font-normal">/mês</span></p>
            <p className="text-[10px] text-muted-foreground">{crm.customers.length} clientes · receita recorrente</p>
          </div>
        </div>

        {crm.missing && !crm.isLoading && (
          <Card className="border-amber-500/30 bg-amber-500/5"><CardContent className="p-4 text-sm text-amber-400">Nenhum cliente ainda — cadastre clientes nas Transações (campo Cliente) ou aplique a migration <code>20260713120000_crm_customer_spine.sql</code>.</CardContent></Card>
        )}

        <Tabs value={tab} onValueChange={setTab} className="space-y-4">
          <TabsList className="bg-card/80 border border-border/50 rounded-xl">
            <TabsTrigger value="clientes" className="rounded-lg data-[state=active]:bg-primary/15 data-[state=active]:text-primary">Clientes 360</TabsTrigger>
            <TabsTrigger value="oportunidades" className="rounded-lg data-[state=active]:bg-primary/15 data-[state=active]:text-primary gap-1.5">Oportunidades {crm.nbaItems.length > 0 && <span className="rounded-full bg-primary/15 text-primary px-1.5 text-[10px] font-mono">{crm.nbaItems.length}</span>}</TabsTrigger>
            <TabsTrigger value="torre" className="rounded-lg data-[state=active]:bg-primary/15 data-[state=active]:text-primary">Torre</TabsTrigger>
          </TabsList>

          <TabsContent value="oportunidades" className="mt-0">
            <OpportunityInbox crm={crm} onSelectCustomer={selectCustomer} />
          </TabsContent>

          <TabsContent value="torre" className="mt-0">
            <ServicingTower crm={crm} onSelectCustomer={selectCustomer} />
          </TabsContent>

          <TabsContent value="clientes" className="mt-0">
        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.3fr)_minmax(360px,0.75fr)] gap-4">
          {/* LISTA */}
          <Card>
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
              <div className="divide-y divide-border/50 max-h-[70vh] overflow-y-auto">
                {rows.map(({ c, rev }) => {
                  const h = HEALTH[c.health || "green"] ?? HEALTH.green;
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
                {rows.length === 0 && <p className="p-6 text-center text-sm text-muted-foreground">Nenhum cliente.</p>}
              </div>
            </CardContent>
          </Card>

          {/* DETALHE 360 */}
          {c360 && selected ? (
            <CustomerDetail c360={c360} companyId={selectedCompanyId !== "all" ? selectedCompanyId : null} crm={crm} />
          ) : (
            <Card><CardContent className="p-10 text-center text-sm text-muted-foreground">Selecione um cliente para ver o 360.</CardContent></Card>
          )}
        </div>
          </TabsContent>
        </Tabs>
      </motion.div>
    </EMSLayout>
  );
};

const CustomerDetail = ({ c360, companyId, crm }: { c360: Customer360; companyId: string | null; crm: ReturnType<typeof useCrm> }) => {
  const s = c360.spine;
  const [naDate, setNaDate] = useState(s.next_action_date || "");
  const [naDesc, setNaDesc] = useState(s.next_action_desc || "");
  const [intContact, setIntContact] = useState(c360.contatos[0]?.id || "");
  const [intType, setIntType] = useState("call");
  const [intDesc, setIntDesc] = useState("");
  const h = HEALTH[s.health || "green"] ?? HEALTH.green;
  const dias = diasSemContato(c360, todayIso());
  const set = (patch: Partial<CustomerSpine>) => crm.updateCustomer.mutate({ id: s.id, patch });

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center justify-between gap-2">
          <span className="flex items-center gap-2"><span className={cn("h-2.5 w-2.5 rounded-full", h.dot)} />{s.nome}</span>
          <span className={cn("text-[11px]", h.cls)}>{h.label}</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 max-h-[70vh] overflow-y-auto">
        {/* Estágio / saúde / prioridade */}
        <div className="grid grid-cols-3 gap-2">
          <div><Label className="text-[10px] text-muted-foreground">Estágio</Label><Select value={s.stage || "active"} onValueChange={(v) => set({ stage: v })}><SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger><SelectContent>{STAGES.map((x) => <SelectItem key={x.id} value={x.id}>{x.label}</SelectItem>)}</SelectContent></Select></div>
          <div><Label className="text-[10px] text-muted-foreground">Saúde</Label><Select value={s.health || "green"} onValueChange={(v) => set({ health: v })}><SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="green">Saudável</SelectItem><SelectItem value="yellow">Atenção</SelectItem><SelectItem value="red">Crítico</SelectItem></SelectContent></Select></div>
          <div><Label className="text-[10px] text-muted-foreground">Prioridade</Label><Select value={s.priority || "medium"} onValueChange={(v) => set({ priority: v })}><SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="low">Baixa</SelectItem><SelectItem value="medium">Média</SelectItem><SelectItem value="high">Alta</SelectItem></SelectContent></Select></div>
        </div>

        {/* Receita */}
        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-2"><p className="text-[10px] text-muted-foreground flex items-center gap-1"><Repeat className="h-3 w-3" />MRR (recorrente)</p><p className="font-mono font-bold text-emerald-400">{brl(c360.ongoing)}</p></div>
          <div className="rounded-lg border border-border/50 p-2"><p className="text-[10px] text-muted-foreground">Run-rate/mês</p><p className="font-mono font-bold">{brl(c360.monthly)}</p></div>
          <div className="rounded-lg border border-primary/20 bg-primary/5 p-2"><p className="text-[10px] text-muted-foreground flex items-center gap-1"><Target className="h-3 w-3" />Forecast deals</p><p className="font-mono font-bold text-primary">{brl(c360.forecastPonderado)}</p></div>
        </div>

        {/* Próxima ação */}
        <div className="rounded-lg border border-border/50 p-2.5 space-y-2">
          <p className="text-xs font-medium flex items-center gap-1.5"><CalendarClock className="h-3.5 w-3.5" />Próxima ação {dias != null && <span className="text-[10px] text-muted-foreground">· {dias}d sem contato</span>}</p>
          <div className="flex gap-2">
            <Input type="date" value={naDate} onChange={(e) => setNaDate(e.target.value)} className="h-8 w-[150px] text-xs" />
            <Input value={naDesc} onChange={(e) => setNaDesc(e.target.value)} placeholder="O que fazer" className="h-8 flex-1 text-xs" />
            <Button size="sm" variant="outline" className="h-8" onClick={() => set({ next_action_date: naDate || null, next_action_desc: naDesc || null })}>Salvar</Button>
          </div>
        </div>

        {/* Contatos */}
        <Section title={`Contatos (${c360.contatos.length})`}>
          {c360.contatos.map((p) => (
            <div key={p.id} className="flex items-center gap-2 text-sm py-1"><Briefcase className="h-3.5 w-3.5 text-muted-foreground shrink-0" /><span className="flex-1 truncate">{p.name}</span>{p.phone && <Phone className="h-3 w-3 text-muted-foreground" />}{p.email && <Mail className="h-3 w-3 text-muted-foreground" />}</div>
          ))}
          {c360.contatos.length === 0 && <p className="text-xs text-muted-foreground">Nenhum contato ligado. Ligue contatos ao cliente em Comercial.</p>}
        </Section>

        {/* Deals */}
        <Section title={`Deals abertos (${c360.dealsAbertos})`}>
          {c360.deals.map((d) => (
            <div key={d.id} className="flex items-center justify-between gap-2 text-sm py-1"><span className="truncate">{d.title} <span className="text-[10px] text-muted-foreground">· {d.stage}</span></span><span className="font-mono text-xs">{brl(Number(d.value) || 0)}{d.probability != null ? ` · ${d.probability}%` : ""}</span></div>
          ))}
          {c360.deals.length === 0 && <p className="text-xs text-muted-foreground">Sem deals. (Wire de pipeline vem na Fase 2.)</p>}
        </Section>

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

export default Crm;
