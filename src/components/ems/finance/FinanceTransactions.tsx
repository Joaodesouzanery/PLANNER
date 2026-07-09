import { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Edit2, Trash2, RefreshCw, Download, FileText, CheckCircle2, CalendarClock, CalendarPlus, ChevronLeft, ChevronRight, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import { format, startOfMonth, endOfMonth, addMonths, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { fmtCurrency, formatDateBR, effectiveDate, type Transaction } from "./useFinanceData";
import { useFinanceWorkspace } from "./useFinanceWorkspace";
import { useConfirm } from "@/hooks/useConfirm";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { toast } from "sonner";

const WIDE_FROM = "2000-01-01";
const WIDE_TO = "2100-12-31";
const todayIso = () => format(new Date(), "yyyy-MM-dd");
// Nº de ocorrências mensais de um contrato entre início e término (inclusivo).
const monthsBetween = (start: string, end: string) => {
  const a = new Date(`${start}T12:00:00`);
  const b = new Date(`${end}T12:00:00`);
  return (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth()) + 1;
};

const isPaid = (t: Transaction) => t.status === "reconciled" || !!t.settled_at;

const StatusBadge = ({ t }: { t: Transaction }) => {
  if (isPaid(t)) return <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">{t.type === "income" ? "Recebido" : "Pago"}</Badge>;
  if (t.status === "planned") return <Badge variant="secondary" className="bg-amber-500/10 text-amber-500 border border-amber-500/30">A {t.type === "income" ? "receber" : "pagar"}</Badge>;
  return <Badge variant="outline" className="border-border/50 text-muted-foreground">Lançado</Badge>;
};

const emptyForm = () => ({
  description: "", amount: 0, type: "expense" as "income" | "expense", category: "",
  date: todayIso(), due_date: todayIso(), status: "confirmed", finance_account_id: "",
  is_recurring: false, recurrence_interval: "", recurrence_end_date: "", paid: false,
});

const FinanceTransactions = () => {
  const { rawTransactions, allCategories, saveTransactionMutation, deleteTransactionMutation, reconcileTransactionMutation, selectedAccounts, accounts } = useFinanceWorkspace();
  const confirm = useConfirm();
  const [showModal, setShowModal] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [filterCategory, setFilterCategory] = useState("");
  const [filterType, setFilterType] = useState("");
  const [from, setFrom] = useState(format(startOfMonth(new Date()), "yyyy-MM-dd"));
  const [to, setTo] = useState(format(endOfMonth(new Date()), "yyyy-MM-dd"));
  const [form, setForm] = useState(emptyForm());

  const goMonth = (delta: number) => {
    const target = addMonths(new Date(`${from}T00:00:00`), delta);
    setFrom(format(startOfMonth(target), "yyyy-MM-dd"));
    setTo(format(endOfMonth(target), "yyyy-MM-dd"));
  };
  const periodLabel = (() => { try { return format(new Date(`${from}T00:00:00`), "MMM yyyy", { locale: ptBR }); } catch { return ""; } })();

  const setPreset = (preset: string) => {
    const today = new Date();
    if (preset === "all") { setFrom(WIDE_FROM); setTo(WIDE_TO); }
    else if (preset === "prev-month") { goMonth(-1); }
    else if (preset === "next-month") { goMonth(1); }
    else if (preset === "this-month") { setFrom(format(startOfMonth(today), "yyyy-MM-dd")); setTo(format(endOfMonth(today), "yyyy-MM-dd")); }
    else if (preset === "3m") { setFrom(format(startOfMonth(subMonths(today, 2)), "yyyy-MM-dd")); setTo(format(endOfMonth(today), "yyyy-MM-dd")); }
    else if (preset === "6m") { setFrom(format(startOfMonth(subMonths(today, 5)), "yyyy-MM-dd")); setTo(format(endOfMonth(today), "yyyy-MM-dd")); }
    else if (preset === "12m") { setFrom(format(startOfMonth(subMonths(today, 11)), "yyyy-MM-dd")); setTo(format(endOfMonth(today), "yyyy-MM-dd")); }
    else if (preset === "ytd") { setFrom(`${today.getFullYear()}-01-01`); setTo(todayIso()); }
  };

  const baseFiltered = useMemo(() => rawTransactions.filter(t => {
    if (filterCategory && t.category !== filterCategory) return false;
    if (filterType && t.type !== filterType) return false;
    return true;
  }), [rawTransactions, filterCategory, filterType]);

  const filteredTransactions = useMemo(() => baseFiltered.filter(t => {
    const d = effectiveDate(t);
    return d >= from && d <= to;
  }), [baseFiltered, from, to]);

  // Agrupamento mes a mes (usa vencimento quando houver), inclui meses futuros (planned).
  const monthGroups = useMemo(() => {
    const groups = new Map<string, Transaction[]>();
    baseFiltered.forEach(t => {
      const key = String(t.due_date || t.date).slice(0, 7);
      groups.set(key, [...(groups.get(key) || []), t]);
    });
    return Array.from(groups.entries())
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([key, items]) => {
        const sorted = [...items].sort((a, b) => String(b.due_date || b.date).localeCompare(String(a.due_date || a.date)));
        const income = items.filter(t => t.type === "income").reduce((s, t) => s + Number(t.amount), 0);
        const expense = items.filter(t => t.type === "expense").reduce((s, t) => s + Number(t.amount), 0);
        const pendingExpense = items.filter(t => t.type === "expense" && !isPaid(t)).reduce((s, t) => s + Number(t.amount), 0);
        const [y, m] = key.split("-");
        const label = format(new Date(Number(y), Number(m) - 1, 1), "MMMM 'de' yyyy", { locale: ptBR });
        const isFuture = key > todayIso().slice(0, 7);
        return { key, label, items: sorted, income, expense, balance: income - expense, pendingExpense, isFuture };
      });
  }, [baseFiltered]);

  const openNew = (preset?: Partial<ReturnType<typeof emptyForm>>) => {
    setEditingTransaction(null);
    setForm({ ...emptyForm(), finance_account_id: selectedAccounts[0]?.id || "", ...preset });
    setShowModal(true);
  };

  const openEdit = (t: Transaction) => {
    setEditingTransaction(t);
    setForm({
      description: t.description, amount: t.amount, type: t.type, category: t.category || "",
      date: t.date, due_date: t.due_date || t.date, status: t.status || "confirmed",
      finance_account_id: t.finance_account_id || "", is_recurring: t.is_recurring || false,
      recurrence_interval: t.recurrence_interval || "", recurrence_end_date: t.recurrence_end_date || "", paid: isPaid(t),
    });
    setShowModal(true);
  };

  const handleSave = () => {
    const status = form.paid ? "reconciled" : form.status;
    const { paid, ...rest } = form;
    const payload = {
      ...rest,
      status,
      finance_account_id: form.finance_account_id || null,
      settled_at: status === "reconciled" ? (editingTransaction?.settled_at || new Date().toISOString()) : null,
      recurrence_interval: form.is_recurring ? (form.recurrence_interval || "monthly") : null,
      recurrence_end_date: form.is_recurring ? (form.recurrence_end_date || null) : null,
    };
    saveTransactionMutation.mutate({ form: payload, editingId: editingTransaction?.id }, {
      onSuccess: () => { setShowModal(false); setEditingTransaction(null); setForm(emptyForm()); },
    });
  };

  const exportCsv = () => {
    const rows = filteredTransactions.map(t => `${formatDateBR(t.date)},${t.description.replace(/,/g, " ")},${t.category || ""},${t.type === "income" ? "Entrada" : "Saída"},${isPaid(t) ? "Pago" : t.status === "planned" ? "A pagar" : "Lançado"},${t.amount}`);
    const csv = "Data,Descrição,Categoria,Tipo,Situação,Valor\n" + rows.join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = "transacoes.csv"; a.click(); URL.revokeObjectURL(url);
    toast.success("CSV exportado!");
  };

  const exportPdf = () => {
    const doc = new jsPDF(); doc.setFontSize(16); doc.text("Transações Financeiras", 14, 20);
    doc.setFontSize(10); doc.text(`Exportado em ${format(new Date(), "dd/MM/yyyy HH:mm")}`, 14, 28);
    autoTable(doc, { startY: 34, head: [["Data", "Descrição", "Categoria", "Tipo", "Situação", "Valor"]], body: filteredTransactions.map(t => [formatDateBR(t.date), t.description, t.category || "-", t.type === "income" ? "Entrada" : "Saída", isPaid(t) ? "Pago" : t.status === "planned" ? "A pagar" : "Lançado", fmtCurrency(Number(t.amount))]), styles: { fontSize: 9 }, headStyles: { fillColor: [59, 130, 246] } });
    doc.save("transacoes.pdf"); toast.success("PDF exportado!");
  };

  const rowActions = (t: Transaction) => (
    <div className="flex gap-1 justify-end">
      {!isPaid(t) && (
        <Button variant="ghost" size="icon" className="h-8 w-8 text-emerald-400 hover:bg-emerald-500/10" title="Marcar como pago/recebido" onClick={() => reconcileTransactionMutation.mutate(t.id)}><CheckCircle2 className="h-4 w-4" /></Button>
      )}
      <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-primary/10 hover:text-primary" onClick={() => openEdit(t)}><Edit2 className="h-4 w-4" /></Button>
      <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10" onClick={async () => { if (await confirm({ title: "Excluir transação?", description: `"${t.description}" · ${fmtCurrency(Number(t.amount))}`, destructive: true, confirmText: "Excluir" })) deleteTransactionMutation.mutate(t.id); }}><Trash2 className="h-4 w-4" /></Button>
    </div>
  );

  return (
    <div className="space-y-4">
      <Tabs defaultValue="lista" className="space-y-4">
        <div className="flex flex-col lg:flex-row gap-3 lg:items-center justify-between">
          <TabsList className="bg-card/80 border border-border/50 rounded-xl">
            <TabsTrigger value="lista" className="rounded-lg data-[state=active]:bg-primary/15 data-[state=active]:text-primary">Lista</TabsTrigger>
            <TabsTrigger value="mensal" className="rounded-lg data-[state=active]:bg-primary/15 data-[state=active]:text-primary gap-1.5"><CalendarClock className="h-3.5 w-3.5" />Mês a mês</TabsTrigger>
          </TabsList>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" className="rounded-xl" onClick={exportCsv}><Download className="h-4 w-4 mr-1" />CSV</Button>
            <Button size="sm" variant="outline" className="rounded-xl" onClick={exportPdf}><FileText className="h-4 w-4 mr-1" />PDF</Button>
            <Button size="sm" variant="outline" className="rounded-xl" onClick={() => openNew({ type: "expense", status: "planned", paid: false, date: format(startOfMonth(subMonths(new Date(), -1)), "yyyy-MM-dd"), due_date: format(startOfMonth(subMonths(new Date(), -1)), "yyyy-MM-dd") })}><CalendarPlus className="h-4 w-4 mr-1" />Compra futura</Button>
            <Button size="sm" onClick={() => openNew()} className="rounded-xl shadow-lg shadow-primary/20"><Plus className="h-4 w-4 mr-2" />Nova Transação</Button>
          </div>
        </div>

        {/* Filtros comuns */}
        <Card className="border border-border/50 bg-card/80">
          <CardContent className="p-3 flex flex-wrap items-center gap-2">
            <Select value={filterType || "all"} onValueChange={v => setFilterType(v === "all" ? "" : v)}><SelectTrigger className="w-[130px] h-9 rounded-xl bg-card/50 border-border/50 text-xs"><SelectValue placeholder="Tipo" /></SelectTrigger><SelectContent><SelectItem value="all">Todos os tipos</SelectItem><SelectItem value="income">Entradas</SelectItem><SelectItem value="expense">Saídas</SelectItem></SelectContent></Select>
            <Select value={filterCategory || "all"} onValueChange={v => setFilterCategory(v === "all" ? "" : v)}><SelectTrigger className="w-[150px] h-9 rounded-xl bg-card/50 border-border/50 text-xs"><SelectValue placeholder="Categoria" /></SelectTrigger><SelectContent><SelectItem value="all">Todas categorias</SelectItem>{allCategories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select>
            <div className="hidden sm:flex items-center gap-2 ml-auto">
              <span className="text-xs text-muted-foreground">Período:</span>
              <div className="flex items-center gap-1">
                <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => goMonth(-1)} title="Mês anterior"><ChevronLeft className="h-4 w-4" /></Button>
                <span className="min-w-[70px] text-center text-xs font-medium capitalize">{periodLabel}</span>
                <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => goMonth(1)} title="Mês seguinte"><ChevronRight className="h-4 w-4" /></Button>
              </div>
              <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-36 h-9 text-xs" />
              <span className="text-muted-foreground text-xs">até</span>
              <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-36 h-9 text-xs" />
              <Select onValueChange={setPreset}>
                <SelectTrigger className="w-[150px] h-9 text-xs"><SelectValue placeholder="Atalhos" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="prev-month">Mês anterior</SelectItem>
                  <SelectItem value="this-month">Este mês</SelectItem>
                  <SelectItem value="next-month">Próximo mês</SelectItem>
                  <SelectItem value="3m">Últimos 3 meses</SelectItem>
                  <SelectItem value="6m">Últimos 6 meses</SelectItem>
                  <SelectItem value="12m">Últimos 12 meses</SelectItem>
                  <SelectItem value="ytd">Ano atual</SelectItem>
                  <SelectItem value="all">Tudo</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="ghost" size="sm" className="h-9 text-xs" onClick={() => setPreset("this-month")}><RotateCcw className="h-3.5 w-3.5 mr-1" />Este mês</Button>
            </div>
          </CardContent>
        </Card>

        {/* ---- LISTA ---- */}
        <TabsContent value="lista" className="mt-0">
          <Card className="border border-border/50 bg-card/80">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader><TableRow><TableHead>Data / vencimento</TableHead><TableHead>Descrição</TableHead><TableHead>Conta</TableHead><TableHead>Categoria</TableHead><TableHead>Tipo</TableHead><TableHead>Situação</TableHead><TableHead className="text-right">Valor</TableHead><TableHead></TableHead></TableRow></TableHeader>
                  <TableBody>
                    {filteredTransactions.map(t => (
                      <TableRow key={t.id} className="hover:bg-muted/30">
                        <TableCell className="whitespace-nowrap font-mono text-xs"><div>{formatDateBR(t.date)}</div>{t.due_date && t.due_date !== t.date && <div className="text-amber-500">Vence {formatDateBR(t.due_date)}</div>}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {t.description}
                            {t.is_recurring && <Badge variant="outline" className="text-[10px] border-primary/30 text-primary gap-1"><RefreshCw className="h-2.5 w-2.5" />{t.recurrence_interval === "weekly" ? "Semanal" : t.recurrence_interval === "yearly" ? "Anual" : "Mensal"}</Badge>}
                          </div>
                        </TableCell>
                        <TableCell className="text-xs">{accounts.find((account) => account.id === t.finance_account_id)?.name || "-"}</TableCell>
                        <TableCell>{t.category && <Badge variant="outline" className="border-border/50">{t.category}</Badge>}</TableCell>
                        <TableCell><Badge variant="secondary" className={t.type === "income" ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30" : "bg-destructive/10 text-destructive border border-destructive/30"}>{t.type === "income" ? "Entrada" : "Saída"}</Badge></TableCell>
                        <TableCell><StatusBadge t={t} /></TableCell>
                        <TableCell className={cn("text-right font-medium font-mono", t.type === "income" ? "text-emerald-400" : "text-destructive")}>{t.type === "income" ? "+" : "-"} {fmtCurrency(Number(t.amount))}</TableCell>
                        <TableCell>{rowActions(t)}</TableCell>
                      </TableRow>
                    ))}
                    {filteredTransactions.length === 0 && <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground italic">Nenhuma transação no período/filtros.</TableCell></TableRow>}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ---- MES A MES ---- */}
        <TabsContent value="mensal" className="mt-0 space-y-4">
          {monthGroups.length === 0 && <Card className="border border-border/50 bg-card/80"><CardContent className="py-10 text-center text-muted-foreground italic">Nenhuma transação. Use "Compra futura" para planejar.</CardContent></Card>}
          {monthGroups.map(group => (
            <Card key={group.key} className={cn("border bg-card/80", group.isFuture ? "border-primary/30" : "border-border/50")}>
              <CardContent className="p-0">
                <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-b border-border/50">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold capitalize">{group.label}</span>
                    {group.isFuture && <Badge variant="outline" className="border-primary/40 text-primary text-[10px]">Futuro</Badge>}
                    <Badge variant="secondary" className="text-[10px]">{group.items.length} lanç.</Badge>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 text-xs font-mono">
                    <span className="text-emerald-400">+ {fmtCurrency(group.income)}</span>
                    <span className="text-destructive">- {fmtCurrency(group.expense)}</span>
                    <span className={group.balance >= 0 ? "text-emerald-400" : "text-destructive"}>Saldo {fmtCurrency(group.balance)}</span>
                    {group.pendingExpense > 0 && <Badge variant="outline" className="border-amber-500/40 text-amber-500">A pagar {fmtCurrency(group.pendingExpense)}</Badge>}
                    <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => openNew({ type: "expense", status: "planned", paid: false, date: `${group.key}-01`, due_date: `${group.key}-15` })}><CalendarPlus className="h-3.5 w-3.5 mr-1" />Adicionar</Button>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <Table>
                    <TableBody>
                      {group.items.map(t => (
                        <TableRow key={t.id} className="hover:bg-muted/30">
                          <TableCell className="whitespace-nowrap font-mono text-xs w-[110px]">{formatDateBR(t.due_date || t.date)}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">{t.description}{t.is_recurring && <RefreshCw className="h-3 w-3 text-primary" />}</div>
                            {t.category && <span className="text-[10px] text-muted-foreground">{t.category}</span>}
                          </TableCell>
                          <TableCell><StatusBadge t={t} /></TableCell>
                          <TableCell className={cn("text-right font-medium font-mono", t.type === "income" ? "text-emerald-400" : "text-destructive")}>{t.type === "income" ? "+" : "-"} {fmtCurrency(Number(t.amount))}</TableCell>
                          <TableCell className="w-[120px]">{rowActions(t)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>
      </Tabs>

      <Dialog open={showModal} onOpenChange={open => { if (!open) { setShowModal(false); setEditingTransaction(null); } }}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingTransaction ? "Editar Transação" : "Nova Transação"}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div><Label>Descrição</Label><Input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Descrição da transação" className="rounded-xl" /></div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Valor (R$)</Label><Input type="number" step="0.01" value={form.amount || ""} onChange={e => setForm({ ...form, amount: Number(e.target.value) })} className="rounded-xl font-mono" /></div>
              <div><Label>Tipo</Label><select value={form.type} onChange={e => setForm({ ...form, type: e.target.value as "income" | "expense" })} className="w-full h-10 rounded-xl border border-input bg-background px-3 py-2 text-sm"><option value="income">Entrada</option><option value="expense">Saída</option></select></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Categoria</Label><Input value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} placeholder="Ex: Marketing" className="rounded-xl" /></div>
              <div><Label>Data</Label><Input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} className="rounded-xl" /></div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div><Label>Vencimento</Label><Input type="date" value={form.due_date} onChange={e => setForm({ ...form, due_date: e.target.value })} className="rounded-xl" /></div>
              <div><Label>Conta</Label><Select value={form.finance_account_id || "none"} onValueChange={value => setForm({ ...form, finance_account_id: value === "none" ? "" : value })}><SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">Sem conta</SelectItem>{selectedAccounts.map(account => <SelectItem key={account.id} value={account.id}>{account.name}</SelectItem>)}</SelectContent></Select></div>
              <div><Label>Situação</Label><Select value={form.paid ? "reconciled" : form.status} onValueChange={value => setForm({ ...form, status: value, paid: value === "reconciled" })}><SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="planned">A pagar/receber (previsto)</SelectItem><SelectItem value="confirmed">Lançado (previsto)</SelectItem><SelectItem value="reconciled">Pago/Recebido (real)</SelectItem></SelectContent></Select></div>
            </div>
            <div className="flex items-center justify-between p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/20">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                <Label className="cursor-pointer">Já paguei (à vista / PIX)</Label>
              </div>
              <Switch checked={form.paid} onCheckedChange={v => setForm({ ...form, paid: v, status: v ? "reconciled" : (form.status === "reconciled" ? "confirmed" : form.status) })} />
            </div>
            <div className="flex items-center justify-between p-3 rounded-xl bg-muted/30 border border-border/50">
              <div className="flex items-center gap-2">
                <RefreshCw className="h-4 w-4 text-primary" />
                <Label className="cursor-pointer">Transação recorrente</Label>
              </div>
              <Switch checked={form.is_recurring} onCheckedChange={v => setForm({ ...form, is_recurring: v })} />
            </div>
            {form.is_recurring && (
              <div className="space-y-3">
                <div><Label>Frequência</Label><select value={form.recurrence_interval || "monthly"} onChange={e => setForm({ ...form, recurrence_interval: e.target.value })} className="w-full h-10 rounded-xl border border-input bg-background px-3 py-2 text-sm"><option value="weekly">Semanal</option><option value="monthly">Mensal</option><option value="yearly">Anual</option></select></div>
                <div className="flex items-center justify-between p-3 rounded-xl bg-primary/5 border border-primary/20">
                  <div className="flex items-center gap-2">
                    <CalendarClock className="h-4 w-4 text-primary" />
                    <div>
                      <Label className="cursor-pointer">Contrato com prazo</Label>
                      <p className="text-[11px] text-muted-foreground">Projeta só até o fim do contrato (senão, indefinido).</p>
                    </div>
                  </div>
                  <Switch checked={!!form.recurrence_end_date} onCheckedChange={v => {
                    const start = form.due_date || form.date;
                    setForm({ ...form, recurrence_end_date: v ? format(addMonths(new Date(`${start}T12:00:00`), 11), "yyyy-MM-dd") : "" });
                  }} />
                </div>
                {form.recurrence_end_date && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Duração (meses)</Label>
                      <Input type="number" min={1} value={monthsBetween(form.due_date || form.date, form.recurrence_end_date)} onChange={e => {
                        const n = Math.max(1, Number(e.target.value) || 1);
                        const start = form.due_date || form.date;
                        setForm({ ...form, recurrence_end_date: format(addMonths(new Date(`${start}T12:00:00`), n - 1), "yyyy-MM-dd") });
                      }} className="rounded-xl" />
                    </div>
                    <div>
                      <Label>Termina em</Label>
                      <Input type="date" value={form.recurrence_end_date} onChange={e => setForm({ ...form, recurrence_end_date: e.target.value })} className="rounded-xl" />
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
          <DialogFooter><Button variant="outline" className="rounded-xl" onClick={() => setShowModal(false)}>Cancelar</Button><Button className="rounded-xl shadow-lg shadow-primary/20" onClick={handleSave}>{editingTransaction ? "Salvar" : "Criar"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default FinanceTransactions;
