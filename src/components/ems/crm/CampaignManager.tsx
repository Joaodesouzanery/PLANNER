import { useMemo, useState } from "react";
import { Megaphone, Plus, Trash2, Sparkles, Users, Target, TrendingUp, Send } from "lucide-react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import { PIE_COLORS, tooltipStyle } from "@/components/ems/finance/useFinanceData";
import type { useCrm } from "./useCrm";
import { useCampaigns, type Campaign } from "./useCampaigns";
import { resolveSegment, campaignPerformance, groupCount, STATUS_LABEL, CHANNEL_LABEL, CAMPAIGN_STATUS_LABEL, type SegmentFilter, type SegCustomer } from "./crmCampaigns";
import { streamComercialAI } from "./aiMessage";

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const pct = (v: number) => `${Math.round(v * 100)}%`;

const STATUS_STYLE: Record<string, string> = {
  pending: "bg-muted/50 text-muted-foreground border-border",
  sent: "bg-blue-500/10 text-blue-400 border-blue-500/30",
  opened: "bg-amber-500/10 text-amber-500 border-amber-500/30",
  responded: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
  converted: "bg-emerald-600/20 text-emerald-300 border-emerald-500/40",
};
const STATUS_ORDER = ["pending", "sent", "opened", "responded", "converted"];
const CHANNELS = ["email", "whatsapp", "call", "linkedin"];

const chip = (active: boolean) => cn("cursor-pointer text-[11px]", active ? "" : "opacity-60 hover:opacity-100");

