import { useMemo, useState } from "react";
import { Copy, GripVertical, Plus, Trash2 } from "lucide-react";
import { DragDropContext, Droppable, Draggable, type DropResult } from "@hello-pangea/dnd";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { buildClientMessage, buildDailyReport } from "@/lib/routineReport";
import type { useRotinas, RoutineChecklistItem, RoutineClientView, RoutineTaskStatus } from "@/hooks/useRotinas";

type Rotinas = ReturnType<typeof useRotinas>;

const statusLabel: Record<RoutineTaskStatus, string> = { pending: "Pendente", in_progress: "Em andamento", done: "Concluída" };
const priorityLabel: Record<string, string> = { urgent: "Urgente", high: "Alta", medium: "Média", low: "Baixa" };

const copy = async (text: string, what: string) => {
  try {
    await navigator.clipboard.writeText(text);
    toast({ title: "Copiado", description: `${what} na área de transferência.` });
  } catch {
    toast({ variant: "destructive", title: "Não foi possível copiar", description: "Copie manualmente o texto." });
  }
};

const ChecklistGroup = ({ title, items, view, rotinas }: { title: string; items: RoutineChecklistItem[]; view: RoutineClientView; rotinas: Rotinas }) => (
  <div className="space-y-2">
    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>
    {items.length === 0 ? (
      <p className="text-xs text-muted-foreground">Nenhum item. Adicione em "Config".</p>
    ) : (
      items.map((item) => {
        const done = view.doneItemIds.has(item.id);
        return (
          <label key={item.id} className="flex items-center gap-3 rounded-lg border border-border/50 bg-card/60 p-2.5 cursor-pointer">
            <Checkbox checked={done} onCheckedChange={(checked) => rotinas.toggleChecklist.mutate({ item, done: !!checked })} />
            <span className={cn("text-sm", done && "text-muted-foreground line-through")}>{item.title}</span>
          </label>
        );
      })
    )}
  </div>
);

