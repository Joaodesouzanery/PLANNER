import type { ReactNode } from "react";
import { CalendarClock, FolderKanban, ListTodo } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { LocationMap, type MapPin, type MapPinKind } from "@/components/ems/LocationMap";
import { useMapPins, useMapTaskGroups } from "@/hooks/useMapPins";
import { cn } from "@/lib/utils";

interface OperationalMapPanelProps {
  title?: string;
  description?: string;
  height?: number | string;
  filterKinds?: MapPinKind[];
  sidebar?: boolean;
  projectId?: string;
  pinsOverride?: MapPin[];
  headerActions?: ReactNode;
  sidebarTitle?: string;
  maxSidebarHeight?: string;
}

const kindLabel: Record<MapPinKind, string> = {
  project: "projetos",
  client: "clientes",
  task: "tarefas",
  faculdade: "faculdade",
  default: "pontos",
};

const dateLabel = (date?: string | null) => {
  if (!date) return "Sem data";
  const [year, month, day] = date.slice(0, 10).split("-");
  return `${day}/${month}/${year}`;
};

export const OperationalMapPanel = ({
  title = "Mapa operacional",
  description,
  height = 380,
  filterKinds,
  sidebar = true,
  projectId,
  pinsOverride,
  headerActions,
  sidebarTitle = "Tarefas por projeto",
  maxSidebarHeight = "380px",
}: OperationalMapPanelProps) => {
  const { data: basePins = [], isLoading } = useMapPins(projectId);
  const { data: taskGroups = [] } = useMapTaskGroups(projectId);
  const pins = pinsOverride ?? basePins;
  const visiblePins = filterKinds?.length ? pins.filter((pin) => filterKinds.includes(pin.kind || "default")) : pins;
  const alertCount = visiblePins.filter((pin) => pin.alert).length;
  const kindCounts = visiblePins.reduce<Record<string, number>>((acc, pin) => {
    const kind = pin.kind || "default";
    acc[kind] = (acc[kind] || 0) + 1;
    return acc;
  }, {});

  return (
    <Card className="relative z-0 overflow-hidden">
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 space-y-2">
            <CardTitle className="flex items-center justify-between gap-2 text-base lg:justify-start">
              <span className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                {title}
              </span>
              <span className="text-xs font-normal text-muted-foreground">
                {visiblePins.length} ponto{visiblePins.length === 1 ? "" : "s"}
                {alertCount > 0 && <span className="ml-2 text-red-400">- {alertCount} com alerta</span>}
              </span>
            </CardTitle>
            {description && <p className="text-xs text-muted-foreground">{description}</p>}
            <div className="flex flex-wrap gap-1.5">
              {(Object.entries(kindCounts) as Array<[MapPinKind, number]>).map(([kind, count]) => (
                <Badge key={kind} variant="outline" className="h-5 text-[10px]">
                  {count} {kindLabel[kind] || "pontos"}
                </Badge>
              ))}
            </div>
          </div>
          {headerActions && <div className="flex shrink-0 flex-wrap items-center gap-2">{headerActions}</div>}
        </div>
      </CardHeader>
      <CardContent>
        <div className={cn("grid gap-3", sidebar && "xl:grid-cols-[minmax(0,1fr)_320px]")}>
          {isLoading ? <Skeleton className="w-full rounded-xl" style={{ height }} /> : <LocationMap pins={visiblePins} height={height} />}
          {sidebar && (
            <div className="rounded-xl border border-border/50 bg-muted/20">
              <div className="flex items-center justify-between border-b border-border/50 p-3">
                <div className="flex items-center gap-2">
                  <ListTodo className="h-4 w-4 text-primary" />
                  <p className="text-sm font-semibold">{sidebarTitle}</p>
                </div>
                <Badge variant="secondary" className="h-5 text-[10px]">
                  {taskGroups.reduce((sum, group) => sum + group.tasks.length, 0)}
                </Badge>
              </div>
              <div className="space-y-3 overflow-y-auto p-3" style={{ maxHeight: maxSidebarHeight }}>
                {taskGroups.length === 0 ? (
                  <p className="py-8 text-center text-xs text-muted-foreground">Nenhuma tarefa aberta.</p>
                ) : (
                  taskGroups.map((group) => (
                    <div key={group.projectId} className="space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <p className="flex min-w-0 items-center gap-1.5 text-xs font-semibold">
                          <FolderKanban className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                          <span className="truncate">{group.projectTitle}</span>
                        </p>
                        <Badge variant="outline" className="h-5 text-[10px]">{group.tasks.length}</Badge>
                      </div>
                      <div className="space-y-1.5">
                        {group.tasks.slice(0, 5).map((task) => (
                          <div key={task.id} className="rounded-lg border border-border/50 bg-card/70 p-2">
                            <p className="truncate text-xs font-medium">{task.title}</p>
                            <div className="mt-1 flex items-center justify-between gap-2 text-[10px] text-muted-foreground">
                              <span className="truncate">{task.contact_name || task.priority || "Tarefa"}</span>
                              <span className="flex shrink-0 items-center gap-1">
                                <CalendarClock className="h-3 w-3" />
                                {dateLabel(task.due_date)}
                              </span>
                            </div>
                          </div>
                        ))}
                        {group.tasks.length > 5 && (
                          <p className="text-center text-[10px] text-muted-foreground">+{group.tasks.length - 5} tarefas</p>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
