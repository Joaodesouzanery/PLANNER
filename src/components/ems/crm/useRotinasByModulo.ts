import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// Rotinas (routine_checklist_items) ligadas a módulos do CRM — fecha o elo Rotina↔CRM na visão do CRM.
const db = supabase as any;
const safe = async (build: () => any): Promise<any[]> => {
  try { const { data, error } = await build(); if (error) return []; return data ?? []; } catch { return []; }
};

export const useRotinasByModulo = () => {
  const { data = [] } = useQuery({
    queryKey: ["rotinas-by-modulo"],
    staleTime: 60_000,
    queryFn: async () =>
      safe(() => db.from("routine_checklist_items").select("id,title,modulo_id").eq("active", true).not("modulo_id", "is", null)),
  });
  const byModulo = useMemo(() => {
    const map = new Map<string, { id: string; title: string }[]>();
    for (const r of data as any[]) {
      if (!r.modulo_id) continue;
      const arr = map.get(r.modulo_id);
      if (arr) arr.push({ id: r.id, title: r.title });
      else map.set(r.modulo_id, [{ id: r.id, title: r.title }]);
    }
    return map;
  }, [data]);
  return { byModulo };
};
