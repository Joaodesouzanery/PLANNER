import { useState, useMemo } from "react";
import { EMSLayout } from "@/components/ems/EMSLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search, Users, ChevronDown, ChevronRight, CheckCircle2, Clock, Circle,
  ArrowLeft, MessageSquare, Palette, Telescope, Handshake, Rocket,
  FileText, Globe, BarChart3, Target, TrendingUp, Phone, Mail, Building2,
  Briefcase, Save
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface Phase {
  id: string;
  title: string;
  description: string | null;
  icon: string;
  order_index: number;
}

interface Item {
  id: string;
  phase_id: string;
  parent_item_id: string | null;
  title: string;
  description: string | null;
  order_index: number;
}

interface Tracking {
  id: string;
  contact_id: string;
  item_id: string;
  status: string;
  notes: string | null;
  completed_at: string | null;
}

interface Contact {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  pipeline_stage: string | null;
}

const statusConfig = {
  not_started: { label: "Não Iniciado", color: "text-muted-foreground", bg: "bg-muted/50", icon: Circle, border: "border-muted" },
  in_progress: { label: "Em Andamento", color: "text-amber-500", bg: "bg-amber-500/10", icon: Clock, border: "border-amber-500/30" },
  completed: { label: "Concluído", color: "text-emerald-500", bg: "bg-emerald-500/10", icon: CheckCircle2, border: "border-emerald-500/30" },
};

const phaseIcons: Record<string, typeof Target> = {
  palette: Palette,
  search: Telescope,
  handshake: Handshake,
  rocket: Rocket,
  "file-text": FileText,
  globe: Globe,
  "bar-chart": BarChart3,
};

const phaseColors = [
  "from-blue-500/20 to-blue-600/5 border-blue-500/30",
  "from-purple-500/20 to-purple-600/5 border-purple-500/30",
  "from-amber-500/20 to-amber-600/5 border-amber-500/30",
  "from-emerald-500/20 to-emerald-600/5 border-emerald-500/30",
  "from-pink-500/20 to-pink-600/5 border-pink-500/30",
  "from-cyan-500/20 to-cyan-600/5 border-cyan-500/30",
  "from-orange-500/20 to-orange-600/5 border-orange-500/30",
];

const phaseIconColors = [
  "text-blue-500",
  "text-purple-500",
  "text-amber-500",
  "text-emerald-500",
  "text-pink-500",
  "text-cyan-500",
  "text-orange-500",
];

