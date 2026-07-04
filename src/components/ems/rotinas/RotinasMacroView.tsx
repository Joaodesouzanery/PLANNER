import { AlertTriangle, CalendarDays, CheckSquare, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { RotinaClientCard } from "./RotinaClientCard";
import type { useRotinas, RoutineClientView } from "@/hooks/useRotinas";

type Rotinas = ReturnType<typeof useRotinas>;

const AgendaChip = ({ icon: Icon, label, value, tone }: { icon: typeof Clock; label: string; value: number; tone: string }) => (
  <div className={cn("flex items-center gap-2 rounded-xl border px-3 py-2", tone)}>
    <Icon className="h-4 w-4" />
    <span className="text-lg font-bold tabular-nums">{value}</span>
    <span className="text-[11px] uppercase tracking-wide opacity-80">{label}</span>
  </div>
);

export const RotinasMacroView = ({ rotinas, onSelectClient }: { rotinas: Rotinas; onSelectClient: (id: string) => void }) => {
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
      {/* Faixa de agenda (consolidado) — somando todas as empresas */}
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
        const totalOpen = views.reduce((s, v) => s + v.openTasks.length, 0);
        return (
          <div key={segment.id} className="rounded-xl border border-border bg-muted/30 p-3">
            <div className="mb-3 flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: segment.color ?? "#6366f1" }} />
              <span className="text-sm font-semibold">{segment.name}</span>
              <Badge variant="secondary" className="h-5 text-[10px]">{views.length} cliente{views.length === 1 ? "" : "s"}</Badge>
              {totalOpen > 0 && <Badge variant="outline" className="h-5 text-[10px] text-amber-400 border-amber-400/40">{totalOpen} pendência{totalOpen === 1 ? "" : "s"}</Badge>}
            </div>
            {views.length === 0 ? (
              <p className="py-2 text-center text-xs text-muted-foreground">Nenhum cliente neste segmento.</p>
            ) : (
              <div className="grid gap-2 md:grid-cols-2">
                {views.map((view) => (
                  <RotinaClientCard key={view.client.id} view={view} rotinas={rotinas} onOpenReport={() => onSelectClient(view.client.id)} />
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
