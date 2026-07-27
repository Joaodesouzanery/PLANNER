import { useCallback, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { useCrm } from "./useCrm";

// Undo/redo + log de transição do kanban de deals. Cada move: aplica no banco (updateDeal), grava o
// evento em crm_stage_events (best-effort — não bloqueia o move) e empilha p/ desfazer. Pilha de sessão.
const db = supabase as any;
const MAX = 30;

export interface StageState {
  stage: string;
  outcome: string | null;
}
export interface MoveRec {
  dealId: string;
  companyId: string | null; // company do deal (p/ o evento bater com as métricas por empresa)
  from: StageState;
  to: StageState;
}

export const useKanbanHistory = (crm: ReturnType<typeof useCrm>) => {
  const qc = useQueryClient();
  const undoStack = useRef<MoveRec[]>([]);
  const redoStack = useRef<MoveRec[]>([]);
  const [, setTick] = useState(0);
  const bump = () => setTick((n) => n + 1);

  const logEvent = async (rec: MoveRec, from: StageState, to: StageState) => {
    try {
      await db.from("crm_stage_events").insert({
        deal_id: rec.dealId,
        company_id: rec.companyId,
        from_stage: from.stage,
        to_stage: to.stage,
        from_outcome: from.outcome,
        to_outcome: to.outcome,
      });
      qc.invalidateQueries({ queryKey: ["crm-stage-events"] });
    } catch {
      /* histórico é best-effort; se a migration não estiver aplicada, o move segue */
    }
  };

  const applyStage = (dealId: string, target: StageState) =>
    crm.updateDeal.mutate({ id: dealId, patch: { stage: target.stage, status_outcome: target.outcome } });

  const moveDeal = useCallback(
    (rec: MoveRec) => {
      applyStage(rec.dealId, rec.to);
      void logEvent(rec, rec.from, rec.to);
      undoStack.current.push(rec);
      if (undoStack.current.length > MAX) undoStack.current.shift();
      redoStack.current = [];
      bump();
    },
    [crm],
  );

  const undo = useCallback(() => {
    const rec = undoStack.current.pop();
    if (!rec) return;
    applyStage(rec.dealId, rec.from);
    void logEvent(rec, rec.to, rec.from); // evento inverso
    redoStack.current.push(rec);
    bump();
  }, [crm]);

  const redo = useCallback(() => {
    const rec = redoStack.current.pop();
    if (!rec) return;
    applyStage(rec.dealId, rec.to);
    void logEvent(rec, rec.from, rec.to);
    undoStack.current.push(rec);
    bump();
  }, [crm]);

  return {
    moveDeal,
    undo,
    redo,
    canUndo: undoStack.current.length > 0,
    canRedo: redoStack.current.length > 0,
  };
};
