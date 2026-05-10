import { useState, useContext } from "react";
import { useCompany } from "@/contexts/CompanyContext";
import { AuthContext } from "@/contexts/AuthContext";
import { EMSLayout } from "@/components/ems/EMSLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { motion } from "framer-motion";
import {
  Target, Rocket, Users, TrendingUp, CheckCircle2, Clock, DollarSign, Plus, Edit2, Save, X,
  AlertTriangle, UserCheck, Calendar, ArrowUpRight, ArrowDownRight, FolderKanban, ListTodo, Contact,
  Download, FileText, Folder, ChevronDown, Trash2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { RecentActivity } from "@/components/ems/RecentActivity";
import { Skeleton } from "@/components/ui/skeleton";
import { TrueNorthPanel } from "@/components/ems/TrueNorthPanel";
import { ExecutiveDashboardContent } from "./Executive";
import { OperationalMapPanel } from "@/components/ems/OperationalMapPanel";
import { Link } from "react-router-dom";
import { formatDistanceToNow, parseISO, isBefore, startOfWeek, endOfWeek, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from "recharts";
import { expandRecurringTransactions } from "@/lib/geocode";

const iconMap: Record<string, React.ElementType> = { target: Target, rocket: Rocket, users: Users, trending: TrendingUp };

interface Pillar { id: string; title: string; description: string; icon: string; color: string; }
interface MonthlyFocus { id: string; title: string; description: string; }
interface ContactTask { id: string; title: string; priority: string; due_date: string | null; status: string; contact: { id: string; name: string; company: string | null; } | null; }
interface MonthlyData { month: string; income: number; expense: number; }
interface DashboardReminder { id: string; phrase: string; created_at: string; }

const Overview = () => {
  const { toast } = useToast();
  const { selectedCompanyId } = useCompany();
  const auth = useContext(AuthContext);
  const queryClient = useQueryClient();
  const [editingFocus, setEditingFocus] = useState(false);
  const [focusForm, setFocusForm] = useState({ title: "", description: "" });
  const [editingPillar, setEditingPillar] = useState<string | null>(null);
  const [pillarForm, setPillarForm] = useState({ title: "", description: "" });
  const [remindersOpen, setRemindersOpen] = useState(false);
  const [reminderText, setReminderText] = useState("");

  const cf = selectedCompanyId !== "all";
  const cid = selectedCompanyId;
  const currentMonth = new Date().getMonth() + 1;
  const currentYear = new Date().getFullYear();
  const userName = auth?.user?.email?.split("@")[0]?.replace(/[._]/g, " ") || "";

  const { data: pillars = [], isLoading: pillarsLoading } = useQuery({
    queryKey: ["overview-pillars", cid],
    queryFn: async () => {
      let q = supabase.from("strategic_pillars").select("*").order("order_index");
      if (cf) q = q.eq("company_id", cid);
      const { data } = await q;
      return (data || []) as Pillar[];
    },
  });

  const { data: monthlyFocus = null } = useQuery({
    queryKey: ["overview-focus", cid],
    queryFn: async () => {
      const { data } = await supabase.from("monthly_focus").select("*").eq("month", currentMonth).eq("year", currentYear).maybeSingle();
      if (data) setFocusForm({ title: data.title, description: data.description || "" });
      return data as MonthlyFocus | null;
    },
  });

  const { data: projectStats = { pending: 0, completed: 0 } } = useQuery({
    queryKey: ["overview-project-stats", cid],
    queryFn: async () => {
      let q = supabase.from("projects").select("status");
      if (cf) q = q.eq("company_id", cid);
      const { data } = await q;
      if (!data) return { pending: 0, completed: 0 };
      return { pending: data.filter(t => t.status !== "done").length, completed: data.filter(t => t.status === "done").length };
    },
  });

  const { data: financeData = { totalIncome: 0, totalExpense: 0, monthlyIncome: 0, monthlyExpense: 0, monthlyBalance: 0, balance: 0, monthlyData: [] as MonthlyData[] } } = useQuery({
    queryKey: ["overview-finance", cid],
    queryFn: async () => {
      let q = supabase.from("financial_transactions").select("id, amount, type, date, is_recurring, recurrence_interval, category");
      if (cf) q = q.eq("company_id", cid);
      const { data } = await q;
      if (!data) return { totalIncome: 0, totalExpense: 0, monthlyIncome: 0, monthlyExpense: 0, monthlyBalance: 0, balance: 0, monthlyData: [] as MonthlyData[] };
      const expanded = expandRecurringTransactions(data as any);
      let inc = 0, exp = 0;
      expanded.forEach(t => { if (t.type === "income") inc += Number(t.amount); else exp += Number(t.amount); });
      const months = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
      const monthMap: Record<number, { income: number; expense: number }> = {};
      for (let i = 0; i < 12; i++) monthMap[i] = { income: 0, expense: 0 };
      expanded.forEach(t => { const d = new Date(t.date); if (d.getFullYear() === currentYear) { const m = d.getMonth(); if (t.type === "income") monthMap[m].income += Number(t.amount); else monthMap[m].expense += Number(t.amount); } });
      const monthData = monthMap[currentMonth - 1];
      return { totalIncome: inc, totalExpense: exp, monthlyIncome: monthData.income, monthlyExpense: monthData.expense, monthlyBalance: monthData.income - monthData.expense, balance: inc - exp, monthlyData: months.map((m, i) => ({ month: m, income: monthMap[i].income, expense: monthMap[i].expense })) };
    },
  });

  const { data: contactTasks = [] } = useQuery({
    queryKey: ["overview-contact-tasks", cid],
    queryFn: async () => {
      let q = supabase.from("tasks").select("id, title, priority, due_date, status, contacts(id, name, company)").not("contact_id", "is", null).neq("status", "completed").order("due_date", { ascending: true }).limit(10);
      if (cf) q = q.eq("company_id", cid);
      const { data } = await q;
      return (data || []).map((t: any) => ({ id: t.id, title: t.title, priority: t.priority, due_date: t.due_date, status: t.status, contact: t.contacts })) as ContactTask[];
    },
  });

  const { data: weekTasks = [] } = useQuery({
    queryKey: ["overview-week-tasks", cid],
    queryFn: async () => {
      const now = new Date();
      const ws = startOfWeek(now, { locale: ptBR });
      const we = endOfWeek(now, { locale: ptBR });
      let q = supabase.from("tasks").select("id, title, due_date, status, priority").gte("due_date", format(ws, "yyyy-MM-dd")).lte("due_date", format(we, "yyyy-MM-dd")).order("due_date");
      if (cf) q = q.eq("company_id", cid);
      const { data } = await q;
      return data || [];
    },
  });

  const { data: counts = { tasks: 0, projects: 0, contacts: 0, pendingTasks: 0, completedTasks: 0 }, isLoading: countsLoading } = useQuery({
    queryKey: ["overview-counts", cid],
    queryFn: async () => {
      let tcQ = supabase.from("tasks").select("*", { count: "exact", head: true });
      let pcQ = supabase.from("projects").select("*", { count: "exact", head: true });
      let ccQ = supabase.from("contacts").select("*", { count: "exact", head: true });
      let tpQ = supabase.from("tasks").select("*", { count: "exact", head: true }).neq("status", "completed");
      let tdQ = supabase.from("tasks").select("*", { count: "exact", head: true }).eq("status", "completed");
      if (cf) { tcQ = tcQ.eq("company_id", cid); pcQ = pcQ.eq("company_id", cid); ccQ = ccQ.eq("company_id", cid); tpQ = tpQ.eq("company_id", cid); tdQ = tdQ.eq("company_id", cid); }
      const [tc, pc, cc, tp, td] = await Promise.all([tcQ, pcQ, ccQ, tpQ, tdQ]);
      return { tasks: tc.count || 0, projects: pc.count || 0, contacts: cc.count || 0, pendingTasks: tp.count || 0, completedTasks: td.count || 0 };
    },
  });

  const { data: reminders = [] } = useQuery({
    queryKey: ["dashboard-reminders", cid],
    queryFn: async () => {
      let q = (supabase as any)
        .from("dashboard_reminders")
        .select("id, phrase, created_at")
        .order("created_at", { ascending: false });
      if (cf) q = q.eq("company_id", cid);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as DashboardReminder[];
    },
  });

  const addReminderMutation = useMutation({
    mutationFn: async () => {
      const phrase = reminderText.trim();
      if (!phrase) return;
      const { error } = await (supabase as any).from("dashboard_reminders").insert({
        phrase,
        company_id: selectedCompanyId !== "all" ? selectedCompanyId : null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setReminderText("");
      queryClient.invalidateQueries({ queryKey: ["dashboard-reminders"] });
      toast({ title: "Frase salva!" });
    },
    onError: (error: any) => toast({ title: "Erro ao salvar frase", description: error?.message, variant: "destructive" }),
  });

  const deleteReminderMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("dashboard_reminders").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["dashboard-reminders"] }),
    onError: (error: any) => toast({ title: "Erro ao remover frase", description: error?.message, variant: "destructive" }),
  });

  const { data: recentProjects = [], isLoading: recentLoading } = useQuery({
    queryKey: ["overview-recent-projects", cid],
    queryFn: async () => {
      let q = supabase.from("projects").select("id, title, status, client, updated_at").order("updated_at", { ascending: false }).limit(6);
      if (cf) q = q.eq("company_id", cid);
      const { data } = await q;
      return data || [];
    },
  });

  const { data: weeklyRevenue = [], isLoading: chartLoading } = useQuery({
    queryKey: ["overview-weekly-revenue", cid],
    queryFn: async () => {
      const now = new Date();
      const ws = startOfWeek(now, { locale: ptBR });
      let q = supabase.from("financial_transactions").select("amount, type, date").eq("type", "income").gte("date", format(ws, "yyyy-MM-dd"));
      if (cf) q = q.eq("company_id", cid);
      const { data } = await q;
      const days = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
      const acc = days.map((d) => ({ day: d, value: 0 }));
      (data || []).forEach((t: any) => {
        const dow = (new Date(t.date).getDay() + 6) % 7;
        acc[dow].value += Number(t.amount);
      });
      return acc;
    },
  });

  const saveFocusMutation = useMutation({
    mutationFn: async () => {
      if (monthlyFocus) {
        await supabase.from("monthly_focus").update({ title: focusForm.title, description: focusForm.description }).eq("id", monthlyFocus.id);
      } else {
        await supabase.from("monthly_focus").insert({ title: focusForm.title, description: focusForm.description, month: currentMonth, year: currentYear });
      }
    },
    onSuccess: () => { setEditingFocus(false); queryClient.invalidateQueries({ queryKey: ["overview-focus"] }); toast({ title: "Foco do mês salvo!" }); },
  });

  const addPillarMutation = useMutation({
    mutationFn: async () => {
      await supabase.from("strategic_pillars").insert({ title: "Novo Pilar", description: "Descrição do pilar estratégico", icon: "target", color: "primary", order_index: pillars.length });
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["overview-pillars"] }); toast({ title: "Pilar adicionado!" }); },
  });

  const updatePillarMutation = useMutation({
    mutationFn: async (id: string) => {
      await supabase.from("strategic_pillars").update({ title: pillarForm.title, description: pillarForm.description }).eq("id", id);
    },
    onSuccess: () => { setEditingPillar(null); queryClient.invalidateQueries({ queryKey: ["overview-pillars"] }); toast({ title: "Pilar atualizado!" }); },
  });

  const deletePillarMutation = useMutation({
    mutationFn: async (id: string) => { await supabase.from("strategic_pillars").delete().eq("id", id); },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["overview-pillars"] }); toast({ title: "Pilar removido!" }); },
  });

  const containerVariants = { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.08 } } };
  const itemVariants = { hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0 } };
  const completionRate = (projectStats.pending + projectStats.completed) > 0 ? Math.round((projectStats.completed / (projectStats.pending + projectStats.completed)) * 100) : 0;

  return (
    <EMSLayout>
      <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-6">
        {/* Greeting Header (Orbit-style) */}
        <motion.div variants={itemVariants} className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
              <FolderKanban className="h-3.5 w-3.5" />
              <span>Dashboard</span>
              <span className="text-border">•</span>
              <span>{counts.projects} projetos ativos</span>
            </div>
            <Collapsible open={remindersOpen} onOpenChange={setRemindersOpen} className="max-w-3xl rounded-xl border border-border/50 bg-card/80">
              <CollapsibleTrigger asChild>
                <button className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">Frases para lembrar</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {reminders[0]?.phrase || "Abra para registrar o que precisa ficar no radar."}
                    </p>
                  </div>
                  <ChevronDown className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${remindersOpen ? "rotate-180" : ""}`} />
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="space-y-3 border-t border-border/50 p-3">
                  <div className="flex gap-2">
                    <Input
                      value={reminderText}
                      onChange={(event) => setReminderText(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") addReminderMutation.mutate();
                      }}
                      placeholder="Escreva uma frase curta para lembrar amanha"
                      className="h-9"
                    />
                    <Button size="sm" className="h-9" onClick={() => addReminderMutation.mutate()} disabled={!reminderText.trim()}>
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {reminders.length === 0 ? (
                      <p className="py-3 text-center text-xs text-muted-foreground w-full">Nenhuma frase salva.</p>
                    ) : (
                      reminders.map((item) => (
                        <div key={item.id} className="flex items-center gap-2 rounded-lg border border-border/40 bg-background/50 px-3 py-2 text-sm">
                          <p className="flex-1">{item.phrase}</p>
                          <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-destructive" onClick={() => deleteReminderMutation.mutate(item.id)}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Atualizado às {format(new Date(), "HH:mm")}</span>
            <Button variant="outline" size="sm" className="gap-2 h-9">
              <Download className="h-3.5 w-3.5" /> Exportar
            </Button>
          </div>
        </motion.div>

        <motion.div variants={itemVariants}>
          <OperationalMapPanel height={320} maxSidebarHeight="320px" />
        </motion.div>

        {/* Orbit-style KPI cards: numeral gigante + delta */}
        <motion.div variants={itemVariants} className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {countsLoading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <Card key={i}><CardContent className="p-5 space-y-3">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-10 w-24" />
                <Skeleton className="h-3 w-16" />
              </CardContent></Card>
            ))
          ) : [
            { label: "Projetos Ativos", value: counts.projects, delta: `+${projectStats.pending}`, deltaLabel: "pendentes", Icon: FolderKanban, accent: true },
            { label: "Tarefas Concluídas", value: counts.completedTasks, delta: `+${counts.pendingTasks}`, deltaLabel: "abertas", Icon: CheckCircle2 },
            { label: "Total de Contatos", value: counts.contacts, delta: "ativo", deltaLabel: "este mês", Icon: Contact },
            { label: "Receita do Mês", value: `R$${(financeData.monthlyIncome / 1000).toFixed(1)}k`, delta: financeData.monthlyBalance >= 0 ? `+R$${(financeData.monthlyBalance/1000).toFixed(1)}k` : `-R$${(Math.abs(financeData.monthlyBalance)/1000).toFixed(1)}k`, deltaLabel: "saldo mensal", Icon: DollarSign },
          ].map(({ label, value, delta, deltaLabel, Icon, accent }, i) => (
            <Card key={i} className={`relative overflow-hidden transition-all hover:border-primary/40 ${accent ? "border-primary/30 bg-gradient-to-br from-primary/[0.06] to-card" : ""}`}>
              <CardContent className="p-5">
                <p className="text-xs text-muted-foreground font-medium mb-3">{label}</p>
                <p className="text-4xl md:text-5xl font-bold tracking-tight text-foreground tabular-nums">{value}</p>
                <p className="text-[11px] mt-3">
                  <span className={accent ? "text-primary font-semibold" : "text-emerald-500 font-semibold"}>{delta}</span>
                  <span className="text-muted-foreground ml-1">{deltaLabel}</span>
                </p>
                <Icon className={`absolute right-3 bottom-3 h-14 w-14 ${accent ? "text-primary/20" : "text-muted-foreground/10"}`} strokeWidth={1.2} />
              </CardContent>
            </Card>
          ))}
        </motion.div>

        {/* Weekly chart with highlighted bar + Recent projects */}
        <motion.div variants={itemVariants} className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Card className="lg:col-span-2">
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Receita</p>
                  <CardTitle className="text-3xl font-bold tracking-tight tabular-nums mt-1">
                    R$ {weeklyRevenue.reduce((a, b) => a + b.value, 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                  </CardTitle>
                  <p className="text-xs text-muted-foreground mt-1">
                    Esta semana - mês: R$ {financeData.monthlyIncome.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <Badge variant="outline" className="text-[10px]">Semanal</Badge>
                  <Badge variant="secondary" className="text-[10px]">Mensal</Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="h-[220px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={weeklyRevenue} barCategoryGap="30%">
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} opacity={0.3} />
                    <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} tickFormatter={(v) => v >= 1000 ? `${(v/1000).toFixed(1)}k` : v} />
                    <Tooltip cursor={{ fill: "hsl(var(--muted) / 0.3)" }} contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: 12 }} formatter={(v: number) => [`R$ ${v.toLocaleString("pt-BR")}`, "Receita"]} />
                    <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                      {weeklyRevenue.map((d, i) => {
                        const todayIdx = (new Date().getDay() + 6) % 7;
                        return <Cell key={i} fill={i === todayIdx ? "hsl(var(--primary))" : "hsl(var(--muted))"} />;
                      })}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold">Projetos Recentes</CardTitle>
                <Link to="/ems/projects"><Button variant="ghost" size="sm" className="text-[11px] h-7 text-muted-foreground">Ver todos</Button></Link>
              </div>
            </CardHeader>
            <CardContent className="space-y-1">
              {recentLoading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3 p-2"><Skeleton className="h-7 w-7 rounded" /><div className="flex-1 space-y-1"><Skeleton className="h-3 w-3/4" /><Skeleton className="h-2 w-1/2" /></div></div>
                ))
              ) : recentProjects.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-6">Sem projetos recentes</p>
              ) : recentProjects.map((p: any) => {
                const initials = (p.title || "?").split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase();
                const colors = ["bg-primary/20 text-primary", "bg-chart-2/20 text-chart-2", "bg-chart-3/20 text-chart-3", "bg-chart-4/20 text-chart-4"];
                const colorClass = colors[(p.title || "").length % colors.length];
                return (
                  <Link key={p.id} to="/ems/projects" className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/40 transition-colors">
                    <div className="p-1.5 rounded bg-muted/50"><Folder className="h-3.5 w-3.5 text-muted-foreground" /></div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{p.title}</p>
                      {p.client && <p className="text-[10px] text-muted-foreground truncate">{p.client}</p>}
                    </div>
                    <Avatar className="h-6 w-6">
                      <AvatarFallback className={`text-[10px] font-semibold ${colorClass}`}>{initials}</AvatarFallback>
                    </Avatar>
                  </Link>
                );
              })}
            </CardContent>
          </Card>
        </motion.div>

        {/* Financial Trend (kept) */}
        <motion.div variants={itemVariants}>
          <Card className="border-border">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground font-semibold">Tendência Financeira Anual</CardTitle>
                <div className="flex items-center gap-4 text-xs">
                  <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-primary" /><span className="text-muted-foreground">Receita</span></div>
                  <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-destructive" /><span className="text-muted-foreground">Despesa</span></div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pb-4">
              <div className="h-[220px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={financeData.monthlyData} barCategoryGap="20%">
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                    <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} tickFormatter={(v) => v >= 1000 ? `${v / 1000}k` : v} />
                    <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", color: "hsl(var(--foreground))", fontSize: 12 }} formatter={(value: number, name: string) => [`R$ ${value.toLocaleString("pt-BR")}`, name === "income" ? "Receita" : "Despesa"]} />
                    <Bar dataKey="income" fill="hsl(var(--primary))" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="expense" fill="hsl(var(--destructive))" radius={[3, 3, 0, 0]} opacity={0.7} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Monthly Focus */}
        <motion.div variants={itemVariants}>
          <Card className="border-primary/20 bg-gradient-to-br from-primary/5 via-card to-card">
            <CardHeader className="flex flex-row items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-primary/10 border border-primary/20"><Target className="h-5 w-5 text-primary" /></div>
                <div><p className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground font-semibold">Foco do Mês</p><CardTitle className="text-lg mt-0.5">{format(new Date(), "MMMM yyyy", { locale: ptBR })}</CardTitle></div>
              </div>
              {!editingFocus && <Button variant="ghost" size="icon" onClick={() => setEditingFocus(true)} className="text-muted-foreground"><Edit2 className="h-4 w-4" /></Button>}
            </CardHeader>
            <CardContent>
              {editingFocus ? (
                <div className="space-y-3">
                  <Input placeholder="Título do foco" value={focusForm.title} onChange={(e) => setFocusForm({ ...focusForm, title: e.target.value })} />
                  <Textarea placeholder="Descrição detalhada" value={focusForm.description} onChange={(e) => setFocusForm({ ...focusForm, description: e.target.value })} />
                  <div className="flex gap-2">
                    <Button onClick={() => saveFocusMutation.mutate()} size="sm"><Save className="h-4 w-4 mr-2" />Salvar</Button>
                    <Button variant="ghost" size="sm" onClick={() => setEditingFocus(false)}><X className="h-4 w-4 mr-2" />Cancelar</Button>
                  </div>
                </div>
              ) : (
                <div>
                  <h3 className="text-xl font-bold text-primary mb-1">{monthlyFocus?.title || "Defina seu foco do mês"}</h3>
                  <p className="text-sm text-muted-foreground">{monthlyFocus?.description || "Clique no ícone de edição para definir o objetivo principal."}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Strategic Pillars */}
        <motion.div variants={itemVariants}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground font-semibold">Pilares Estratégicos</h2>
            <Button variant="outline" size="sm" onClick={() => addPillarMutation.mutate()} className="text-xs h-8"><Plus className="h-3 w-3 mr-1.5" />Adicionar</Button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {pillars.map((pillar) => {
              const Icon = iconMap[pillar.icon] || Target;
              return (
                <Card key={pillar.id} className="hover:border-primary/30 transition-all duration-200">
                  <CardContent className="pt-5 pb-4">
                    {editingPillar === pillar.id ? (
                      <div className="space-y-3">
                        <Input value={pillarForm.title} onChange={(e) => setPillarForm({ ...pillarForm, title: e.target.value })} />
                        <Textarea value={pillarForm.description} onChange={(e) => setPillarForm({ ...pillarForm, description: e.target.value })} rows={2} />
                        <div className="flex gap-2">
                          <Button size="sm" onClick={() => updatePillarMutation.mutate(pillar.id)}><Save className="h-3 w-3" /></Button>
                          <Button size="sm" variant="ghost" onClick={() => setEditingPillar(null)}><X className="h-3 w-3" /></Button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center justify-between mb-3">
                          <div className="p-2 rounded-lg bg-primary/10"><Icon className="h-4 w-4 text-primary" /></div>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground" onClick={() => { setEditingPillar(pillar.id); setPillarForm({ title: pillar.title, description: pillar.description || "" }); }}><Edit2 className="h-3 w-3" /></Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive/60 hover:text-destructive" onClick={() => deletePillarMutation.mutate(pillar.id)}><X className="h-3 w-3" /></Button>
                          </div>
                        </div>
                        <h3 className="font-semibold text-foreground text-sm">{pillar.title}</h3>
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{pillar.description}</p>
                      </>
                    )}
                  </CardContent>
                </Card>
              );
            })}
            {pillars.length === 0 && <Card className="col-span-full border-dashed"><CardContent className="py-8 text-center text-muted-foreground text-sm">Nenhum pilar estratégico definido.</CardContent></Card>}
          </div>
        </motion.div>

        {/* Contact Tasks + Weekly Tasks */}
        <motion.div variants={itemVariants} className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2"><UserCheck className="h-4 w-4 text-primary" /><CardTitle className="text-sm">Tarefas de Contatos</CardTitle><Badge variant="secondary" className="text-[10px] h-5">{contactTasks.length}</Badge></div>
                <Link to="/ems/contacts"><Button variant="ghost" size="sm" className="text-xs text-muted-foreground h-7">Ver Todos</Button></Link>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {contactTasks.length > 0 ? contactTasks.slice(0, 5).map((task) => {
                const isOverdue = task.due_date && isBefore(parseISO(task.due_date), new Date());
                return (
                  <div key={task.id} className={`flex items-center gap-3 p-2.5 rounded-lg border transition-colors ${isOverdue ? "border-destructive/30 bg-destructive/5" : "border-border hover:border-primary/20"}`}>
                    <div className={`w-1.5 h-8 rounded-full flex-shrink-0 ${isOverdue ? "bg-destructive" : task.priority === "urgent" ? "bg-destructive" : task.priority === "high" ? "bg-amber-500" : "bg-primary"}`} />
                    <div className="flex-1 min-w-0"><p className="text-sm font-medium truncate">{task.title}</p>{task.contact && <p className="text-[11px] text-muted-foreground truncate">{task.contact.name}</p>}</div>
                    {task.due_date && <span className={`text-[10px] flex-shrink-0 ${isOverdue ? "text-destructive" : "text-muted-foreground"}`}>{format(parseISO(task.due_date), "dd/MM")}</span>}
                  </div>
                );
              }) : <p className="text-sm text-muted-foreground text-center py-4">Sem tarefas de contatos pendentes</p>}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2"><Calendar className="h-4 w-4 text-chart-3" /><CardTitle className="text-sm">Esta Semana</CardTitle><Badge variant="secondary" className="text-[10px] h-5">{weekTasks.length}</Badge></div>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {weekTasks.length > 0 ? weekTasks.slice(0, 5).map((task) => (
                <div key={task.id} className={`flex items-center gap-3 p-2.5 rounded-lg border border-border hover:border-primary/20 transition-colors ${task.status === "completed" ? "opacity-50" : ""}`}>
                  <div className={`w-1.5 h-8 rounded-full flex-shrink-0 ${task.status === "completed" ? "bg-emerald-500" : task.priority === "urgent" ? "bg-destructive" : task.priority === "high" ? "bg-amber-500" : "bg-chart-3"}`} />
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium truncate ${task.status === "completed" ? "line-through text-muted-foreground" : ""}`}>{task.title}</p>
                    {task.due_date && <p className="text-[11px] text-muted-foreground">{format(new Date(task.due_date), "EEEE", { locale: ptBR })}</p>}
                  </div>
                </div>
              )) : <p className="text-sm text-muted-foreground text-center py-4">Nenhuma tarefa esta semana</p>}
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={itemVariants}><RecentActivity /></motion.div>

        <motion.div variants={itemVariants}>
          <TrueNorthPanel />
        </motion.div>

        <motion.div variants={itemVariants} className="pt-2">
          <ExecutiveDashboardContent />
        </motion.div>
      </motion.div>
    </EMSLayout>
  );
};

export default Overview;
