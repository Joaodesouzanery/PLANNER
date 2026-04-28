import { useState, useMemo } from "react";
import { useCompany } from "@/contexts/CompanyContext";
import { EMSLayout } from "@/components/ems/EMSLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { motion } from "framer-motion";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Plus, Clock, CheckCircle2, Flag, Target, Eye, FolderKanban, DollarSign, Users, FileText } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addMonths, subMonths, addWeeks, subWeeks, addDays, subDays, eachDayOfInterval, isSameMonth, isSameDay, isToday } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface CalendarEvent { id: string; title: string; description: string | null; start_date: string; end_date: string | null; all_day: boolean; color: string; }
interface Task { id: string; title: string; status: string; priority: string; due_date: string | null; }
interface Milestone { id: string; title: string; due_date: string | null; completed: boolean; }
interface TimeEntry { id: string; date: string; hours: number; description: string | null; }
interface ProjectDeadline { id: string; title: string; client: string | null; due_date: string | null; status: string; next_invoice_date?: string | null; invoice_alert_days?: number | null; }
interface FinancialTransaction { id: string; description: string; amount: number; type: string; date: string; category: string | null; }
interface CommercialAction { id: string; contact_id: string; next_action_date: string | null; next_action_description: string | null; contact?: { name: string; company: string | null } | null; }

type ViewMode = "month" | "week" | "day";

const eventColors = [
  { value: "blue", label: "Azul", class: "bg-blue-500" },
  { value: "red", label: "Vermelho", class: "bg-red-500" },
  { value: "green", label: "Verde", class: "bg-emerald-500" },
  { value: "purple", label: "Roxo", class: "bg-purple-500" },
  { value: "amber", label: "Amarelo", class: "bg-amber-500" },
  { value: "pink", label: "Rosa", class: "bg-pink-500" },
];

const getColorClass = (color: string) => eventColors.find((c) => c.value === color)?.class || "bg-blue-500";

