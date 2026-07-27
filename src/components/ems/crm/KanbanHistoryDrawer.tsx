import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { History, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import type { useCrm } from "./useCrm";
import { useCrmStages } from "./useCrmStages";

const db = supabase as any;
const safe = async (build: () => any): Promise<any[]> => {
  try { const { data, error } = await build(); if (error) return []; return data ?? []; } catch { return []; }
};

/** Histórico de movimentos do kanban (crm_stage_events) — quem foi movido, de onde pra onde, quando. */
export const KanbanHistoryDrawer = ({ crm }: { crm: ReturnType<typeof useCrm> }) => {
  const { selectedCompanyId } = useCompany();
  const scoped = selectedCompanyId && selectedCompanyId !== "all";
  const co = (q: any) => (scoped ? q.eq("company_id", selectedCompanyId) : q);
  const [open, setOpen] = useState(false);
  const { stages } = useCrmStages();

  const titleByStage = useMemo(() => new Map(stages.map((s) => [s.key, s.title])), [stages]);
  const titleByDeal = useMemo(() => new Map((crm.deals as any[]).map((d) => [d.id, d.title])), [crm.deals]);
  const stageLabel = (key?: string | null) => (key ? titleByStage.get(key) || key : "—");

  const { data: events = [], isLoading } = useQuery({
    queryKey: ["crm-stage-events", selectedCompanyId],
    enabled: open,
    staleTime: 30_000,
    queryFn: () =>
      safe(() =>
        co(db.from("crm_stage_events").select("id,deal_id,from_stage,to_stage,moved_at"))
          .order("moved_at", { ascending: false })
          .limit(60),
      ),
  });

  return (
    <>
      <Button size="sm" variant="ghost" className="h-7 gap-1.5 text-xs" onClick={() => setOpen(true)}>
        <History className="h-3.5 w-3.5" />Histórico
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="h-4 w-4 text-primary" />Histórico de movimentos
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-1.5 max-h-[55vh] overflow-y-auto">
            {isLoading && <p className="text-xs text-muted-foreground py-6 text-center">Carregando…</p>}
            {!isLoading && events.length === 0 && (
              <p className="text-xs text-muted-foreground py-6 text-center">
                Nenhum movimento registrado ainda. Arraste um deal entre colunas para começar o histórico.
              </p>
            )}
            {(events as any[]).map((e) => (
              <div key={e.id} className="flex items-center gap-2 rounded-lg border border-border/50 p-2 text-xs">
                <span className="min-w-0 flex-1 truncate font-medium">{titleByDeal.get(e.deal_id) || "Deal removido"}</span>
                <span className="flex items-center gap-1 text-muted-foreground shrink-0">
                  {stageLabel(e.from_stage)} <ArrowRight className="h-3 w-3" /> {stageLabel(e.to_stage)}
                </span>
                <span className="text-[10px] text-muted-foreground/70 shrink-0 w-20 text-right">
                  {e.moved_at ? formatDistanceToNow(new Date(e.moved_at), { addSuffix: true, locale: ptBR }) : "—"}
                </span>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default KanbanHistoryDrawer;
