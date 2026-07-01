import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import { Target, Trash2, CheckCircle, ExternalLink, Calendar, ArrowRight, FileDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { usePlanningData } from "@/hooks/usePlanningData";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { exportTablePdf } from "@/lib/exportPdf";
import { toast } from "sonner";

const statusConfig: Record<string, { label: string; color: string }> = {
  pending: { label: "Pendente", color: "text-muted-foreground bg-muted/50 border-border/50" },
  in_progress: { label: "Em Andamento", color: "text-primary bg-primary/10 border-primary/30" },
  completed: { label: "Concluída", color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/30" },
  on_hold: { label: "Pausada", color: "text-amber-400 bg-amber-500/10 border-amber-500/30" },
  cancelled: { label: "Cancelada", color: "text-destructive bg-destructive/10 border-destructive/30" },
};

const FinanceMetas = () => {
  const { goals, deleteGoal, saveGoal } = usePlanningData();
  const navigate = useNavigate();
  const [filter, setFilter] = useState<"all" | "pending" | "in_progress" | "completed">("all");

  const financialGoals = goals.filter(g => g.category === "financial");
  const filtered = filter === "all" ? financialGoals : financialGoals.filter(g => g.status === filter);

  const markCompleted = (id: string, currentGoal: typeof goals[0]) => {
    saveGoal({
      editId: id,
      form: {
        title: currentGoal.title,
        description: currentGoal.description || "",
        category: "financial",
        status: "completed",
        start_date: currentGoal.start_date || "",
        end_date: currentGoal.end_date || "",
        parent_id: currentGoal.parent_id || "",
        okr_id: "",
        project_id: "",
      },
    });
  };

  const stats = {
    total: financialGoals.length,
    completed: financialGoals.filter(g => g.status === "completed").length,
    inProgress: financialGoals.filter(g => g.status === "in_progress").length,
    pending: financialGoals.filter(g => g.status === "pending").length,
  };

  const exportMetas = async () => {
    try {
      await exportTablePdf({
        title: "Metas financeiras",
        subtitle: `gerado em ${new Date().toLocaleString("pt-BR")}`,
        filename: "metas-financeiras.pdf",
        sections: [
          { heading: "Resumo", head: [["Indicador", "Qtd."]], body: [["Total", stats.total], ["Pendentes", stats.pending], ["Em andamento", stats.inProgress], ["Concluídas", stats.completed]] },
          { heading: "Metas", head: [["Meta", "Status", "Prazo", "Descrição"]], body: financialGoals.length ? financialGoals.map((g) => [g.title, statusConfig[g.status]?.label || g.status, g.end_date ? format(new Date(g.end_date), "dd/MM/yyyy") : "-", g.description || "-"]) : [["—", "—", "—", "—"]] },
        ],
      });
      toast.success("Metas exportadas!");
    } catch (err: any) {
      toast.error("Falha ao exportar", { description: err?.message });
    }
  };

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Total", value: stats.total, color: "text-primary" },
          { label: "Pendentes", value: stats.pending, color: "text-muted-foreground" },
          { label: "Em Andamento", value: stats.inProgress, color: "text-amber-400" },
          { label: "Concluídas", value: stats.completed, color: "text-emerald-400" },
        ].map(s => (
          <Card key={s.label} className="border-border/50 bg-card/60">
            <CardContent className="p-3 md:p-4">
              <p className={cn("text-xl md:text-2xl font-bold font-mono", s.color)}>{s.value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filter */}
      <div className="flex gap-2 flex-wrap">
        {(["all", "pending", "in_progress", "completed"] as const).map(f => (
          <Button key={f} variant={filter === f ? "default" : "outline"} size="sm" onClick={() => setFilter(f)} className="text-xs h-7">
            {f === "all" ? "Todas" : statusConfig[f]?.label}
          </Button>
        ))}
        <Button variant="outline" size="sm" onClick={exportMetas} className="text-xs h-7 ml-auto gap-1">
          <FileDown className="h-3 w-3" /> Exportar
        </Button>
        <Button variant="ghost" size="sm" onClick={() => navigate("/ems/planning")} className="text-xs h-7 text-muted-foreground hover:text-foreground gap-1">
          Ver em Planejamento <ArrowRight className="h-3 w-3" />
        </Button>
      </div>

      {/* Goals list */}
      {filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <div className="p-4 rounded-full bg-muted/40 w-fit mx-auto mb-3">
            <Target className="h-7 w-7 text-muted-foreground/50" />
          </div>
          <p className="text-sm">Nenhuma meta financeira ainda.</p>
          <p className="text-xs mt-1">Use a Calculadora ou Parcelas para criar metas.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((goal, i) => {
            const sc = statusConfig[goal.status] || statusConfig.pending;
            return (
              <motion.div key={goal.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
                <Card className={cn("border-border/50 bg-card/60 hover:bg-card/80 transition-colors", goal.status === "completed" && "opacity-70")}>
                  <CardContent className="p-3 md:p-4 flex items-start gap-3">
                    <div className="p-1.5 rounded-lg bg-primary/10 mt-0.5 shrink-0">
                      <Target className="h-3.5 w-3.5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <h4 className={cn("font-medium text-sm leading-tight", goal.status === "completed" && "line-through text-muted-foreground")}>
                          {goal.title}
                        </h4>
                        <Badge variant="outline" className={cn("text-[10px] shrink-0 border", sc.color)}>{sc.label}</Badge>
                      </div>
                      {goal.description && (
                        <p className="text-xs text-muted-foreground mt-1">{goal.description}</p>
                      )}
                      {goal.end_date && (
                        <p className="text-[10px] text-muted-foreground flex items-center gap-1 mt-1.5">
                          <Calendar className="h-3 w-3" />
                          Prazo: {format(new Date(goal.end_date), "dd 'de' MMM 'de' yyyy", { locale: ptBR })}
                        </p>
                      )}
                    </div>
                    <div className="flex gap-1 shrink-0">
                      {goal.status !== "completed" && (
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-emerald-400" title="Marcar como concluída" onClick={() => markCompleted(goal.id, goal)}>
                          <CheckCircle className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-primary" title="Ver em Planejamento" onClick={() => navigate("/ems/planning")}>
                        <ExternalLink className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" title="Excluir" onClick={() => deleteGoal(goal.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default FinanceMetas;
