import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BarChart, Bar, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CalendarClock, ChevronLeft, ChevronRight, Plus, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { useToast } from "@/hooks/use-toast";
import { useConfirm } from "@/hooks/useConfirm";
import { cn } from "@/lib/utils";
import { FREQUENCY_OPTIONS, MONTH_LABELS, OBLIGATION_CATEGORIES, dateLabel, today } from "./boardShared";

const STEP_MONTHS: Record<string, number> = { once: 0, monthly: 1, quarterly: 3, semiannual: 6, annual: 12 };
const money = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const makeDate = (year: number, monthIndex: number, day: number) => {
  const d = new Date(year, monthIndex, 1, 12);
  const dim = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(day, dim));
  return d;
};
const isoOf = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** Projeta as datas de vencimento de uma obrigacao recorrente dentro de [from, to]. */
const projectOccurrences = (obl: any, fromISO: string, toISO: string): string[] => {
  const from = new Date(`${fromISO}T12:00:00`);
  const to = new Date(`${toISO}T12:00:00`);
  const start = new Date(`${obl.start_date || fromISO}T12:00:00`);
  const end = obl.end_date ? new Date(`${obl.end_date}T12:00:00`) : null;
  const day = obl.day_of_month || start.getDate();
  const step = (STEP_MONTHS[obl.frequency] ?? 1) * (obl.interval_count || 1);
  const anchorMonth = (obl.frequency === "annual" || obl.frequency === "semiannual") && obl.month_of_year
    ? obl.month_of_year - 1 : start.getMonth();
  const anchorYear = start.getFullYear();
  const res: string[] = [];

  if (obl.frequency === "once" || step === 0) {
    const d = makeDate(anchorYear, anchorMonth, day);
    if (d >= from && d <= to && (!end || d <= end)) res.push(isoOf(d));
    return res;
  }
  for (let k = 0; k < 600; k++) {
    const d = makeDate(anchorYear, anchorMonth + k * step, day);
    if (d > to) break;
    if (d >= from && d >= start && (!end || d <= end)) res.push(isoOf(d));
  }
  return res;
};

const emptyObl = {
  title: "", description: "", category: "fiscal", frequency: "monthly", interval_count: "1",
  day_of_month: "", month_of_year: "", start_date: today(), end_date: "",
  responsible: "", estimated_amount: "", authority: "", status: "active",
};

