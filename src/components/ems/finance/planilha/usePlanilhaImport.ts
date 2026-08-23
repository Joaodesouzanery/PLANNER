/* eslint-disable @typescript-eslint/no-explicit-any */
// Importação da planilha: analisar (sem gravar nada) → conferir a prévia → aplicar → desfazer.
//
// O motor é todo puro (planilhaParse/Normalize/Sync). Aqui só tem I/O: ler o banco, gravar o
// lote e mexer em financial_transactions. Nada é escrito antes de o usuário aprovar a prévia.

import { useCallback, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCompany } from "@/contexts/CompanyContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { lerPlanilha } from "./planilhaParse";
import {
  conferir, construirAlvo, dataBaseDa, diffPlanilha, janelaDaPlanilha,
  PREFIXO_ANCORA,
  type Conferencia, type DiffPlanilha, type Janela, type LinhaAlvo, type LinhaExistente,
} from "./planilhaSync";
import type { SnapshotPlanilha } from "./planilhaNormalize";

const ORIGEM = "planilha";
const PAGINA = 1000; // o PostgREST corta em `db-max-rows` (1000 por padrão) — sem paginar, o diff
// veria menos linhas do que existem e reinseriria tudo que ficou de fora.

export interface AnalisePlanilha {
  arquivo: string;
  snapshot: SnapshotPlanilha;
  alvo: LinhaAlvo[];
  ancora: LinhaAlvo | null;
  diff: DiffPlanilha;
  conferencia: Conferencia;
  janela: Janela | null;
  ignoradas: number;
  encerradas: number;
  /** id → linha completa do banco, para o payload de desfazer. */
  brutas: Map<string, Record<string, any>>;
}

export interface LoteImport {
  id: string;
  arquivo: string | null;
  criados: number;
  atualizados: number;
  removidos: number;
  inalterados: number;
  janela_inicio: string | null;
  janela_fim: string | null;
  conferencia: any;
  avisos: string[];
  desfeito_em: string | null;
  created_at: string;
}

/** Campos que o sync escreve. O resto da linha (produto_id, cost_bucket_id…) fica intocado. */
const CAMPOS_ESCRITOS = [
  "description", "amount", "type", "category", "date", "due_date", "status", "settled_at",
  "is_recurring", "recurrence_interval", "recurrence_end_date", "escopo", "cliente_id",
] as const;

const paraBanco = (l: LinhaAlvo) => ({
  description: l.description,
  amount: l.amount,
  type: l.type,
  category: l.category,
  date: l.date,
  due_date: l.due_date,
  status: l.status,
  settled_at: l.settled_at,
  is_recurring: l.is_recurring,
  recurrence_interval: l.recurrence_interval,
  recurrence_end_date: l.recurrence_end_date,
  escopo: l.escopo,
  cliente_id: l.cliente_id,
});

const projetar = (t: any): LinhaExistente => ({
  id: t.id, uid: t.import_fingerprint || "", description: t.description, amount: Number(t.amount),
  type: t.type, category: t.category, date: t.date, due_date: t.due_date, status: t.status,
  settled_at: t.settled_at, is_recurring: t.is_recurring, recurrence_interval: t.recurrence_interval,
  recurrence_end_date: t.recurrence_end_date, escopo: t.escopo, cliente_id: t.cliente_id,
});

const pedacos = <T,>(itens: T[], n: number): T[][] => {
  const out: T[][] = [];
  for (let i = 0; i < itens.length; i += n) out.push(itens.slice(i, i + n));
  return out;
};

