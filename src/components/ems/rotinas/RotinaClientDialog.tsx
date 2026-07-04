import { useMemo, useState } from "react";
import { Copy, GripVertical, Plus, Trash2 } from "lucide-react";
import { DragDropContext, Droppable, Draggable, type DropResult } from "@hello-pangea/dnd";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { buildClientMessage, buildDailyReport } from "@/lib/routineReport";
import { RotinaChecklistInline } from "./RotinaChecklistInline";
import type { useRotinas, RoutineChecklistItem, RoutineClientView, RoutineTaskStatus } from "@/hooks/useRotinas";

type Rotinas = ReturnType<typeof useRotinas>;

const statusLabel: Record<RoutineTaskStatus, string> = { pending: "Pendente", in_progress: "Em andamento", done: "Concluída" };
const priorityLabel: Record<string, string> = { urgent: "Urgente", high: "Alta", medium: "Média", low: "Baixa" };
const FREQ_LABEL: Record<string, string> = { daily: "Diária", weekly: "Semanal", monthly: "Mensal" };
const WEEKDAY_OPTS: [string, string][] = [["1", "Segunda"], ["2", "Terça"], ["3", "Quarta"], ["4", "Quinta"], ["5", "Sexta"], ["6", "Sábado"], ["0", "Domingo"]];

const copy = async (text: string, what: string) => {
  try {
    await navigator.clipboard.writeText(text);
    toast({ title: "Copiado", description: `${what} na área de transferência.` });
  } catch {
    toast({ variant: "destructive", title: "Não foi possível copiar", description: "Copie manualmente o texto." });
  }
};

/** Linha de configuração de um item: título + frequência editável (+ dia/semana), com indent p/ subitens. */
const ItemConfigRow = ({ item, rotinas, child }: { item: RoutineChecklistItem; rotinas: Rotinas; child?: boolean }) => (
  <div className={cn("flex flex-wrap items-center gap-2 rounded-lg border border-border/50 p-2 text-sm", child && "ml-5 border-dashed bg-muted/20")}>
    <Badge variant="secondary" className="h-5 text-[10px]">{item.kind === "conferencia" ? "Conf." : "Tarefa"}</Badge>
    <Input
      key={`${item.id}-${item.title}`}
      defaultValue={item.title}
      onBlur={(e) => { const v = e.target.value.trim(); if (v && v !== item.title) rotinas.saveChecklistItem.mutate({ id: item.id, title: v }); }}
      className="h-8 min-w-[120px] flex-1"
    />
    <Select
      value={item.frequency}
      onValueChange={(v) => rotinas.saveChecklistItem.mutate({ id: item.id, frequency: v as any, day_of_month: v === "monthly" ? (item.day_of_month ?? 1) : null, weekday: v === "weekly" ? (item.weekday ?? 1) : null })}
    >
      <SelectTrigger className="h-8 w-[104px] text-xs"><SelectValue /></SelectTrigger>
      <SelectContent>{Object.entries(FREQ_LABEL).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}</SelectContent>
    </Select>
    {item.frequency === "monthly" && (
      <Input type="number" min={1} max={31} defaultValue={item.day_of_month ?? ""} placeholder="dia"
        onBlur={(e) => rotinas.saveChecklistItem.mutate({ id: item.id, day_of_month: Number(e.target.value) || null })} className="h-8 w-[64px]" />
    )}
    {item.frequency === "weekly" && (
      <Select value={String(item.weekday ?? 1)} onValueChange={(v) => rotinas.saveChecklistItem.mutate({ id: item.id, weekday: Number(v) })}>
        <SelectTrigger className="h-8 w-[110px] text-xs"><SelectValue /></SelectTrigger>
        <SelectContent>{WEEKDAY_OPTS.map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent>
      </Select>
    )}
    <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => rotinas.deleteChecklistItem.mutate(item.id)}>
      <Trash2 className="h-3.5 w-3.5" />
    </Button>
  </div>
);