export const ObligationsCalendarPanel = () => {
  const { selectedCompanyId } = useCompany();
  const { toast } = useToast();
  const confirm = useConfirm();
  const queryClient = useQueryClient();
  const [year, setYear] = useState(new Date().getFullYear());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [form, setForm] = useState(emptyObl);
  const hasCompanyFilter = selectedCompanyId !== "all";
  const companyFilter = (q: any) => hasCompanyFilter ? q.eq("company_id", selectedCompanyId) : q;
  const yearStart = `${year}-01-01`;
  const yearEnd = `${year}-12-31`;
  const todayStr = today();

  const { data: obligations = [] } = useQuery({
    queryKey: ["board-obligations", selectedCompanyId],
    staleTime: 1000 * 60 * 2,
    queryFn: async () => {
      const { data, error } = await companyFilter((supabase as any).from("board_obligations").select("*").order("title"));
      if (error) throw error;
      return data || [];
    },
  });

  const { data: occurrences = [] } = useQuery({
    queryKey: ["board-obligation-occurrences", selectedCompanyId, year],
    staleTime: 1000 * 60 * 2,
    queryFn: async () => {
      const { data, error } = await companyFilter(
        (supabase as any).from("board_obligation_occurrences").select("*").gte("due_date", yearStart).lte("due_date", yearEnd),
      );
      if (error) throw error;
      return data || [];
    },
  });

  // Merge: ocorrencias reais do banco + projecao on-the-fly das recorrentes ativas.
  const byMonth = useMemo(() => {
    const dbByKey: Record<string, any> = {};
    (occurrences as any[]).forEach((o) => { dbByKey[`${o.obligation_id}:${o.due_date}`] = o; });
    const merged: any[] = [...(occurrences as any[])];
    (obligations as any[]).filter((o) => o.status === "active").forEach((obl) => {
      projectOccurrences(obl, yearStart, yearEnd).forEach((due) => {
        const key = `${obl.id}:${due}`;
        if (!dbByKey[key]) merged.push({ id: null, obligation_id: obl.id, due_date: due, status: "pending", amount: obl.estimated_amount, virtual: true, obligation: obl });
      });
    });
    const oblById: Record<string, any> = Object.fromEntries((obligations as any[]).map((o) => [o.id, o]));
    const months: any[][] = Array.from({ length: 12 }, () => []);
    merged.forEach((occ) => {
      const obl = occ.obligation || oblById[occ.obligation_id];
      const m = Number(occ.due_date.slice(5, 7)) - 1;
      const status = occ.status === "pending" && occ.due_date < todayStr ? "overdue" : occ.status;
      if (m >= 0 && m < 12) months[m].push({ ...occ, status, _obl: obl });
    });
    months.forEach((list) => list.sort((a, b) => a.due_date.localeCompare(b.due_date)));
    return months;
  }, [occurrences, obligations, yearStart, yearEnd, todayStr]);

  const chartData = useMemo(() => byMonth.map((list, idx) => ({
    name: MONTH_LABELS[idx],
    pago: list.filter((o) => ["paid", "done"].includes(o.status)).length,
    pendente: list.filter((o) => o.status === "pending").length,
    atrasado: list.filter((o) => o.status === "overdue").length,
  })), [byMonth]);

  const summary = useMemo(() => {
    const flat = byMonth.flat();
    const thisMonth = new Date().getMonth();
    return {
      dueThisMonth: byMonth[thisMonth]?.filter((o) => o.status !== "paid" && o.status !== "done").length || 0,
      overdue: flat.filter((o) => o.status === "overdue").length,
      activeRecurring: (obligations as any[]).filter((o) => o.status === "active" && o.frequency !== "once").length,
    };
  }, [byMonth, obligations]);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["board-obligations"] });
    queryClient.invalidateQueries({ queryKey: ["board-obligation-occurrences"] });
    queryClient.invalidateQueries({ queryKey: ["health-occurrences"] });
  };

  const saveObl = useMutation({
    mutationFn: async () => {
      const occurrencesToSeed = projectOccurrences({
        ...form, interval_count: Number(form.interval_count) || 1,
        day_of_month: form.day_of_month ? Number(form.day_of_month) : null,
        month_of_year: form.month_of_year ? Number(form.month_of_year) : null,
      }, `${year}-01-01`, `${year + 1}-12-31`);
      const nextDue = projectOccurrences({
        ...form, interval_count: Number(form.interval_count) || 1,
        day_of_month: form.day_of_month ? Number(form.day_of_month) : null,
        month_of_year: form.month_of_year ? Number(form.month_of_year) : null,
      }, todayStr, `${year + 2}-12-31`)[0] || null;
      const payload = {
        title: form.title, description: form.description || null, category: form.category,
        frequency: form.frequency, interval_count: Number(form.interval_count) || 1,
        day_of_month: form.day_of_month ? Number(form.day_of_month) : null,
        month_of_year: form.month_of_year ? Number(form.month_of_year) : null,
        start_date: form.start_date || todayStr, end_date: form.end_date || null,
        next_due_date: nextDue, responsible: form.responsible || null,
        estimated_amount: form.estimated_amount ? Number(form.estimated_amount) : null,
        authority: form.authority || null, status: form.status,
        company_id: hasCompanyFilter ? selectedCompanyId : null,
      };
      const table = (supabase as any).from("board_obligations");
      let oblId = editing?.id;
      if (oblId) {
        const { error } = await table.update(payload).eq("id", oblId);
        if (error) throw error;
      } else {
        const { data, error } = await table.insert(payload).select("id").single();
        if (error) throw error;
        oblId = data?.id;
      }
      // Ao editar, remove ocorrencias FUTURAS antigas (ex.: mudou mensal->trimestral)
      // para nao deixar duplicatas; o historico (passado) permanece.
      if (editing?.id && oblId) {
        await (supabase as any).from("board_obligation_occurrences").delete().eq("obligation_id", oblId).gte("due_date", todayStr);
      }
      // Materializa ocorrencias (idempotente via unique index obligation_id+due_date).
      if (oblId && occurrencesToSeed.length) {
        const rows = occurrencesToSeed.map((due) => ({
          obligation_id: oblId, due_date: due,
          period_label: `${due.slice(0, 7)}`,
          amount: form.estimated_amount ? Number(form.estimated_amount) : null,
          company_id: hasCompanyFilter ? selectedCompanyId : null,
        }));
        await (supabase as any).from("board_obligation_occurrences").upsert(rows, { onConflict: "obligation_id,due_date", ignoreDuplicates: true });
      }
    },
    onSuccess: () => {
      invalidate();
      setDialogOpen(false);
      setEditing(null);
      setForm(emptyObl);
      toast({ title: "Obrigação salva" });
    },
    onError: (e: any) => toast({ title: "Erro ao salvar obrigação", description: e?.message, variant: "destructive" }),
  });

  const deleteObl = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("board_obligations").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { invalidate(); toast({ title: "Obrigação removida" }); },
  });

  const toggleOccurrence = useMutation({
    mutationFn: async (occ: any) => {
      const nextStatus = ["paid", "done"].includes(occ.status) ? "pending" : "paid";
      if (occ.id) {
        const { error } = await (supabase as any).from("board_obligation_occurrences").update({
          status: nextStatus, paid_at: nextStatus === "paid" ? todayStr : null,
        }).eq("id", occ.id);
        if (error) throw error;
      } else {
        const { error } = await (supabase as any).from("board_obligation_occurrences").insert({
          obligation_id: occ.obligation_id, due_date: occ.due_date, period_label: occ.due_date.slice(0, 7),
          status: nextStatus, paid_at: nextStatus === "paid" ? todayStr : null,
          amount: occ.amount ?? null, company_id: hasCompanyFilter ? selectedCompanyId : null,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => invalidate(),
    onError: (e: any) => toast({ title: "Erro ao atualizar", description: e?.message, variant: "destructive" }),
  });

  const openNew = () => { setEditing(null); setForm(emptyObl); setDialogOpen(true); };
  const openEdit = (o: any) => {
    setEditing(o);
    setForm({
      title: o.title || "", description: o.description || "", category: o.category || "fiscal",
      frequency: o.frequency || "monthly", interval_count: String(o.interval_count || 1),
      day_of_month: o.day_of_month ? String(o.day_of_month) : "", month_of_year: o.month_of_year ? String(o.month_of_year) : "",
      start_date: o.start_date || today(), end_date: o.end_date || "", responsible: o.responsible || "",
      estimated_amount: o.estimated_amount ? String(o.estimated_amount) : "", authority: o.authority || "", status: o.status || "active",
    });
    setDialogOpen(true);
  };

  const statusTone = (s: string) => s === "overdue" ? "bg-red-500/10 text-red-600 border-red-500/30"
    : ["paid", "done"].includes(s) ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/30"
    : "bg-amber-500/10 text-amber-600 border-amber-500/30";
  const currentMonth = new Date().getMonth();

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setYear((y) => y - 1)}><ChevronLeft className="h-4 w-4" /></Button>
          <span className="text-lg font-bold w-16 text-center">{year}</span>
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setYear((y) => y + 1)}><ChevronRight className="h-4 w-4" /></Button>
        </div>
        <div className="grid grid-cols-3 gap-2 flex-1 sm:max-w-md">
          {[
            { label: "Vencendo no mês", value: summary.dueThisMonth },
            { label: "Atrasadas", value: summary.overdue },
            { label: "Recorrentes", value: summary.activeRecurring },
          ].map((c) => (
            <Card key={c.label}><CardContent className="p-3 text-center"><p className="text-xl font-bold">{c.value}</p><p className="text-[10px] text-muted-foreground">{c.label}</p></CardContent></Card>
          ))}
        </div>
        <Button onClick={openNew}><Plus className="h-4 w-4 mr-1" /> Nova obrigação</Button>
      </div>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Carga de obrigações por mês — {year}</CardTitle></CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
              <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
              <Bar dataKey="pago" stackId="a" fill="hsl(142 76% 36%)" radius={[0, 0, 0, 0]} />
              <Bar dataKey="pendente" stackId="a" fill="hsl(38 92% 50%)" />
              <Bar dataKey="atrasado" stackId="a" fill="hsl(0 84% 60%)" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <div className="grid gap-3 grid-cols-1 md:grid-cols-2 xl:grid-cols-4">
        {byMonth.map((list, idx) => (
          <Card key={idx} className={cn(idx === currentMonth && year === new Date().getFullYear() && "border-primary/50 ring-1 ring-primary/20")}>
            <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center justify-between">{MONTH_LABELS[idx]} <Badge variant="outline" className="text-[10px]">{list.length}</Badge></CardTitle></CardHeader>
            <CardContent className="space-y-1.5">
              {list.length === 0 ? (
                <p className="text-[11px] text-muted-foreground py-2 text-center">—</p>
              ) : list.map((occ, i) => (
                <button
                  key={occ.id || `${occ.obligation_id}-${occ.due_date}-${i}`}
                  type="button"
                  onClick={() => toggleOccurrence.mutate(occ)}
                  className={cn("w-full rounded-md border px-2 py-1.5 text-left transition-colors hover:opacity-80", statusTone(occ.status))}
                  title="Clique para alternar pago/pendente"
                >
                  <p className="text-[11px] font-medium truncate">{occ._obl?.title || "Obrigação"}</p>
                  <p className="text-[10px] opacity-80">{dateLabel(occ.due_date)}{occ.amount ? ` · ${money(Number(occ.amount))}` : ""}</p>
                </button>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Obrigações cadastradas</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {(obligations as any[]).length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Nenhuma obrigação cadastrada.</p>
          ) : (obligations as any[]).map((o) => (
            <div key={o.id} className="flex items-center justify-between gap-2 rounded-lg border p-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold truncate">{o.title}</p>
                <div className="flex flex-wrap gap-1.5 mt-1">
                  <Badge variant="outline" className="text-[10px]">{OBLIGATION_CATEGORIES.find((c) => c.value === o.category)?.label || o.category}</Badge>
                  <Badge variant="secondary" className="text-[10px]">{FREQUENCY_OPTIONS.find((f) => f.value === o.frequency)?.label || o.frequency}</Badge>
                  {o.authority && <Badge variant="outline" className="text-[10px]">{o.authority}</Badge>}
                  {o.next_due_date && <Badge variant="outline" className="text-[10px]">Próx: {dateLabel(o.next_due_date)}</Badge>}
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => openEdit(o)}>Editar</Button>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={async () => { if (await confirm({ title: `Excluir "${o.title}"?`, description: "Remove a obrigação e suas ocorrências.", destructive: true, confirmText: "Excluir" })) deleteObl.mutate(o.id); }}><Trash2 className="h-3.5 w-3.5" /></Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><CalendarClock className="h-4 w-4" />{editing ? "Editar obrigação" : "Nova obrigação"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <Input placeholder="Título (ex: DAS, FGTS, renovação de alvará)" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            <Textarea placeholder="Descrição" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            <div className="grid sm:grid-cols-2 gap-3">
              <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{OBLIGATION_CATEGORIES.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
              </Select>
              <Select value={form.frequency} onValueChange={(v) => setForm({ ...form, frequency: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{FREQUENCY_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
              </Select>
              <div><label className="text-xs text-muted-foreground">Dia do vencimento (1-31)</label><Input type="number" min="1" max="31" value={form.day_of_month} onChange={(e) => setForm({ ...form, day_of_month: e.target.value })} /></div>
              <div><label className="text-xs text-muted-foreground">Mês (1-12, p/ anual)</label><Input type="number" min="1" max="12" value={form.month_of_year} onChange={(e) => setForm({ ...form, month_of_year: e.target.value })} /></div>
              <div><label className="text-xs text-muted-foreground">Início</label><Input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} /></div>
              <div><label className="text-xs text-muted-foreground">Fim (opcional)</label><Input type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} /></div>
              <Input placeholder="Órgão/credor (Receita, Prefeitura...)" value={form.authority} onChange={(e) => setForm({ ...form, authority: e.target.value })} />
              <Input placeholder="Responsável" value={form.responsible} onChange={(e) => setForm({ ...form, responsible: e.target.value })} />
              <Input placeholder="Valor estimado" type="number" value={form.estimated_amount} onChange={(e) => setForm({ ...form, estimated_amount: e.target.value })} />
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Ativa</SelectItem>
                  <SelectItem value="paused">Pausada</SelectItem>
                  <SelectItem value="archived">Arquivada</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={() => saveObl.mutate()} disabled={!form.title.trim() || saveObl.isPending}>{saveObl.isPending ? "Salvando..." : "Salvar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
