import { CalendarClock, CalendarDays, CheckSquare, ListChecks } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { daysUntilInvoice, type useRotinas, type RoutineClientView, type RoutineChecklistItem } from "@/hooks/useRotinas";

type Rotinas = ReturnType<typeof useRotinas>;
const WEEKDAYS = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

/** Badge de recorrência ao lado do item (diário não mostra badge, pra não poluir). */
export const FreqBadge = ({ item }: { item: RoutineChecklistItem }) => {
  if (item.frequency === "monthly") {
    const d = daysUntilInvoice(item.day_of_month);
    const quando = d === null ? "" : d === 0 ? " · hoje" : ` · ${d}d`;
    const tone = d !== null && d <= 3 ? "text-red-400 border-red-400/40" : d !== null && d <= 7 ? "text-amber-400 border-amber-400/40" : "text-muted-foreground border-border/50";
    return (
      <Badge variant="outline" className={cn("h-4 shrink-0 gap-0.5 px-1 text-[9px] font-normal", tone)}>
        <CalendarDays className="h-2.5 w-2.5" />dia {item.day_of_month ?? "?"}{quando}
      </Badge>
    );
  }
  if (item.frequency === "weekly") {
    return (
      <Badge variant="outline" className="h-4 shrink-0 gap-0.5 px-1 text-[9px] font-normal text-sky-400 border-sky-400/40">
        <CalendarClock className="h-2.5 w-2.5" />{item.weekday == null ? "semanal" : WEEKDAYS[item.weekday]}
      </Badge>
    );
  }
  return null;
};

const Row = ({ item, done, onToggle, child }: { item: RoutineChecklistItem; done: boolean; onToggle: (v: boolean) => void; child?: boolean }) => (
  <label className={cn("flex items-center gap-2 rounded-md border border-border/60 bg-background/40 px-2 py-1.5 cursor-pointer hover:bg-muted/40 transition-colors", child && "ml-4 border-dashed bg-background/20")}>
    <Checkbox checked={done} onCheckedChange={(v) => onToggle(!!v)} onClick={(e) => e.stopPropagation()} />
    <span className={cn("flex-1 text-xs", done && "text-muted-foreground line-through")}>{item.title}</span>
    <FreqBadge item={item} />
  </label>
);

/** Itens de topo + subobrigações indentadas. */
const Group = ({ items, view, rotinas }: { items: RoutineChecklistItem[]; view: RoutineClientView; rotinas: Rotinas }) => (
  <>
    {items.map((item) => {
      const children = view.itemChildren.get(item.id) ?? [];
      return (
        <div key={item.id} className="space-y-1">
          <Row item={item} done={view.doneItemIds.has(item.id)} onToggle={(v) => rotinas.toggleChecklist.mutate({ item, done: v })} />
          {children.map((c) => (
            <Row key={c.id} item={c} done={view.doneItemIds.has(c.id)} onToggle={(v) => rotinas.toggleChecklist.mutate({ item: c, done: v })} child />
          ))}
        </div>
      );
    })}
  </>
);

/** Lista checável (conferências + tarefas) de um cliente, com recorrência e subobrigações. */
export const RotinaChecklistInline = ({ view, rotinas }: { view: RoutineClientView; rotinas: Rotinas }) => {
  const rootConf = view.conferencias.filter((i) => !i.parent_item_id);
  const rootTar = view.tarefas.filter((i) => !i.parent_item_id);
  const empty = view.conferencias.length === 0 && view.tarefas.length === 0;

  if (empty) return <p className="text-[11px] text-muted-foreground italic px-1">Sem itens de rotina. Adicione em "Config".</p>;

  return (
    <div className="space-y-2" onClick={(e) => e.stopPropagation()}>
      {rootConf.length > 0 && (
        <div className="space-y-1">
          <p className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground"><ListChecks className="h-3 w-3" />Conferências</p>
          <Group items={rootConf} view={view} rotinas={rotinas} />
        </div>
      )}
      {rootTar.length > 0 && (
        <div className="space-y-1">
          <p className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground"><CheckSquare className="h-3 w-3" />Tarefas</p>
          <Group items={rootTar} view={view} rotinas={rotinas} />
        </div>
      )}
    </div>
  );
};

export default RotinaChecklistInline;
