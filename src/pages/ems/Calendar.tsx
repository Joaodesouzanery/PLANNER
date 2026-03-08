import { useState, useEffect, useMemo } from "react";
import { useCompany } from "@/contexts/CompanyContext";
import { EMSLayout } from "@/components/ems/EMSLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { motion, AnimatePresence } from "framer-motion";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Plus, Clock, CheckCircle2, Flag, Target } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addMonths, subMonths, eachDayOfInterval, isSameMonth, isSameDay, isToday, } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface CalendarEvent { id: string; title: string; description: string | null; start_date: string; end_date: string | null; all_day: boolean; color: string; }
interface Task { id: string; title: string; status: string; priority: string; due_date: string | null; }
interface Milestone { id: string; title: string; due_date: string | null; completed: boolean; }

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
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [loading, setLoading] = useState(true);
  const [showEventModal, setShowEventModal] = useState(false);
  const [showDayModal, setShowDayModal] = useState(false);
  const [eventForm, setEventForm] = useState({ title: "", date: "", color: "blue" });

  useEffect(() => { fetchData(); }, [selectedCompanyId]);

  const fetchData = async () => {
    setLoading(true);
    const cf = selectedCompanyId !== "all";
    let eq = supabase.from("calendar_events").select("*");
    let tq = supabase.from("tasks").select("id, title, status, priority, due_date").not("due_date", "is", null);
    let mq = supabase.from("planning_milestones").select("id, title, due_date, completed").not("due_date", "is", null);
    if (cf) { eq = eq.eq("company_id", selectedCompanyId); tq = tq.eq("company_id", selectedCompanyId); mq = mq.eq("company_id", selectedCompanyId); }
    const [eventsRes, tasksRes, milestonesRes] = await Promise.all([eq, tq, mq]);
    if (eventsRes.data) setEvents(eventsRes.data as CalendarEvent[]);
    if (tasksRes.data) setTasks(tasksRes.data as Task[]);
    if (milestonesRes.data) setMilestones(milestonesRes.data as Milestone[]);
    setLoading(false);
  };

  const handleCreateEvent = async () => {
    if (!eventForm.title.trim() || !eventForm.date) { toast({ title: "Erro", description: "Preencha o titulo e a data", variant: "destructive" }); return; }
    const { error } = await supabase.from("calendar_events").insert({ title: eventForm.title, start_date: eventForm.date, all_day: true, color: eventForm.color, company_id: selectedCompanyId !== "all" ? selectedCompanyId : null });
    if (error) { toast({ title: "Erro ao criar evento", variant: "destructive" }); return; }
    toast({ title: "Evento criado!" });
    setEventForm({ title: "", date: "", color: "blue" });
    setShowEventModal(false);
    fetchData();
  };

  const dateItemsMap = useMemo(() => {
    const map = new Map<string, { tasks: Task[]; milestones: Milestone[]; events: CalendarEvent[] }>();
    const getOrCreate = (key: string) => { if (!map.has(key)) map.set(key, { tasks: [], milestones: [], events: [] }); return map.get(key)!; };
    tasks.forEach((t) => { if (t.due_date) getOrCreate(t.due_date).tasks.push(t); });
    milestones.forEach((m) => { if (m.due_date) getOrCreate(m.due_date).milestones.push(m); });
    events.forEach((e) => { const dateKey = e.start_date.slice(0, 10); getOrCreate(dateKey).events.push(e); });
    return map;
  }, [tasks, milestones, events]);

  const getItemsForDate = (date: Date) => { const key = format(date, "yyyy-MM-dd"); return dateItemsMap.get(key) || { tasks: [], milestones: [], events: [] }; };

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calendarStart = startOfWeek(monthStart, { locale: ptBR });
  const calendarEnd = endOfWeek(monthEnd, { locale: ptBR });
  const calendarDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd });
  const weekDays = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sab"];

  const handleDayClick = (date: Date) => { setSelectedDate(date); setShowDayModal(true); };
  const selectedDayItems = selectedDate ? getItemsForDate(selectedDate) : { tasks: [], milestones: [], events: [] };

  // Stats
  const totalEvents = events.length;
  const totalTasksDue = tasks.length;
  const totalMilestones = milestones.length;
  const todayItems = getItemsForDate(new Date());
  const todayCount = todayItems.tasks.length + todayItems.milestones.length + todayItems.events.length;

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
          <Button onClick={() => setShowEventModal(true)} className="rounded-xl shadow-lg shadow-primary/20 hover:shadow-primary/40">
            <Plus className="h-4 w-4 mr-2" /> Novo Evento
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Hoje", value: todayCount, icon: Clock, color: "text-primary", bg: "bg-primary/10", border: "border-primary/20" },
            { label: "Eventos", value: totalEvents, icon: CalendarIcon, color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/20" },
            { label: "Tarefas", value: totalTasksDue, icon: Flag, color: "text-blue-400", bg: "bg-blue-500/10", border: "border-blue-500/20" },
            { label: "Marcos", value: totalMilestones, icon: Target, color: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/20" },
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
              {/* Month navigation */}
              <div className="flex items-center justify-between mb-6">
                <Button variant="ghost" size="icon" className="rounded-xl hover:bg-primary/10 hover:text-primary" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}><ChevronLeft className="h-5 w-5" /></Button>
                <h2 className="text-lg md:text-xl font-semibold capitalize text-foreground">{format(currentMonth, "MMMM yyyy", { locale: ptBR })}</h2>
                <Button variant="ghost" size="icon" className="rounded-xl hover:bg-primary/10 hover:text-primary" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}><ChevronRight className="h-5 w-5" /></Button>
              </div>

              {/* Week day headers */}
              <div className="grid grid-cols-7 mb-2">
                {weekDays.map((day) => (
                  <div key={day} className="text-center text-xs font-medium text-muted-foreground py-2">{day}</div>
                ))}
              </div>

              {/* Calendar grid */}
              {loading ? (
                <div className="grid grid-cols-7 gap-1">{[...Array(35)].map((_, i) => <div key={i} className="aspect-square bg-muted/20 rounded-lg animate-pulse" />)}</div>
              ) : (
                <div className="grid grid-cols-7 gap-1">
                  {calendarDays.map((day, index) => {
                    const items = getItemsForDate(day);
                    const hasItems = items.tasks.length > 0 || items.milestones.length > 0 || items.events.length > 0;
                    const inCurrentMonth = isSameMonth(day, currentMonth);
                    const today = isToday(day);
                    return (
                      <motion.button key={day.toISOString()} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: index * 0.006 }}
                        onClick={() => handleDayClick(day)}
                        className={cn(
                          "relative aspect-square rounded-xl p-1 md:p-2 text-sm transition-all cursor-pointer flex flex-col items-center justify-start gap-1 border",
                          inCurrentMonth ? "text-foreground" : "text-muted-foreground/30",
                          today ? "bg-primary/10 border-primary/30 font-bold shadow-md shadow-primary/10" : "border-transparent hover:bg-muted/30 hover:border-border/50",
                          hasItems && inCurrentMonth && !today ? "bg-muted/10" : ""
                        )}>
                        <span className={cn("text-xs md:text-sm font-mono", today ? "text-primary" : "")}>{format(day, "d")}</span>
                        {hasItems && inCurrentMonth && (
                          <div className="flex gap-0.5 flex-wrap justify-center">
                            {items.tasks.length > 0 && <div className="w-1.5 h-1.5 rounded-full bg-blue-500 shadow-sm shadow-blue-500/50" />}
                            {items.milestones.length > 0 && <div className="w-1.5 h-1.5 rounded-full bg-amber-500 shadow-sm shadow-amber-500/50" />}
                            {items.events.slice(0, 2).map((ev) => <div key={ev.id} className={cn("w-1.5 h-1.5 rounded-full shadow-sm", getColorClass(ev.color))} />)}
                          </div>
                        )}
                      </motion.button>
                    );
                  })}
                </div>
              )}

              {/* Legend */}
              <div className="flex items-center gap-4 mt-4 pt-4 border-t border-border/50 flex-wrap">
                {[
                  { label: "Tarefas", color: "bg-blue-500" },
                  { label: "Marcos", color: "bg-amber-500" },
                  { label: "Eventos", color: "bg-emerald-500" },
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
              {selectedDayItems.events.length === 0 && selectedDayItems.tasks.length === 0 && selectedDayItems.milestones.length === 0 && (
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
                <Button className="rounded-xl shadow-lg shadow-primary/20" onClick={handleCreateEvent}>Criar Evento</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </EMSLayout>
  );
};

export default CalendarPage;
