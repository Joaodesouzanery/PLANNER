import { useState, useEffect } from "react";
import { useCompany } from "@/contexts/CompanyContext";
import { EMSLayout } from "@/components/ems/EMSLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { motion } from "framer-motion";
import {
  FileText,
  Download,
  TrendingUp,
  Target,
  DollarSign,
  Calendar,
  BarChart3,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

interface OKR {
  id: string;
  title: string;
  description: string | null;
  target_value: number;
  current_value: number;
  unit: string;
  period: string;
}

interface Transaction {
  id: string;
  description: string;
  amount: number;
  type: "income" | "expense";
  category: string | null;
  date: string;
}

interface Project {
  id: string;
  title: string;
  status: string;
  priority: string;
}

const COLORS = ["hsl(var(--primary))", "hsl(142.1, 76.2%, 36.3%)", "hsl(0, 84.2%, 60.2%)", "hsl(45, 93%, 47%)"];

const Reports = () => {
  const { toast } = useToast();
  const [okrs, setOkrs] = useState<OKR[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    const [okrsRes, transactionsRes, projectsRes] = await Promise.all([
      supabase.from("okrs").select("*").order("created_at", { ascending: false }),
      supabase.from("financial_transactions").select("*").order("date", { ascending: false }),
      supabase.from("projects").select("*").order("created_at", { ascending: false }),
    ]);

    if (okrsRes.data) setOkrs(okrsRes.data);
    if (transactionsRes.data) setTransactions(transactionsRes.data as Transaction[]);
    if (projectsRes.data) setProjects(projectsRes.data);
  };

  const filteredTransactions = transactions.filter((t) => {
    if (dateFrom && t.date < dateFrom) return false;
    if (dateTo && t.date > dateTo) return false;
    return true;
  });

  // Calculate totals
  const totalIncome = filteredTransactions
    .filter((t) => t.type === "income")
    .reduce((acc, t) => acc + Number(t.amount), 0);
  const totalExpense = filteredTransactions
    .filter((t) => t.type === "expense")
    .reduce((acc, t) => acc + Number(t.amount), 0);
  const balance = totalIncome - totalExpense;

  // Project stats
  const projectStats = {
    total: projects.length,
    todo: projects.filter((p) => p.status === "todo").length,
    inProgress: projects.filter((p) => p.status === "in_progress").length,
    done: projects.filter((p) => p.status === "done").length,
  };

  const projectPieData = [
    { name: "A Fazer", value: projectStats.todo },
    { name: "Em Progresso", value: projectStats.inProgress },
    { name: "Concluído", value: projectStats.done },
  ].filter((d) => d.value > 0);

  // Monthly chart data
  const monthlyData = filteredTransactions.reduce((acc: Record<string, { income: number; expense: number }>, t) => {
    const month = format(new Date(t.date), "MMM/yy", { locale: ptBR });
    if (!acc[month]) acc[month] = { income: 0, expense: 0 };
    if (t.type === "income") {
      acc[month].income += Number(t.amount);
    } else {
      acc[month].expense += Number(t.amount);
    }
    return acc;
  }, {});

  const chartData = Object.entries(monthlyData).map(([month, data]) => ({
    month,
    ...data,
    balance: data.income - data.expense,
  }));

  // OKR average progress
  const avgOkrProgress =
    okrs.length > 0
      ? okrs.reduce((acc, okr) => acc + (okr.current_value / okr.target_value) * 100, 0) / okrs.length
      : 0;

  const exportCSV = () => {
    const headers = "Data,Descrição,Categoria,Tipo,Valor\n";
    const rows = filteredTransactions.map((t) =>
      `${t.date},"${t.description}",${t.category || ""},${t.type === "income" ? "Entrada" : "Saída"},${t.amount}`
    ).join("\n");
    const csv = headers + rows;
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `transacoes-${format(new Date(), "yyyy-MM-dd")}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast({ title: "CSV exportado!" });
  };

  const exportFinancialPDF = () => {
    const doc = new jsPDF();

    // Header
    doc.setFontSize(20);
    doc.setFont("helvetica", "bold");
    doc.text("Relatório Financeiro", 20, 20);

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`Gerado em: ${format(new Date(), "dd/MM/yyyy HH:mm", { locale: ptBR })}`, 20, 30);

    // Summary
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("Resumo Financeiro", 20, 45);

    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    doc.text(`Total de Entradas: R$ ${totalIncome.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`, 20, 55);
    doc.text(`Total de Saídas: R$ ${totalExpense.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`, 20, 63);
    doc.text(`Saldo Atual: R$ ${balance.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`, 20, 71);

    // Transactions table
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("Transações", 20, 90);

    const tableData = transactions.map((t) => [
      format(new Date(t.date), "dd/MM/yyyy"),
      t.description,
      t.category || "-",
      t.type === "income" ? "Entrada" : "Saída",
      `R$ ${Number(t.amount).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,
    ]);

    autoTable(doc, {
      startY: 95,
      head: [["Data", "Descrição", "Categoria", "Tipo", "Valor"]],
      body: tableData,
      theme: "striped",
      headStyles: { fillColor: [59, 130, 246] },
      styles: { fontSize: 9 },
    });

    doc.save(`relatorio-financeiro-${format(new Date(), "yyyy-MM-dd")}.pdf`);
    toast({ title: "PDF exportado com sucesso!" });
  };

  const exportOkrsPDF = () => {
    const doc = new jsPDF();

    // Header
    doc.setFontSize(20);
    doc.setFont("helvetica", "bold");
    doc.text("Relatório de OKRs", 20, 20);

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`Gerado em: ${format(new Date(), "dd/MM/yyyy HH:mm", { locale: ptBR })}`, 20, 30);

    // Summary
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("Resumo de Metas", 20, 45);

    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    doc.text(`Total de OKRs: ${okrs.length}`, 20, 55);
    doc.text(`Progresso Médio: ${avgOkrProgress.toFixed(1)}%`, 20, 63);

    // OKRs table
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("Detalhamento de OKRs", 20, 80);

    const tableData = okrs.map((okr) => {
      const progress = (okr.current_value / okr.target_value) * 100;
      return [
        okr.title,
        okr.description || "-",
        `${okr.current_value} / ${okr.target_value} ${okr.unit}`,
        `${progress.toFixed(1)}%`,
        okr.period === "quarterly" ? "Trimestral" : "Anual",
      ];
    });

    autoTable(doc, {
      startY: 85,
      head: [["Título", "Descrição", "Progresso", "%", "Período"]],
      body: tableData,
      theme: "striped",
      headStyles: { fillColor: [59, 130, 246] },
      styles: { fontSize: 9 },
      columnStyles: {
        1: { cellWidth: 50 },
      },
    });

    doc.save(`relatorio-okrs-${format(new Date(), "yyyy-MM-dd")}.pdf`);
    toast({ title: "PDF exportado com sucesso!" });
  };

  const exportFullReportPDF = () => {
    const doc = new jsPDF();

    // Header
    doc.setFontSize(22);
    doc.setFont("helvetica", "bold");
    doc.text("Relatório Executivo Completo", 20, 20);

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`Gerado em: ${format(new Date(), "dd/MM/yyyy HH:mm", { locale: ptBR })}`, 20, 30);

    // Projects Summary
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("Projetos", 20, 45);

    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    doc.text(`Total: ${projectStats.total} | A Fazer: ${projectStats.todo} | Em Progresso: ${projectStats.inProgress} | Concluídos: ${projectStats.done}`, 20, 55);

    // OKRs Summary
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("OKRs & Metas", 20, 70);

    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    doc.text(`Total de OKRs: ${okrs.length} | Progresso Médio: ${avgOkrProgress.toFixed(1)}%`, 20, 80);

    // Financial Summary
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("Finanças", 20, 95);

    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    doc.text(`Entradas: R$ ${totalIncome.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`, 20, 105);
    doc.text(`Saídas: R$ ${totalExpense.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`, 20, 113);
    doc.text(`Saldo: R$ ${balance.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`, 20, 121);

    // OKRs Table
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("Detalhamento de OKRs", 20, 140);

    const okrTableData = okrs.map((okr) => {
      const progress = (okr.current_value / okr.target_value) * 100;
      return [okr.title, `${okr.current_value}/${okr.target_value}`, `${progress.toFixed(0)}%`];
    });

    autoTable(doc, {
      startY: 145,
      head: [["OKR", "Progresso", "%"]],
      body: okrTableData,
      theme: "striped",
      headStyles: { fillColor: [59, 130, 246] },
      styles: { fontSize: 9 },
    });

    // New page for transactions
    doc.addPage();

    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("Transações Financeiras", 20, 20);

    const transTableData = transactions.slice(0, 30).map((t) => [
      format(new Date(t.date), "dd/MM/yy"),
      t.description.substring(0, 30),
      t.type === "income" ? "+" : "-",
      `R$ ${Number(t.amount).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,
    ]);

    autoTable(doc, {
      startY: 25,
      head: [["Data", "Descrição", "Tipo", "Valor"]],
      body: transTableData,
      theme: "striped",
      headStyles: { fillColor: [59, 130, 246] },
      styles: { fontSize: 9 },
    });

    doc.save(`relatorio-completo-${format(new Date(), "yyyy-MM-dd")}.pdf`);
    toast({ title: "Relatório completo exportado!" });
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
        className="space-y-6"
      >
        {/* Header */}
        <motion.div variants={itemVariants} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-heading font-bold text-foreground">Relatórios</h1>
            <p className="text-muted-foreground mt-1">Dashboard executivo e exportação de dados</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button variant="outline" onClick={exportCSV}>
              <Download className="h-4 w-4 mr-2" />
              CSV
            </Button>
            <Button variant="outline" onClick={exportFinancialPDF}>
              <Download className="h-4 w-4 mr-2" />
              Financeiro (PDF)
            </Button>
            <Button variant="outline" onClick={exportOkrsPDF}>
              <Download className="h-4 w-4 mr-2" />
              OKRs (PDF)
            </Button>
            <Button onClick={exportFullReportPDF}>
              <FileText className="h-4 w-4 mr-2" />
              Relatório Completo
            </Button>
          </div>
        </motion.div>

        {/* Date Range Filter */}
        <motion.div variants={itemVariants} className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="text-xs font-medium text-muted-foreground">De</label>
            <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-[160px]" />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Até</label>
            <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-[160px]" />
          </div>
          {(dateFrom || dateTo) && (
            <Button variant="ghost" size="sm" onClick={() => { setDateFrom(""); setDateTo(""); }}>Limpar filtro</Button>
          )}
        </motion.div>

        {/* Summary Cards */}
        <motion.div variants={itemVariants} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-xl bg-primary/10">
                  <BarChart3 className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Projetos</p>
                  <p className="text-2xl font-bold">{projectStats.total}</p>
                  <p className="text-xs text-muted-foreground">{projectStats.done} concluídos</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-xl bg-amber-500/10">
                  <Target className="h-6 w-6 text-amber-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">OKRs</p>
                  <p className="text-2xl font-bold">{okrs.length}</p>
                  <p className="text-xs text-muted-foreground">{avgOkrProgress.toFixed(0)}% média</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-xl bg-emerald-500/10">
                  <TrendingUp className="h-6 w-6 text-emerald-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Entradas</p>
                  <p className="text-2xl font-bold text-emerald-500">
                    R$ {(totalIncome / 1000).toFixed(1)}k
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className={`p-3 rounded-xl ${balance >= 0 ? "bg-emerald-500/10" : "bg-destructive/10"}`}>
                  <DollarSign className={`h-6 w-6 ${balance >= 0 ? "text-emerald-500" : "text-destructive"}`} />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Saldo</p>
                  <p className={`text-2xl font-bold ${balance >= 0 ? "text-emerald-500" : "text-destructive"}`}>
                    R$ {(balance / 1000).toFixed(1)}k
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Charts */}
        <motion.div variants={itemVariants} className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Financial Chart */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Evolução Financeira Mensal
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-72">
                {chartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                      <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "hsl(var(--card))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "8px",
                        }}
                        formatter={(value: number) => `R$ ${value.toLocaleString("pt-BR")}`}
                      />
                      <Bar dataKey="income" fill="hsl(142.1, 76.2%, 36.3%)" name="Entradas" />
                      <Bar dataKey="expense" fill="hsl(0, 84.2%, 60.2%)" name="Saídas" />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-muted-foreground">
                    Nenhuma transação registrada
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Project Status Pie */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Status dos Projetos
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-72">
                {projectPieData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={projectPieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="value"
                        label={({ name, value }) => `${name}: ${value}`}
                        labelLine={false}
                      >
                        {projectPieData.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "hsl(var(--card))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "8px",
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-muted-foreground">
                    Nenhum projeto cadastrado
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* OKRs Progress */}
        <motion.div variants={itemVariants}>
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Target className="h-5 w-5" />
                Progresso dos OKRs
              </CardTitle>
            </CardHeader>
            <CardContent>
              {okrs.length > 0 ? (
                <div className="space-y-4">
                  {okrs.map((okr) => {
                    const progress = Math.min((okr.current_value / okr.target_value) * 100, 100);
                    return (
                      <div key={okr.id} className="space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{okr.title}</span>
                            <Badge variant="outline" className="text-xs">
                              {okr.period === "quarterly" ? "Trimestral" : "Anual"}
                            </Badge>
                          </div>
                          <span className="text-sm text-muted-foreground">
                            {okr.current_value} / {okr.target_value} {okr.unit}
                          </span>
                        </div>
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${progress}%` }}
                            transition={{ duration: 1, ease: "easeOut" }}
                            className={`h-full rounded-full ${
                              progress >= 100
                                ? "bg-emerald-500"
                                : progress >= 70
                                ? "bg-amber-500"
                                : "bg-primary"
                            }`}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="py-8 text-center text-muted-foreground">
                  Nenhum OKR cadastrado
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Recent Transactions */}
        <motion.div variants={itemVariants}>
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Transações Recentes
              </CardTitle>
            </CardHeader>
            <CardContent>
              {filteredTransactions.length > 0 ? (
                <div className="space-y-3">
                  {filteredTransactions.slice(0, 10).map((t) => (
                    <div
                      key={t.id}
                      className="flex items-center justify-between p-3 rounded-lg border border-border"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-2 h-2 rounded-full ${
                            t.type === "income" ? "bg-emerald-500" : "bg-destructive"
                          }`}
                        />
                        <div>
                          <p className="font-medium text-sm">{t.description}</p>
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(t.date), "dd MMM yyyy", { locale: ptBR })}
                            {t.category && ` • ${t.category}`}
                          </p>
                        </div>
                      </div>
                      <span
                        className={`font-medium ${
                          t.type === "income" ? "text-emerald-500" : "text-destructive"
                        }`}
                      >
                        {t.type === "income" ? "+" : "-"} R${" "}
                        {Number(t.amount).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-8 text-center text-muted-foreground">
                  Nenhuma transação registrada
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </motion.div>
    </EMSLayout>
  );
};

export default Reports;
