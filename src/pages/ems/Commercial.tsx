import { useState } from "react";
import { EMSLayout } from "@/components/ems/EMSLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search, Users, ChevronDown, ChevronRight, CheckCircle2, Clock, Circle,
  ArrowLeft, MessageSquare, Palette, Telescope, Handshake, Rocket,
  FileText, Globe, BarChart3, Target, TrendingUp, Phone, Mail, Building2,
  Briefcase, Save, Settings2, Kanban
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { useCommercialData } from "@/components/ems/commercial/useCommercialData";
import { statusConfig, phaseColors, phaseIconColors } from "@/components/ems/commercial/types";
import type { Phase, Item, Tracking, Contact } from "@/components/ems/commercial/types";
import PhaseItemManager from "@/components/ems/commercial/PhaseItemManager";
import PipelineKanban from "@/components/ems/commercial/PipelineKanban";

const phaseIcons: Record<string, typeof Target> = {
  palette: Palette, search: Telescope, handshake: Handshake, rocket: Rocket,
  "file-text": FileText, globe: Globe, "bar-chart": BarChart3,
};

const Commercial = () => {
  const {
    phases, items, contacts, allTracking, leafItems,
    getContactProgress, getPhaseItems, getChildItems, isLeafItem,
    invalidateAll, queryClient,
  } = useCommercialData();

  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedPhases, setExpandedPhases] = useState<Set<string>>(new Set());
  const [noteDialog, setNoteDialog] = useState<{ open: boolean; itemId: string; contactId: string; currentNote: string }>({ open: false, itemId: "", contactId: "", currentNote: "" });
  const [noteText, setNoteText] = useState("");
  const [activeTab, setActiveTab] = useState("contacts");

  // Fetch tracking for selected contact
  const { data: tracking = [] } = useQuery({
    queryKey: ["commercial-tracking", selectedContact?.id],
    queryFn: async () => {
      if (!selectedContact) return [];
      const { data, error } = await supabase.from("contact_commercial_tracking").select("*").eq("contact_id", selectedContact.id);
      if (error) throw error;
      return data as Tracking[];
    },
    enabled: !!selectedContact,
  });

  const getItemStatus = (itemId: string): string => {
    const t = tracking.find(t => t.item_id === itemId);
    return t?.status || "not_started";
  };

  const getItemNote = (itemId: string): string => {
    const t = tracking.find(t => t.item_id === itemId);
    return t?.notes || "";
  };

  const getPhaseProgress = (phaseId: string) => {
    const phaseLeafItems = leafItems.filter(i => {
      const item = items.find(it => it.id === i.id);
      return item?.phase_id === phaseId;
    });
    if (phaseLeafItems.length === 0) return 0;
    const completed = phaseLeafItems.filter(i => getItemStatus(i.id) === "completed").length;
    return Math.round((completed / phaseLeafItems.length) * 100);
  };

  const updateTrackingMutation = useMutation({
    mutationFn: async ({ itemId, status }: { itemId: string; status: string }) => {
      if (!selectedContact) return;
      const existing = tracking.find(t => t.item_id === itemId);
      if (existing) {
        const { error } = await supabase.from("contact_commercial_tracking").update({
          status, completed_at: status === "completed" ? new Date().toISOString() : null, updated_at: new Date().toISOString(),
        }).eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("contact_commercial_tracking").insert({
          contact_id: selectedContact.id, item_id: itemId, status,
          completed_at: status === "completed" ? new Date().toISOString() : null,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["commercial-tracking", selectedContact?.id] });
      queryClient.invalidateQueries({ queryKey: ["commercial-tracking-all"] });
    },
    onError: (e: any) => toast({ title: "Erro ao atualizar status", description: e?.message, variant: "destructive" }),
  });

  const saveNoteMutation = useMutation({
    mutationFn: async ({ itemId, notes }: { itemId: string; notes: string }) => {
      if (!selectedContact) return;
      const existing = tracking.find(t => t.item_id === itemId);
      if (existing) {
        const { error } = await supabase.from("contact_commercial_tracking").update({
          notes: notes || null, updated_at: new Date().toISOString(),
        }).eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("contact_commercial_tracking").insert({
          contact_id: selectedContact.id, item_id: itemId, status: "not_started", notes: notes || null,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["commercial-tracking", selectedContact?.id] });
      setNoteDialog({ open: false, itemId: "", contactId: "", currentNote: "" });
      toast({ title: "Nota salva!" });
    },
    onError: (e: any) => toast({ title: "Erro ao salvar nota", description: e?.message, variant: "destructive" }),
  });

  const cycleStatus = (itemId: string) => {
    const current = getItemStatus(itemId);
    const next = current === "not_started" ? "in_progress" : current === "in_progress" ? "completed" : "not_started";
    updateTrackingMutation.mutate({ itemId, status: next });
  };

  const togglePhase = (phaseId: string) => {
    setExpandedPhases(prev => {
      const next = new Set(prev);
      next.has(phaseId) ? next.delete(phaseId) : next.add(phaseId);
      return next;
    });
  };

  const expandAll = () => setExpandedPhases(new Set(phases.map(p => p.id)));
  const collapseAll = () => setExpandedPhases(new Set());

  const filteredContacts = contacts.filter(c =>
    !searchQuery || c.name.toLowerCase().includes(searchQuery.toLowerCase()) || c.company?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const activeContacts = contacts.filter(c => { const p = getContactProgress(c.id); return p > 0 && p < 100; }).length;
  const completedContacts = contacts.filter(c => getContactProgress(c.id) === 100).length;
  const avgProgress = contacts.length > 0 ? Math.round(contacts.reduce((sum, c) => sum + getContactProgress(c.id), 0) / contacts.length) : 0;

  const renderItem = (item: Item, depth = 0) => {
    const children = getChildItems(item.id);
    const isLeaf = isLeafItem(item.id);
    const status = isLeaf ? getItemStatus(item.id) : "not_started";
    const sConfig = statusConfig[status as keyof typeof statusConfig] || statusConfig.not_started;
    const StatusIcon = status === "completed" ? CheckCircle2 : status === "in_progress" ? Clock : Circle;
    const note = isLeaf ? getItemNote(item.id) : "";

    let parentProgress = -1;
    if (!isLeaf && children.length > 0) {
      const childLeafs = children.filter(c => isLeafItem(c.id));
      if (childLeafs.length > 0) {
        const done = childLeafs.filter(c => getItemStatus(c.id) === "completed").length;
        parentProgress = Math.round((done / childLeafs.length) * 100);
      }
    }

    return (
      <div key={item.id}>
        <div className={cn("flex items-center gap-2 sm:gap-3 py-2 px-2 sm:px-3 rounded-lg transition-all duration-200 group", isLeaf && "hover:bg-muted/50 cursor-pointer", depth > 0 && "ml-4 sm:ml-6")} onClick={() => isLeaf && cycleStatus(item.id)}>
          {isLeaf ? (
            <button className={cn("p-0.5 rounded-md transition-colors shrink-0", sConfig.bg)} onClick={(e) => { e.stopPropagation(); cycleStatus(item.id); }}>
              <StatusIcon className={cn("h-4 w-4 sm:h-5 sm:w-5", sConfig.color)} />
            </button>
          ) : <div className="w-5 sm:w-6" />}
          <div className="flex-1 min-w-0">
            <p className={cn("text-xs sm:text-sm font-medium truncate", isLeaf && status === "completed" && "line-through text-muted-foreground")}>{item.title}</p>
            {item.description && <p className="text-[10px] sm:text-xs text-muted-foreground truncate mt-0.5">{item.description}</p>}
          </div>
          {isLeaf && (
            <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
              <Badge variant="outline" className={cn("text-[10px] hidden sm:flex", sConfig.border, sConfig.color)}>{sConfig.label}</Badge>
              <Button variant="ghost" size="icon" className="h-6 w-6 sm:h-7 sm:w-7" onClick={(e) => { e.stopPropagation(); setNoteText(note); setNoteDialog({ open: true, itemId: item.id, contactId: selectedContact?.id || "", currentNote: note }); }}>
                <MessageSquare className={cn("h-3 w-3 sm:h-3.5 sm:w-3.5", note ? "text-primary" : "text-muted-foreground")} />
              </Button>
            </div>
          )}
          {!isLeaf && parentProgress >= 0 && <span className="text-[10px] sm:text-xs text-muted-foreground shrink-0">{parentProgress}%</span>}
        </div>
        {children.length > 0 && children.map(child => renderItem(child, depth + 1))}
      </div>
    );
  };

  // ============= CONTACT DETAIL VIEW =============
  if (selectedContact) {
    const totalLeaf = leafItems.length;
    const completedItems = leafItems.filter(i => getItemStatus(i.id) === "completed").length;
    const inProgressItems = leafItems.filter(i => getItemStatus(i.id) === "in_progress").length;
    const overallProgress = totalLeaf > 0 ? Math.round((completedItems / totalLeaf) * 100) : 0;

    return (
      <EMSLayout>
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4 sm:space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
            <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl shrink-0 self-start" onClick={() => setSelectedContact(null)}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex-1 min-w-0">
              <h1 className="text-xl sm:text-2xl md:text-3xl font-heading font-bold text-foreground truncate">{selectedContact.name}</h1>
              <div className="flex flex-wrap gap-2 sm:gap-3 text-xs sm:text-sm text-muted-foreground mt-1">
                {selectedContact.company && <span className="flex items-center gap-1"><Building2 className="h-3 w-3" />{selectedContact.company}</span>}
                {selectedContact.email && <span className="flex items-center gap-1 truncate max-w-[180px] sm:max-w-none"><Mail className="h-3 w-3" />{selectedContact.email}</span>}
                {selectedContact.phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{selectedContact.phone}</span>}
              </div>
            </div>
            <div className="flex gap-2 self-start sm:self-auto">
              <Button variant="outline" size="sm" className="rounded-xl text-xs" onClick={expandAll}>Expandir Tudo</Button>
              <Button variant="outline" size="sm" className="rounded-xl text-xs" onClick={collapseAll}>Recolher</Button>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: "Progresso Geral", value: `${overallProgress}%`, icon: Target, color: "text-primary", bg: "bg-primary/10", border: "border-primary/20" },
              { label: "Concluídos", value: completedItems, icon: CheckCircle2, color: "text-emerald-500", bg: "bg-emerald-500/10", border: "border-emerald-500/20" },
              { label: "Em Andamento", value: inProgressItems, icon: Clock, color: "text-amber-500", bg: "bg-amber-500/10", border: "border-amber-500/20" },
              { label: "Total de Itens", value: totalLeaf, icon: Briefcase, color: "text-blue-400", bg: "bg-blue-500/10", border: "border-blue-500/20" },
            ].map(s => (
              <Card key={s.label} className={cn("border", s.border)}>
                <CardContent className="p-3 sm:p-4 flex items-center gap-2.5 sm:gap-3">
                  <div className={cn("p-1.5 sm:p-2 rounded-lg", s.bg)}><s.icon className={cn("h-4 w-4 sm:h-5 sm:w-5", s.color)} /></div>
                  <div><p className="text-lg sm:text-2xl font-bold">{s.value}</p><p className="text-[10px] sm:text-xs text-muted-foreground">{s.label}</p></div>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Progresso Total</span>
                <span className="text-sm font-bold text-primary">{overallProgress}%</span>
              </div>
              <Progress value={overallProgress} className="h-3" />
            </CardContent>
          </Card>

          <div className="space-y-3">
            {phases.map((phase, idx) => {
              const isExpanded = expandedPhases.has(phase.id);
              const phaseProgress = getPhaseProgress(phase.id);
              const PhaseIcon = phaseIcons[phase.icon] || Target;
              const phaseTopItems = getPhaseItems(phase.id);

              return (
                <Card key={phase.id} className={cn("border overflow-hidden", isExpanded && "ring-1 ring-primary/20")}>
                  <div className={cn("flex items-center gap-3 p-3 sm:p-4 cursor-pointer hover:bg-muted/30 transition-colors bg-gradient-to-r", phaseColors[idx % phaseColors.length])} onClick={() => togglePhase(phase.id)}>
                    <div className="p-1.5 sm:p-2 rounded-lg bg-background/80 shrink-0">
                      <PhaseIcon className={cn("h-4 w-4 sm:h-5 sm:w-5", phaseIconColors[idx % phaseIconColors.length])} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="text-[10px] sm:text-xs font-bold text-muted-foreground">FASE {idx + 1}</span>
                      <h3 className="font-semibold text-sm sm:text-base truncate">{phase.title}</h3>
                    </div>
                    <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                      <p className="text-sm font-bold hidden sm:block">{phaseProgress}%</p>
                      <div className="w-16 sm:w-24 hidden sm:block"><Progress value={phaseProgress} className="h-2" /></div>
                      <span className="text-sm font-bold sm:hidden">{phaseProgress}%</span>
                      {isExpanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                    </div>
                  </div>
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }}>
                        <CardContent className="p-2 sm:p-3 pt-1 space-y-0.5">
                          {phase.description && <p className="text-xs text-muted-foreground px-2 sm:px-3 py-1.5 mb-1">{phase.description}</p>}
                          {phaseTopItems.map(item => renderItem(item))}
                        </CardContent>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </Card>
              );
            })}
          </div>
        </motion.div>

        <Dialog open={noteDialog.open} onOpenChange={(open) => { if (!open) setNoteDialog({ open: false, itemId: "", contactId: "", currentNote: "" }); }}>
          <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
            <DialogHeader><DialogTitle>Nota do Item</DialogTitle></DialogHeader>
            <Textarea value={noteText} onChange={(e) => setNoteText(e.target.value)} placeholder="Adicione observações..." rows={4} className="mt-2" />
            <DialogFooter className="flex-col sm:flex-row gap-2 sm:gap-0">
              <Button variant="outline" className="rounded-xl w-full sm:w-auto" onClick={() => setNoteDialog({ open: false, itemId: "", contactId: "", currentNote: "" })}>Cancelar</Button>
              <Button className="rounded-xl gap-2 w-full sm:w-auto" onClick={() => saveNoteMutation.mutate({ itemId: noteDialog.itemId, notes: noteText })} disabled={saveNoteMutation.isPending}>
                <Save className="h-4 w-4" />{saveNoteMutation.isPending ? "Salvando..." : "Salvar Nota"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </EMSLayout>
    );
  }

  // ============= MAIN VIEW WITH TABS =============
  return (
    <EMSLayout>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4 sm:space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl md:text-3xl font-heading font-bold text-foreground">Comercial</h1>
            <p className="text-sm md:text-base text-muted-foreground mt-1">CRM e acompanhamento do funil comercial</p>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Total Contatos", value: contacts.length, icon: Users, color: "text-primary", bg: "bg-primary/10", border: "border-primary/20" },
            { label: "Em Andamento", value: activeContacts, icon: Clock, color: "text-amber-500", bg: "bg-amber-500/10", border: "border-amber-500/20" },
            { label: "Concluídos", value: completedContacts, icon: CheckCircle2, color: "text-emerald-500", bg: "bg-emerald-500/10", border: "border-emerald-500/20" },
            { label: "Progresso Médio", value: `${avgProgress}%`, icon: TrendingUp, color: "text-blue-400", bg: "bg-blue-500/10", border: "border-blue-500/20" },
          ].map(s => (
            <Card key={s.label} className={cn("border transition-all duration-300 hover:scale-[1.02]", s.border)}>
              <CardContent className="p-3 sm:p-4 flex items-center gap-2.5 sm:gap-3">
                <div className={cn("p-1.5 sm:p-2 rounded-lg", s.bg)}><s.icon className={cn("h-4 w-4 sm:h-5 sm:w-5", s.color)} /></div>
                <div><p className="text-xl sm:text-2xl font-bold">{s.value}</p><p className="text-[10px] sm:text-xs text-muted-foreground">{s.label}</p></div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="contacts" className="gap-1.5"><Users className="h-4 w-4" /><span className="hidden sm:inline">Contatos</span></TabsTrigger>
            <TabsTrigger value="pipeline" className="gap-1.5"><Kanban className="h-4 w-4" /><span className="hidden sm:inline">Pipeline</span></TabsTrigger>
            <TabsTrigger value="manage" className="gap-1.5"><Settings2 className="h-4 w-4" /><span className="hidden sm:inline">Gerenciar Funil</span></TabsTrigger>
          </TabsList>

          <TabsContent value="contacts" className="mt-4 space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Buscar contatos..." className="pl-10" />
            </div>
            <div className="space-y-3">
              {filteredContacts.length === 0 ? (
                <Card className="border-dashed border-primary/20">
                  <CardContent className="py-16 text-center">
                    <div className="inline-flex p-4 rounded-2xl bg-primary/10 mb-4"><Users className="h-10 w-10 text-primary/60" /></div>
                    <p className="text-muted-foreground text-lg font-medium">Nenhum contato encontrado</p>
                    <p className="text-muted-foreground/60 text-sm mt-1">Crie contatos na página de Contatos para começar</p>
                  </CardContent>
                </Card>
              ) : (
                <AnimatePresence>
                  {filteredContacts.map(contact => {
                    const progress = getContactProgress(contact.id);
                    const contactTrackingData = allTracking.filter(t => t.contact_id === contact.id);
                    const completed = contactTrackingData.filter(t => t.status === "completed").length;
                    const inProg = contactTrackingData.filter(t => t.status === "in_progress").length;
                    return (
                      <motion.div key={contact.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                        <Card className="hover:border-primary/30 transition-all duration-300 hover:shadow-md hover:shadow-primary/5 cursor-pointer" onClick={() => { setSelectedContact(contact); setExpandedPhases(new Set()); }}>
                          <CardContent className="p-4 sm:p-5">
                            <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1 flex-wrap">
                                  <h3 className="font-semibold text-sm sm:text-base">{contact.name}</h3>
                                  {contact.company && <Badge variant="outline" className="text-[10px] sm:text-xs truncate max-w-[140px]"><Building2 className="h-3 w-3 mr-1" />{contact.company}</Badge>}
                                </div>
                                <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                                  {contact.email && <span className="flex items-center gap-1 truncate max-w-[180px] sm:max-w-none"><Mail className="h-3 w-3" />{contact.email}</span>}
                                  {contact.phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{contact.phone}</span>}
                                </div>
                              </div>
                              <div className="flex items-center gap-3 sm:gap-4 shrink-0">
                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                  <span className="flex items-center gap-1"><CheckCircle2 className="h-3 w-3 text-emerald-500" />{completed}</span>
                                  <span className="flex items-center gap-1"><Clock className="h-3 w-3 text-amber-500" />{inProg}</span>
                                </div>
                                <div className="flex items-center gap-2 min-w-[100px] sm:min-w-[140px]">
                                  <Progress value={progress} className="h-2 flex-1" />
                                  <span className="text-xs sm:text-sm font-bold w-9 text-right">{progress}%</span>
                                </div>
                                <ChevronRight className="h-4 w-4 text-muted-foreground hidden sm:block" />
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              )}
            </div>
          </TabsContent>

          <TabsContent value="pipeline" className="mt-4">
            <PipelineKanban onSelectContact={(c) => { setSelectedContact(c); setExpandedPhases(new Set()); }} />
          </TabsContent>

          <TabsContent value="manage" className="mt-4">
            <PhaseItemManager />
          </TabsContent>
        </Tabs>
      </motion.div>
    </EMSLayout>
  );
};

export default Commercial;