export const usePlanilhaImport = () => {
  const { selectedCompanyId } = useCompany();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [analise, setAnalise] = useState<AnalisePlanilha | null>(null);
  const [analisando, setAnalisando] = useState(false);

  const companyId = selectedCompanyId !== "all" ? selectedCompanyId : null;

  const { data: lotes = [] } = useQuery({
    queryKey: ["finance-import-batches", selectedCompanyId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("finance_import_batches")
        .select("id, arquivo, criados, atualizados, removidos, inalterados, janela_inicio, janela_fim, conferencia, avisos, desfeito_em, created_at")
        .order("created_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      return (data || []) as LoteImport[];
    },
    retry: false,
  });

  const ultimoLote = lotes.find((l) => !l.desfeito_em) || null;

  const limpar = useCallback(() => setAnalise(null), []);

  /** Lê o arquivo e monta a prévia. NÃO grava nada. */
  const analisar = useCallback(async (arquivo: File) => {
    setAnalisando(true);
    try {
      const snapshot = await lerPlanilha(arquivo);

      const { data: clientesRaw } = await (supabase as any).from("finance_clientes").select("id, nome");
      const clientes = ((clientesRaw || []) as any[]).map((c) => ({ id: String(c.id), nome: String(c.nome || "") }));

      // Todas as linhas, paginadas — o diff precisa enxergar o banco inteiro para não duplicar.
      const todas: any[] = [];
      for (let pagina = 0; ; pagina += 1) {
        let q = supabase.from("financial_transactions").select("*").order("id");
        if (companyId) q = q.eq("company_id", companyId);
        const { data, error } = await q.range(pagina * PAGINA, (pagina + 1) * PAGINA - 1);
        if (error) throw error;
        todas.push(...(data || []));
        if (!data || data.length < PAGINA) break;
      }

      const janela = janelaDaPlanilha(snapshot);
      const dataBase = dataBaseDa(snapshot);

      // Caixa que já está no banco, sobrevive à importação e não veio deste arquivo: sem descontá-lo,
      // a âncora de saldo o contaria duas vezes ao reimportar uma planilha enxuta.
      const realizadoPreservado = !janela || !dataBase ? 0 : todas.reduce((a, t) => {
        const uid = t.import_fingerprint || "";
        if (uid.startsWith(PREFIXO_ANCORA)) return a; // a âncora antiga é substituída
        const data = t.due_date || t.date;
        if (t.status !== "reconciled" || data > dataBase) return a; // só caixa que já moveu
        if (janela.meses.has(String(data).slice(0, 7))) return a; // dentro do arquivo: já contado
        return a + (t.type === "income" ? Number(t.amount) : -Number(t.amount));
      }, 0);

      const { linhas, ancora, ignoradas, encerradas } = construirAlvo(snapshot, { clientes, realizadoPreservado });

      const brutas = new Map<string, Record<string, any>>(todas.map((t) => [t.id, t]));
      const daPlanilha = todas.filter((t) => t.source_type === ORIGEM && t.import_fingerprint).map(projetar);
      // Uma linha marcada como da planilha mas SEM fingerprint é órfã: não casa com nada. Vai para
      // "outras origens" para pelo menos aparecer na prévia em vez de ficar invisível para sempre.
      const outras = todas.filter((t) => t.source_type !== ORIGEM || !t.import_fingerprint).map(projetar);

      const diff = diffPlanilha(linhas, daPlanilha, outras, janela);
      setAnalise({
        arquivo: arquivo.name, snapshot, alvo: linhas, ancora, diff,
        conferencia: conferir(snapshot, linhas, janela), janela, ignoradas, encerradas, brutas,
      });
    } catch (e: any) {
      setAnalise(null);
      toast({ title: "Não consegui ler a planilha", description: e?.message, variant: "destructive" });
    } finally {
      setAnalisando(false);
    }
  }, [toast, companyId]);

  const aplicar = useMutation({
    mutationFn: async ({ removerOutras }: { removerOutras: boolean }) => {
      if (!analise) throw new Error("Nada para aplicar.");
      const { diff, brutas } = analise;

      const criados: string[] = [];
      for (const lote of pedacos(diff.novos, 200)) {
        const { data, error } = await supabase
          .from("financial_transactions")
          .insert(lote.map((l) => ({
            ...paraBanco(l),
            source_type: ORIGEM,
            import_fingerprint: l.uid,
            company_id: companyId,
          })) as any)
          .select("id");
        if (error) throw error;
        criados.push(...(data || []).map((r: any) => r.id));
      }

      const atualizados: { id: string; antes: Record<string, any> }[] = [];
      for (const alt of diff.alterados) {
        const bruta = brutas.get(alt.id) || {};
        const antes: Record<string, any> = {};
        for (const c of CAMPOS_ESCRITOS) antes[c] = bruta[c] ?? null;
        const { error } = await supabase
          .from("financial_transactions")
          .update(paraBanco(alt.alvo) as any)
          .eq("id", alt.id);
        if (error) throw error;
        atualizados.push({ id: alt.id, antes });
      }

      // Removidos = linhas que vieram da planilha e sumiram dela. As de outra origem dentro da
      // janela só saem se o usuário confirmar — é a decisão "a planilha é a fonte única no período".
      const paraRemover = [
        ...diff.removidos.map((r) => r.id),
        ...(removerOutras ? diff.naoEhDaPlanilha.map((r) => r.id) : []),
      ];
      const removidos = paraRemover.map((id) => brutas.get(id)).filter(Boolean) as Record<string, any>[];
      for (const lote of pedacos(paraRemover, 200)) {
        const { error } = await supabase.from("financial_transactions").delete().in("id", lote);
        if (error) throw error;
      }

      const { error: erroLote } = await (supabase as any).from("finance_import_batches").insert({
        company_id: companyId,
        origem: ORIGEM,
        arquivo: analise.arquivo,
        janela_inicio: diff.janela?.inicio ?? null,
        janela_fim: diff.janela?.fim ?? null,
        criados: criados.length,
        atualizados: atualizados.length,
        removidos: removidos.length,
        inalterados: diff.inalterados,
        conferencia: analise.conferencia,
        avisos: analise.snapshot.avisos,
        desfazer: { criados, atualizados, removidos },
      });
      if (erroLote) throw erroLote;

      return { criados: criados.length, atualizados: atualizados.length, removidos: removidos.length };
    },
    onSuccess: (r) => {
      setAnalise(null);
      queryClient.invalidateQueries({ queryKey: ["finance-transactions"] });
      queryClient.invalidateQueries({ queryKey: ["finance-import-batches"] });
      toast({
        title: "Planilha importada",
        description: `${r.criados} novos · ${r.atualizados} atualizados · ${r.removidos} removidos.`,
      });
    },
    onError: (e: any) => toast({ title: "Erro ao importar", description: e?.message, variant: "destructive" }),
  });

  const desfazer = useMutation({
    mutationFn: async (loteId: string) => {
      const { data, error } = await (supabase as any)
        .from("finance_import_batches").select("desfazer, desfeito_em").eq("id", loteId).maybeSingle();
      if (error) throw error;
      if (!data) throw new Error("Lote não encontrado.");
      if (data.desfeito_em) throw new Error("Esta importação já foi desfeita.");
      const payload = (data.desfazer || {}) as {
        criados?: string[]; atualizados?: { id: string; antes: Record<string, any> }[]; removidos?: Record<string, any>[];
      };

      for (const lote of pedacos(payload.criados || [], 200)) {
        const { error: e } = await supabase.from("financial_transactions").delete().in("id", lote);
        if (e) throw e;
      }
      for (const a of payload.atualizados || []) {
        const { error: e } = await supabase.from("financial_transactions").update(a.antes as any).eq("id", a.id);
        if (e) throw e;
      }
      for (const lote of pedacos(payload.removidos || [], 200)) {
        const { error: e } = await supabase.from("financial_transactions").insert(lote as any);
        if (e) throw e;
      }

      const { error: e2 } = await (supabase as any)
        .from("finance_import_batches").update({ desfeito_em: new Date().toISOString() }).eq("id", loteId);
      if (e2) throw e2;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["finance-transactions"] });
      queryClient.invalidateQueries({ queryKey: ["finance-import-batches"] });
      toast({ title: "Importação desfeita", description: "As transações voltaram ao estado anterior." });
    },
    onError: (e: any) => toast({ title: "Não consegui desfazer", description: e?.message, variant: "destructive" }),
  });

  return {
    analise, analisando, analisar, limpar,
    aplicar: aplicar.mutate, aplicando: aplicar.isPending,
    desfazer: desfazer.mutate, desfazendo: desfazer.isPending,
    lotes, ultimoLote,
  };
};
