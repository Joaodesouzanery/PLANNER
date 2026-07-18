import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { useFinanceAlerts } from "@/components/ems/finance/useFinanceAlerts";
import { useRotinas, type RoutineClientView } from "@/hooks/useRotinas";
import { rotinasHoje } from "@/components/ems/rotinas/rotinasHoje";
import { buildBoardAttention, attentionCounts, type AttentionInputs } from "./boardAttention";

const db = supabase as any;
const todayIso = () => format(new Date(), "yyyy-MM-dd");
const dayDiff = (from: string, to: string) => Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);

/** Executa uma query com fallback: qualquer erro (tabela/coluna ausente) → []. */
const safe = async (build: () => any): Promise<any[]> => {
  try { const { data, error } = await build(); if (error) return []; return data ?? []; } catch { return []; }
};

/**
 * Central de Atenção do Conselho: junta a fonte financeira (useFinanceAlerts), rotinas (useRotinas)
 * e as demais frentes (board_*, tarefas/projetos, comercial, inbox, capacidade) numa fila ranqueada.
 * Company-scoped; tudo com fallback gracioso (degrada vazio se a migration board_* não estiver aplicada).
 */
export const useBoardAttention = () => {
  const { selectedCompanyId } = useCompany();
  const scoped = selectedCompanyId && selectedCompanyId !== "all";
  const { alerts: financeAlerts } = useFinanceAlerts();
  const rotinas = useRotinas();

  const rotCounts = useMemo(() => {
    const views = rotinas.clients.map((c) => rotinas.clientViews.get(c.id)).filter(Boolean) as RoutineClientView[];
    return rotinasHoje(views, rotinas.today).counts;
  }, [rotinas.clients, rotinas.clientViews, rotinas.today]);

  const board = useQuery({
    queryKey: ["board-attention", selectedCompanyId],
    staleTime: 120_000,
    queryFn: async (): Promise<AttentionInputs> => {
      const today = todayIso();
      const co = (q: any) => (scoped ? q.eq("company_id", selectedCompanyId) : q);

      const [obr, ris, doc, tsk, prj, com, inb, cap] = await Promise.all([
        safe(() => co(db.from("board_obligations").select("id,title,next_due_date,lead_days,status")).neq("status", "done")),
        safe(() => co(db.from("board_risks").select("id,title,score,status,review_date")).neq("status", "closed")),
        safe(() => co(db.from("attachments").select("id,file_name,expires_at,alert_days")).not("expires_at", "is", null)),
        safe(() => co(db.from("tasks").select("id,title,status,due_date")).not("due_date", "is", null).neq("status", "completed")),
        safe(() => co(db.from("projects").select("id,title,status,due_date")).not("due_date", "is", null).neq("status", "done")),
        safe(() => db.from("commercial_contact_meta").select("id,next_action_date,next_action_description,contact:contacts(name)").not("next_action_date", "is", null)),
        safe(() => db.from("unified_inbox").select("id,status").neq("status", "done")),
        safe(() => db.from("capacity_checkins").select("id,checkin_date,workload").order("checkin_date", { ascending: false }).limit(1)),
      ]);

      return {
        obrigacoes: obr
          .filter((o) => o.next_due_date && dayDiff(today, o.next_due_date) <= (o.lead_days ?? 7))
          .map((o) => ({ id: o.id, titulo: o.title, dueDate: o.next_due_date, overdue: o.next_due_date < today })),
        riscos: ris
          .filter((r) => Number(r.score) >= 16)
          .map((r) => ({ id: r.id, titulo: r.title, score: Number(r.score), semRevisao: !r.review_date || r.review_date < today })),
        documentos: doc
          .map((d) => ({ id: d.id, titulo: d.file_name, expiraEmDias: dayDiff(today, d.expires_at) }))
          .filter((d) => d.expiraEmDias >= 0 && d.expiraEmDias <= 30),
        tarefas: tsk
          .filter((t) => t.due_date < today)
          .map((t) => ({ id: t.id, titulo: t.title, atrasadaDias: dayDiff(t.due_date, today) })),
        projetos: prj
          .filter((p) => p.due_date < today)
          .map((p) => ({ id: p.id, titulo: p.title, atrasadoDias: dayDiff(p.due_date, today) })),
        comercial: com
          .filter((c) => c.next_action_date && c.next_action_date < today)
          .map((c) => ({ id: c.id, titulo: c.contact?.name || c.next_action_description || "Contato", paradoDias: dayDiff(c.next_action_date, today) })),
        inboxBacklog: inb.length,
        capacidade: cap
          .filter((c) => Number(c.workload) >= 4 || Number(c.workload) >= 80)
          .map((c) => ({ id: c.id, nome: "Você", sobrecarga: true })),
      };
    },
  });

  const items = useMemo(
    () => buildBoardAttention({
      financeAlerts: financeAlerts.map((a) => ({ key: a.key, severity: a.severity, message: a.message, date: a.date })),
      rotinas: rotCounts,
      ...(board.data ?? {}),
    }),
    [financeAlerts, rotCounts, board.data],
  );

  return { items, counts: attentionCounts(items), isLoading: board.isLoading };
};
