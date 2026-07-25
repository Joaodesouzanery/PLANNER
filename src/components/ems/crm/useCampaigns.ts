import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { toast } from "@/hooks/use-toast";
import type { SegmentFilter } from "./crmCampaigns";

const db = supabase as any;
const safe = async (build: () => any): Promise<any[]> => {
  try { const { data, error } = await build(); if (error) return []; return data ?? []; } catch { return []; }
};

export interface Segment { id: string; name: string; filters: SegmentFilter; company_id?: string | null }
export interface Campaign {
  id: string; name: string; objective?: string | null; channel?: string | null; status?: string | null;
  segment_id?: string | null; message?: string | null; start_date?: string | null; end_date?: string | null; company_id?: string | null;
}
export interface Recipient {
  id: string; campaign_id: string; customer_id?: string | null; contact_id?: string | null;
  offer_status: string; propensity?: number | null; predicted_revenue?: number | null; responded_at?: string | null; converted_at?: string | null;
}

/** Fonte de dados do Campaign Management: segmentos + campanhas + recipients (RLS por usuário). */
export const useCampaigns = () => {
  const qc = useQueryClient();
  const { selectedCompanyId } = useCompany();
  const scoped = selectedCompanyId && selectedCompanyId !== "all";

  const query = useQuery({
    queryKey: ["crm-campaigns", selectedCompanyId],
    staleTime: 60_000,
    queryFn: async () => {
      const co = (q: any) => (scoped ? q.or(`company_id.eq.${selectedCompanyId},company_id.is.null`) : q);
      const [segments, campaigns, recipients] = await Promise.all([
        safe(() => co(db.from("crm_segments").select("id,name,filters,company_id")).order("created_at", { ascending: false })),
        safe(() => co(db.from("crm_campaigns").select("*")).order("created_at", { ascending: false })),
        safe(() => db.from("crm_campaign_recipients").select("*")),
      ]);
      return { segments, campaigns, recipients };
    },
  });

  const data = query.data;
  const invalidate = () => qc.invalidateQueries({ queryKey: ["crm-campaigns"] });
  const companyId = scoped ? selectedCompanyId : null;

  const createSegment = useMutation({
    mutationFn: async ({ name, filters }: { name: string; filters: SegmentFilter }) => {
      const { error } = await db.from("crm_segments").insert({ name: name.trim(), filters, company_id: companyId });
      if (error) throw error;
    },
    onSuccess: () => { invalidate(); toast({ title: "Segmento salvo" }); },
    onError: (e: any) => toast({ title: "Erro ao salvar segmento", description: e?.message, variant: "destructive" }),
  });

  const deleteSegment = useMutation({
    mutationFn: async (id: string) => { const { error } = await db.from("crm_segments").delete().eq("id", id); if (error) throw error; },
    onSuccess: invalidate,
    onError: (e: any) => toast({ title: "Erro ao excluir segmento", description: e?.message, variant: "destructive" }),
  });

  const createCampaign = useMutation({
    mutationFn: async (c: Partial<Campaign> & { name: string; recipients?: Omit<Recipient, "id" | "campaign_id">[] }) => {
      const { recipients, ...camp } = c;
      const { data: created, error } = await db.from("crm_campaigns")
        .insert({ ...camp, name: c.name.trim(), company_id: companyId })
        .select("id").single();
      if (error) throw error;
      if (recipients && recipients.length > 0) {
        const rows = recipients.map((r) => ({ ...r, campaign_id: created.id }));
        const { error: rErr } = await db.from("crm_campaign_recipients").insert(rows);
        if (rErr) throw rErr;
      }
      return created.id as string;
    },
    onSuccess: () => { invalidate(); toast({ title: "Campanha criada" }); },
    onError: (e: any) => toast({ title: "Erro ao criar campanha", description: e?.message, variant: "destructive" }),
  });

  const updateCampaign = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<Campaign> }) => {
      const { error } = await db.from("crm_campaigns").update(patch).eq("id", id); if (error) throw error;
    },
    onSuccess: invalidate,
    onError: (e: any) => toast({ title: "Erro ao atualizar campanha", description: e?.message, variant: "destructive" }),
  });

  const deleteCampaign = useMutation({
    mutationFn: async (id: string) => { const { error } = await db.from("crm_campaigns").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { invalidate(); toast({ title: "Campanha excluída" }); },
    onError: (e: any) => toast({ title: "Erro ao excluir campanha", description: e?.message, variant: "destructive" }),
  });

  const updateRecipient = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<Recipient> }) => {
      const { error } = await db.from("crm_campaign_recipients").update(patch).eq("id", id); if (error) throw error;
    },
    onSuccess: invalidate,
    onError: (e: any) => toast({ title: "Erro ao atualizar destinatário", description: e?.message, variant: "destructive" }),
  });

  return {
    segments: (data?.segments ?? []) as Segment[],
    campaigns: (data?.campaigns ?? []) as Campaign[],
    recipients: (data?.recipients ?? []) as Recipient[],
    isLoading: query.isLoading,
    createSegment, deleteSegment, createCampaign, updateCampaign, deleteCampaign, updateRecipient,
  };
};
