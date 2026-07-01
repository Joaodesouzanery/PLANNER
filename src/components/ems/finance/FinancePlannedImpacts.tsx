import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FileDown } from "lucide-react";
import { useCompany } from "@/contexts/CompanyContext";
import { supabase } from "@/integrations/supabase/client";
import { fmtCurrency } from "./useFinanceData";
import { exportTablePdf } from "@/lib/exportPdf";
import { toast } from "sonner";

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

  const exportImpacts = async () => {
    const money = (v: number) => fmtCurrency(Number(v));
    try {
      await exportTablePdf({
        title: "Impactos financeiros previstos",
        subtitle: `gerado em ${new Date().toLocaleString("pt-BR")}`,
        filename: "impactos-previstos.pdf",
        sections: [
          { heading: "Totais", head: [["Indicador", "Valor"]], body: [["Receita prevista", money(totals.revenue)], ["Custos previstos", money(totals.cost)], ["Caixa previsto", money(totals.cash)], ["Líquido planejado", money(totals.net)]] },
          { heading: "Impactos por projeto", head: [["Título", "Projeto", "Tipo", "Valor"]], body: data.length ? data.map((i) => [i.title, i.projects?.title || "Empresa inteira", i.impact_type || "revenue", money(Number(i.amount || 0))]) : [["—", "—", "—", "—"]] },
        ],
      });
      toast.success("Previstos exportados!");
    } catch (err: any) {
      toast.error("Falha ao exportar", { description: err?.message });
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={exportImpacts}><FileDown className="h-4 w-4 mr-2" />Exportar</Button>
      </div>
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