export const RotinaClientDialog = ({ view, rotinas, open, onClose }: { view: RoutineClientView; rotinas: Rotinas; open: boolean; onClose: () => void }) => {
  const { client } = view;
  const [newTask, setNewTask] = useState({ title: "", priority: "medium", due_date: "", parent_task_id: "" });
  const [newItem, setNewItem] = useState<{ kind: "conferencia" | "tarefa"; title: string; frequency: string; day_of_month: string; weekday: string; parent_item_id: string }>({ kind: "conferencia", title: "", frequency: "daily", day_of_month: "", weekday: "1", parent_item_id: "" });
  const [clientForm, setClientForm] = useState({ name: client.name, invoice_day: client.invoice_day ?? "", invoice_notes: client.invoice_notes ?? "", notes: client.notes ?? "" });

  const report = useMemo(() => buildDailyReport(view), [view]);
  const message = useMemo(() => buildClientMessage(view), [view]);

  const addTask = () => {
    if (!newTask.title.trim()) return;
    rotinas.saveTask.mutate(
      { client_id: client.id, title: newTask.title.trim(), priority: newTask.priority, due_date: newTask.due_date || null, status: "pending", parent_task_id: newTask.parent_task_id || null, sort_order: view.tasks.length },
      { onSuccess: () => setNewTask({ title: "", priority: "medium", due_date: "", parent_task_id: "" }) },
    );
  };

  const addItem = () => {
    if (!newItem.title.trim()) return;
    rotinas.saveChecklistItem.mutate(
      {
        client_id: client.id,
        kind: newItem.kind,
        title: newItem.title.trim(),
        frequency: newItem.frequency as any,
        day_of_month: newItem.frequency === "monthly" && newItem.day_of_month ? Number(newItem.day_of_month) : null,
        weekday: newItem.frequency === "weekly" ? Number(newItem.weekday) : null,
        parent_item_id: newItem.parent_item_id || null,
        sort_order: view.items.filter((i) => i.kind === newItem.kind).length,
      },
      { onSuccess: () => setNewItem({ ...newItem, title: "", parent_item_id: "" }) },
    );
  };

  const parentTaskOptions = view.tasks.filter((t) => !t.parent_task_id);
  const parentItemOptions = view.items.filter((i) => i.kind === newItem.kind && !i.parent_item_id);

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

          {/* Checklists do dia/semana/mês */}
          <TabsContent value="dia" className="space-y-4">
            <RotinaChecklistInline view={view} rotinas={rotinas} />
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
              <div>
                <Label className="text-xs">Subtarefa de</Label>
                <Select value={newTask.parent_task_id || "none"} onValueChange={(v) => setNewTask({ ...newTask, parent_task_id: v === "none" ? "" : v })}>
                  <SelectTrigger className="w-[160px] text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— nenhuma —</SelectItem>
                    {parentTaskOptions.map((t) => <SelectItem key={t.id} value={t.id}>{t.title.length > 28 ? `${t.title.slice(0, 27)}…` : t.title}</SelectItem>)}
                  </SelectContent>
                </Select>
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
                                className={cn("flex flex-wrap items-center gap-2 rounded-lg border border-border/50 bg-card/60 p-2.5", task.parent_task_id && "ml-5 border-dashed")}
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
              <p className="text-sm font-semibold">Itens de rotina (conferências e tarefas)</p>
              <div className="flex flex-wrap items-end gap-2 rounded-xl border border-border/50 p-3">
                <div>
                  <Label className="text-xs">Tipo</Label>
                  <Select value={newItem.kind} onValueChange={(v) => setNewItem({ ...newItem, kind: v as "conferencia" | "tarefa", parent_item_id: "" })}>
                    <SelectTrigger className="w-[130px]"><SelectValue /></SelectTrigger>
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
                <div>
                  <Label className="text-xs">Recorrência</Label>
                  <Select value={newItem.frequency} onValueChange={(v) => setNewItem({ ...newItem, frequency: v })}>
                    <SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger>
                    <SelectContent>{Object.entries(FREQ_LABEL).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                {newItem.frequency === "monthly" && (
                  <div>
                    <Label className="text-xs">Dia do mês</Label>
                    <Input type="number" min={1} max={31} className="w-[90px]" value={newItem.day_of_month} onChange={(e) => setNewItem({ ...newItem, day_of_month: e.target.value })} placeholder="ex.: 5" />
                  </div>
                )}
                {newItem.frequency === "weekly" && (
                  <div>
                    <Label className="text-xs">Dia da semana</Label>
                    <Select value={newItem.weekday} onValueChange={(v) => setNewItem({ ...newItem, weekday: v })}>
                      <SelectTrigger className="w-[130px]"><SelectValue /></SelectTrigger>
                      <SelectContent>{WEEKDAY_OPTS.map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                )}
                <div>
                  <Label className="text-xs">Sub-item de</Label>
                  <Select value={newItem.parent_item_id || "none"} onValueChange={(v) => setNewItem({ ...newItem, parent_item_id: v === "none" ? "" : v })}>
                    <SelectTrigger className="w-[150px] text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">— nenhum —</SelectItem>
                      {parentItemOptions.map((i) => <SelectItem key={i.id} value={i.id}>{i.title.length > 26 ? `${i.title.slice(0, 25)}…` : i.title}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <Button variant="outline" onClick={addItem} disabled={!newItem.title.trim()} className="gap-1"><Plus className="h-4 w-4" /> Adicionar</Button>
              </div>
              <div className="space-y-1.5">
                {view.items.filter((i) => !i.parent_item_id).map((item) => (
                  <div key={item.id} className="space-y-1.5">
                    <ItemConfigRow item={item} rotinas={rotinas} />
                    {(view.itemChildren.get(item.id) ?? []).map((c) => <ItemConfigRow key={c.id} item={c} rotinas={rotinas} child />)}
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
