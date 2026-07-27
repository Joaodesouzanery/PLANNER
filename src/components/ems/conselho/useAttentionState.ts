import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";

// Estado persistido por item da Central de Atenção (board_attention_state): resolvido/adiado/ignorado + soneca.
// Degrada gracioso se a migration não estiver aplicada (safe → []).
const db = supabase as any;
const todayIso = () => new Date().toISOString().slice(0, 10);
const addDaysIso = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);

export type AttentionState = "open" | "resolved" | "deferred" | "ignored";
export interface AttentionRow { item_key: string; state: AttentionState; snooze_until: string | null }

const safe = async (build: () => any): Promise<any[]> => {
  try { const { data, error } = await build(); if (error) return []; return data ?? []; } catch { return []; }
};

/** Um item está "escondido" da fila ativa se resolvido/adiado/ignorado, ou em soneca até uma data futura. */
export const isHiddenState = (r: AttentionRow | undefined, today = todayIso()): boolean => {
  if (!r) return false;
  if (r.state === "resolved" || r.state === "ignored" || r.state === "deferred") return true;
  if (r.snooze_until && r.snooze_until > today) return true;
  return false;
};

export const useAttentionState = () => {
  const qc = useQueryClient();
  const { selectedCompanyId } = useCompany();
  const scoped = selectedCompanyId && selectedCompanyId !== "all";

  // Leitura (o que esconder): na visão de uma empresa, considera o estado DELA + os estados globais
  // (company_id null, feitos na visão "todas") — assim um item resolvido no agregado também some dentro
  // da empresa. NÃO inclui OUTRAS empresas, então keys estáticas (ex.: alerta financeiro) não vazam entre elas.
  const readScope = (q: any) =>
    scoped ? q.or(`company_id.eq.${selectedCompanyId},company_id.is.null`) : q.is("company_id", null);
  // Gravação (qual linha fazer upsert): a linha exata do escopo atual — empresa X, ou null na visão "todas".
  const writeScope = (q: any) => (scoped ? q.eq("company_id", selectedCompanyId) : q.is("company_id", null));

  const query = useQuery({
    queryKey: ["board-attention-state", selectedCompanyId],
    staleTime: 30_000,
    queryFn: async () => safe(() => readScope(db.from("board_attention_state").select("item_key,state,snooze_until"))),
  });
  const rows = (query.data ?? []) as AttentionRow[];
  // Pode haver 2 linhas por key (a da empresa + a global). Guarda a que ESCONDE, se houver — assim
  // isHidden acerta e o feed rotula o estado certo (resolvido/adiado/soneca).
  const byKey = useMemo(() => {
    const map = new Map<string, AttentionRow>();
    rows.forEach((r) => {
      const cur = map.get(r.item_key);
      if (!cur || (!isHiddenState(cur) && isHiddenState(r))) map.set(r.item_key, r);
    });
    return map;
  }, [rows]);

  const invalidate = () => qc.invalidateQueries({ queryKey: ["board-attention-state"] });

  // Find-then-update/insert (user_id é preenchido pelo trigger; evita upsert com coluna trigger-filled).
  const write = useMutation({
    mutationFn: async ({ key, state, snooze_until }: { key: string; state: AttentionState; snooze_until?: string | null }) => {
      const patch: any = { state };
      if (snooze_until !== undefined) patch.snooze_until = snooze_until;
      const { data: existing } = await writeScope(db.from("board_attention_state").select("id").eq("item_key", key)).limit(1);
      if (existing && existing[0]?.id) {
        const { error } = await db.from("board_attention_state").update(patch).eq("id", existing[0].id);
        if (error) throw error;
      } else {
        const { error } = await db.from("board_attention_state").insert({ item_key: key, company_id: scoped ? selectedCompanyId : null, ...patch });
        if (error) throw error;
      }
    },
    onSuccess: invalidate,
  });

  const setState = (key: string, state: AttentionState) => write.mutate({ key, state, snooze_until: null });
  const snooze = (key: string, days: number) => write.mutate({ key, state: "open", snooze_until: addDaysIso(days) });
  const isHidden = (key: string) => isHiddenState(byKey.get(key));

  return { byKey, rows, setState, snooze, isHidden, isPending: write.isPending };
};
