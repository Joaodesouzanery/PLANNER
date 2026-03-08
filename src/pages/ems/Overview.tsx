import { useState, useEffect } from "react";
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
  Target,
  Rocket,
  Users,
  TrendingUp,
  CheckCircle2,
  Clock,
  DollarSign,
  Plus,
  Edit2,
  Save,
  X,
  AlertTriangle,
  UserCheck,
  Calendar,
  ArrowUpRight,
  ArrowDownRight,
  FolderKanban,
  ListTodo,
  Contact,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { RecentActivity } from "@/components/ems/RecentActivity";
import { Link } from "react-router-dom";
import { formatDistanceToNow, differenceInDays, parseISO, isBefore, startOfWeek, endOfWeek, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

const iconMap: Record<string, React.ElementType> = {
  target: Target,
  rocket: Rocket,
  users: Users,
  trending: TrendingUp,
};

interface Pillar {
  id: string;
  title: string;
  description: string;
  icon: string;
  color: string;
}

interface MonthlyFocus {
  id: string;
  title: string;
  description: string;
}

interface ContactTask {
  id: string;
  title: string;
  priority: string;
  due_date: string | null;
  status: string;
  contact: {
    id: string;
    name: string;
    company: string | null;
  } | null;
}

interface MonthlyData {
  month: string;
  income: number;
  expense: number;
}

const Overview = () => {
  const { toast } = useToast();
  const [pillars, setPillars] = useState<Pillar[]>([]);
  const [monthlyFocus, setMonthlyFocus] = useState<MonthlyFocus | null>(null);
  const [pendingTasks, setPendingTasks] = useState(0);
  const [completedTasks, setCompletedTasks] = useState(0);
  const [balance, setBalance] = useState(0);
  const [totalIncome, setTotalIncome] = useState(0);
  const [totalExpense, setTotalExpense] = useState(0);
  const [editingFocus, setEditingFocus] = useState(false);
  const [focusForm, setFocusForm] = useState({ title: "", description: "" });
  const [editingPillar, setEditingPillar] = useState<string | null>(null);
  const [pillarForm, setPillarForm] = useState({ title: "", description: "" });
  const [contactTasks, setContactTasks] = useState<ContactTask[]>([]);
  const [weekTasks, setWeekTasks] = useState<{id: string; title: string; due_date: string | null; status: string; priority: string}[]>([]);
  const [totalTasks, setTotalTasks] = useState(0);
  const [projectCount, setProjectCount] = useState(0);
  const [contactCount, setContactCount] = useState(0);
  const [monthlyData, setMonthlyData] = useState<MonthlyData[]>([]);
  const [overdueItems, setOverdueItems] = useState<{id: string; title: string; type: string; dueDate: string; daysOverdue: number}[]>([]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    const { data: pillarsData } = await supabase.from("strategic_pillars").select("*").order("order_index");
    if (pillarsData) setPillars(pillarsData);

    const currentMonth = new Date().getMonth() + 1;
    const currentYear = new Date().getFullYear();
    const { data: focusData } = await supabase.from("monthly_focus").select("*").eq("month", currentMonth).eq("year", currentYear).maybeSingle();
    if (focusData) {
      setMonthlyFocus(focusData);
      setFocusForm({ title: focusData.title, description: focusData.description || "" });
    }

    const { data: tasksData } = await supabase.from("projects").select("status");
    if (tasksData) {
      setPendingTasks(tasksData.filter(t => t.status !== "done").length);
      setCompletedTasks(tasksData.filter(t => t.status === "done").length);
    }

    const { data: financialData } = await supabase.from("financial_transactions").select("amount, type, date");
    if (financialData) {
      let inc = 0, exp = 0;
      financialData.forEach(t => {
        if (t.type === "income") inc += Number(t.amount);
        else exp += Number(t.amount);
      });
      setTotalIncome(inc);
      setTotalExpense(exp);
      setBalance(inc - exp);

      // Build monthly chart data
      const months = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
      const monthMap: Record<number, { income: number; expense: number }> = {};
      for (let i = 0; i < 12; i++) monthMap[i] = { income: 0, expense: 0 };
      financialData.forEach(t => {
        const d = new Date(t.date);
        if (d.getFullYear() === currentYear) {
          const m = d.getMonth();
          if (t.type === "income") monthMap[m].income += Number(t.amount);
          else monthMap[m].expense += Number(t.amount);
        }
      });
      setMonthlyData(months.map((m, i) => ({ month: m, income: monthMap[i].income, expense: monthMap[i].expense })));
    }

    const { data: contactTasksData } = await supabase
      .from("tasks")
      .select("id, title, priority, due_date, status, contacts(id, name, company)")
      .not("contact_id", "is", null)
      .neq("status", "completed")
      .order("due_date", { ascending: true })
      .limit(10);
    if (contactTasksData) {
      setContactTasks(contactTasksData.map((t: any) => ({ id: t.id, title: t.title, priority: t.priority, due_date: t.due_date, status: t.status, contact: t.contacts })));
    }

    const now = new Date();
    const weekStart = startOfWeek(now, { locale: ptBR });
    const weekEnd = endOfWeek(now, { locale: ptBR });
    const { data: weekTasksData } = await supabase
      .from("tasks")
      .select("id, title, due_date, status, priority")
      .gte("due_date", format(weekStart, "yyyy-MM-dd"))
      .lte("due_date", format(weekEnd, "yyyy-MM-dd"))
      .order("due_date");
    if (weekTasksData) setWeekTasks(weekTasksData);

    const { count } = await supabase.from("tasks").select("*", { count: "exact", head: true });
    setTotalTasks(count || 0);

    const { count: projCount } = await supabase.from("projects").select("*", { count: "exact", head: true });
    setProjectCount(projCount || 0);

    const { count: contCount } = await supabase.from("contacts").select("*", { count: "exact", head: true });
    setContactCount(contCount || 0);

    // Fetch overdue items
    const today = new Date();
    const overdue: {id: string; title: string; type: string; dueDate: string; daysOverdue: number}[] = [];
    const { data: overdueTasks } = await supabase.from("tasks").select("id, title, due_date").not("due_date", "is", null).neq("status", "completed").lt("due_date", format(today, "yyyy-MM-dd"));
    overdueTasks?.forEach((t: any) => { const days = differenceInDays(today, parseISO(t.due_date)); overdue.push({ id: t.id, title: t.title, type: "Tarefa", dueDate: t.due_date, daysOverdue: days }); });
    const { data: overdueProjects } = await supabase.from("projects").select("id, title, due_date").not("due_date", "is", null).neq("status", "done").lt("due_date", format(today, "yyyy-MM-dd"));
    overdueProjects?.forEach((p: any) => { const days = differenceInDays(today, parseISO(p.due_date)); overdue.push({ id: p.id, title: p.title, type: "Projeto", dueDate: p.due_date, daysOverdue: days }); });
    const { data: overdueMilestones } = await supabase.from("planning_milestones").select("id, title, due_date").not("due_date", "is", null).eq("completed", false).lt("due_date", format(today, "yyyy-MM-dd"));
    overdueMilestones?.forEach((m: any) => { const days = differenceInDays(today, parseISO(m.due_date)); overdue.push({ id: m.id, title: m.title, type: "Marco", dueDate: m.due_date, daysOverdue: days }); });
    overdue.sort((a, b) => b.daysOverdue - a.daysOverdue);
    setOverdueItems(overdue);
  };

  const saveFocus = async () => {
    const currentMonth = new Date().getMonth() + 1;
    const currentYear = new Date().getFullYear();
    if (monthlyFocus) {
      await supabase.from("monthly_focus").update({ title: focusForm.title, description: focusForm.description }).eq("id", monthlyFocus.id);
    } else {
      await supabase.from("monthly_focus").insert({ title: focusForm.title, description: focusForm.description, month: currentMonth, year: currentYear });
    }
    setEditingFocus(false);
    fetchData();
    toast({ title: "Foco do mês salvo!" });
  };

  const addPillar = async () => {
    await supabase.from("strategic_pillars").insert({ title: "Novo Pilar", description: "Descrição do pilar estratégico", icon: "target", color: "primary", order_index: pillars.length });
    fetchData();
    toast({ title: "Pilar adicionado!" });
  };

  const updatePillar = async (id: string) => {
    await supabase.from("strategic_pillars").update({ title: pillarForm.title, description: pillarForm.description }).eq("id", id);
    setEditingPillar(null);
    fetchData();
    toast({ title: "Pilar atualizado!" });
  };

  const deletePillar = async (id: string) => {
    await supabase.from("strategic_pillars").delete().eq("id", id);
    fetchData();
    toast({ title: "Pilar removido!" });
  };

  const containerVariants = { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.08 } } };
  const itemVariants = { hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0 } };

  const completionRate = (pendingTasks + completedTasks) > 0 ? Math.round((completedTasks / (pendingTasks + completedTasks)) * 100) : 0;

  return (
    <EMSLayout>
      <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-6">
        {/* Breadcrumb + Welcome */}
        <motion.div variants={itemVariants} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <span>Dashboard</span>
              <span>›</span>
              <span className="text-primary">Overview</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-semibold text-foreground tracking-tight">
              Bem-vindo de volta
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs font-mono px-3 py-1.5 border-border">
              {format(new Date(), "dd MMM yyyy", { locale: ptBR })}
            </Badge>
          </div>
        </motion.div>

        {/* Top Stat Cards */}
        <motion.div variants={itemVariants} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Revenue */}
          <div className="stat-card">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground font-semibold">Receita Total</p>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </div>
            <p className="text-2xl font-bold font-mono text-foreground">
              R$ {totalIncome.toLocaleString("pt-BR", { minimumFractionDigits: 0 })}
            </p>
            <div className="flex items-center gap-1.5 mt-2">
              <div className="flex gap-[2px]">
                {[40, 65, 45, 80, 60, 75, 90].map((h, i) => (
                  <div key={i} className="w-1.5 rounded-sm bg-primary/60" style={{ height: `${h * 0.2}px` }} />
                ))}
              </div>
              <span className="text-xs text-emerald-500 font-medium ml-auto">
                <ArrowUpRight className="h-3 w-3 inline" /> Saldo: R$ {balance.toLocaleString("pt-BR")}
              </span>
            </div>
          </div>

          {/* Projects */}
          <div className="stat-card">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground font-semibold">Projetos</p>
              <FolderKanban className="h-4 w-4 text-muted-foreground" />
            </div>
            <p className="text-2xl font-bold font-mono text-foreground">{projectCount}</p>
            <p className="text-sm text-muted-foreground mt-1">Projetos ativos</p>
            <div className="flex items-center gap-1.5 mt-1">
              <div className="flex gap-[2px]">
                {[30, 50, 70, 40, 60, 80, 55].map((h, i) => (
                  <div key={i} className="w-1.5 rounded-sm bg-chart-3/60" style={{ height: `${h * 0.2}px` }} />
                ))}
              </div>
              <span className="text-xs text-primary font-medium ml-auto">{pendingTasks} pendentes</span>
            </div>
          </div>

          {/* Tasks */}
          <div className="stat-card">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground font-semibold">Tarefas</p>
              <ListTodo className="h-4 w-4 text-muted-foreground" />
            </div>
            <p className="text-2xl font-bold font-mono text-foreground">{totalTasks}</p>
            <p className="text-sm text-muted-foreground mt-1">Total de tarefas</p>
            <div className="flex items-center gap-1.5 mt-1">
              <Progress value={completionRate} className="h-1.5 flex-1" />
              <span className="text-xs text-primary font-medium">{completionRate}%</span>
            </div>
          </div>

          {/* Contacts */}
          <div className="stat-card">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground font-semibold">Contatos</p>
              <Contact className="h-4 w-4 text-muted-foreground" />
            </div>
            <p className="text-2xl font-bold font-mono text-foreground">{contactCount}</p>
            <p className="text-sm text-muted-foreground mt-1">Contatos cadastrados</p>
            <div className="flex items-center gap-1.5 mt-1">
              <div className="flex gap-[2px]">
                {[20, 35, 50, 45, 70, 60, 80].map((h, i) => (
                  <div key={i} className="w-1.5 rounded-sm bg-chart-2/60" style={{ height: `${h * 0.2}px` }} />
                ))}
              </div>
              <span className="text-xs text-emerald-500 font-medium ml-auto">
                <ArrowUpRight className="h-3 w-3 inline" /> Ativo
              </span>
            </div>
          </div>
        </motion.div>

        {/* Overdue Alerts */}
        {overdueItems.length > 0 && (
          <motion.div variants={itemVariants}>
            <Card className="border-destructive/30 bg-destructive/5">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-destructive" />
                    <CardTitle className="text-sm text-destructive">Itens Atrasados</CardTitle>
                    <Badge variant="destructive" className="text-xs">{overdueItems.length}</Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {overdueItems.slice(0, 6).map(item => (
                    <div key={`${item.type}-${item.id}`} className="flex items-center gap-2 p-2.5 rounded-lg border border-destructive/20 bg-card/50">
                      <div className="w-1.5 h-8 rounded-full bg-destructive flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{item.title}</p>
                        <div className="flex items-center gap-1.5">
                          <Badge variant="outline" className="text-[10px] border-border/50">{item.type}</Badge>
                          <span className="text-[10px] text-destructive font-medium">{item.daysOverdue}d atrasado</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                {overdueItems.length > 6 && <p className="text-xs text-muted-foreground text-center mt-2">+{overdueItems.length - 6} itens atrasados</p>}
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Financial Trend Chart */}
        <motion.div variants={itemVariants}>
          <Card className="border-border">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <CardTitle className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground font-semibold">
                    Tendência Financeira
                  </CardTitle>
                </div>
                <div className="flex items-center gap-4 text-xs">
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-primary" />
                    <span className="text-muted-foreground">Receita</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-destructive" />
                    <span className="text-muted-foreground">Despesa</span>
                  </div>
                </div>
              </div>
              <div className="mt-2">
                <span className="text-xs text-muted-foreground">Receita Total: </span>
                <span className="text-xl font-bold font-mono text-foreground">
                  R$ {totalIncome.toLocaleString("pt-BR", { minimumFractionDigits: 0 })}
                </span>
              </div>
            </CardHeader>
            <CardContent className="pb-4">
              <div className="h-[250px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthlyData} barCategoryGap="20%">
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                    <XAxis
                      dataKey="month"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                    />
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                      tickFormatter={(v) => v >= 1000 ? `${v / 1000}k` : v}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                        color: "hsl(var(--foreground))",
                        fontSize: 12,
                      }}
                      formatter={(value: number, name: string) => [
                        `R$ ${value.toLocaleString("pt-BR")}`,
                        name === "income" ? "Receita" : "Despesa"
                      ]}
                      labelStyle={{ color: "hsl(var(--muted-foreground))" }}
                    />
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
                <div className="p-2.5 rounded-xl bg-primary/10 border border-primary/20">
                  <Target className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground font-semibold">Foco do Mês</p>
                  <CardTitle className="text-lg mt-0.5">{format(new Date(), "MMMM yyyy", { locale: ptBR })}</CardTitle>
                </div>
              </div>
              {!editingFocus && (
                <Button variant="ghost" size="icon" onClick={() => setEditingFocus(true)} className="text-muted-foreground">
                  <Edit2 className="h-4 w-4" />
                </Button>
              )}
            </CardHeader>
            <CardContent>
              {editingFocus ? (
                <div className="space-y-3">
                  <Input placeholder="Título do foco" value={focusForm.title} onChange={(e) => setFocusForm({ ...focusForm, title: e.target.value })} />
                  <Textarea placeholder="Descrição detalhada" value={focusForm.description} onChange={(e) => setFocusForm({ ...focusForm, description: e.target.value })} />
                  <div className="flex gap-2">
                    <Button onClick={saveFocus} size="sm"><Save className="h-4 w-4 mr-2" />Salvar</Button>
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
            <Button variant="outline" size="sm" onClick={addPillar} className="text-xs h-8">
              <Plus className="h-3 w-3 mr-1.5" />Adicionar
            </Button>
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
                          <Button size="sm" onClick={() => updatePillar(pillar.id)}><Save className="h-3 w-3" /></Button>
                          <Button size="sm" variant="ghost" onClick={() => setEditingPillar(null)}><X className="h-3 w-3" /></Button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center justify-between mb-3">
                          <div className="p-2 rounded-lg bg-primary/10"><Icon className="h-4 w-4 text-primary" /></div>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground" onClick={() => { setEditingPillar(pillar.id); setPillarForm({ title: pillar.title, description: pillar.description || "" }); }}>
                              <Edit2 className="h-3 w-3" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive/60 hover:text-destructive" onClick={() => deletePillar(pillar.id)}>
                              <X className="h-3 w-3" />
                            </Button>
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
            {pillars.length === 0 && (
              <Card className="col-span-full border-dashed">
                <CardContent className="py-8 text-center text-muted-foreground text-sm">
                  Nenhum pilar estratégico definido.
                </CardContent>
              </Card>
            )}
          </div>
        </motion.div>

        {/* Contact Tasks + Weekly Tasks */}
        <motion.div variants={itemVariants} className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Contact Tasks */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <UserCheck className="h-4 w-4 text-primary" />
                  <CardTitle className="text-sm">Tarefas de Contatos</CardTitle>
                  <Badge variant="secondary" className="text-[10px] h-5">{contactTasks.length}</Badge>
                </div>
                <Link to="/ems/contacts">
                  <Button variant="ghost" size="sm" className="text-xs text-muted-foreground h-7">Ver Todos</Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {contactTasks.length > 0 ? contactTasks.slice(0, 5).map((task) => {
                const isOverdue = task.due_date && isBefore(parseISO(task.due_date), new Date());
                return (
                  <div key={task.id} className={`flex items-center gap-3 p-2.5 rounded-lg border transition-colors ${isOverdue ? "border-destructive/30 bg-destructive/5" : "border-border hover:border-primary/20"}`}>
                    <div className={`w-1.5 h-8 rounded-full flex-shrink-0 ${isOverdue ? "bg-destructive" : task.priority === "urgent" ? "bg-destructive" : task.priority === "high" ? "bg-amber-500" : "bg-primary"}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{task.title}</p>
                      {task.contact && <p className="text-[11px] text-muted-foreground truncate">{task.contact.name}</p>}
                    </div>
                    {task.due_date && (
                      <span className={`text-[10px] flex-shrink-0 ${isOverdue ? "text-destructive" : "text-muted-foreground"}`}>
                        {format(parseISO(task.due_date), "dd/MM")}
                      </span>
                    )}
                  </div>
                );
              }) : (
                <p className="text-sm text-muted-foreground text-center py-4">Sem tarefas de contatos pendentes</p>
              )}
            </CardContent>
          </Card>

          {/* This Week */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-chart-3" />
                  <CardTitle className="text-sm">Esta Semana</CardTitle>
                  <Badge variant="secondary" className="text-[10px] h-5">{weekTasks.length}</Badge>
                </div>
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
              )) : (
                <p className="text-sm text-muted-foreground text-center py-4">Nenhuma tarefa esta semana</p>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Recent Activity */}
        <motion.div variants={itemVariants}>
          <RecentActivity />
        </motion.div>
      </motion.div>
    </EMSLayout>
  );
};

export default Overview;