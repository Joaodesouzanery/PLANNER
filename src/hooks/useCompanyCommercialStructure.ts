import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export type StructureSection =
  | "funnel_stages"
  | "playbook_b2g"
  | "playbook_b2b"
  | "sales_stack"
  | "kpis"
  | "commission";

export interface FunnelStage {
  step: number;
  title: string;
  desc: string;
  responsible: string;
  b2g: string;
  b2b: string;
}

export interface PlaybookData {
  message: { title: string; focus: string; language: string };
  prospecting: {
    stakeholders?: string[];
    accounts?: string[];
    channels: string[];
    extra: string[];
  };
  sales: string[];
}

export interface SalesStackItem {
  title: string;
  desc: string;
  examples: string;
}

export interface KpisData {
  bdr: string[];
  ae: string[];
  csm: string[];
}

export interface CommissionRole {
  role: string;
  base: string;
  variable: string;
  items: string[];
}

export interface CommissionData {
  roles: CommissionRole[];
  considerations: string[];
}

export function useCompanyCommercialStructure(companyId: string | null) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: sections = [], isLoading } = useQuery({
    queryKey: ["company-commercial-structure", companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const { data, error } = await supabase
        .from("company_commercial_structure" as any)
        .select("*")
        .eq("company_id", companyId);
      if (error) throw error;
      return data as any[];
    },
    enabled: !!companyId,
  });

  const getSection = <T,>(section: StructureSection): T | null => {
    const row = sections.find((s: any) => s.section === section);
    return row ? (row.content as T) : null;
  };

  const upsertSection = useMutation({
    mutationFn: async ({
      section,
      content,
    }: {
      section: StructureSection;
      content: any;
    }) => {
      if (!companyId) throw new Error("No company selected");
      const { error } = await supabase.from("company_commercial_structure" as any).upsert(
        {
          company_id: companyId,
          section,
          content,
        } as any,
        { onConflict: "company_id,section" }
      );
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["company-commercial-structure", companyId],
      });
      toast({ title: "Salvo!", description: "Estrutura comercial atualizada." });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Erro ao salvar",
        description: error.message,
      });
    },
  });

  return { sections, isLoading, getSection, upsertSection };
}
