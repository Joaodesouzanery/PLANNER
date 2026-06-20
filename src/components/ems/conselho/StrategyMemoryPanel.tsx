import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Compass, Flag, Target } from "lucide-react";
import { TrueNorthPanel } from "@/components/ems/TrueNorthPanel";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { cn } from "@/lib/utils";
import { dateLabel } from "./boardShared";

export const StrategyMemoryPanel = () => {
  const { selectedCompanyId } = useCompany();
  const hasCompanyFilter = selectedCompanyId !== "all";
  const companyFilter = (q: any) => hasCompanyFilter ? q.eq("company_id", selectedCompanyId) : q;
  const now = new Date();

  const { data: pillars = [] } = useQuery({
    queryKey: ["board-pillars", selectedCompanyId],
    staleTime: 1000 * 60 * 3,
    queryFn: async () => {
      const { data, error } = await companyFilter((supabase as any).from("strategic_pillars").select("*").order("order_index", { ascending: true, nullsFirst: false }));
      if (error) throw error;
      return data || [];
    },
  });

  const { data: okrs = [] } = useQuery({
    queryKey: ["board-okrs", selectedCompanyId],
    staleTime: 1000 * 60 * 3,
    queryFn: async () => {
      const { data, error } = await companyFilter((supabase as any).from("okrs").select("*").order("end_date", { ascending: true, nullsFirst: false }));
      if (error) throw error;
      return data || [];
    },
  });

  const { data: focus = [] } = useQuery({
    queryKey: ["board-monthly-focus", selectedCompanyId, now.getFullYear(), now.getMonth() + 1],
    staleTime: 1000 * 60 * 3,
    queryFn: async () => {
      const { data, error } = await companyFilter(
        (supabase as any).from("monthly_focus").select("*").eq("year", now.getFullYear()).eq("month", now.getMonth() + 1),
      );
      if (error) throw error;
      return data || [];
    },
  });

  const okrView = useMemo(() => (okrs as any[]).map((o) => {
    const progress = o.target_value > 0 ? Math.round((o.current_value / o.target_value) * 100) : 0;
    const atRisk = progress < 50 && !!o.end_date;
    return { ...o, progress, atRisk };
  }), [okrs]);

  const avgOkr = okrView.length ? Math.round(okrView.reduce((s, o) => s + o.progress, 0) / okrView.length) : 0;

  return (
    <div className="space-y-4">
      <TrueNorthPanel />

      <div className="grid gap-4 xl:grid-cols-[1fr_1fr]">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><Compass className="h-4 w-4 text-primary" /> Pilares estratégicos</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {(pillars as any[]).length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">Nenhum pilar definido. Configure em Dashboard/Planejamento.</p>
            ) : (pillars as any[]).map((p) => (
              <div key={p.id} className="rounded-lg border p-3">
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: p.color || "hsl(var(--primary))" }} />
                  <p className="text-sm font-semibold truncate">{p.title}</p>
                </div>
                {p.description && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{p.description}</p>}
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2"><Target className="h-4 w-4 text-primary" /> OKRs <Badge variant="outline" className="ml-auto text-[10px]">média {avgOkr}%</Badge></CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {okrView.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">Nenhum OKR cadastrado.</p>
            ) : okrView.map((o) => (
              <div key={o.id} className="rounded-lg border p-3 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium truncate">{o.title}</p>
                  <Badge variant={o.atRisk ? "destructive" : "secondary"} className="text-[10px] shrink-0">{o.progress}%</Badge>
                </div>
                <Progress value={Math.min(100, o.progress)} className={cn("h-2", o.atRisk && "[&>div]:bg-red-500")} />
                <div className="flex justify-between text-[11px] text-muted-foreground">
                  <span>{o.current_value}/{o.target_value} {o.unit || ""}</span>
                  {o.end_date && <span>até {dateLabel(o.end_date)}</span>}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><Flag className="h-4 w-4 text-primary" /> Foco do mês</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {(focus as any[]).length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Nenhum foco definido para este mês.</p>
          ) : (focus as any[]).map((f) => (
            <div key={f.id} className="rounded-lg border p-3">
              <p className="text-sm font-semibold">{f.title}</p>
              {f.description && <p className="text-xs text-muted-foreground mt-1">{f.description}</p>}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
};
