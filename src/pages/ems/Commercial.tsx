import { useState, useMemo } from "react";
import { EMSLayout } from "@/components/ems/EMSLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search, Users, ChevronDown, ChevronRight, CheckCircle2, Clock, Circle,
  ArrowLeft, MessageSquare, Palette, Telescope, Handshake, Rocket,
  FileText, Globe, BarChart3, Target, TrendingUp, Phone, Mail, Building2,
  Briefcase, Save, Settings2, Kanban, Tag, Flame, Thermometer, CalendarClock,
  X, Plus, AlertTriangle, Zap
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { useCommercialData } from "@/components/ems/commercial/useCommercialData";
import { statusConfig, phaseColors, phaseIconColors } from "@/components/ems/commercial/types";
import type { Phase, Item, Tracking, Contact, ContactMeta } from "@/components/ems/commercial/types";
import PhaseItemManager from "@/components/ems/commercial/PhaseItemManager";
import PipelineKanban from "@/components/ems/commercial/PipelineKanban";
import FunnelReports from "@/components/ems/commercial/FunnelReports";



const phaseIcons: Record<string, typeof Target> = {
  palette: Palette, search: Telescope, handshake: Handshake, rocket: Rocket,
  "file-text": FileText, globe: Globe, "bar-chart": BarChart3,
};

