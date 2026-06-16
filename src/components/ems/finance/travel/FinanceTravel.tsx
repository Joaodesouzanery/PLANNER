import { useState, useMemo, useEffect } from "react";
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
import { Plane, Plus, Trash2, Save, Edit2, MapPin, Users, CalendarDays } from "lucide-react";
import { differenceInDays, differenceInCalendarMonths, format } from "date-fns";
import { useTravelProfile, useTrips, useTripCategories, seedDefaultCategories, type Trip, type TripCategory } from "./useTravel";
import { Textarea } from "@/components/ui/textarea";

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const num = (v: any) => (Number.isFinite(+v) ? +v : 0);

const computeCategoryTotal = (c: TripCategory, travelers: number, nights: number) => {
  let t = num(c.amount);
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
  useEffect(() => { setProfileForm(profile); }, [profile]);

  const availableBalance = useMemo(() => {
    const inc = num(profileForm.monthly_salary) + num(profileForm.variable_income) + num(profileForm.other_income);
    const out = num(profileForm.housing) + num(profileForm.food) + num(profileForm.transport) + num(profileForm.subscriptions) + num(profileForm.debts);
    return inc - out;
  }, [profileForm]);

  const totalIncome = num(profileForm.monthly_salary) + num(profileForm.variable_income) + num(profileForm.other_income);
  const totalOutgoing = num(profileForm.housing) + num(profileForm.food) + num(profileForm.transport) + num(profileForm.subscriptions) + num(profileForm.debts);

  const selectedTrip = trips.find(t => t.id === selectedTripId) || null;
  const [newOpen, setNewOpen] = useState(false);

  return (
    <div className="space-y-6">
      {/* Perfil financeiro */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Plane className="h-5 w-5 text-primary" /> Perfil Financeiro</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Card className="bg-success/10 border-success/30"><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Renda Total</p><p className="text-xl font-bold text-success">{brl(totalIncome)}</p></CardContent></Card>
            <Card className="bg-destructive/10 border-destructive/30"><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Saídas Recorrentes</p><p className="text-xl font-bold text-destructive">{brl(totalOutgoing)}</p></CardContent></Card>
            <Card className="bg-primary/10 border-primary/30"><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Saldo Disponível / mês</p><p className="text-xl font-bold text-primary">{brl(availableBalance)}</p></CardContent></Card>
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

      {/* Lista de viagens */}
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
          availableBalance={availableBalance}
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
  <div>
    <Label className="text-xs">{label}</Label>
    <Input type="number" value={value} onChange={(e) => onChange(num(e.target.value))} />
  </div>
);

const NewTripDialog = ({ open, onOpenChange, onCreate }: { open: boolean; onOpenChange: (v: boolean) => void; onCreate: (data: Partial<Trip>) => void }) => {
  const [form, setForm] = useState<Partial<Trip>>({ name: "", destination: "", adults: 1, children: 0, profile: "standard", is_international: false, emergency_pct: 15, status: "planning" });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Nova Viagem</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Nome</Label><Input value={form.name || ""} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Férias em Lisboa" /></div>
          <div><Label>Destino</Label><Input value={form.destination || ""} onChange={(e) => setForm({ ...form, destination: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Início</Label><Input type="date" value={form.start_date || ""} onChange={(e) => setForm({ ...form, start_date: e.target.value })} /></div>
            <div><Label>Fim</Label><Input type="date" value={form.end_date || ""} onChange={(e) => setForm({ ...form, end_date: e.target.value })} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Adultos</Label><Input type="number" value={form.adults || 1} onChange={(e) => setForm({ ...form, adults: num(e.target.value) })} /></div>
            <div><Label>Crianças</Label><Input type="number" value={form.children || 0} onChange={(e) => setForm({ ...form, children: num(e.target.value) })} /></div>
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
          {form.is_international && <div><Label>Câmbio (R$)</Label><Input type="number" step="0.01" value={form.exchange_rate || ""} onChange={(e) => setForm({ ...form, exchange_rate: num(e.target.value) })} /></div>}
        </div>
        <DialogFooter><Button onClick={() => onCreate(form)} disabled={!form.name}>Criar</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const TripDetail = ({ trip, categories, availableBalance, onUpdate, onCatUpsert, onCatRemove }: {
  trip: Trip; categories: TripCategory[]; availableBalance: number;
  onUpdate: (p: Partial<Trip>) => void;
  onCatUpsert: (c: Partial<TripCategory>) => void;
  onCatRemove: (id: string) => void;
}) => {
  const travelers = trip.adults + trip.children;
  const nights = trip.start_date && trip.end_date ? Math.max(1, differenceInDays(new Date(trip.end_date), new Date(trip.start_date))) : 1;
  const monthsUntil = trip.start_date ? Math.max(1, differenceInCalendarMonths(new Date(trip.start_date), new Date())) : 1;

  const subtotal = categories.reduce((s, c) => s + computeCategoryTotal(c, travelers, nights), 0);
  const emergency = subtotal * (num(trip.emergency_pct) / 100);
  const total = subtotal + emergency;
  const totalBRL = trip.is_international && trip.exchange_rate ? total * num(trip.exchange_rate) : total;
  const perPerson = travelers > 0 ? totalBRL / travelers : totalBRL;
  const monthlyGoal = totalBRL / monthsUntil;
  const committedPct = availableBalance > 0 ? monthlyGoal / availableBalance : 1;

  const trafficLight = committedPct <= 0.3 ? { color: "text-success", bg: "bg-success", label: "Viável", desc: "A meta cabe confortavelmente no seu saldo disponível." }
    : committedPct <= 0.6 ? { color: "text-warning", bg: "bg-warning", label: "Atenção", desc: "Possível, mas exige disciplina mensal." }
    : { color: "text-destructive", bg: "bg-destructive", label: "Replanejar", desc: "Reveja prazo, destino ou número de viajantes." };

  const [newCat, setNewCat] = useState({ label: "", amount: 0 });

  return (
    <Card>
      <CardHeader><CardTitle className="flex items-center gap-2"><CalendarDays className="h-5 w-5 text-primary" />{trip.name} — {nights} {nights === 1 ? "noite" : "noites"} · {travelers} {travelers === 1 ? "viajante" : "viajantes"}</CardTitle></CardHeader>
      <CardContent>
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
                    <Input className="col-span-2" type="number" value={c.amount} onChange={(e) => onCatUpsert({ ...c, amount: num(e.target.value) })} />
                    <label className="col-span-2 flex items-center gap-1 text-xs"><Switch checked={c.is_per_person} onCheckedChange={(v) => onCatUpsert({ ...c, is_per_person: v })} />Por pessoa</label>
                    <label className="col-span-2 flex items-center gap-1 text-xs"><Switch checked={c.multiply_by_nights} onCheckedChange={(v) => onCatUpsert({ ...c, multiply_by_nights: v })} />× noites</label>
                    <Input className="col-span-1" type="number" placeholder="% lim" value={c.limit_pct ?? ""} onChange={(e) => onCatUpsert({ ...c, limit_pct: e.target.value === "" ? null : num(e.target.value) })} />
                    <div className="col-span-1 text-right text-xs font-medium">{brl(catTotal)}{overLimit && <Badge variant="destructive" className="ml-1 text-[10px]">⚠</Badge>}</div>
                    <Button size="icon" variant="ghost" className="col-span-1" onClick={() => onCatRemove(c.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                  </div>
                );
              })}
            </div>
            <div className="flex gap-2 items-end pt-2 border-t border-border/40">
              <Input placeholder="Nova categoria (ex: Passeios)" value={newCat.label} onChange={(e) => setNewCat({ ...newCat, label: e.target.value })} />
              <Input type="number" placeholder="Valor" className="w-32" value={newCat.amount} onChange={(e) => setNewCat({ ...newCat, amount: num(e.target.value) })} />
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
                const tot = sub * (1 + num(trip.emergency_pct) / 100);
                const totConv = trip.is_international && trip.exchange_rate ? tot * num(trip.exchange_rate) : tot;
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
              <div><Label>Adultos</Label><Input type="number" value={trip.adults} onChange={(e) => onUpdate({ adults: num(e.target.value) })} /></div>
              <div><Label>Crianças</Label><Input type="number" value={trip.children} onChange={(e) => onUpdate({ children: num(e.target.value) })} /></div>
              <div><Label>Início</Label><Input type="date" value={trip.start_date || ""} onChange={(e) => onUpdate({ start_date: e.target.value })} /></div>
              <div><Label>Fim</Label><Input type="date" value={trip.end_date || ""} onChange={(e) => onUpdate({ end_date: e.target.value })} /></div>
              <div><Label>Reserva emergência (%)</Label><Input type="number" value={trip.emergency_pct} onChange={(e) => onUpdate({ emergency_pct: num(e.target.value) })} /></div>
              <div className="flex items-end gap-2"><Switch checked={trip.is_international} onCheckedChange={(v) => onUpdate({ is_international: v })} /><Label>Internacional</Label></div>
              {trip.is_international && <div className="col-span-2"><Label>Câmbio (R$)</Label><Input type="number" step="0.01" value={trip.exchange_rate || ""} onChange={(e) => onUpdate({ exchange_rate: num(e.target.value) })} /></div>}
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
