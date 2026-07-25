import { useMemo } from "react";
import { DragDropContext, Draggable, Droppable, type DropResult } from "@hello-pangea/dnd";
import { GripVertical, CalendarClock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { useCrm } from "./useCrm";

// Kanban de saúde/estágio DIRETO no spine (finance_clientes.stage) — substitui o ClientRelationshipKanban
// que vivia em companies.relationship_*. Mesmo vocabulário, um cadastro só. Cor pelo health CALCULADO.
const STAGES: { id: string; title: string; hint: string; color: string }[] = [
  { id: "new", title: "Novo", hint: "Conta recém-criada/fechada", color: "from-blue-500/15 border-blue-500/30" },
  { id: "onboarding", title: "Onboarding", hint: "Implantação e primeiros passos", color: "from-amber-500/15 border-amber-500/30" },
  { id: "active", title: "Ativo", hint: "Relacionamento em operação", color: "from-emerald-500/15 border-emerald-500/30" },
  { id: "expansion", title: "Expansão", hint: "Upsell/cross-sell/indicação", color: "from-purple-500/15 border-purple-500/30" },
  { id: "risk", title: "Risco", hint: "Atenção executiva", color: "from-red-500/15 border-red-500/30" },
  { id: "recovery", title: "Recuperação", hint: "Plano de retomada", color: "from-cyan-500/15 border-cyan-500/30" },
];
const DOT: Record<string, string> = { green: "bg-emerald-500", yellow: "bg-amber-500", red: "bg-red-500" };
const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const dateBR = (d?: string | null) => (d ? new Date(`${d.slice(0, 10)}T12:00:00`).toLocaleDateString("pt-BR") : null);

export const CustomerKanban = ({ crm, onSelect }: { crm: ReturnType<typeof useCrm>; onSelect: (id: string) => void }) => {
  const byStage = useMemo(() => {
    const map: Record<string, typeof crm.customers> = {};
    STAGES.forEach((s) => { map[s.id] = []; });
    for (const c of crm.customers) (map[c.stage || "active"] ?? map.active).push(c);
    return map;
  }, [crm.customers]);

  const onDragEnd = (r: DropResult) => {
    if (!r.destination || r.source.droppableId === r.destination.droppableId) return;
    crm.updateCustomer.mutate({ id: r.draggableId, patch: { stage: r.destination.droppableId } });
  };

  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <div className="flex gap-3 overflow-x-auto pb-4 min-h-[420px]">
        {STAGES.map((stage, idx) => (
          <Droppable droppableId={stage.id} key={stage.id}>
            {(provided, snapshot) => (
              <div
                ref={provided.innerRef}
                {...provided.droppableProps}
                className={cn("flex-shrink-0 w-[240px] rounded-xl border bg-card/50 transition-colors", snapshot.isDraggingOver && "border-primary/50 bg-primary/5")}
              >
                <div className={cn("p-3 rounded-t-xl bg-gradient-to-r to-transparent border-b", stage.color)}>
                  <div className="flex items-center justify-between gap-2">
                    <Badge variant="outline" className="text-[10px]">Etapa {idx + 1}</Badge>
                    <Badge variant="secondary" className="text-[10px]">{byStage[stage.id]?.length || 0}</Badge>
                  </div>
                  <h3 className="font-semibold text-sm mt-1">{stage.title}</h3>
                  <p className="text-[11px] text-muted-foreground mt-0.5">{stage.hint}</p>
                </div>
                <div className="p-2 space-y-2 min-h-[120px]">
                  {(byStage[stage.id] || []).map((c, index) => {
                    const rev = crm.revenueByCustomer.get(c.id);
                    const sc = crm.scores.get(c.id);
                    const health = sc?.health || c.health || "green";
                    const na = dateBR(c.next_action_date);
                    return (
                      <Draggable draggableId={c.id} index={index} key={c.id}>
                        {(dp, ds) => (
                          <Card
                            ref={dp.innerRef}
                            {...dp.draggableProps}
                            {...dp.dragHandleProps}
                            className={cn("cursor-grab active:cursor-grabbing transition-shadow", ds.isDragging && "shadow-lg shadow-primary/10 border-primary/40")}
                            onClick={() => onSelect(c.id)}
                          >
                            <CardContent className="p-2.5 space-y-1.5">
                              <div className="flex items-start gap-1.5">
                                <GripVertical className="h-3.5 w-3.5 text-muted-foreground/30 shrink-0 mt-0.5" />
                                <span className={cn("h-2 w-2 rounded-full shrink-0 mt-1", DOT[health])} />
                                <p className="font-semibold text-sm truncate flex-1">{c.nome}</p>
                              </div>
                              <div className="flex items-center justify-between text-[11px] text-muted-foreground pl-5">
                                <span className="font-mono">{brl(rev?.ongoing ?? 0)}/mês</span>
                                {sc && <span>saúde {sc.healthScore}</span>}
                              </div>
                              {na && <p className="text-[10px] text-muted-foreground pl-5 flex items-center gap-1"><CalendarClock className="h-3 w-3" />{na}</p>}
                            </CardContent>
                          </Card>
                        )}
                      </Draggable>
                    );
                  })}
                  {provided.placeholder}
                </div>
              </div>
            )}
          </Droppable>
        ))}
      </div>
    </DragDropContext>
  );
};

export default CustomerKanban;
