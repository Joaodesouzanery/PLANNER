import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

const db = supabase as any;

export interface Cliente { id: string; nome: string; recorrente: boolean }

const missingCode = (e: any) => e?.code === "42P01" || e?.code === "PGRST205";

export const useClientes = () => {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["finance-clientes"],
    queryFn: async () => {
      const { data, error } = await db.from("finance_clientes").select("*").order("nome");
      if (error) { if (missingCode(error)) return { missing: true, rows: [] as Cliente[] }; throw error; }
      return { missing: false, rows: (data ?? []) as Cliente[] };
    },
    retry: false,
  });

  const saveCliente = useMutation({
    mutationFn: async (c: { id?: string; nome: string; recorrente?: boolean }) => {
      if (c.id) {
        const { error } = await db.from("finance_clientes").update({ nome: c.nome, recorrente: c.recorrente ?? true }).eq("id", c.id);
        if (error) throw error;
        return c.id;
      }
      const { data, error } = await db.from("finance_clientes").insert({ nome: c.nome, recorrente: c.recorrente ?? true }).select("id").single();
      if (error) throw error;
      return data?.id as string;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["finance-clientes"] }),
    onError: (e: any) => toast({ title: "Erro ao salvar cliente", description: e?.message, variant: "destructive" }),
  });

  const deleteCliente = useMutation({
    mutationFn: async (id: string) => { const { error } = await db.from("finance_clientes").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["finance-clientes"] }),
  });

  return {
    clientes: query.data?.rows ?? [],
    missing: query.data?.missing ?? false,
    isLoading: query.isLoading,
    saveCliente, deleteCliente,
  };
};
