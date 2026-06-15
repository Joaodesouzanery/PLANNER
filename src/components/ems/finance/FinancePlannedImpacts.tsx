import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useCompany } from "@/contexts/CompanyContext";
import { supabase } from "@/integrations/supabase/client";
import { fmtCurrency } from "./useFinanceData";

interface PlannedImpact {
  id: string;
  project_id: string | null;
  title: string;
  impact_type: string | null;
  amount: number | null;
  notes: string | null;
  projects?: { title: string | null } | null;
}

const missingTable = (error: any) =>
  error?.code === "42P01" || error?.code === "PGRST205" || String(error?.message || "").includes("Could not find the table");

const FinancePlannedImpacts = () => {
  const { selectedCompanyId } = useCompany();
  const { data = [] } = useQuery({
    queryKey: ["finance-planned-impacts", selectedCompanyId],
    queryFn: async () => {
      let query = (supabase as any)
        .from("project_financial_impacts")
        .select("id, project_id, title, impact_type, amount, notes, projects(title)")
        .order("created_at", { ascending: false });
      if (selectedCompanyId !== "all") query = query.eq("company_id", selectedCompanyId);
      const { data, error } = await query;
      if (missingTable(error)) return [] as PlannedImpact[];
      if (error) throw error;
      return (data || []) as PlannedImpact[];
    },
    retry: false,
  });

  const totals = useMemo(() => data.reduce((acc, item) => {
    const amount = Number(item.amount || 0);
    if (item.impact_type === "revenue") acc.revenue += amount;
    if (item.impact_type === "cost") acc.cost += amount;
    if (item.impact_type === "cash") acc.cash += amount;
    if (item.impact_type === "margin") acc.margin += amount;
    acc.net += item.impact_type === "cost" ? -amount : amount;
    return acc;
  }, { revenue: 0, cost: 0, cash: 0, margin: 0, net: 0 }), [data]);

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-4">
        {[
          ["Receita prevista", totals.revenue],
          ["Custos previstos", totals.cost],
          ["Caixa previsto", totals.cash],
          ["Liquido planejado", totals.net],
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
                  <p className="text-xs text-muted-foreground">{item.projects?.title || "Empresa inteira"}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge variant={item.impact_type === "cost" ? "destructive" : "secondary"}>{fmtCurrency(Number(item.amount || 0))}</Badge>
                  <Badge variant="outline">{item.impact_type || "revenue"}</Badge>
                </div>
              </div>
              {item.notes && <p className="text-xs text-muted-foreground mt-2">{item.notes}</p>}
            </div>
          ))}
          {data.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">Nenhum impacto financeiro planejado ainda.</p>}
        </CardContent>
      </Card>
    </div>
  );
};

export default FinancePlannedImpacts;
