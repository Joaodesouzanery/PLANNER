import { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { motion } from "framer-motion";
import { Building2, Mail, Phone, Users, GripVertical } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { useCommercialData } from "./useCommercialData";
import { phaseColors, phaseIconColors } from "./types";
import type { Contact } from "./types";
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";
import PipelineFilters, { type PipelineFilterState } from "./PipelineFilters";

const PipelineKanban = ({ onSelectContact }: { onSelectContact: (c: Contact) => void }) => {
  const { phases, contacts, allTracking, leafItems, getContactProgress, invalidateAll, queryClient } = useCommercialData();
  const [filters, setFilters] = useState<PipelineFilterState>({ search: "", company: "", progressMin: 0, progressMax: 100, createdAfter: "", createdBefore: "" });

  const companies = useMemo(() => {
    const set = new Set<string>();
    contacts.forEach(c => { if (c.company) set.add(c.company); });
    return Array.from(set).sort();
  }, [contacts]);

  const getContactPhaseId = (contact: Contact): string => {
    if (contact.pipeline_stage && phases.some(p => p.id === contact.pipeline_stage)) {
      return contact.pipeline_stage;
    }
    const progress = getContactProgress(contact.id);
    if (phases.length === 0) return "";
    const phaseIdx = Math.min(Math.floor((progress / 100) * phases.length), phases.length - 1);
    return phases[phaseIdx]?.id || "";
  };

  const filteredContacts = useMemo(() => {
    return contacts.filter(c => {
      if (filters.search && !c.name.toLowerCase().includes(filters.search.toLowerCase()) && !c.company?.toLowerCase().includes(filters.search.toLowerCase())) return false;
      if (filters.company && c.company !== filters.company) return false;
      const progress = getContactProgress(c.id);
      if (progress < filters.progressMin || progress > filters.progressMax) return false;
      if (filters.createdAfter && c.created_at && c.created_at < filters.createdAfter) return false;
      if (filters.createdBefore && c.created_at && c.created_at > filters.createdBefore + "T23:59:59") return false;
      return true;
    });
  }, [contacts, filters, allTracking, leafItems]);

  const contactsByPhase = useMemo(() => {
    const map: Record<string, Contact[]> = {};
    phases.forEach(p => { map[p.id] = []; });
    filteredContacts.forEach(c => {
      const phaseId = getContactPhaseId(c);
      if (phaseId && map[phaseId]) {
        map[phaseId].push(c);
      } else if (phases.length > 0) {
        map[phases[0].id].push(c);
      }
    });
    return map;
  }, [filteredContacts, phases, allTracking, leafItems]);

  const moveContactMutation = useMutation({
    mutationFn: async ({ contactId, newPhaseId }: { contactId: string; newPhaseId: string }) => {
      const { error } = await supabase.from("contacts").update({ pipeline_stage: newPhaseId }).eq("id", contactId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
      invalidateAll();
    },
    onError: (e: any) => toast({ title: "Erro ao mover contato", description: e?.message, variant: "destructive" }),
  });

  const onDragEnd = (result: DropResult) => {
    if (!result.destination) return;
    const contactId = result.draggableId;
    const newPhaseId = result.destination.droppableId;
    if (result.source.droppableId === newPhaseId) return;
    moveContactMutation.mutate({ contactId, newPhaseId });
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
      <div>
        <h2 className="text-lg font-heading font-bold text-foreground flex items-center gap-2">
          <Users className="h-5 w-5 text-primary" /> Pipeline Visual
        </h2>
        <p className="text-sm text-muted-foreground">Arraste contatos entre as fases do funil</p>
      </div>

      <PipelineFilters companies={companies} onFiltersChange={setFilters} />

      <DragDropContext onDragEnd={onDragEnd}>
        <div className="flex gap-3 overflow-x-auto pb-4 min-h-[400px]">
          {phases.map((phase, idx) => (
            <Droppable droppableId={phase.id} key={phase.id}>
              {(provided, snapshot) => (
                <div
                  ref={provided.innerRef}
                  {...provided.droppableProps}
                  className={cn(
                    "flex-shrink-0 w-[220px] sm:w-[240px] rounded-xl border bg-card/50 transition-colors",
                    snapshot.isDraggingOver && "border-primary/50 bg-primary/5"
                  )}
                >
                  <div className={cn("p-2.5 rounded-t-xl bg-gradient-to-r border-b", phaseColors[idx % phaseColors.length])}>
                    <div className="flex items-center justify-between">
                      <Badge variant="outline" className={cn("text-[10px]", phaseIconColors[idx % phaseIconColors.length])}>
                        Fase {idx + 1}
                      </Badge>
                      <Badge variant="secondary" className="text-[10px]">
                        {(contactsByPhase[phase.id] || []).length}
                      </Badge>
                    </div>
                    <h3 className="font-semibold text-sm mt-1 truncate">{phase.title}</h3>
                  </div>

                  <div className="p-2 space-y-2 min-h-[100px]">
                    {(contactsByPhase[phase.id] || []).map((contact, cIdx) => {
                      const progress = getContactProgress(contact.id);
                      return (
                        <Draggable draggableId={contact.id} index={cIdx} key={contact.id}>
                          {(dragProvided, dragSnapshot) => (
                            <div
                              ref={dragProvided.innerRef}
                              {...dragProvided.draggableProps}
                              {...dragProvided.dragHandleProps}
                              className={cn(
                                  "rounded-lg border bg-card p-2.5 cursor-grab active:cursor-grabbing transition-shadow",
                                dragSnapshot.isDragging && "shadow-lg shadow-primary/10 border-primary/40"
                              )}
                              onClick={() => onSelectContact(contact)}
                            >
                              <div className="flex items-start gap-2">
                                <GripVertical className="h-4 w-4 text-muted-foreground/30 shrink-0 mt-0.5" />
                                <div className="flex-1 min-w-0">
                                  <p className="font-medium text-sm truncate">{contact.name}</p>
                                  {contact.company && (
                                    <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5 truncate">
                                      <Building2 className="h-3 w-3 shrink-0" />{contact.company}
                                    </p>
                                  )}
                                  <div className="flex gap-2 mt-1.5 text-[10px] text-muted-foreground">
                                    {contact.email && <span className="flex items-center gap-0.5 truncate"><Mail className="h-2.5 w-2.5" /></span>}
                                    {contact.phone && <span className="flex items-center gap-0.5"><Phone className="h-2.5 w-2.5" /></span>}
                                  </div>
                                  <div className="flex items-center gap-2 mt-2">
                                    <Progress value={progress} className="h-1.5 flex-1" />
                                    <span className="text-[10px] font-bold text-muted-foreground">{progress}%</span>
                                  </div>
                                </div>
                              </div>
                            </div>
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
    </motion.div>
  );
};

export default PipelineKanban;
