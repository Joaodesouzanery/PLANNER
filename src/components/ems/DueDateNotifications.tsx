import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bell, X, Calendar, AlertTriangle, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { formatDistanceToNow, differenceInDays, parseISO, isAfter, isBefore, addDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface Project {
  id: string;
  title: string;
  due_date: string | null;
  status: string;
  priority: string;
  client: string | null;
}

interface DueDateNotification {
  project: Project;
  daysUntilDue: number;
  isOverdue: boolean;
}

export const DueDateNotifications = () => {
  const [notifications, setNotifications] = useState<DueDateNotification[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [hasNewNotifications, setHasNewNotifications] = useState(false);

  const fetchUpcomingTasks = async () => {
    const { data } = await supabase
      .from("projects")
      .select("*")
      .not("due_date", "is", null)
      .neq("status", "done")
      .order("due_date", { ascending: true });

    if (data) {
      const today = new Date();
      const upcomingNotifications: DueDateNotification[] = [];

      data.forEach((project: Project) => {
        if (!project.due_date) return;
        
        const dueDate = parseISO(project.due_date);
        const daysUntilDue = differenceInDays(dueDate, today);
        const isOverdue = isBefore(dueDate, today);
        
        // Show notifications for overdue tasks and tasks due within 7 days
        if (isOverdue || daysUntilDue <= 7) {
          upcomingNotifications.push({
            project,
            daysUntilDue,
            isOverdue,
          });
        }
      });

      setNotifications(upcomingNotifications);
      setHasNewNotifications(upcomingNotifications.length > 0);
    }
  };

  useEffect(() => {
    fetchUpcomingTasks();
    
    // Set up realtime subscription
    const channel = supabase
      .channel("projects-notifications")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "projects" },
        () => {
          fetchUpcomingTasks();
        }
      )
      .subscribe();

    // Check every minute for new notifications
    const interval = setInterval(fetchUpcomingTasks, 60000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, []);

  const getNotificationColor = (notification: DueDateNotification) => {
    if (notification.isOverdue) return "text-destructive bg-destructive/10 border-destructive/30";
    if (notification.daysUntilDue <= 1) return "text-destructive bg-destructive/10 border-destructive/30";
    if (notification.daysUntilDue <= 3) return "text-amber-500 bg-amber-500/10 border-amber-500/30";
    return "text-primary bg-primary/10 border-primary/30";
  };

  const getTimeText = (notification: DueDateNotification) => {
    if (notification.isOverdue) {
      return `Atrasado há ${formatDistanceToNow(parseISO(notification.project.due_date!), { locale: ptBR })}`;
    }
    if (notification.daysUntilDue === 0) return "Vence hoje!";
    if (notification.daysUntilDue === 1) return "Vence amanhã!";
    return `Vence em ${notification.daysUntilDue} dias`;
  };

  const overdueCount = notifications.filter(n => n.isOverdue).length;
  const urgentCount = notifications.filter(n => !n.isOverdue && n.daysUntilDue <= 3).length;

  return (
    <div className="relative">
      <Button
        variant="ghost"
        size="icon"
        className="relative h-9 w-9"
        onClick={() => {
          setIsOpen(!isOpen);
          setHasNewNotifications(false);
        }}
      >
        <Bell className="h-4 w-4" />
        {notifications.length > 0 && (
          <span className={cn(
            "absolute -top-1 -right-1 h-5 w-5 rounded-full text-xs flex items-center justify-center font-medium",
            overdueCount > 0 
              ? "bg-destructive text-destructive-foreground" 
              : "bg-amber-500 text-white"
          )}>
            {notifications.length}
          </span>
        )}
        {hasNewNotifications && (
          <span className="absolute top-0 right-0 h-2 w-2 rounded-full bg-destructive animate-pulse" />
        )}
      </Button>

      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <div 
              className="fixed inset-0 z-40" 
              onClick={() => setIsOpen(false)}
            />
            
            {/* Notification Panel */}
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              className="absolute right-0 top-full mt-2 w-80 sm:w-96 bg-card border border-border rounded-xl shadow-xl z-50 overflow-hidden"
            >
              {/* Header */}
              <div className="px-4 py-3 border-b border-border bg-muted/50 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Bell className="h-4 w-4 text-primary" />
                  <span className="font-medium">Notificações</span>
                </div>
                <div className="flex items-center gap-2">
                  {overdueCount > 0 && (
                    <Badge variant="destructive" className="text-xs">
                      {overdueCount} atrasado{overdueCount > 1 ? "s" : ""}
                    </Badge>
                  )}
                  {urgentCount > 0 && (
                    <Badge className="bg-amber-500 text-white text-xs">
                      {urgentCount} urgente{urgentCount > 1 ? "s" : ""}
                    </Badge>
                  )}
                </div>
              </div>

              {/* Notifications List */}
              <div className="max-h-[400px] overflow-y-auto">
                {notifications.length === 0 ? (
                  <div className="p-6 text-center text-muted-foreground">
                    <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">Nenhuma tarefa próxima do vencimento</p>
                  </div>
                ) : (
                  <div className="divide-y divide-border">
                    {notifications.map((notification) => (
                      <motion.div
                        key={notification.project.id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        className={cn(
                          "p-4 hover:bg-muted/50 transition-colors border-l-4",
                          notification.isOverdue 
                            ? "border-l-destructive" 
                            : notification.daysUntilDue <= 3 
                              ? "border-l-amber-500" 
                              : "border-l-primary"
                        )}
                      >
                        <div className="flex items-start gap-3">
                          <div className={cn(
                            "p-2 rounded-lg flex-shrink-0",
                            getNotificationColor(notification)
                          )}>
                            {notification.isOverdue ? (
                              <AlertTriangle className="h-4 w-4" />
                            ) : (
                              <Calendar className="h-4 w-4" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm truncate">
                              {notification.project.title}
                            </p>
                            {notification.project.client && (
                              <p className="text-xs text-muted-foreground truncate">
                                {notification.project.client}
                              </p>
                            )}
                            <p className={cn(
                              "text-xs mt-1 font-medium",
                              notification.isOverdue 
                                ? "text-destructive" 
                                : notification.daysUntilDue <= 3 
                                  ? "text-amber-500" 
                                  : "text-muted-foreground"
                            )}>
                              {getTimeText(notification)}
                            </p>
                          </div>
                          <Badge variant="outline" className="text-xs flex-shrink-0">
                            {notification.project.priority === "high" && "Alta"}
                            {notification.project.priority === "medium" && "Média"}
                            {notification.project.priority === "low" && "Baixa"}
                          </Badge>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}
              </div>

              {/* Footer */}
              {notifications.length > 0 && (
                <div className="px-4 py-3 border-t border-border bg-muted/50">
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="w-full text-xs"
                    onClick={() => setIsOpen(false)}
                  >
                    Fechar
                  </Button>
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};
