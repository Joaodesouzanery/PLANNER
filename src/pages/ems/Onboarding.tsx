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
import { motion, AnimatePresence } from "framer-motion";
import {
  Search, Users, ChevronDown, ChevronRight, CheckCircle2, Clock, Circle,
  ArrowLeft, FileText, CreditCard, Mail, Phone, Rocket, Building2,
  Save, Send, FileCheck, Eye, Upload, MessageSquare, Target,
  ClipboardList, AlertTriangle, CalendarClock, X, Kanban, GripVertical
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";

interface OnboardingStep {
  id: string;
  title: string;
  description: string | null;
  icon: string;
  order_index: number;
}

interface OnboardingDocument {
  id: string;
  step_id: string;
  title: string;
  description: string | null;
  document_url: string | null;
  template_url: string | null;
  order_index: number;
}

interface StepTracking {
  id: string;
  contact_id: string;
  step_id: string;
  status: string;
  notes: string | null;
  completed_at: string | null;
}

interface DocTracking {
  id: string;
  contact_id: string;
  document_id: string;
  status: string;
  sent_at: string | null;
  received_at: string | null;
  signed_at: string | null;
  file_url: string | null;
  notes: string | null;
}

interface Contact {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  pipeline_stage: string | null;
}

const stepIcons: Record<string, typeof FileText> = {
  "file-text": FileText,
  "credit-card": CreditCard,
  mail: Mail,
  phone: Phone,
  rocket: Rocket,
};

const stepColors = [
  { gradient: "from-blue-500/20 to-blue-600/5", border: "border-blue-500/30", icon: "text-blue-500", bg: "bg-blue-500/10" },
  { gradient: "from-emerald-500/20 to-emerald-600/5", border: "border-emerald-500/30", icon: "text-emerald-500", bg: "bg-emerald-500/10" },
  { gradient: "from-purple-500/20 to-purple-600/5", border: "border-purple-500/30", icon: "text-purple-500", bg: "bg-purple-500/10" },
  { gradient: "from-amber-500/20 to-amber-600/5", border: "border-amber-500/30", icon: "text-amber-500", bg: "bg-amber-500/10" },
  { gradient: "from-pink-500/20 to-pink-600/5", border: "border-pink-500/30", icon: "text-pink-500", bg: "bg-pink-500/10" },
];

const docStatusConfig: Record<string, { label: string; color: string; bg: string; icon: typeof Circle; border: string }> = {
  not_sent: { label: "Não Enviado", color: "text-muted-foreground", bg: "bg-muted/50", icon: Circle, border: "border-muted" },
  sent: { label: "Enviado", color: "text-blue-500", bg: "bg-blue-500/10", icon: Send, border: "border-blue-500/30" },
  received: { label: "Recebido", color: "text-amber-500", bg: "bg-amber-500/10", icon: Eye, border: "border-amber-500/30" },
  signed: { label: "Assinado", color: "text-emerald-500", bg: "bg-emerald-500/10", icon: FileCheck, border: "border-emerald-500/30" },
};

const stepStatusConfig: Record<string, { label: string; color: string; bg: string }> = {
  pending: { label: "Pendente", color: "text-muted-foreground", bg: "bg-muted/50" },
  in_progress: { label: "Em Andamento", color: "text-amber-500", bg: "bg-amber-500/10" },
  completed: { label: "Concluído", color: "text-emerald-500", bg: "bg-emerald-500/10" },
};

const Onboarding = () => {
  const queryClient = useQueryClient();
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedSteps, setExpandedSteps] = useState<Set<string>>(new Set());
  const [noteDialog, setNoteDialog] = useState<{ open: boolean; docId: string; currentNote: string }>({ open: false, docId: "", currentNote: "" });
  const [noteText, setNoteText] = useState("");
  const [activeTab, setActiveTab] = useState("contacts");

  // Fetch steps
  const { data: steps = [] } = useQuery({
    queryKey: ["onboarding-steps"],
    queryFn: async () => {
      const { data, error } = await supabase.from("onboarding_steps").select("*").order("order_index");
      if (error) throw error;
      return data as OnboardingStep[];
    },
  });

  // Fetch documents
  const { data: documents = [] } = useQuery({
    queryKey: ["onboarding-documents"],
    queryFn: async () => {
      const { data, error } = await supabase.from("onboarding_documents").select("*").order("order_index");
      if (error) throw error;
      return data as OnboardingDocument[];
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

  // Fetch step tracking for selected contact
  const { data: stepTracking = [] } = useQuery({
    queryKey: ["onboarding-step-tracking", selectedContact?.id],
    queryFn: async () => {
      if (!selectedContact) return [];
      const { data, error } = await supabase.from("contact_onboarding_tracking").select("*").eq("contact_id", selectedContact.id);
      if (error) throw error;
      return data as StepTracking[];
    },
    enabled: !!selectedContact,
  });

  // Fetch doc tracking for selected contact
  const { data: docTracking = [] } = useQuery({
    queryKey: ["onboarding-doc-tracking", selectedContact?.id],
    queryFn: async () => {
      if (!selectedContact) return [];
      const { data, error } = await supabase.from("contact_onboarding_documents").select("*").eq("contact_id", selectedContact.id);
      if (error) throw error;
      return data as DocTracking[];
    },
    enabled: !!selectedContact,
  });

  // Fetch ALL step tracking for overview
  const { data: allStepTracking = [] } = useQuery({
    queryKey: ["onboarding-step-tracking-all"],
    queryFn: async () => {
      const { data, error } = await supabase.from("contact_onboarding_tracking").select("*");
      if (error) throw error;
      return data as StepTracking[];
    },
  });

  const getStepStatus = (stepId: string) => {
    return stepTracking.find(t => t.step_id === stepId)?.status || "pending";
  };

  const getDocStatus = (docId: string) => {
    return docTracking.find(t => t.document_id === docId)?.status || "not_sent";
  };

  const getDocNote = (docId: string) => {
    return docTracking.find(t => t.document_id === docId)?.notes || "";
  };

  const getContactProgress = (contactId: string) => {
    const contactSteps = allStepTracking.filter(t => t.contact_id === contactId);
    const total = steps.length;
    if (total === 0) return 0;
    const completed = contactSteps.filter(t => t.status === "completed").length;
    return Math.round((completed / total) * 100);
  };

  const getStepProgress = (stepId: string) => {
    const stepDocs = documents.filter(d => d.step_id === stepId);
    if (stepDocs.length === 0) return 0;
    const completed = stepDocs.filter(d => getDocStatus(d.id) === "signed").length;
    return Math.round((completed / stepDocs.length) * 100);
  };

  // Cycle doc status: not_sent -> sent -> received -> signed -> not_sent
  const cycleDocStatusMutation = useMutation({
    mutationFn: async ({ docId, newStatus }: { docId: string; newStatus: string }) => {
      if (!selectedContact) return;
      const existing = docTracking.find(t => t.document_id === docId);
      const now = new Date().toISOString();
      const timestamps: Record<string, any> = {
        sent_at: newStatus === "sent" || newStatus === "received" || newStatus === "signed" ? now : null,
        received_at: newStatus === "received" || newStatus === "signed" ? now : null,
        signed_at: newStatus === "signed" ? now : null,
      };
      if (existing) {
        const { error } = await supabase.from("contact_onboarding_documents")
          .update({ status: newStatus, ...timestamps, updated_at: now })
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("contact_onboarding_documents")
          .insert({ contact_id: selectedContact.id, document_id: docId, status: newStatus, ...timestamps });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["onboarding-doc-tracking", selectedContact?.id] });
    },
    onError: (e: any) => toast({ title: "Erro ao atualizar", description: e?.message, variant: "destructive" }),
  });

  // Update step status mutation
  const updateStepMutation = useMutation({
    mutationFn: async ({ stepId, status }: { stepId: string; status: string }) => {
      if (!selectedContact) return;
      const existing = stepTracking.find(t => t.step_id === stepId);
      const now = new Date().toISOString();
      if (existing) {
        const { error } = await supabase.from("contact_onboarding_tracking")
          .update({ status, completed_at: status === "completed" ? now : null, updated_at: now })
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("contact_onboarding_tracking")
          .insert({ contact_id: selectedContact.id, step_id: stepId, status, completed_at: status === "completed" ? now : null });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["onboarding-step-tracking", selectedContact?.id] });
      queryClient.invalidateQueries({ queryKey: ["onboarding-step-tracking-all"] });
    },
    onError: (e: any) => toast({ title: "Erro ao atualizar etapa", description: e?.message, variant: "destructive" }),
  });

  // Save doc note mutation
  const saveDocNoteMutation = useMutation({
    mutationFn: async ({ docId, notes }: { docId: string; notes: string }) => {
      if (!selectedContact) return;
      const existing = docTracking.find(t => t.document_id === docId);
      if (existing) {
        const { error } = await supabase.from("contact_onboarding_documents")
          .update({ notes: notes || null, updated_at: new Date().toISOString() })
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("contact_onboarding_documents")
          .insert({ contact_id: selectedContact.id, document_id: docId, status: "not_sent", notes: notes || null });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["onboarding-doc-tracking", selectedContact?.id] });
      setNoteDialog({ open: false, docId: "", currentNote: "" });
      toast({ title: "Nota salva!" });
    },
    onError: (e: any) => toast({ title: "Erro ao salvar nota", description: e?.message, variant: "destructive" }),
  });

  const cycleDocStatus = (docId: string) => {
    const current = getDocStatus(docId);
    const order = ["not_sent", "sent", "received", "signed"];
    const nextIdx = (order.indexOf(current) + 1) % order.length;
    cycleDocStatusMutation.mutate({ docId, newStatus: order[nextIdx] });
  };

  const cycleStepStatus = (stepId: string) => {
    const current = getStepStatus(stepId);
    const order = ["pending", "in_progress", "completed"];
    const nextIdx = (order.indexOf(current) + 1) % order.length;
    updateStepMutation.mutate({ stepId, status: order[nextIdx] });
  };

  const toggleStep = (stepId: string) => {
    setExpandedSteps(prev => {
      const next = new Set(prev);
      next.has(stepId) ? next.delete(stepId) : next.add(stepId);
      return next;
    });
  };

  const expandAll = () => setExpandedSteps(new Set(steps.map(s => s.id)));
  const collapseAll = () => setExpandedSteps(new Set());

  const filteredContacts = contacts.filter(c =>
    !searchQuery || c.name.toLowerCase().includes(searchQuery.toLowerCase()) || c.company?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Overview stats
  const activeOnboarding = contacts.filter(c => { const p = getContactProgress(c.id); return p > 0 && p < 100; }).length;
  const completedOnboarding = contacts.filter(c => getContactProgress(c.id) === 100).length;
  const avgProgress = contacts.length > 0 ? Math.round(contacts.reduce((sum, c) => sum + getContactProgress(c.id), 0) / contacts.length) : 0;

  // Pipeline: determine which step each contact is currently on
  const getContactCurrentStepId = (contactId: string): string => {
    const contactSteps = allStepTracking.filter(t => t.contact_id === contactId);
    // Find the first step that is NOT completed (current step)
    for (const step of steps) {
      const st = contactSteps.find(t => t.step_id === step.id);
      if (!st || st.status !== "completed") return step.id;
    }
    // All completed → put in last step
    return steps.length > 0 ? steps[steps.length - 1].id : "";
  };

  const contactsByStep = useMemo(() => {
    const map: Record<string, Contact[]> = {};
    // Add a "done" column
    steps.forEach(s => { map[s.id] = []; });
    map["__done__"] = [];
    contacts.forEach(c => {
      const progress = getContactProgress(c.id);
      if (progress === 100) {
        map["__done__"].push(c);
      } else {
        const stepId = getContactCurrentStepId(c.id);
        if (stepId && map[stepId]) {
          map[stepId].push(c);
        } else if (steps.length > 0) {
          map[steps[0].id].push(c);
        }
      }
    });
    return map;
  }, [contacts, steps, allStepTracking]);

  // Drag-and-drop: move contact to a step by marking all previous steps as completed
  const moveContactToStepMutation = useMutation({
    mutationFn: async ({ contactId, targetStepId }: { contactId: string; targetStepId: string }) => {
      const now = new Date().toISOString();

      if (targetStepId === "__done__") {
        // Mark all steps as completed
        for (const step of steps) {
          const existing = allStepTracking.find(t => t.contact_id === contactId && t.step_id === step.id);
          if (existing) {
            if (existing.status !== "completed") {
              const { error } = await supabase.from("contact_onboarding_tracking")
                .update({ status: "completed", completed_at: now, updated_at: now })
                .eq("id", existing.id);
              if (error) throw error;
            }
          } else {
            const { error } = await supabase.from("contact_onboarding_tracking")
              .insert({ contact_id: contactId, step_id: step.id, status: "completed", completed_at: now });
            if (error) throw error;
          }
        }
        return;
      }

      const targetIdx = steps.findIndex(s => s.id === targetStepId);
      for (let i = 0; i < steps.length; i++) {
        const step = steps[i];
        const existing = allStepTracking.find(t => t.contact_id === contactId && t.step_id === step.id);
        const newStatus = i < targetIdx ? "completed" : i === targetIdx ? "in_progress" : "pending";
        const completedAt = newStatus === "completed" ? now : null;

        if (existing) {
          const { error } = await supabase.from("contact_onboarding_tracking")
            .update({ status: newStatus, completed_at: completedAt, updated_at: now })
            .eq("id", existing.id);
          if (error) throw error;
        } else if (newStatus !== "pending") {
          const { error } = await supabase.from("contact_onboarding_tracking")
            .insert({ contact_id: contactId, step_id: step.id, status: newStatus, completed_at: completedAt });
          if (error) throw error;
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["onboarding-step-tracking-all"] });
      queryClient.invalidateQueries({ queryKey: ["onboarding-step-tracking", selectedContact?.id] });
    },
    onError: (e: any) => toast({ title: "Erro ao mover contato", description: e?.message, variant: "destructive" }),
  });

  const onDragEnd = (result: DropResult) => {
    if (!result.destination) return;
    const contactId = result.draggableId;
    const targetStepId = result.destination.droppableId;
    if (result.source.droppableId === targetStepId) return;
    moveContactToStepMutation.mutate({ contactId, targetStepId });
  };

  // ============= CONTACT DETAIL VIEW =============
  if (selectedContact) {
    const completedSteps = steps.filter(s => getStepStatus(s.id) === "completed").length;
    const inProgressSteps = steps.filter(s => getStepStatus(s.id) === "in_progress").length;
    const overallProgress = steps.length > 0 ? Math.round((completedSteps / steps.length) * 100) : 0;

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

          {/* Progress Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: "Progresso", value: `${overallProgress}%`, icon: Target, color: "text-primary", bg: "bg-primary/10", border: "border-primary/20" },
              { label: "Concluídos", value: completedSteps, icon: CheckCircle2, color: "text-emerald-500", bg: "bg-emerald-500/10", border: "border-emerald-500/20" },
              { label: "Em Andamento", value: inProgressSteps, icon: Clock, color: "text-amber-500", bg: "bg-amber-500/10", border: "border-amber-500/20" },
              { label: "Total Etapas", value: steps.length, icon: ClipboardList, color: "text-blue-400", bg: "bg-blue-500/10", border: "border-blue-500/20" },
            ].map(s => (
              <Card key={s.label} className={cn("border", s.border)}>
                <CardContent className="p-3 sm:p-4 flex items-center gap-2.5 sm:gap-3">
                  <div className={cn("p-1.5 sm:p-2 rounded-lg", s.bg)}><s.icon className={cn("h-4 w-4 sm:h-5 sm:w-5", s.color)} /></div>
                  <div><p className="text-lg sm:text-2xl font-bold">{s.value}</p><p className="text-[10px] sm:text-xs text-muted-foreground">{s.label}</p></div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Overall progress bar */}
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Progresso do Onboarding</span>
                <span className="text-sm font-bold text-primary">{overallProgress}%</span>
              </div>
              <Progress value={overallProgress} className="h-3" />
            </CardContent>
          </Card>

          {/* Steps Pipeline */}
          <div className="space-y-3">
            {steps.map((step, idx) => {
              const isExpanded = expandedSteps.has(step.id);
              const stepDocs = documents.filter(d => d.step_id === step.id).sort((a, b) => a.order_index - b.order_index);
              const stepProgress = getStepProgress(step.id);
              const sStatus = getStepStatus(step.id);
              const sConfig = stepStatusConfig[sStatus] || stepStatusConfig.pending;
              const StepIcon = stepIcons[step.icon] || FileText;
              const colors = stepColors[idx % stepColors.length];

              return (
                <Card key={step.id} className={cn("border overflow-hidden", isExpanded && "ring-1 ring-primary/20")}>
                  {/* Step Header */}
                  <div
                    className={cn("flex items-center gap-3 p-3 sm:p-4 cursor-pointer hover:bg-muted/30 transition-colors bg-gradient-to-r", colors.gradient, colors.border)}
                    onClick={() => toggleStep(step.id)}
                  >
                    <div className={cn("p-1.5 sm:p-2 rounded-lg bg-background/80 shrink-0")}>
                      <StepIcon className={cn("h-4 w-4 sm:h-5 sm:w-5", colors.icon)} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[10px] sm:text-xs font-bold text-muted-foreground">ETAPA {idx + 1}</span>
                        <Badge
                          variant="outline"
                          className={cn("text-[10px] cursor-pointer hover:opacity-80", sConfig.bg, sConfig.color)}
                          onClick={(e) => { e.stopPropagation(); cycleStepStatus(step.id); }}
                        >
                          {sConfig.label}
                        </Badge>
                      </div>
                      <h3 className="font-semibold text-sm sm:text-base truncate">{step.title}</h3>
                    </div>
                    <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                      <p className="text-sm font-bold hidden sm:block">{stepProgress}%</p>
                      <div className="w-16 sm:w-24 hidden sm:block"><Progress value={stepProgress} className="h-2" /></div>
                      <span className="text-sm font-bold sm:hidden">{stepProgress}%</span>
                      {isExpanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                    </div>
                  </div>

                  {/* Step Content - Documents */}
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                      >
                        <CardContent className="p-2 sm:p-4 pt-2 space-y-1">
                          {step.description && (
                            <p className="text-xs text-muted-foreground px-2 sm:px-3 py-1.5 mb-2">{step.description}</p>
                          )}

                          {stepDocs.length === 0 ? (
                            <p className="text-xs text-muted-foreground text-center py-4">Nenhum documento configurado</p>
                          ) : (
                            stepDocs.map(doc => {
                              const dStatus = getDocStatus(doc.id);
                              const dConfig = docStatusConfig[dStatus] || docStatusConfig.not_sent;
                              const DIcon = dConfig.icon;
                              const note = getDocNote(doc.id);

                              return (
                                <div
                                  key={doc.id}
                                  className="flex items-center gap-2 sm:gap-3 py-2.5 px-2 sm:px-3 rounded-lg hover:bg-muted/50 transition-all duration-200 cursor-pointer group"
                                  onClick={() => cycleDocStatus(doc.id)}
                                >
                                  <button
                                    className={cn("p-1 rounded-md transition-colors shrink-0", dConfig.bg)}
                                    onClick={(e) => { e.stopPropagation(); cycleDocStatus(doc.id); }}
                                  >
                                    <DIcon className={cn("h-4 w-4 sm:h-5 sm:w-5", dConfig.color)} />
                                  </button>

                                  <div className="flex-1 min-w-0">
                                    <p className={cn(
                                      "text-xs sm:text-sm font-medium truncate",
                                      dStatus === "signed" && "line-through text-muted-foreground"
                                    )}>
                                      {doc.title}
                                    </p>
                                    {doc.description && (
                                      <p className="text-[10px] sm:text-xs text-muted-foreground truncate mt-0.5">{doc.description}</p>
                                    )}
                                  </div>

                                  <div className="flex items-center gap-1.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Badge variant="outline" className={cn("text-[10px] hidden sm:flex", dConfig.border, dConfig.color)}>
                                      {dConfig.label}
                                    </Badge>
                                    {doc.template_url && (
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-6 w-6 sm:h-7 sm:w-7"
                                        onClick={(e) => { e.stopPropagation(); window.open(doc.template_url!, "_blank"); }}
                                      >
                                        <Upload className="h-3 w-3 text-muted-foreground" />
                                      </Button>
                                    )}
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-6 w-6 sm:h-7 sm:w-7"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setNoteText(note);
                                        setNoteDialog({ open: true, docId: doc.id, currentNote: note });
                                      }}
                                    >
                                      <MessageSquare className={cn("h-3 w-3 sm:h-3.5 sm:w-3.5", note ? "text-primary" : "text-muted-foreground")} />
                                    </Button>
                                  </div>
                                </div>
                              );
                            })
                          )}
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
        <Dialog open={noteDialog.open} onOpenChange={(open) => { if (!open) setNoteDialog({ open: false, docId: "", currentNote: "" }); }}>
          <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
            <DialogHeader><DialogTitle>Nota do Documento</DialogTitle></DialogHeader>
            <Textarea value={noteText} onChange={(e) => setNoteText(e.target.value)} placeholder="Adicione observações sobre este documento..." rows={4} className="mt-2" />
            <DialogFooter className="flex-col sm:flex-row gap-2 sm:gap-0">
              <Button variant="outline" className="rounded-xl w-full sm:w-auto" onClick={() => setNoteDialog({ open: false, docId: "", currentNote: "" })}>Cancelar</Button>
              <Button
                className="rounded-xl gap-2 w-full sm:w-auto"
                onClick={() => saveDocNoteMutation.mutate({ docId: noteDialog.docId, notes: noteText })}
                disabled={saveDocNoteMutation.isPending}
              >
                <Save className="h-4 w-4" />{saveDocNoteMutation.isPending ? "Salvando..." : "Salvar Nota"}
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
            <h1 className="text-2xl md:text-3xl font-heading font-bold text-foreground">Onboarding</h1>
            <p className="text-sm md:text-base text-muted-foreground mt-1">Acompanhe o onboarding de cada cliente passo a passo</p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Total Clientes", value: contacts.length, icon: Users, color: "text-primary", bg: "bg-primary/10", border: "border-primary/20" },
            { label: "Em Onboarding", value: activeOnboarding, icon: Clock, color: "text-amber-500", bg: "bg-amber-500/10", border: "border-amber-500/20" },
            { label: "Concluídos", value: completedOnboarding, icon: CheckCircle2, color: "text-emerald-500", bg: "bg-emerald-500/10", border: "border-emerald-500/20" },
            { label: "Progresso Médio", value: `${avgProgress}%`, icon: Target, color: "text-blue-400", bg: "bg-blue-500/10", border: "border-blue-500/20" },
          ].map(s => (
            <Card key={s.label} className={cn("border transition-all duration-300 hover:scale-[1.02]", s.border)}>
              <CardContent className="p-3 sm:p-4 flex items-center gap-2.5 sm:gap-3">
                <div className={cn("p-1.5 sm:p-2 rounded-lg", s.bg)}><s.icon className={cn("h-4 w-4 sm:h-5 sm:w-5", s.color)} /></div>
                <div><p className="text-xl sm:text-2xl font-bold">{s.value}</p><p className="text-[10px] sm:text-xs text-muted-foreground">{s.label}</p></div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Tabs: Contacts + Pipeline */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="contacts" className="gap-1.5"><Users className="h-4 w-4" /><span className="hidden sm:inline">Contatos</span></TabsTrigger>
            <TabsTrigger value="pipeline" className="gap-1.5"><Kanban className="h-4 w-4" /><span className="hidden sm:inline">Pipeline</span></TabsTrigger>
          </TabsList>

          {/* Contacts Tab */}
          <TabsContent value="contacts" className="mt-4 space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Buscar clientes..." className="pl-10" />
            </div>

            <div className="space-y-3">
              {filteredContacts.length === 0 ? (
                <Card className="border-dashed border-primary/20">
                  <CardContent className="py-16 text-center">
                    <div className="inline-flex p-4 rounded-2xl bg-primary/10 mb-4"><Users className="h-10 w-10 text-primary/60" /></div>
                    <p className="text-muted-foreground text-lg font-medium">Nenhum cliente encontrado</p>
                    <p className="text-muted-foreground/60 text-sm mt-1">Crie contatos na página de Contatos para começar</p>
                  </CardContent>
                </Card>
              ) : (
                <AnimatePresence>
                  {filteredContacts.map(contact => {
                    const progress = getContactProgress(contact.id);
                    const contactSteps = allStepTracking.filter(t => t.contact_id === contact.id);
                    const completed = contactSteps.filter(t => t.status === "completed").length;
                    const inProg = contactSteps.filter(t => t.status === "in_progress").length;

                    const currentStep = steps.find(s => {
                      const st = contactSteps.find(t => t.step_id === s.id);
                      return !st || st.status !== "completed";
                    });

                    return (
                      <motion.div key={contact.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                        <Card
                          className="hover:border-primary/30 transition-all duration-300 hover:shadow-md hover:shadow-primary/5 cursor-pointer"
                          onClick={() => { setSelectedContact(contact); setExpandedSteps(new Set()); }}
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
                                  {currentStep && (
                                    <Badge variant="outline" className="text-[10px] sm:text-xs bg-primary/10 text-primary border-primary/30">
                                      <ClipboardList className="h-2.5 w-2.5 mr-0.5" />{currentStep.title}
                                    </Badge>
                                  )}
                                </div>
                                <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                                  {contact.email && <span className="flex items-center gap-1 truncate max-w-[180px] sm:max-w-none"><Mail className="h-3 w-3" />{contact.email}</span>}
                                  {contact.phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{contact.phone}</span>}
                                </div>
                              </div>

                              <div className="flex items-center gap-3 sm:gap-4 shrink-0">
                                <div className="flex items-center gap-1">
                                  {steps.map((s) => {
                                    const st = contactSteps.find(t => t.step_id === s.id);
                                    const status = st?.status || "pending";
                                    return (
                                      <div
                                        key={s.id}
                                        className={cn(
                                          "h-2 w-2 sm:h-2.5 sm:w-2.5 rounded-full transition-colors",
                                          status === "completed" ? "bg-emerald-500" :
                                          status === "in_progress" ? "bg-amber-500" :
                                          "bg-muted-foreground/30"
                                        )}
                                        title={`${s.title}: ${stepStatusConfig[status]?.label || "Pendente"}`}
                                      />
                                    );
                                  })}
                                </div>
                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                  <span className="flex items-center gap-1"><CheckCircle2 className="h-3 w-3 text-emerald-500" />{completed}</span>
                                  <span className="flex items-center gap-1"><Clock className="h-3 w-3 text-amber-500" />{inProg}</span>
                                </div>
                                <div className="flex items-center gap-2 min-w-[80px] sm:min-w-[120px]">
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

          {/* Pipeline Tab */}
          <TabsContent value="pipeline" className="mt-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
              <div>
                <h2 className="text-lg font-heading font-bold text-foreground flex items-center gap-2">
                  <Kanban className="h-5 w-5 text-primary" /> Pipeline de Onboarding
                </h2>
                <p className="text-sm text-muted-foreground">Arraste clientes entre as etapas do onboarding</p>
              </div>

              <DragDropContext onDragEnd={onDragEnd}>
                <div className="flex gap-3 overflow-x-auto pb-4 min-h-[400px]">
                  {/* Step columns */}
                  {steps.map((step, idx) => {
                    const StepIcon = stepIcons[step.icon] || FileText;
                    const colors = stepColors[idx % stepColors.length];
                    const columnContacts = contactsByStep[step.id] || [];

                    return (
                      <Droppable droppableId={step.id} key={step.id}>
                        {(provided, snapshot) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.droppableProps}
                            className={cn(
                              "flex-shrink-0 w-[240px] sm:w-[270px] rounded-xl border bg-card/50 transition-colors",
                              snapshot.isDraggingOver && "border-primary/50 bg-primary/5"
                            )}
                          >
                            {/* Column header */}
                            <div className={cn("p-3 rounded-t-xl bg-gradient-to-r border-b", colors.gradient, colors.border)}>
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-1.5">
                                  <StepIcon className={cn("h-3.5 w-3.5", colors.icon)} />
                                  <Badge variant="outline" className={cn("text-[10px]", colors.icon)}>
                                    Etapa {idx + 1}
                                  </Badge>
                                </div>
                                <Badge variant="secondary" className="text-[10px]">
                                  {columnContacts.length}
                                </Badge>
                              </div>
                              <h3 className="font-semibold text-sm mt-1 truncate">{step.title}</h3>
                            </div>

                            {/* Cards */}
                            <div className="p-2 space-y-2 min-h-[80px]">
                              {columnContacts.map((contact, cIdx) => {
                                const progress = getContactProgress(contact.id);
                                return (
                                  <Draggable draggableId={contact.id} index={cIdx} key={contact.id}>
                                    {(dragProvided, dragSnapshot) => (
                                      <div
                                        ref={dragProvided.innerRef}
                                        {...dragProvided.draggableProps}
                                        {...dragProvided.dragHandleProps}
                                        className={cn(
                                          "rounded-lg border bg-card p-3 cursor-grab active:cursor-grabbing transition-shadow",
                                          dragSnapshot.isDragging && "shadow-lg shadow-primary/10 border-primary/40"
                                        )}
                                        onClick={() => { setSelectedContact(contact); setExpandedSteps(new Set()); }}
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
                    );
                  })}

                  {/* Done column */}
                  <Droppable droppableId="__done__">
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                        className={cn(
                          "flex-shrink-0 w-[240px] sm:w-[270px] rounded-xl border bg-card/50 transition-colors",
                          snapshot.isDraggingOver && "border-emerald-500/50 bg-emerald-500/5"
                        )}
                      >
                        <div className="p-3 rounded-t-xl bg-gradient-to-r from-emerald-500/20 to-emerald-600/5 border-b border-emerald-500/30">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5">
                              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                              <Badge variant="outline" className="text-[10px] text-emerald-500">
                                Concluído
                              </Badge>
                            </div>
                            <Badge variant="secondary" className="text-[10px]">
                              {(contactsByStep["__done__"] || []).length}
                            </Badge>
                          </div>
                          <h3 className="font-semibold text-sm mt-1">Onboarding Completo</h3>
                        </div>
                        <div className="p-2 space-y-2 min-h-[80px]">
                          {(contactsByStep["__done__"] || []).map((contact, cIdx) => (
                            <Draggable draggableId={contact.id} index={cIdx} key={contact.id}>
                              {(dragProvided, dragSnapshot) => (
                                <div
                                  ref={dragProvided.innerRef}
                                  {...dragProvided.draggableProps}
                                  {...dragProvided.dragHandleProps}
                                  className={cn(
                                    "rounded-lg border border-emerald-500/20 bg-card p-3 cursor-grab active:cursor-grabbing transition-shadow",
                                    dragSnapshot.isDragging && "shadow-lg shadow-emerald-500/10 border-emerald-500/40"
                                  )}
                                  onClick={() => { setSelectedContact(contact); setExpandedSteps(new Set()); }}
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
                                      <div className="flex items-center gap-2 mt-2">
                                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                                        <span className="text-[10px] font-bold text-emerald-500">100%</span>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              )}
                            </Draggable>
                          ))}
                          {provided.placeholder}
                        </div>
                      </div>
                    )}
                  </Droppable>
                </div>
              </DragDropContext>
            </motion.div>
          </TabsContent>
        </Tabs>
      </motion.div>
    </EMSLayout>
  );
};

export default Onboarding;
