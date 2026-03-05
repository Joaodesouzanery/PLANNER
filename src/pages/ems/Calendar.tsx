import { useState, useEffect, useMemo } from "react";
import { EMSLayout } from "@/components/ems/EMSLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { motion, AnimatePresence } from "framer-motion";
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Plus,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addMonths,
  subMonths,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  isToday,
  parseISO,
} from "date-fns";
import { ptBR } from "date-fns/locale";

interface CalendarEvent {
  id: string;
  title: string;
  description: string | null;
  start_date: string;
  end_date: string | null;
  all_day: boolean;
  color: string;
}

interface Task {
  id: string;
  title: string;
  status: string;
  priority: string;
  due_date: string | null;
}

interface Milestone {
  id: string;
  title: string;
  due_date: string | null;
  completed: boolean;
}

const eventColors = [
  { value: "blue", label: "Azul", class: "bg-blue-500" },
  { value: "red", label: "Vermelho", class: "bg-red-500" },
  { value: "green", label: "Verde", class: "bg-emerald-500" },
  { value: "purple", label: "Roxo", class: "bg-purple-500" },
  { value: "amber", label: "Amarelo", class: "bg-amber-500" },
  { value: "pink", label: "Rosa", class: "bg-pink-500" },
];

const getColorClass = (color: string) =>
  eventColors.find((c) => c.value === color)?.class || "bg-blue-500";

