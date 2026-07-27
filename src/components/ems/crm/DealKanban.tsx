import { useMemo } from "react";
import { DragDropContext, Draggable, Droppable, type DropResult } from "@hello-pangea/dnd";
import { GripVertical } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { useCrm } from "./useCrm";
import { useCrmStages } from "./useCrmStages";
import { resolveStageKey } from "./crmStages";

// Kanban de DEALS: arrasta project_opportunities por etapa (o drag-and-drop moderno, ancorado no dinheiro).
// As colunas vêm de crm_stages (DB-backed, customizável) via useCrmStages — sem etapas hardcoded.
// Soltar numa etapa com outcome grava status_outcome (won/lost); nas abertas, limpa o outcome.
const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

export const DealKanban = ({ crm, onSelect }: { crm: ReturnType<typeof useCrm>; onSelect: (id: string) => void }) => {
  const { stages } = useCrmStages();
  const nameById = useMemo(() => new Map(crm.customers.map((c) => [c.id, c.nome])), [crm.customers]);

  const byStage = useMemo(() => {
    const map: Record<string, any[]> = {};
    stages.forEach((s) => { map[s.key] = []; });
    const fallback = stages[0]?.key;
    for (const d of crm.deals as any[]) {
      const key = resolveStageKey(d.stage, stages);
      (map[key] ?? map[fallback]).push(d);
    }
    return map;
  }, [crm.deals, stages]);

  const onDragEnd = (r: DropResult) => {
    if (!r.destination || r.source.droppableId === r.destination.droppableId) return;
    const dest = r.destination.droppableId;
    const outcome = stages.find((s) => s.key === dest)?.outcome ?? null;
    crm.updateDeal.mutate({ id: r.draggableId, patch: { stage: dest, status_outcome: outcome } });
  };

  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <div className="flex gap-3 overflow-x-auto pb-4 min-h-[420px]">
        {stages.map((stage) => {
          const deals = byStage[stage.key] || [];
          const total = deals.reduce((a, d) => a + (Number(d.value) || 0), 0);
          return (
            <Droppable droppableId={stage.key} key={stage.key}>
              {(provided, snapshot) => (
                <div
                  ref={provided.innerRef}
                  {...provided.droppableProps}
                  className={cn("flex-shrink-0 w-[240px] rounded-xl border bg-card/50 transition-colors", snapshot.isDraggingOver && "border-primary/50 bg-primary/5")}
                >
                  <div className={cn("p-3 rounded-t-xl bg-gradient-to-r to-transparent border-b", stage.color)}>
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="font-semibold text-sm">{stage.title}</h3>
                      <Badge variant="secondary" className="text-[10px]">{deals.length}</Badge>
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-0.5 font-mono">{brl(total)}</p>
                  </div>
                  <div className="p-2 space-y-2 min-h-[120px]">
                    {deals.map((d, index) => (
                      <Draggable draggableId={d.id} index={index} key={d.id}>
                        {(dp, ds) => (
                          <Card
                            ref={dp.innerRef}
                            {...dp.draggableProps}
                            {...dp.dragHandleProps}
                            className={cn("cursor-grab active:cursor-grabbing transition-shadow", ds.isDragging && "shadow-lg shadow-primary/10 border-primary/40")}
                            onClick={() => d.customer_id && onSelect(d.customer_id)}
                          >
                            <CardContent className="p-2.5 space-y-1">
                              <div className="flex items-start gap-1.5">
                                <GripVertical className="h-3.5 w-3.5 text-muted-foreground/30 shrink-0 mt-0.5" />
                                <p className="font-semibold text-sm truncate flex-1">{d.title}</p>
                              </div>
                              <p className="text-[11px] text-muted-foreground pl-5 truncate">{(d.customer_id && nameById.get(d.customer_id)) || "Sem cliente"}</p>
                              <div className="flex items-center justify-between text-[11px] pl-5">
                                <span className="font-mono">{brl(Number(d.value) || 0)}</span>
                                {d.probability != null && <span className="text-muted-foreground">{d.probability}%</span>}
                              </div>
                            </CardContent>
                          </Card>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                    {deals.length === 0 && <p className="text-[11px] text-muted-foreground/60 text-center py-4">—</p>}
                  </div>
                </div>
              )}
            </Droppable>
          );
        })}
      </div>
    </DragDropContext>
  );
};

export default DealKanban;
