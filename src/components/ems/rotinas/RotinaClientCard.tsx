import { useState, type ReactNode } from "react";
import { AlertTriangle, CalendarClock, Check, CheckSquare, CornerDownRight, FileText, ListChecks, Pencil, Plus, Trash2, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useConfirm } from "@/hooks/useConfirm";
import { formatDateBR } from "@/components/ems/finance/useFinanceData";
import { FreqBadge } from "./RotinaChecklistInline";
import type { useRotinas, RoutineChecklistItem, RoutineClientView, RoutineTask } from "@/hooks/useRotinas";

type Rotinas = ReturnType<typeof useRotinas>;

const FREQ_LABEL: Record<string, string> = { daily: "Diária", weekly: "Semanal", monthly: "Mensal" };
const WEEKDAY_OPTS: [string, string][] = [["1", "Seg"], ["2", "Ter"], ["3", "Qua"], ["4", "Qui"], ["5", "Sex"], ["6", "Sáb"], ["0", "Dom"]];
const STATUS: Record<string, { label: string; tone: string }> = {
  pending: { label: "Pendente", tone: "text-muted-foreground" },
  in_progress: { label: "Andamento", tone: "text-amber-400" },
  done: { label: "Concluída", tone: "text-emerald-400" },
};
const PRIORITY_OPTS: [string, string][] = [["low", "Baixa"], ["medium", "Média"], ["high", "Alta"], ["urgent", "Urgente"]];
const pct = (p: { done: number; total: number }) => (p.total === 0 ? 0 : Math.round((p.done / p.total) * 100));
const todayIso = () => new Date().toISOString().slice(0, 10);

const IconBtn = ({ onClick, title, danger, children }: { onClick: () => void; title: string; danger?: boolean; children: ReactNode }) => (
  <button type="button" title={title} onClick={onClick} className={cn("rounded p-1 text-muted-foreground transition-colors hover:bg-muted", danger ? "hover:text-destructive" : "hover:text-foreground")}>
    {children}
  </button>
);

/** Campos de recorrência (Diária/Semanal/Mensal + dia/weekday) usados em add e edição. */
const RecurrenceFields = ({ freq, setFreq, day, setDay, weekday, setWeekday }: {
  freq: string; setFreq: (v: string) => void; day: string; setDay: (v: string) => void; weekday: string; setWeekday: (v: string) => void;
}) => (
  <>
    <Select value={freq} onValueChange={setFreq}>
      <SelectTrigger className="h-7 w-[92px] text-xs"><SelectValue /></SelectTrigger>
      <SelectContent>{Object.entries(FREQ_LABEL).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}</SelectContent>
    </Select>
    {freq === "monthly" && (
      <Input type="number" min={1} max={31} value={day} onChange={(e) => setDay(e.target.value)} placeholder="dia" className="h-7 w-[56px] text-xs" />
    )}
    {freq === "weekly" && (
      <Select value={weekday} onValueChange={setWeekday}>
        <SelectTrigger className="h-7 w-[74px] text-xs"><SelectValue /></SelectTrigger>
        <SelectContent>{WEEKDAY_OPTS.map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent>
      </Select>
    )}
  </>
);

/** Form inline para criar item (ou subitem, se parentId). */
const ItemForm = ({ clientId, kind, parentId, sortBase, rotinas, onDone }: {
  clientId: string; kind: "conferencia" | "tarefa"; parentId?: string; sortBase: number; rotinas: Rotinas; onDone: () => void;
}) => {
  const [title, setTitle] = useState("");
  const [freq, setFreq] = useState("daily");
  const [day, setDay] = useState("");
  const [weekday, setWeekday] = useState("1");
  const add = () => {
    if (!title.trim()) return;
    rotinas.saveChecklistItem.mutate({
      client_id: clientId, kind, title: title.trim(),
      frequency: freq as any,
      day_of_month: freq === "monthly" && day ? Number(day) : null,
      weekday: freq === "weekly" ? Number(weekday) : null,
      parent_item_id: parentId ?? null,
      sort_order: sortBase,
    }, { onSuccess: () => { setTitle(""); onDone(); } });
  };
  return (
    <div className={cn("flex flex-wrap items-center gap-1.5 rounded-md border border-dashed border-primary/40 bg-background/50 p-1.5", parentId && "ml-4")}>
      <Input value={title} onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} placeholder={parentId ? "Novo subitem" : "Novo item"} className="h-7 min-w-[110px] flex-1 text-xs" autoFocus />
      <RecurrenceFields freq={freq} setFreq={setFreq} day={day} setDay={setDay} weekday={weekday} setWeekday={setWeekday} />
      <Button size="icon" className="h-7 w-7" onClick={add} disabled={!title.trim()}><Check className="h-3.5 w-3.5" /></Button>
      <IconBtn title="Cancelar" onClick={onDone}><X className="h-3.5 w-3.5" /></IconBtn>
    </div>
  );
};

