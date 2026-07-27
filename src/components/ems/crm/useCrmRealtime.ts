import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";

// Realtime do CRM por empresa: sincroniza etapas e contagens do kanban entre abas e usuários da mesma
// empresa. Canal company-scoped (como o finance-live) — cada empresa tem seu próprio canal. Um postgres_change
// em qualquer tabela do CRM invalida as queries; o refetch reflete o move em todas as abas conectadas.
const CRM_TABLES = ["project_opportunities", "crm_stages", "crm_stage_events", "crm_modulos", "contacts", "finance_clientes"];

export const useCrmRealtime = () => {
  const queryClient = useQueryClient();
  const { selectedCompanyId } = useCompany();

  useEffect(() => {
    const invalidate = () => {
      queryClient.invalidateQueries({ queryKey: ["crm"] });
      queryClient.invalidateQueries({ queryKey: ["crm-stages"] });
      queryClient.invalidateQueries({ queryKey: ["crm-stage-events"] });
      queryClient.invalidateQueries({ queryKey: ["crm-modulos"] });
    };
    let channel = supabase.channel(`crm-live-${selectedCompanyId}`);
    for (const table of CRM_TABLES) {
      channel = channel.on("postgres_changes", { event: "*", schema: "public", table }, invalidate);
    }
    channel.subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient, selectedCompanyId]);
};
