import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// Tabelas que alimentam o Conselho (health score, cockpit, painéis) e as Rotinas.
const BOARD_TABLES = [
  "board_risks",
  "board_obligations",
  "board_obligation_occurrences",
  "board_backup_logs",
  "board_stack_items",
  "board_health_snapshots",
  "governance_items",
  "governance_logs",
  "decision_logs",
  "review_cycles",
  "attachments",
  "routine_tasks",
  "routine_checklist_logs",
  "routine_checklist_items",
  "routine_clients",
  "routine_segments",
];

/** Assina mudanças das tabelas do Conselho/Rotinas e invalida as queries relacionadas
 *  (health-*, cockpit-*, board-*, rotinas) para manter tudo ao vivo entre abas/dispositivos. */
export const useBoardRealtime = () => {
  const queryClient = useQueryClient();

  useEffect(() => {
    const invalidate = () =>
      queryClient.invalidateQueries({
        predicate: (query) => {
          const key = String(query.queryKey?.[0] ?? "");
          return key.startsWith("health-") || key.startsWith("cockpit-") || key.startsWith("board-") || key === "rotinas";
        },
      });

    let channel = supabase.channel("board-live");
    BOARD_TABLES.forEach((table) => {
      channel = channel.on("postgres_changes", { event: "*", schema: "public", table }, invalidate);
    });
    channel.subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [queryClient]);
};