const Commercial = () => {
  const queryClient = useQueryClient();
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedPhases, setExpandedPhases] = useState<Set<string>>(new Set());
  const [noteDialog, setNoteDialog] = useState<{ open: boolean; itemId: string; contactId: string; currentNote: string }>({ open: false, itemId: "", contactId: "", currentNote: "" });
  const [noteText, setNoteText] = useState("");

  // Fetch phases
  const { data: phases = [] } = useQuery({
    queryKey: ["commercial-phases"],
    queryFn: async () => {
      const { data, error } = await supabase.from("commercial_phases").select("*").order("order_index");
      if (error) throw error;
      return data as Phase[];
    },
  });

  // Fetch items
  const { data: items = [] } = useQuery({
    queryKey: ["commercial-items"],
    queryFn: async () => {
      const { data, error } = await supabase.from("commercial_items").select("*").order("order_index");
      if (error) throw error;
      return data as Item[];
    },
  });

  // Fetch contacts
  const { data: contacts = [] } = useQuery({
    queryKey: ["contacts"],
    queryFn: async () => {
      const { data, error } = await supabase.from("contacts").select("id, name, email, phone, company, pipeline_stage").order("name");
      if (error) throw error;
      return data as Contact[];
    },
  });

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

  // Fetch ALL tracking for overview stats
  const { data: allTracking = [] } = useQuery({
    queryKey: ["commercial-tracking-all"],
    queryFn: async () => {
      const { data, error } = await supabase.from("contact_commercial_tracking").select("*");
      if (error) throw error;
      return data as Tracking[];
    },
  });

  // Get leaf items (items without children - these are the trackable ones)
  const leafItems = useMemo(() => {
    const parentIds = new Set(items.filter(i => i.parent_item_id).map(i => i.parent_item_id));
    return items.filter(i => !parentIds.has(i.id));
  }, [items]);

  const getItemStatus = (itemId: string): string => {
    const t = tracking.find(t => t.item_id === itemId);
    return t?.status || "not_started";
  };

  const getItemNote = (itemId: string): string => {
    const t = tracking.find(t => t.item_id === itemId);
    return t?.notes || "";
  };

  // Calculate progress per contact
  const getContactProgress = (contactId: string) => {
    const contactTracking = allTracking.filter(t => t.contact_id === contactId);
    const total = leafItems.length;
    if (total === 0) return 0;
    const completed = contactTracking.filter(t => t.status === "completed").length;
    return Math.round((completed / total) * 100);
  };

  // Calculate phase progress for selected contact
  const getPhaseProgress = (phaseId: string) => {
    const phaseLeafItems = leafItems.filter(i => i.phase_id === phaseId);
    if (phaseLeafItems.length === 0) return 0;
    const completed = phaseLeafItems.filter(i => getItemStatus(i.id) === "completed").length;
    return Math.round((completed / phaseLeafItems.length) * 100);
  };

  // Update tracking mutation
  const updateTrackingMutation = useMutation({
    mutationFn: async ({ itemId, status }: { itemId: string; status: string }) => {
      if (!selectedContact) return;
      const existing = tracking.find(t => t.item_id === itemId);
      if (existing) {
        const { error } = await supabase.from("contact_commercial_tracking").update({
          status,
          completed_at: status === "completed" ? new Date().toISOString() : null,
          updated_at: new Date().toISOString(),
        }).eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("contact_commercial_tracking").insert({
          contact_id: selectedContact.id,
          item_id: itemId,
          status,
          completed_at: status === "completed" ? new Date().toISOString() : null,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["commercial-tracking", selectedContact?.id] });
      queryClient.invalidateQueries({ queryKey: ["commercial-tracking-all"] });
    },
    onError: (error: any) => {
      toast({ title: "Erro ao atualizar status", description: error?.message, variant: "destructive" });
    },
  });

  // Save note mutation
  const saveNoteMutation = useMutation({
    mutationFn: async ({ itemId, notes }: { itemId: string; notes: string }) => {
      if (!selectedContact) return;
      const existing = tracking.find(t => t.item_id === itemId);
      if (existing) {
        const { error } = await supabase.from("contact_commercial_tracking").update({
          notes: notes || null,
          updated_at: new Date().toISOString(),
        }).eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("contact_commercial_tracking").insert({
          contact_id: selectedContact.id,
          item_id: itemId,
          status: "not_started",
          notes: notes || null,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["commercial-tracking", selectedContact?.id] });
      setNoteDialog({ open: false, itemId: "", contactId: "", currentNote: "" });
      toast({ title: "Nota salva!" });
    },
    onError: (error: any) => {
      toast({ title: "Erro ao salvar nota", description: error?.message, variant: "destructive" });
    },
  });

  const cycleStatus = (itemId: string) => {
    const current = getItemStatus(itemId);
    const next = current === "not_started" ? "in_progress" : current === "in_progress" ? "completed" : "not_started";
    updateTrackingMutation.mutate({ itemId, status: next });
  };

  const togglePhase = (phaseId: string) => {
    setExpandedPhases(prev => {
      const next = new Set(prev);
      if (next.has(phaseId)) next.delete(phaseId);
      else next.add(phaseId);
      return next;
    });
  };

  const expandAll = () => setExpandedPhases(new Set(phases.map(p => p.id)));
  const collapseAll = () => setExpandedPhases(new Set());

  const filteredContacts = contacts.filter(c =>
    !searchQuery ||
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.company?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Get items for a phase, organized by hierarchy
  const getPhaseItems = (phaseId: string) => {
    const phaseItems = items.filter(i => i.phase_id === phaseId && !i.parent_item_id);
    return phaseItems.sort((a, b) => a.order_index - b.order_index);
  };

  const getChildItems = (parentId: string) => {
    return items.filter(i => i.parent_item_id === parentId).sort((a, b) => a.order_index - b.order_index);
  };

  const isLeafItem = (itemId: string) => leafItems.some(i => i.id === itemId);

  // Overview stats
  const activeContacts = contacts.filter(c => {
    const progress = getContactProgress(c.id);
    return progress > 0 && progress < 100;
  }).length;
  const completedContacts = contacts.filter(c => getContactProgress(c.id) === 100).length;
  const avgProgress = contacts.length > 0
    ? Math.round(contacts.reduce((sum, c) => sum + getContactProgress(c.id), 0) / contacts.length)
    : 0;

  // Render a single item row
  const renderItem = (item: Item, depth = 0) => {
    const children = getChildItems(item.id);
    const isLeaf = isLeafItem(item.id);
    const status = isLeaf ? getItemStatus(item.id) : "not_started";
    const sConfig = statusConfig[status as keyof typeof statusConfig] || statusConfig.not_started;
    const StatusIcon = sConfig.icon;
    const note = isLeaf ? getItemNote(item.id) : "";

    // For parent items, calculate aggregate progress
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
        <div
          className={cn(
            "flex items-center gap-2 sm:gap-3 py-2 px-2 sm:px-3 rounded-lg transition-all duration-200 group",
            isLeaf && "hover:bg-muted/50 cursor-pointer",
            depth > 0 && "ml-4 sm:ml-6"
          )}
          onClick={() => isLeaf && cycleStatus(item.id)}
        >
          {isLeaf ? (
            <button
              className={cn("p-0.5 rounded-md transition-colors shrink-0", sConfig.bg)}
              onClick={(e) => { e.stopPropagation(); cycleStatus(item.id); }}
            >
              <StatusIcon className={cn("h-4 w-4 sm:h-5 sm:w-5", sConfig.color)} />
            </button>
          ) : (
            <div className="w-5 sm:w-6" />
          )}

          <div className="flex-1 min-w-0">
            <p className={cn(
              "text-xs sm:text-sm font-medium truncate",
              isLeaf && status === "completed" && "line-through text-muted-foreground"
            )}>
              {item.title}
            </p>
            {item.description && (
              <p className="text-[10px] sm:text-xs text-muted-foreground truncate mt-0.5">{item.description}</p>
            )}
          </div>

          {isLeaf && (
            <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
              <Badge variant="outline" className={cn("text-[10px] hidden sm:flex", sConfig.border, sConfig.color)}>
                {sConfig.label}
              </Badge>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 sm:h-7 sm:w-7"
                onClick={(e) => {
                  e.stopPropagation();
                  setNoteText(note);
                  setNoteDialog({ open: true, itemId: item.id, contactId: selectedContact?.id || "", currentNote: note });
                }}
              >
                <MessageSquare className={cn("h-3 w-3 sm:h-3.5 sm:w-3.5", note ? "text-primary" : "text-muted-foreground")} />
              </Button>
            </div>
          )}

          {!isLeaf && parentProgress >= 0 && (
            <span className="text-[10px] sm:text-xs text-muted-foreground shrink-0">{parentProgress}%</span>
          )}
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
          {/* Header */}
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

          {/* Progress Overview */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: "Progresso Geral", value: `${overallProgress}%`, icon: Target, color: "text-primary", bg: "bg-primary/10", border: "border-primary/20" },
              { label: "Concluídos", value: completedItems, icon: CheckCircle2, color: "text-emerald-500", bg: "bg-emerald-500/10", border: "border-emerald-500/20" },
              { label: "Em Andamento", value: inProgressItems, icon: Clock, color: "text-amber-500", bg: "bg-amber-500/10", border: "border-amber-500/20" },
              { label: "Total de Itens", value: totalLeaf, icon: Briefcase, color: "text-blue-400", bg: "bg-blue-500/10", border: "border-blue-500/20" },
            ].map(s => (
              <Card key={s.label} className={cn("border", s.border)}>
                <CardContent className="p-3 sm:p-4 flex items-center gap-2.5 sm:gap-3">
                  <div className={cn("p-1.5 sm:p-2 rounded-lg", s.bg)}>
                    <s.icon className={cn("h-4 w-4 sm:h-5 sm:w-5", s.color)} />
                  </div>
                  <div>
                    <p className="text-lg sm:text-2xl font-bold">{s.value}</p>
                    <p className="text-[10px] sm:text-xs text-muted-foreground">{s.label}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Overall progress bar */}
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Progresso Total</span>
                <span className="text-sm font-bold text-primary">{overallProgress}%</span>
              </div>
              <Progress value={overallProgress} className="h-3" />
            </CardContent>
          </Card>

          {/* Phases */}
          <div className="space-y-3">
            {phases.map((phase, idx) => {
              const isExpanded = expandedPhases.has(phase.id);
              const phaseProgress = getPhaseProgress(phase.id);
              const PhaseIcon = phaseIcons[phase.icon] || Target;
              const phaseTopItems = getPhaseItems(phase.id);

              return (
                <Card key={phase.id} className={cn("border overflow-hidden", isExpanded && "ring-1 ring-primary/20")}>
                  <div
                    className={cn("flex items-center gap-3 p-3 sm:p-4 cursor-pointer hover:bg-muted/30 transition-colors bg-gradient-to-r", phaseColors[idx % phaseColors.length])}
                    onClick={() => togglePhase(phase.id)}
                  >
                    <div className="p-1.5 sm:p-2 rounded-lg bg-background/80 shrink-0">
                      <PhaseIcon className={cn("h-4 w-4 sm:h-5 sm:w-5", phaseIconColors[idx % phaseIconColors.length])} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] sm:text-xs font-bold text-muted-foreground">FASE {idx + 1}</span>
                      </div>
                      <h3 className="font-semibold text-sm sm:text-base truncate">{phase.title}</h3>
                    </div>
                    <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                      <div className="text-right hidden sm:block">
                        <p className="text-sm font-bold">{phaseProgress}%</p>
                      </div>
                      <div className="w-16 sm:w-24 hidden sm:block">
                        <Progress value={phaseProgress} className="h-2" />
                      </div>
                      <span className="text-sm font-bold sm:hidden">{phaseProgress}%</span>
                      {isExpanded ? <ChevronDown className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground" />}
                    </div>
                  </div>

                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                      >
                        <CardContent className="p-2 sm:p-3 pt-1 space-y-0.5">
                          {phase.description && (
                            <p className="text-xs text-muted-foreground px-2 sm:px-3 py-1.5 mb-1">{phase.description}</p>
                          )}
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

        {/* Note Dialog */}
        <Dialog open={noteDialog.open} onOpenChange={(open) => { if (!open) setNoteDialog({ open: false, itemId: "", contactId: "", currentNote: "" }); }}>
          <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Nota do Item</DialogTitle>
            </DialogHeader>
            <Textarea
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              placeholder="Adicione observações sobre este item para este contato..."
              rows={4}
              className="mt-2"
            />
            <DialogFooter className="flex-col sm:flex-row gap-2 sm:gap-0">
              <Button variant="outline" className="rounded-xl w-full sm:w-auto" onClick={() => setNoteDialog({ open: false, itemId: "", contactId: "", currentNote: "" })}>Cancelar</Button>
              <Button
                className="rounded-xl shadow-lg hover:shadow-primary transition-all duration-300 w-full sm:w-auto gap-2"
                onClick={() => saveNoteMutation.mutate({ itemId: noteDialog.itemId, notes: noteText })}
                disabled={saveNoteMutation.isPending}
              >
                <Save className="h-4 w-4" />
                {saveNoteMutation.isPending ? "Salvando..." : "Salvar Nota"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </EMSLayout>
    );
  }

  // ============= OVERVIEW (CONTACT LIST) =============
  return (
    <EMSLayout>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4 sm:space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl md:text-3xl font-heading font-bold text-foreground">Comercial</h1>
            <p className="text-sm md:text-base text-muted-foreground mt-1">Acompanhe o progresso comercial de cada contato</p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Total Contatos", value: contacts.length, icon: Users, color: "text-primary", bg: "bg-primary/10", border: "border-primary/20" },
            { label: "Em Andamento", value: activeContacts, icon: Clock, color: "text-amber-500", bg: "bg-amber-500/10", border: "border-amber-500/20" },
            { label: "Concluídos", value: completedContacts, icon: CheckCircle2, color: "text-emerald-500", bg: "bg-emerald-500/10", border: "border-emerald-500/20" },
            { label: "Progresso Médio", value: `${avgProgress}%`, icon: TrendingUp, color: "text-blue-400", bg: "bg-blue-500/10", border: "border-blue-500/20" },
          ].map(s => (
            <Card key={s.label} className={cn("border transition-all duration-300 hover:scale-[1.02]", s.border)}>
              <CardContent className="p-3 sm:p-4 flex items-center gap-2.5 sm:gap-3">
                <div className={cn("p-1.5 sm:p-2 rounded-lg", s.bg)}>
                  <s.icon className={cn("h-4 w-4 sm:h-5 sm:w-5", s.color)} />
                </div>
                <div>
                  <p className="text-xl sm:text-2xl font-bold">{s.value}</p>
                  <p className="text-[10px] sm:text-xs text-muted-foreground">{s.label}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Buscar contatos..." className="pl-10" />
        </div>

        {/* Contact List */}
        <div className="space-y-3">
          {filteredContacts.length === 0 ? (
            <Card className="border-dashed border-primary/20">
              <CardContent className="py-16 text-center">
                <div className="inline-flex p-4 rounded-2xl bg-primary/10 mb-4">
                  <Users className="h-10 w-10 text-primary/60" />
                </div>
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
                    <Card
                      className="hover:border-primary/30 transition-all duration-300 hover:shadow-md hover:shadow-primary/5 cursor-pointer"
                      onClick={() => { setSelectedContact(contact); setExpandedPhases(new Set()); }}
                    >
                      <CardContent className="p-4 sm:p-5">
                        <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                              <h3 className="font-semibold text-sm sm:text-base">{contact.name}</h3>
                              {contact.company && (
                                <Badge variant="outline" className="text-[10px] sm:text-xs truncate max-w-[140px]">
                                  <Building2 className="h-3 w-3 mr-1" />{contact.company}
                                </Badge>
                              )}
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
      </motion.div>
    </EMSLayout>
  );
};

export default Commercial;