const ItemRow = ({ item, view, rotinas, onDelete, child }: {
  item: RoutineChecklistItem; view: RoutineClientView; rotinas: Rotinas; onDelete: (item: RoutineChecklistItem) => void; child?: boolean;
}) => {
  const [editing, setEditing] = useState(false);
  const [addingSub, setAddingSub] = useState(false);
  const [title, setTitle] = useState(item.title);
  const [freq, setFreq] = useState(item.frequency || "daily");
  const [day, setDay] = useState(item.day_of_month ? String(item.day_of_month) : "");
  const [weekday, setWeekday] = useState(item.weekday != null ? String(item.weekday) : "1");
  const done = view.doneItemIds.has(item.id);
  const children = view.itemChildren.get(item.id) ?? [];

  const save = () => {
    if (!title.trim()) return;
    rotinas.saveChecklistItem.mutate({
      id: item.id, title: title.trim(),
      frequency: freq as any,
      day_of_month: freq === "monthly" && day ? Number(day) : null,
      weekday: freq === "weekly" ? Number(weekday) : null,
    }, { onSuccess: () => setEditing(false) });
  };

  return (
    <div className={cn("space-y-1", child && "ml-4")}>
      {editing ? (
        <div className="flex flex-wrap items-center gap-1.5 rounded-md border border-primary/40 bg-background/60 p-1.5">
          <Input value={title} onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => e.key === "Enter" && save()} className="h-7 min-w-[110px] flex-1 text-xs" autoFocus />
          <RecurrenceFields freq={freq} setFreq={setFreq} day={day} setDay={setDay} weekday={weekday} setWeekday={setWeekday} />
          <Button size="icon" className="h-7 w-7" onClick={save}><Check className="h-3.5 w-3.5" /></Button>
          <IconBtn title="Cancelar" onClick={() => { setEditing(false); setTitle(item.title); }}><X className="h-3.5 w-3.5" /></IconBtn>
        </div>
      ) : (
        <div className="flex items-center gap-1.5 rounded-md border border-border/60 bg-background/40 px-2 py-1.5">
          <Checkbox checked={done} onCheckedChange={(v) => rotinas.toggleChecklist.mutate({ item, done: !!v })} />
          <span className={cn("flex-1 truncate text-xs", done && "text-muted-foreground line-through")}>{item.title}</span>
          <FreqBadge item={item} />
          {!child && <IconBtn title="Subitem" onClick={() => setAddingSub((v) => !v)}><CornerDownRight className="h-3 w-3" /></IconBtn>}
          <IconBtn title="Editar" onClick={() => setEditing(true)}><Pencil className="h-3 w-3" /></IconBtn>
          <IconBtn title="Excluir" danger onClick={() => onDelete(item)}><Trash2 className="h-3 w-3" /></IconBtn>
        </div>
      )}
      {children.map((c) => <ItemRow key={c.id} item={c} view={view} rotinas={rotinas} onDelete={onDelete} child />)}
      {addingSub && <ItemForm clientId={item.client_id} kind={item.kind} parentId={item.id} sortBase={children.length} rotinas={rotinas} onDone={() => setAddingSub(false)} />}
    </div>
  );
};

const TaskForm = ({ clientId, parentId, sortBase, rotinas, onDone }: {
  clientId: string; parentId?: string; sortBase: number; rotinas: Rotinas; onDone: () => void;
}) => {
  const [title, setTitle] = useState("");
  const [due, setDue] = useState("");
  const add = () => {
    if (!title.trim()) return;
    rotinas.saveTask.mutate({
      client_id: clientId, title: title.trim(), status: "pending", priority: "medium",
      due_date: due || null, parent_task_id: parentId ?? null, sort_order: sortBase,
    }, { onSuccess: () => { setTitle(""); setDue(""); onDone(); } });
  };
  return (
    <div className={cn("flex flex-wrap items-center gap-1.5 rounded-md border border-dashed border-primary/40 bg-background/50 p-1.5", parentId && "ml-4")}>
      <Input value={title} onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} placeholder={parentId ? "Nova subtarefa" : "Nova pendência"} className="h-7 min-w-[110px] flex-1 text-xs" autoFocus />
      <Input type="date" value={due} onChange={(e) => setDue(e.target.value)} className="h-7 w-[130px] text-xs" />
      <Button size="icon" className="h-7 w-7" onClick={add} disabled={!title.trim()}><Check className="h-3.5 w-3.5" /></Button>
      <IconBtn title="Cancelar" onClick={onDone}><X className="h-3.5 w-3.5" /></IconBtn>
    </div>
  );
};