const CalendarPage = () => {
  const { toast } = useToast();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [loading, setLoading] = useState(true);
  const [showEventModal, setShowEventModal] = useState(false);
  const [showDayModal, setShowDayModal] = useState(false);
  const [eventForm, setEventForm] = useState({
    title: "",
    date: "",
    color: "blue",
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    const [eventsRes, tasksRes, milestonesRes] = await Promise.all([
      supabase.from("calendar_events").select("*"),
      supabase.from("tasks").select("id, title, status, priority, due_date").not("due_date", "is", null),
      supabase.from("planning_milestones").select("id, title, due_date, completed").not("due_date", "is", null),
    ]);

    if (eventsRes.data) setEvents(eventsRes.data as CalendarEvent[]);
    if (tasksRes.data) setTasks(tasksRes.data as Task[]);
    if (milestonesRes.data) setMilestones(milestonesRes.data as Milestone[]);
    setLoading(false);
  };

  const handleCreateEvent = async () => {
    if (!eventForm.title.trim() || !eventForm.date) {
      toast({ title: "Erro", description: "Preencha o titulo e a data", variant: "destructive" });
      return;
    }

    const { error } = await supabase.from("calendar_events").insert({
      title: eventForm.title,
      start_date: eventForm.date,
      all_day: true,
      color: eventForm.color,
    });

    if (error) {
      toast({ title: "Erro ao criar evento", variant: "destructive" });
      return;
    }

    toast({ title: "Evento criado!" });
    setEventForm({ title: "", date: "", color: "blue" });
    setShowEventModal(false);
    fetchData();
  };

  // Build a map of date -> items for quick lookup
  const dateItemsMap = useMemo(() => {
    const map = new Map<string, { tasks: Task[]; milestones: Milestone[]; events: CalendarEvent[] }>();

    const getOrCreate = (key: string) => {
      if (!map.has(key)) map.set(key, { tasks: [], milestones: [], events: [] });
      return map.get(key)!;
    };

    tasks.forEach((t) => {
      if (t.due_date) getOrCreate(t.due_date).tasks.push(t);
    });

    milestones.forEach((m) => {
      if (m.due_date) getOrCreate(m.due_date).milestones.push(m);
    });

    events.forEach((e) => {
      const dateKey = e.start_date.slice(0, 10);
      getOrCreate(dateKey).events.push(e);
    });

    return map;
  }, [tasks, milestones, events]);

  const getItemsForDate = (date: Date) => {
    const key = format(date, "yyyy-MM-dd");
    return dateItemsMap.get(key) || { tasks: [], milestones: [], events: [] };
  };

  // Calendar grid
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calendarStart = startOfWeek(monthStart, { locale: ptBR });
  const calendarEnd = endOfWeek(monthEnd, { locale: ptBR });
  const calendarDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  const weekDays = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sab"];

  const handleDayClick = (date: Date) => {
    setSelectedDate(date);
    setShowDayModal(true);
  };

  const selectedDayItems = selectedDate ? getItemsForDate(selectedDate) : { tasks: [], milestones: [], events: [] };

  return (
    <EMSLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-heading font-bold text-foreground">
              Calendario
            </h1>
            <p className="text-muted-foreground mt-1">
              Visualize tarefas, marcos e eventos em um so lugar
            </p>
          </div>
          <Button onClick={() => setShowEventModal(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Novo Evento
          </Button>
        </div>

        {/* Calendar Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <Card>
            <CardContent className="p-4 md:p-6">
              {/* Month navigation */}
              <div className="flex items-center justify-between mb-6">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
                >
                  <ChevronLeft className="h-5 w-5" />
                </Button>
                <h2 className="text-lg md:text-xl font-semibold capitalize">
                  {format(currentMonth, "MMMM yyyy", { locale: ptBR })}
                </h2>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
                >
                  <ChevronRight className="h-5 w-5" />
                </Button>
              </div>

              {/* Week day headers */}
              <div className="grid grid-cols-7 mb-2">
                {weekDays.map((day) => (
                  <div
                    key={day}
                    className="text-center text-xs font-medium text-muted-foreground py-2"
                  >
                    {day}
                  </div>
                ))}
              </div>

              {/* Calendar grid */}
              {loading ? (
                <div className="grid grid-cols-7 gap-1">
                  {[...Array(35)].map((_, i) => (
                    <div key={i} className="aspect-square bg-muted/30 rounded animate-pulse" />
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-7 gap-1">
                  {calendarDays.map((day, index) => {
                    const items = getItemsForDate(day);
                    const hasItems =
                      items.tasks.length > 0 ||
                      items.milestones.length > 0 ||
                      items.events.length > 0;
                    const inCurrentMonth = isSameMonth(day, currentMonth);
                    const today = isToday(day);

                    return (
                      <motion.button
                        key={day.toISOString()}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: index * 0.008 }}
                        onClick={() => handleDayClick(day)}
                        className={`
                          relative aspect-square rounded-lg p-1 md:p-2 text-sm
                          transition-colors cursor-pointer
                          flex flex-col items-center justify-start gap-1
                          ${inCurrentMonth ? "text-foreground" : "text-muted-foreground/40"}
                          ${today ? "bg-primary/10 ring-1 ring-primary/30 font-bold" : "hover:bg-muted/50"}
                        `}
                      >
                        <span className={`text-xs md:text-sm ${today ? "text-primary" : ""}`}>
                          {format(day, "d")}
                        </span>

                        {/* Dots */}
                        {hasItems && inCurrentMonth && (
                          <div className="flex gap-0.5 flex-wrap justify-center">
                            {items.tasks.length > 0 && (
                              <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                            )}
                            {items.milestones.length > 0 && (
                              <div className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                            )}
                            {items.events.slice(0, 2).map((ev) => (
                              <div
                                key={ev.id}
                                className={`w-1.5 h-1.5 rounded-full ${getColorClass(ev.color)}`}
                              />
                            ))}
                          </div>
                        )}
                      </motion.button>
                    );
                  })}
                </div>
              )}

              {/* Legend */}
              <div className="flex items-center gap-4 mt-4 pt-4 border-t border-border flex-wrap">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <div className="w-2 h-2 rounded-full bg-blue-500" />
                  Tarefas
                </div>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <div className="w-2 h-2 rounded-full bg-amber-500" />
                  Marcos
                </div>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <div className="w-2 h-2 rounded-full bg-emerald-500" />
                  Eventos
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Day Detail Modal */}
        <Dialog open={showDayModal} onOpenChange={setShowDayModal}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <CalendarIcon className="h-5 w-5" />
                {selectedDate &&
                  format(selectedDate, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 max-h-[60vh] overflow-y-auto">
              {/* Events */}
              {selectedDayItems.events.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground mb-2">Eventos</h4>
                  <div className="space-y-2">
                    {selectedDayItems.events.map((event) => (
                      <div
                        key={event.id}
                        className="flex items-center gap-3 p-3 rounded-lg bg-muted/50"
                      >
                        <div className={`w-2 h-8 rounded-full ${getColorClass(event.color)}`} />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm">{event.title}</p>
                          {event.description && (
                            <p className="text-xs text-muted-foreground mt-0.5 truncate">
                              {event.description}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Tasks */}
              {selectedDayItems.tasks.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground mb-2">Tarefas</h4>
                  <div className="space-y-2">
                    {selectedDayItems.tasks.map((task) => (
                      <div
                        key={task.id}
                        className="flex items-center gap-3 p-3 rounded-lg bg-muted/50"
                      >
                        <div className="w-2 h-8 rounded-full bg-blue-500" />
                        <div className="flex-1 min-w-0">
                          <p className={`font-medium text-sm ${task.status === "completed" ? "line-through text-muted-foreground" : ""}`}>
                            {task.title}
                          </p>
                        </div>
                        <Badge variant="outline" className="text-xs capitalize">
                          {task.status === "completed" ? "Concluida" : task.priority === "urgent" ? "Urgente" : task.priority === "high" ? "Alta" : task.priority === "medium" ? "Media" : "Baixa"}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Milestones */}
              {selectedDayItems.milestones.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground mb-2">Marcos</h4>
                  <div className="space-y-2">
                    {selectedDayItems.milestones.map((milestone) => (
                      <div
                        key={milestone.id}
                        className="flex items-center gap-3 p-3 rounded-lg bg-muted/50"
                      >
                        <div className="w-2 h-8 rounded-full bg-amber-500" />
                        <div className="flex-1 min-w-0">
                          <p className={`font-medium text-sm ${milestone.completed ? "line-through text-muted-foreground" : ""}`}>
                            {milestone.title}
                          </p>
                        </div>
                        {milestone.completed && (
                          <Badge variant="outline" className="text-xs text-emerald-500">
                            Concluido
                          </Badge>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Empty state */}
              {selectedDayItems.events.length === 0 &&
                selectedDayItems.tasks.length === 0 &&
                selectedDayItems.milestones.length === 0 && (
                  <div className="text-center py-8">
                    <CalendarIcon className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                    <p className="text-muted-foreground text-sm">
                      Nenhum item neste dia
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-3"
                      onClick={() => {
                        setShowDayModal(false);
                        setEventForm({
                          ...eventForm,
                          date: format(selectedDate!, "yyyy-MM-dd"),
                        });
                        setShowEventModal(true);
                      }}
                    >
                      <Plus className="h-3 w-3 mr-1" />
                      Criar evento
                    </Button>
                  </div>
                )}
            </div>
          </DialogContent>
        </Dialog>

        {/* Create Event Modal */}
        <Dialog open={showEventModal} onOpenChange={setShowEventModal}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Novo Evento</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">Titulo *</label>
                <Input
                  value={eventForm.title}
                  onChange={(e) => setEventForm({ ...eventForm, title: e.target.value })}
                  placeholder="Ex: Reuniao de equipe"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Data *</label>
                <Input
                  type="date"
                  value={eventForm.date}
                  onChange={(e) => setEventForm({ ...eventForm, date: e.target.value })}
                />
              </div>
              <div>
                <label className="text-sm font-medium">Cor</label>
                <div className="flex gap-2 mt-1.5">
                  {eventColors.map((color) => (
                    <button
                      key={color.value}
                      onClick={() => setEventForm({ ...eventForm, color: color.value })}
                      className={`w-8 h-8 rounded-full ${color.class} transition-all ${
                        eventForm.color === color.value
                          ? "ring-2 ring-offset-2 ring-offset-background ring-primary scale-110"
                          : "opacity-60 hover:opacity-100"
                      }`}
                      title={color.label}
                    />
                  ))}
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <Button variant="outline" onClick={() => setShowEventModal(false)}>
                  Cancelar
                </Button>
                <Button onClick={handleCreateEvent}>Criar Evento</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </EMSLayout>
  );
};

export default CalendarPage;
