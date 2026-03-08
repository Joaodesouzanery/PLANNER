import { useState } from "react";
import { useCompany } from "@/contexts/CompanyContext";
import { EMSLayout } from "@/components/ems/EMSLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import {
  Target, Rocket, Users, TrendingUp, CheckCircle2, Clock, DollarSign, Plus, Edit2, Save, X,
  AlertTriangle, UserCheck, Calendar, ArrowUpRight, ArrowDownRight, FolderKanban, ListTodo, Contact,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { RecentActivity } from "@/components/ems/RecentActivity";
import { Link } from "react-router-dom";
import { formatDistanceToNow, parseISO, isBefore, startOfWeek, endOfWeek, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

const iconMap: Record<string, React.ElementType> = { target: Target, rocket: Rocket, users: Users, trending: TrendingUp };

interface Pillar { id: string; title: string; description: string; icon: string; color: string; }
interface MonthlyFocus { id: string; title: string; description: string; }
interface ContactTask { id: string; title: string; priority: string; due_date: string | null; status: string; contact: { id: string; name: string; company: string | null; } | null; }
interface MonthlyData { month: string; income: number; expense: number; }

const Overview = () => {
  const { toast } = useToast();
  const { selectedCompanyId } = useCompany();
  const queryClient = useQueryClient();
  const [editingFocus, setEditingFocus] = useState(false);
  const [focusForm, setFocusForm] = useState({ title: "", description: "" });
  const [editingPillar, setEditingPillar] = useState<string | null>(null);
  const [pillarForm, setPillarForm] = useState({ title: "", description: "" });

  const cf = selectedCompanyId !== "all";
  const cid = selectedCompanyId;
  const currentMonth = new Date().getMonth() + 1;
  const currentYear = new Date().getFullYear();

  const { data: pillars = [] } = useQuery({
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

  const { data: financeData = { totalIncome: 0, totalExpense: 0, balance: 0, monthlyData: [] as MonthlyData[] } } = useQuery({
    queryKey: ["overview-finance", cid],
    queryFn: async () => {
      let q = supabase.from("financial_transactions").select("amount, type, date");
      if (cf) q = q.eq("company_id", cid);
      const { data } = await q;
      if (!data) return { totalIncome: 0, totalExpense: 0, balance: 0, monthlyData: [] as MonthlyData[] };
      let inc = 0, exp = 0;
      data.forEach(t => { if (t.type === "income") inc += Number(t.amount); else exp += Number(t.amount); });
      const months = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
      const monthMap: Record<number, { income: number; expense: number }> = {};
      for (let i = 0; i < 12; i++) monthMap[i] = { income: 0, expense: 0 };
      data.forEach(t => { const d = new Date(t.date); if (d.getFullYear() === currentYear) { const m = d.getMonth(); if (t.type === "income") monthMap[m].income += Number(t.amount); else monthMap[m].expense += Number(t.amount); } });
      return { totalIncome: inc, totalExpense: exp, balance: inc - exp, monthlyData: months.map((m, i) => ({ month: m, income: monthMap[i].income, expense: monthMap[i].expense })) };
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

  const { data: counts = { tasks: 0, projects: 0, contacts: 0 } } = useQuery({
    queryKey: ["overview-counts", cid],
    queryFn: async () => {
      let tcQ = supabase.from("tasks").select("*", { count: "exact", head: true });
      let pcQ = supabase.from("projects").select("*", { count: "exact", head: true });
      let ccQ = supabase.from("contacts").select("*", { count: "exact", head: true });
      if (cf) { tcQ = tcQ.eq("company_id", cid); pcQ = pcQ.eq("company_id", cid); ccQ = ccQ.eq("company_id", cid); }
      const [tc, pc, cc] = await Promise.all([tcQ, pcQ, ccQ]);
      return { tasks: tc.count || 0, projects: pc.count || 0, contacts: cc.count || 0 };
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
        <motion.div variants={itemVariants} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1"><span>Dashboard</span><span>›</span><span className="text-primary">Overview</span></div>
            <h1 className="text-2xl md:text-3xl font-semibold text-foreground tracking-tight">Bem-vindo de volta</h1>
          </div>
          <Badge variant="outline" className="text-xs font-mono px-3 py-1.5 border-border">{format(new Date(), "dd MMM yyyy", { locale: ptBR })}</Badge>
        </motion.div>

        {/* Stat Cards */}
        <motion.div variants={itemVariants} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="stat-card">
            <div className="flex items-center justify-between mb-3"><p className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground font-semibold">Receita Total</p><DollarSign className="h-4 w-4 text-muted-foreground" /></div>
            <p className="text-2xl font-bold font-mono text-foreground">R$ {financeData.totalIncome.toLocaleString("pt-BR", { minimumFractionDigits: 0 })}</p>
            <div className="flex items-center gap-1.5 mt-2">
              <div className="flex gap-[2px]">{[40, 65, 45, 80, 60, 75, 90].map((h, i) => <div key={i} className="w-1.5 rounded-sm bg-primary/60" style={{ height: `${h * 0.2}px` }} />)}</div>
              <span className="text-xs text-emerald-500 font-medium ml-auto"><ArrowUpRight className="h-3 w-3 inline" /> Saldo: R$ {financeData.balance.toLocaleString("pt-BR")}</span>
            </div>
          </div>
          <div className="stat-card">
            <div className="flex items-center justify-between mb-3"><p className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground font-semibold">Projetos</p><FolderKanban className="h-4 w-4 text-muted-foreground" /></div>
            <p className="text-2xl font-bold font-mono text-foreground">{counts.projects}</p>
            <p className="text-sm text-muted-foreground mt-1">Projetos ativos</p>
            <div className="flex items-center gap-1.5 mt-1">
              <div className="flex gap-[2px]">{[30, 50, 70, 40, 60, 80, 55].map((h, i) => <div key={i} className="w-1.5 rounded-sm bg-chart-3/60" style={{ height: `${h * 0.2}px` }} />)}</div>
              <span className="text-xs text-primary font-medium ml-auto">{projectStats.pending} pendentes</span>
            </div>
          </div>
          <div className="stat-card">
            <div className="flex items-center justify-between mb-3"><p className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground font-semibold">Tarefas</p><ListTodo className="h-4 w-4 text-muted-foreground" /></div>
            <p className="text-2xl font-bold font-mono text-foreground">{counts.tasks}</p>
            <p className="text-sm text-muted-foreground mt-1">Total de tarefas</p>
            <div className="flex items-center gap-1.5 mt-1"><Progress value={completionRate} className="h-1.5 flex-1" /><span className="text-xs text-primary font-medium">{completionRate}%</span></div>
          </div>
          <div className="stat-card">
            <div className="flex items-center justify-between mb-3"><p className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground font-semibold">Contatos</p><Contact className="h-4 w-4 text-muted-foreground" /></div>
            <p className="text-2xl font-bold font-mono text-foreground">{counts.contacts}</p>
            <p className="text-sm text-muted-foreground mt-1">Contatos cadastrados</p>
            <div className="flex items-center gap-1.5 mt-1">
              <div className="flex gap-[2px]">{[20, 35, 50, 45, 70, 60, 80].map((h, i) => <div key={i} className="w-1.5 rounded-sm bg-chart-2/60" style={{ height: `${h * 0.2}px` }} />)}</div>
              <span className="text-xs text-emerald-500 font-medium ml-auto"><ArrowUpRight className="h-3 w-3 inline" /> Ativo</span>
            </div>
          </div>
        </motion.div>

        {/* Financial Chart */}
        <motion.div variants={itemVariants}>
          <Card className="border-border">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground font-semibold">Tendência Financeira</CardTitle>
                <div className="flex items-center gap-4 text-xs">
                  <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-primary" /><span className="text-muted-foreground">Receita</span></div>
                  <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-destructive" /><span className="text-muted-foreground">Despesa</span></div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pb-4">
              <div className="h-[250px] w-full">
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
      </motion.div>
    </EMSLayout>
  );
};

export default Overview;
