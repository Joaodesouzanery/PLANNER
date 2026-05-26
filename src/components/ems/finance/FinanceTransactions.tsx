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
import { Plus, Edit2, Trash2, RefreshCw, Download, FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { useFinanceData, fmtCurrency, formatDateBR, type Transaction } from "./useFinanceData";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { toast } from "sonner";

const FinanceTransactions = () => {
  const { rawTransactions, allCategories, saveTransactionMutation, deleteTransactionMutation } = useFinanceData();
  const [showModal, setShowModal] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [filterCategory, setFilterCategory] = useState("");
  const [filterType, setFilterType] = useState("");
  const [form, setForm] = useState({ description: "", amount: 0, type: "income" as "income" | "expense", category: "", date: format(new Date(), "yyyy-MM-dd"), is_recurring: false, recurrence_interval: "" });

  const filteredTransactions = useMemo(() => rawTransactions.filter(t => {
    if (filterCategory && t.category !== filterCategory) return false;
    if (filterType && t.type !== filterType) return false;
    return true;
  }), [rawTransactions, filterCategory, filterType]);

  const handleSave = () => {
    const payload = { ...form, recurrence_interval: form.is_recurring ? (form.recurrence_interval || "monthly") : null };
    saveTransactionMutation.mutate({ form: payload, editingId: editingTransaction?.id }, {
      onSuccess: () => {
        setShowModal(false); setEditingTransaction(null);
        setForm({ description: "", amount: 0, type: "income", category: "", date: format(new Date(), "yyyy-MM-dd"), is_recurring: false, recurrence_interval: "" });
      },
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex gap-2">
          <Select value={filterType || "all"} onValueChange={v => setFilterType(v === "all" ? "" : v)}><SelectTrigger className="w-[140px] rounded-xl bg-card/50 border-border/50"><SelectValue placeholder="Tipo" /></SelectTrigger><SelectContent><SelectItem value="all">Todos</SelectItem><SelectItem value="income">Entradas</SelectItem><SelectItem value="expense">Saídas</SelectItem></SelectContent></Select>
          <Select value={filterCategory || "all"} onValueChange={v => setFilterCategory(v === "all" ? "" : v)}><SelectTrigger className="w-[160px] rounded-xl bg-card/50 border-border/50"><SelectValue placeholder="Categoria" /></SelectTrigger><SelectContent><SelectItem value="all">Todas</SelectItem>{allCategories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" className="rounded-xl" onClick={() => {
            const rows = filteredTransactions.map(t => `${formatDateBR(t.date)},${t.description.replace(/,/g," ")},${t.category||""},${t.type==="income"?"Entrada":"Saída"},${t.amount}`);
            const csv = "Data,Descrição,Categoria,Tipo,Valor\n" + rows.join("\n");
            const blob = new Blob(["\uFEFF"+csv],{type:"text/csv;charset=utf-8;"});
            const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href=url; a.download="transacoes.csv"; a.click(); URL.revokeObjectURL(url);
            toast.success("CSV exportado!");
          }}><Download className="h-4 w-4 mr-1" />CSV</Button>
          <Button size="sm" variant="outline" className="rounded-xl" onClick={() => {
            const doc = new jsPDF(); doc.setFontSize(16); doc.text("Transações Financeiras", 14, 20);
            doc.setFontSize(10); doc.text(`Exportado em ${format(new Date(),"dd/MM/yyyy HH:mm")}`, 14, 28);
            autoTable(doc, { startY: 34, head: [["Data","Descrição","Categoria","Tipo","Valor"]], body: filteredTransactions.map(t => [formatDateBR(t.date), t.description, t.category||"-", t.type==="income"?"Entrada":"Saída", fmtCurrency(Number(t.amount))]), styles:{fontSize:9}, headStyles:{fillColor:[59,130,246]} });
            doc.save("transacoes.pdf"); toast.success("PDF exportado!");
          }}><FileText className="h-4 w-4 mr-1" />PDF</Button>
          <Button size="sm" onClick={() => setShowModal(true)} className="rounded-xl shadow-lg shadow-primary/20"><Plus className="h-4 w-4 mr-2" />Nova Transação</Button>
        </div>
      </div>
      <Card className="border border-border/50 bg-card/80">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader><TableRow><TableHead>Data</TableHead><TableHead>Descrição</TableHead><TableHead>Categoria</TableHead><TableHead>Tipo</TableHead><TableHead className="text-right">Valor</TableHead><TableHead></TableHead></TableRow></TableHeader>
              <TableBody>
                {filteredTransactions.map(t => (
                  <TableRow key={t.id} className="hover:bg-muted/30">
                    <TableCell className="whitespace-nowrap font-mono text-xs">{formatDateBR(t.date)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {t.description}
                        {t.is_recurring && <Badge variant="outline" className="text-[10px] border-primary/30 text-primary gap-1"><RefreshCw className="h-2.5 w-2.5" />{t.recurrence_interval === "weekly" ? "Semanal" : t.recurrence_interval === "yearly" ? "Anual" : "Mensal"}</Badge>}
                      </div>
                    </TableCell>
                    <TableCell>{t.category && <Badge variant="outline" className="border-border/50">{t.category}</Badge>}</TableCell>
                    <TableCell><Badge variant="secondary" className={t.type === "income" ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30" : "bg-destructive/10 text-destructive border border-destructive/30"}>{t.type === "income" ? "Entrada" : "Saída"}</Badge></TableCell>
                    <TableCell className={cn("text-right font-medium font-mono", t.type === "income" ? "text-emerald-400" : "text-destructive")}>{t.type === "income" ? "+" : "-"} {fmtCurrency(Number(t.amount))}</TableCell>
                    <TableCell>
                      <div className="flex gap-1 justify-end">
                        <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-primary/10 hover:text-primary" onClick={() => { setEditingTransaction(t); setForm({ description: t.description, amount: t.amount, type: t.type, category: t.category || "", date: t.date, is_recurring: t.is_recurring || false, recurrence_interval: t.recurrence_interval || "" }); setShowModal(true); }}><Edit2 className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10" onClick={() => deleteTransactionMutation.mutate(t.id)}><Trash2 className="h-4 w-4" /></Button>
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
            <div className="flex items-center justify-between p-3 rounded-xl bg-muted/30 border border-border/50">
              <div className="flex items-center gap-2">
                <RefreshCw className="h-4 w-4 text-primary" />
                <Label className="cursor-pointer">Transação recorrente</Label>
              </div>
              <Switch checked={form.is_recurring} onCheckedChange={v => setForm({ ...form, is_recurring: v })} />
            </div>
            {form.is_recurring && (
              <div><Label>Frequência</Label><select value={form.recurrence_interval || "monthly"} onChange={e => setForm({ ...form, recurrence_interval: e.target.value })} className="w-full h-10 rounded-xl border border-input bg-background px-3 py-2 text-sm"><option value="weekly">Semanal</option><option value="monthly">Mensal</option><option value="yearly">Anual</option></select></div>
            )}
          </div>
          <DialogFooter><Button variant="outline" className="rounded-xl" onClick={() => setShowModal(false)}>Cancelar</Button><Button className="rounded-xl shadow-lg shadow-primary/20" onClick={handleSave}>{editingTransaction ? "Salvar" : "Criar"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default FinanceTransactions;