const TaskRow = ({ task, childrenTasks, rotinas, onDelete, child }: {
  task: RoutineTask; childrenTasks: RoutineTask[]; rotinas: Rotinas; onDelete: (task: RoutineTask) => void; child?: boolean;
}) => {
  const [editing, setEditing] = useState(false);
  const [addingSub, setAddingSub] = useState(false);
  const [title, setTitle] = useState(task.title);
  const [priority, setPriority] = useState(task.priority || "medium");
  const [due, setDue] = useState(task.due_date ?? "");
  const overdue = task.due_date && task.due_date < todayIso();

  const save = () => {
    if (!title.trim()) return;
    rotinas.saveTask.mutate({ id: task.id, title: title.trim(), priority, due_date: due || null }, { onSuccess: () => setEditing(false) });
  };

  return (
    <div className={cn("space-y-1", child && "ml-4")}>
      {editing ? (
        <div className="flex flex-wrap items-center gap-1.5 rounded-md border border-primary/40 bg-background/60 p-1.5">
          <Input value={title} onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => e.key === "Enter" && save()} className="h-7 min-w-[110px] flex-1 text-xs" autoFocus />
          <Select value={priority} onValueChange={setPriority}>
            <SelectTrigger className="h-7 w-[86px] text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>{PRIORITY_OPTS.map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent>
          </Select>
          <Input type="date" value={due} onChange={(e) => setDue(e.target.value)} className="h-7 w-[130px] text-xs" />
          <Button size="icon" className="h-7 w-7" onClick={save}><Check className="h-3.5 w-3.5" /></Button>
          <IconBtn title="Cancelar" onClick={() => { setEditing(false); setTitle(task.title); }}><X className="h-3.5 w-3.5" /></IconBtn>
        </div>
      ) : (
        <div className="flex items-center gap-1.5 rounded-md border border-border/40 bg-background/40 px-2 py-1">
          <span className={cn("flex-1 truncate text-xs", task.status === "done" && "text-muted-foreground line-through")}>{task.title}</span>
          {task.due_date && (
            <span className={cn("flex items-center gap-0.5 whitespace-nowrap text-[9px]", overdue ? "text-red-400" : "text-muted-foreground")}>
              {overdue && <AlertTriangle className="h-2.5 w-2.5" />}{formatDateBR(task.due_date)}
            </span>
          )}
          <Select value={task.status} onValueChange={(v) => rotinas.saveTask.mutate({ id: task.id, status: v as any })}>
            <SelectTrigger className={cn("h-6 w-[104px] text-[10px]", STATUS[task.status]?.tone)}><SelectValue /></SelectTrigger>
            <SelectContent>{Object.entries(STATUS).map(([k, s]) => <SelectItem key={k} value={k}>{s.label}</SelectItem>)}</SelectContent>
          </Select>
          {!child && <IconBtn title="Subtarefa" onClick={() => setAddingSub((v) => !v)}><CornerDownRight className="h-3 w-3" /></IconBtn>}
          <IconBtn title="Editar" onClick={() => setEditing(true)}><Pencil className="h-3 w-3" /></IconBtn>
          <IconBtn title="Excluir" danger onClick={() => onDelete(task)}><Trash2 className="h-3 w-3" /></IconBtn>
        </div>
      )}
      {childrenTasks.map((c) => <TaskRow key={c.id} task={c} childrenTasks={[]} rotinas={rotinas} onDelete={onDelete} child />)}
      {addingSub && <TaskForm clientId={task.client_id} parentId={task.id} sortBase={childrenTasks.length} rotinas={rotinas} onDone={() => setAddingSub(false)} />}
    </div>
  );
};

const GroupHeader = ({ icon: Icon, label, count, onAdd }: { icon: typeof ListChecks; label: string; count: string; onAdd: () => void }) => (
  <div className="flex items-center justify-between">
    <p className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground"><Icon className="h-3 w-3" />{label} <span className="text-muted-foreground/60">{count}</span></p>
    <IconBtn title={`Adicionar em ${label}`} onClick={onAdd}><Plus className="h-3.5 w-3.5" /></IconBtn>
  </div>
);

