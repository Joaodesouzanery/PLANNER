import { useMemo } from "react";
import { format } from "date-fns";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { toast } from "@/hooks/use-toast";
import type { EstrTipo } from "./estrategiaProgress";

// Estratégia · CRUD das 6 tabelas da cascata + montagem da árvore Visão→Objetivo→KR→Ação.
// Config leve: em "todas" agrega tudo do usuário; scoped filtra por company_id (mesmo padrão dos deals/ativos).
const db = supabase as any;
const safe = async (build: () => any): Promise<any[]> => {
  try { const { data, error } = await build(); if (error) return []; return data ?? []; } catch { return []; }
};
const numOrNull = (v: unknown) => (v === "" || v == null ? null : Number(v));

export type AcaoStatus = "todo" | "doing" | "done";

export interface Visao {
  id: string; company_id: string | null; titulo: string; horizonte: string;
  metrica_alvo: string | null; valor_alvo: number | null; prazo: string | null;
}
export interface Objetivo {
  id: string; company_id: string | null; visao_id: string | null; ano: number | null;
  titulo: string; tipo: EstrTipo; metrica: string | null; alvo: number | null;
}
export interface Kr {
  id: string; company_id: string | null; objetivo_id: string | null; trimestre: string | null;
  descricao: string; tipo: EstrTipo; metrica: string | null; alvo: number | null; unidade: string | null;
}
export interface Acao {
  id: string; company_id: string | null; key_result_id: string | null; quinzena: string | null;
  descricao: string; status: AcaoStatus; custo_estimado: number | null; transacao_id: string | null; ordem: number;
}
export interface Ciclo {
  id: string; company_id: string | null; horizonte: string; inicio: string | null; fim: string | null; status: string;
}
export interface Revisao {
  id: string; company_id: string | null; ciclo_id: string | null; data: string;
  fiz: string | null; aprendi: string | null; nota: string | null; decisao: string;
}

// Árvore montada para a UI/engine (Visão com objetivos → krs → ações aninhados).
export interface AcaoNode extends Acao {}
export interface KrNode extends Kr { acoes: AcaoNode[]; }
export interface ObjetivoNode extends Objetivo { krs: KrNode[]; }
export interface VisaoNode extends Visao { objetivos: ObjetivoNode[]; }

