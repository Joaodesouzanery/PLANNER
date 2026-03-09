import { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import { BarChart3, TrendingUp, Clock, Users, ArrowRight, Download, FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCommercialData } from "./useCommercialData";
import { phaseColors, phaseIconColors } from "./types";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { toast } from "sonner";
import { format } from "date-fns";
import {
  ChartContainer, ChartTooltip, ChartTooltipContent,
} from "@/components/ui/chart";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Cell, Tooltip, ResponsiveContainer } from "recharts";

const FunnelReports = () => {
  const { phases, contacts, allTracking, leafItems, items, getContactProgress } = useCommercialData();

  // Contacts per phase (based on pipeline_stage)
  const contactsPerPhase = useMemo(() => {
    return phases.map((phase, idx) => {
      const count = contacts.filter(c => {
        if (c.pipeline_stage && phases.some(p => p.id === c.pipeline_stage)) {
          return c.pipeline_stage === phase.id;
        }
        const progress = getContactProgress(c.id);
        const phaseIdx = Math.min(Math.floor((progress / 100) * phases.length), phases.length - 1);
        return phases[phaseIdx]?.id === phase.id;
      }).length;
      return { name: phase.title, count, phase, idx };
    });
  }, [phases, contacts, allTracking, leafItems]);

  // Conversion rates between phases
  const conversionRates = useMemo(() => {
    const rates: { from: string; to: string; rate: number; fromCount: number; toCount: number }[] = [];
    for (let i = 0; i < contactsPerPhase.length - 1; i++) {
      const fromCount = contactsPerPhase[i].count;
      const toCount = contactsPerPhase[i + 1].count;
      const rate = fromCount > 0 ? Math.round((toCount / fromCount) * 100) : 0;
      rates.push({
        from: contactsPerPhase[i].name,
        to: contactsPerPhase[i + 1].name,
        rate, fromCount, toCount,
      });
    }
    return rates;
  }, [contactsPerPhase]);

  // Average time in each phase (based on tracking completed_at dates)
  const avgTimePerPhase = useMemo(() => {
    return phases.map(phase => {
      const phaseItems = items.filter(i => i.phase_id === phase.id);
      const phaseItemIds = new Set(phaseItems.map(i => i.id));
      const relevantTracking = allTracking.filter(t => phaseItemIds.has(t.item_id) && t.completed_at);
      
      if (relevantTracking.length === 0) return { name: phase.title, days: 0 };
      
      const durations = relevantTracking.map(t => {
        const created = new Date(t.completed_at!).getTime();
        const now = Date.now();
        return (now - created) / (1000 * 60 * 60 * 24);
      });
      const avg = Math.round(durations.reduce((a, b) => a + b, 0) / durations.length);
      return { name: phase.title, days: avg };
    });
  }, [phases, items, allTracking]);

  // Overall funnel metrics
  const totalContacts = contacts.length;
  const completedContacts = contacts.filter(c => getContactProgress(c.id) === 100).length;
  const overallConversion = totalContacts > 0 ? Math.round((completedContacts / totalContacts) * 100) : 0;
  const avgProgress = totalContacts > 0 ? Math.round(contacts.reduce((s, c) => s + getContactProgress(c.id), 0) / totalContacts) : 0;

  const barColors = ["#3b82f6", "#8b5cf6", "#f59e0b", "#10b981", "#ec4899", "#06b6d4", "#f97316"];

  const chartConfig = phases.reduce((acc, p, i) => {
    acc[p.title] = { label: p.title, color: barColors[i % barColors.length] };
    return acc;
  }, {} as Record<string, { label: string; color: string }>);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div>
        <h2 className="text-lg font-heading font-bold text-foreground flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-primary" /> Relatórios do Funil
        </h2>
        <p className="text-sm text-muted-foreground">Métricas e conversão entre fases</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Total no Funil", value: totalContacts, icon: Users, color: "text-primary", bg: "bg-primary/10", border: "border-primary/20" },
          { label: "Convertidos", value: completedContacts, icon: TrendingUp, color: "text-emerald-500", bg: "bg-emerald-500/10", border: "border-emerald-500/20" },
          { label: "Taxa Conversão", value: `${overallConversion}%`, icon: BarChart3, color: "text-amber-500", bg: "bg-amber-500/10", border: "border-amber-500/20" },
          { label: "Progresso Médio", value: `${avgProgress}%`, icon: Clock, color: "text-blue-400", bg: "bg-blue-500/10", border: "border-blue-500/20" },
        ].map(s => (
          <Card key={s.label} className={cn("border", s.border)}>
            <CardContent className="p-3 sm:p-4 flex items-center gap-2.5">
              <div className={cn("p-1.5 sm:p-2 rounded-lg", s.bg)}><s.icon className={cn("h-4 w-4 sm:h-5 sm:w-5", s.color)} /></div>
              <div><p className="text-lg sm:text-2xl font-bold">{s.value}</p><p className="text-[10px] sm:text-xs text-muted-foreground">{s.label}</p></div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Funnel Bar Chart */}
      <Card>
        <CardContent className="p-4 sm:p-6">
          <h3 className="font-semibold text-sm mb-4">Contatos por Fase do Funil</h3>
          <div className="h-[250px] sm:h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={contactsPerPhase} layout="vertical" margin={{ left: 20, right: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis type="number" tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} />
                <YAxis dataKey="name" type="category" width={120} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                <Tooltip
                  contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "12px" }}
                  formatter={(value: number) => [`${value} contatos`, "Quantidade"]}
                />
                <Bar dataKey="count" radius={[0, 6, 6, 0]} barSize={24}>
                  {contactsPerPhase.map((entry, i) => (
                    <Cell key={i} fill={barColors[i % barColors.length]} fillOpacity={0.8} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Conversion Rates */}
      <Card>
        <CardContent className="p-4 sm:p-6">
          <h3 className="font-semibold text-sm mb-4">Taxa de Conversão entre Fases</h3>
          <div className="space-y-3">
            {conversionRates.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Crie fases no funil para ver as taxas de conversão</p>
            ) : (
              conversionRates.map((cr, i) => (
                <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 border border-border/50">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 text-sm">
                      <Badge variant="outline" className={cn("text-[10px]", phaseIconColors[i % phaseIconColors.length])}>
                        {cr.from}
                      </Badge>
                      <ArrowRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <Badge variant="outline" className={cn("text-[10px]", phaseIconColors[(i + 1) % phaseIconColors.length])}>
                        {cr.to}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">{cr.fromCount} → {cr.toCount} contatos</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className={cn("text-lg font-bold", cr.rate >= 50 ? "text-emerald-500" : cr.rate >= 25 ? "text-amber-500" : "text-red-500")}>
                      {cr.rate}%
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* Average Time per Phase */}
      <Card>
        <CardContent className="p-4 sm:p-6">
          <h3 className="font-semibold text-sm mb-4 flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" /> Tempo Médio por Fase (dias)
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {avgTimePerPhase.map((p, i) => (
              <div key={i} className={cn("p-3 rounded-lg border bg-gradient-to-r", phaseColors[i % phaseColors.length])}>
                <p className="text-xs text-muted-foreground truncate">{p.name}</p>
                <p className="text-xl font-bold mt-1">{p.days}<span className="text-xs font-normal text-muted-foreground ml-1">dias</span></p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
};

export default FunnelReports;
