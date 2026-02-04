import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { TrendingUp, TrendingDown, Target, CheckCircle, Clock, AlertTriangle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

interface Stats {
  totalProjects: number;
  completedProjects: number;
  pendingProjects: number;
  overdueProjects: number;
  completionRate: number;
  totalRevenue: number;
  totalExpenses: number;
  netBalance: number;
}

interface QuickStatsProps {
  variant?: "compact" | "full";
}

export const QuickStats = ({ variant = "full" }: QuickStatsProps) => {
  const [stats, setStats] = useState<Stats>({
    totalProjects: 0,
    completedProjects: 0,
    pendingProjects: 0,
    overdueProjects: 0,
    completionRate: 0,
    totalRevenue: 0,
    totalExpenses: 0,
    netBalance: 0,
  });

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    const today = new Date().toISOString().split("T")[0];

    // Fetch projects stats
    const { data: projects } = await supabase.from("projects").select("*");
    
    // Fetch financial stats
    const { data: transactions } = await supabase.from("financial_transactions").select("*");

    if (projects) {
      const completed = projects.filter((p) => p.status === "done").length;
      const overdue = projects.filter(
        (p) => p.due_date && p.due_date < today && p.status !== "done"
      ).length;

      const totalRevenue = transactions?.reduce(
        (acc, t) => (t.type === "income" ? acc + Number(t.amount) : acc),
        0
      ) || 0;
      
      const totalExpenses = transactions?.reduce(
        (acc, t) => (t.type === "expense" ? acc + Number(t.amount) : acc),
        0
      ) || 0;

      setStats({
        totalProjects: projects.length,
        completedProjects: completed,
        pendingProjects: projects.length - completed,
        overdueProjects: overdue,
        completionRate: projects.length > 0 ? Math.round((completed / projects.length) * 100) : 0,
        totalRevenue,
        totalExpenses,
        netBalance: totalRevenue - totalExpenses,
      });
    }
  };

  const statItems = variant === "compact" 
    ? [
        {
          label: "Concluídos",
          value: stats.completedProjects,
          icon: CheckCircle,
          color: "text-emerald-500",
          bgColor: "bg-emerald-500/10",
        },
        {
          label: "Pendentes",
          value: stats.pendingProjects,
          icon: Clock,
          color: "text-amber-500",
          bgColor: "bg-amber-500/10",
        },
        {
          label: "Atrasados",
          value: stats.overdueProjects,
          icon: AlertTriangle,
          color: "text-destructive",
          bgColor: "bg-destructive/10",
        },
      ]
    : [
        {
          label: "Taxa de Conclusão",
          value: `${stats.completionRate}%`,
          icon: Target,
          color: "text-primary",
          bgColor: "bg-primary/10",
          trend: stats.completionRate >= 50 ? "up" : "down",
        },
        {
          label: "Projetos Concluídos",
          value: stats.completedProjects,
          icon: CheckCircle,
          color: "text-emerald-500",
          bgColor: "bg-emerald-500/10",
        },
        {
          label: "Projetos Pendentes",
          value: stats.pendingProjects,
          icon: Clock,
          color: "text-amber-500",
          bgColor: "bg-amber-500/10",
        },
        {
          label: "Projetos Atrasados",
          value: stats.overdueProjects,
          icon: AlertTriangle,
          color: "text-destructive",
          bgColor: "bg-destructive/10",
        },
        {
          label: "Saldo Líquido",
          value: new Intl.NumberFormat("pt-BR", {
            style: "currency",
            currency: "BRL",
          }).format(stats.netBalance),
          icon: stats.netBalance >= 0 ? TrendingUp : TrendingDown,
          color: stats.netBalance >= 0 ? "text-emerald-500" : "text-destructive",
          bgColor: stats.netBalance >= 0 ? "bg-emerald-500/10" : "bg-destructive/10",
          trend: stats.netBalance >= 0 ? "up" : "down",
        },
      ];

  return (
    <div className={cn(
      "grid gap-4",
      variant === "compact" 
        ? "grid-cols-3" 
        : "grid-cols-2 md:grid-cols-3 lg:grid-cols-5"
    )}>
      {statItems.map((item, index) => (
        <motion.div
          key={item.label}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.1 }}
        >
          <Card className="hover:border-primary/30 transition-colors">
            <CardContent className={cn(
              "flex items-center gap-3",
              variant === "compact" ? "p-3" : "p-4"
            )}>
              <div className={cn("p-2 rounded-lg", item.bgColor)}>
                <item.icon className={cn("h-4 w-4", item.color)} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground truncate">{item.label}</p>
                <p className={cn(
                  "font-bold truncate",
                  variant === "compact" ? "text-lg" : "text-xl"
                )}>
                  {item.value}
                </p>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      ))}
    </div>
  );
};
