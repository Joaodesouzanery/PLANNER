import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { toast } from "@/hooks/use-toast";

// Cadências (templates de followup) + seus passos, por produto (company).
const db = supabase as any;
const safe = async (build: () => any): Promise<any[]> => {
  try { const { data, error } = await build(); if (error) return []; return data ?? []; } catch { return []; }
};

export interface Cadencia { id: string; nome: string; tipo: string }
export interface CadenciaPassoRow { id: string; cadencia_id: string; passo_n: number; canal: string; dia_offset: number; modelo_mensagem: string | null }

export const useCrmCadencias = () => {
  const qc = useQueryClient();
  const { selectedCompanyId } = useCompany();
  const scoped = selectedCompanyId && selectedCompanyId !== "all";
  const companyId = scoped ? selectedCompanyId : null;
  const co = (q: any) => (scoped ? q.eq("company_id", selectedCompanyId) : q.is("company_id", null));

  const query = useQuery({
    queryKey: ["crm-cadencias", selectedCompanyId],
    staleTime: 60_000,
    queryFn: async () => {
      const cads = await safe(() => co(db.from("crm_cadencias").select("id,nome,tipo").order("nome")));
      const passos = cads.length
        ? await safe(() => db.from("crm_cadencia_passos").select("id,cadencia_id,passo_n,canal,dia_offset,modelo_mensagem").in("cadencia_id", cads.map((c: any) => c.id)).order("passo_n"))
        : [];
      return { cads, passos };
    },
  });
  const cadencias = (query.data?.cads ?? []) as Cadencia[];
  const passos = (query.data?.passos ?? []) as CadenciaPassoRow[];
  const passosByCad = useMemo(() => {
    const m = new Map<string, CadenciaPassoRow[]>();
    for (const p of passos) { const a = m.get(p.cadencia_id); if (a) a.push(p); else m.set(p.cadencia_id, [p]); }
    return m;
  }, [passos]);

  const invalidate = () => qc.invalidateQueries({ queryKey: ["crm-cadencias"] });
  const err = (title: string) => (e: any) => toast({ title, description: e?.message, variant: "destructive" });

  const saveCadencia = useMutation({
    mutationFn: async (c: { id?: string; nome: string; tipo: string }) => {
      if (c.id) { const { error } = await db.from("crm_cadencias").update({ nome: c.nome, tipo: c.tipo }).eq("id", c.id); if (error) throw error; }
      else { const { error } = await db.from("crm_cadencias").insert({ nome: c.nome, tipo: c.tipo, company_id: companyId }); if (error) throw error; }
    },
    onSuccess: invalidate,
    onError: err("Erro ao salvar cadência"),
  });
  const deleteCadencia = useMutation({
    mutationFn: async (id: string) => { const { error } = await db.from("crm_cadencias").delete().eq("id", id); if (error) throw error; },
    onSuccess: invalidate,
    onError: err("Erro ao excluir cadência"),
  });
  const savePasso = useMutation({
    mutationFn: async (p: { id?: string; cadencia_id: string; canal: string; dia_offset: number; modelo_mensagem?: string | null }) => {
      if (p.id) {
        const { error } = await db.from("crm_cadencia_passos").update({ canal: p.canal, dia_offset: p.dia_offset, modelo_mensagem: p.modelo_mensagem || null }).eq("id", p.id);
        if (error) throw error;
      } else {
        const existing = passosByCad.get(p.cadencia_id) ?? [];
        const passo_n = existing.reduce((mx, x) => Math.max(mx, x.passo_n), 0) + 1;
        const { error } = await db.from("crm_cadencia_passos").insert({ cadencia_id: p.cadencia_id, passo_n, canal: p.canal, dia_offset: p.dia_offset, modelo_mensagem: p.modelo_mensagem || null, company_id: companyId });
        if (error) throw error;
      }
    },
    onSuccess: invalidate,
    onError: err("Erro ao salvar passo"),
  });
  const deletePasso = useMutation({
    mutationFn: async (id: string) => { const { error } = await db.from("crm_cadencia_passos").delete().eq("id", id); if (error) throw error; },
    onSuccess: invalidate,
    onError: err("Erro ao excluir passo"),
  });

  return { cadencias, passosByCad, isLoading: query.isLoading, saveCadencia, deleteCadencia, savePasso, deletePasso };
};
