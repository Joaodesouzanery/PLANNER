import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import type { HealthSnapshot } from "./boardHealthTrend";

// Série temporal de board_health_snapshots (gravada 1x/dia por useBoardHealth). Últimos N dias.
const db = supabase as any;
const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString().slice(0, 10);
const safe = async (build: () => any): Promise<any[]> => {
  try { const { data, error } = await build(); if (error) return []; return data ?? []; } catch { return []; }
};

export const useBoardHealthTrend = (days = 90) => {
  const { selectedCompanyId } = useCompany();
  const scoped = selectedCompanyId && selectedCompanyId !== "all";
  const query = useQuery({
    queryKey: ["board-health-trend", selectedCompanyId, days],
    staleTime: 300_000,
    queryFn: async () => {
      // Espelha a gravação de useBoardHealth: company específica → eq; "all" → company_id null.
      const co = (q: any) => (scoped ? q.eq("company_id", selectedCompanyId) : q.is("company_id", null));
      return safe(() => co(
        db.from("board_health_snapshots")
          .select("snapshot_date,overall_score,financial_score,risk_score,governance_score,compliance_score")
          .gte("snapshot_date", daysAgo(days))
          .order("snapshot_date", { ascending: true }),
      ));
    },
  });
  return (query.data ?? []) as HealthSnapshot[];
};
