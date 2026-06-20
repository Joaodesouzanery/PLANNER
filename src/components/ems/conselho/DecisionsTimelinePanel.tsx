import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { History } from "lucide-react";
import { DecisionLogPanel } from "@/components/ems/DecisionLogPanel";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { dateLabel } from "./boardShared";

const toneClass: Record<string, string> = {
  Decisão: "bg-indigo-500/10 text-indigo-600 border-indigo-500/30",
  Ata: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30",
  Registro: "bg-amber-500/10 text-amber-600 border-amber-500/30",
};

export const DecisionsTimelinePanel = () => {
  const { selectedCompanyId } = useCompany();
  const hasCompanyFilter = selectedCompanyId !== "all";
  const companyFilter = (q: any) => hasCompanyFilter ? q.eq("company_id", selectedCompanyId) : q;

  const { data: decisions = [] } = useQuery({
    queryKey: ["board-decisions-timeline", selectedCompanyId],
    staleTime: 1000 * 60 * 2,
    queryFn: async () => {
      const { data, error } = await companyFilter(
        (supabase as any).from("decision_logs").select("id,title,decision,created_at,review_date").order("created_at", { ascending: false }).limit(30),
      );
      if (error) throw error;
      return data || [];
    },
  });

  const { data: reviews = [] } = useQuery({
    queryKey: ["board-reviews-timeline", selectedCompanyId],
    staleTime: 1000 * 60 * 2,
    queryFn: async () => {
      const { data, error } = await companyFilter(
        (supabase as any).from("review_cycles").select("id,cycle_type,period_start,summary").order("period_start", { ascending: false }).limit(20),
      );
      if (error) throw error;
      return data || [];
    },
  });

  const { data: govLogs = [] } = useQuery({
    queryKey: ["board-govlogs-timeline", selectedCompanyId],
    staleTime: 1000 * 60 * 2,
    queryFn: async () => {
      const { data, error } = await companyFilter(
        (supabase as any).from("governance_logs").select("id,title,notes,category,happened_at").order("happened_at", { ascending: false }).limit(30),
      );
      if (error) throw error;
      return data || [];
    },
  });

  const timeline = useMemo(() => {
    const items = [
      ...(decisions as any[]).map((d) => ({ id: `d-${d.id}`, type: "Decisão", date: (d.created_at || "").slice(0, 10), title: d.title, detail: d.decision })),
      ...(reviews as any[]).map((r) => ({ id: `r-${r.id}`, type: "Ata", date: r.period_start, title: `Reunião ${r.cycle_type}`, detail: r.summary })),
      ...(govLogs as any[]).map((g) => ({ id: `g-${g.id}`, type: "Registro", date: g.happened_at, title: g.title, detail: g.notes })),
    ];
    return items.filter((i) => i.date).sort((a, b) => String(b.date).localeCompare(String(a.date))).slice(0, 40);
  }, [decisions, reviews, govLogs]);

  return (
    <div className="grid gap-4 xl:grid-cols-[1fr_1fr]">
      <DecisionLogPanel />
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><History className="h-4 w-4 text-primary" /> Memória executiva</CardTitle></CardHeader>
        <CardContent className="space-y-2 max-h-[640px] overflow-y-auto">
          {timeline.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">Sem registros de decisões, atas ou histórico ainda.</p>
          ) : timeline.map((item) => (
            <div key={item.id} className="flex gap-3 rounded-lg border p-3">
              <div className="flex flex-col items-center">
                <Badge variant="outline" className={`text-[10px] ${toneClass[item.type] || ""}`}>{item.type}</Badge>
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold truncate">{item.title}</p>
                  <span className="text-[11px] text-muted-foreground shrink-0">{dateLabel(item.date)}</span>
                </div>
                {item.detail && <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{item.detail}</p>}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
};
