import { useMemo } from "react";
import { AlertTriangle, CalendarClock, CheckCircle2, Sun } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import type { useRotinas, RoutineChecklistItem, RoutineClientView, RoutineTask } from "@/hooks/useRotinas";
import { rotinasHoje, type HojeRow } from "./rotinasHoje";

type Rotinas = ReturnType<typeof useRotinas>;

const kindTone: Record<string, string> = {
  overdue: "text-red-400",
  item: "text-amber-400",
  "task-today": "text-amber-400",
  nf: "text-sky-400",
};

/** Seção "Hoje" no topo do Macro: o dia de todos os clientes num lugar só, marcável ali mesmo. */
export const RotinasHojeSection = ({ rotinas, onSelectClient }: { rotinas: Rotinas; onSelectClient: (id: string) => void }) => {
  const allViews = rotinas.clients.map((c) => rotinas.clientViews.get(c.id)).filter(Boolean) as RoutineClientView[];

  const { result, itemById, taskById } = useMemo(() => {
    const itemById = new Map<string, RoutineChecklistItem>();
    const taskById = new Map<string, RoutineTask>();
    for (const v of allViews) {
      v.todayItems.forEach((it) => itemById.set(it.id, it));
      [...v.overdueTasks, ...v.openTasks].forEach((t) => taskById.set(t.id, t));
    }
    return { result: rotinasHoje(allViews, rotinas.today), itemById, taskById };
  }, [allViews, rotinas.today]);

  const check = (row: HojeRow) => {
    if (row.itemId) {
      const item = itemById.get(row.itemId);
      if (item) rotinas.toggleChecklist.mutate({ item, done: true });
    } else if (row.taskId) {
      rotinas.saveTask.mutate({ id: row.taskId, status: "done" });
    }
  };

  if (result.rows.length === 0) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3 text-sm text-emerald-400">
        <CheckCircle2 className="h-4 w-4" /> Tudo em dia hoje — nenhuma rotina ou tarefa pendente.
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-muted/20 p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-sm font-semibold"><Sun className="h-4 w-4 text-amber-400" />Hoje</p>
        <div className="flex items-center gap-2 text-[11px] font-mono">
          {result.counts.atrasado > 0 && <span className="text-red-400">{result.counts.atrasado} atrasado</span>}
          <span className="text-amber-400">{result.counts.hoje} hoje</span>
          {result.counts.nf > 0 && <span className="text-sky-400">{result.counts.nf} NF</span>}
        </div>
      </div>
      <div className="space-y-1">
        {result.rows.map((row) => (
          <div key={row.key} className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-muted/40">
            {row.kind === "nf" ? (
              <CalendarClock className="h-4 w-4 shrink-0 text-sky-400" />
            ) : (
              <Checkbox className="shrink-0" onCheckedChange={() => check(row)} aria-label="Concluir" />
            )}
            <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: row.clientColor ?? "#6366f1" }} />
            <button onClick={() => onSelectClient(row.clientId)} className="min-w-0 flex-1 truncate text-left text-sm hover:underline">
              <span className={cn("text-xs", kindTone[row.kind])}>{row.clientName}</span>
              <span className="mx-1.5 text-muted-foreground">·</span>
              {row.title}
            </button>
            {row.kind === "overdue" && <span className="shrink-0 text-[10px] text-red-400 flex items-center gap-1"><AlertTriangle className="h-3 w-3" />{row.days}d</span>}
            {row.kind === "nf" && <span className="shrink-0 text-[10px] text-sky-400">em {row.days}d</span>}
          </div>
        ))}
      </div>
    </div>
  );
};

export default RotinasHojeSection;
