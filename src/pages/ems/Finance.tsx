import { useState, useEffect, useMemo } from "react";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { motion } from "framer-motion";
import {
  Plus, DollarSign, Target, Edit2, Trash2, ArrowUpRight, ArrowDownRight, ShoppingCart,
  TrendingUp, BarChart3, Wallet, Calculator, Clock, Percent, PiggyBank,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format, subMonths, addMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import {
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, PieChart, Pie, Cell, AreaChart, Area, Legend,
} from "recharts";

interface OKR {
  id: string; title: string; description: string | null; target_value: number;
  current_value: number; unit: string; period: string; start_date: string | null; end_date: string | null;
}
interface Transaction {
  id: string; description: string; amount: number; type: "income" | "expense";
  category: string | null; date: string; created_at: string;
}

const PIE_COLORS = ["hsl(var(--primary))", "hsl(142.1, 76.2%, 36.3%)", "hsl(0, 84.2%, 60.2%)", "hsl(45, 93%, 47%)", "hsl(262, 83%, 58%)", "hsl(199, 89%, 48%)", "hsl(330, 80%, 55%)", "hsl(160, 60%, 45%)"];

const Finance = () => {
  const { toast } = useToast();
  const [okrs, setOkrs] = useState<OKR[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [showOkrModal, setShowOkrModal] = useState(false);
  const [showTransactionModal, setShowTransactionModal] = useState(false);
  const [editingOkr, setEditingOkr] = useState<OKR | null>(null);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [filterCategory, setFilterCategory] = useState("");
  const [filterType, setFilterType] = useState("");

  const [okrForm, setOkrForm] = useState({ title: "", description: "", target_value: 100, current_value: 0, unit: "%", period: "quarterly" });
  const [transactionForm, setTransactionForm] = useState({ description: "", amount: 0, type: "income" as "income" | "expense", category: "", date: format(new Date(), "yyyy-MM-dd") });

  // Calculator state
  const [calcGoals, setCalcGoals] = useState<{ id: number; name: string; amount: number }[]>([{ id: 1, name: "", amount: 0 }]);
  const [calcIncome, setCalcIncome] = useState(0);
  const [calcCurrentExpenses, setCalcCurrentExpenses] = useState(0);

  useEffect(() => { fetchOkrs(); fetchTransactions(); }, []);

  const fetchOkrs = async () => { const { data } = await supabase.from("okrs").select("*").order("created_at", { ascending: false }); if (data) setOkrs(data); };
  const fetchTransactions = async () => { const { data } = await supabase.from("financial_transactions").select("*").order("date", { ascending: false }); if (data) setTransactions(data as Transaction[]); };

  const handleSaveOkr = async () => {
    if (editingOkr) { await supabase.from("okrs").update(okrForm).eq("id", editingOkr.id); }
    else { await supabase.from("okrs").insert(okrForm); }
    setShowOkrModal(false); setEditingOkr(null);
    setOkrForm({ title: "", description: "", target_value: 100, current_value: 0, unit: "%", period: "quarterly" });
    fetchOkrs(); toast({ title: editingOkr ? "OKR atualizado!" : "OKR criado!" });
  };
  const handleDeleteOkr = async (id: string) => { await supabase.from("okrs").delete().eq("id", id); fetchOkrs(); toast({ title: "OKR removido!" }); };

  const handleSaveTransaction = async () => {
    if (editingTransaction) { await supabase.from("financial_transactions").update(transactionForm).eq("id", editingTransaction.id); }
    else { await supabase.from("financial_transactions").insert(transactionForm); }
    setShowTransactionModal(false); setEditingTransaction(null);
    setTransactionForm({ description: "", amount: 0, type: "income", category: "", date: format(new Date(), "yyyy-MM-dd") });
    fetchTransactions(); toast({ title: editingTransaction ? "Transação atualizada!" : "Transação criada!" });
  };
  const handleDeleteTransaction = async (id: string) => { await supabase.from("financial_transactions").delete().eq("id", id); fetchTransactions(); toast({ title: "Transação removida!" }); };

  const totalIncome = transactions.filter(t => t.type === "income").reduce((a, t) => a + Number(t.amount), 0);
  const totalExpense = transactions.filter(t => t.type === "expense").reduce((a, t) => a + Number(t.amount), 0);
  const balance = totalIncome - totalExpense;

  const allCategories = useMemo(() => { const cats = new Set<string>(); transactions.forEach(t => { if (t.category) cats.add(t.category); }); return Array.from(cats).sort(); }, [transactions]);

  const filteredTransactions = useMemo(() => transactions.filter(t => {
    if (filterCategory && t.category !== filterCategory) return false;
    if (filterType && t.type !== filterType) return false;
    return true;
  }), [transactions, filterCategory, filterType]);

  const monthlyData = useMemo(() => {
    const months: { month: string; income: number; expense: number; balance: number }[] = [];
    for (let i = 11; i >= 0; i--) {
      const d = subMonths(new Date(), i); const key = format(d, "yyyy-MM"); const label = format(d, "MMM/yy", { locale: ptBR });
      const monthTx = transactions.filter(t => t.date.startsWith(key));
      const inc = monthTx.filter(t => t.type === "income").reduce((a, t) => a + Number(t.amount), 0);
      const exp = monthTx.filter(t => t.type === "expense").reduce((a, t) => a + Number(t.amount), 0);
      months.push({ month: label, income: inc, expense: exp, balance: inc - exp });
    }
    return months;
  }, [transactions]);

  const incomeByCat = useMemo(() => {
    const map: Record<string, number> = {};
    transactions.filter(t => t.type === "income").forEach(t => { const cat = t.category || "Sem categoria"; map[cat] = (map[cat] || 0) + Number(t.amount); });
    return Object.entries(map).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [transactions]);

  const expenseByCat = useMemo(() => {
    const map: Record<string, number> = {};
    transactions.filter(t => t.type === "expense").forEach(t => { const cat = t.category || "Sem categoria"; map[cat] = (map[cat] || 0) + Number(t.amount); });
    return Object.entries(map).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [transactions]);

  const projectionData = useMemo(() => {
    const last3 = monthlyData.slice(-3);
    const avgInc = last3.length > 0 ? last3.reduce((a, m) => a + m.income, 0) / last3.length : 0;
    const avgExp = last3.length > 0 ? last3.reduce((a, m) => a + m.expense, 0) / last3.length : 0;
    const projected: { month: string; income: number; expense: number; balance: number; projected: boolean }[] = [];
    last3.forEach(m => projected.push({ ...m, projected: false }));
    for (let i = 1; i <= 3; i++) { const d = addMonths(new Date(), i); projected.push({ month: format(d, "MMM/yy", { locale: ptBR }), income: Math.round(avgInc), expense: Math.round(avgExp), balance: Math.round(avgInc - avgExp), projected: true }); }
    return projected;
  }, [monthlyData]);

  const capitalEvolution = useMemo(() => { let running = 0; return monthlyData.map(m => { running += m.balance; return { month: m.month, capital: running }; }); }, [monthlyData]);

  const fmtCurrency = (v: number) => `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
  const tooltipStyle = { backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "12px" };

  // Calculator computations
  const calcTotalGoal = calcGoals.reduce((a, g) => a + (g.amount || 0), 0);
  const calcAvailableToSave = Math.max(0, calcIncome - calcCurrentExpenses);
  const calcMonthsNeeded = calcAvailableToSave > 0 ? Math.ceil(calcTotalGoal / calcAvailableToSave) : 0;
  const calcSavingsPercent = calcIncome > 0 ? ((calcAvailableToSave / calcIncome) * 100) : 0;

  // Auto-fill calculator from real data
  const autoFillCalc = () => {
    const last3 = monthlyData.slice(-3);
    const avgInc = last3.length > 0 ? last3.reduce((a, m) => a + m.income, 0) / last3.length : 0;
    const avgExp = last3.length > 0 ? last3.reduce((a, m) => a + m.expense, 0) / last3.length : 0;
    setCalcIncome(Math.round(avgInc));
    setCalcCurrentExpenses(Math.round(avgExp));
    toast({ title: "Valores preenchidos com base na média dos últimos 3 meses" });
  };

  const addCalcGoal = () => setCalcGoals([...calcGoals, { id: Date.now(), name: "", amount: 0 }]);
  const removeCalcGoal = (id: number) => setCalcGoals(calcGoals.filter(g => g.id !== id));
  const updateCalcGoal = (id: number, field: "name" | "amount", value: string | number) => setCalcGoals(calcGoals.map(g => g.id === id ? { ...g, [field]: value } : g));

  return (
    <EMSLayout>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-heading font-bold text-foreground flex items-center gap-2">
            <div className="p-2 rounded-xl bg-primary/10"><DollarSign className="h-6 w-6 text-primary" /></div>
            Finanças & Estratégia
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">Dashboard financeiro detalhado com projeções</p>
        </div>

        <Tabs defaultValue="dashboard" className="space-y-6">
          <TabsList className="grid w-full grid-cols-5 bg-card/80 border border-border/50 rounded-xl p-1">
            <TabsTrigger value="dashboard" className="gap-1.5 rounded-lg data-[state=active]:bg-primary/15 data-[state=active]:text-primary"><BarChart3 className="h-4 w-4" /><span className="hidden sm:inline">Dashboard</span></TabsTrigger>
            <TabsTrigger value="okrs" className="gap-1.5 rounded-lg data-[state=active]:bg-primary/15 data-[state=active]:text-primary"><Target className="h-4 w-4" /><span className="hidden sm:inline">OKRs</span></TabsTrigger>
            <TabsTrigger value="transactions" className="gap-1.5 rounded-lg data-[state=active]:bg-primary/15 data-[state=active]:text-primary"><Wallet className="h-4 w-4" /><span className="hidden sm:inline">Transações</span></TabsTrigger>
            <TabsTrigger value="projections" className="gap-1.5 rounded-lg data-[state=active]:bg-primary/15 data-[state=active]:text-primary"><TrendingUp className="h-4 w-4" /><span className="hidden sm:inline">Projeções</span></TabsTrigger>
            <TabsTrigger value="calculator" className="gap-1.5 rounded-lg data-[state=active]:bg-primary/15 data-[state=active]:text-primary"><Calculator className="h-4 w-4" /><span className="hidden sm:inline">Calculadora</span></TabsTrigger>
          </TabsList>

          {/* ============ DASHBOARD ============ */}
          <TabsContent value="dashboard" className="space-y-6">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: "Entradas", value: fmtCurrency(totalIncome), icon: ArrowUpRight, color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/20" },
                { label: "Saídas", value: fmtCurrency(totalExpense), icon: ArrowDownRight, color: "text-destructive", bg: "bg-destructive/10", border: "border-destructive/20" },
                { label: "Saldo", value: fmtCurrency(balance), icon: DollarSign, color: balance >= 0 ? "text-emerald-400" : "text-destructive", bg: balance >= 0 ? "bg-emerald-500/10" : "bg-destructive/10", border: balance >= 0 ? "border-emerald-500/20" : "border-destructive/20" },
                { label: "Transações", value: transactions.length, icon: Wallet, color: "text-primary", bg: "bg-primary/10", border: "border-primary/20" },
              ].map((s, i) => (
                <motion.div key={s.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                  <Card className={cn("border transition-all duration-300 hover:scale-[1.03]", s.border)}>
                    <CardContent className="p-4 flex items-center gap-3">
                      <div className={cn("p-2 rounded-lg", s.bg)}><s.icon className={cn("h-5 w-5", s.color)} /></div>
                      <div><p className="text-lg sm:text-xl font-bold font-mono">{s.value}</p><p className="text-[10px] sm:text-xs text-muted-foreground">{s.label}</p></div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card className="border border-border/50 bg-card/80">
                <CardHeader className="pb-2"><CardTitle className="text-base">Receita vs Despesa Mensal</CardTitle></CardHeader>
                <CardContent><div className="h-[280px]"><ResponsiveContainer width="100%" height="100%"><BarChart data={monthlyData}><CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" /><XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={11} /><YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} /><Tooltip contentStyle={tooltipStyle} formatter={(v: number) => fmtCurrency(v)} /><Legend /><Bar dataKey="income" fill="hsl(142.1, 76.2%, 36.3%)" name="Entradas" radius={[4, 4, 0, 0]} /><Bar dataKey="expense" fill="hsl(0, 84.2%, 60.2%)" name="Saídas" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer></div></CardContent>
              </Card>
              <Card className="border border-border/50 bg-card/80">
                <CardHeader className="pb-2"><CardTitle className="text-base">Evolução do Capital</CardTitle></CardHeader>
                <CardContent><div className="h-[280px]"><ResponsiveContainer width="100%" height="100%"><AreaChart data={capitalEvolution}><CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" /><XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={11} /><YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} /><Tooltip contentStyle={tooltipStyle} formatter={(v: number) => fmtCurrency(v)} /><Area type="monotone" dataKey="capital" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.15} strokeWidth={2} /></AreaChart></ResponsiveContainer></div></CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card className="border border-border/50 bg-card/80">
                <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><ArrowUpRight className="h-4 w-4 text-emerald-400" />Receita por Categoria</CardTitle></CardHeader>
                <CardContent>
                  <div className="h-[250px]">{incomeByCat.length > 0 ? (<ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={incomeByCat} cx="50%" cy="50%" innerRadius={45} outerRadius={80} paddingAngle={3} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>{incomeByCat.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}</Pie><Tooltip contentStyle={tooltipStyle} formatter={(v: number) => fmtCurrency(v)} /></PieChart></ResponsiveContainer>) : <div className="h-full flex items-center justify-center text-muted-foreground text-sm italic">Nenhuma receita</div>}</div>
                  {incomeByCat.length > 0 && <div className="space-y-2 mt-2">{incomeByCat.map((c, i) => (<div key={c.name} className="flex items-center justify-between text-sm"><div className="flex items-center gap-2"><div className="w-3 h-3 rounded-sm" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} /><span className="text-muted-foreground">{c.name}</span></div><span className="font-medium font-mono text-emerald-400">{fmtCurrency(c.value)}</span></div>))}</div>}
                </CardContent>
              </Card>
              <Card className="border border-border/50 bg-card/80">
                <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><ArrowDownRight className="h-4 w-4 text-destructive" />Despesas por Categoria</CardTitle></CardHeader>
                <CardContent>
                  <div className="h-[250px]">{expenseByCat.length > 0 ? (<ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={expenseByCat} cx="50%" cy="50%" innerRadius={45} outerRadius={80} paddingAngle={3} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>{expenseByCat.map((_, i) => <Cell key={i} fill={PIE_COLORS[(i + 2) % PIE_COLORS.length]} />)}</Pie><Tooltip contentStyle={tooltipStyle} formatter={(v: number) => fmtCurrency(v)} /></PieChart></ResponsiveContainer>) : <div className="h-full flex items-center justify-center text-muted-foreground text-sm italic">Nenhuma despesa</div>}</div>
                  {expenseByCat.length > 0 && <div className="space-y-2 mt-2">{expenseByCat.map((c, i) => (<div key={c.name} className="flex items-center justify-between text-sm"><div className="flex items-center gap-2"><div className="w-3 h-3 rounded-sm" style={{ backgroundColor: PIE_COLORS[(i + 2) % PIE_COLORS.length] }} /><span className="text-muted-foreground">{c.name}</span></div><span className="font-medium font-mono text-destructive">{fmtCurrency(c.value)}</span></div>))}</div>}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* ============ OKRs ============ */}
          <TabsContent value="okrs" className="space-y-6">
            <div className="flex justify-end"><Button onClick={() => setShowOkrModal(true)} className="rounded-xl shadow-lg shadow-primary/20"><Plus className="h-4 w-4 mr-2" />Novo OKR</Button></div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {okrs.map(okr => {
                const progress = (okr.current_value / okr.target_value) * 100;
                return (
                  <Card key={okr.id} className="border border-border/50 bg-card/80 hover:border-primary/30 transition-all duration-300 hover:shadow-md hover:shadow-primary/5">
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between">
                        <div><CardTitle className="text-lg">{okr.title}</CardTitle>{okr.description && <p className="text-sm text-muted-foreground mt-1">{okr.description}</p>}</div>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-primary/10 hover:text-primary" onClick={() => { setEditingOkr(okr); setOkrForm({ title: okr.title, description: okr.description || "", target_value: okr.target_value, current_value: okr.current_value, unit: okr.unit, period: okr.period }); setShowOkrModal(true); }}><Edit2 className="h-4 w-4" /></Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10" onClick={() => handleDeleteOkr(okr.id)}><Trash2 className="h-4 w-4" /></Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        <div className="flex items-center justify-between text-sm"><span className="text-muted-foreground">Progresso</span><span className="font-medium font-mono">{okr.current_value} / {okr.target_value} {okr.unit}</span></div>
                        <Progress value={Math.min(progress, 100)} className="h-3" />
                        <div className="flex items-center justify-between">
                          <Badge variant="outline" className="border-border/50">{okr.period === "quarterly" ? "Trimestral" : "Anual"}</Badge>
                          <span className={cn("text-sm font-bold font-mono", progress >= 100 ? "text-emerald-400" : progress >= 70 ? "text-amber-400" : "text-muted-foreground")}>{Math.round(progress)}%</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
              {okrs.length === 0 && <Card className="col-span-full border-dashed border-primary/20"><CardContent className="py-8 text-center text-muted-foreground italic">Nenhum OKR definido.</CardContent></Card>}
            </div>
          </TabsContent>

          {/* ============ TRANSACTIONS ============ */}
          <TabsContent value="transactions" className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
              <div className="flex gap-2">
                <Select value={filterType || "all"} onValueChange={v => setFilterType(v === "all" ? "" : v)}><SelectTrigger className="w-[140px] rounded-xl bg-card/50 border-border/50"><SelectValue placeholder="Tipo" /></SelectTrigger><SelectContent><SelectItem value="all">Todos</SelectItem><SelectItem value="income">Entradas</SelectItem><SelectItem value="expense">Saídas</SelectItem></SelectContent></Select>
                <Select value={filterCategory || "all"} onValueChange={v => setFilterCategory(v === "all" ? "" : v)}><SelectTrigger className="w-[160px] rounded-xl bg-card/50 border-border/50"><SelectValue placeholder="Categoria" /></SelectTrigger><SelectContent><SelectItem value="all">Todas</SelectItem>{allCategories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select>
              </div>
              <Button size="sm" onClick={() => setShowTransactionModal(true)} className="rounded-xl shadow-lg shadow-primary/20"><Plus className="h-4 w-4 mr-2" />Nova Transação</Button>
            </div>
            <Card className="border border-border/50 bg-card/80">
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader><TableRow><TableHead>Data</TableHead><TableHead>Descrição</TableHead><TableHead>Categoria</TableHead><TableHead>Tipo</TableHead><TableHead className="text-right">Valor</TableHead><TableHead></TableHead></TableRow></TableHeader>
                    <TableBody>
                      {filteredTransactions.map(t => (
                        <TableRow key={t.id} className="hover:bg-muted/30">
                          <TableCell className="whitespace-nowrap font-mono text-xs">{format(new Date(t.date), "dd/MM/yyyy")}</TableCell>
                          <TableCell>{t.description}</TableCell>
                          <TableCell>{t.category && <Badge variant="outline" className="border-border/50">{t.category}</Badge>}</TableCell>
                          <TableCell><Badge variant="secondary" className={t.type === "income" ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30" : "bg-destructive/10 text-destructive border border-destructive/30"}>{t.type === "income" ? "Entrada" : "Saída"}</Badge></TableCell>
                          <TableCell className={cn("text-right font-medium font-mono", t.type === "income" ? "text-emerald-400" : "text-destructive")}>{t.type === "income" ? "+" : "-"} {fmtCurrency(Number(t.amount))}</TableCell>
                          <TableCell>
                            <div className="flex gap-1 justify-end">
                              <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-primary/10 hover:text-primary" onClick={() => { setEditingTransaction(t); setTransactionForm({ description: t.description, amount: t.amount, type: t.type, category: t.category || "", date: t.date }); setShowTransactionModal(true); }}><Edit2 className="h-4 w-4" /></Button>
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10" onClick={() => handleDeleteTransaction(t.id)}><Trash2 className="h-4 w-4" /></Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                      {filteredTransactions.length === 0 && <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground italic">Nenhuma transação encontrada.</TableCell></TableRow>}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ============ PROJECTIONS ============ */}
          <TabsContent value="projections" className="space-y-6">
            <Card className="border border-border/50 bg-card/80">
              <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><TrendingUp className="h-4 w-4 text-primary" />Projeção Mensal (3 meses)</CardTitle></CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground mb-4 italic">Baseado na média dos últimos 3 meses.</p>
                <div className="h-[300px]"><ResponsiveContainer width="100%" height="100%"><BarChart data={projectionData}><CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" /><XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={11} /><YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} /><Tooltip contentStyle={tooltipStyle} formatter={(v: number) => fmtCurrency(v)} /><Legend /><Bar dataKey="income" fill="hsl(142.1, 76.2%, 36.3%)" name="Entradas" radius={[4, 4, 0, 0]} fillOpacity={0.8} /><Bar dataKey="expense" fill="hsl(0, 84.2%, 60.2%)" name="Saídas" radius={[4, 4, 0, 0]} fillOpacity={0.8} /></BarChart></ResponsiveContainer></div>
              </CardContent>
            </Card>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {projectionData.filter(p => p.projected).map(p => (
                <Card key={p.month} className="border border-dashed border-primary/30 bg-card/80">
                  <CardContent className="p-4">
                    <p className="text-sm font-medium text-primary mb-2 font-mono">{p.month} (projeção)</p>
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between"><span className="text-muted-foreground">Entradas</span><span className="text-emerald-400 font-medium font-mono">{fmtCurrency(p.income)}</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">Saídas</span><span className="text-destructive font-medium font-mono">{fmtCurrency(p.expense)}</span></div>
                      <div className="flex justify-between border-t border-border/50 pt-1 mt-1"><span className="text-muted-foreground">Saldo</span><span className={cn("font-bold font-mono", p.balance >= 0 ? "text-emerald-400" : "text-destructive")}>{fmtCurrency(p.balance)}</span></div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
            <Card className="border border-border/50 bg-card/80">
              <CardHeader className="pb-2"><CardTitle className="text-base">Projeção de Capital Acumulado</CardTitle></CardHeader>
              <CardContent>
                <div className="h-[250px]"><ResponsiveContainer width="100%" height="100%"><AreaChart data={(() => { let running = capitalEvolution.length > 0 ? capitalEvolution[capitalEvolution.length - 1].capital : 0; return projectionData.map(p => { if (!p.projected) return { month: p.month, capital: null, projected: null }; running += p.balance; return { month: p.month, capital: null, projected: running }; }).filter(p => p.projected !== null || p.capital !== null); })()}><CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" /><XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={11} /><YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} /><Tooltip contentStyle={tooltipStyle} formatter={(v: number) => fmtCurrency(v)} /><Area type="monotone" dataKey="projected" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.1} strokeWidth={2} strokeDasharray="5 5" name="Projetado" /></AreaChart></ResponsiveContainer></div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ============ CALCULATOR ============ */}
          <TabsContent value="calculator" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Input Section */}
              <div className="space-y-4">
                <Card className="border border-border/50 bg-card/80">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base flex items-center gap-2"><DollarSign className="h-4 w-4 text-primary" />Sua Renda & Despesas</CardTitle>
                      <Button variant="outline" size="sm" className="rounded-xl text-xs border-primary/30 hover:bg-primary/10" onClick={autoFillCalc}>Auto-preencher</Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label className="text-sm">Renda mensal (R$)</Label>
                      <Input type="number" value={calcIncome || ""} onChange={e => setCalcIncome(Number(e.target.value))} placeholder="0,00" className="mt-1 rounded-xl font-mono" />
                    </div>
                    <div>
                      <Label className="text-sm">Despesas fixas mensais (R$)</Label>
                      <Input type="number" value={calcCurrentExpenses || ""} onChange={e => setCalcCurrentExpenses(Number(e.target.value))} placeholder="0,00" className="mt-1 rounded-xl font-mono" />
                    </div>
                    <div className="flex items-center justify-between p-3 rounded-xl bg-muted/30 border border-border/50">
                      <span className="text-sm text-muted-foreground">Disponível para economia</span>
                      <span className={cn("font-bold font-mono", calcAvailableToSave > 0 ? "text-emerald-400" : "text-destructive")}>{fmtCurrency(calcAvailableToSave)}</span>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border border-border/50 bg-card/80">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base flex items-center gap-2"><PiggyBank className="h-4 w-4 text-amber-400" />Metas de Gasto</CardTitle>
                      <Button variant="outline" size="sm" className="rounded-xl text-xs" onClick={addCalcGoal}><Plus className="h-3 w-3 mr-1" />Adicionar</Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {calcGoals.map((goal, i) => (
                      <motion.div key={goal.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex gap-2 items-end">
                        <div className="flex-1">
                          <Label className="text-xs text-muted-foreground">Com o quê?</Label>
                          <Input value={goal.name} onChange={e => updateCalcGoal(goal.id, "name", e.target.value)} placeholder="Ex: Carro, Viagem..." className="mt-1 rounded-xl text-sm" />
                        </div>
                        <div className="w-32">
                          <Label className="text-xs text-muted-foreground">Quanto? (R$)</Label>
                          <Input type="number" value={goal.amount || ""} onChange={e => updateCalcGoal(goal.id, "amount", Number(e.target.value))} placeholder="0,00" className="mt-1 rounded-xl font-mono text-sm" />
                        </div>
                        {calcGoals.length > 1 && (
                          <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-xl" onClick={() => removeCalcGoal(goal.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                        )}
                      </motion.div>
                    ))}
                    <div className="flex items-center justify-between p-3 rounded-xl bg-primary/5 border border-primary/20 mt-2">
                      <span className="text-sm font-medium">Total da meta</span>
                      <span className="font-bold font-mono text-primary">{fmtCurrency(calcTotalGoal)}</span>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Results Section */}
              <div className="space-y-4">
                <Card className="border border-primary/30 bg-gradient-to-br from-primary/5 to-transparent">
                  <CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2"><Calculator className="h-4 w-4 text-primary" />Resultado</CardTitle></CardHeader>
                  <CardContent className="space-y-4">
                    {calcTotalGoal > 0 && calcAvailableToSave > 0 ? (
                      <>
                        {/* Time needed */}
                        <div className="p-4 rounded-xl bg-muted/30 border border-border/50 text-center">
                          <div className="flex items-center justify-center gap-2 mb-2"><Clock className="h-5 w-5 text-primary" /><span className="text-sm text-muted-foreground">Tempo necessário</span></div>
                          <p className="text-4xl font-bold font-mono text-primary">{calcMonthsNeeded}</p>
                          <p className="text-sm text-muted-foreground">{calcMonthsNeeded === 1 ? "mês" : "meses"} ({calcMonthsNeeded >= 12 ? `${Math.floor(calcMonthsNeeded / 12)} ano${Math.floor(calcMonthsNeeded / 12) > 1 ? "s" : ""} e ${calcMonthsNeeded % 12} mês${(calcMonthsNeeded % 12) !== 1 ? "es" : ""}` : `≈ ${(calcMonthsNeeded / 12).toFixed(1)} anos`})</p>
                        </div>

                        {/* Savings percentage */}
                        <div className="p-4 rounded-xl bg-muted/30 border border-border/50">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2"><Percent className="h-4 w-4 text-emerald-400" /><span className="text-sm text-muted-foreground">% da renda que vai economizar</span></div>
                            <span className="font-bold font-mono text-emerald-400">{calcSavingsPercent.toFixed(1)}%</span>
                          </div>
                          <Progress value={Math.min(calcSavingsPercent, 100)} className="h-3" />
                        </div>

                        {/* Breakdown per goal */}
                        {calcGoals.filter(g => g.amount > 0).length > 1 && (
                          <div className="space-y-2">
                            <p className="text-sm font-medium text-muted-foreground">Detalhamento por meta</p>
                            {calcGoals.filter(g => g.amount > 0).map(goal => {
                              const goalPercent = calcTotalGoal > 0 ? (goal.amount / calcTotalGoal) * 100 : 0;
                              const goalMonths = calcAvailableToSave > 0 ? Math.ceil(goal.amount / calcAvailableToSave) : 0;
                              const monthlySave = calcAvailableToSave * (goalPercent / 100);
                              return (
                                <div key={goal.id} className="p-3 rounded-xl bg-muted/20 border border-border/40">
                                  <div className="flex items-center justify-between mb-1.5">
                                    <span className="text-sm font-medium">{goal.name || "Sem nome"}</span>
                                    <span className="text-xs font-mono text-primary">{fmtCurrency(goal.amount)}</span>
                                  </div>
                                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                                    <span>{goalPercent.toFixed(0)}% do total</span>
                                    <span>Economizar {fmtCurrency(monthlySave)}/mês</span>
                                  </div>
                                  <Progress value={goalPercent} className="h-1.5 mt-2" />
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {/* Monthly savings suggestion */}
                        <div className="p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/20">
                          <p className="text-sm font-medium text-emerald-400 mb-1">💡 Economize por mês</p>
                          <p className="text-2xl font-bold font-mono text-emerald-400">{fmtCurrency(calcAvailableToSave)}</p>
                          <p className="text-xs text-muted-foreground mt-1">para alcançar sua meta em {calcMonthsNeeded} meses</p>
                        </div>

                        {/* Faster options */}
                        <div className="space-y-2">
                          <p className="text-sm font-medium text-muted-foreground">⏩ Se economizar mais...</p>
                          {[1.25, 1.5, 2].map(mult => {
                            const extra = calcAvailableToSave * mult;
                            const months = extra > 0 ? Math.ceil(calcTotalGoal / extra) : 0;
                            return (
                              <div key={mult} className="flex items-center justify-between p-2.5 rounded-lg bg-muted/20 border border-border/30 text-sm">
                                <span className="text-muted-foreground">{fmtCurrency(extra)}/mês</span>
                                <span className="font-medium font-mono">{months} {months === 1 ? "mês" : "meses"}</span>
                              </div>
                            );
                          })}
                        </div>
                      </>
                    ) : (
                      <div className="text-center py-8">
                        <div className="inline-flex p-4 rounded-2xl bg-muted/30 mb-3"><Calculator className="h-8 w-8 text-muted-foreground/50" /></div>
                        <p className="text-muted-foreground text-sm">Preencha sua renda, despesas e metas para ver o cálculo</p>
                        {calcIncome > 0 && calcCurrentExpenses >= calcIncome && <p className="text-destructive text-xs mt-2">⚠️ Suas despesas são iguais ou maiores que sua renda</p>}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        {/* OKR Modal */}
        <Dialog open={showOkrModal} onOpenChange={open => { if (!open) { setShowOkrModal(false); setEditingOkr(null); } }}>
          <DialogContent>
            <DialogHeader><DialogTitle>{editingOkr ? "Editar OKR" : "Novo OKR"}</DialogTitle></DialogHeader>
            <div className="space-y-4 py-4">
              <div><Label>Título</Label><Input value={okrForm.title} onChange={e => setOkrForm({ ...okrForm, title: e.target.value })} placeholder="Ex: Aumentar receita mensal" className="rounded-xl" /></div>
              <div><Label>Descrição</Label><Input value={okrForm.description} onChange={e => setOkrForm({ ...okrForm, description: e.target.value })} className="rounded-xl" /></div>
              <div className="grid grid-cols-3 gap-4">
                <div><Label>Meta</Label><Input type="number" value={okrForm.target_value} onChange={e => setOkrForm({ ...okrForm, target_value: Number(e.target.value) })} className="rounded-xl font-mono" /></div>
                <div><Label>Atual</Label><Input type="number" value={okrForm.current_value} onChange={e => setOkrForm({ ...okrForm, current_value: Number(e.target.value) })} className="rounded-xl font-mono" /></div>
                <div><Label>Unidade</Label><Input value={okrForm.unit} onChange={e => setOkrForm({ ...okrForm, unit: e.target.value })} placeholder="%" className="rounded-xl" /></div>
              </div>
              <div><Label>Período</Label><select value={okrForm.period} onChange={e => setOkrForm({ ...okrForm, period: e.target.value })} className="w-full h-10 rounded-xl border border-input bg-background px-3 py-2 text-sm"><option value="quarterly">Trimestral</option><option value="yearly">Anual</option></select></div>
            </div>
            <DialogFooter><Button variant="outline" className="rounded-xl" onClick={() => setShowOkrModal(false)}>Cancelar</Button><Button className="rounded-xl shadow-lg shadow-primary/20" onClick={handleSaveOkr}>{editingOkr ? "Salvar" : "Criar"}</Button></DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Transaction Modal */}
        <Dialog open={showTransactionModal} onOpenChange={open => { if (!open) { setShowTransactionModal(false); setEditingTransaction(null); } }}>
          <DialogContent>
            <DialogHeader><DialogTitle>{editingTransaction ? "Editar Transação" : "Nova Transação"}</DialogTitle></DialogHeader>
            <div className="space-y-4 py-4">
              <div><Label>Descrição</Label><Input value={transactionForm.description} onChange={e => setTransactionForm({ ...transactionForm, description: e.target.value })} placeholder="Descrição da transação" className="rounded-xl" /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><Label>Valor (R$)</Label><Input type="number" step="0.01" value={transactionForm.amount} onChange={e => setTransactionForm({ ...transactionForm, amount: Number(e.target.value) })} className="rounded-xl font-mono" /></div>
                <div><Label>Tipo</Label><select value={transactionForm.type} onChange={e => setTransactionForm({ ...transactionForm, type: e.target.value as "income" | "expense" })} className="w-full h-10 rounded-xl border border-input bg-background px-3 py-2 text-sm"><option value="income">Entrada</option><option value="expense">Saída</option></select></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><Label>Categoria</Label><Input value={transactionForm.category} onChange={e => setTransactionForm({ ...transactionForm, category: e.target.value })} placeholder="Ex: Marketing" className="rounded-xl" /></div>
                <div><Label>Data</Label><Input type="date" value={transactionForm.date} onChange={e => setTransactionForm({ ...transactionForm, date: e.target.value })} className="rounded-xl" /></div>
              </div>
            </div>
            <DialogFooter><Button variant="outline" className="rounded-xl" onClick={() => setShowTransactionModal(false)}>Cancelar</Button><Button className="rounded-xl shadow-lg shadow-primary/20" onClick={handleSaveTransaction}>{editingTransaction ? "Salvar" : "Criar"}</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </motion.div>
    </EMSLayout>
  );
};

export default Finance;
