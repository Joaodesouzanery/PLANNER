import { useState } from "react";
import { GripVertical, Plus, Trash2 } from "lucide-react";
import { DragDropContext, Droppable, Draggable, type DropResult } from "@hello-pangea/dnd";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useConfirm } from "@/hooks/useConfirm";
import type { useRotinas } from "@/hooks/useRotinas";

type Rotinas = ReturnType<typeof useRotinas>;

export const RotinaConfigDialog = ({ rotinas, open, onClose }: { rotinas: Rotinas; open: boolean; onClose: () => void }) => {
  const confirm = useConfirm();
  const [segmentName, setSegmentName] = useState("");
  const [client, setClient] = useState({ name: "", segment_id: "", invoice_day: "" });

  const addSegment = () => {
    if (!segmentName.trim()) return;
    rotinas.saveSegment.mutate({ name: segmentName.trim(), sort_order: rotinas.segments.length }, { onSuccess: () => setSegmentName("") });
  };

  const addClient = () => {
    if (!client.name.trim() || !client.segment_id) return;
    rotinas.saveClient.mutate(
      {
        name: client.name.trim(),
        segment_id: client.segment_id,
        invoice_day: client.invoice_day === "" ? null : Number(client.invoice_day),
        sort_order: rotinas.clients.filter((c) => c.segment_id === client.segment_id).length,
      },
      { onSuccess: () => setClient({ name: "", segment_id: client.segment_id, invoice_day: "" }) },
    );
  };

  const onSegmentDragEnd = (r: DropResult) => {
    if (!r.destination || r.destination.index === r.source.index) return;
    const ids = rotinas.segments.map((s) => s.id);
    const [moved] = ids.splice(r.source.index, 1);
    ids.splice(r.destination.index, 0, moved);
    rotinas.reorderSegments.mutate(ids);
  };

  const onClientDragEnd = (segmentId: string) => (r: DropResult) => {
    if (!r.destination || r.destination.index === r.source.index) return;
    const ids = rotinas.clients.filter((c) => c.segment_id === segmentId).map((c) => c.id);
    const [moved] = ids.splice(r.source.index, 1);
    ids.splice(r.destination.index, 0, moved);
    rotinas.reorderClients.mutate(ids);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-[95vw] sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Gerenciar rotinas</DialogTitle>
          <p className="text-xs text-muted-foreground">Arraste pelo ícone <GripVertical className="inline h-3 w-3" /> para definir a ordem de importância. Edite os campos direto na lista.</p>
        </DialogHeader>

        <Tabs defaultValue="segments" className="mt-1">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="segments">Segmentos</TabsTrigger>
            <TabsTrigger value="clients">Empresas</TabsTrigger>
          </TabsList>

          {/* ---- SEGMENTOS ---- */}
          <TabsContent value="segments" className="space-y-3 pt-3">
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <Label className="text-xs">Novo segmento</Label>
                <Input value={segmentName} onChange={(e) => setSegmentName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addSegment()} placeholder="ex.: Construção" />
              </div>
              <Button variant="outline" onClick={addSegment} disabled={!segmentName.trim()} className="gap-1"><Plus className="h-4 w-4" /> Adicionar</Button>
            </div>

            <DragDropContext onDragEnd={onSegmentDragEnd}>
              <Droppable droppableId="segments">
                {(prov) => (
                  <div ref={prov.innerRef} {...prov.droppableProps} className="space-y-1.5">
                    {rotinas.segments.map((segment, idx) => {
                      const count = rotinas.clients.filter((c) => c.segment_id === segment.id).length;
                      return (
                        <Draggable key={segment.id} draggableId={segment.id} index={idx}>
                          {(p) => (
                            <div ref={p.innerRef} {...p.draggableProps} className="flex items-center gap-2 rounded-lg border border-border bg-card p-2 text-sm">
                              <button {...p.dragHandleProps} className="text-muted-foreground cursor-grab active:cursor-grabbing"><GripVertical className="h-4 w-4" /></button>
                              <input type="color" defaultValue={segment.color ?? "#6366f1"} onChange={(e) => rotinas.saveSegment.mutate({ id: segment.id, color: e.target.value })} className="h-6 w-6 cursor-pointer rounded border-0 bg-transparent p-0" title="Cor" />
                              <Input key={`${segment.id}-${segment.name}`} defaultValue={segment.name} onBlur={(e) => { const v = e.target.value.trim(); if (v && v !== segment.name) rotinas.saveSegment.mutate({ id: segment.id, name: v }); }} className="h-8 flex-1" />
                              <Badge variant="secondary" className="h-5 text-[10px]">{count} empresa{count === 1 ? "" : "s"}</Badge>
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" title="Excluir segmento (e suas empresas)" onClick={async () => { if (await confirm({ title: `Excluir "${segment.name}"?`, description: "Remove o segmento e TODAS as empresas, rotinas e tarefas dele. Não dá para desfazer.", destructive: true, confirmText: "Excluir" })) rotinas.deleteSegment.mutate(segment.id); }}><Trash2 className="h-3.5 w-3.5" /></Button>
                            </div>
                          )}
                        </Draggable>
                      );
                    })}
                    {prov.placeholder}
                    {rotinas.segments.length === 0 && <p className="py-3 text-center text-xs text-muted-foreground">Nenhum segmento ainda.</p>}
                  </div>
                )}
              </Droppable>
            </DragDropContext>
          </TabsContent>

          {/* ---- EMPRESAS ---- */}
          <TabsContent value="clients" className="space-y-4 pt-3">
            <div className="flex flex-wrap items-end gap-2 rounded-lg border border-border/60 p-2">
              <div className="flex-1 min-w-[140px]">
                <Label className="text-xs">Nome</Label>
                <Input value={client.name} onChange={(e) => setClient({ ...client, name: e.target.value })} placeholder="ex.: Compizzo" />
              </div>
              <div>
                <Label className="text-xs">Segmento</Label>
                <Select value={client.segment_id} onValueChange={(v) => setClient({ ...client, segment_id: v })}>
                  <SelectTrigger className="w-[150px]"><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>{rotinas.segments.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Dia NF</Label>
                <Input type="number" min={1} max={31} className="w-[80px]" value={client.invoice_day} onChange={(e) => setClient({ ...client, invoice_day: e.target.value })} placeholder="1" />
              </div>
              <Button variant="outline" onClick={addClient} disabled={!client.name.trim() || !client.segment_id} className="gap-1"><Plus className="h-4 w-4" /> Adicionar</Button>
            </div>

            {rotinas.segments.map((segment) => {
              const segClients = rotinas.clients.filter((c) => c.segment_id === segment.id);
              return (
                <div key={segment.id} className="space-y-1.5">
                  <p className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: segment.color ?? "#6366f1" }} />{segment.name}
                  </p>
                  <DragDropContext onDragEnd={onClientDragEnd(segment.id)}>
                    <Droppable droppableId={`clients-${segment.id}`}>
                      {(prov) => (
                        <div ref={prov.innerRef} {...prov.droppableProps} className="space-y-1.5">
                          {segClients.map((c, idx) => (
                            <Draggable key={c.id} draggableId={c.id} index={idx}>
                              {(p) => (
                                <div ref={p.innerRef} {...p.draggableProps} className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card p-2 text-sm">
                                  <button {...p.dragHandleProps} className="text-muted-foreground cursor-grab active:cursor-grabbing"><GripVertical className="h-4 w-4" /></button>
                                  <Input key={`${c.id}-${c.name}`} defaultValue={c.name} onBlur={(e) => { const v = e.target.value.trim(); if (v && v !== c.name) rotinas.saveClient.mutate({ id: c.id, name: v }); }} className="h-8 min-w-[120px] flex-1" />
                                  <Select value={c.segment_id ?? ""} onValueChange={(v) => rotinas.saveClient.mutate({ id: c.id, segment_id: v })}>
                                    <SelectTrigger className="h-8 w-[130px] text-xs"><SelectValue /></SelectTrigger>
                                    <SelectContent>{rotinas.segments.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                                  </Select>
                                  <div className="flex items-center gap-1">
                                    <span className="text-[10px] text-muted-foreground">NF</span>
                                    <Input key={`${c.id}-${c.invoice_day}`} type="number" min={1} max={31} defaultValue={c.invoice_day ?? ""} onBlur={(e) => { const raw = e.target.value; const v = raw === "" ? null : Number(raw); if (v !== c.invoice_day) rotinas.saveClient.mutate({ id: c.id, invoice_day: v }); }} className="h-8 w-[64px]" placeholder="—" />
                                  </div>
                                  <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" title="Excluir empresa" onClick={async () => { if (await confirm({ title: `Excluir "${c.name}"?`, description: "Remove a empresa e todas as suas rotinas e tarefas.", destructive: true, confirmText: "Excluir" })) rotinas.deleteClient.mutate(c.id); }}><Trash2 className="h-3.5 w-3.5" /></Button>
                                </div>
                              )}
                            </Draggable>
                          ))}
                          {prov.placeholder}
                          {segClients.length === 0 && <p className="px-1 py-1 text-[11px] text-muted-foreground">Nenhuma empresa neste segmento.</p>}
                        </div>
                      )}
                    </Droppable>
                  </DragDropContext>
                </div>
              );
            })}
            {rotinas.segments.length === 0 && <p className="py-3 text-center text-xs text-muted-foreground">Crie um segmento antes de adicionar empresas.</p>}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};
