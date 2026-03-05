import { useState, useEffect } from "react";
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
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { RecentActivity } from "@/components/ems/RecentActivity";
import { Link } from "react-router-dom";
import { formatDistanceToNow, parseISO, isBefore } from "date-fns";
import { ptBR } from "date-fns/locale";

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

const Overview = () => {
  const { toast } = useToast();
  const [pillars, setPillars] = useState<Pillar[]>([]);
  const [monthlyFocus, setMonthlyFocus] = useState<MonthlyFocus | null>(null);
  const [pendingTasks, setPendingTasks] = useState(0);
  const [completedTasks, setCompletedTasks] = useState(0);
  const [balance, setBalance] = useState(0);
  const [editingFocus, setEditingFocus] = useState(false);
  const [focusForm, setFocusForm] = useState({ title: "", description: "" });
  const [editingPillar, setEditingPillar] = useState<string | null>(null);
  const [pillarForm, setPillarForm] = useState({ title: "", description: "" });
  const [contactTasks, setContactTasks] = useState<ContactTask[]>([]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    // Fetch pillars
    const { data: pillarsData } = await supabase
      .from("strategic_pillars")
      .select("*")
      .order("order_index");
    
    if (pillarsData) setPillars(pillarsData);

    // Fetch monthly focus
    const currentMonth = new Date().getMonth() + 1;
    const currentYear = new Date().getFullYear();
    const { data: focusData } = await supabase
      .from("monthly_focus")
      .select("*")
      .eq("month", currentMonth)
      .eq("year", currentYear)
      .maybeSingle();
    
    if (focusData) {
      setMonthlyFocus(focusData);
      setFocusForm({ title: focusData.title, description: focusData.description || "" });
    }

    // Fetch tasks stats
    const { data: tasksData } = await supabase
      .from("projects")
      .select("status");
    
    if (tasksData) {
      setPendingTasks(tasksData.filter(t => t.status !== "done").length);
      setCompletedTasks(tasksData.filter(t => t.status === "done").length);
    }

    // Fetch financial balance
    const { data: financialData } = await supabase
      .from("financial_transactions")
      .select("amount, type");

    if (financialData) {
      const total = financialData.reduce((acc, t) => {
        return acc + (t.type === "income" ? Number(t.amount) : -Number(t.amount));
      }, 0);
      setBalance(total);
    }

    // Fetch pending contact tasks
    const { data: contactTasksData } = await supabase
      .from("tasks")
      .select("id, title, priority, due_date, status, contacts(id, name, company)")
      .not("contact_id", "is", null)
      .neq("status", "completed")
      .order("due_date", { ascending: true })
      .limit(10);

    if (contactTasksData) {
      setContactTasks(
        contactTasksData.map((t: any) => ({
          id: t.id,
          title: t.title,
          priority: t.priority,
          due_date: t.due_date,
          status: t.status,
          contact: t.contacts,
        }))
      );
    }
  };

  const saveFocus = async () => {
    const currentMonth = new Date().getMonth() + 1;
    const currentYear = new Date().getFullYear();

    if (monthlyFocus) {
      await supabase
        .from("monthly_focus")
        .update({ title: focusForm.title, description: focusForm.description })
        .eq("id", monthlyFocus.id);
    } else {
      await supabase.from("monthly_focus").insert({
        title: focusForm.title,
        description: focusForm.description,
        month: currentMonth,
        year: currentYear,
      });
    }

    setEditingFocus(false);
    fetchData();
    toast({ title: "Foco do mês salvo!" });
  };

  const addPillar = async () => {
    await supabase.from("strategic_pillars").insert({
      title: "Novo Pilar",
      description: "Descrição do pilar estratégico",
      icon: "target",
      color: "primary",
      order_index: pillars.length,
    });
    fetchData();
    toast({ title: "Pilar adicionado!" });
  };

  const updatePillar = async (id: string) => {
    await supabase
      .from("strategic_pillars")
      .update({ title: pillarForm.title, description: pillarForm.description })
      .eq("id", id);
    setEditingPillar(null);
    fetchData();
    toast({ title: "Pilar atualizado!" });
  };

  const deletePillar = async (id: string) => {
    await supabase.from("strategic_pillars").delete().eq("id", id);
    fetchData();
    toast({ title: "Pilar removido!" });
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.1 },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 },
  };

  return (
    <EMSLayout>
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="space-y-8"
      >
        {/* Page Header */}
        <motion.div variants={itemVariants}>
          <h1 className="text-3xl font-heading font-bold text-foreground">Overview</h1>
          <p className="text-muted-foreground mt-1">Visão executiva do seu negócio</p>
        </motion.div>

        {/* Monthly Focus */}
        <motion.div variants={itemVariants}>
          <Card className="bg-gradient-to-br from-primary/10 via-card to-card border-primary/20">
            <CardHeader className="flex flex-row items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/20">
                  <Target className="h-6 w-6 text-primary" />
                </div>
                <CardTitle className="text-xl">Foco do Mês</CardTitle>
              </div>
              {!editingFocus && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setEditingFocus(true)}
                >
                  <Edit2 className="h-4 w-4" />
                </Button>
              )}
            </CardHeader>
            <CardContent>
              {editingFocus ? (
                <div className="space-y-4">
                  <Input
                    placeholder="Título do foco"
                    value={focusForm.title}
                    onChange={(e) => setFocusForm({ ...focusForm, title: e.target.value })}
                  />
                  <Textarea
                    placeholder="Descrição detalhada"
                    value={focusForm.description}
                    onChange={(e) => setFocusForm({ ...focusForm, description: e.target.value })}
                  />
                  <div className="flex gap-2">
                    <Button onClick={saveFocus}>
                      <Save className="h-4 w-4 mr-2" />
                      Salvar
                    </Button>
                    <Button variant="ghost" onClick={() => setEditingFocus(false)}>
                      <X className="h-4 w-4 mr-2" />
                      Cancelar
                    </Button>
                  </div>
                </div>
              ) : (
                <div>
                  <h3 className="text-2xl font-bold text-primary mb-2">
                    {monthlyFocus?.title || "Defina seu foco do mês"}
                  </h3>
                  <p className="text-muted-foreground">
                    {monthlyFocus?.description || "Clique no ícone de edição para definir o objetivo principal deste mês."}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Strategic Pillars */}
        <motion.div variants={itemVariants}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-heading font-semibold text-foreground">Pilares Estratégicos</h2>
            <Button variant="outline" size="sm" onClick={addPillar}>
              <Plus className="h-4 w-4 mr-2" />
              Adicionar Pilar
            </Button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {pillars.map((pillar) => {
              const Icon = iconMap[pillar.icon] || Target;
              return (
                <Card key={pillar.id} className="hover:border-primary/30 transition-colors">
                  <CardContent className="pt-6">
                    {editingPillar === pillar.id ? (
                      <div className="space-y-3">
                        <Input
                          value={pillarForm.title}
                          onChange={(e) => setPillarForm({ ...pillarForm, title: e.target.value })}
                        />
                        <Textarea
                          value={pillarForm.description}
                          onChange={(e) => setPillarForm({ ...pillarForm, description: e.target.value })}
                          rows={2}
                        />
                        <div className="flex gap-2">
                          <Button size="sm" onClick={() => updatePillar(pillar.id)}>
                            <Save className="h-3 w-3" />
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => setEditingPillar(null)}>
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center justify-between mb-3">
                          <div className="p-2 rounded-lg bg-primary/10">
                            <Icon className="h-5 w-5 text-primary" />
                          </div>
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => {
                                setEditingPillar(pillar.id);
                                setPillarForm({ title: pillar.title, description: pillar.description || "" });
                              }}
                            >
                              <Edit2 className="h-3 w-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive"
                              onClick={() => deletePillar(pillar.id)}
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                        <h3 className="font-semibold text-foreground">{pillar.title}</h3>
                        <p className="text-sm text-muted-foreground mt-1">{pillar.description}</p>
                      </>
                    )}
                  </CardContent>
                </Card>
              );
            })}
            {pillars.length === 0 && (
              <Card className="col-span-full border-dashed">
                <CardContent className="py-8 text-center text-muted-foreground">
                  Nenhum pilar estratégico definido. Clique em "Adicionar Pilar" para começar.
                </CardContent>
              </Card>
            )}
          </div>
        </motion.div>

        {/* Pending Contact Tasks Notifications */}
        {contactTasks.length > 0 && (
          <motion.div variants={itemVariants}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-amber-500/10">
                  <UserCheck className="h-5 w-5 text-amber-500" />
                </div>
                <h2 className="text-xl font-heading font-semibold text-foreground">
                  Tarefas de Contatos Pendentes
                </h2>
                <Badge variant="secondary" className="text-xs">
                  {contactTasks.length}
                </Badge>
              </div>
              <Link to="/ems/contacts">
                <Button variant="outline" size="sm">Ver Todos</Button>
              </Link>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {contactTasks.map((task) => {
                const isOverdue = task.due_date && isBefore(parseISO(task.due_date), new Date());
                return (
                  <Card
                    key={task.id}
                    className={`border-l-4 ${
                      isOverdue
                        ? "border-l-destructive"
                        : task.priority === "urgent"
                        ? "border-l-destructive"
                        : task.priority === "high"
                        ? "border-l-amber-500"
                        : "border-l-primary"
                    }`}
                  >
                    <CardContent className="pt-4 pb-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{task.title}</p>
                          {task.contact && (
                            <p className="text-xs text-muted-foreground mt-1 truncate">
                              {task.contact.name}
                              {task.contact.company && ` - ${task.contact.company}`}
                            </p>
                          )}
                        </div>
                        <Badge
                          variant={task.priority === "urgent" ? "destructive" : "outline"}
                          className="text-xs flex-shrink-0"
                        >
                          {task.priority === "urgent" && "Urgente"}
                          {task.priority === "high" && "Alta"}
                          {task.priority === "medium" && "Média"}
                          {task.priority === "low" && "Baixa"}
                        </Badge>
                      </div>
                      {task.due_date && (
                        <div className={`flex items-center gap-1 mt-2 text-xs ${isOverdue ? "text-destructive" : "text-muted-foreground"}`}>
                          {isOverdue ? (
                            <AlertTriangle className="h-3 w-3" />
                          ) : (
                            <Clock className="h-3 w-3" />
                          )}
                          <span>
                            {isOverdue
                              ? `Atrasada ${formatDistanceToNow(parseISO(task.due_date), { locale: ptBR, addSuffix: false })}`
                              : `Vence ${formatDistanceToNow(parseISO(task.due_date), { locale: ptBR, addSuffix: true })}`}
                          </span>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </motion.div>
        )}

        {/* Quick Stats & Recent Activity */}
        <motion.div variants={itemVariants} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <h2 className="text-xl font-heading font-semibold text-foreground">Resumo Rápido</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-4">
                    <div className="p-3 rounded-xl bg-amber-500/10">
                      <Clock className="h-6 w-6 text-amber-500" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Tarefas Pendentes</p>
                      <p className="text-2xl font-bold text-foreground">{pendingTasks}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-4">
                    <div className="p-3 rounded-xl bg-emerald-500/10">
                      <CheckCircle2 className="h-6 w-6 text-emerald-500" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Tarefas Concluídas</p>
                      <p className="text-2xl font-bold text-foreground">{completedTasks}</p>
                    </div>
                  </div>
                  {(pendingTasks + completedTasks) > 0 && (
                    <div className="mt-4">
                      <Progress value={(completedTasks / (pendingTasks + completedTasks)) * 100} className="h-2" />
                      <p className="text-xs text-muted-foreground mt-1">
                        {Math.round((completedTasks / (pendingTasks + completedTasks)) * 100)}% completo
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-4">
                    <div className={`p-3 rounded-xl ${balance >= 0 ? 'bg-emerald-500/10' : 'bg-destructive/10'}`}>
                      <DollarSign className={`h-6 w-6 ${balance >= 0 ? 'text-emerald-500' : 'text-destructive'}`} />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Saldo Atual</p>
                      <p className={`text-2xl font-bold ${balance >= 0 ? 'text-emerald-500' : 'text-destructive'}`}>
                        R$ {balance.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
          
          {/* Recent Activity */}
          <div>
            <RecentActivity />
          </div>
        </motion.div>
      </motion.div>
    </EMSLayout>
  );
};

export default Overview;
