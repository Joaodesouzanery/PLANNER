import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useCompany } from "@/contexts/CompanyContext";
import { supabase } from "@/integrations/supabase/client";
import { fmtCurrency } from "./useFinanceData";

interface PlannedImpact {
  id: string;
  project_id: string | null;
  title: string;
  impact_type: string | null;
  expected_amount: number | null;
  expected_date: string | null;
  confidence: string | null;
  status: string | null;
  projects?: { title: string | null } | null;
}

const missingTable = (error: any) =>
  error?.code === "42P01" || error?.code === "PGRST205" || String(error?.message || "").includes("Could not find the table");

const confidenceWeight = (confidence?: string | null) => confidence === "high" ? 90 : confidence === "low" ? 35 : 60;

const FinancePlannedImpacts = () => {
  const { selectedCompanyId } = useCompany();
  const { data = [] } = useQuery({
    queryKey: ["finance-planned-impacts", selectedCompanyId],
    queryFn: async () => {
      let query = (supabase as any)
        .from("planning_financial_impacts")
        .select("id, project_id, title, impact_type, expected_amount, expected_date, confidence, status, projects(title)")
        .order("expected_date", { ascending: true });
      if (selectedCompanyId !== "all") query = query.eq("company_id", selectedCompanyId);
      const { data, error } = await query;
      if (missingTable(error)) return [] as PlannedImpact[];
      if (error) throw error;
      return (data || []) as PlannedImpact[];
    },
    retry: false,
  });

  const totals = useMemo(() => data.reduce((acc, item) => {
    const amount = Number(item.expected_amount || 0);
    const signed = item.impact_type === "cost" ? -amount : amount;
    if (item.impact_type === "revenue") acc.revenue += amount;
    if (item.impact_type === "cost") acc.cost += amount;
    if (item.impact_type === "cash") acc.cash += amount;
    if (item.impact_type === "margin") acc.margin += amount;
    acc.net += signed;
    acc.weighted += signed * (confidenceWeight(item.confidence) / 100);
    return acc;
  }, { revenue: 0, cost: 0, cash: 0, margin: 0, net: 0, weighted: 0 }), [data]);

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-5">
        {[
          ["Receita prevista", totals.revenue],
          ["Custos previstos", totals.cost],
          ["Caixa previsto", totals.cash],
          ["Liquido planejado", totals.net],
          ["Ponderado", totals.weighted],
        ].map(([label, value]) => (
          <Card key={label as string}>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className="text-xl font-bold font-mono">{fmtCurrency(Number(value))}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Impactos planejados por projeto</CardTitle>
          <p className="text-sm text-muted-foreground">Projecoes vindas de Planejamento e Metas. Nao entram como receita/despesa real ate virarem lancamento.</p>
        </CardHeader>
        <CardContent className="space-y-3">
          {data.map((item) => (
            <div key={item.id} className="rounded-lg border border-border/60 p-3">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <p className="font-semibold truncate">{item.title}</p>
                  <p className="text-xs text-muted-foreground">{item.projects?.title || "Empresa inteira"} - {item.expected_date || "sem data"}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge variant={item.impact_type === "cost" ? "destructive" : "secondary"}>{fmtCurrency(Number(item.expected_amount || 0))}</Badge>
                  <Badge variant="outline">{item.confidence || "medium"}</Badge>
                  <Badge variant="outline">{item.status || "planned"}</Badge>
                </div>
              </div>
              <Progress value={confidenceWeight(item.confidence)} className="h-1.5 mt-3" />
            </div>
          ))}
          {data.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">Nenhum impacto financeiro planejado ainda.</p>}
        </CardContent>
      </Card>
    </div>
  );
};

export default FinancePlannedImpacts;
