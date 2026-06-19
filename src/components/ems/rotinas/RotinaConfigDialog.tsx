import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { useRotinas } from "@/hooks/useRotinas";

type Rotinas = ReturnType<typeof useRotinas>;

export const RotinaConfigDialog = ({ rotinas, open, onClose }: { rotinas: Rotinas; open: boolean; onClose: () => void }) => {
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

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-[95vw] sm:max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Configurar rotinas</DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          {/* Segmentos */}
          <div className="space-y-2">
            <p className="text-sm font-semibold">Segmentos</p>
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <Label className="text-xs">Novo segmento</Label>
                <Input value={segmentName} onChange={(e) => setSegmentName(e.target.value)} placeholder="ex.: Construção" />
              </div>
              <Button variant="outline" onClick={addSegment} disabled={!segmentName.trim()} className="gap-1"><Plus className="h-4 w-4" /> Adicionar</Button>
            </div>
            <div className="space-y-1.5">
              {rotinas.segments.map((segment) => (
                <div key={segment.id} className="flex items-center gap-2 rounded-lg border border-border/50 p-2 text-sm">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: segment.color ?? "#6366f1" }} />
                  <span className="flex-1">{segment.name}</span>
                  <Badge variant="secondary" className="h-5 text-[10px]">{rotinas.clients.filter((c) => c.segment_id === segment.id).length} clientes</Badge>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => rotinas.deleteSegment.mutate(segment.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          </div>

          {/* Clientes */}
          <div className="space-y-2 border-t border-border/50 pt-4">
            <p className="text-sm font-semibold">Clientes</p>
            <div className="flex flex-wrap items-end gap-2">
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
                <Input type="number" min={1} max={31} className="w-[90px]" value={client.invoice_day} onChange={(e) => setClient({ ...client, invoice_day: e.target.value })} placeholder="1" />
              </div>
              <Button variant="outline" onClick={addClient} disabled={!client.name.trim() || !client.segment_id} className="gap-1"><Plus className="h-4 w-4" /> Adicionar</Button>
            </div>
            <div className="space-y-1.5">
              {rotinas.clients.map((c) => (
                <div key={c.id} className="flex items-center gap-2 rounded-lg border border-border/50 p-2 text-sm">
                  <span className="flex-1">{c.name}</span>
                  <span className="text-[11px] text-muted-foreground">{rotinas.segments.find((s) => s.id === c.segment_id)?.name}</span>
                  {c.invoice_day && <Badge variant="outline" className="h-5 text-[10px]">NF dia {c.invoice_day}</Badge>}
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => rotinas.deleteClient.mutate(c.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