export const CampaignManager = ({ crm }: { crm: ReturnType<typeof useCrm> }) => {
  const cm = useCampaigns();
  const [view, setView] = useState<"campanhas" | "segmentos">("campanhas");
  const [selId, setSelId] = useState<string | null>(null);
  const [showNewCamp, setShowNewCamp] = useState(false);
  const [campForm, setCampForm] = useState({ name: "", objective: "", channel: "email", segment_id: "" });
  const [gen, setGen] = useState(false);

  // segment builder
  const [segName, setSegName] = useState("");
  const [filters, setFilters] = useState<SegmentFilter>({});

  const nameById = useMemo(() => new Map(crm.customers.map((c) => [c.id, c.nome])), [crm.customers]);
  const tierById = useMemo(() => new Map(crm.customers.map((c) => [c.id, c.tier || "—"])), [crm.customers]);

  const segCustomers: SegCustomer[] = useMemo(() => crm.customers.map((c) => ({
    id: c.id,
    health: crm.scores.get(c.id)?.health || c.health || "green",
    stage: c.stage, tier: c.tier, segment: c.segment,
    recorrente: c.recorrente,
    ongoing: crm.revenueByCustomer.get(c.id)?.ongoing ?? 0,
  })), [crm.customers, crm.scores, crm.revenueByCustomer]);

  const distinct = (pick: (c: typeof crm.customers[number]) => string | null | undefined) =>
    [...new Set(crm.customers.map(pick).filter(Boolean))] as string[];
  const tiers = distinct((c) => c.tier);
  const segments = distinct((c) => c.segment);

  const previewIds = useMemo(() => resolveSegment(segCustomers, filters), [segCustomers, filters]);

  const toggle = (key: "health" | "tier" | "segment", val: string) =>
    setFilters((f) => {
      const cur = f[key] || [];
      return { ...f, [key]: cur.includes(val) ? cur.filter((x) => x !== val) : [...cur, val] };
    });

  const saveSegment = () => {
    if (!segName.trim()) return;
    cm.createSegment.mutate({ name: segName, filters }, { onSuccess: () => { setSegName(""); setFilters({}); } });
  };

  const createCampaign = () => {
    if (!campForm.name.trim() || !campForm.segment_id) { toast({ title: "Dê um nome e escolha um segmento", variant: "destructive" }); return; }
    const seg = cm.segments.find((s) => s.id === campForm.segment_id);
    const ids = seg ? resolveSegment(segCustomers, seg.filters || {}) : [];
    const recipients = ids.map((id) => {
      const sc = crm.scores.get(id);
      const rev = crm.revenueByCustomer.get(id);
      const contact = crm.contacts.find((ct) => ct.customer_id === id);
      const predicted = rev?.ongoing ? Math.round(rev.ongoing * 12) : Math.round(rev?.monthly ?? 0);
      return { customer_id: id, contact_id: contact?.id ?? null, offer_status: "pending", propensity: sc?.expansionPropensity ?? null, predicted_revenue: predicted };
    });
    cm.createCampaign.mutate(
      { name: campForm.name, objective: campForm.objective || null, channel: campForm.channel, status: "draft", segment_id: campForm.segment_id, recipients },
      { onSuccess: (id: any) => { setShowNewCamp(false); setCampForm({ name: "", objective: "", channel: "email", segment_id: "" }); if (typeof id === "string") setSelId(id); } },
    );
  };

  const selected = selId ? cm.campaigns.find((c) => c.id === selId) : null;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="inline-flex rounded-lg border border-border/50 bg-card/60 p-0.5">
          <Button size="sm" variant={view === "campanhas" ? "secondary" : "ghost"} className="h-7 text-xs" onClick={() => setView("campanhas")}>Campanhas</Button>
          <Button size="sm" variant={view === "segmentos" ? "secondary" : "ghost"} className="h-7 text-xs" onClick={() => setView("segmentos")}>Segmentos</Button>
        </div>
        {view === "campanhas" && <Button size="sm" className="h-8 gap-1.5" onClick={() => setShowNewCamp((v) => !v)}><Plus className="h-3.5 w-3.5" />Nova campanha</Button>}
      </div>

      {view === "segmentos" ? (
        <SegmentBuilder
          cm={cm} filters={filters} setFilters={setFilters} tiers={tiers} segments={segments}
          toggle={toggle} previewCount={previewIds.length} segName={segName} setSegName={setSegName} saveSegment={saveSegment}
          segCustomers={segCustomers}
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,2fr)] gap-4">
          {/* lista de campanhas */}
          <div className="space-y-2">
            {showNewCamp && (
              <Card className="border-primary/20 bg-primary/5">
                <CardContent className="p-3 space-y-2">
                  <Input value={campForm.name} onChange={(e) => setCampForm({ ...campForm, name: e.target.value })} placeholder="Nome da campanha" className="h-8 text-xs" />
                  <Input value={campForm.objective} onChange={(e) => setCampForm({ ...campForm, objective: e.target.value })} placeholder="Objetivo (ex.: reativar clientes)" className="h-8 text-xs" />
                  <div className="grid grid-cols-2 gap-2">
                    <Select value={campForm.channel} onValueChange={(v) => setCampForm({ ...campForm, channel: v })}><SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger><SelectContent>{CHANNELS.map((c) => <SelectItem key={c} value={c}>{CHANNEL_LABEL[c]}</SelectItem>)}</SelectContent></Select>
                    <Select value={campForm.segment_id} onValueChange={(v) => setCampForm({ ...campForm, segment_id: v })}><SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Segmento" /></SelectTrigger><SelectContent>{cm.segments.length === 0 ? <SelectItem value="__none" disabled>Crie um segmento antes</SelectItem> : cm.segments.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent></Select>
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setShowNewCamp(false)}>Cancelar</Button>
                    <Button size="sm" className="h-7 text-xs" disabled={cm.createCampaign.isPending} onClick={createCampaign}>Criar</Button>
                  </div>
                </CardContent>
              </Card>
            )}
            {cm.campaigns.length === 0 && !showNewCamp && <Card><CardContent className="p-6 text-center text-sm text-muted-foreground">Nenhuma campanha. Crie um segmento e uma campanha.</CardContent></Card>}
            {cm.campaigns.map((c) => (
              <button key={c.id} onClick={() => setSelId(c.id)} className={cn("w-full text-left rounded-lg border p-2.5 hover:bg-muted/40", selId === c.id ? "border-primary/40 bg-primary/5" : "border-border/50")}>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium truncate flex items-center gap-1.5"><Megaphone className="h-3.5 w-3.5 text-primary shrink-0" />{c.name}</span>
                  <Badge variant="outline" className="text-[9px] shrink-0">{CAMPAIGN_STATUS_LABEL[c.status || "draft"]}</Badge>
                </div>
                <p className="text-[11px] text-muted-foreground mt-0.5">{CHANNEL_LABEL[c.channel || "email"]}{c.objective ? ` · ${c.objective}` : ""}</p>
              </button>
            ))}
          </div>

          {/* detalhe da campanha */}
          {selected ? (
            <CampaignDetail key={selected.id} cm={cm} campaign={selected} nameById={nameById} tierById={tierById} gen={gen} setGen={setGen} />
          ) : (
            <Card><CardContent className="p-10 text-center text-sm text-muted-foreground">Selecione uma campanha.</CardContent></Card>
          )}
        </div>
      )}
    </div>
  );
};

