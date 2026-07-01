import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Edit2, Trash2, Target, FileDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { useFinanceData, type OKR } from "./useFinanceData";
import { exportTablePdf } from "@/lib/exportPdf";
import { toast } from "sonner";

const FinanceOKRs = () => {
  const { okrs, saveOkrMutation, deleteOkrMutation } = useFinanceData();

  const exportOkrs = async () => {
    try {
      await exportTablePdf({
        title: "OKRs financeiros",
        subtitle: `${okrs.length} OKR(s) · gerado em ${new Date().toLocaleString("pt-BR")}`,
        filename: "okrs.pdf",
        sections: [{
          head: [["OKR", "Descrição", "Atual", "Meta", "Unid.", "Período", "Progresso"]],
          body: okrs.length ? okrs.map((o) => [o.title, o.description || "-", o.current_value, o.target_value, o.unit, o.period === "quarterly" ? "Trimestral" : "Anual", `${Math.round((o.current_value / (o.target_value || 1)) * 100)}%`]) : [["—", "—", "—", "—", "—", "—", "—"]],
        }],
      });
      toast.success("OKRs exportados!");
    } catch (err: any) {
      toast.error("Falha ao exportar", { description: err?.message });
    }
  };
  const [showModal, setShowModal] = useState(false);
  const [editingOkr, setEditingOkr] = useState<OKR | null>(null);
  const [form, setForm] = useState({ title: "", description: "", target_value: 100, current_value: 0, unit: "%", period: "quarterly" });

  const handleSave = () => {
    saveOkrMutation.mutate({ form, editingId: editingOkr?.id }, {
      onSuccess: () => { setShowModal(false); setEditingOkr(null); setForm({ title: "", description: "", target_value: 100, current_value: 0, unit: "%", period: "quarterly" }); },
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={exportOkrs} className="rounded-xl"><FileDown className="h-4 w-4 mr-2" />Exportar</Button>
        <Button onClick={() => setShowModal(true)} className="rounded-xl shadow-lg shadow-primary/20"><Plus className="h-4 w-4 mr-2" />Novo OKR</Button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {okrs.map(okr => {
          const progress = (okr.current_value / okr.target_value) * 100;
          return (
            <Card key={okr.id} className="border border-border/50 bg-card/80 hover:border-primary/30 transition-all duration-300 hover:shadow-md hover:shadow-primary/5">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div><CardTitle className="text-lg">{okr.title}</CardTitle>{okr.description && <p className="text-sm text-muted-foreground mt-1">{okr.description}</p>}</div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-primary/10 hover:text-primary" onClick={() => { setEditingOkr(okr); setForm({ title: okr.title, description: okr.description || "", target_value: okr.target_value, current_value: okr.current_value, unit: okr.unit, period: okr.period }); setShowModal(true); }}><Edit2 className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10" onClick={() => deleteOkrMutation.mutate(okr.id)}><Trash2 className="h-4 w-4" /></Button>
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

      <Dialog open={showModal} onOpenChange={open => { if (!open) { setShowModal(false); setEditingOkr(null); } }}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingOkr ? "Editar OKR" : "Novo OKR"}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div><Label>Título</Label><Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="Ex: Aumentar receita mensal" className="rounded-xl" /></div>
            <div><Label>Descrição</Label><Input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} className="rounded-xl" /></div>
            <div className="grid grid-cols-3 gap-4">
              <div><Label>Meta</Label><Input type="number" value={form.target_value} onChange={e => setForm({ ...form, target_value: Number(e.target.value) })} className="rounded-xl font-mono" /></div>
              <div><Label>Atual</Label><Input type="number" value={form.current_value} onChange={e => setForm({ ...form, current_value: Number(e.target.value) })} className="rounded-xl font-mono" /></div>
              <div><Label>Unidade</Label><Input value={form.unit} onChange={e => setForm({ ...form, unit: e.target.value })} placeholder="%" className="rounded-xl" /></div>
            </div>
            <div><Label>Período</Label><select value={form.period} onChange={e => setForm({ ...form, period: e.target.value })} className="w-full h-10 rounded-xl border border-input bg-background px-3 py-2 text-sm"><option value="quarterly">Trimestral</option><option value="yearly">Anual</option></select></div>
          </div>
          <DialogFooter><Button variant="outline" className="rounded-xl" onClick={() => setShowModal(false)}>Cancelar</Button><Button className="rounded-xl shadow-lg shadow-primary/20" onClick={handleSave}>{editingOkr ? "Salvar" : "Criar"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default FinanceOKRs;