export const RotinaClientCard = ({ view, rotinas, onOpenReport }: { view: RoutineClientView; rotinas: Rotinas; onOpenReport: () => void }) => {
  const confirm = useConfirm();
  const [addConf, setAddConf] = useState(false);
  const [addTar, setAddTar] = useState(false);
  const [addTask, setAddTask] = useState(false);

  const delItem = async (item: RoutineChecklistItem) => {
    const hasKids = (view.itemChildren.get(item.id)?.length ?? 0) > 0;
    if (await confirm({ title: "Excluir item?", description: hasKids ? "Os subitens também serão excluídos." : undefined, destructive: true, confirmText: "Excluir" })) {
      rotinas.deleteChecklistItem.mutate(item.id);
    }
  };
  const delTask = async (task: RoutineTask) => {
    const hasKids = (view.taskChildren.get(task.id)?.length ?? 0) > 0;
    if (await confirm({ title: "Excluir pendência?", description: hasKids ? "As subtarefas também serão excluídas." : undefined, destructive: true, confirmText: "Excluir" })) {
      rotinas.deleteTask.mutate(task.id);
    }
  };

  const rootConf = view.conferencias.filter((i) => !i.parent_item_id);
  const rootTar = view.tarefas.filter((i) => !i.parent_item_id);
  const openById = new Set(view.openTasks.map((t) => t.id));
  const rootTasks = view.openTasks.filter((t) => !t.parent_task_id || !openById.has(t.parent_task_id));
  const childOpen = (id: string) => view.openTasks.filter((t) => t.parent_task_id === id);

  return (
    <div className="space-y-2 rounded-xl border border-border bg-card p-3">
      <div className="flex items-start justify-between gap-2">
        <span className="truncate text-sm font-semibold">{view.client.name}</span>
        <div className="flex items-center gap-1">
          {view.client.invoice_day && view.daysUntilInvoice !== null && (
            <Badge variant="outline" className={cn("h-5 gap-1 text-[10px]", view.daysUntilInvoice <= 3 ? "text-red-400 border-red-400/40" : view.daysUntilInvoice <= 7 ? "text-amber-400 border-amber-400/40" : "text-muted-foreground")}>
              <CalendarClock className="h-3 w-3" />NF {view.daysUntilInvoice === 0 ? "hoje" : `${view.daysUntilInvoice}d`}
            </Badge>
          )}
          <IconBtn title="Relatório / mensagem" onClick={onOpenReport}><FileText className="h-3.5 w-3.5" /></IconBtn>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 text-[10px] text-muted-foreground">
        <div>
          <div className="mb-0.5 flex items-center justify-between"><span className="flex items-center gap-1"><ListChecks className="h-3 w-3" />Hoje</span><span>{view.todayProgress.done}/{view.todayProgress.total}</span></div>
          <Progress value={pct(view.todayProgress)} className="h-1.5" />
        </div>
        <div>
          <div className="mb-0.5 flex items-center justify-between"><span className="flex items-center gap-1"><CalendarClock className="h-3 w-3" />Mês</span><span>{view.monthProgress.done}/{view.monthProgress.total}</span></div>
          <Progress value={pct(view.monthProgress)} className="h-1.5" />
        </div>
      </div>

      {/* Conferências */}
      <div className="space-y-1">
        <GroupHeader icon={ListChecks} label="Conferências" count={`${view.conferenciaProgress.done}/${view.conferenciaProgress.total}`} onAdd={() => setAddConf((v) => !v)} />
        {rootConf.map((item) => <ItemRow key={item.id} item={item} view={view} rotinas={rotinas} onDelete={delItem} />)}
        {addConf && <ItemForm clientId={view.client.id} kind="conferencia" sortBase={view.items.filter((i) => i.kind === "conferencia").length} rotinas={rotinas} onDone={() => setAddConf(false)} />}
      </div>

      {/* Tarefas (itens) */}
      <div className="space-y-1">
        <GroupHeader icon={CheckSquare} label="Tarefas" count={`${view.tarefaProgress.done}/${view.tarefaProgress.total}`} onAdd={() => setAddTar((v) => !v)} />
        {rootTar.map((item) => <ItemRow key={item.id} item={item} view={view} rotinas={rotinas} onDelete={delItem} />)}
        {addTar && <ItemForm clientId={view.client.id} kind="tarefa" sortBase={view.items.filter((i) => i.kind === "tarefa").length} rotinas={rotinas} onDone={() => setAddTar(false)} />}
      </div>

      {/* Pendências (tarefas/andamentos) */}
      <div className="space-y-1 border-t border-border/50 pt-2">
        <GroupHeader icon={AlertTriangle} label="Pendências" count={String(view.openTasks.length)} onAdd={() => setAddTask((v) => !v)} />
        {rootTasks.length === 0 && !addTask && <p className="text-[11px] italic text-emerald-400/80">Sem pendências abertas.</p>}
        {rootTasks.map((task) => <TaskRow key={task.id} task={task} childrenTasks={childOpen(task.id)} rotinas={rotinas} onDelete={delTask} />)}
        {addTask && <TaskForm clientId={view.client.id} sortBase={view.tasks.length} rotinas={rotinas} onDone={() => setAddTask(false)} />}
      </div>
    </div>
  );
};

export default RotinaClientCard;
