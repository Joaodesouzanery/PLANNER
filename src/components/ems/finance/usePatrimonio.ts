import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

const db = supabase as any;

export interface NetworthItem { id: string; kind: "asset" | "liability"; label: string; category: string | null; value: number; sort_order: number }
export interface SinkingFund { id: string; title: string; target: number; due_date: string | null; monthly: number; balance: number }

const missingCode = (e: any) => e?.code === "42P01" || e?.code === "PGRST205";

export const usePatrimonio = () => {
  const qc = useQueryClient();

  const itemsQ = useQuery({
    queryKey: ["finance-networth"],
    queryFn: async () => {
      const { data, error } = await db.from("finance_networth_items").select("*").order("sort_order");
      if (error) { if (missingCode(error)) return { missing: true, rows: [] as NetworthItem[] }; throw error; }
      return { missing: false, rows: (data ?? []) as NetworthItem[] };
    },
    retry: false,
  });
  const fundsQ = useQuery({
    queryKey: ["finance-sinking"],
    queryFn: async () => {
      const { data, error } = await db.from("finance_sinking_funds").select("*").order("due_date");
      if (error) { if (missingCode(error)) return { missing: true, rows: [] as SinkingFund[] }; throw error; }
      return { missing: false, rows: (data ?? []) as SinkingFund[] };
    },
    retry: false,
  });

  const missing = (itemsQ.data?.missing ?? false) || (fundsQ.data?.missing ?? false);

  const saveItem = useMutation({
    mutationFn: async (item: Partial<NetworthItem>) => {
      const { error } = item.id ? await db.from("finance_networth_items").update(item).eq("id", item.id) : await db.from("finance_networth_items").insert(item);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["finance-networth"] }),
    onError: (e: any) => toast({ title: "Erro", description: e?.message, variant: "destructive" }),
  });
  const deleteItem = useMutation({
    mutationFn: async (id: string) => { const { error } = await db.from("finance_networth_items").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["finance-networth"] }),
  });
  const saveFund = useMutation({
    mutationFn: async (f: Partial<SinkingFund>) => {
      const { error } = f.id ? await db.from("finance_sinking_funds").update(f).eq("id", f.id) : await db.from("finance_sinking_funds").insert(f);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["finance-sinking"] }),
    onError: (e: any) => toast({ title: "Erro", description: e?.message, variant: "destructive" }),
  });
  const deleteFund = useMutation({
    mutationFn: async (id: string) => { const { error } = await db.from("finance_sinking_funds").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["finance-sinking"] }),
  });

  return {
    items: itemsQ.data?.rows ?? [], funds: fundsQ.data?.rows ?? [], missing,
    isLoading: itemsQ.isLoading || fundsQ.isLoading,
    saveItem, deleteItem, saveFund, deleteFund,
  };
};
