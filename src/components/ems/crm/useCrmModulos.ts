import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { toast } from "@/hooks/use-toast";
import { DEFAULT_MODULO_COLOR, slugifyModulo, type CrmModulo } from "./crmModulos";

// Catálogo de módulos (crm_modulos) por PRODUTO (company). Degrada gracioso: sem tabela/linhas → [].
const db = supabase as any;
const safe = async (build: () => any): Promise<any[]> => {
  try { const { data, error } = await build(); if (error) return []; return data ?? []; } catch { return []; }
};

export const useCrmModulos = () => {
  const qc = useQueryClient();
  const { selectedCompanyId } = useCompany();
  const scoped = selectedCompanyId && selectedCompanyId !== "all";
  const companyId = scoped ? selectedCompanyId : null;
  // Na visão "todas" usa o conjunto global (company_id null); espelha a gravação.
  const co = (q: any) => (scoped ? q.eq("company_id", selectedCompanyId) : q.is("company_id", null));

  const query = useQuery({
    queryKey: ["crm-modulos", selectedCompanyId],
    staleTime: 60_000,
    queryFn: async () =>
      safe(() => co(db.from("crm_modulos").select("id,key,name,dor,comprador,canal_forte,tipo,color,order_index").order("order_index"))),
  });
  const modulos = (query.data ?? []) as CrmModulo[];

  const invalidate = () => qc.invalidateQueries({ queryKey: ["crm-modulos"] });

  const saveModulo = useMutation({
    mutationFn: async (m: Partial<CrmModulo> & { id?: string }) => {
      const patch = {
        name: m.name,
        dor: m.dor ?? null,
        comprador: m.comprador ?? null,
        canal_forte: m.canal_forte ?? null,
        tipo: m.tipo ?? "aquisicao",
        color: m.color || DEFAULT_MODULO_COLOR,
      };
      if (m.id) {
        const { error } = await db.from("crm_modulos").update(patch).eq("id", m.id);
        if (error) throw error;
      } else {
        const maxOrder = modulos.length ? Math.max(...modulos.map((r) => r.order_index)) : -1;
        const { error } = await db.from("crm_modulos").insert({
          key: m.key || slugifyModulo(m.name || ""),
          order_index: maxOrder + 1,
          company_id: companyId,
          ...patch,
        });
        if (error) throw error;
      }
    },
    onSuccess: invalidate,
    onError: (e: any) => toast({ title: "Erro ao salvar módulo", description: e?.message, variant: "destructive" }),
  });

  const deleteModulo = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db.from("crm_modulos").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError: (e: any) => toast({ title: "Erro ao excluir módulo", description: e?.message, variant: "destructive" }),
  });

  const reorderModulos = useMutation({
    mutationFn: async (orderedIds: string[]) => {
      for (let i = 0; i < orderedIds.length; i++) {
        const { error } = await db.from("crm_modulos").update({ order_index: i }).eq("id", orderedIds[i]);
        if (error) throw error;
      }
    },
    onSuccess: invalidate,
    onError: (e: any) => toast({ title: "Erro ao reordenar", description: e?.message, variant: "destructive" }),
  });

  // Batch-insert de um template (idempotente por key: pula as que já existem no produto).
  const seedModulos = useMutation({
    mutationFn: async (template: CrmModulo[]) => {
      const existing = new Set(modulos.map((r) => r.key));
      const toInsert = template
        .filter((t) => !existing.has(t.key))
        .map((t) => ({
          key: t.key, name: t.name, dor: t.dor ?? null, comprador: t.comprador ?? null,
          canal_forte: t.canal_forte ?? null, tipo: t.tipo, color: t.color, order_index: t.order_index,
          company_id: companyId,
        }));
      if (!toInsert.length) return;
      const { error } = await db.from("crm_modulos").insert(toInsert);
      if (error) throw error;
    },
    onSuccess: () => { invalidate(); toast({ title: "Módulos gerados" }); },
    onError: (e: any) => toast({ title: "Erro ao gerar módulos", description: e?.message, variant: "destructive" }),
  });

  return { modulos, isEmpty: modulos.length === 0, isLoading: query.isLoading, saveModulo, deleteModulo, reorderModulos, seedModulos };
};