// --- Segment builder ---
const SegmentBuilder = ({ cm, filters, setFilters, tiers, segments, toggle, previewCount, segName, setSegName, saveSegment, segCustomers }: any) => (
  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Target className="h-4 w-4 text-primary" />Novo segmento</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <div>
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">Saúde</p>
          <div className="flex gap-1.5">{["green", "yellow", "red"].map((h) => <Badge key={h} variant={(filters.health || []).includes(h) ? "default" : "outline"} className={chip((filters.health || []).includes(h))} onClick={() => toggle("health", h)}>{h === "green" ? "Saudável" : h === "yellow" ? "Atenção" : "Crítico"}</Badge>)}</div>
        </div>
        {tiers.length > 0 && (
          <div><p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">Tier</p><div className="flex flex-wrap gap-1.5">{tiers.map((t: string) => <Badge key={t} variant={(filters.tier || []).includes(t) ? "default" : "outline"} className={chip((filters.tier || []).includes(t))} onClick={() => toggle("tier", t)}>{t}</Badge>)}</div></div>
        )}
        {segments.length > 0 && (
          <div><p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">Segmento</p><div className="flex flex-wrap gap-1.5">{segments.map((s: string) => <Badge key={s} variant={(filters.segment || []).includes(s) ? "default" : "outline"} className={chip((filters.segment || []).includes(s))} onClick={() => toggle("segment", s)}>{s}</Badge>)}</div></div>
        )}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">Tipo</p>
            <Select value={filters.recorrente == null ? "all" : filters.recorrente ? "rec" : "pont"} onValueChange={(v) => setFilters((f: SegmentFilter) => ({ ...f, recorrente: v === "all" ? undefined : v === "rec" }))}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="all">Todos</SelectItem><SelectItem value="rec">Recorrente</SelectItem><SelectItem value="pont">Pontual</SelectItem></SelectContent>
            </Select>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">MRR mín.</p>
            <Input type="number" value={filters.minMrr ?? ""} onChange={(e) => setFilters((f: SegmentFilter) => ({ ...f, minMrr: e.target.value ? Number(e.target.value) : undefined }))} placeholder="0" className="h-8 text-xs" />
          </div>
        </div>
        <div className="flex items-center gap-2 pt-1">
          <Input value={segName} onChange={(e) => setSegName(e.target.value)} placeholder="Nome do segmento" className="h-8 text-xs flex-1" />
          <Button size="sm" className="h-8 text-xs" disabled={!segName.trim() || cm.createSegment.isPending} onClick={saveSegment}>Salvar ({previewCount})</Button>
        </div>
        <p className="text-[11px] text-muted-foreground">{previewCount} cliente(s) batem com os filtros.</p>
      </CardContent>
    </Card>

    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-sm">Segmentos salvos</CardTitle></CardHeader>
      <CardContent className="space-y-1.5">
        {cm.segments.length === 0 ? <p className="text-sm text-muted-foreground">Nenhum segmento ainda.</p> : cm.segments.map((s: any) => {
          const count = resolveSegment(segCustomers, s.filters || {}).length;
          return (
            <div key={s.id} className="flex items-center gap-2 rounded-lg border border-border/50 p-2 text-sm">
              <Users className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <span className="flex-1 truncate">{s.name}</span>
              <span className="text-xs text-muted-foreground font-mono">{count}</span>
              <Button size="icon" variant="ghost" className="h-6 w-6 text-muted-foreground hover:text-destructive" onClick={() => cm.deleteSegment.mutate(s.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
            </div>
          );
        })}
      </CardContent>
    </Card>
  </div>
);

// --- Campaign detail ---
const CampaignDetail = ({ cm, campaign, nameById, tierById, gen, setGen }: { cm: ReturnType<typeof useCampaigns>; campaign: Campaign; nameById: Map<string, string>; tierById: Map<string, string>; gen: boolean; setGen: (v: boolean) => void }) => {
  const [msg, setMsg] = useState(campaign.message || "");
  const recipients = useMemo(() => cm.recipients.filter((r) => r.campaign_id === campaign.id), [cm.recipients, campaign.id]);
  const perf = useMemo(() => campaignPerformance(recipients), [recipients]);
  const demo = useMemo(() => groupCount(recipients, (r) => (r.customer_id ? tierById.get(r.customer_id) : "—")), [recipients, tierById]);
  const funnel = [
    { label: "Total", value: perf.total }, { label: "Enviados", value: perf.enviados },
    { label: "Abertos", value: perf.abertos }, { label: "Responderam", value: perf.responderam }, { label: "Converteram", value: perf.converteram },
  ];

  const generate = async () => {
    setGen(true);
    try {
      const prompt = `Escreva uma mensagem curta e persuasiva de ${CHANNEL_LABEL[campaign.channel || "email"]} para a campanha "${campaign.name}"${campaign.objective ? ` (objetivo: ${campaign.objective})` : ""}. Público: ${recipients.length} clientes. Seja direto, com uma chamada para ação clara. Responda só com a mensagem.`;
      let acc = "";
      await streamComercialAI([{ role: "user", content: prompt }], (chunk) => { acc += chunk; setMsg(acc); });
      cm.updateCampaign.mutate({ id: campaign.id, patch: { message: acc } });
    } catch (e: any) {
      toast({ title: "Erro na IA", description: e?.message, variant: "destructive" });
    } finally { setGen(false); }
  };

  const cycleStatus = (rid: string, cur: string) => {
    const next = STATUS_ORDER[(STATUS_ORDER.indexOf(cur) + 1) % STATUS_ORDER.length];
    const patch: any = { offer_status: next };
    if (next === "responded") patch.responded_at = new Date().toISOString();
    if (next === "converted") patch.converted_at = new Date().toISOString();
    cm.updateRecipient.mutate({ id: rid, patch });
  };

  return (
    <div className="space-y-3">
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="text-base flex items-center gap-2"><Megaphone className="h-4 w-4 text-primary" />{campaign.name}</CardTitle>
            <div className="flex items-center gap-2">
              <Select value={campaign.status || "draft"} onValueChange={(v) => cm.updateCampaign.mutate({ id: campaign.id, patch: { status: v } })}>
                <SelectTrigger className="h-7 w-[110px] text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>{["draft", "active", "paused", "done"].map((s) => <SelectItem key={s} value={s}>{CAMPAIGN_STATUS_LABEL[s]}</SelectItem>)}</SelectContent>
              </Select>
              <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => cm.deleteCampaign.mutate(campaign.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* KPIs */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <Tile label="Enviados" value={`${perf.enviados}/${perf.total}`} />
            <Tile label="Taxa resposta" value={pct(perf.taxaResposta)} tone="text-emerald-400" />
            <Tile label="Conversão" value={pct(perf.taxaConversao)} tone="text-primary" />
            <Tile label="Projetado" value={brl(perf.receitaProjetada)} hint={`realizado ${brl(perf.receitaRealizada)}`} />
          </div>

          {/* charts */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="rounded-lg border border-border/50 p-2">
              <p className="text-[11px] text-muted-foreground mb-1">Funil</p>
              <div className="h-[160px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={funnel}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="label" stroke="hsl(var(--muted-foreground))" fontSize={10} />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={10} allowDecimals={false} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Bar dataKey="value" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="rounded-lg border border-border/50 p-2">
              <p className="text-[11px] text-muted-foreground mb-1">Composição por tier</p>
              <div className="h-[160px]">
                {demo.length === 0 ? <p className="text-xs text-muted-foreground py-12 text-center">Sem destinatários.</p> : (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={demo} cx="50%" cy="50%" innerRadius={35} outerRadius={65} paddingAngle={3} dataKey="value" nameKey="label" label={({ label, value }: any) => `${label} ${value}`} labelLine={false}>
                        {demo.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                      </Pie>
                      <Tooltip contentStyle={tooltipStyle} />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          </div>

          {/* mensagem + IA */}
          <div className="rounded-lg border border-border/50 p-2 space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-[11px] text-muted-foreground flex items-center gap-1"><Send className="h-3 w-3" />Mensagem</p>
              <Button size="sm" variant="outline" className="h-7 text-xs gap-1.5" disabled={gen} onClick={generate}><Sparkles className={cn("h-3.5 w-3.5", gen && "animate-pulse")} />{gen ? "Gerando…" : "Gerar com IA"}</Button>
            </div>
            <Textarea value={msg} onChange={(e) => setMsg(e.target.value)} onBlur={() => msg !== (campaign.message || "") && cm.updateCampaign.mutate({ id: campaign.id, patch: { message: msg } })} placeholder="Escreva ou gere a mensagem da campanha…" rows={3} className="text-xs" />
          </div>
        </CardContent>
      </Card>

      {/* recipients */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><TrendingUp className="h-4 w-4 text-primary" />Destinatários ({recipients.length})</CardTitle></CardHeader>
        <CardContent className="p-0">
          <div className="max-h-[40vh] overflow-y-auto">
            <Table>
              <TableHeader><TableRow><TableHead className="text-xs">Cliente</TableHead><TableHead className="text-xs">Propensão</TableHead><TableHead className="text-xs">Receita prev.</TableHead><TableHead className="text-xs">Status</TableHead></TableRow></TableHeader>
              <TableBody>
                {recipients.map((r) => (
                  <TableRow key={r.id} className="hover:bg-muted/30">
                    <TableCell className="text-sm">{r.customer_id ? nameById.get(r.customer_id) || "—" : "—"}</TableCell>
                    <TableCell className="font-mono text-xs">{r.propensity ?? "—"}</TableCell>
                    <TableCell className="font-mono text-xs">{brl(Number(r.predicted_revenue) || 0)}</TableCell>
                    <TableCell>
                      <button onClick={() => cycleStatus(r.id, r.offer_status)} title="Clique para avançar">
                        <Badge variant="outline" className={cn("text-[10px]", STATUS_STYLE[r.offer_status] || STATUS_STYLE.pending)}>{STATUS_LABEL[r.offer_status] || r.offer_status}</Badge>
                      </button>
                    </TableCell>
                  </TableRow>
                ))}
                {recipients.length === 0 && <TableRow><TableCell colSpan={4} className="text-center text-sm text-muted-foreground py-6">Sem destinatários.</TableCell></TableRow>}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

const Tile = ({ label, value, tone, hint }: { label: string; value: string; tone?: string; hint?: string }) => (
  <div className="rounded-lg border border-border/50 bg-background/40 p-2">
    <p className="text-[10px] text-muted-foreground">{label}</p>
    <p className={cn("font-mono text-sm font-bold", tone)}>{value}</p>
    {hint && <p className="text-[9px] text-muted-foreground truncate">{hint}</p>}
  </div>
);

export default CampaignManager;
