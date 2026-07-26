import { useMemo } from "react";
import { DragDropContext, Draggable, Droppable, type DropResult } from "@hello-pangea/dnd";
import { GripVertical } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { useCrm } from "./useCrm";

// Kanban de DEALS: arrasta project_opportunities por estágio (o drag-and-drop moderno, ancorado no dinheiro).
// Soltar em ganha/perdida também grava status_outcome (won/lost); nas abertas, limpa o outcome.
const STAGES: { id: string; title: string; outcome: string | null; color: string }[] = [
  { id: "nova", title: "Nova", outcome: null, color: "from-blue-500/15 border-blue-500/30" },
  { id: "qualificacao", title: "Qualificação", outcome: null, color: "from-cyan-500/15 border-cyan-500/30" },
  { id: "proposta", title: "Proposta", outcome: null, color: "from-amber-500/15 border-amber-500/30" },
  { id: "negociacao", title: "Negociação", outcome: null, color: "from-purple-500/15 border-purple-500/30" },
  { id: "ganha", title: "Ganha", outcome: "won", color: "from-emerald-500/15 border-emerald-500/30" },
  { id: "perdida", title: "Perdida", outcome: "lost", color: "from-red-500/15 border-red-500/30" },
];
const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
// Normaliza o vocabulário legado (ganho/perdido) pras colunas ganha/perdida.
const norm = (s?: string | null) => { const x = (s || "nova").toLowerCase(); return x === "ganho" ? "ganha" : x === "perdido" ? "perdida" : x; };

export const DealKanban = ({ crm, onSelect }: { crm: ReturnType<typeof useCrm>; onSelect: (id: string) => void }) => {
  const nameById = useMemo(() => new Map(crm.customers.map((c) => [c.id, c.nome])), [crm.customers]);

  const byStage = useMemo(() => {
    const map: Record<string, any[]> = {};
    STAGES.forEach((s) => { map[s.id] = []; });
    for (const d of crm.deals as any[]) (map[norm(d.stage)] ?? map.nova).push(d);
    return map;
  }, [crm.deals]);

  const onDragEnd = (r: DropResult) => {
    if (!r.destination || r.source.droppableId === r.destination.droppableId) return;
    const dest = r.destination.droppableId;
    const outcome = STAGES.find((s) => s.id === dest)?.outcome ?? null;
    crm.updateDeal.mutate({ id: r.draggableId, patch: { stage: dest, status_outcome: outcome } });
  };

  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <div className="flex gap-3 overflow-x-auto pb-4 min-h-[420px]">
        {STAGES.map((stage) => {
          const deals = byStage[stage.id] || [];
          const total = deals.reduce((a, d) => a + (Number(d.value) || 0), 0);
          return (
            <Droppable droppableId={stage.id} key={stage.id}>
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
