import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { toast } from "@/hooks/use-toast";

// Quadros de contatos do CRM: um kanban por empresa/segmento (crm_boards) com os contatos
// posicionados por etapa (crm_board_contacts). Não mexe em contacts.pipeline_stage — o funil
// do Comercial continua independente.
const db = supabase as any;

export interface BoardStage {
  id: string;
  title: string;
}
export interface CrmBoard {
  id: string;
  name: string;
  segment: string | null;
  company_id: string | null;
  stages: BoardStage[];
  order_index: number;
}
export interface BoardCard {
  id: string;
  board_id: string;
  contact_id: string;
  stage_id: string;
  order_index: number;
  notes: string | null;
}

export const DEFAULT_STAGES: BoardStage[] = [
  { id: "novo", title: "Novo" },
  { id: "contatado", title: "Contatado" },
  { id: "qualificado", title: "Qualificado" },
  { id: "proposta", title: "Proposta" },
  { id: "negociacao", title: "Negociação" },
  { id: "fechado", title: "Fechado" },
];

const safe = async (build: () => any): Promise<any[]> => {
  try {
    const { data, error } = await build();
    if (error) throw error;
    return data ?? [];
  } catch {
    return [];
  }
};

const parseStages = (raw: unknown): BoardStage[] => {
  const arr = Array.isArray(raw) ? raw : [];
  const out = arr
    .filter((s: any) => s && typeof s.id === "string")
    .map((s: any) => ({ id: String(s.id), title: String(s.title ?? s.id) }));
  return out.length ? out : DEFAULT_STAGES;
};

export const useCrmBoards = () => {
  const qc = useQueryClient();
  const { selectedCompanyId } = useCompany();
  const scoped = Boolean(selectedCompanyId && selectedCompanyId !== "all");

  const query = useQuery({
    queryKey: ["crm-boards", selectedCompanyId],
    staleTime: 30_000,
    queryFn: async () => {
      const boardsRaw = await safe(() => {
        const q = db.from("crm_boards").select("*").order("order_index");
        return scoped ? q.or(`company_id.eq.${selectedCompanyId},company_id.is.null`) : q;
      });
      const cards = boardsRaw.length
        ? await safe(() =>
            db
              .from("crm_board_contacts")
              .select("*")
              .in(
                "board_id",
                boardsRaw.map((b: any) => b.id),
              )
              .order("order_index"),
          )
        : [];
      return { boardsRaw, cards };
    },
  });

  const boards: CrmBoard[] = useMemo(
    () =>
      ((query.data?.boardsRaw ?? []) as any[]).map((b) => ({
        id: b.id,
        name: b.name,
        segment: b.segment ?? null,
        company_id: b.company_id ?? null,
        stages: parseStages(b.stages),
        order_index: b.order_index ?? 0,
      })),
    [query.data?.boardsRaw],
  );
  const cards = (query.data?.cards ?? []) as BoardCard[];

  const cardsByBoard = useMemo(() => {
    const map = new Map<string, BoardCard[]>();
    for (const c of cards) {
      const list = map.get(c.board_id) ?? map.set(c.board_id, []).get(c.board_id)!;
      list.push(c);
    }
    return map;
  }, [cards]);

  const invalidate = () => qc.invalidateQueries({ queryKey: ["crm-boards"] });
  const err = (title: string) => (e: any) =>
    toast({ title, description: e?.message, variant: "destructive" });

  const createBoard = useMutation({
    mutationFn: async (b: { name: string; segment?: string | null; stages?: BoardStage[] }) => {
      const { error } = await db.from("crm_boards").insert({
        name: b.name.trim(),
        segment: b.segment?.trim() || null,
        stages: b.stages ?? DEFAULT_STAGES,
        company_id: scoped ? selectedCompanyId : null,
        order_index: boards.length,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast({ title: "Quadro criado" });
    },
    onError: err("Erro ao criar quadro"),
  });

  const updateBoard = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Record<string, any> }) => {
      const { error } = await db.from("crm_boards").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError: err("Erro ao salvar quadro"),
  });

  const deleteBoard = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db.from("crm_boards").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast({ title: "Quadro removido" });
    },
    onError: err("Erro ao remover quadro"),
  });

  const addCard = useMutation({
    mutationFn: async (c: { board_id: string; contact_id: string; stage_id: string }) => {
      const { error } = await db.from("crm_board_contacts").insert({
        board_id: c.board_id,
        contact_id: c.contact_id,
        stage_id: c.stage_id,
        order_index: (cardsByBoard.get(c.board_id) ?? []).length,
      });
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError: err("Erro ao adicionar contato no quadro"),
  });

  const moveCard = useMutation({
    mutationFn: async ({
      id,
      stage_id,
      order_index,
    }: {
      id: string;
      stage_id: string;
      order_index: number;
    }) => {
      const { error } = await db
        .from("crm_board_contacts")
        .update({ stage_id, order_index })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError: err("Erro ao mover contato"),
  });

  const removeCard = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db.from("crm_board_contacts").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError: err("Erro ao remover do quadro"),
  });

  return {
    boards,
    cards,
    cardsByBoard,
    isLoading: query.isLoading,
    createBoard,
    updateBoard,
    deleteBoard,
    addCard,
    moveCard,
    removeCard,
  };
};
