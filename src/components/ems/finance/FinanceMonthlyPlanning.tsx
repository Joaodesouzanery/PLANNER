import { useMemo, useState } from "react";
import { format, isBefore, isWithinInterval, addDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ArrowDownRight, ArrowUpRight, CalendarDays, CheckCircle2, Edit2, FileDown, LayoutGrid, ListFilter, Plus, SkipForward, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { parseDateOnly } from "@/lib/geocode";
import { fmtCurrency, formatDateBR, type PlanItem, useFinanceData } from "./useFinanceData";
import { SavingsGoalForm, emptySavingsGoal, computeSavingsOutputs, type SavingsGoalInputs } from "./SavingsGoalForm";
import { exportTablePdf } from "@/lib/exportPdf";
import { toast } from "sonner";

const statusConfig: Record<PlanItem["status"], { label: string; className: string }> = {
  planned: { label: "Planejado", className: "border-primary/30 bg-primary/10 text-primary" },
  confirmed: { label: "Confirmado", className: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400" },
  skipped: { label: "Ignorado", className: "border-muted bg-muted/50 text-muted-foreground" },
};

const monthOptions = Array.from({ length: 12 }, (_, index) => ({
  value: index + 1,
  label: format(new Date(2026, index, 1), "MMMM", { locale: ptBR }),
}));

const emptyForm = (month: number, year: number) => ({
  description: "",
  amount: 0,
  type: "expense" as "income" | "expense",
  category: "",
  due_date: format(new Date(year, month - 1, 1), "yyyy-MM-dd"),
  status: "planned" as PlanItem["status"],
  notes: "",
});

const FinanceMonthlyPlanning = () => {
  const {
    monthlyPlans,
    planItems,
    dashboardTransactions,
    allCategories,
    savePlanItemMutation,
    deletePlanItemMutation,
    skipPlanItemMutation,
    confirmPlanItemMutation,
  } = useFinanceData();
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [filterType, setFilterType] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState<PlanItem | null>(null);
  const [form, setForm] = useState(emptyForm(month, year));
  const [goalKind, setGoalKind] = useState<"standard" | "savings">("standard");
  const [savingsForm, setSavingsForm] = useState<SavingsGoalInputs>(emptySavingsGoal());

  const selectedPlans = useMemo(
    () => monthlyPlans.filter((plan) => plan.month === month && plan.year === year),
    [monthlyPlans, month, year]
  );
  const selectedPlanIds = useMemo(() => selectedPlans.map((plan) => plan.id), [selectedPlans]);

  const monthItems = useMemo(
    () => planItems.filter((item) => selectedPlanIds.includes(item.plan_id)),
    [planItems, selectedPlanIds]
  );

  const filteredItems = useMemo(() => monthItems.filter((item) => {
    if (filterType && item.type !== filterType) return false;
    if (filterStatus && item.status !== filterStatus) return false;
    if (filterCategory && item.category !== filterCategory) return false;
    return true;
  }), [monthItems, filterCategory, filterStatus, filterType]);

  const monthKey = `${year}-${String(month).padStart(2, "0")}`;
  const realizedTransactions = useMemo(
    () => dashboardTransactions.filter((transaction) => String(transaction.date).slice(0, 7) === monthKey),
    [dashboardTransactions, monthKey]
  );

  const summary = useMemo(() => {
    const activeItems = monthItems.filter((item) => item.status !== "skipped");
    const plannedIncome = activeItems.filter((item) => item.type === "income").reduce((sum, item) => sum + Number(item.amount), 0);
    const plannedExpense = activeItems.filter((item) => item.type === "expense").reduce((sum, item) => sum + Number(item.amount), 0);
    const realizedIncome = realizedTransactions.filter((item) => item.type === "income").reduce((sum, item) => sum + Number(item.amount), 0);
    const realizedExpense = realizedTransactions.filter((item) => item.type === "expense").reduce((sum, item) => sum + Number(item.amount), 0);
    return {
      plannedIncome,
      plannedExpense,
      plannedBalance: plannedIncome - plannedExpense,
      realizedBalance: realizedIncome - realizedExpense,
      variance: (realizedIncome - realizedExpense) - (plannedIncome - plannedExpense),
    };
  }, [monthItems, realizedTransactions]);

  const categories = useMemo(() => {
    const cats = new Set(allCategories);
    monthItems.forEach((item) => { if (item.category) cats.add(item.category); });
    return Array.from(cats).sort();
  }, [allCategories, monthItems]);

  const exportPlanning = async () => {
    const money = (v: number) => fmtCurrency(Number(v));
    const monthName = monthOptions.find((o) => o.value === month)?.label ?? String(month);
    try {
      await exportTablePdf({
        title: "Planejamento mensal",
        subtitle: `${monthName}/${year} · gerado em ${new Date().toLocaleString("pt-BR")}`,
        filename: `planejamento-${year}-${String(month).padStart(2, "0")}.pdf`,
        sections: [
          { heading: "Resumo do mês", head: [["Indicador", "Valor"]], body: [
            ["Entradas previstas", money(summary.plannedIncome)], ["Saídas previstas", money(summary.plannedExpense)],
            ["Saldo planejado", money(summary.plannedBalance)], ["Realizado", money(summary.realizedBalance)], ["Diferença", money(summary.variance)],
          ] },
          { heading: `Itens planejados (${filteredItems.length})`, head: [["Vencimento", "Descrição", "Categoria", "Tipo", "Status", "Previsto"]], body: filteredItems.length ? filteredItems.map((it) => [formatDateBR(it.due_date), it.description, it.category || "-", it.type === "income" ? "Entrada" : "Saída", statusConfig[it.status].label, money(Number(it.amount))]) : [["—", "—", "—", "—", "—", "—"]] },
        ],
      });
      toast.success("Planejamento exportado!");
    } catch (err: any) {
      toast.error("Falha ao exportar", { description: err?.message });
    }
  };

  const openCreateModal = () => {
    setEditingItem(null);
    setForm(emptyForm(month, year));
    setGoalKind("standard");
    setSavingsForm(emptySavingsGoal());
    setShowModal(true);
  };

  const openEditModal = (item: PlanItem) => {
    setEditingItem(item);
    const meta = (item as any).metadata as SavingsGoalInputs | null;
    const kind = ((item as any).goal_kind as "standard" | "savings") || "standard";
    setGoalKind(kind);
    setSavingsForm(meta && kind === "savings" ? meta : emptySavingsGoal());
    setForm({
      description: item.description,
      amount: Number(item.amount),
      type: item.type,
      category: item.category || "",
      due_date: item.due_date,
      status: item.status,
      notes: item.notes || "",
    });
    setShowModal(true);
  };

  const handleSave = () => {
    if (goalKind === "savings") {
      const out = computeSavingsOutputs(savingsForm);
      const payload: any = {
        description: savingsForm.itemName.trim() || "Meta de economia",
        amount: out.monthlySaving,
        type: "expense",
        category: "Meta de economia",
        due_date: form.due_date,
        status: "planned",
        notes: `Objetivo: ${savingsForm.itemName} - ${out.monthsToReach} meses para juntar ${fmtCurrency(savingsForm.targetPrice)}`,
        goal_kind: "savings",
        metadata: { ...savingsForm, computed: out },
      };
      savePlanItemMutation.mutate({ month, year, editingId: editingItem?.id, form: payload }, {
        onSuccess: () => { setShowModal(false); setEditingItem(null); setForm(emptyForm(month, year)); setSavingsForm(emptySavingsGoal()); setGoalKind("standard"); },
      });
      return;
    }
    savePlanItemMutation.mutate({
      month,
      year,
      editingId: editingItem?.id,
      form: {
        description: form.description.trim(),
        amount: Number(form.amount || 0),
        type: form.type,
        category: form.category.trim() || null,
        due_date: form.due_date,
        status: form.status,
        notes: form.notes.trim() || null,
        goal_kind: "standard",
        metadata: null,
      } as any,
    }, {
      onSuccess: () => {
        setShowModal(false);
        setEditingItem(null);
        setForm(emptyForm(month, year));
      },
    });
  };

  const statusBadge = (status: PlanItem["status"]) => (
    <Badge variant="outline" className={cn("text-[10px] border", statusConfig[status].className)}>
      {statusConfig[status].label}
    </Badge>
  );

  const itemDateState = (item: PlanItem) => {
    const date = parseDateOnly(item.due_date);
    if (!date || item.status !== "planned") return "";
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (isBefore(date, today)) return "Vencido";
    if (isWithinInterval(date, { start: today, end: addDays(today, 5) })) return "Proximo";
    return "";
  };

  const actionButtons = (item: PlanItem) => (
    <div className="flex items-center justify-end gap-1">
      {item.status === "planned" && (
        <>
          <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-emerald-500/10 hover:text-emerald-400" title="Confirmar como transacao" onClick={() => confirmPlanItemMutation.mutate(item)}>
            <CheckCircle2 className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-muted hover:text-foreground" title="Ignorar item" onClick={() => skipPlanItemMutation.mutate(item.id)}>
            <SkipForward className="h-4 w-4" />
          </Button>
        </>
      )}
      <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-primary/10 hover:text-primary" title="Editar" onClick={() => openEditModal(item)}>
        <Edit2 className="h-4 w-4" />
      </Button>
      <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:bg-destructive/10 hover:text-destructive" title="Excluir" onClick={() => deletePlanItemMutation.mutate(item.id)}>
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <Select value={String(month)} onValueChange={(value) => setMonth(Number(value))}>
            <SelectTrigger className="w-[150px] rounded-xl bg-card/50 border-border/50"><SelectValue /></SelectTrigger>
            <SelectContent>{monthOptions.map((option) => <SelectItem key={option.value} value={String(option.value)}>{option.label}</SelectItem>)}</SelectContent>
          </Select>
          <Input type="number" value={year} onChange={(event) => setYear(Number(event.target.value))} className="w-[100px] rounded-xl bg-card/50 border-border/50 font-mono" />
          <Button size="sm" onClick={openCreateModal} className="rounded-xl shadow-lg shadow-primary/20">
            <Plus className="h-4 w-4 mr-2" />Novo previsto
          </Button>
          <Button size="sm" variant="outline" onClick={exportPlanning} className="rounded-xl">
            <FileDown className="h-4 w-4 mr-2" />Exportar
          </Button>
        </div>

        <div className="flex flex-wrap gap-2">
          <Select value={filterType || "all"} onValueChange={(value) => setFilterType(value === "all" ? "" : value)}>
            <SelectTrigger className="w-[130px] rounded-xl bg-card/50 border-border/50"><SelectValue placeholder="Tipo" /></SelectTrigger>
            <SelectContent><SelectItem value="all">Todos</SelectItem><SelectItem value="income">Entradas</SelectItem><SelectItem value="expense">Saidas</SelectItem></SelectContent>
          </Select>
          <Select value={filterStatus || "all"} onValueChange={(value) => setFilterStatus(value === "all" ? "" : value)}>
            <SelectTrigger className="w-[145px] rounded-xl bg-card/50 border-border/50"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent><SelectItem value="all">Todos</SelectItem><SelectItem value="planned">Planejados</SelectItem><SelectItem value="confirmed">Confirmados</SelectItem><SelectItem value="skipped">Ignorados</SelectItem></SelectContent>
          </Select>
          <Select value={filterCategory || "all"} onValueChange={(value) => setFilterCategory(value === "all" ? "" : value)}>
            <SelectTrigger className="w-[160px] rounded-xl bg-card/50 border-border/50"><SelectValue placeholder="Categoria" /></SelectTrigger>
            <SelectContent><SelectItem value="all">Todas</SelectItem>{categories.map((category) => <SelectItem key={category} value={category}>{category}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {[
          { label: "Entradas previstas", value: summary.plannedIncome, icon: ArrowUpRight, color: "text-emerald-400" },
          { label: "Saidas previstas", value: summary.plannedExpense, icon: ArrowDownRight, color: "text-destructive" },
          { label: "Saldo planejado", value: summary.plannedBalance, icon: CalendarDays, color: summary.plannedBalance >= 0 ? "text-emerald-400" : "text-destructive" },
          { label: "Realizado", value: summary.realizedBalance, icon: CheckCircle2, color: summary.realizedBalance >= 0 ? "text-emerald-400" : "text-destructive" },
          { label: "Diferenca", value: summary.variance, icon: ListFilter, color: summary.variance >= 0 ? "text-emerald-400" : "text-destructive" },
        ].map((stat) => (
          <Card key={stat.label} className="border border-border/50 bg-card/80">
            <CardContent className="p-4">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs text-muted-foreground">{stat.label}</p>
                <stat.icon className={cn("h-4 w-4", stat.color)} />
              </div>
              <p className={cn("text-lg font-bold font-mono mt-1", stat.color)}>{fmtCurrency(stat.value)}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="table" className="space-y-4">
        <TabsList className="grid w-full max-w-[300px] grid-cols-2 rounded-xl bg-card/80 border border-border/50 p-1">
          <TabsTrigger value="table" className="gap-1.5 rounded-lg"><ListFilter className="h-4 w-4" />Tabela</TabsTrigger>
          <TabsTrigger value="cards" className="gap-1.5 rounded-lg"><LayoutGrid className="h-4 w-4" />Cards</TabsTrigger>
        </TabsList>

        <TabsContent value="table">
          <Card className="border border-border/50 bg-card/80">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Vencimento</TableHead>
                      <TableHead>Descricao</TableHead>
                      <TableHead>Categoria</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Previsto</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredItems.map((item) => (
                      <TableRow key={item.id} className={cn("hover:bg-muted/30", item.status === "confirmed" && "bg-emerald-500/5", item.status === "skipped" && "opacity-60")}>
                        <TableCell className="whitespace-nowrap font-mono text-xs">
                          <div className="flex items-center gap-2">
                            {formatDateBR(item.due_date)}
                            {itemDateState(item) && <Badge variant="outline" className="text-[10px] border-amber-500/30 text-amber-400">{itemDateState(item)}</Badge>}
                          </div>
                        </TableCell>
                        <TableCell className="min-w-[180px]">{item.description}</TableCell>
                        <TableCell>{item.category && <Badge variant="outline" className="border-border/50">{item.category}</Badge>}</TableCell>
                        <TableCell><Badge variant="secondary" className={item.type === "income" ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30" : "bg-destructive/10 text-destructive border border-destructive/30"}>{item.type === "income" ? "Entrada" : "Saida"}</Badge></TableCell>
                        <TableCell>{statusBadge(item.status)}</TableCell>
                        <TableCell className={cn("text-right font-medium font-mono", item.type === "income" ? "text-emerald-400" : "text-destructive")}>{item.type === "income" ? "+" : "-"} {fmtCurrency(Number(item.amount))}</TableCell>
                        <TableCell>{actionButtons(item)}</TableCell>
                      </TableRow>
                    ))}
                    {filteredItems.length === 0 && (
                      <TableRow><TableCell colSpan={7} className="text-center py-10 text-muted-foreground italic">Nenhum item planejado para este filtro.</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="cards">
          {filteredItems.length === 0 ? (
            <Card className="border border-border/50 bg-card/80"><CardContent className="py-12 text-center text-sm text-muted-foreground">Nenhum item planejado para este filtro.</CardContent></Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {filteredItems.map((item) => {
                const dueState = itemDateState(item);
                return (
                  <Card key={item.id} className={cn("border bg-card/80 transition-colors", item.type === "income" ? "border-emerald-500/20" : "border-destructive/20", dueState && "border-amber-500/40", item.status === "confirmed" && "bg-emerald-500/5", item.status === "skipped" && "opacity-60")}>
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <CardTitle className="text-sm truncate">{item.description}</CardTitle>
                          <p className="text-xs text-muted-foreground mt-1">{formatDateBR(item.due_date)}</p>
                        </div>
                        {statusBadge(item.status)}
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex items-center justify-between gap-2">
                        <Badge variant="outline" className="border-border/50">{item.category || "Sem categoria"}</Badge>
                        {dueState && <Badge variant="outline" className="border-amber-500/30 text-amber-400">{dueState}</Badge>}
                      </div>
                      <div className="flex items-end justify-between gap-3">
                        <div>
                          <p className="text-xs text-muted-foreground">{item.type === "income" ? "Entrada prevista" : "Gasto previsto"}</p>
                          <p className={cn("text-xl font-bold font-mono", item.type === "income" ? "text-emerald-400" : "text-destructive")}>{fmtCurrency(Number(item.amount))}</p>
                        </div>
                        {actionButtons(item)}
                      </div>
                      {item.notes && <p className="text-xs text-muted-foreground border-t border-border/50 pt-2">{item.notes}</p>}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={showModal} onOpenChange={(open) => { if (!open) { setShowModal(false); setEditingItem(null); } }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editingItem ? "Editar previsto" : "Novo previsto"}</DialogTitle></DialogHeader>
          <Tabs value={goalKind} onValueChange={(v) => setGoalKind(v as "standard" | "savings")} className="pt-2">
            <TabsList className="grid grid-cols-2 w-full">
              <TabsTrigger value="standard">Previsto padrao</TabsTrigger>
              <TabsTrigger value="savings">Meta de economia</TabsTrigger>
            </TabsList>

            <TabsContent value="standard" className="space-y-4 py-4">
              <div><Label>Descricao</Label><Input value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder="Ex: Aluguel, contrato, ferramenta..." className="rounded-xl" /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><Label>Valor (R$)</Label><Input type="number" step="0.01" value={form.amount || ""} onChange={(event) => setForm({ ...form, amount: Number(event.target.value) })} className="rounded-xl font-mono" /></div>
                <div>
                  <Label>Tipo</Label>
                  <Select value={form.type} onValueChange={(value: "income" | "expense") => setForm({ ...form, type: value })}>
                    <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="income">Entrada</SelectItem><SelectItem value="expense">Saida</SelectItem></SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><Label>Categoria</Label><Input value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })} placeholder="Ex: Marketing" className="rounded-xl" /></div>
                <div><Label>Vencimento</Label><Input type="date" value={form.due_date} onChange={(event) => setForm({ ...form, due_date: event.target.value })} className="rounded-xl" /></div>
              </div>
              <div>
                <Label>Status</Label>
                <Select value={form.status} onValueChange={(value: PlanItem["status"]) => setForm({ ...form, status: value })}>
                  <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="planned">Planejado</SelectItem><SelectItem value="confirmed">Confirmado</SelectItem><SelectItem value="skipped">Ignorado</SelectItem></SelectContent>
                </Select>
              </div>
              <div><Label>Observacoes</Label><Textarea value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} placeholder="Detalhes, criterio ou contexto do gasto" className="rounded-xl" /></div>
            </TabsContent>

            <TabsContent value="savings" className="py-4">
              <SavingsGoalForm value={savingsForm} onChange={setSavingsForm} />
            </TabsContent>
          </Tabs>
          <DialogFooter>
            <Button variant="outline" className="rounded-xl" onClick={() => setShowModal(false)}>Cancelar</Button>
            <Button
              className="rounded-xl shadow-lg shadow-primary/20"
              onClick={handleSave}
              disabled={
                savePlanItemMutation.isPending ||
                (goalKind === "standard" ? (!form.description.trim() || Number(form.amount) <= 0) : (!savingsForm.itemName.trim() || savingsForm.targetPrice <= 0))
              }
            >
              {editingItem ? "Salvar" : "Criar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default FinanceMonthlyPlanning;
