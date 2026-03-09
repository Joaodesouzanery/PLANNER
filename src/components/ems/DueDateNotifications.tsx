import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bell, Calendar, AlertTriangle, Clock, Target, ListTodo, FolderKanban } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { formatDistanceToNow, differenceInDays, parseISO, isBefore } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface NotificationItem {
  id: string;
  title: string;
  type: "project" | "task" | "milestone";
  dueDate: string;
  daysUntilDue: number;
  isOverdue: boolean;
  priority?: string;
  client?: string | null;
}

export const DueDateNotifications = () => {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [hasNewNotifications, setHasNewNotifications] = useState(false);

  const fetchAll = async () => {
    const today = new Date();
    const items: NotificationItem[] = [];

    const [projectsRes, tasksRes, milestonesRes] = await Promise.all([
      supabase.from("projects").select("*").not("due_date", "is", null).neq("status", "done").order("due_date"),
      supabase.from("tasks").select("id, title, due_date, status, priority").not("due_date", "is", null).neq("status", "completed").order("due_date"),
      supabase.from("planning_milestones").select("id, title, due_date, completed").not("due_date", "is", null).eq("completed", false).order("due_date"),
    ]);

    projectsRes.data?.forEach((p: any) => {
      if (!p.due_date) return;
      const days = differenceInDays(parseISO(p.due_date), today);
      const overdue = isBefore(parseISO(p.due_date), today);
      if (overdue || days <= 7) items.push({ id: p.id, title: p.title, type: "project", dueDate: p.due_date, daysUntilDue: days, isOverdue: overdue, priority: p.priority, client: p.client });
    });

    tasksRes.data?.forEach((t: any) => {
      if (!t.due_date) return;
      const days = differenceInDays(parseISO(t.due_date), today);
      const overdue = isBefore(parseISO(t.due_date), today);
      if (overdue || days <= 5) items.push({ id: t.id, title: t.title, type: "task", dueDate: t.due_date, daysUntilDue: days, isOverdue: overdue, priority: t.priority });
    });

    milestonesRes.data?.forEach((m: any) => {
      if (!m.due_date) return;
      const days = differenceInDays(parseISO(m.due_date), today);
      const overdue = isBefore(parseISO(m.due_date), today);
      if (overdue || days <= 7) items.push({ id: m.id, title: m.title, type: "milestone", dueDate: m.due_date, daysUntilDue: days, isOverdue: overdue });
    });

    items.sort((a, b) => a.daysUntilDue - b.daysUntilDue);
    setNotifications(items);
    setHasNewNotifications(items.length > 0);
  };

  useEffect(() => {
    fetchAll();
    // Poll every 5 minutes instead of 1 minute + remove realtime channels to reduce connections
    const interval = setInterval(fetchAll, 300000);
    return () => { clearInterval(interval); };
  }, []);

  const getTimeText = (n: NotificationItem) => {
    if (n.isOverdue) return `Atrasado há ${formatDistanceToNow(parseISO(n.dueDate), { locale: ptBR })}`;
    if (n.daysUntilDue === 0) return "Vence hoje!";
    if (n.daysUntilDue === 1) return "Vence amanhã!";
    return `Vence em ${n.daysUntilDue} dias`;
  };

  const getTypeIcon = (type: string) => {
    if (type === "project") return <FolderKanban className="h-4 w-4" />;
    if (type === "task") return <ListTodo className="h-4 w-4" />;
    return <Target className="h-4 w-4" />;
  };

  const getTypeLabel = (type: string) => type === "project" ? "Projeto" : type === "task" ? "Tarefa" : "Marco";

  const overdueCount = notifications.filter(n => n.isOverdue).length;
  const urgentCount = notifications.filter(n => !n.isOverdue && n.daysUntilDue <= 2).length;

  return (
    <div className="relative">
      <Button variant="ghost" size="icon" className="relative h-9 w-9" onClick={() => { setIsOpen(!isOpen); setHasNewNotifications(false); }}>
        <Bell className="h-4 w-4" />
        {notifications.length > 0 && (
          <span className={cn("absolute -top-1 -right-1 h-5 w-5 rounded-full text-xs flex items-center justify-center font-medium",
            overdueCount > 0 ? "bg-destructive text-destructive-foreground" : "bg-amber-500 text-white"
          )}>{notifications.length}</span>
        )}
        {hasNewNotifications && <span className="absolute top-0 right-0 h-2 w-2 rounded-full bg-destructive animate-pulse" />}
      </Button>

      <AnimatePresence>
        {isOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
            <motion.div initial={{ opacity: 0, y: 10, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 10, scale: 0.95 }}
              className="absolute right-0 bottom-full mb-2 w-80 sm:w-96 bg-card border border-border rounded-xl shadow-xl z-50 overflow-hidden">
              {/* Header */}
              <div className="px-4 py-3 border-b border-border bg-muted/50 flex items-center justify-between">
                <div className="flex items-center gap-2"><Bell className="h-4 w-4 text-primary" /><span className="font-medium">Notificações</span></div>
                <div className="flex items-center gap-2">
                  {overdueCount > 0 && <Badge variant="destructive" className="text-xs">{overdueCount} atrasado{overdueCount > 1 ? "s" : ""}</Badge>}
                  {urgentCount > 0 && <Badge className="bg-amber-500 text-white text-xs">{urgentCount} urgente{urgentCount > 1 ? "s" : ""}</Badge>}
                </div>
              </div>

              {/* List */}
              <div className="max-h-[400px] overflow-y-auto">
                {notifications.length === 0 ? (
                  <div className="p-6 text-center text-muted-foreground">
                    <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">Nenhum prazo próximo 🎉</p>
                  </div>
                ) : (
                  <div className="divide-y divide-border">
                    {notifications.map((n) => (
                      <motion.div key={`${n.type}-${n.id}`} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                        className={cn("p-4 hover:bg-muted/50 transition-colors border-l-4",
                          n.isOverdue ? "border-l-destructive" : n.daysUntilDue <= 2 ? "border-l-amber-500" : "border-l-primary"
                        )}>
                        <div className="flex items-start gap-3">
                          <div className={cn("p-2 rounded-lg flex-shrink-0",
                            n.isOverdue ? "text-destructive bg-destructive/10" : n.daysUntilDue <= 2 ? "text-amber-500 bg-amber-500/10" : "text-primary bg-primary/10"
                          )}>
                            {n.isOverdue ? <AlertTriangle className="h-4 w-4" /> : getTypeIcon(n.type)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm truncate">{n.title}</p>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <Badge variant="outline" className="text-[10px] border-border/50">{getTypeLabel(n.type)}</Badge>
                              {n.client && <span className="text-[10px] text-muted-foreground truncate">{n.client}</span>}
                            </div>
                            <p className={cn("text-xs mt-1 font-medium",
                              n.isOverdue ? "text-destructive" : n.daysUntilDue <= 2 ? "text-amber-500" : "text-muted-foreground"
                            )}>{getTimeText(n)}</p>
                          </div>
                          {n.priority && (
                            <Badge variant="outline" className="text-[10px] flex-shrink-0">
                              {n.priority === "urgent" ? "Urgente" : n.priority === "high" ? "Alta" : n.priority === "medium" ? "Média" : "Baixa"}
                            </Badge>
                          )}
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}
              </div>

              {notifications.length > 0 && (
                <div className="px-4 py-3 border-t border-border bg-muted/50">
                  <Button variant="ghost" size="sm" className="w-full text-xs" onClick={() => setIsOpen(false)}>Fechar</Button>
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};
