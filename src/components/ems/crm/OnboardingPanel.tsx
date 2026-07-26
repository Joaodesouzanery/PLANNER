import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

// Gestão de onboarding/KYC por CONTATO (passos + documentos), reusando o schema/mutations de Onboarding.tsx.
// Embutido no 360; clicar no badge cicla o status. Invalida ["crm"] p/ o agregado (percentual) atualizar.
const STEP_CYCLE = ["pending", "in_progress", "completed"];
const STEP_LABEL: Record<string, { label: string; cls: string }> = {
  pending: { label: "Pendente", cls: "text-muted-foreground" },
  in_progress: { label: "Em andamento", cls: "text-amber-500" },
  completed: { label: "Concluído", cls: "text-emerald-500" },
};
const DOC_CYCLE = ["not_sent", "sent", "received", "signed"];
const DOC_LABEL: Record<string, { label: string; cls: string }> = {
  not_sent: { label: "Não enviado", cls: "text-muted-foreground" },
  sent: { label: "Enviado", cls: "text-blue-400" },
  received: { label: "Recebido", cls: "text-amber-500" },
  signed: { label: "Assinado", cls: "text-emerald-500" },
};
const db = supabase as any;

export const OnboardingPanel = ({ contactId }: { contactId: string }) => {
  const qc = useQueryClient();
  const { data: steps = [] } = useQuery({ queryKey: ["onb-steps"], staleTime: 300_000, queryFn: async () => (await db.from("onboarding_steps").select("*").order("order_index")).data ?? [] });
  const { data: docs = [] } = useQuery({ queryKey: ["onb-docs"], staleTime: 300_000, queryFn: async () => (await db.from("onboarding_documents").select("*").order("order_index")).data ?? [] });
  const { data: stepTracking = [] } = useQuery({ queryKey: ["onb-step-tracking", contactId], queryFn: async () => (await db.from("contact_onboarding_tracking").select("*").eq("contact_id", contactId)).data ?? [] });
  const { data: docTracking = [] } = useQuery({ queryKey: ["onb-doc-tracking", contactId], queryFn: async () => (await db.from("contact_onboarding_documents").select("*").eq("contact_id", contactId)).data ?? [] });

  const stepStatus = (id: string) => stepTracking.find((t) => t.step_id === id)?.status || "pending";
  const docStatus = (id: string) => docTracking.find((t) => t.document_id === id)?.status || "not_sent";
  const invalidate = (extra: any[]) => { qc.invalidateQueries({ queryKey: extra }); qc.invalidateQueries({ queryKey: ["crm"] }); };

  const updateStep = useMutation({
    mutationFn: async ({ stepId, status }: { stepId: string; status: string }) => {
      const existing = stepTracking.find((t) => t.step_id === stepId);
      const now = new Date().toISOString();
      const completed_at = status === "completed" ? now : null;
      if (existing) { const { error } = await db.from("contact_onboarding_tracking").update({ status, completed_at, updated_at: now }).eq("id", existing.id); if (error) throw error; }
      else { const { error } = await db.from("contact_onboarding_tracking").insert({ contact_id: contactId, step_id: stepId, status, completed_at }); if (error) throw error; }
    },
    onSuccess: () => invalidate(["onb-step-tracking", contactId]),
    onError: (e: any) => toast({ title: "Erro ao atualizar etapa", description: e?.message, variant: "destructive" }),
  });

  const cycleDoc = useMutation({
    mutationFn: async ({ docId, newStatus }: { docId: string; newStatus: string }) => {
      const existing = docTracking.find((t) => t.document_id === docId);
      const now = new Date().toISOString();
      const ts = {
        sent_at: ["sent", "received", "signed"].includes(newStatus) ? now : null,
        received_at: ["received", "signed"].includes(newStatus) ? now : null,
        signed_at: newStatus === "signed" ? now : null,
      };
      if (existing) { const { error } = await db.from("contact_onboarding_documents").update({ status: newStatus, ...ts, updated_at: now }).eq("id", existing.id); if (error) throw error; }
      else { const { error } = await db.from("contact_onboarding_documents").insert({ contact_id: contactId, document_id: docId, status: newStatus, ...ts }); if (error) throw error; }
    },
    onSuccess: () => invalidate(["onb-doc-tracking", contactId]),
    onError: (e: any) => toast({ title: "Erro ao atualizar documento", description: e?.message, variant: "destructive" }),
  });

  if (steps.length === 0) return <p className="text-xs text-muted-foreground">Sem passos de onboarding configurados.</p>;

  return (
    <div className="space-y-2">
      {steps.map((s) => {
        const st = stepStatus(s.id);
        const stepDocs = docs.filter((d) => d.step_id === s.id);
        return (
          <div key={s.id} className="rounded-lg border border-border/40 p-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm truncate">{s.title}</span>
              <button title="Clique para avançar" onClick={() => updateStep.mutate({ stepId: s.id, status: STEP_CYCLE[(STEP_CYCLE.indexOf(st) + 1) % STEP_CYCLE.length] })}>
                <Badge variant="outline" className={cn("text-[10px]", STEP_LABEL[st].cls)}>{STEP_LABEL[st].label}</Badge>
              </button>
            </div>
            {stepDocs.length > 0 && (
              <div className="mt-1.5 space-y-1 pl-2 border-l border-border/40">
                {stepDocs.map((d) => {
                  const ds = docStatus(d.id);
                  return (
                    <div key={d.id} className="flex items-center justify-between gap-2">
                      <span className="text-xs text-muted-foreground truncate">{d.title}</span>
                      <button title="Clique para avançar" onClick={() => cycleDoc.mutate({ docId: d.id, newStatus: DOC_CYCLE[(DOC_CYCLE.indexOf(ds) + 1) % DOC_CYCLE.length] })}>
                        <Badge variant="outline" className={cn("text-[9px]", DOC_LABEL[ds].cls)}>{DOC_LABEL[ds].label}</Badge>
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default OnboardingPanel;
