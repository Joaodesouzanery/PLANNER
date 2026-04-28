import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Pencil, Trash2, GripVertical, ChevronDown, ChevronRight, Settings2 } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { useCommercialData } from "./useCommercialData";
import { phaseColors, phaseIconColors } from "./types";
import type { Phase, Item } from "./types";
import { useCompany } from "@/contexts/CompanyContext";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const iconOptions = [
  { value: "search", label: "Pesquisa" },
  { value: "palette", label: "Paleta" },
  { value: "handshake", label: "Negociação" },
  { value: "rocket", label: "Foguete" },
  { value: "file-text", label: "Documento" },
  { value: "globe", label: "Global" },
  { value: "bar-chart", label: "Gráfico" },
];

const PhaseItemManager = () => {
  const { phases, items, getPhaseItems, getChildItems, invalidateAll, queryClient } = useCommercialData();
  const { selectedCompanyId } = useCompany();
  const scopedCompanyId = selectedCompanyId !== "all" ? selectedCompanyId : null;

  const [phaseDialog, setPhaseDialog] = useState<{ open: boolean; phase?: Phase }>({ open: false });
  const [itemDialog, setItemDialog] = useState<{ open: boolean; phaseId: string; parentItemId?: string; item?: Item }>({ open: false, phaseId: "" });
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; type: "phase" | "item"; id: string; title: string }>({ open: false, type: "phase", id: "", title: "" });
  const [expandedPhases, setExpandedPhases] = useState<Set<string>>(new Set());

  const [phaseForm, setPhaseForm] = useState({ title: "", description: "", icon: "search" });
  const [itemForm, setItemForm] = useState({ title: "", description: "" });

  const togglePhase = (id: string) => {
    setExpandedPhases(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  // Phase mutations
  const savePhaseMutation = useMutation({
    mutationFn: async () => {
      if (phaseDialog.phase) {
        const { error } = await supabase.from("commercial_phases").update({
          title: phaseForm.title,
          description: phaseForm.description || null,
          icon: phaseForm.icon,
        }).eq("id", phaseDialog.phase.id);
        if (error) throw error;
      } else {
        const maxOrder = phases.length > 0 ? Math.max(...phases.map(p => p.order_index)) + 1 : 0;
        const { error } = await supabase.from("commercial_phases").insert({
          title: phaseForm.title,
          description: phaseForm.description || null,
          icon: phaseForm.icon,
          order_index: maxOrder,
          company_id: scopedCompanyId,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      invalidateAll();
      setPhaseDialog({ open: false });
      toast({ title: phaseDialog.phase ? "Fase atualizada!" : "Fase criada!" });
    },
    onError: (e: any) => toast({ title: "Erro", description: e?.message, variant: "destructive" }),
  });

  const saveItemMutation = useMutation({
    mutationFn: async () => {
      if (itemDialog.item) {
        const { error } = await supabase.from("commercial_items").update({
          title: itemForm.title,
          description: itemForm.description || null,
        }).eq("id", itemDialog.item.id);
        if (error) throw error;
      } else {
        const siblings = items.filter(i => i.phase_id === itemDialog.phaseId && i.parent_item_id === (itemDialog.parentItemId || null));
        const maxOrder = siblings.length > 0 ? Math.max(...siblings.map(i => i.order_index)) + 1 : 0;
        const { error } = await supabase.from("commercial_items").insert({
          phase_id: itemDialog.phaseId,
          parent_item_id: itemDialog.parentItemId || null,
          title: itemForm.title,
          description: itemForm.description || null,
          order_index: maxOrder,
          company_id: scopedCompanyId,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      invalidateAll();
      setItemDialog({ open: false, phaseId: "" });
      toast({ title: itemDialog.item ? "Item atualizado!" : "Item criado!" });
    },
    onError: (e: any) => toast({ title: "Erro", description: e?.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const table = deleteDialog.type === "phase" ? "commercial_phases" : "commercial_items";
      const { error } = await supabase.from(table).delete().eq("id", deleteDialog.id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidateAll();
      setDeleteDialog({ open: false, type: "phase", id: "", title: "" });
      toast({ title: "Excluído com sucesso!" });
    },
    onError: (e: any) => toast({ title: "Erro ao excluir", description: e?.message, variant: "destructive" }),
  });

  const openPhaseDialog = (phase?: Phase) => {
    setPhaseForm(phase ? { title: phase.title, description: phase.description || "", icon: phase.icon } : { title: "", description: "", icon: "search" });
    setPhaseDialog({ open: true, phase });
  };

  const openItemDialog = (phaseId: string, parentItemId?: string, item?: Item) => {
    setItemForm(item ? { title: item.title, description: item.description || "" } : { title: "", description: "" });
    setItemDialog({ open: true, phaseId, parentItemId, item });
  };

  const renderItemRow = (item: Item, depth = 0) => {
    const children = getChildItems(item.id);
    return (
      <div key={item.id}>
        <div className={cn("flex items-center gap-2 py-1.5 px-2 rounded-lg hover:bg-muted/40 group", depth > 0 && "ml-5")}>
          <GripVertical className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0" />
          <span className="text-sm flex-1 truncate">{item.title}</span>
          {item.description && <span className="text-xs text-muted-foreground truncate max-w-[120px] hidden sm:block">{item.description}</span>}
          <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => openItemDialog(item.phase_id, item.id)}>
              <Plus className="h-3 w-3" />
            </Button>
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => openItemDialog(item.phase_id, item.parent_item_id || undefined, item)}>
              <Pencil className="h-3 w-3" />
            </Button>
            <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => setDeleteDialog({ open: true, type: "item", id: item.id, title: item.title })}>
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        </div>
        {children.map(c => renderItemRow(c, depth + 1))}
      </div>
    );
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-heading font-bold text-foreground flex items-center gap-2">
            <Settings2 className="h-5 w-5 text-primary" /> Gerenciar Funil
          </h2>
          <p className="text-sm text-muted-foreground">Personalize fases e itens do seu processo comercial</p>
        </div>
        <Button onClick={() => openPhaseDialog()} className="rounded-xl gap-2">
          <Plus className="h-4 w-4" /> Nova Fase
        </Button>
      </div>

      <div className="space-y-3">
        {phases.map((phase, idx) => {
          const isExpanded = expandedPhases.has(phase.id);
          const phaseTopItems = getPhaseItems(phase.id);

          return (
            <Card key={phase.id} className="overflow-hidden">
              <div
                className={cn("flex items-center gap-3 p-3 cursor-pointer hover:bg-muted/30 transition-colors bg-gradient-to-r", phaseColors[idx % phaseColors.length])}
                onClick={() => togglePhase(phase.id)}
              >
                <Badge variant="outline" className={cn("text-xs shrink-0", phaseIconColors[idx % phaseIconColors.length])}>
                  Fase {idx + 1}
                </Badge>
                <span className="font-semibold text-sm flex-1 truncate">{phase.title}</span>
                <span className="text-xs text-muted-foreground shrink-0">{phaseTopItems.length} itens</span>
                <div className="flex gap-0.5 shrink-0" onClick={e => e.stopPropagation()}>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openPhaseDialog(phase)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setDeleteDialog({ open: true, type: "phase", id: phase.id, title: phase.title })}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
                {isExpanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
              </div>

              <AnimatePresence>
                {isExpanded && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }}>
                    <CardContent className="p-3 space-y-1">
                      {phase.description && <p className="text-xs text-muted-foreground mb-2">{phase.description}</p>}
                      {phaseTopItems.map(item => renderItemRow(item))}
                      <Button variant="ghost" size="sm" className="w-full mt-2 text-xs text-muted-foreground gap-1" onClick={() => openItemDialog(phase.id)}>
                        <Plus className="h-3 w-3" /> Adicionar item
                      </Button>
                    </CardContent>
                  </motion.div>
                )}
              </AnimatePresence>
            </Card>
          );
        })}
      </div>

      {/* Phase Dialog */}
      <Dialog open={phaseDialog.open} onOpenChange={open => { if (!open) setPhaseDialog({ open: false }); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{phaseDialog.phase ? "Editar Fase" : "Nova Fase"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Input placeholder="Título da fase" value={phaseForm.title} onChange={e => setPhaseForm(p => ({ ...p, title: e.target.value }))} />
            <Textarea placeholder="Descrição (opcional)" value={phaseForm.description} onChange={e => setPhaseForm(p => ({ ...p, description: e.target.value }))} rows={2} />
            <Select value={phaseForm.icon} onValueChange={v => setPhaseForm(p => ({ ...p, icon: v }))}>
              <SelectTrigger><SelectValue placeholder="Ícone" /></SelectTrigger>
              <SelectContent>
                {iconOptions.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPhaseDialog({ open: false })}>Cancelar</Button>
            <Button onClick={() => savePhaseMutation.mutate()} disabled={!phaseForm.title || savePhaseMutation.isPending}>
              {savePhaseMutation.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Item Dialog */}
      <Dialog open={itemDialog.open} onOpenChange={open => { if (!open) setItemDialog({ open: false, phaseId: "" }); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{itemDialog.item ? "Editar Item" : "Novo Item"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Input placeholder="Título do item" value={itemForm.title} onChange={e => setItemForm(p => ({ ...p, title: e.target.value }))} />
            <Textarea placeholder="Descrição (opcional)" value={itemForm.description} onChange={e => setItemForm(p => ({ ...p, description: e.target.value }))} rows={2} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setItemDialog({ open: false, phaseId: "" })}>Cancelar</Button>
            <Button onClick={() => saveItemMutation.mutate()} disabled={!itemForm.title || saveItemMutation.isPending}>
              {saveItemMutation.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialog.open} onOpenChange={open => { if (!open) setDeleteDialog({ open: false, type: "phase", id: "", title: "" }); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir {deleteDialog.type === "phase" ? "fase" : "item"}?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir "{deleteDialog.title}"? {deleteDialog.type === "phase" && "Todos os itens desta fase serão removidos."} Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteMutation.mutate()} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deleteMutation.isPending ? "Excluindo..." : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </motion.div>
  );
};

export default PhaseItemManager;
