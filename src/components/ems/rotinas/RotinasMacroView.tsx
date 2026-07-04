import { CalendarClock, CheckSquare, ListChecks, AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { formatDateBR } from "@/components/ems/finance/useFinanceData";
import { RotinaChecklistInline } from "./RotinaChecklistInline";
import type { useRotinas, RoutineClientView, RoutineTask } from "@/hooks/useRotinas";

type Rotinas = ReturnType<typeof useRotinas>;

const statusLabel: Record<RoutineTask["status"], { label: string; tone: string }> = {
  pending: { label: "Pendente", tone: "text-muted-foreground border-border/60" },
  in_progress: { label: "Em andamento", tone: "text-amber-400 border-amber-400/40" },
  done: { label: "Concluída", tone: "text-emerald-400 border-emerald-400/40" },
};

const priorityTone: Record<string, string> = {
  alta: "text-red-400 border-red-400/40",
  high: "text-red-400 border-red-400/40",
  media: "text-amber-400 border-amber-400/40",
  medium: "text-amber-400 border-amber-400/40",
  baixa: "text-muted-foreground border-border/60",
  low: "text-muted-foreground border-border/60",
};

const pct = (p: { done: number; total: number }) => (p.total === 0 ? 0 : Math.round((p.done / p.total) * 100));

const ClientBlock = ({ view, rotinas, onSelect }: { view: RoutineClientView; rotinas: Rotinas; onSelect: () => void }) => {
  const conf = view.conferenciaProgress;
  const tar = view.tarefaProgress;
  return (
    <div className="rounded-xl border border-border bg-card p-3 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <button onClick={onSelect} className="text-left text-sm font-semibold hover:text-primary transition-colors truncate">
          {view.client.name}
        </button>
        {view.client.invoice_day && view.daysUntilInvoice !== null && (
          <Badge variant="outline" className={cn("h-5 gap-1 text-[10px]", view.daysUntilInvoice <= 3 ? "text-red-400 border-red-400/40" : view.daysUntilInvoice <= 7 ? "text-amber-400 border-amber-400/40" : "text-muted-foreground")}>
            <CalendarClock className="h-3 w-3" />NF {view.daysUntilInvoice === 0 ? "hoje" : `${view.daysUntilInvoice}d`}
          </Badge>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2 text-[10px] text-muted-foreground">
        <div>
          <div className="flex items-center justify-between mb-0.5"><span className="flex items-center gap-1"><ListChecks className="h-3 w-3" />Conf.</span><span>{conf.done}/{conf.total}</span></div>
          <Progress value={pct(conf)} className="h-1.5" />
        </div>
        <div>
          <div className="flex items-center justify-between mb-0.5"><span className="flex items-center gap-1"><CheckSquare className="h-3 w-3" />Tarefas dia</span><span>{tar.done}/{tar.total}</span></div>
          <Progress value={pct(tar)} className="h-1.5" />
        </div>
      </div>

      {/* Itens de rotina checáveis direto (sem abrir modal) */}
      <RotinaChecklistInline view={view} rotinas={rotinas} />

      <div className="space-y-1">
        {view.openTasks.length === 0 ? (
          <p className="text-[11px] text-emerald-400/80 italic">Sem pendências abertas.</p>
        ) : (
          view.openTasks.map((task) => {
            const overdue = task.due_date && task.due_date < new Date().toISOString().slice(0, 10);
            return (
              <div key={task.id} className={cn("flex items-center gap-2 rounded-md border border-border/40 bg-background/40 px-2 py-1", task.parent_task_id && "ml-4 border-dashed bg-background/20")}>
                <span className="flex-1 truncate text-xs">{task.title}</span>
                {task.priority && <Badge variant="outline" className={cn("h-4 text-[9px]", priorityTone[String(task.priority).toLowerCase()] ?? "text-muted-foreground border-border/60")}>{task.priority}</Badge>}
                <Badge variant="outline" className={cn("h-4 text-[9px]", statusLabel[task.status]?.tone)}>{statusLabel[task.status]?.label ?? task.status}</Badge>
                {task.due_date && (
                  <span className={cn("flex items-center gap-0.5 text-[9px] whitespace-nowrap", overdue ? "text-red-400" : "text-muted-foreground")}>
                    {overdue && <AlertTriangle className="h-2.5 w-2.5" />}{formatDateBR(task.due_date)}
                  </span>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export const RotinasMacroView = ({ rotinas, onSelectClient }: { rotinas: ReturnType<typeof useRotinas>; onSelectClient: (id: string) => void }) => {
  return (
    <div className="space-y-4">
      {rotinas.segments.map((segment) => {
        const clients = rotinas.clients.filter((c) => c.segment_id === segment.id);
        const views = clients.map((c) => rotinas.clientViews.get(c.id)).filter(Boolean) as RoutineClientView[];
        const totalOpen = views.reduce((s, v) => s + v.openTasks.length, 0);
        return (
          <div key={segment.id} className="rounded-xl border border-border bg-muted/30 p-3">
            <div className="mb-3 flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: segment.color ?? "#6366f1" }} />
              <span className="text-sm font-semibold">{segment.name}</span>
              <Badge variant="secondary" className="h-5 text-[10px]">{clients.length} cliente{clients.length === 1 ? "" : "s"}</Badge>
              {totalOpen > 0 && <Badge variant="outline" className="h-5 text-[10px] text-amber-400 border-amber-400/40">{totalOpen} pendência{totalOpen === 1 ? "" : "s"}</Badge>}
            </div>
            {views.length === 0 ? (
              <p className="py-2 text-center text-xs text-muted-foreground">Nenhum cliente neste segmento.</p>
            ) : (
              <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                {views.map((view) => (
                  <ClientBlock key={view.client.id} view={view} rotinas={rotinas} onSelect={() => onSelectClient(view.client.id)} />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default RotinasMacroView;
