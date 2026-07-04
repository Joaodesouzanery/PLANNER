import { AlertTriangle, CalendarClock, CalendarDays, CheckSquare, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { useRotinas, RoutineClientView } from "@/hooks/useRotinas";

type Rotinas = ReturnType<typeof useRotinas>;

const dayTone = (days: number) =>
  days <= 3 ? "text-red-400 border-red-400/40" : days <= 7 ? "text-amber-400 border-amber-400/40" : "text-muted-foreground border-border/60";

const progressTone = (p: { done: number; total: number }) =>
  p.total === 0 ? "text-muted-foreground" : p.done >= p.total ? "text-emerald-400" : "text-amber-400";

const AgendaChip = ({ icon: Icon, label, value, tone }: { icon: typeof Clock; label: string; value: number; tone: string }) => (
  <div className={cn("flex items-center gap-2 rounded-xl border px-3 py-2", tone)}>
    <Icon className="h-4 w-4" />
    <span className="text-lg font-bold tabular-nums">{value}</span>
    <span className="text-[11px] uppercase tracking-wide opacity-80">{label}</span>
  </div>
);

const NextDue = ({ view }: { view: RoutineClientView }) => {
  const nd = view.nextDue;
  if (!nd) return <span className="text-[11px] text-muted-foreground">—</span>;
  const quando = nd.days === 0 ? "hoje" : nd.days === 1 ? "amanhã" : `${nd.days}d`;
  return (
    <Badge variant="outline" className={cn("h-5 gap-1 text-[10px] font-normal", dayTone(nd.days))}>
      <CalendarClock className="h-3 w-3" />
      {nd.label} · {quando}
    </Badge>
  );
};

const ClientRow = ({ view, onSelect }: { view: RoutineClientView; onSelect: () => void }) => (
  <button
    onClick={onSelect}
    className="grid grid-cols-[minmax(120px,1.6fr)_repeat(4,minmax(56px,0.8fr))] items-center gap-2 rounded-lg border border-border/50 bg-card px-3 py-2 text-left transition-colors hover:border-primary/40"
  >
    <span className="truncate text-sm font-medium">{view.client.name}</span>
    <span className={cn("text-xs font-mono tabular-nums", progressTone(view.todayProgress))}>
      {view.todayProgress.total === 0 ? "—" : `${view.todayProgress.done}/${view.todayProgress.total}`}
    </span>
    <span className={cn("text-xs font-mono tabular-nums", progressTone(view.monthProgress))}>
      {view.monthProgress.total === 0 ? "—" : `${view.monthProgress.done}/${view.monthProgress.total}`}
    </span>
    <div className="min-w-0"><NextDue view={view} /></div>
    <span className="text-right">
      {view.overdueTasks.length > 0 ? (
        <Badge variant="outline" className="h-5 gap-1 text-[10px] text-red-400 border-red-400/40">
          <AlertTriangle className="h-3 w-3" />{view.overdueTasks.length}
        </Badge>
      ) : (
        <span className="text-[11px] text-emerald-400/70">ok</span>
      )}
    </span>
  </button>
);

export const RotinasConsolidatedView = ({ rotinas, onSelectClient }: { rotinas: Rotinas; onSelectClient: (id: string) => void }) => {
  const allViews = rotinas.clients.map((c) => rotinas.clientViews.get(c.id)).filter(Boolean) as RoutineClientView[];
  const agenda = allViews.reduce(
    (acc, v) => {
      acc.atrasado += v.overdueTasks.length;
      acc.hoje += Math.max(0, v.todayProgress.total - v.todayProgress.done);
      acc.semana += v.nextDue && v.nextDue.days >= 1 && v.nextDue.days <= 7 ? 1 : 0;
      acc.mes += Math.max(0, v.monthProgress.total - v.monthProgress.done);
      return acc;
    },
    { atrasado: 0, hoje: 0, semana: 0, mes: 0 },
  );

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <AgendaChip icon={AlertTriangle} label="Atrasado" value={agenda.atrasado} tone={agenda.atrasado > 0 ? "text-red-400 border-red-400/40 bg-red-400/5" : "text-muted-foreground border-border/60"} />
        <AgendaChip icon={CheckSquare} label="Hoje" value={agenda.hoje} tone={agenda.hoje > 0 ? "text-amber-400 border-amber-400/40 bg-amber-400/5" : "text-emerald-400 border-emerald-400/30"} />
        <AgendaChip icon={Clock} label="Esta semana" value={agenda.semana} tone="text-foreground border-border/60" />
        <AgendaChip icon={CalendarDays} label="Este mês" value={agenda.mes} tone="text-foreground border-border/60" />
      </div>

      {rotinas.segments.map((segment) => {
        const views = rotinas.clients
          .filter((c) => c.segment_id === segment.id)
          .map((c) => rotinas.clientViews.get(c.id))
          .filter(Boolean) as RoutineClientView[];
        return (
          <div key={segment.id} className="rounded-xl border border-border bg-muted/30 p-3">
            <div className="mb-2 flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: segment.color ?? "#6366f1" }} />
              <span className="text-sm font-semibold">{segment.name}</span>
              <Badge variant="secondary" className="h-5 text-[10px]">{views.length} cliente{views.length === 1 ? "" : "s"}</Badge>
            </div>
            {views.length === 0 ? (
              <p className="py-2 text-center text-xs text-muted-foreground">Nenhum cliente neste segmento.</p>
            ) : (
              <div className="space-y-1.5">
                <div className="grid grid-cols-[minmax(120px,1.6fr)_repeat(4,minmax(56px,0.8fr))] gap-2 px-3 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  <span>Empresa</span><span>Hoje</span><span>Mês</span><span>Próximo</span><span className="text-right">Atras.</span>
                </div>
                {views.map((view) => (
                  <ClientRow key={view.client.id} view={view} onSelect={() => onSelectClient(view.client.id)} />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default RotinasConsolidatedView;
