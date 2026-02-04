import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Clock, CheckCircle, Plus, Edit2, Trash2, DollarSign, BookOpen } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface ActivityItem {
  id: string;
  type: "project" | "financial" | "knowledge";
  action: "created" | "updated" | "completed" | "deleted";
  title: string;
  timestamp: string;
}

export const RecentActivity = () => {
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRecentActivities();
  }, []);

  const fetchRecentActivities = async () => {
    try {
      // Fetch recent projects
      const { data: projects } = await supabase
        .from("projects")
        .select("id, title, created_at, updated_at, status")
        .order("updated_at", { ascending: false })
        .limit(5);

      // Fetch recent transactions
      const { data: transactions } = await supabase
        .from("financial_transactions")
        .select("id, description, created_at, type, amount")
        .order("created_at", { ascending: false })
        .limit(3);

      // Fetch recent execution records
      const { data: records } = await supabase
        .from("execution_records")
        .select("id, action_taken, created_at")
        .order("created_at", { ascending: false })
        .limit(3);

      const allActivities: ActivityItem[] = [];

      // Add project activities
      projects?.forEach((p) => {
        allActivities.push({
          id: p.id,
          type: "project",
          action: p.status === "done" ? "completed" : "updated",
          title: p.title,
          timestamp: p.updated_at,
        });
      });

      // Add financial activities
      transactions?.forEach((t) => {
        allActivities.push({
          id: t.id,
          type: "financial",
          action: "created",
          title: `${t.type === "income" ? "Receita" : "Despesa"}: ${t.description}`,
          timestamp: t.created_at,
        });
      });

      // Add knowledge base activities
      records?.forEach((r) => {
        allActivities.push({
          id: r.id,
          type: "knowledge",
          action: "created",
          title: r.action_taken,
          timestamp: r.created_at,
        });
      });

      // Sort by timestamp and take top 10
      allActivities.sort((a, b) => 
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );

      setActivities(allActivities.slice(0, 10));
    } catch (error) {
      console.error("Error fetching activities:", error);
    } finally {
      setLoading(false);
    }
  };

  const getActivityIcon = (type: string, action: string) => {
    if (action === "completed") return CheckCircle;
    if (type === "financial") return DollarSign;
    if (type === "knowledge") return BookOpen;
    if (action === "created") return Plus;
    if (action === "updated") return Edit2;
    if (action === "deleted") return Trash2;
    return Clock;
  };

  const getActivityColor = (type: string, action: string) => {
    if (action === "completed") return "text-emerald-500 bg-emerald-500/10";
    if (type === "financial") return "text-primary bg-primary/10";
    if (type === "knowledge") return "text-blue-500 bg-blue-500/10";
    return "text-muted-foreground bg-muted";
  };

  const getTypeBadge = (type: string) => {
    switch (type) {
      case "project":
        return <Badge variant="outline" className="text-xs">Projeto</Badge>;
      case "financial":
        return <Badge variant="outline" className="text-xs">Finanças</Badge>;
      case "knowledge":
        return <Badge variant="outline" className="text-xs">Knowledge</Badge>;
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Atividade Recente</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-center gap-3 animate-pulse">
                <div className="h-8 w-8 rounded-full bg-muted" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-muted rounded w-3/4" />
                  <div className="h-3 bg-muted rounded w-1/4" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Clock className="h-5 w-5 text-primary" />
          Atividade Recente
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {activities.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">
              Nenhuma atividade recente
            </p>
          ) : (
            activities.map((activity, index) => {
              const Icon = getActivityIcon(activity.type, activity.action);
              const colorClass = getActivityColor(activity.type, activity.action);
              
              return (
                <motion.div
                  key={activity.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="flex items-start gap-3"
                >
                  <div className={`p-2 rounded-full ${colorClass} flex-shrink-0`}>
                    <Icon className="h-3 w-3" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{activity.title}</p>
                    <div className="flex items-center gap-2 mt-1">
                      {getTypeBadge(activity.type)}
                      <span className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(activity.timestamp), {
                          addSuffix: true,
                          locale: ptBR,
                        })}
                      </span>
                    </div>
                  </div>
                </motion.div>
              );
            })
          )}
        </div>
      </CardContent>
    </Card>
  );
};