export const RotinaClientDialog = ({ view, rotinas, open, onClose }: { view: RoutineClientView; rotinas: Rotinas; open: boolean; onClose: () => void }) => {
  const { client } = view;
  const [newTask, setNewTask] = useState({ title: "", priority: "medium", due_date: "" });
  const [newItem, setNewItem] = useState<{ kind: "conferencia" | "tarefa"; title: string }>({ kind: "conferencia", title: "" });
  const [clientForm, setClientForm] = useState({ name: client.name, invoice_day: client.invoice_day ?? "", invoice_notes: client.invoice_notes ?? "", notes: client.notes ?? "" });

  const report = useMemo(() => buildDailyReport(view), [view]);
  const message = useMemo(() => buildClientMessage(view), [view]);

  const addTask = () => {
    if (!newTask.title.trim()) return;
    rotinas.saveTask.mutate(
      { client_id: client.id, title: newTask.title.trim(), priority: newTask.priority, due_date: newTask.due_date || null, status: "pending", sort_order: view.tasks.length },
      { onSuccess: () => setNewTask({ title: "", priority: "medium", due_date: "" }) },
    );
  };

  const addItem = () => {
    if (!newItem.title.trim()) return;
    rotinas.saveChecklistItem.mutate(
      { client_id: client.id, kind: newItem.kind, title: newItem.title.trim(), sort_order: view.items.filter((i) => i.kind === newItem.kind).length },
      { onSuccess: () => setNewItem({ kind: newItem.kind, title: "" }) },
    );
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-[95vw] sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {client.name}
            {client.invoice_day && view.daysUntilInvoice !== null && (
              <Badge variant="outline" className="h-5 text-[10px]">NF dia {client.invoice_day} · faltam {view.daysUntilInvoice} dias</Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="dia" className="space-y-4">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="dia">Dia</TabsTrigger>
            <TabsTrigger value="tarefas">Tarefas</TabsTrigger>
            <TabsTrigger value="relatorio">Relatório</TabsTrigger>
            <TabsTrigger value="config">Config</TabsTrigger>
          </TabsList>

          {/* Checklists do dia */}
          <TabsContent value="dia" className="space-y-4">
            <ChecklistGroup title="Conferências diárias" items={view.conferencias} view={view} rotinas={rotinas} />
            <ChecklistGroup title="Tarefas diárias" items={view.tarefas} view={view} rotinas={rotinas} />
          </TabsContent>

          {/* Tarefas / andamentos */}
          <TabsContent value="tarefas" className="space-y-4">
            <div className="flex flex-wrap items-end gap-2 rounded-xl border border-border/50 p-3">
              <div className="flex-1 min-w-[160px]">
                <Label className="text-xs">Nova pendência / etapa</Label>
                <Input value={newTask.title} onChange={(e) => setNewTask({ ...newTask, title: e.target.value })} placeholder="Descrição da tarefa" />
              </div>
              <div>
                <Label className="text-xs">Prioridade</Label>
                <Select value={newTask.priority} onValueChange={(v) => setNewTask({ ...newTask, priority: v })}>
                  <SelectTrigger className="w-[130px]"><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(priorityLabel).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Vencimento</Label>
                <Input type="date" className="w-[150px]" value={newTask.due_date} onChange={(e) => setNewTask({ ...newTask, due_date: e.target.value })} />
              </div>
              <Button onClick={addTask} disabled={!newTask.title.trim() || rotinas.saveTask.isPending} className="gap-1"><Plus className="h-4 w-4" /> Adicionar</Button>
            </div>

            <div className="space-y-2">
              {view.tasks.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">Nenhuma tarefa para este cliente.</p>
              ) : (
                <DragDropContext
                  onDragEnd={(r: DropResult) => {
                    if (!r.destination || r.destination.index === r.source.index) return;
                    const ids = view.tasks.map((t) => t.id);
                    const [moved] = ids.splice(r.source.index, 1);
                    ids.splice(r.destination.index, 0, moved);
                    rotinas.reorderTasks.mutate(ids);
                  }}
                >
                  <Droppable droppableId="rotina-tasks">
                    {(prov) => (
                      <div ref={prov.innerRef} {...prov.droppableProps} className="space-y-2">
                        {view.tasks.map((task, idx) => (
                          <Draggable key={task.id} draggableId={task.id} index={idx}>
                            {(p) => (
                              <div
                                ref={p.innerRef}
                                {...p.draggableProps}
                                className="flex flex-wrap items-center gap-2 rounded-lg border border-border/50 bg-card/60 p-2.5"
                              >
                                <button {...p.dragHandleProps} className="text-muted-foreground cursor-grab active:cursor-grabbing">
                                  <GripVertical className="h-4 w-4" />
                                </button>
                                <span className={cn("flex-1 text-sm", task.status === "done" && "text-muted-foreground line-through")}>
                                  {task.title}
                                  {task.due_date && <span className="ml-2 text-[11px] text-muted-foreground">vence {task.due_date.slice(8, 10)}/{task.due_date.slice(5, 7)}</span>}
                                </span>
                                <Select value={task.status} onValueChange={(v) => rotinas.saveTask.mutate({ id: task.id, status: v as RoutineTaskStatus })}>
                                  <SelectTrigger className="h-8 w-[150px] text-xs"><SelectValue /></SelectTrigger>
                                  <SelectContent>{Object.entries(statusLabel).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}</SelectContent>
                                </Select>
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => rotinas.deleteTask.mutate(task.id)}>
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            )}
                          </Draggable>
                        ))}
                        {prov.placeholder}
                      </div>
                    )}
                  </Droppable>
                </DragDropContext>
              )}
            </div>
          </TabsContent>

          {/* Relatorio + mensagem */}
          <TabsContent value="relatorio" className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-semibold">Relatório diário (interno)</Label>
                <Button variant="outline" size="sm" className="gap-1" onClick={() => copy(report, "Relatório copiado")}><Copy className="h-3.5 w-3.5" /> Copiar</Button>
              </div>
              <Textarea readOnly value={report} className="h-48 font-mono text-xs" />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-semibold">Mensagem para o cliente</Label>
                <Button variant="outline" size="sm" className="gap-1" onClick={() => copy(message, "Mensagem copiada")}><Copy className="h-3.5 w-3.5" /> Copiar</Button>
              </div>
              <Textarea readOnly value={message} className="h-40 text-sm" />
            </div>
          </TabsContent>

          {/* Config do cliente */}
          <TabsContent value="config" className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Nome</Label>
                <Input value={clientForm.name} onChange={(e) => setClientForm({ ...clientForm, name: e.target.value })} />
              </div>
              <div>
                <Label className="text-xs">Dia da Nota Fiscal</Label>
                <Input type="number" min={1} max={31} value={clientForm.invoice_day} onChange={(e) => setClientForm({ ...clientForm, invoice_day: e.target.value })} placeholder="ex.: 1" />
              </div>
            </div>
            <div>
              <Label className="text-xs">Observações</Label>
              <Textarea value={clientForm.notes} onChange={(e) => setClientForm({ ...clientForm, notes: e.target.value })} className="h-20" />
            </div>
            <Button
              size="sm"
              onClick={() => rotinas.saveClient.mutate({
                id: client.id,
                name: clientForm.name,
                invoice_day: clientForm.invoice_day === "" ? null : Number(clientForm.invoice_day),
                invoice_notes: clientForm.invoice_notes || null,
                notes: clientForm.notes || null,
              })}
            >
              Salvar dados do cliente
            </Button>

            <div className="space-y-3 border-t border-border/50 pt-3">
              <p className="text-sm font-semibold">Itens dos checklists diários</p>
              <div className="flex flex-wrap items-end gap-2">
                <div>
                  <Label className="text-xs">Tipo</Label>
                  <Select value={newItem.kind} onValueChange={(v) => setNewItem({ ...newItem, kind: v as "conferencia" | "tarefa" })}>
                    <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="conferencia">Conferência</SelectItem>
                      <SelectItem value="tarefa">Tarefa</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex-1 min-w-[160px]">
                  <Label className="text-xs">Item</Label>
                  <Input value={newItem.title} onChange={(e) => setNewItem({ ...newItem, title: e.target.value })} placeholder="Descrição do item" />
                </div>
                <Button variant="outline" onClick={addItem} disabled={!newItem.title.trim()} className="gap-1"><Plus className="h-4 w-4" /> Adicionar</Button>
              </div>
              <div className="space-y-1.5">
                {view.items.map((item) => (
                  <div key={item.id} className="flex items-center gap-2 rounded-lg border border-border/50 p-2 text-sm">
                    <Badge variant="secondary" className="h-5 text-[10px]">{item.kind === "conferencia" ? "Conf." : "Tarefa"}</Badge>
                    <Input
                      key={`${item.id}-${item.title}`}
                      defaultValue={item.title}
                      onBlur={(e) => { const v = e.target.value.trim(); if (v && v !== item.title) rotinas.saveChecklistItem.mutate({ id: item.id, title: v }); }}
                      className="h-8 flex-1"
                    />
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => rotinas.deleteChecklistItem.mutate(item.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};
