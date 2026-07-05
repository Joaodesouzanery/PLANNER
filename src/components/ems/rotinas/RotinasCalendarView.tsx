import { useMemo, useState } from "react";
import {
  add, eachDayOfInterval, endOfMonth, endOfWeek, format, isSameDay, isSameMonth, isToday,
  lastDayOfMonth, startOfMonth, startOfToday, startOfWeek,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import type { useRotinas, RoutineClientView } from "@/hooks/useRotinas";

type Rotinas = ReturnType<typeof useRotinas>;
type EventKind = "daily" | "weekly" | "monthly" | "nf" | "task";
interface DayEvent { id: string; clientId: string; clientName: string; title: string; kind: EventKind; color: string }

const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const KIND_LABEL: Record<EventKind, string> = { daily: "Diária", weekly: "Semanal", monthly: "Mensal", nf: "NF", task: "Tarefa" };
const KIND_ORDER: Record<EventKind, number> = { task: 0, nf: 1, monthly: 2, weekly: 3, daily: 4 };
const DEFAULT_COLOR = "#6366f1";

export const RotinasCalendarView = ({ rotinas, onSelectClient }: { rotinas: Rotinas; onSelectClient: (id: string) => void }) => {
  const [currentMonth, setCurrentMonth] = useState(() => startOfMonth(startOfToday()));
  const [selectedDay, setSelectedDay] = useState(() => startOfToday());

  const colorByClient = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of rotinas.clients) {
      const seg = rotinas.segments.find((s) => s.id === c.segment_id);
      map.set(c.id, seg?.color || c.color || DEFAULT_COLOR);
    }
    return map;
  }, [rotinas.clients, rotinas.segments]);

  const days = useMemo(
    () => eachDayOfInterval({ start: startOfWeek(startOfMonth(currentMonth)), end: endOfWeek(endOfMonth(currentMonth)) }),
    [currentMonth],
  );

  const eventsByDay = useMemo(() => {
    const map = new Map<string, DayEvent[]>();
    const views = rotinas.clients.map((c) => rotinas.clientViews.get(c.id)).filter(Boolean) as RoutineClientView[];
    for (const day of days) {
      const iso = format(day, "yyyy-MM-dd");
      const dow = day.getDay();
      const dom = day.getDate();
      const last = lastDayOfMonth(day).getDate();
      const matchesDay = (target: number | null | undefined) => target != null && Math.min(target, last) === dom;
      const list: DayEvent[] = [];
      for (const v of views) {
        const color = colorByClient.get(v.client.id) || DEFAULT_COLOR;
        const base = { clientId: v.client.id, clientName: v.client.name, color };
        for (const it of v.items) {
          if (it.frequency === "daily") list.push({ ...base, id: `${it.id}-${iso}`, title: it.title, kind: "daily" });
          else if (it.frequency === "weekly" && it.weekday === dow) list.push({ ...base, id: `${it.id}-${iso}`, title: it.title, kind: "weekly" });
          else if (it.frequency === "monthly" && matchesDay(it.day_of_month)) list.push({ ...base, id: `${it.id}-${iso}`, title: it.title, kind: "monthly" });
        }
        if (matchesDay(v.client.invoice_day)) list.push({ ...base, id: `nf-${v.client.id}-${iso}`, title: "Nota Fiscal", kind: "nf" });
        for (const t of v.tasks) {
          if (t.status !== "done" && t.due_date === iso) list.push({ ...base, id: `${t.id}-${iso}`, title: t.title, kind: "task" });
        }
      }
      list.sort((a, b) => KIND_ORDER[a.kind] - KIND_ORDER[b.kind] || a.clientName.localeCompare(b.clientName));
      if (list.length) map.set(iso, list);
    }
    return map;
  }, [days, rotinas.clients, rotinas.clientViews, colorByClient]);

  const selectedIso = format(selectedDay, "yyyy-MM-dd");
  const selectedEvents = eventsByDay.get(selectedIso) ?? [];
  const groupedSelected = useMemo(() => {
    const map = new Map<string, { name: string; color: string; events: DayEvent[] }>();
    for (const ev of selectedEvents) {
      const g = map.get(ev.clientId);
      if (g) g.events.push(ev);
      else map.set(ev.clientId, { name: ev.clientName, color: ev.color, events: [ev] });
    }
    return Array.from(map.entries());
  }, [selectedEvents]);

  const goToday = () => { setCurrentMonth(startOfMonth(startOfToday())); setSelectedDay(startOfToday()); };

  return (
    <div className="flex flex-col">
      {/* Header */}
      <div className="mb-3 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <div className="hidden w-14 flex-col items-center justify-center rounded-lg border bg-muted p-0.5 md:flex">
            <span className="p-0.5 text-[10px] uppercase text-muted-foreground">{format(startOfToday(), "MMM", { locale: ptBR })}</span>
            <span className="flex w-full items-center justify-center rounded-md border bg-background p-0.5 text-base font-bold">{format(startOfToday(), "d")}</span>
          </div>
          <div>
            <h2 className="text-base font-semibold capitalize text-foreground">{format(currentMonth, "MMMM yyyy", { locale: ptBR })}</h2>
            <p className="text-xs text-muted-foreground capitalize">
              {format(startOfMonth(currentMonth), "d MMM", { locale: ptBR })} – {format(endOfMonth(currentMonth), "d MMM", { locale: ptBR })}
            </p>
          </div>
        </div>
        <div className="inline-flex w-full -space-x-px md:w-auto">
          <Button onClick={() => setCurrentMonth(add(currentMonth, { months: -1 }))} variant="outline" size="icon" className="rounded-none rounded-l-lg" aria-label="Mês anterior">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button onClick={goToday} variant="outline" className="w-full rounded-none md:w-auto">Hoje</Button>
          <Button onClick={() => setCurrentMonth(add(currentMonth, { months: 1 }))} variant="outline" size="icon" className="rounded-none rounded-r-lg" aria-label="Próximo mês">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Grid */}
      <div className="overflow-hidden rounded-lg border">
        <div className="grid grid-cols-7 bg-muted/40 text-center text-[11px] font-semibold text-muted-foreground">
          {WEEKDAYS.map((d) => <div key={d} className="py-2">{d}</div>)}
        </div>
        <div className="grid grid-cols-7 auto-rows-fr">
          {days.map((day) => {
            const iso = format(day, "yyyy-MM-dd");
            const evs = eventsByDay.get(iso) ?? [];
            const inMonth = isSameMonth(day, currentMonth);
            const selected = isSameDay(day, selectedDay);
            const todayCell = isToday(day);
            return (
              <button
                key={iso}
                type="button"
                onClick={() => setSelectedDay(day)}
                className={cn(
                  "flex min-h-[76px] flex-col gap-1 border-b border-r p-1.5 text-left transition-colors hover:bg-muted/50 md:min-h-[104px]",
                  !inMonth && "bg-muted/30 text-muted-foreground",
                  selected && "bg-primary/5 ring-1 ring-inset ring-primary/50",
                )}
              >
                <time dateTime={iso} className={cn("ml-auto flex h-6 w-6 items-center justify-center rounded-full text-xs", todayCell && "bg-primary font-semibold text-primary-foreground", selected && !todayCell && "bg-foreground font-semibold text-background")}>
                  {format(day, "d")}
                </time>
                {/* desktop: chips */}
                <div className="hidden flex-col gap-0.5 overflow-hidden md:flex">
                  {evs.slice(0, 3).map((ev) => (
                    <span key={ev.id} className="flex items-center gap-1 truncate rounded px-1 py-0.5 text-[10px] leading-tight" style={{ backgroundColor: `${ev.color}22` }}>
                      <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: ev.color }} />
                      <span className="truncate">{ev.title}</span>
                    </span>
                  ))}
                  {evs.length > 3 && <span className="pl-1 text-[10px] text-muted-foreground">+{evs.length - 3} mais</span>}
                </div>
                {/* mobile: dots */}
                <div className="mt-auto flex flex-wrap gap-0.5 md:hidden">
                  {evs.slice(0, 8).map((ev) => <span key={ev.id} className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: ev.color }} />)}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Painel do dia selecionado */}
      <div className="mt-4 rounded-xl border border-border/60 bg-muted/20 p-3">
        <div className="mb-2 flex items-center gap-2">
          <CalendarDays className="h-4 w-4 text-primary" />
          <p className="text-sm font-semibold capitalize">{format(selectedDay, "EEEE, d 'de' MMMM", { locale: ptBR })}</p>
          <span className="text-xs text-muted-foreground">{selectedEvents.length} rotina{selectedEvents.length === 1 ? "" : "s"}</span>
        </div>
        {groupedSelected.length === 0 ? (
          <p className="py-4 text-center text-xs text-muted-foreground">Nenhuma rotina neste dia.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {groupedSelected.map(([clientId, g]) => (
              <div key={clientId} className="rounded-lg border border-border/50 bg-card p-2.5">
                <button onClick={() => onSelectClient(clientId)} className="mb-1.5 flex items-center gap-1.5 text-sm font-semibold hover:text-primary">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: g.color }} />
                  {g.name}
                </button>
                <div className="space-y-1">
                  {g.events.map((ev) => (
                    <div key={ev.id} className="flex items-center gap-2 text-xs">
                      <Separator orientation="vertical" className="h-3.5" style={{ backgroundColor: ev.color }} />
                      <span className="shrink-0 rounded bg-muted px-1 py-0.5 text-[9px] uppercase text-muted-foreground">{KIND_LABEL[ev.kind]}</span>
                      <span className="truncate">{ev.title}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default RotinasCalendarView;
