import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bot, Save, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { toast } from "@/hooks/use-toast";

interface AIBriefingPanelProps {
  briefingDate: string;
  stats: Record<string, any>;
}

export const AIBriefingPanel = ({ briefingDate, stats }: AIBriefingPanelProps) => {
  const { selectedCompanyId } = useCompany();
  const queryClient = useQueryClient();
  const hasCompanyFilter = selectedCompanyId !== "all";

  const { data: briefings = [] } = useQuery({
    queryKey: ["ai-briefings", selectedCompanyId, briefingDate],
    staleTime: 1000 * 60,
    queryFn: async () => {
      let q = (supabase as any)
        .from("ai_briefings")
        .select("*")
        .eq("briefing_date", briefingDate)
        .order("created_at", { ascending: false })
        .limit(5);
      if (hasCompanyFilter) q = q.eq("company_id", selectedCompanyId);
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
  });

  const draft = useMemo(() => {
    const risks = [
      stats.overdueTasks ? `${stats.overdueTasks} tarefas vencidas` : null,
      stats.delayedProjects ? `${stats.delayedProjects} projetos atrasados` : null,
      stats.criticalGovernance ? `${stats.criticalGovernance} alertas do Conselho` : null,
      stats.expiringDocuments ? `${stats.expiringDocuments} documentos próximos do vencimento` : null,
      stats.inboxPending ? `${stats.inboxPending} itens sem triagem no Inbox` : null,
      stats.capacityRisk ? "capacidade humana em atenção" : null,
    ].filter(Boolean);

    const nextActions = [
      "Revisar os alertas críticos antes de abrir novas frentes.",
      stats.inboxPending ? "Triar o Inbox para transformar captura bruta em ação rastreável." : null,
      stats.expiringDocuments ? "Verificar contratos e documentos com vencimento próximo." : null,
      stats.hotOpportunities ? "Priorizar oportunidades comerciais quentes e follow-ups pendentes." : null,
    ].filter(Boolean);

    return [
      risks.length ? `Riscos principais: ${risks.join("; ")}.` : "Sem riscos críticos detectados nos dados carregados.",
      `Pulso operacional: ${stats.todayTasks || 0} itens hoje, ${stats.weekTasks || 0} itens na semana e ${stats.invoices || 0} próximas NFs no radar.`,
      `Próximas ações sugeridas: ${nextActions.join(" ")}`,
    ].join("\n\n");
  }, [stats]);

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await (supabase as any).from("ai_briefings").insert({
        briefing_date: briefingDate,
        title: "Briefing assistido",
        content: draft,
        source_data: stats,
        company_id: hasCompanyFilter ? selectedCompanyId : null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ai-briefings"] });
      toast({ title: "Briefing salvo" });
    },
    onError: (error: any) => toast({ title: "Erro ao salvar briefing", description: error?.message, variant: "destructive" }),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Bot className="h-4 w-4 text-primary" /> Briefing Assistido
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="rounded-lg border bg-muted/30 p-3 whitespace-pre-line text-sm">{draft}</div>
        <Button onClick={() => save.mutate()} disabled={save.isPending} className="w-full">
          <Sparkles className="h-4 w-4 mr-2" /> Gerar e salvar briefing
        </Button>
        {briefings.length > 0 && (
          <div className="space-y-2 pt-1">
            {briefings.map((item: any) => (
              <div key={item.id} className="rounded border p-2 text-xs">
                <div className="flex items-center gap-1 font-medium"><Save className="h-3 w-3" /> {item.title || "Briefing"}</div>
                <p className="text-muted-foreground mt-1 line-clamp-3 whitespace-pre-line">{item.content}</p>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