// Predefined tags for the commercial module
const PREDEFINED_TAGS = [
  { label: "Primeiro Contato", color: "bg-blue-500/15 text-blue-600 border-blue-500/30" },
  { label: "Follow-up", color: "bg-amber-500/15 text-amber-600 border-amber-500/30" },
  { label: "Negociação", color: "bg-purple-500/15 text-purple-600 border-purple-500/30" },
  { label: "Proposta Enviada", color: "bg-cyan-500/15 text-cyan-600 border-cyan-500/30" },
  { label: "Aguardando Retorno", color: "bg-orange-500/15 text-orange-600 border-orange-500/30" },
  { label: "Reunião Agendada", color: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30" },
  { label: "Contrato Assinado", color: "bg-green-500/15 text-green-600 border-green-500/30" },
  { label: "Onboarding", color: "bg-indigo-500/15 text-indigo-600 border-indigo-500/30" },
  { label: "Perdido", color: "bg-red-500/15 text-red-600 border-red-500/30" },
  { label: "Indicação", color: "bg-pink-500/15 text-pink-600 border-pink-500/30" },
  { label: "Reativação", color: "bg-violet-500/15 text-violet-600 border-violet-500/30" },
  { label: "VIP", color: "bg-yellow-500/15 text-yellow-700 border-yellow-500/30" },
];

const getTagColor = (tag: string) => {
  const predefined = PREDEFINED_TAGS.find(t => t.label === tag);
  return predefined?.color || "bg-muted text-muted-foreground border-muted";
};

const temperatureConfig: Record<string, { label: string; color: string; icon: typeof Flame; bg: string }> = {
  hot: { label: "Quente", color: "text-red-500", icon: Flame, bg: "bg-red-500/10" },
  warm: { label: "Morno", color: "text-amber-500", icon: Thermometer, bg: "bg-amber-500/10" },
  cold: { label: "Frio", color: "text-blue-400", icon: Zap, bg: "bg-blue-500/10" },
};

const priorityConfig: Record<string, { label: string; color: string; border: string }> = {
  high: { label: "Alta", color: "text-red-500", border: "border-red-500/30" },
  medium: { label: "Média", color: "text-amber-500", border: "border-amber-500/30" },
  low: { label: "Baixa", color: "text-blue-400", border: "border-blue-500/30" },
};

const Commercial = () => {
  const {
    phases, items, contacts, allTracking, leafItems, allMeta,
    getContactProgress, getPhaseItems, getChildItems, isLeafItem,
    getContactMeta, invalidateAll, queryClient,
  } = useCommercialData();

  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedPhases, setExpandedPhases] = useState<Set<string>>(new Set());
  const [noteDialog, setNoteDialog] = useState<{ open: boolean; itemId: string; contactId: string; currentNote: string }>({ open: false, itemId: "", contactId: "", currentNote: "" });
  const [noteText, setNoteText] = useState("");
  const [activeTab, setActiveTab] = useState("contacts");
  const [metaDialog, setMetaDialog] = useState(false);
  const [metaForm, setMetaForm] = useState<{ tags: string[]; priority: string; temperature: string; next_action_date: string; next_action_description: string; last_contact_date: string }>({ tags: [], priority: "medium", temperature: "warm", next_action_date: "", next_action_description: "", last_contact_date: "" });
  const [customTagInput, setCustomTagInput] = useState("");
  const [filterTag, setFilterTag] = useState<string>("");
  const [filterTemperature, setFilterTemperature] = useState<string>("");

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

  // Save meta mutation (tags, priority, temperature, next action)
  const saveMetaMutation = useMutation({
    mutationFn: async (payload: { contactId: string; tags: string[]; priority: string; temperature: string; next_action_date: string | null; next_action_description: string | null; last_contact_date: string | null }) => {
      const existing = allMeta.find(m => m.contact_id === payload.contactId);
      const data = {
        tags: payload.tags,
        priority: payload.priority,
        temperature: payload.temperature,
        next_action_date: payload.next_action_date || null,
        next_action_description: payload.next_action_description || null,
        last_contact_date: payload.last_contact_date || null,
        updated_at: new Date().toISOString(),
      };
      if (existing) {
        const { error } = await supabase.from("commercial_contact_meta").update(data).eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("commercial_contact_meta").insert({ contact_id: payload.contactId, ...data });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["commercial-contact-meta"] });
      setMetaDialog(false);
      toast({ title: "Informações salvas!" });
    },
    onError: (error: any) => {
      toast({ title: "Erro ao salvar", description: error?.message, variant: "destructive" });
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
      next.has(phaseId) ? next.delete(phaseId) : next.add(phaseId);
      return next;
    });
  };

  const expandAll = () => setExpandedPhases(new Set(phases.map(p => p.id)));
  const collapseAll = () => setExpandedPhases(new Set());

  const openMetaDialog = (contact: Contact) => {
    const meta = getContactMeta(contact.id);
    setMetaForm({
      tags: meta?.tags || [],
      priority: meta?.priority || "medium",
      temperature: meta?.temperature || "warm",
      next_action_date: meta?.next_action_date || "",
      next_action_description: meta?.next_action_description || "",
      last_contact_date: meta?.last_contact_date || "",
    });
    setCustomTagInput("");
    setMetaDialog(true);
  };

  const addTag = (tag: string) => {
    if (!metaForm.tags.includes(tag)) {
      setMetaForm(prev => ({ ...prev, tags: [...prev.tags, tag] }));
    }
  };

  const removeTag = (tag: string) => {
    setMetaForm(prev => ({ ...prev, tags: prev.tags.filter(t => t !== tag) }));
  };

  const addCustomTag = () => {
    const tag = customTagInput.trim();
    if (tag && !metaForm.tags.includes(tag)) {
      setMetaForm(prev => ({ ...prev, tags: [...prev.tags, tag] }));
      setCustomTagInput("");
    }
  };

  // All unique tags used across contacts (for filter dropdown)
  const allUsedTags = useMemo(() => {
    const tags = new Set<string>();
    allMeta.forEach(m => m.tags?.forEach(t => tags.add(t)));
    return Array.from(tags).sort();
  }, [allMeta]);

  const filteredContacts = useMemo(() => {
    return contacts.filter(c => {
      const matchesSearch = !searchQuery ||
        c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.company?.toLowerCase().includes(searchQuery.toLowerCase());
      const meta = getContactMeta(c.id);
      const matchesTag = !filterTag || (meta?.tags || []).includes(filterTag);
      const matchesTemp = !filterTemperature || (meta?.temperature || "warm") === filterTemperature;
      return matchesSearch && matchesTag && matchesTemp;
    });
  }, [contacts, searchQuery, filterTag, filterTemperature, allMeta]);

  const activeContacts = contacts.filter(c => { const p = getContactProgress(c.id); return p > 0 && p < 100; }).length;
  const completedContacts = contacts.filter(c => getContactProgress(c.id) === 100).length;
  const avgProgress = contacts.length > 0 ? Math.round(contacts.reduce((sum, c) => sum + getContactProgress(c.id), 0) / contacts.length) : 0;

  // Check for contacts with overdue next actions
  const overdueCount = useMemo(() => {
    const today = new Date().toISOString().split("T")[0];
    return allMeta.filter(m => m.next_action_date && m.next_action_date < today).length;
  }, [allMeta]);

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
    const meta = getContactMeta(selectedContact.id);
    const tempConfig = temperatureConfig[meta?.temperature || "warm"] || temperatureConfig.warm;
    const TempIcon = tempConfig.icon;
    const prioConfig = priorityConfig[meta?.priority || "medium"] || priorityConfig.medium;
    const today = new Date().toISOString().split("T")[0];
    const isOverdue = meta?.next_action_date && meta.next_action_date < today;

    return (
      <EMSLayout>
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4 sm:space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
            <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl shrink-0 self-start" onClick={() => setSelectedContact(null)}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl sm:text-2xl md:text-3xl font-heading font-bold text-foreground truncate">{selectedContact.name}</h1>
                <Badge variant="outline" className={cn("text-[10px] sm:text-xs", tempConfig.bg, tempConfig.color)}>
                  <TempIcon className="h-3 w-3 mr-1" />{tempConfig.label}
                </Badge>
                <Badge variant="outline" className={cn("text-[10px] sm:text-xs", prioConfig.color, prioConfig.border)}>
                  {prioConfig.label}
                </Badge>
              </div>
              <div className="flex flex-wrap gap-2 sm:gap-3 text-xs sm:text-sm text-muted-foreground mt-1">
                {selectedContact.company && <span className="flex items-center gap-1"><Building2 className="h-3 w-3" />{selectedContact.company}</span>}
                {selectedContact.email && <span className="flex items-center gap-1 truncate max-w-[180px] sm:max-w-none"><Mail className="h-3 w-3" />{selectedContact.email}</span>}
                {selectedContact.phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{selectedContact.phone}</span>}
              </div>
              {/* Tags */}
              {meta?.tags && meta.tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {meta.tags.map(tag => (
                    <Badge key={tag} variant="outline" className={cn("text-[10px] sm:text-xs", getTagColor(tag))}>
                      <Tag className="h-2.5 w-2.5 mr-1" />{tag}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
            <div className="flex flex-wrap gap-2 self-start sm:self-auto">
              <Button variant="outline" size="sm" className="rounded-xl text-xs" onClick={() => openMetaDialog(selectedContact)}>
                <Tag className="h-3.5 w-3.5 mr-1" />Tags
              </Button>
              <Button variant="outline" size="sm" className="rounded-xl text-xs" onClick={expandAll}>Expandir Tudo</Button>
              <Button variant="outline" size="sm" className="rounded-xl text-xs" onClick={collapseAll}>Recolher</Button>
            </div>
          </div>

          {/* Next Action Alert */}
          {meta?.next_action_date && (
            <Card className={cn("border", isOverdue ? "border-red-500/30 bg-red-500/5" : "border-primary/20 bg-primary/5")}>
              <CardContent className="p-3 sm:p-4 flex items-center gap-3">
                {isOverdue ? (
                  <AlertTriangle className="h-5 w-5 text-red-500 shrink-0" />
                ) : (
                  <CalendarClock className="h-5 w-5 text-primary shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <p className={cn("text-sm font-medium", isOverdue ? "text-red-500" : "text-foreground")}>
                    {isOverdue ? "Ação atrasada" : "Próxima ação"}:{" "}
                    <span className="font-bold">
                      {new Date(meta.next_action_date + "T12:00:00").toLocaleDateString("pt-BR")}
                    </span>
                  </p>
                  {meta.next_action_description && (
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">{meta.next_action_description}</p>
                  )}
                </div>
                {meta.last_contact_date && (
                  <span className="text-[10px] sm:text-xs text-muted-foreground shrink-0">
                    Último contato: {new Date(meta.last_contact_date + "T12:00:00").toLocaleDateString("pt-BR")}
                  </span>
                )}
              </CardContent>
            </Card>
          )}

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

        {/* Note Dialog */}
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

        {/* Meta Dialog (Tags, Priority, Temperature, Next Action) */}
        <Dialog open={metaDialog} onOpenChange={setMetaDialog}>
          <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2"><Tag className="h-5 w-5" /> Informações do Contato</DialogTitle>
            </DialogHeader>
            <div className="space-y-5 mt-2">
              {/* Tags */}
              <div>
                <label className="text-sm font-medium mb-2 block">Tags</label>
                {metaForm.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {metaForm.tags.map(tag => (
                      <Badge key={tag} variant="outline" className={cn("text-xs gap-1 cursor-pointer hover:opacity-70", getTagColor(tag))} onClick={() => removeTag(tag)}>
                        {tag} <X className="h-3 w-3" />
                      </Badge>
                    ))}
                  </div>
                )}
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {PREDEFINED_TAGS.filter(t => !metaForm.tags.includes(t.label)).map(tag => (
                    <Badge
                      key={tag.label}
                      variant="outline"
                      className={cn("text-[10px] sm:text-xs cursor-pointer hover:opacity-80 transition-opacity", tag.color)}
                      onClick={() => addTag(tag.label)}
                    >
                      <Plus className="h-2.5 w-2.5 mr-0.5" />{tag.label}
                    </Badge>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Input
                    value={customTagInput}
                    onChange={(e) => setCustomTagInput(e.target.value)}
                    placeholder="Tag personalizada..."
                    className="text-sm"
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCustomTag(); } }}
                  />
                  <Button variant="outline" size="sm" className="shrink-0" onClick={addCustomTag} disabled={!customTagInput.trim()}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Priority & Temperature */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">Prioridade</label>
                  <Select value={metaForm.priority} onValueChange={(v) => setMetaForm(prev => ({ ...prev, priority: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="high">Alta</SelectItem>
                      <SelectItem value="medium">Média</SelectItem>
                      <SelectItem value="low">Baixa</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium mb-2 block">Temperatura</label>
                  <Select value={metaForm.temperature} onValueChange={(v) => setMetaForm(prev => ({ ...prev, temperature: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="hot">Quente</SelectItem>
                      <SelectItem value="warm">Morno</SelectItem>
                      <SelectItem value="cold">Frio</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Dates */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">Último Contato</label>
                  <Input
                    type="date"
                    value={metaForm.last_contact_date}
                    onChange={(e) => setMetaForm(prev => ({ ...prev, last_contact_date: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-2 block">Próxima Ação</label>
                  <Input
                    type="date"
                    value={metaForm.next_action_date}
                    onChange={(e) => setMetaForm(prev => ({ ...prev, next_action_date: e.target.value }))}
                  />
                </div>
              </div>

              {/* Next action description */}
              <div>
                <label className="text-sm font-medium mb-2 block">Descrição da Próxima Ação</label>
                <Input
                  value={metaForm.next_action_description}
                  onChange={(e) => setMetaForm(prev => ({ ...prev, next_action_description: e.target.value }))}
                  placeholder="Ex: Enviar proposta, agendar reunião..."
                />
              </div>
            </div>

            <DialogFooter className="flex-col sm:flex-row gap-2 sm:gap-0 mt-4">
              <Button variant="outline" className="rounded-xl w-full sm:w-auto" onClick={() => setMetaDialog(false)}>Cancelar</Button>
              <Button
                className="rounded-xl shadow-lg hover:shadow-primary transition-all duration-300 w-full sm:w-auto gap-2"
                onClick={() => saveMetaMutation.mutate({
                  contactId: selectedContact.id,
                  tags: metaForm.tags,
                  priority: metaForm.priority,
                  temperature: metaForm.temperature,
                  next_action_date: metaForm.next_action_date || null,
                  next_action_description: metaForm.next_action_description || null,
                  last_contact_date: metaForm.last_contact_date || null,
                })}
                disabled={saveMetaMutation.isPending}
              >
                <Save className="h-4 w-4" />
                {saveMetaMutation.isPending ? "Salvando..." : "Salvar"}
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
            { label: "Ações Atrasadas", value: overdueCount, icon: AlertTriangle, color: overdueCount > 0 ? "text-red-500" : "text-blue-400", bg: overdueCount > 0 ? "bg-red-500/10" : "bg-blue-500/10", border: overdueCount > 0 ? "border-red-500/20" : "border-blue-500/20" },
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
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="contacts" className="gap-1.5"><Users className="h-4 w-4" /><span className="hidden sm:inline">Contatos</span></TabsTrigger>
            <TabsTrigger value="pipeline" className="gap-1.5"><Kanban className="h-4 w-4" /><span className="hidden sm:inline">Pipeline</span></TabsTrigger>
            <TabsTrigger value="reports" className="gap-1.5"><BarChart3 className="h-4 w-4" /><span className="hidden sm:inline">Relatórios</span></TabsTrigger>
            <TabsTrigger value="manage" className="gap-1.5"><Settings2 className="h-4 w-4" /><span className="hidden sm:inline">Gerenciar</span></TabsTrigger>
          </TabsList>

          <TabsContent value="contacts" className="mt-4 space-y-4">
            {/* Search & Filters */}
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Buscar contatos..." className="pl-10" />
              </div>
              <div className="flex gap-2">
                <Select value={filterTag} onValueChange={(v) => setFilterTag(v === "all" ? "" : v)}>
                  <SelectTrigger className="w-[160px] sm:w-[180px]">
                    <div className="flex items-center gap-1.5 truncate">
                      <Tag className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">{filterTag || "Todas as tags"}</span>
                    </div>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas as tags</SelectItem>
                    {allUsedTags.map(tag => (
                      <SelectItem key={tag} value={tag}>{tag}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={filterTemperature} onValueChange={(v) => setFilterTemperature(v === "all" ? "" : v)}>
                  <SelectTrigger className="w-[130px] sm:w-[150px]">
                    <div className="flex items-center gap-1.5 truncate">
                      <Thermometer className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">{filterTemperature ? temperatureConfig[filterTemperature]?.label : "Temperatura"}</span>
                    </div>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas</SelectItem>
                    <SelectItem value="hot">Quente</SelectItem>
                    <SelectItem value="warm">Morno</SelectItem>
                    <SelectItem value="cold">Frio</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Active filters */}
            {(filterTag || filterTemperature) && (
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs text-muted-foreground">Filtros:</span>
                {filterTag && (
                  <Badge variant="outline" className={cn("text-xs gap-1 cursor-pointer hover:opacity-70", getTagColor(filterTag))} onClick={() => setFilterTag("")}>
                    {filterTag} <X className="h-3 w-3" />
                  </Badge>
                )}
                {filterTemperature && (
                  <Badge variant="outline" className={cn("text-xs gap-1 cursor-pointer hover:opacity-70", temperatureConfig[filterTemperature]?.bg || "")} onClick={() => setFilterTemperature("")}>
                    {temperatureConfig[filterTemperature]?.label} <X className="h-3 w-3" />
                  </Badge>
                )}
              </div>
            )}

            <div className="space-y-3">
              {filteredContacts.length === 0 ? (
                <Card className="border-dashed border-primary/20">
                  <CardContent className="py-16 text-center">
                    <div className="inline-flex p-4 rounded-2xl bg-primary/10 mb-4"><Users className="h-10 w-10 text-primary/60" /></div>
                    <p className="text-muted-foreground text-lg font-medium">Nenhum contato encontrado</p>
                    <p className="text-muted-foreground/60 text-sm mt-1">
                      {contacts.length === 0 ? "Crie contatos na página de Contatos para começar" : "Tente ajustar os filtros"}
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <AnimatePresence>
                  {filteredContacts.map(contact => {
                    const progress = getContactProgress(contact.id);
                    const contactTrackingData = allTracking.filter(t => t.contact_id === contact.id);
                    const completed = contactTrackingData.filter(t => t.status === "completed").length;
                    const inProg = contactTrackingData.filter(t => t.status === "in_progress").length;
                    const meta = getContactMeta(contact.id);
                    const tempConf = temperatureConfig[meta?.temperature || "warm"] || temperatureConfig.warm;
                    const TIcon = tempConf.icon;
                    const todayStr = new Date().toISOString().split("T")[0];
                    const hasOverdue = meta?.next_action_date && meta.next_action_date < todayStr;

                    return (
                      <motion.div key={contact.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                        <Card
                          className={cn(
                            "hover:border-primary/30 transition-all duration-300 hover:shadow-md hover:shadow-primary/5 cursor-pointer",
                            hasOverdue && "border-red-500/20"
                          )}
                          onClick={() => { setSelectedContact(contact); setExpandedPhases(new Set()); }}
                        >
                          <CardContent className="p-4 sm:p-5">
                            <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1 flex-wrap">
                                  <h3 className="font-semibold text-sm sm:text-base">{contact.name}</h3>
                                  {contact.company && <Badge variant="outline" className="text-[10px] sm:text-xs truncate max-w-[140px]"><Building2 className="h-3 w-3 mr-1" />{contact.company}</Badge>}
                                  <Badge variant="outline" className={cn("text-[10px]", tempConf.bg, tempConf.color)}>
                                    <TIcon className="h-2.5 w-2.5 mr-0.5" />{tempConf.label}
                                  </Badge>
                                  {hasOverdue && (
                                    <Badge variant="outline" className="text-[10px] bg-red-500/10 text-red-500 border-red-500/30">
                                      <AlertTriangle className="h-2.5 w-2.5 mr-0.5" />Atrasado
                                    </Badge>
                                  )}
                                </div>
                                {/* Tags row */}
                                {meta?.tags && meta.tags.length > 0 && (
                                  <div className="flex flex-wrap gap-1 mb-1">
                                    {meta.tags.slice(0, 4).map(tag => (
                                      <Badge key={tag} variant="outline" className={cn("text-[9px] sm:text-[10px]", getTagColor(tag))}>
                                        {tag}
                                      </Badge>
                                    ))}
                                    {meta.tags.length > 4 && (
                                      <Badge variant="outline" className="text-[9px] sm:text-[10px]">+{meta.tags.length - 4}</Badge>
                                    )}
                                  </div>
                                )}
                                <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                                  {contact.email && <span className="flex items-center gap-1 truncate max-w-[180px] sm:max-w-none"><Mail className="h-3 w-3" />{contact.email}</span>}
                                  {contact.phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{contact.phone}</span>}
                                  {meta?.next_action_date && (
                                    <span className={cn("flex items-center gap-1", hasOverdue ? "text-red-500" : "")}>
                                      <CalendarClock className="h-3 w-3" />
                                      {new Date(meta.next_action_date + "T12:00:00").toLocaleDateString("pt-BR")}
                                    </span>
                                  )}
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

          <TabsContent value="reports" className="mt-4">
            <FunnelReports />
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
