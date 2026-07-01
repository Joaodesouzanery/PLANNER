import { ListChecks, CheckSquare } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import type { useRotinas, RoutineClientView, RoutineChecklistItem } from "@/hooks/useRotinas";

type Rotinas = ReturnType<typeof useRotinas>;

const Row = ({ item, done, onToggle }: { item: RoutineChecklistItem; done: boolean; onToggle: (v: boolean) => void }) => (
  <label className="flex items-center gap-2 rounded-md border border-border/60 bg-background/40 px-2 py-1.5 cursor-pointer hover:bg-muted/40 transition-colors">
    <Checkbox checked={done} onCheckedChange={(v) => onToggle(!!v)} onClick={(e) => e.stopPropagation()} />
    <span className={cn("text-xs", done && "text-muted-foreground line-through")}>{item.title}</span>
  </label>
);

/** Lista checável (conferências + tarefas do dia) de um cliente, reutilizável em cards e na visão macro. */
export const RotinaChecklistInline = ({ view, rotinas }: { view: RoutineClientView; rotinas: Rotinas }) => {
  const toggle = (item: RoutineChecklistItem, done: boolean) => rotinas.toggleChecklist.mutate({ item, done });
  const empty = view.conferencias.length === 0 && view.tarefas.length === 0;

  if (empty) return <p className="text-[11px] text-muted-foreground italic px-1">Sem itens de rotina. Adicione em "Config".</p>;

  return (
    <div className="space-y-2" onClick={(e) => e.stopPropagation()}>
      {view.conferencias.length > 0 && (
        <div className="space-y-1">
          <p className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground"><ListChecks className="h-3 w-3" />Conferências</p>
          {view.conferencias.map((item) => (
            <Row key={item.id} item={item} done={view.doneItemIds.has(item.id)} onToggle={(v) => toggle(item, v)} />
          ))}
        </div>
      )}
      {view.tarefas.length > 0 && (
        <div className="space-y-1">
          <p className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground"><CheckSquare className="h-3 w-3" />Tarefas do dia</p>
          {view.tarefas.map((item) => (
            <Row key={item.id} item={item} done={view.doneItemIds.has(item.id)} onToggle={(v) => toggle(item, v)} />
          ))}
        </div>
      )}
    </div>
  );
};

export default RotinaChecklistInline;
