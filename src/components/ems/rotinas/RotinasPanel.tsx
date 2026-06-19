import { useState } from "react";
import { AlertTriangle, CalendarClock, CheckSquare, ClipboardList, ListChecks, Plus, Settings2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { cn } from "@/lib/utils";
import { useRotinas, type RoutineClientView } from "@/hooks/useRotinas";
import { RotinaClientDialog } from "./RotinaClientDialog";
import { RotinaConfigDialog } from "./RotinaConfigDialog";

const InvoiceBadge = ({ view }: { view: RoutineClientView }) => {
  if (!view.client.invoice_day || view.daysUntilInvoice === null) return null;
  const days = view.daysUntilInvoice;
  const tone = days <= 3 ? "text-red-400 border-red-400/40" : days <= 7 ? "text-amber-400 border-amber-400/40" : "text-muted-foreground";
  const quando = days === 0 ? "hoje" : days === 1 ? "amanhã" : `${days} dias`;
  return (
    <Badge variant="outline" className={cn("h-5 gap-1 text-[10px]", tone)}>
      <CalendarClock className="h-3 w-3" />
      NF dia {view.client.invoice_day} · {quando}
    </Badge>
  );
};

export const RotinasPanel = () => {
  const rotinas = useRotinas();
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [configOpen, setConfigOpen] = useState(false);

  const isMissingTable = (rotinas.error as any)?.code === "42P01";

  if (isMissingTable) {
    return (
      <Card className="border-amber-500/30 bg-amber-500/5">
        <CardContent className="p-8 text-center">
          <AlertTriangle className="mx-auto mb-3 h-10 w-10 text-amber-500" />
          <h3 className="font-semibold">Módulo de Rotinas ainda não aplicado</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Aplique a migration <code>20260619120000_routines_module.sql</code> no Supabase.
          </p>
        </CardContent>
      </Card>
    );
  }

  const selectedView = selectedClientId ? rotinas.clientViews.get(selectedClientId) ?? null : null;

  return (
    <Card className="relative z-0 overflow-hidden">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <span className="h-1.5 w-1.5 rounded-full bg-primary" />
            Rotinas
            <span className="text-xs font-normal text-muted-foreground">
              {rotinas.clients.length} cliente{rotinas.clients.length === 1 ? "" : "s"}
            </span>
          </CardTitle>
          <Button variant="outline" size="sm" className="h-8 gap-2" onClick={() => setConfigOpen(true)}>
            <Settings2 className="h-3.5 w-3.5" /> Configurar
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {rotinas.isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-24 w-full rounded-xl" />
            <Skeleton className="h-24 w-full rounded-xl" />
          </div>
        ) : rotinas.segments.length === 0 ? (
          <div className="flex flex-col items-center gap-4 py-10 text-center">
            <ClipboardList className="h-10 w-10 text-muted-foreground/60" />
            <div>
              <p className="font-semibold">Nenhuma rotina configurada</p>
              <p className="text-sm text-muted-foreground">Crie a estrutura inicial (Construção, Regulação, CONAB, Nery Agro) ou configure manualmente.</p>
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              <Button onClick={() => rotinas.seedInitialStructure.mutate()} disabled={rotinas.seedInitialStructure.isPending} className="gap-2">
                <Plus className="h-4 w-4" /> Criar estrutura inicial
              </Button>
              <Button variant="outline" onClick={() => setConfigOpen(true)} className="gap-2">
                <Settings2 className="h-4 w-4" /> Configurar manualmente
              </Button>
            </div>
          </div>
        ) : (
          <Accordion type="multiple" defaultValue={rotinas.segments.map((s) => s.id)} className="space-y-2">
            {rotinas.segments.map((segment) => {
              const clients = rotinas.clients.filter((c) => c.segment_id === segment.id);
              return (
                <AccordionItem key={segment.id} value={segment.id} className="rounded-xl border border-border/50 bg-muted/10 px-3">
                  <AccordionTrigger className="py-3 hover:no-underline">
                    <span className="flex items-center gap-2 text-sm font-semibold">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: segment.color ?? "#6366f1" }} />
                      {segment.name}
                      <Badge variant="secondary" className="h-5 text-[10px]">{clients.length}</Badge>
                    </span>
                  </AccordionTrigger>
                  <AccordionContent className="pb-3">
                    {clients.length === 0 ? (
                      <p className="py-3 text-center text-xs text-muted-foreground">Nenhum cliente neste segmento.</p>
                    ) : (
                      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                        {clients.map((client) => {
                          const view = rotinas.clientViews.get(client.id);
                          if (!view) return null;
                          return (
                            <button
                              key={client.id}
                              onClick={() => setSelectedClientId(client.id)}
                              className="rounded-xl border border-border/50 bg-card/70 p-3 text-left transition-colors hover:border-primary/40"
                            >
                              <div className="flex items-start justify-between gap-2">
                                <p className="truncate text-sm font-semibold">{client.name}</p>
                                <InvoiceBadge view={view} />
                              </div>
                              <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[10px] text-muted-foreground">
                                <span className="flex items-center gap-1">
                                  <ListChecks className="h-3 w-3" />
                                  Conf. {view.conferenciaProgress.done}/{view.conferenciaProgress.total}
                                </span>
                                <span className="flex items-center gap-1">
                                  <CheckSquare className="h-3 w-3" />
                                  Tarefas {view.tarefaProgress.done}/{view.tarefaProgress.total}
                                </span>
                                {view.openTasks.length > 0 && (
                                  <Badge variant="outline" className="h-4 text-[9px] text-amber-400 border-amber-400/40">
                                    {view.openTasks.length} pendência{view.openTasks.length === 1 ? "" : "s"}
                                  </Badge>
                                )}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </AccordionContent>
                </AccordionItem>
              );
            })}
          </Accordion>
        )}
      </CardContent>

      {selectedView && (
        <RotinaClientDialog
          view={selectedView}
          rotinas={rotinas}
          open={!!selectedClientId}
          onClose={() => setSelectedClientId(null)}
        />
      )}
      <RotinaConfigDialog rotinas={rotinas} open={configOpen} onClose={() => setConfigOpen(false)} />
    </Card>
  );
};

export default RotinasPanel;
