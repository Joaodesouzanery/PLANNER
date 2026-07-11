import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plane, Plus, Trash2, Save, MapPin, Users, CalendarDays, FileDown, TrendingDown, CheckCircle2, RotateCcw } from "lucide-react";
import { differenceInDays, differenceInCalendarMonths, format } from "date-fns";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { useTravelProfile, useTrips, useTripCategories, seedDefaultCategories, type Trip, type TripCategory } from "./useTravel";
import { useFinanceWorkspace } from "../useFinanceWorkspace";
import { useFinanceSettings } from "../useFinanceSettings";
import { computeCfo } from "../financeCfo";
import { Textarea } from "@/components/ui/textarea";
import { CurrencyInput, NumberField } from "@/components/ui/currency-input";
import { exportTablePdf } from "@/lib/exportPdf";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const computeCategoryTotal = (c: TripCategory, travelers: number, nights: number) => {
  let t = Number(c.amount) || 0;
  if (c.multiply_by_nights) t *= Math.max(1, nights);
  if (c.is_per_person) t *= Math.max(1, travelers);
  return t;
};

const FinanceTravel = () => {
  const { profile, save: saveProfile } = useTravelProfile();
  const { trips, create, update, remove } = useTrips();
  const [selectedTripId, setSelectedTripId] = useState<string | null>(null);
  const { categories, upsert: upsertCat, remove: removeCat } = useTripCategories(selectedTripId);

  const [profileForm, setProfileForm] = useState(profile);
  // Reset apenas quando o id muda (após o primeiro insert) ou quando trocamos de empresa.
  useEffect(() => { setProfileForm(profile); }, [profile.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Dados REAIS (fonte única canônica + CFO): base do veredito, não o perfil manual zerado. ──
  const workspace = useFinanceWorkspace();
  const { settings } = useFinanceSettings();
  const { selectedCompanyId } = useCompany();
  const qc = useQueryClient();
  const cfo = useMemo(() => computeCfo(workspace.canonical.rows, settings, workspace.reserveBalance, format(new Date(), "yyyy-MM-dd"), workspace.expectedMonthly), [workspace.canonical.rows, settings, workspace.reserveBalance, workspace.expectedMonthly]);
  const menor90 = useMemo(() => workspace.canonical.menorSaldo(90).saldo, [workspace.canonical]);
  const realAvailable = cfo.sobraMensal; // sobra mensal real (líquida de imposto − despesas)
  const tripsInFlow = new Set((workspace.rawTransactions as any[]).filter((t) => t.source_type === "travel").map((t) => t.source_id));

  const addToFlow = useMutation({
    mutationFn: async ({ trip, rows }: { trip: Trip; rows: { description: string; amount: number }[] }) => {
      const date = trip.start_date || format(new Date(), "yyyy-MM-dd");
      await (supabase as any).from("financial_transactions").delete().eq("source_id", trip.id).eq("source_type", "travel");
      const payload = rows.filter((r) => r.amount > 0).map((r) => ({
        description: r.description, amount: r.amount, type: "expense", category: "Viagem",
        date, due_date: date, status: "planned", source_type: "travel", source_id: trip.id,
        company_id: selectedCompanyId !== "all" ? selectedCompanyId : null,
      }));
      if (payload.length) { const { error } = await (supabase as any).from("financial_transactions").insert(payload); if (error) throw error; }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["finance-transactions"] }); toast.success("Viagem adicionada ao fluxo — já entra na projeção."); },
    onError: (e: any) => toast.error("Erro ao adicionar ao fluxo", { description: e?.message }),
  });
  const removeFromFlow = useMutation({
    mutationFn: async (tripId: string) => { const { error } = await (supabase as any).from("financial_transactions").delete().eq("source_id", tripId).eq("source_type", "travel"); if (error) throw error; },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["finance-transactions"] }); toast.success("Viagem removida do fluxo"); },
  });

  const selectedTrip = trips.find(t => t.id === selectedTripId) || null;
  const [newOpen, setNewOpen] = useState(false);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Plane className="h-5 w-5 text-primary" /> Perfil Financeiro</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card className="bg-success/10 border-success/30"><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Renda líq. real / mês</p><p className="text-xl font-bold text-success">{brl(cfo.receitaLiquida)}</p><p className="text-[10px] text-muted-foreground">média 3m, − imposto</p></CardContent></Card>
            <Card className="bg-destructive/10 border-destructive/30"><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Despesas reais / mês</p><p className="text-xl font-bold text-destructive">{brl(cfo.despesaMensal)}</p><p className="text-[10px] text-muted-foreground">média 3m</p></CardContent></Card>
            <Card className="bg-primary/10 border-primary/30"><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Sobra real / mês</p><p className={cn("text-xl font-bold", realAvailable >= 0 ? "text-primary" : "text-destructive")}>{brl(realAvailable)}</p><p className="text-[10px] text-muted-foreground">base do veredito</p></CardContent></Card>
            <Card className="border-border/50"><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Menor saldo 90d</p><p className={cn("text-xl font-bold", menor90 >= 0 ? "text-foreground" : "text-destructive")}>{brl(menor90)}</p><p className="text-[10px] text-muted-foreground">piso do caixa</p></CardContent></Card>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Field label="Salário líquido" value={profileForm.monthly_salary} onChange={v => setProfileForm({ ...profileForm, monthly_salary: v })} />
            <Field label="Renda variável" value={profileForm.variable_income} onChange={v => setProfileForm({ ...profileForm, variable_income: v })} />
            <Field label="Outras receitas" value={profileForm.other_income} onChange={v => setProfileForm({ ...profileForm, other_income: v })} />
            <Field label="Moradia" value={profileForm.housing} onChange={v => setProfileForm({ ...profileForm, housing: v })} />
            <Field label="Alimentação" value={profileForm.food} onChange={v => setProfileForm({ ...profileForm, food: v })} />
            <Field label="Transporte" value={profileForm.transport} onChange={v => setProfileForm({ ...profileForm, transport: v })} />
            <Field label="Planos/Assinaturas" value={profileForm.subscriptions} onChange={v => setProfileForm({ ...profileForm, subscriptions: v })} />
            <Field label="Dívidas/Parcelas" value={profileForm.debts} onChange={v => setProfileForm({ ...profileForm, debts: v })} />
          </div>

          <Button onClick={() => saveProfile.mutate(profileForm)} disabled={saveProfile.isPending}><Save className="h-4 w-4 mr-2" />Salvar perfil</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Minhas Viagens</CardTitle>
          <Button size="sm" onClick={() => setNewOpen(true)}><Plus className="h-4 w-4 mr-2" />Nova Viagem</Button>
        </CardHeader>
        <CardContent>
          {trips.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Nenhuma viagem cadastrada ainda.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {trips.map(t => (
                <Card key={t.id} className={`cursor-pointer transition ${selectedTripId === t.id ? "border-primary ring-1 ring-primary" : "hover:border-primary/40"}`} onClick={() => setSelectedTripId(t.id)}>
                  <CardContent className="pt-4 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold">{t.name}</p>
                        <p className="text-xs text-muted-foreground flex items-center gap-1"><MapPin className="h-3 w-3" />{t.destination || "—"}</p>
                      </div>
                      <Button size="icon" variant="ghost" onClick={(e) => { e.stopPropagation(); remove.mutate(t.id); if (selectedTripId === t.id) setSelectedTripId(null); }}><Trash2 className="h-3.5 w-3.5" /></Button>
                    </div>
                    <div className="flex flex-wrap gap-1 text-xs">
                      <Badge variant="outline">{t.adults + t.children} pessoas</Badge>
                      <Badge variant="outline">{t.profile}</Badge>
                      {t.is_international && <Badge variant="outline">Internacional</Badge>}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {selectedTrip && (
        <TripDetail
          trip={selectedTrip}
          categories={categories}
          availableBalance={realAvailable}
          menor90={menor90}
          reservaAlvo={cfo.reservaAlvo}
          inFlow={tripsInFlow.has(selectedTrip.id)}
          onAddToFlow={(rows) => addToFlow.mutate({ trip: selectedTrip, rows })}
          onRemoveFromFlow={() => removeFromFlow.mutate(selectedTrip.id)}
          busy={addToFlow.isPending || removeFromFlow.isPending}
          onUpdate={(patch) => update.mutate({ id: selectedTrip.id, ...patch })}
          onCatUpsert={(c) => upsertCat.mutate({ ...c, trip_id: selectedTrip.id })}
          onCatRemove={(id) => removeCat.mutate(id)}
        />
      )}

      <NewTripDialog
        open={newOpen}
        onOpenChange={setNewOpen}
        onCreate={async (data) => {
          const trip = await create.mutateAsync(data);
          await seedDefaultCategories(trip.id);
          setSelectedTripId(trip.id);
          setNewOpen(false);
        }}
      />
    </div>
  );
};

const Field = ({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) => (
  <CurrencyInput label={label} value={Number(value) || 0} onChange={onChange} min={0} />
);

const NewTripDialog = ({ open, onOpenChange, onCreate }: { open: boolean; onOpenChange: (v: boolean) => void; onCreate: (data: Partial<Trip>) => void }) => {
  const [form, setForm] = useState<Partial<Trip>>({ name: "", destination: "", adults: 1, children: 0, profile: "standard", is_international: false, emergency_pct: 15, status: "planning" });
  const exchangeInvalid = !!form.is_international && (!form.exchange_rate || form.exchange_rate <= 0);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent aria-describedby={undefined}>
        <DialogHeader><DialogTitle>Nova Viagem</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Nome</Label><Input value={form.name || ""} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Férias em Lisboa" /></div>
          <div><Label>Destino</Label><Input value={form.destination || ""} onChange={(e) => setForm({ ...form, destination: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Início</Label><Input type="date" value={form.start_date || ""} onChange={(e) => setForm({ ...form, start_date: e.target.value })} /></div>
            <div><Label>Fim</Label><Input type="date" value={form.end_date || ""} onChange={(e) => setForm({ ...form, end_date: e.target.value })} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <NumberField label="Adultos" value={form.adults ?? 1} onChange={(v) => setForm({ ...form, adults: v ?? 1 })} integer min={1} />
            <NumberField label="Crianças" value={form.children ?? 0} onChange={(v) => setForm({ ...form, children: v ?? 0 })} integer min={0} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Perfil</Label>
              <Select value={form.profile} onValueChange={(v) => setForm({ ...form, profile: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="economic">Econômico</SelectItem>
                  <SelectItem value="standard">Padrão</SelectItem>
                  <SelectItem value="luxury">Luxo</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end gap-2"><Switch checked={!!form.is_international} onCheckedChange={(v) => setForm({ ...form, is_international: v })} /><Label>Internacional</Label></div>
          </div>
          {form.is_international && <NumberField label="Câmbio (R$ por moeda)" value={form.exchange_rate ?? null} onChange={(v) => setForm({ ...form, exchange_rate: v })} min={0.01} decimals={2} nullable placeholder="ex: 5,25" helperText="Maior que zero" />}
        </div>
        <DialogFooter><Button onClick={() => onCreate(form)} disabled={!form.name || exchangeInvalid}>Criar</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const TripDetail = ({ trip, categories, availableBalance, menor90, reservaAlvo, inFlow, onAddToFlow, onRemoveFromFlow, busy, onUpdate, onCatUpsert, onCatRemove }: {
  trip: Trip; categories: TripCategory[]; availableBalance: number;
  menor90: number; reservaAlvo: number; inFlow: boolean; busy: boolean;
  onAddToFlow: (rows: { description: string; amount: number }[]) => void; onRemoveFromFlow: () => void;
  onUpdate: (p: Partial<Trip>) => void;
  onCatUpsert: (c: Partial<TripCategory>) => void;
  onCatRemove: (id: string) => void;
}) => {
  const travelers = trip.adults + trip.children;
  const nights = trip.start_date && trip.end_date ? Math.max(1, differenceInDays(new Date(trip.end_date), new Date(trip.start_date))) : 1;
  const monthsUntil = trip.start_date ? Math.max(1, differenceInCalendarMonths(new Date(trip.start_date), new Date())) : 1;

  const subtotal = categories.reduce((s, c) => s + computeCategoryTotal(c, travelers, nights), 0);
  const emergency = subtotal * (Number(trip.emergency_pct || 0) / 100);
  const total = subtotal + emergency;
  const totalBRL = trip.is_international && trip.exchange_rate ? total * Number(trip.exchange_rate) : total;
  const perPerson = travelers > 0 ? totalBRL / travelers : totalBRL;
  const monthlyGoal = totalBRL / monthsUntil;
  const committedPct = availableBalance > 0 ? monthlyGoal / availableBalance : 1;

  const trafficLight = committedPct <= 0.3 ? { color: "text-success", bg: "bg-success", label: "Viável", desc: "A meta cabe confortavelmente no seu saldo disponível." }
    : committedPct <= 0.6 ? { color: "text-warning", bg: "bg-warning", label: "Atenção", desc: "Possível, mas exige disciplina mensal." }
    : { color: "text-destructive", bg: "bg-destructive", label: "Replanejar", desc: "Reveja prazo, destino ou número de viajantes." };

  // ── Impacto REAL no fluxo: o gasto rebaixa o menor saldo em 90 dias; comparar com a reserva-alvo. ──
  const toBRL = (v: number) => (trip.is_international && trip.exchange_rate ? v * Number(trip.exchange_rate) : v);
  const flowRows = [
    ...categories.map((c) => ({ description: `Viagem ${trip.name}: ${c.label}`, amount: toBRL(computeCategoryTotal(c, travelers, nights)) })),
    ...(emergency > 0 ? [{ description: `Viagem ${trip.name}: reserva`, amount: toBRL(emergency) }] : []),
  ];
  // menor90 já reflete a viagem quando ela está no fluxo → não subtrair de novo.
  const menorSemViagem = inFlow ? menor90 + totalBRL : menor90;
  const menorPos = inFlow ? menor90 : menor90 - totalBRL;
  const impacto = menorPos >= reservaAlvo
    ? { color: "text-success", bg: "border-success/30 bg-success/10", label: "Cabe com folga", desc: "O piso do caixa fica acima da sua reserva-alvo." }
    : menorPos >= 0
      ? { color: "text-warning", bg: "border-warning/30 bg-warning/10", label: "Cabe, mas come o colchão", desc: "O piso fica positivo, porém abaixo da reserva-alvo." }
      : { color: "text-destructive", bg: "border-destructive/30 bg-destructive/10", label: "Não cabe — replanejar", desc: "O caixa fica negativo no período. Reveja prazo/valores." };

  const [newCat, setNewCat] = useState<{ label: string; amount: number }>({ label: "", amount: 0 });

  const exportTrip = async () => {
    try {
      await exportTablePdf({
        title: `Viagem — ${trip.name}`,
        subtitle: `${trip.destination || "—"} · ${travelers} viajante(s) · ${nights} noite(s) · gerado em ${new Date().toLocaleString("pt-BR")}`,
        filename: `viagem-${trip.name.replace(/\s+/g, "-").toLowerCase()}.pdf`,
        sections: [
          { heading: "Resumo", head: [["Indicador", "Valor"]], body: [
            ["Subtotal", brl(subtotal)], [`Reserva (${trip.emergency_pct}%)`, brl(emergency)], ["Total", brl(totalBRL)],
            ["Por pessoa", brl(perPerson)], [`Meta mensal (${monthsUntil} mês/es)`, brl(monthlyGoal)],
            ["% do saldo disponível", `${(committedPct * 100).toFixed(1)}%`],
          ] },
          { heading: "Categorias", head: [["Categoria", "Valor base", "Por pessoa", "× noites", "Total"]], body: categories.length ? categories.map((c) => [c.label, brl(Number(c.amount) || 0), c.is_per_person ? "Sim" : "—", c.multiply_by_nights ? "Sim" : "—", brl(computeCategoryTotal(c, travelers, nights))]) : [["—", "—", "—", "—", "—"]] },
        ],
      });
      toast.success("Viagem exportada!");
    } catch (err: any) {
      toast.error("Falha ao exportar", { description: err?.message });
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <CardTitle className="flex items-center gap-2"><CalendarDays className="h-5 w-5 text-primary" />{trip.name} — {nights} {nights === 1 ? "noite" : "noites"} · {travelers} {travelers === 1 ? "viajante" : "viajantes"}</CardTitle>
        <Button variant="outline" size="sm" onClick={exportTrip} className="shrink-0"><FileDown className="h-4 w-4 mr-2" />Exportar</Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Impacto REAL no fluxo */}
        <div className={cn("rounded-xl border p-3", impacto.bg)}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <p className={cn("flex items-center gap-2 text-sm font-semibold", impacto.color)}><TrendingDown className="h-4 w-4" />{impacto.label}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{impacto.desc}</p>
            </div>
            <div className="flex flex-wrap items-center gap-4 font-mono text-xs">
              <div><p className="text-[10px] text-muted-foreground">Total viagem</p><p className="font-bold">{brl(totalBRL)}</p></div>
              <div><p className="text-[10px] text-muted-foreground">Menor saldo 90d</p><p className="font-bold">{brl(menorSemViagem)}</p></div>
              <div><p className="text-[10px] text-muted-foreground">Pós-viagem</p><p className={cn("font-bold", impacto.color)}>{brl(menorPos)}</p></div>
              <div><p className="text-[10px] text-muted-foreground">Reserva-alvo</p><p className="font-bold">{brl(reservaAlvo)}</p></div>
              {inFlow ? (
                <Button size="sm" variant="outline" disabled={busy} onClick={onRemoveFromFlow}><RotateCcw className="h-3.5 w-3.5 mr-1" />Tirar do fluxo</Button>
              ) : (
                <Button size="sm" disabled={busy || flowRows.length === 0} onClick={() => onAddToFlow(flowRows)}><CheckCircle2 className="h-3.5 w-3.5 mr-1" />Adicionar ao fluxo</Button>
              )}
            </div>
          </div>
          {inFlow && <p className="mt-2 text-[11px] text-emerald-400">✓ No fluxo — já aparece em Transações, Dashboard e no menor saldo. Custo de oportunidade: ~{brl(monthlyGoal)}/mês deixam de ir pra reserva/investimento.</p>}
        </div>

        <Tabs defaultValue="budget">
          <TabsList>
            <TabsTrigger value="budget">Orçamento</TabsTrigger>
            <TabsTrigger value="dashboard">Resultado</TabsTrigger>
            <TabsTrigger value="scenarios">Cenários</TabsTrigger>
            <TabsTrigger value="settings">Configurações</TabsTrigger>
          </TabsList>

          <TabsContent value="budget" className="space-y-3 mt-4">
            <div className="space-y-2">
              {categories.map(c => {
                const catTotal = computeCategoryTotal(c, travelers, nights);
                const pctOfTotal = subtotal > 0 ? (catTotal / subtotal) * 100 : 0;
                const overLimit = c.limit_pct != null && pctOfTotal > c.limit_pct;
                return (
                  <div key={c.id} className="grid grid-cols-12 gap-2 items-center p-2 rounded-lg border border-border/40 bg-card/40">
                    <Input className="col-span-3" value={c.label} onChange={(e) => onCatUpsert({ ...c, label: e.target.value })} />
                    <CurrencyInput className="col-span-2" value={Number(c.amount) || 0} onChange={(v) => onCatUpsert({ ...c, amount: v })} min={0} />
                    <label className="col-span-2 flex items-center gap-1 text-xs"><Switch checked={c.is_per_person} onCheckedChange={(v) => onCatUpsert({ ...c, is_per_person: v })} />Por pessoa</label>
                    <label className="col-span-2 flex items-center gap-1 text-xs"><Switch checked={c.multiply_by_nights} onCheckedChange={(v) => onCatUpsert({ ...c, multiply_by_nights: v })} />× noites</label>
                    <NumberField className="col-span-1" placeholder="% lim" suffix="%" value={c.limit_pct ?? null} onChange={(v) => onCatUpsert({ ...c, limit_pct: v })} integer min={0} max={100} nullable />
                    <div className="col-span-1 text-right text-xs font-medium">{brl(catTotal)}{overLimit && <Badge variant="destructive" className="ml-1 text-[10px]">⚠</Badge>}</div>
                    <Button size="icon" variant="ghost" className="col-span-1" onClick={() => onCatRemove(c.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                  </div>
                );
              })}
            </div>
            <div className="flex gap-2 items-end pt-2 border-t border-border/40">
              <Input placeholder="Nova categoria (ex: Passeios)" value={newCat.label} onChange={(e) => setNewCat({ ...newCat, label: e.target.value })} />
              <CurrencyInput className="w-32" placeholder="Valor" value={Number(newCat.amount) || 0} onChange={(v) => setNewCat({ ...newCat, amount: v })} min={0} />
              <Button onClick={() => { if (newCat.label) { onCatUpsert({ key: "custom", label: newCat.label, amount: newCat.amount, sort_order: categories.length }); setNewCat({ label: "", amount: 0 }); } }}><Plus className="h-4 w-4" /></Button>
            </div>
          </TabsContent>

          <TabsContent value="dashboard" className="space-y-4 mt-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Stat label="Subtotal" value={brl(subtotal)} />
              <Stat label={`Reserva (${trip.emergency_pct}%)`} value={brl(emergency)} />
              <Stat label="Total" value={brl(totalBRL)} highlight />
              <Stat label="Por pessoa" value={brl(perPerson)} />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Card><CardContent className="pt-4 space-y-2">
                <p className="text-xs text-muted-foreground">Meta mensal de poupança ({monthsUntil} {monthsUntil === 1 ? "mês" : "meses"})</p>
                <p className="text-2xl font-bold text-primary">{brl(monthlyGoal)}</p>
                <Progress value={Math.min(100, committedPct * 100)} />
                <p className="text-xs text-muted-foreground">{(committedPct * 100).toFixed(1)}% do saldo disponível mensal</p>
              </CardContent></Card>
              <Card className={`border-2 ${trafficLight.color.replace("text-", "border-")}/40`}>
                <CardContent className="pt-4 space-y-2">
                  <div className="flex items-center gap-2"><div className={`h-3 w-3 rounded-full ${trafficLight.bg}`} /><p className={`font-bold ${trafficLight.color}`}>{trafficLight.label}</p></div>
                  <p className="text-sm text-muted-foreground">{trafficLight.desc}</p>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="scenarios" className="mt-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {[1, 2, 5].map(n => {
                const sub = categories.reduce((s, c) => s + computeCategoryTotal(c, n, nights), 0);
                const tot = sub * (1 + Number(trip.emergency_pct || 0) / 100);
                const totConv = trip.is_international && trip.exchange_rate ? tot * Number(trip.exchange_rate) : tot;
                return (
                  <Card key={n}><CardContent className="pt-4 space-y-1">
                    <p className="text-xs text-muted-foreground flex items-center gap-1"><Users className="h-3 w-3" />{n} {n === 1 ? "pessoa" : "pessoas"}</p>
                    <p className="text-lg font-bold">{brl(totConv)}</p>
                    <p className="text-xs text-muted-foreground">Por pessoa: {brl(totConv / n)}</p>
                  </CardContent></Card>
                );
              })}
            </div>
          </TabsContent>

          <TabsContent value="settings" className="space-y-3 mt-4">
            <div className="grid grid-cols-2 gap-3">
              <NumberField label="Adultos" value={trip.adults} onChange={(v) => onUpdate({ adults: v ?? 1 })} integer min={1} />
              <NumberField label="Crianças" value={trip.children} onChange={(v) => onUpdate({ children: v ?? 0 })} integer min={0} />
              <div><Label>Início</Label><Input type="date" value={trip.start_date || ""} onChange={(e) => onUpdate({ start_date: e.target.value })} /></div>
              <div><Label>Fim</Label><Input type="date" value={trip.end_date || ""} onChange={(e) => onUpdate({ end_date: e.target.value })} /></div>
              <NumberField label="Reserva emergência (%)" value={Number(trip.emergency_pct || 0)} onChange={(v) => onUpdate({ emergency_pct: v ?? 0 })} integer min={0} max={100} suffix="%" />
              <div className="flex items-end gap-2"><Switch checked={trip.is_international} onCheckedChange={(v) => onUpdate({ is_international: v })} /><Label>Internacional</Label></div>
              {trip.is_international && <NumberField className="col-span-2" label="Câmbio (R$ por moeda)" value={trip.exchange_rate ?? null} onChange={(v) => onUpdate({ exchange_rate: v })} min={0.01} decimals={2} nullable helperText="Maior que zero" />}
            </div>
            <div><Label>Notas</Label><Textarea value={trip.notes || ""} onChange={(e) => onUpdate({ notes: e.target.value })} /></div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};

const Stat = ({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) => (
  <Card className={highlight ? "bg-primary/10 border-primary/30" : ""}>
    <CardContent className="pt-4"><p className="text-xs text-muted-foreground">{label}</p><p className={`text-xl font-bold ${highlight ? "text-primary" : ""}`}>{value}</p></CardContent>
  </Card>
);

export default FinanceTravel;
