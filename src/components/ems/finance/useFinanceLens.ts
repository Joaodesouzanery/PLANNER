import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { DEFAULT_LENS, type FinanceLens } from "./financeLens";

const db = supabase as unknown as {
  from: (t: string) => any; // eslint-disable-line @typescript-eslint/no-explicit-any
};

const LENS_KEY = "ems-finance-lens";
const missingCode = (e: { code?: string } | null) => e?.code === "42P01" || e?.code === "PGRST205";

export interface FinanceProduto {
  id: string;
  name: string;
  slug: string;
  color: string | null;
  is_active: boolean;
  archived_at: string | null;
  legacy_company_id: string | null;
}

const readLens = (): FinanceLens => {
  try {
    const raw = localStorage.getItem(LENS_KEY);
    return raw ? { ...DEFAULT_LENS, ...JSON.parse(raw) } : DEFAULT_LENS;
  } catch {
    return DEFAULT_LENS;
  }
};

// Store externo (module-level): a lente é global — todo componente que a lê vê o mesmo recorte.
let currentLens: FinanceLens = readLens();
const listeners = new Set<() => void>();
const subscribe = (fn: () => void) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};
const getSnapshot = () => currentLens;
const writeLens = (next: FinanceLens) => {
  currentLens = next;
  try {
    localStorage.setItem(LENS_KEY, JSON.stringify(next));
  } catch {
    /* storage indisponível — a lente segue só em memória */
  }
  listeners.forEach((fn) => fn());
};

/** Produtos (dimensão da Nery Tecnologia) + estado da lente PF/PJ · produto · cliente. */
export const useFinanceLens = () => {
  const qc = useQueryClient();
  const lens = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const setLens = useCallback((next: FinanceLens) => writeLens(next), []);


  const query = useQuery({
    queryKey: ["finance-produtos"],
    queryFn: async () => {
      const { data, error } = await db.from("finance_produtos").select("*").order("name");
      if (error) {
        if (missingCode(error)) return [] as FinanceProduto[];
        throw error;
      }
      return (data ?? []) as FinanceProduto[];
    },
    retry: false,
  });

  const produtos = useMemo(() => query.data ?? [], [query.data]);
  const activeProdutos = useMemo(() => produtos.filter((p) => p.is_active), [produtos]);

  const setProdutoActive = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await db
        .from("finance_produtos")
        .update({ is_active: active, archived_at: active ? null : new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["finance-produtos"] }),
    onError: (e: { message?: string }) =>
      toast({ title: "Erro ao atualizar produto", description: e?.message, variant: "destructive" }),
  });

  return {
    lens,
    setLens,
    resetLens: () => setLens(DEFAULT_LENS),
    produtos,
    activeProdutos,
    produtoById: useMemo(() => new Map(produtos.map((p) => [p.id, p])), [produtos]),
    isLoading: query.isLoading,
    setProdutoActive,
  };
};