export const useEstrategia = () => {
  const qc = useQueryClient();
  const { selectedCompanyId } = useCompany();
  const scoped = selectedCompanyId && selectedCompanyId !== "all";
  const companyId = scoped ? (selectedCompanyId as string) : null;
  const co = (q: any) => (scoped ? q.eq("company_id", selectedCompanyId) : q);

  const query = useQuery({
    queryKey: ["estrategia", selectedCompanyId],
    staleTime: 60_000,
    queryFn: async () => {
      const [visoes, objetivos, krs, acoes, ciclos, revisoes] = await Promise.all([
        safe(() => co(db.from("estrategia_visao").select("id,company_id,titulo,horizonte,metrica_alvo,valor_alvo,prazo")).order("created_at", { ascending: true })),
        safe(() => co(db.from("estrategia_objetivo").select("id,company_id,visao_id,ano,titulo,tipo,metrica,alvo")).order("created_at", { ascending: true })),
        safe(() => co(db.from("estrategia_kr").select("id,company_id,objetivo_id,trimestre,descricao,tipo,metrica,alvo,unidade")).order("created_at", { ascending: true })),
        safe(() => co(db.from("estrategia_acao").select("id,company_id,key_result_id,quinzena,descricao,status,custo_estimado,transacao_id,ordem")).order("ordem", { ascending: true })),
        safe(() => co(db.from("estrategia_ciclo").select("id,company_id,horizonte,inicio,fim,status")).order("inicio", { ascending: false, nullsFirst: false })),
        safe(() => co(db.from("estrategia_revisao").select("id,company_id,ciclo_id,data,fiz,aprendi,nota,decisao")).order("data", { ascending: false })),
      ]);
      return { visoes, objetivos, krs, acoes, ciclos, revisoes };
    },
  });

  const raw = query.data ?? { visoes: [], objetivos: [], krs: [], acoes: [], ciclos: [], revisoes: [] };
  const visoes = raw.visoes as Visao[];
  const objetivos = raw.objetivos as Objetivo[];
  const krs = raw.krs as Kr[];
  const acoes = raw.acoes as Acao[];
  const ciclos = raw.ciclos as Ciclo[];
  const revisoes = raw.revisoes as Revisao[];

  // Árvore aninhada (Visão→Objetivo→KR→Ação). Itens órfãos (sem pai) ficam de fora; a UI lista soltos à parte.
  const tree = useMemo<VisaoNode[]>(() => {
    const push = <V,>(m: Map<string, V[]>, key: string, val: V) => {
      const arr = m.get(key);
      if (arr) arr.push(val); else m.set(key, [val]);
    };
    const acoesByKr = new Map<string, AcaoNode[]>();
    for (const a of acoes) if (a.key_result_id) push(acoesByKr, a.key_result_id, a);
    const krsByObj = new Map<string, KrNode[]>();
    for (const k of krs) if (k.objetivo_id) push(krsByObj, k.objetivo_id, { ...k, acoes: acoesByKr.get(k.id) ?? [] });
    const objsByVisao = new Map<string, ObjetivoNode[]>();
    for (const o of objetivos) if (o.visao_id) push(objsByVisao, o.visao_id, { ...o, krs: krsByObj.get(o.id) ?? [] });
    return visoes.map((v) => ({ ...v, objetivos: objsByVisao.get(v.id) ?? [] }));
  }, [visoes, objetivos, krs, acoes]);

  const invalidate = () => qc.invalidateQueries({ queryKey: ["estrategia"] });

  // Fábrica genérica de upsert (insere com company_id do escopo; atualiza por id).
  // Prefixo `use*` porque chama useMutation — as chamadas são em ordem fixa (regras de hooks OK).
  const useUpsert = <T extends { id?: string }>(table: string, toPatch: (v: T) => Record<string, unknown>, okMsg: string) =>
    useMutation({
      mutationFn: async (v: T) => {
        const patch = toPatch(v);
        if (v.id) {
          const { error } = await db.from(table).update(patch).eq("id", v.id);
          if (error) throw error;
        } else {
          const { error } = await db.from(table).insert({ ...patch, company_id: companyId });
          if (error) throw error;
        }
      },
      onSuccess: () => { invalidate(); toast({ title: okMsg }); },
      onError: (e: any) => toast({ title: "Erro ao salvar", description: e?.message, variant: "destructive" }),
    });

  const useDelete = (table: string, okMsg: string) =>
    useMutation({
      mutationFn: async (id: string) => {
        const { error } = await db.from(table).delete().eq("id", id);
        if (error) throw error;
      },
      onSuccess: () => { invalidate(); toast({ title: okMsg }); },
      onError: (e: any) => toast({ title: "Erro ao remover", description: e?.message, variant: "destructive" }),
    });

  const saveVisao = useUpsert<Partial<Visao> & { id?: string }>("estrategia_visao", (v) => ({
    titulo: v.titulo, horizonte: v.horizonte || "10-15a",
    metrica_alvo: v.metrica_alvo || null, valor_alvo: numOrNull(v.valor_alvo), prazo: v.prazo || null,
  }), "Visão salva");

  const saveObjetivo = useUpsert<Partial<Objetivo> & { id?: string }>("estrategia_objetivo", (o) => ({
    visao_id: o.visao_id || null, ano: numOrNull(o.ano), titulo: o.titulo, tipo: o.tipo || "operacional",
    metrica: o.metrica || null, alvo: numOrNull(o.alvo),
  }), "Objetivo salvo");

  const saveKr = useUpsert<Partial<Kr> & { id?: string }>("estrategia_kr", (k) => ({
    objetivo_id: k.objetivo_id || null, trimestre: k.trimestre || null, descricao: k.descricao,
    tipo: k.tipo || "operacional", metrica: k.metrica || null, alvo: numOrNull(k.alvo), unidade: k.unidade || null,
  }), "Resultado-chave salvo");

  const saveAcao = useUpsert<Partial<Acao> & { id?: string }>("estrategia_acao", (a) => ({
    key_result_id: a.key_result_id || null, quinzena: a.quinzena || null, descricao: a.descricao,
    status: a.status || "todo", custo_estimado: numOrNull(a.custo_estimado),
    transacao_id: a.transacao_id ?? null, ordem: numOrNull(a.ordem) ?? 0,
  }), "Ação salva");

  const saveCiclo = useUpsert<Partial<Ciclo> & { id?: string }>("estrategia_ciclo", (c) => ({
    horizonte: c.horizonte || "trimestral", inicio: c.inicio || null, fim: c.fim || null, status: c.status || "aberto",
  }), "Ciclo salvo");

  const saveRevisao = useUpsert<Partial<Revisao> & { id?: string }>("estrategia_revisao", (r) => ({
    ciclo_id: r.ciclo_id || null, data: r.data || undefined, fiz: r.fiz || null, aprendi: r.aprendi || null,
    nota: r.nota || null, decisao: r.decisao || "manter",
  }), "Revisão registrada");

  // Atalho para mover o status de uma ação (o rollup de progresso reage sozinho).
  const setAcaoStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: AcaoStatus }) => {
      const { error } = await db.from("estrategia_acao").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => invalidate(),
    onError: (e: any) => toast({ title: "Erro ao mover ação", description: e?.message, variant: "destructive" }),
  });

  // Custo estimado da ação → SAÍDA PREVISTA no fluxo (status "planned"). Guarda o transacao_id de volta,
  // para não duplicar e permitir remover. user_id vem do trigger; company_id herda o da ação/escopo.
  const lancarNoFluxo = useMutation({
    mutationFn: async (a: Acao) => {
      const custo = Number(a.custo_estimado);
      if (!custo || custo <= 0) throw new Error("Ação sem custo estimado.");
      if (a.transacao_id) throw new Error("Custo já está no fluxo.");
      const hoje = format(new Date(), "yyyy-MM-dd");
      const { data, error } = await db.from("financial_transactions").insert({
        description: `Estratégia: ${a.descricao}`,
        amount: custo, type: "expense", category: "Estratégia",
        date: hoje, due_date: hoje, status: "planned",
        source_type: "estrategia", source_id: a.id,
        company_id: a.company_id ?? companyId,
      }).select("id").single();
      if (error) throw error;
      const { error: e2 } = await db.from("estrategia_acao").update({ transacao_id: data.id }).eq("id", a.id);
      if (e2) {
        // rollback: sem back-ref, a transação viraria órfã (invisível ao "remover", duplicável no retry).
        await db.from("financial_transactions").delete().eq("id", data.id);
        throw e2;
      }
    },
    onSuccess: () => { invalidate(); qc.invalidateQueries({ queryKey: ["finance-transactions"] }); toast({ title: "Custo lançado no fluxo (previsto)" }); },
    onError: (e: any) => toast({ title: "Erro ao lançar no fluxo", description: e?.message, variant: "destructive" }),
  });

  const removerDoFluxo = useMutation({
    mutationFn: async (a: Acao) => {
      if (a.transacao_id) {
        const { error } = await db.from("financial_transactions").delete().eq("id", a.transacao_id);
        if (error) throw error;
      }
      const { error: e2 } = await db.from("estrategia_acao").update({ transacao_id: null }).eq("id", a.id);
      if (e2) throw e2;
    },
    onSuccess: () => { invalidate(); qc.invalidateQueries({ queryKey: ["finance-transactions"] }); toast({ title: "Removido do fluxo" }); },
    onError: (e: any) => toast({ title: "Erro ao remover do fluxo", description: e?.message, variant: "destructive" }),
  });

  return {
    isLoading: query.isLoading,
    visoes, objetivos, krs, acoes, ciclos, revisoes, tree,
    saveVisao, deleteVisao: useDelete("estrategia_visao", "Visão removida"),
    saveObjetivo, deleteObjetivo: useDelete("estrategia_objetivo", "Objetivo removido"),
    saveKr, deleteKr: useDelete("estrategia_kr", "Resultado-chave removido"),
    saveAcao, deleteAcao: useDelete("estrategia_acao", "Ação removida"), setAcaoStatus,
    lancarNoFluxo, removerDoFluxo,
    saveCiclo, deleteCiclo: useDelete("estrategia_ciclo", "Ciclo removido"),
    saveRevisao, deleteRevisao: useDelete("estrategia_revisao", "Revisão removida"),
  };
};
