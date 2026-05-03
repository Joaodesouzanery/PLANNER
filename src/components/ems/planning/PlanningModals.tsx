import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  GoalFormData, MilestoneFormData, PlanningGoal, categories, statusOptions,
} from "@/hooks/usePlanningData";

interface GoalModalProps {
  open: boolean;
  onClose: () => void;
  form: GoalFormData;
  setForm: (form: GoalFormData) => void;
  editingGoal: PlanningGoal | null;
  goals: PlanningGoal[];
  okrs: { id: string; title: string }[];
  projects: { id: string; title: string }[];
  onSave: () => void;
  isSaving: boolean;
}

export const GoalModal = ({
  open, onClose, form, setForm, editingGoal, goals, okrs, projects, onSave, isSaving,
}: GoalModalProps) => (
  <Dialog open={open} onOpenChange={o => !o && onClose()}>
    <DialogContent className="max-w-[95vw] sm:max-w-lg max-h-[90vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>{editingGoal ? "Editar Meta" : "Nova Meta"}</DialogTitle>
      </DialogHeader>
      <div className="space-y-4">
        <div>
          <label className="text-sm font-medium">Título *</label>
          <Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="Ex: Aumentar receita em 30%" />
        </div>
        <div>
          <label className="text-sm font-medium">Descrição</label>
          <Textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={3} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium">Categoria</label>
            <Select value={form.category} onValueChange={v => setForm({ ...form, category: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {categories.map(c => (
                  <SelectItem key={c.value} value={c.value}>
                    <div className="flex items-center gap-2">
                      <div className={cn("w-2 h-2 rounded-full", c.color)} />{c.label}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-sm font-medium">Status</label>
            <Select value={form.status} onValueChange={v => setForm({ ...form, status: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {statusOptions.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium">Início</label>
            <Input type="date" value={form.start_date} onChange={e => setForm({ ...form, start_date: e.target.value })} />
          </div>
          <div>
            <label className="text-sm font-medium">Término</label>
            <Input type="date" value={form.end_date} onChange={e => setForm({ ...form, end_date: e.target.value })} />
          </div>
        </div>
        <div>
          <label className="text-sm font-medium">Meta Pai</label>
          <Select value={form.parent_id || "none"} onValueChange={v => setForm({ ...form, parent_id: v === "none" ? "" : v })}>
            <SelectTrigger><SelectValue placeholder="Nenhuma" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Nenhuma (raiz)</SelectItem>
              {goals.filter(g => g.id !== editingGoal?.id).map(g => <SelectItem key={g.id} value={g.id}>{g.title}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium">OKR</label>
            <Select value={form.okr_id || "none"} onValueChange={v => setForm({ ...form, okr_id: v === "none" ? "" : v })}>
              <SelectTrigger><SelectValue placeholder="Nenhum" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Nenhum</SelectItem>
                {okrs.map(o => <SelectItem key={o.id} value={o.id}>{o.title}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-sm font-medium">Projeto</label>
            <Select value={form.project_id || "none"} onValueChange={v => setForm({ ...form, project_id: v === "none" ? "" : v })}>
              <SelectTrigger><SelectValue placeholder="Nenhum" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Nenhum</SelectItem>
                {projects.map(p => <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-4">
          <Button variant="outline" onClick={onClose} className="w-full sm:w-auto">Cancelar</Button>
          <Button onClick={onSave} disabled={isSaving} className="w-full sm:w-auto">{editingGoal ? "Salvar" : "Criar Meta"}</Button>
        </div>
      </div>
    </DialogContent>
  </Dialog>
);

interface MilestoneModalProps {
  open: boolean;
  onClose: () => void;
  form: MilestoneFormData;
  setForm: (form: MilestoneFormData) => void;
  onSave: () => void;
  isSaving: boolean;
}

export const MilestoneModal = ({ open, onClose, form, setForm, onSave, isSaving }: MilestoneModalProps) => (
  <Dialog open={open} onOpenChange={o => !o && onClose()}>
    <DialogContent className="max-w-[95vw] sm:max-w-lg">
      <DialogHeader><DialogTitle>Novo Marco</DialogTitle></DialogHeader>
      <div className="space-y-4">
        <div>
          <label className="text-sm font-medium">Título *</label>
          <Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="Ex: Entregar MVP" />
        </div>
        <div>
          <label className="text-sm font-medium">Descrição</label>
          <Textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={2} />
        </div>
        <div>
          <label className="text-sm font-medium">Vencimento</label>
          <Input type="date" value={form.due_date} onChange={e => setForm({ ...form, due_date: e.target.value })} />
        </div>
        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
          <Button variant="outline" onClick={onClose} className="w-full sm:w-auto">Cancelar</Button>
          <Button onClick={onSave} disabled={isSaving} className="w-full sm:w-auto">Criar Marco</Button>
        </div>
      </div>
    </DialogContent>
  </Dialog>
);
