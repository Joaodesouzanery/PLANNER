import { useState } from "react";
import { EMSLayout } from "@/components/ems/EMSLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { motion } from "framer-motion";
import {
  DollarSign, FolderKanban, ListTodo, Users, Target, ArrowUpRight, ArrowDownRight, AlertTriangle, Clock,
} from "lucide-react";
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { format, subMonths, startOfMonth, parseISO } from "date-fns";
import { useExecutiveData } from "@/hooks/useExecutiveData";

const CHART_COLORS = [
  "hsl(var(--primary))", "hsl(var(--accent))", "hsl(142 76% 36%)",
  "hsl(38 92% 50%)", "hsl(0 84% 60%)", "hsl(262 83% 58%)", "hsl(199 89% 48%)",
];

const ICON_MAP: Record<string, React.ElementType> = {
  DollarSign, FolderKanban, ListTodo, Users, Target,
};

export const ExecutiveDashboardContent = () => {
  const [dateFrom, setDateFrom] = useState(() => format(startOfMonth(subMonths(new Date(), 1)), "yyyy-MM-dd"));
  const [dateTo, setDateTo] = useState(() => format(new Date(), "yyyy-MM-dd"));
  const [projectStatus, setProjectStatus] = useState("all");
  const [taskPriority, setTaskPriority] = useState("all");

  const { kpis, statusData, monthCompare, okrsAtRisk, overdueTasks, upcomingInvoices, priorityData, raw } = useExecutiveData(dateFrom, dateTo);
  const filteredProjects = raw.projects.filter((p: any) => projectStatus === "all" || p.status === projectStatus);
  const filteredTasks = raw.tasks.filter((t: any) => taskPriority === "all" || t.priority === taskPriority);

  return (
    <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-foreground">Dashboard Executivo</h1>
            <p className="text-sm text-muted-foreground">Visão 360° consolidada de todos os módulos</p>
          </div>
          <div className="flex items-center gap-2">
            <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-36 text-xs" />
            <span className="text-muted-foreground text-xs">até</span>
            <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-36 text-xs" />
          </div>
        </div>

        <Card>
          <CardContent className="p-4 flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
            <div>
              <p className="text-sm font-medium">Filtros avanÃ§ados</p>
              <p className="text-xs text-muted-foreground">{filteredProjects.length} projetos e {filteredTasks.length} tarefas na visÃ£o filtrada</p>
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <Select value={projectStatus} onValueChange={setProjectStatus}>
                <SelectTrigger className="w-full sm:w-[180px]"><SelectValue placeholder="Status do projeto" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os projetos</SelectItem>
                  <SelectItem value="todo">A Fazer</SelectItem>
                  <SelectItem value="in_progress">Em Progresso</SelectItem>
                  <SelectItem value="done">ConcluÃ­dos</SelectItem>
                </SelectContent>
              </Select>
              <Select value={taskPriority} onValueChange={setTaskPriority}>
                <SelectTrigger className="w-full sm:w-[180px]"><SelectValue placeholder="Prioridade" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas prioridades</SelectItem>
                  <SelectItem value="urgent">Urgente</SelectItem>
                  <SelectItem value="high">Alta</SelectItem>
                  <SelectItem value="medium">MÃ©dia</SelectItem>
                  <SelectItem value="low">Baixa</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {kpis.map((kpi, i) => {
            const Icon = ICON_MAP[kpi.icon] || Target;
            return (
              <motion.div key={kpi.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                <Card className="h-full">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <Icon className="h-4 w-4 text-muted-foreground" />
                      {kpi.trend !== undefined && (
                        <Badge variant={kpi.trend >= 0 ? "default" : "destructive"} className="text-[10px] px-1 py-0">
                          {kpi.trend >= 0 ? <ArrowUpRight className="h-3 w-3 mr-0.5" /> : <ArrowDownRight className="h-3 w-3 mr-0.5" />}
                          {Math.abs(kpi.trend)}%
                        </Badge>
                      )}
                    </div>
                    <p className="text-lg md:text-xl font-bold text-foreground">{kpi.value}</p>
                    <p className="text-[11px] text-muted-foreground">{kpi.label}</p>
                    {kpi.sub && <p className="text-[10px] text-muted-foreground mt-1">{kpi.sub}</p>}
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Comparativo Mensal</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthCompare}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="name" className="text-xs fill-muted-foreground" />
                    <YAxis className="text-xs fill-muted-foreground" />
                    <Tooltip formatter={(value: number) => `R$ ${value.toLocaleString("pt-BR")}`} />
                    <Legend />
                    <Bar dataKey="receita" name="Receita" fill="hsl(142 76% 36%)" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="despesa" name="Despesa" fill="hsl(0 84% 60%)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Projetos por Status</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={statusData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={(e) => `${e.name} (${e.value})`}>
                      {statusData.map((_, i) => (
                        <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Tarefas por Prioridade</CardTitle></CardHeader>
            <CardContent>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={priorityData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="name" className="text-xs fill-muted-foreground" />
                    <YAxis allowDecimals={false} className="text-xs fill-muted-foreground" />
                    <Tooltip />
                    <Bar dataKey="value" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Tarefas Atrasadas</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {overdueTasks.length === 0 ? <p className="text-sm text-muted-foreground py-6 text-center">Nenhuma tarefa atrasada</p> : overdueTasks.map((task: any) => (
                <div key={task.id} className="flex items-center justify-between gap-2 text-sm border-b border-border/50 pb-2">
                  <span className="truncate">{task.title}</span>
                  <Badge variant="outline" className="text-[10px]">{task.priority}</Badge>
                </div>
              ))}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">PrÃ³ximas Notas Fiscais</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {upcomingInvoices.length === 0 ? <p className="text-sm text-muted-foreground py-6 text-center">Nenhuma NF programada</p> : upcomingInvoices.map((project: any) => (
                <div key={project.id} className="flex items-center justify-between gap-2 text-sm border-b border-border/50 pb-2">
                  <span className="truncate">{project.title}</span>
                  <span className="text-xs text-muted-foreground">{project.next_invoice_date && format(parseISO(project.next_invoice_date), "dd/MM")}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        {okrsAtRisk.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-destructive" />
                OKRs em Risco ({okrsAtRisk.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {okrsAtRisk.map((okr, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{okr.title}</p>
                      {okr.end_date && (
                        <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          Prazo: {format(parseISO(okr.end_date), "dd/MM/yyyy")}
                        </p>
                      )}
                    </div>
                    <div className="w-24 flex items-center gap-2">
                      <Progress value={okr.progress} className="h-2" />
                      <span className="text-xs text-muted-foreground w-8">{okr.progress}%</span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
    </div>
  );
};

const Executive = () => (
  <EMSLayout>
    <ExecutiveDashboardContent />
  </EMSLayout>
);

export default Executive;
