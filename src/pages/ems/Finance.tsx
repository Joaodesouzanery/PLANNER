import { useState, useEffect } from "react";
import { EMSLayout } from "@/components/ems/EMSLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { motion } from "framer-motion";
import {
  Plus,
  DollarSign,
  Target,
  Edit2,
  Trash2,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from "recharts";

interface OKR {
  id: string;
  title: string;
  description: string | null;
  target_value: number;
  current_value: number;
  unit: string;
  period: string;
  start_date: string | null;
  end_date: string | null;
}

interface Transaction {
  id: string;
  description: string;
  amount: number;
  type: "income" | "expense";
  category: string | null;
  date: string;
  created_at: string;
}

const Finance = () => {
  const { toast } = useToast();
  const [okrs, setOkrs] = useState<OKR[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [showOkrModal, setShowOkrModal] = useState(false);
  const [showTransactionModal, setShowTransactionModal] = useState(false);
  const [editingOkr, setEditingOkr] = useState<OKR | null>(null);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);

  const [okrForm, setOkrForm] = useState({
    title: "",
    description: "",
    target_value: 100,
    current_value: 0,
    unit: "%",
    period: "quarterly",
  });

  const [transactionForm, setTransactionForm] = useState({
    description: "",
    amount: 0,
    type: "income" as "income" | "expense",
    category: "",
    date: format(new Date(), "yyyy-MM-dd"),
  });

  useEffect(() => {
    fetchOkrs();
    fetchTransactions();
  }, []);

  const fetchOkrs = async () => {
    const { data } = await supabase
      .from("okrs")
      .select("*")
      .order("created_at", { ascending: false });
    if (data) setOkrs(data);
  };

  const fetchTransactions = async () => {
    const { data } = await supabase
      .from("financial_transactions")
      .select("*")
      .order("date", { ascending: false });
    if (data) setTransactions(data as Transaction[]);
  };

  const handleSaveOkr = async () => {
    if (editingOkr) {
      await supabase
        .from("okrs")
        .update(okrForm)
        .eq("id", editingOkr.id);
    } else {
      await supabase.from("okrs").insert(okrForm);
    }

    setShowOkrModal(false);
    setEditingOkr(null);
    setOkrForm({
      title: "",
      description: "",
      target_value: 100,
      current_value: 0,
      unit: "%",
      period: "quarterly",
    });
    fetchOkrs();
    toast({ title: editingOkr ? "OKR atualizado!" : "OKR criado!" });
  };

  const handleDeleteOkr = async (id: string) => {
    await supabase.from("okrs").delete().eq("id", id);
    fetchOkrs();
    toast({ title: "OKR removido!" });
  };

  const handleSaveTransaction = async () => {
    if (editingTransaction) {
      await supabase
        .from("financial_transactions")
        .update(transactionForm)
        .eq("id", editingTransaction.id);
    } else {
      await supabase.from("financial_transactions").insert(transactionForm);
    }

    setShowTransactionModal(false);
    setEditingTransaction(null);
    setTransactionForm({
      description: "",
      amount: 0,
      type: "income",
      category: "",
      date: format(new Date(), "yyyy-MM-dd"),
    });
    fetchTransactions();
    toast({ title: editingTransaction ? "Transação atualizada!" : "Transação criada!" });
  };

  const handleDeleteTransaction = async (id: string) => {
    await supabase.from("financial_transactions").delete().eq("id", id);
    fetchTransactions();
    toast({ title: "Transação removida!" });
  };

  // Calculate totals
  const totalIncome = transactions
    .filter((t) => t.type === "income")
    .reduce((acc, t) => acc + Number(t.amount), 0);
  const totalExpense = transactions
    .filter((t) => t.type === "expense")
    .reduce((acc, t) => acc + Number(t.amount), 0);
  const balance = totalIncome - totalExpense;

  // Prepare chart data
  const chartData = transactions
    .slice()
    .reverse()
    .reduce((acc: { date: string; balance: number }[], t, index) => {
      const prevBalance = index > 0 ? acc[index - 1].balance : 0;
      const newBalance = prevBalance + (t.type === "income" ? Number(t.amount) : -Number(t.amount));
      acc.push({
        date: format(new Date(t.date), "dd/MM"),
        balance: newBalance,
      });
      return acc;
    }, []);

  // Monthly burn rate
  const monthlyData = transactions.reduce((acc: Record<string, { income: number; expense: number }>, t) => {
    const month = format(new Date(t.date), "MMM/yy", { locale: ptBR });
    if (!acc[month]) acc[month] = { income: 0, expense: 0 };
    if (t.type === "income") {
      acc[month].income += Number(t.amount);
    } else {
      acc[month].expense += Number(t.amount);
    }
    return acc;
  }, {});

  const burnRateData = Object.entries(monthlyData).map(([month, data]) => ({
    month,
    ...data,
    burnRate: data.expense - data.income,
  }));

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
        <motion.div variants={itemVariants}>
          <h1 className="text-2xl md:text-3xl font-heading font-bold text-foreground">Finanças & Estratégia</h1>
          <p className="text-muted-foreground mt-1">Gestão de OKRs e controle financeiro</p>
        </motion.div>

        <Tabs defaultValue="okrs" className="space-y-6">
          <TabsList>
            <TabsTrigger value="okrs" className="gap-2">
              <Target className="h-4 w-4" />
              OKRs & Metas
            </TabsTrigger>
            <TabsTrigger value="finance" className="gap-2">
              <DollarSign className="h-4 w-4" />
              Gestão de Capital
            </TabsTrigger>
          </TabsList>

          {/* OKRs Tab */}
          <TabsContent value="okrs" className="space-y-6">
            <motion.div variants={itemVariants} className="flex justify-end">
              <Button onClick={() => setShowOkrModal(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Novo OKR
              </Button>
            </motion.div>

            <motion.div variants={itemVariants} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {okrs.map((okr) => {
                const progress = (okr.current_value / okr.target_value) * 100;
                return (
                  <Card key={okr.id} className="hover:border-primary/30 transition-colors">
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle className="text-lg">{okr.title}</CardTitle>
                          {okr.description && (
                            <p className="text-sm text-muted-foreground mt-1">{okr.description}</p>
                          )}
                        </div>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => {
                              setEditingOkr(okr);
                              setOkrForm({
                                title: okr.title,
                                description: okr.description || "",
                                target_value: okr.target_value,
                                current_value: okr.current_value,
                                unit: okr.unit,
                                period: okr.period,
                              });
                              setShowOkrModal(true);
                            }}
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive"
                            onClick={() => handleDeleteOkr(okr.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">Progresso</span>
                          <span className="font-medium">
                            {okr.current_value} / {okr.target_value} {okr.unit}
                          </span>
                        </div>
                        <Progress value={Math.min(progress, 100)} className="h-3" />
                        <div className="flex items-center justify-between">
                          <Badge variant="outline">{okr.period === "quarterly" ? "Trimestral" : "Anual"}</Badge>
                          <span
                            className={`text-sm font-medium ${
                              progress >= 100
                                ? "text-emerald-500"
                                : progress >= 70
                                ? "text-amber-500"
                                : "text-muted-foreground"
                            }`}
                          >
                            {Math.round(progress)}%
                          </span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
              {okrs.length === 0 && (
                <Card className="col-span-full border-dashed">
                  <CardContent className="py-8 text-center text-muted-foreground">
                    Nenhum OKR definido. Clique em "Novo OKR" para começar.
                  </CardContent>
                </Card>
              )}
            </motion.div>
          </TabsContent>

          {/* Finance Tab */}
          <TabsContent value="finance" className="space-y-6">
            {/* Summary Cards */}
            <motion.div variants={itemVariants} className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-4">
                    <div className="p-3 rounded-xl bg-emerald-500/10">
                      <ArrowUpRight className="h-6 w-6 text-emerald-500" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Entradas</p>
                      <p className="text-2xl font-bold text-emerald-500">
                        R$ {totalIncome.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-4">
                    <div className="p-3 rounded-xl bg-destructive/10">
                      <ArrowDownRight className="h-6 w-6 text-destructive" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Saídas</p>
                      <p className="text-2xl font-bold text-destructive">
                        R$ {totalExpense.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
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
                        R$ {balance.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* Charts */}
            {transactions.length > 0 && (
              <motion.div variants={itemVariants} className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Evolução do Capital</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={chartData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                          <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                          <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: "hsl(var(--card))",
                              border: "1px solid hsl(var(--border))",
                              borderRadius: "8px",
                            }}
                          />
                          <Line
                            type="monotone"
                            dataKey="balance"
                            stroke="hsl(var(--primary))"
                            strokeWidth={2}
                            dot={false}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Burn Rate Mensal</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={burnRateData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                          <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                          <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: "hsl(var(--card))",
                              border: "1px solid hsl(var(--border))",
                              borderRadius: "8px",
                            }}
                          />
                          <Bar dataKey="income" fill="hsl(142.1, 76.2%, 36.3%)" name="Entradas" />
                          <Bar dataKey="expense" fill="hsl(0, 84.2%, 60.2%)" name="Saídas" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {/* Transactions Table */}
            <motion.div variants={itemVariants}>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="text-lg">Transações</CardTitle>
                  <Button size="sm" onClick={() => setShowTransactionModal(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Nova Transação
                  </Button>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto -mx-4 sm:mx-0">
                    <Table className="min-w-[600px]">
                      <TableHeader>
                        <TableRow>
                          <TableHead>Data</TableHead>
                          <TableHead>Descrição</TableHead>
                          <TableHead>Categoria</TableHead>
                          <TableHead>Tipo</TableHead>
                          <TableHead className="text-right">Valor</TableHead>
                          <TableHead></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {transactions.map((t) => (
                          <TableRow key={t.id}>
                            <TableCell className="whitespace-nowrap">
                              {format(new Date(t.date), "dd/MM/yyyy")}
                            </TableCell>
                            <TableCell>{t.description}</TableCell>
                            <TableCell>
                              {t.category && <Badge variant="outline">{t.category}</Badge>}
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant="secondary"
                                className={
                                  t.type === "income"
                                    ? "bg-emerald-500/10 text-emerald-500"
                                    : "bg-destructive/10 text-destructive"
                                }
                              >
                                {t.type === "income" ? "Entrada" : "Saída"}
                              </Badge>
                            </TableCell>
                            <TableCell
                              className={`text-right font-medium ${
                                t.type === "income" ? "text-emerald-500" : "text-destructive"
                              }`}
                            >
                              {t.type === "income" ? "+" : "-"} R${" "}
                              {Number(t.amount).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-1 justify-end">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={() => {
                                    setEditingTransaction(t);
                                    setTransactionForm({
                                      description: t.description,
                                      amount: t.amount,
                                      type: t.type,
                                      category: t.category || "",
                                      date: t.date,
                                    });
                                    setShowTransactionModal(true);
                                  }}
                                >
                                  <Edit2 className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-destructive"
                                  onClick={() => handleDeleteTransaction(t.id)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                        {transactions.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                              Nenhuma transação registrada.
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </TabsContent>
        </Tabs>

        {/* OKR Modal */}
        <Dialog
          open={showOkrModal}
          onOpenChange={(open) => {
            if (!open) {
              setShowOkrModal(false);
              setEditingOkr(null);
            }
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingOkr ? "Editar OKR" : "Novo OKR"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <Label>Título</Label>
                <Input
                  value={okrForm.title}
                  onChange={(e) => setOkrForm({ ...okrForm, title: e.target.value })}
                  placeholder="Ex: Aumentar receita mensal"
                />
              </div>
              <div>
                <Label>Descrição</Label>
                <Input
                  value={okrForm.description}
                  onChange={(e) => setOkrForm({ ...okrForm, description: e.target.value })}
                  placeholder="Descrição opcional"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <Label>Meta</Label>
                  <Input
                    type="number"
                    value={okrForm.target_value}
                    onChange={(e) => setOkrForm({ ...okrForm, target_value: Number(e.target.value) })}
                  />
                </div>
                <div>
                  <Label>Atual</Label>
                  <Input
                    type="number"
                    value={okrForm.current_value}
                    onChange={(e) => setOkrForm({ ...okrForm, current_value: Number(e.target.value) })}
                  />
                </div>
                <div>
                  <Label>Unidade</Label>
                  <Input
                    value={okrForm.unit}
                    onChange={(e) => setOkrForm({ ...okrForm, unit: e.target.value })}
                    placeholder="%"
                  />
                </div>
              </div>
              <div>
                <Label>Período</Label>
                <select
                  value={okrForm.period}
                  onChange={(e) => setOkrForm({ ...okrForm, period: e.target.value })}
                  className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="quarterly">Trimestral</option>
                  <option value="yearly">Anual</option>
                </select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowOkrModal(false)}>
                Cancelar
              </Button>
              <Button onClick={handleSaveOkr}>{editingOkr ? "Salvar" : "Criar"}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Transaction Modal */}
        <Dialog
          open={showTransactionModal}
          onOpenChange={(open) => {
            if (!open) {
              setShowTransactionModal(false);
              setEditingTransaction(null);
            }
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingTransaction ? "Editar Transação" : "Nova Transação"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <Label>Descrição</Label>
                <Input
                  value={transactionForm.description}
                  onChange={(e) => setTransactionForm({ ...transactionForm, description: e.target.value })}
                  placeholder="Descrição da transação"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label>Valor (R$)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={transactionForm.amount}
                    onChange={(e) => setTransactionForm({ ...transactionForm, amount: Number(e.target.value) })}
                  />
                </div>
                <div>
                  <Label>Tipo</Label>
                  <select
                    value={transactionForm.type}
                    onChange={(e) =>
                      setTransactionForm({ ...transactionForm, type: e.target.value as "income" | "expense" })
                    }
                    className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="income">Entrada</option>
                    <option value="expense">Saída</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label>Categoria</Label>
                  <Input
                    value={transactionForm.category}
                    onChange={(e) => setTransactionForm({ ...transactionForm, category: e.target.value })}
                    placeholder="Ex: Marketing"
                  />
                </div>
                <div>
                  <Label>Data</Label>
                  <Input
                    type="date"
                    value={transactionForm.date}
                    onChange={(e) => setTransactionForm({ ...transactionForm, date: e.target.value })}
                  />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowTransactionModal(false)}>
                Cancelar
              </Button>
              <Button onClick={handleSaveTransaction}>{editingTransaction ? "Salvar" : "Criar"}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </motion.div>
    </EMSLayout>
  );
};

export default Finance;