const CalendarPage = () => {
  const { toast } = useToast();
  const { selectedCompanyId } = useCompany();
  const queryClient = useQueryClient();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>("month");
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [showEventModal, setShowEventModal] = useState(false);
  const [showDayModal, setShowDayModal] = useState(false);
  const [eventForm, setEventForm] = useState({ title: "", date: "", color: "blue" });
  const [draggedEvent, setDraggedEvent] = useState<string | null>(null);

  const cf = selectedCompanyId !== "all";

  const { data: events = [] } = useQuery({
    queryKey: ["calendar-events", selectedCompanyId],
    queryFn: async () => {
      let q = supabase.from("calendar_events").select("*");
      if (cf) q = q.eq("company_id", selectedCompanyId);
      const { data, error } = await q;
      if (error) throw error;
      return data as CalendarEvent[];
    },
  });

  const { data: tasks = [] } = useQuery({
    queryKey: ["calendar-tasks", selectedCompanyId],
    queryFn: async () => {
      let q = supabase.from("tasks").select("id, title, status, priority, due_date").not("due_date", "is", null);
      if (cf) q = q.eq("company_id", selectedCompanyId);
      const { data, error } = await q;
      if (error) throw error;
      return data as Task[];
    },
  });

  const { data: milestones = [] } = useQuery({
    queryKey: ["calendar-milestones", selectedCompanyId],
    queryFn: async () => {
      let q = supabase.from("planning_milestones").select("id, title, due_date, completed").not("due_date", "is", null);
      if (cf) q = q.eq("company_id", selectedCompanyId);
      const { data, error } = await q;
      if (error) throw error;
      return data as Milestone[];
    },
  });

  const { data: timeEntries = [] } = useQuery({
    queryKey: ["calendar-time-entries", selectedCompanyId],
    queryFn: async () => {
      let q = supabase.from("time_entries").select("id, date, hours, description");
      if (cf) q = q.eq("company_id", selectedCompanyId);
      const { data, error } = await q;
      if (error) throw error;
      return data as TimeEntry[];
    },
  });

  const { data: projects = [] } = useQuery({
    queryKey: ["calendar-projects", selectedCompanyId],
    queryFn: async () => {
      let q = (supabase as any).from("projects").select("id, title, client, due_date, status, next_invoice_date, invoice_alert_days").or("due_date.not.is.null,next_invoice_date.not.is.null");
      if (cf) q = q.eq("company_id", selectedCompanyId);
      const { data, error } = await q;
      if (error) throw error;
      return data as ProjectDeadline[];
    },
  });

  const { data: financial = [] } = useQuery({
    queryKey: ["calendar-financial", selectedCompanyId],
    queryFn: async () => {
      let q = supabase.from("financial_transactions").select("id, description, amount, type, date, category");
      if (cf) q = q.eq("company_id", selectedCompanyId);
      const { data, error } = await q;
      if (error) throw error;
      return data as FinancialTransaction[];
    },
  });

  const { data: commercialActions = [] } = useQuery({
    queryKey: ["calendar-commercial-actions", selectedCompanyId],
    queryFn: async () => {
      let q = (supabase as any)
        .from("commercial_contact_meta")
        .select("id, contact_id, next_action_date, next_action_description, contact:contacts(name, company, company_id)")
        .not("next_action_date", "is", null);
      const { data, error } = await q;
      if (error) throw error;
      const rows = (data || []) as any[];
      return (cf ? rows.filter((r) => r.contact?.company_id === selectedCompanyId) : rows) as CommercialAction[];
    },
  });

  const moveEventMutation = useMutation({
    mutationFn: async ({ eventId, newDate }: { eventId: string; newDate: string }) => {
      const { error } = await supabase.from("calendar_events").update({ start_date: newDate }).eq("id", eventId);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["calendar-events"] }); toast({ title: "Evento movido!" }); },
  });

  const createEventMutation = useMutation({
    mutationFn: async () => {
      if (!eventForm.title.trim() || !eventForm.date) throw new Error("Preencha título e data");
      const { error } = await supabase.from("calendar_events").insert({ title: eventForm.title, start_date: eventForm.date, all_day: true, color: eventForm.color, company_id: cf ? selectedCompanyId : null });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["calendar-events"] });
      toast({ title: "Evento criado!" });
      setEventForm({ title: "", date: "", color: "blue" }); setShowEventModal(false);
    },
    onError: (e: any) => toast({ title: "Erro", description: e?.message, variant: "destructive" }),
  });

  const dateItemsMap = useMemo(() => {
    const map = new Map<string, { tasks: Task[]; milestones: Milestone[]; events: CalendarEvent[]; hours: number; projects: ProjectDeadline[]; invoices: ProjectDeadline[]; financial: FinancialTransaction[]; commercial: CommercialAction[] }>();
    const getOrCreate = (key: string) => { if (!map.has(key)) map.set(key, { tasks: [], milestones: [], events: [], hours: 0, projects: [], invoices: [], financial: [], commercial: [] }); return map.get(key)!; };
    tasks.forEach((t) => { if (t.due_date) getOrCreate(t.due_date).tasks.push(t); });
    milestones.forEach((m) => { if (m.due_date) getOrCreate(m.due_date).milestones.push(m); });
    events.forEach((e) => { const dateKey = e.start_date.slice(0, 10); getOrCreate(dateKey).events.push(e); });
    timeEntries.forEach((te) => { const entry = getOrCreate(te.date); entry.hours += Number(te.hours); });
    projects.forEach((p) => {
      if (p.due_date) getOrCreate(p.due_date).projects.push(p);
      if (p.next_invoice_date) getOrCreate(p.next_invoice_date).invoices.push(p);
    });
    financial.forEach((f) => getOrCreate(f.date).financial.push(f));
    commercialActions.forEach((a) => { if (a.next_action_date) getOrCreate(a.next_action_date).commercial.push(a); });
    return map;
  }, [tasks, milestones, events, timeEntries, projects, financial, commercialActions]);

  const getItemsForDate = (date: Date) => {
    const key = format(date, "yyyy-MM-dd");
    return dateItemsMap.get(key) || { tasks: [], milestones: [], events: [], hours: 0, projects: [], invoices: [], financial: [], commercial: [] };
  };

  // Navigation
  const goNext = () => {
    if (viewMode === "month") setCurrentDate(addMonths(currentDate, 1));
    else if (viewMode === "week") setCurrentDate(addWeeks(currentDate, 1));
    else setCurrentDate(addDays(currentDate, 1));
  };
  const goPrev = () => {
    if (viewMode === "month") setCurrentDate(subMonths(currentDate, 1));
    else if (viewMode === "week") setCurrentDate(subWeeks(currentDate, 1));
    else setCurrentDate(subDays(currentDate, 1));
  };
  const goToday = () => setCurrentDate(new Date());

  // Calendar days computation
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const calendarStart = startOfWeek(monthStart, { locale: ptBR });
  const calendarEnd = endOfWeek(monthEnd, { locale: ptBR });
  const monthDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  const weekStart = startOfWeek(currentDate, { locale: ptBR });
  const weekEnd = endOfWeek(currentDate, { locale: ptBR });
  const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd });

  const weekDayNames = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sab"];
  const hours = Array.from({ length: 13 }, (_, i) => i + 8); // 8-20

  const handleDayClick = (date: Date) => { setSelectedDate(date); setShowDayModal(true); };
  const selectedDayItems = selectedDate ? getItemsForDate(selectedDate) : { tasks: [], milestones: [], events: [], hours: 0, projects: [], invoices: [], financial: [], commercial: [] };

  // Drag & drop handlers
  const handleDragStart = (eventId: string) => setDraggedEvent(eventId);
  const handleDragOver = (e: React.DragEvent) => e.preventDefault();
  const handleDrop = (date: Date) => {
    if (draggedEvent) {
      moveEventMutation.mutate({ eventId: draggedEvent, newDate: format(date, "yyyy-MM-dd") });
      setDraggedEvent(null);
    }
  };

  // Stats
  const todayItems = getItemsForDate(new Date());
  const todayCount = todayItems.tasks.length + todayItems.milestones.length + todayItems.events.length + todayItems.projects.length + todayItems.invoices.length + todayItems.financial.length + todayItems.commercial.length;

  const navigationLabel = viewMode === "month"
    ? format(currentDate, "MMMM yyyy", { locale: ptBR })
    : viewMode === "week"
    ? `${format(weekStart, "dd MMM", { locale: ptBR })} — ${format(weekEnd, "dd MMM yyyy", { locale: ptBR })}`
    : format(currentDate, "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR });

  const renderDayCell = (day: Date, inCurrentMonth: boolean = true) => {
    const items = getItemsForDate(day);
    const hasItems = items.tasks.length > 0 || items.milestones.length > 0 || items.events.length > 0 || items.projects.length > 0 || items.invoices.length > 0 || items.financial.length > 0 || items.commercial.length > 0;
    const today = isToday(day);

    return (
      <div
        key={day.toISOString()}
        onClick={() => handleDayClick(day)}
        onDragOver={handleDragOver}
        onDrop={() => handleDrop(day)}
        className={cn(
          "relative rounded-xl p-1 md:p-2 text-sm transition-all cursor-pointer flex flex-col items-center justify-start gap-1 border min-h-[60px]",
          inCurrentMonth ? "text-foreground" : "text-muted-foreground/30",
          today ? "bg-primary/10 border-primary/30 font-bold shadow-md shadow-primary/10" : "border-transparent hover:bg-muted/30 hover:border-border/50",
          hasItems && inCurrentMonth && !today ? "bg-muted/10" : ""
        )}
      >
        <span className={cn("text-xs md:text-sm font-mono", today ? "text-primary" : "")}>{format(day, "d")}</span>
        {items.hours > 0 && inCurrentMonth && (
          <Badge variant="outline" className="text-[8px] px-1 py-0 border-primary/30 text-primary">{items.hours.toFixed(1)}h</Badge>
        )}
        {hasItems && inCurrentMonth && (
          <div className="flex gap-0.5 flex-wrap justify-center">
            {items.tasks.length > 0 && <div className="w-1.5 h-1.5 rounded-full bg-blue-500 shadow-sm shadow-blue-500/50" />}
            {items.milestones.length > 0 && <div className="w-1.5 h-1.5 rounded-full bg-amber-500 shadow-sm shadow-amber-500/50" />}
            {items.projects.length > 0 && <div className="w-1.5 h-1.5 rounded-full bg-purple-500 shadow-sm shadow-purple-500/50" />}
            {items.invoices.length > 0 && <div className="w-1.5 h-1.5 rounded-full bg-cyan-500 shadow-sm shadow-cyan-500/50" />}
            {items.financial.length > 0 && <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-sm shadow-emerald-500/50" />}
            {items.commercial.length > 0 && <div className="w-1.5 h-1.5 rounded-full bg-pink-500 shadow-sm shadow-pink-500/50" />}
            {items.events.slice(0, 2).map((ev) => (
              <div
                key={ev.id}
                draggable
                onDragStart={() => handleDragStart(ev.id)}
                className={cn("w-1.5 h-1.5 rounded-full shadow-sm cursor-grab", getColorClass(ev.color))}
              />
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <EMSLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-heading font-bold text-foreground flex items-center gap-2">
              <div className="p-2 rounded-xl bg-primary/10"><CalendarIcon className="h-6 w-6 text-primary" /></div>
              Calendário
            </h1>
            <p className="text-muted-foreground mt-1 text-sm">Visualize tarefas, marcos e eventos em um só lugar</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="rounded-xl" onClick={goToday}>Hoje</Button>
            <Button onClick={() => setShowEventModal(true)} className="rounded-xl shadow-lg shadow-primary/20 hover:shadow-primary/40">
              <Plus className="h-4 w-4 mr-2" /> Novo Evento
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Hoje", value: todayCount, icon: Clock, color: "text-primary", bg: "bg-primary/10", border: "border-primary/20" },
            { label: "Eventos", value: events.length, icon: CalendarIcon, color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/20" },
            { label: "Tarefas", value: tasks.length, icon: Flag, color: "text-blue-400", bg: "bg-blue-500/10", border: "border-blue-500/20" },
            { label: "Projetos/NF", value: projects.length, icon: FolderKanban, color: "text-purple-400", bg: "bg-purple-500/10", border: "border-purple-500/20" },
          ].map((s, i) => (
            <motion.div key={s.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
              <Card className={cn("border transition-all duration-300 hover:scale-[1.03]", s.border)}>
                <CardContent className="p-3 flex items-center gap-2.5">
                  <div className={cn("p-1.5 rounded-lg", s.bg)}><s.icon className={cn("h-4 w-4", s.color)} /></div>
                  <div><p className="text-xl font-bold font-mono">{s.value}</p><p className="text-[10px] text-muted-foreground">{s.label}</p></div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* Calendar Card */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
          <Card className="border border-border/50 bg-card/80 overflow-hidden">
            <CardContent className="p-4 md:p-6">
              {/* Navigation + View Toggle */}
              <div className="flex items-center justify-between mb-6">
                <Button variant="ghost" size="icon" className="rounded-xl hover:bg-primary/10 hover:text-primary" onClick={goPrev}><ChevronLeft className="h-5 w-5" /></Button>
                <div className="flex items-center gap-3">
                  <h2 className="text-lg md:text-xl font-semibold capitalize text-foreground">{navigationLabel}</h2>
                </div>
                <Button variant="ghost" size="icon" className="rounded-xl hover:bg-primary/10 hover:text-primary" onClick={goNext}><ChevronRight className="h-5 w-5" /></Button>
              </div>

              {/* View Mode Toggle */}
              <div className="flex items-center gap-1 mb-4 bg-muted/30 rounded-xl p-1 w-fit">
                {(["month", "week", "day"] as ViewMode[]).map(mode => (
                  <Button key={mode} variant={viewMode === mode ? "default" : "ghost"} size="sm" className={cn("rounded-lg text-xs", viewMode === mode && "shadow-sm")} onClick={() => setViewMode(mode)}>
                    {mode === "month" ? "Mês" : mode === "week" ? "Semana" : "Dia"}
                  </Button>
                ))}
              </div>

              {/* MONTHLY VIEW */}
              {viewMode === "month" && (
                <>
                  <div className="grid grid-cols-7 mb-2">
                    {weekDayNames.map((day) => (
                      <div key={day} className="text-center text-xs font-medium text-muted-foreground py-2">{day}</div>
                    ))}
                  </div>
                  <div className="grid grid-cols-7 gap-1">
                    {monthDays.map((day) => renderDayCell(day, isSameMonth(day, currentDate)))}
                  </div>
                </>
              )}

              {/* WEEKLY VIEW */}
              {viewMode === "week" && (
                <div className="overflow-x-auto">
                  <div className="grid grid-cols-8 gap-1 min-w-[700px]">
                    <div className="text-xs text-muted-foreground font-medium p-2">Hora</div>
                    {weekDays.map(day => (
                      <div key={day.toISOString()} className={cn("text-center text-xs font-medium p-2 rounded-lg", isToday(day) ? "bg-primary/10 text-primary" : "text-muted-foreground")}
                        onDragOver={handleDragOver} onDrop={() => handleDrop(day)}>
                        <div>{format(day, "EEE", { locale: ptBR })}</div>
                        <div className="text-lg font-bold font-mono">{format(day, "d")}</div>
                        {(() => { const items = getItemsForDate(day); return items.hours > 0 ? <Badge variant="outline" className="text-[8px] mt-1 border-primary/30 text-primary">{items.hours.toFixed(1)}h</Badge> : null; })()}
                      </div>
                    ))}
                    {hours.map(hour => (
                      <div key={hour} className="contents">
                        <div className="text-[10px] text-muted-foreground font-mono p-1 border-t border-border/30 flex items-start">{hour}:00</div>
                        {weekDays.map(day => {
                          const items = getItemsForDate(day);
                          return (
                            <div key={`${day.toISOString()}-${hour}`} className="border-t border-border/20 p-0.5 min-h-[32px] hover:bg-muted/20 cursor-pointer rounded" onClick={() => handleDayClick(day)} onDragOver={handleDragOver} onDrop={() => handleDrop(day)}>
                              {hour === 8 && items.events.map(ev => (
                                <div key={ev.id} draggable onDragStart={() => handleDragStart(ev.id)} className={cn("text-[9px] px-1 py-0.5 rounded text-white truncate mb-0.5 cursor-grab", getColorClass(ev.color))}>{ev.title}</div>
                              ))}
                              {hour === 9 && items.tasks.map(t => (
                                <div key={t.id} className="text-[9px] px-1 py-0.5 rounded bg-blue-500/15 text-blue-400 truncate mb-0.5">{t.title}</div>
                              ))}
                              {hour === 10 && items.milestones.map(m => (
                                <div key={m.id} className="text-[9px] px-1 py-0.5 rounded bg-amber-500/15 text-amber-400 truncate mb-0.5">{m.title}</div>
                              ))}
                            </div>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* DAILY VIEW */}
              {viewMode === "day" && (
                <div className="space-y-2">
                  {(() => {
                    const items = getItemsForDate(currentDate);
                    return (
                      <>
                        {items.hours > 0 && (
                          <div className="flex items-center gap-2 p-3 rounded-xl bg-primary/5 border border-primary/20">
                            <Clock className="h-4 w-4 text-primary" />
                            <span className="text-sm font-medium">Horas registradas: <span className="font-mono text-primary font-bold">{items.hours.toFixed(1)}h</span></span>
                          </div>
                        )}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                          {items.projects.map(p => (
                            <div key={`project-${p.id}`} className="text-xs px-3 py-2 rounded-lg bg-purple-500/10 text-purple-400 border border-purple-500/20 flex items-center gap-2">
                              <FolderKanban className="h-3.5 w-3.5" />Prazo: {p.title}
                            </div>
                          ))}
                          {items.invoices.map(p => (
                            <div key={`invoice-${p.id}`} className="text-xs px-3 py-2 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 flex items-center gap-2">
                              <FileText className="h-3.5 w-3.5" />Gerar NF: {p.title}
                            </div>
                          ))}
                          {items.financial.map(f => (
                            <div key={f.id} className="text-xs px-3 py-2 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-2">
                              <DollarSign className="h-3.5 w-3.5" />{f.description} - R$ {Number(f.amount).toLocaleString("pt-BR")}
                            </div>
                          ))}
                          {items.commercial.map(a => (
                            <div key={a.id} className="text-xs px-3 py-2 rounded-lg bg-pink-500/10 text-pink-400 border border-pink-500/20 flex items-center gap-2">
                              <Users className="h-3.5 w-3.5" />{a.contact?.name || "Contato"}: {a.next_action_description || "Próxima ação"}
                            </div>
                          ))}
                        </div>
                        {hours.map(hour => {
                          const hourEvents = hour === 8 ? items.events : [];
                          const hourTasks = hour === 9 ? items.tasks : [];
                          const hourMilestones = hour === 10 ? items.milestones : [];
                          const hasContent = hourEvents.length > 0 || hourTasks.length > 0 || hourMilestones.length > 0;
                          return (
                            <div key={hour} className={cn("flex gap-3 p-2 rounded-lg border border-transparent", hasContent && "border-border/30 bg-muted/10")}>
                              <span className="text-xs text-muted-foreground font-mono w-12 shrink-0 pt-1">{hour}:00</span>
                              <div className="flex-1 min-h-[28px] space-y-1">
                                {hourEvents.map(ev => (
                                  <div key={ev.id} draggable onDragStart={() => handleDragStart(ev.id)} className={cn("text-xs px-2 py-1 rounded-lg text-white cursor-grab", getColorClass(ev.color))}>{ev.title}</div>
                                ))}
                                {hourTasks.map(t => (
                                  <div key={t.id} className="text-xs px-2 py-1 rounded-lg bg-blue-500/15 text-blue-400 flex items-center gap-1">
                                    <Flag className="h-3 w-3" />{t.title}
                                    {t.status === "completed" && <CheckCircle2 className="h-3 w-3 text-emerald-400 ml-auto" />}
                                  </div>
                                ))}
                                {hourMilestones.map(m => (
                                  <div key={m.id} className="text-xs px-2 py-1 rounded-lg bg-amber-500/15 text-amber-400 flex items-center gap-1">
                                    <Target className="h-3 w-3" />{m.title}
                                    {m.completed && <CheckCircle2 className="h-3 w-3 text-emerald-400 ml-auto" />}
                                  </div>
                                ))}
                              </div>
                            </div>
                          );
                        })}
                      </>
                    );
                  })()}
                </div>
              )}

              {/* Legend */}
              <div className="flex items-center gap-4 mt-4 pt-4 border-t border-border/50 flex-wrap">
                {[
                  { label: "Tarefas", color: "bg-blue-500" },
                  { label: "Marcos", color: "bg-amber-500" },
                  { label: "Eventos", color: "bg-emerald-500" },
                  { label: "Projetos", color: "bg-purple-500" },
                  { label: "Notas Fiscais", color: "bg-cyan-500" },
                  { label: "Comercial", color: "bg-pink-500" },
                  { label: "Timesheet", color: "bg-primary" },
                ].map(l => (
                  <div key={l.label} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <div className={cn("w-2 h-2 rounded-full", l.color)} />{l.label}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Day Detail Modal */}
        <Dialog open={showDayModal} onOpenChange={setShowDayModal}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-primary/10"><CalendarIcon className="h-4 w-4 text-primary" /></div>
                {selectedDate && format(selectedDate, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 max-h-[60vh] overflow-y-auto">
              {selectedDayItems.hours > 0 && (
                <div className="flex items-center gap-2 p-3 rounded-xl bg-primary/5 border border-primary/20">
                  <Clock className="h-4 w-4 text-primary" />
                  <span className="text-sm">Horas registradas: <span className="font-mono text-primary font-bold">{selectedDayItems.hours.toFixed(1)}h</span></span>
                </div>
              )}
              {selectedDayItems.events.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground mb-2">Eventos</h4>
                  <div className="space-y-2">
                    {selectedDayItems.events.map((event) => (
                      <div key={event.id} className="flex items-center gap-3 p-3 rounded-xl bg-muted/30 border border-border/50 hover:bg-muted/50 transition-colors">
                        <div className={cn("w-1.5 h-8 rounded-full", getColorClass(event.color))} />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm">{event.title}</p>
                          {event.description && <p className="text-xs text-muted-foreground mt-0.5 truncate">{event.description}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {selectedDayItems.tasks.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground mb-2">Tarefas</h4>
                  <div className="space-y-2">
                    {selectedDayItems.tasks.map((task) => (
                      <div key={task.id} className="flex items-center gap-3 p-3 rounded-xl bg-muted/30 border border-border/50">
                        <div className="w-1.5 h-8 rounded-full bg-blue-500" />
                        <div className="flex-1 min-w-0">
                          <p className={cn("font-medium text-sm", task.status === "completed" && "line-through text-muted-foreground")}>{task.title}</p>
                        </div>
                        <Badge variant="outline" className={cn("text-xs",
                          task.status === "completed" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30" :
                          task.priority === "urgent" ? "bg-red-500/10 text-red-400 border-red-500/30" :
                          task.priority === "high" ? "bg-orange-500/10 text-orange-400 border-orange-500/30" :
                          "bg-muted text-muted-foreground border-border/50"
                        )}>
                          {task.status === "completed" ? "Concluída" : task.priority === "urgent" ? "Urgente" : task.priority === "high" ? "Alta" : task.priority === "medium" ? "Média" : "Baixa"}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {selectedDayItems.milestones.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground mb-2">Marcos</h4>
                  <div className="space-y-2">
                    {selectedDayItems.milestones.map((milestone) => (
                      <div key={milestone.id} className="flex items-center gap-3 p-3 rounded-xl bg-muted/30 border border-border/50">
                        <div className="w-1.5 h-8 rounded-full bg-amber-500" />
                        <div className="flex-1 min-w-0">
                          <p className={cn("font-medium text-sm", milestone.completed && "line-through text-muted-foreground")}>{milestone.title}</p>
                        </div>
                        {milestone.completed && <Badge variant="outline" className="text-xs text-emerald-400 border-emerald-500/30 bg-emerald-500/10"><CheckCircle2 className="h-3 w-3 mr-1" />Concluído</Badge>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {selectedDayItems.projects.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground mb-2">Projetos</h4>
                  <div className="space-y-2">
                    {selectedDayItems.projects.map((project) => (
                      <div key={project.id} className="flex items-center gap-3 p-3 rounded-xl bg-muted/30 border border-border/50">
                        <div className="w-1.5 h-8 rounded-full bg-purple-500" />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm">{project.title}</p>
                          {project.client && <p className="text-xs text-muted-foreground mt-0.5">{project.client}</p>}
                        </div>
                        <Badge variant="outline" className="text-xs">{project.status}</Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {selectedDayItems.invoices.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground mb-2">Notas Fiscais</h4>
                  <div className="space-y-2">
                    {selectedDayItems.invoices.map((project) => (
                      <div key={project.id} className="flex items-center gap-3 p-3 rounded-xl bg-cyan-500/10 border border-cyan-500/20">
                        <FileText className="h-4 w-4 text-cyan-400" />
                        <span className="font-medium text-sm flex-1 min-w-0 truncate">Gerar NF: {project.title}</span>
                        <Badge variant="outline" className="text-xs text-cyan-400 border-cyan-500/30">{project.invoice_alert_days ?? 7}d alerta</Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {selectedDayItems.financial.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground mb-2">Financeiro</h4>
                  <div className="space-y-2">
                    {selectedDayItems.financial.map((tx) => (
                      <div key={tx.id} className="flex items-center gap-3 p-3 rounded-xl bg-muted/30 border border-border/50">
                        <DollarSign className={cn("h-4 w-4", tx.type === "income" ? "text-emerald-400" : "text-red-400")} />
                        <span className="font-medium text-sm flex-1 min-w-0 truncate">{tx.description}</span>
                        <span className="text-xs font-mono">R$ {Number(tx.amount).toLocaleString("pt-BR")}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {selectedDayItems.commercial.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground mb-2">Comercial</h4>
                  <div className="space-y-2">
                    {selectedDayItems.commercial.map((action) => (
                      <div key={action.id} className="flex items-center gap-3 p-3 rounded-xl bg-pink-500/10 border border-pink-500/20">
                        <Users className="h-4 w-4 text-pink-400" />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm">{action.contact?.name || "Contato"}</p>
                          <p className="text-xs text-muted-foreground truncate">{action.next_action_description || "Próxima ação"}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {selectedDayItems.events.length === 0 && selectedDayItems.tasks.length === 0 && selectedDayItems.milestones.length === 0 && selectedDayItems.projects.length === 0 && selectedDayItems.invoices.length === 0 && selectedDayItems.financial.length === 0 && selectedDayItems.commercial.length === 0 && (
                <div className="text-center py-8">
                  <div className="inline-flex p-3 rounded-2xl bg-muted/30 mb-3"><CalendarIcon className="h-8 w-8 text-muted-foreground/50" /></div>
                  <p className="text-muted-foreground text-sm">Nenhum item neste dia</p>
                  <Button variant="outline" size="sm" className="mt-3 rounded-xl" onClick={() => { setShowDayModal(false); setEventForm({ ...eventForm, date: format(selectedDate!, "yyyy-MM-dd") }); setShowEventModal(true); }}>
                    <Plus className="h-3 w-3 mr-1" /> Criar evento
                  </Button>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>

        {/* Create Event Modal */}
        <Dialog open={showEventModal} onOpenChange={setShowEventModal}>
          <DialogContent>
            <DialogHeader><DialogTitle>Novo Evento</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div><label className="text-sm font-medium">Título *</label><Input value={eventForm.title} onChange={(e) => setEventForm({ ...eventForm, title: e.target.value })} placeholder="Ex: Reunião de equipe" className="mt-1 rounded-xl" /></div>
              <div><label className="text-sm font-medium">Data *</label><Input type="date" value={eventForm.date} onChange={(e) => setEventForm({ ...eventForm, date: e.target.value })} className="mt-1 rounded-xl" /></div>
              <div>
                <label className="text-sm font-medium">Cor</label>
                <div className="flex gap-2 mt-2">
                  {eventColors.map((color) => (
                    <button key={color.value} onClick={() => setEventForm({ ...eventForm, color: color.value })}
                      className={cn("w-8 h-8 rounded-full transition-all", color.class,
                        eventForm.color === color.value ? "ring-2 ring-offset-2 ring-offset-background ring-primary scale-110 shadow-lg" : "opacity-50 hover:opacity-80"
                      )} title={color.label} />
                  ))}
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <Button variant="outline" className="rounded-xl" onClick={() => setShowEventModal(false)}>Cancelar</Button>
                <Button className="rounded-xl shadow-lg shadow-primary/20" onClick={() => createEventMutation.mutate()}>Criar Evento</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </EMSLayout>
  );
};

export default CalendarPage;
