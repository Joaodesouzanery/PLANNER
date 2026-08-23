/* eslint-disable @typescript-eslint/no-explicit-any */
// Importação da planilha: analisar (sem gravar nada) → conferir a prévia → aplicar → desfazer.
//
// O motor é todo puro (planilhaParse/Normalize/Sync). Aqui só tem I/O: ler o banco, gravar o
// lote e mexer em financial_transactions. Nada é escrito antes de o usuário aprovar a prévia.

import { useCallback, useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCompany } from "@/contexts/CompanyContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { lerPlanilha } from "./planilhaParse";
import {
  conferir, construirAlvo, dataBaseDa, diffPlanilha, janelaDaPlanilha, proximoVencimento,
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

/**
 * Config da planilha → finance_settings. Sem isto, "reserva já separada", "provisionado" e o
 * gasto variável orçado eram lidos do arquivo e jogados fora — e o bloco CAIXA da Visão Geral
 * nunca sairia do valor inferido. Não é fatal: se falhar, a importação das transações continua
 * valendo e o problema é reportado.
 */
const gravarConfig = async (snapshot: SnapshotPlanilha) => {
  const nada = { antes: null as Record<string, any> | null, campos: [] as string[], aviso: null as string | null };
  const patch: Record<string, number | null> = {
    reserva_separada: snapshot.config.reservaSeparada,
    provisionado: snapshot.config.provisionado,
    expected_expense_variavel: snapshot.config.variavelTotal,
  };
  // Nada declarado no arquivo: não sobrescreve o que o usuário ajustou no app.
  if (Object.values(patch).every((v) => v == null)) return nada;

  const db = supabase as any;
  const { data: atual, error } = await db.from("finance_settings").select("*").limit(1).maybeSingle();
  if (error) return { ...nada, aviso: "Não consegui ler a config do app; reserva e gasto variável não foram atualizados." };

  const definidos = Object.fromEntries(Object.entries(patch).filter(([, v]) => v != null));
  // Colunas que talvez ainda não existam (migration mais nova que o deploy) são descartadas —
  // mandá-las derrubaria o upsert inteiro.
  const seguro = atual ? Object.fromEntries(Object.entries(definidos).filter(([k]) => k in atual)) : definidos;
  if (!Object.keys(seguro).length) {
    return { ...nada, aviso: "A config do app ainda não tem os campos de reserva/provisionado (migration pendente)." };
  }

  const { error: erro } = await db.from("finance_settings").upsert({ ...(atual ?? {}), ...seguro }, { onConflict: "user_id" });
  if (erro) return { ...nada, aviso: `Não consegui gravar a config: ${erro.message}` };
  // Guarda só os campos tocados: o desfazer restaura exatamente o que havia antes (inclusive null).
  const campos = Object.keys(seguro);
  const antes = atual ? Object.fromEntries(campos.map((k) => [k, atual[k] ?? null])) : null;
  return { antes, campos, aviso: null };
};

/**
 * Tetos por categoria do bloco "GASTO VARIÁVEL" da Config → finance_category_budgets.
 * Gravados no MÊS CORRENTE (é onde o painel de orçamento olha); a tabela é por (categoria, ano, mês)
 * e não herda de meses anteriores. Substituição total do mês, com o estado anterior guardado
 * para o desfazer.
 */
const gravarTetos = async (snapshot: SnapshotPlanilha) => {
  const vazio = { antes: [] as Record<string, any>[], ano: 0, mes: 0, gravados: 0, aviso: null as string | null };
  if (!snapshot.config.tetos.length) return vazio;

  const db = supabase as any;
  const agora = new Date();
  const ano = agora.getFullYear();
  const mes = agora.getMonth() + 1;

  const { data: antes, error } = await db
    .from("finance_category_budgets").select("*").eq("year", ano).eq("month", mes);
  if (error) return { ...vazio, aviso: "Não consegui ler os tetos atuais; o orçamento não foi atualizado." };

  const anteriores = (antes || []) as Record<string, any>[];
  if (anteriores.length) {
    const { error: e } = await db.from("finance_category_budgets").delete().in("id", anteriores.map((a) => a.id));
    if (e) return { ...vazio, aviso: `Não consegui limpar os tetos do mês: ${e.message}` };
  }

  const { error: e2 } = await db.from("finance_category_budgets").insert(
    snapshot.config.tetos.map((t) => ({ category: t.categoria, year: ano, month: mes, teto: t.teto })),
  );
  if (e2) return { ...vazio, antes: anteriores, ano, mes, aviso: `Não consegui gravar os tetos: ${e2.message}` };

  return { antes: anteriores, ano, mes, gravados: snapshot.config.tetos.length, aviso: null };
};

const MARCA_SANDBOX = "planilha:sandbox:";

/**
 * As 3 primeiras linhas da Config são a área de SIMULAÇÃO da planilha. Elas aparecem no Diário
 * dela, mas não entram no "sobra base" — que é exatamente o contrato de um CENÁRIO no app
 * (`project_financial_impacts`: soma no fluxo previsto, fora do canônico).
 * Sync por substituição: o conjunto é pequeno e vem completo no arquivo.
 */
const sincronizarSandbox = async (snapshot: SnapshotPlanilha, companyId: string | null, dataBase: string | null) => {
  const db = supabase as any;
  const { data: atuais, error } = await db
    .from("project_financial_impacts").select("*").like("notes", `${MARCA_SANDBOX}%`);
  if (error) {
    // Tabela ausente (migration não aplicada) não pode derrubar a importação inteira.
    return { criados: [] as string[], removidos: [] as Record<string, any>[], aviso: null, ignoradasPorData: 0 };
  }

  const antigos = (atuais || []) as Record<string, any>[];
  const linhas = dataBase
    ? snapshot.config.recorrentes
      .filter((r) => r.sandbox)
      .map((r) => ({ r, venc: proximoVencimento(dataBase, r.dia) }))
      .filter(({ r, venc }) => !r.fim || venc <= r.fim)
    : [];

  if (antigos.length) {
    const { error: e } = await db.from("project_financial_impacts").delete().in("id", antigos.map((a) => a.id));
    if (e) return { criados: [], removidos: [], aviso: `Não consegui limpar as simulações antigas: ${e.message}`, ignoradasPorData: 0 };
  }

  if (!linhas.length) return { criados: [], removidos: antigos, aviso: null, ignoradasPorData: 0 };

  const { data: inseridos, error: e2 } = await db.from("project_financial_impacts").insert(
    linhas.map(({ r, venc }) => ({
      title: r.descricao,
      amount: r.valor,
      impact_type: r.tipo === "income" ? "revenue" : "cost",
      expected_date: venc,
      status: "planned",
      company_id: companyId,
      notes: `${MARCA_SANDBOX}${r.uid}`,
    })),
  ).select("id");
  if (e2) return { criados: [], removidos: antigos, aviso: `Não consegui gravar as simulações: ${e2.message}`, ignoradasPorData: 0 };

  const hoje = new Date().toISOString().slice(0, 10);
  return {
    criados: ((inseridos || []) as any[]).map((i) => i.id as string),
    removidos: antigos,
    aviso: null,
    // Cenário com data no passado não aparece no fluxo (a projeção começa hoje) — vale avisar.
    ignoradasPorData: linhas.filter(({ venc }) => venc < hoje).length,
  };
};

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
        .eq("company_id", companyId)
        .order("created_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      return (data || []) as LoteImport[];
    },
    retry: false,
  });

  const ultimoLote = lotes.find((l) => !l.desfeito_em) || null;

  const limpar = useCallback(() => setAnalise(null), []);

  // Trocar de empresa invalida a prévia: ela foi calculada contra outro escopo e aplicá-la
  // apagaria linhas da empresa antiga e inseriria na nova.
  useEffect(() => { setAnalise(null); }, [companyId]);

  /** Lê o arquivo e monta a prévia. NÃO grava nada. */
  const analisar = useCallback(async (arquivo: File) => {
    setAnalisando(true);
    try {
      const snapshot = await lerPlanilha(arquivo);

      const { data: clientesRaw } = await (supabase as any).from("finance_clientes").select("id, nome");
      const clientes = ((clientesRaw || []) as any[]).map((c) => ({ id: String(c.id), nome: String(c.nome || "") }));

      // Todas as linhas do usuário, paginadas.
      // SEM filtro de empresa de propósito: o índice único de `import_fingerprint` é por USUÁRIO,
      // não por empresa. Filtrando, uma importação feita no modo "Todas" (company_id null) ficaria
      // invisível na importação seguinte e o insert estouraria duplicate key.
      // O avanço usa o tamanho da página RECEBIDA — se o servidor cortar abaixo de PAGINA
      // (db-max-rows menor), avançar de PAGINA em PAGINA puraria linhas em silêncio.
      const todas: any[] = [];
      for (let offset = 0; ; ) {
        const { data, error } = await supabase
          .from("financial_transactions").select("*").order("id")
          .range(offset, offset + PAGINA - 1);
        if (error) throw error;
        const lote = data || [];
        todas.push(...lote);
        if (!lote.length) break;
        offset += lote.length;
      }

      const janela = janelaDaPlanilha(snapshot);
      const dataBase = dataBaseDa(snapshot);

      // Caixa que já está no banco, sobrevive à importação e não veio deste arquivo: sem descontá-lo,
      // a âncora de saldo o contaria duas vezes ao reimportar uma planilha enxuta.
      const realizadoPreservado = !janela || !dataBase ? 0 : todas.reduce((a, t) => {
        const uid = t.import_fingerprint || "";
        if (uid.startsWith(PREFIXO_ANCORA)) return a; // a âncora antiga é substituída
        const data = t.due_date || t.date;
        // "Pago" no app é `status === "reconciled" || settled_at` (financePeriodSource.ts:47).
        // Só o status deixaria de fora linhas quitadas por settled_at e a âncora erraria o saldo.
        const pago = t.status === "reconciled" || !!t.settled_at;
        if (!pago || data > dataBase) return a; // só caixa que já moveu
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
      const db = supabase as any;

      // O lote é criado ANTES de qualquer escrita e vai sendo atualizado a cada etapa. Não há
      // transação aqui: se a importação falhar no meio, o que já foi gravado precisa ter um
      // "desfazer" gravado junto — senão o banco fica alterado sem caminho de volta.
      const { data: lote, error: erroLote } = await db.from("finance_import_batches").insert({
        company_id: companyId,
        origem: ORIGEM,
        arquivo: analise.arquivo,
        janela_inicio: diff.janela?.inicio ?? null,
        janela_fim: diff.janela?.fim ?? null,
        inalterados: diff.inalterados,
        conferencia: analise.conferencia,
        avisos: analise.snapshot.avisos,
        desfazer: {},
      }).select("id").single();
      if (erroLote) throw erroLote;
      const loteId = lote.id as string;

      const criados: string[] = [];
      const desfazer: Record<string, unknown> = { criados };
      const marcar = async () => {
        const { error } = await db.from("finance_import_batches").update({ desfazer }).eq("id", loteId);
        if (error) throw error;
      };
      for (const pedaco of pedacos(diff.novos, 200)) {
        const { data, error } = await supabase
          .from("financial_transactions")
          .insert(pedaco.map((l) => ({
            ...paraBanco(l),
            source_type: ORIGEM,
            import_fingerprint: l.uid,
            company_id: companyId,
          })) as any)
          .select("id");
        if (error) throw error;
        criados.push(...(data || []).map((r: any) => r.id));
        await marcar(); // o desfazer já cobre o que entrou até aqui
      }

      const atualizados: { id: string; antes: Record<string, any> }[] = [];
      desfazer.atualizados = atualizados;
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
      if (diff.alterados.length) await marcar();

      // Removidos = linhas que vieram da planilha e sumiram dela. As de outra origem dentro da
      // janela só saem se o usuário confirmar — é a decisão "a planilha é a fonte única no período".
      const paraRemover = [
        ...diff.removidos.map((r) => r.id),
        ...(removerOutras ? diff.naoEhDaPlanilha.map((r) => r.id) : []),
      ];
      const removidos = paraRemover.map((id) => brutas.get(id)).filter(Boolean) as Record<string, any>[];
      desfazer.removidos = removidos;
      if (removidos.length) await marcar(); // guarda ANTES de apagar
      for (const pedaco of pedacos(paraRemover, 200)) {
        const { error } = await supabase.from("financial_transactions").delete().in("id", pedaco);
        if (error) throw error;
      }

      const config = await gravarConfig(analise.snapshot);
      const sandbox = await sincronizarSandbox(analise.snapshot, companyId, dataBaseDa(analise.snapshot));
      const tetos = await gravarTetos(analise.snapshot);
      const extras = [
        config.aviso,
        sandbox.aviso,
        tetos.aviso,
        sandbox.ignoradasPorData
          ? `${sandbox.ignoradasPorData} simulação(ões) com data já passada não aparecem no fluxo.`
          : null,
      ].filter(Boolean) as string[];
      const avisos = [...analise.snapshot.avisos, ...extras];

      desfazer.impactos = { criados: sandbox.criados, removidos: sandbox.removidos };
      desfazer.tetos = tetos.ano ? { antes: tetos.antes, ano: tetos.ano, mes: tetos.mes } : null;
      desfazer.config = config.campos.length ? { antes: config.antes, campos: config.campos } : null;

      const { error: erroFinal } = await db.from("finance_import_batches").update({
        criados: criados.length,
        atualizados: atualizados.length,
        removidos: removidos.length,
        avisos,
        desfazer,
      }).eq("id", loteId);
      if (erroFinal) throw erroFinal;

      return { criados: criados.length, atualizados: atualizados.length, removidos: removidos.length, extras };
    },
    onSuccess: (r) => {
      setAnalise(null);
      queryClient.invalidateQueries({ queryKey: ["finance-transactions"] });
      queryClient.invalidateQueries({ queryKey: ["finance-import-batches"] });
      queryClient.invalidateQueries({ queryKey: ["finance-settings"] });
      queryClient.invalidateQueries({ queryKey: ["finance-forecast-impacts"] });
      queryClient.invalidateQueries({ queryKey: ["finance-category-budgets"] });
      const base = `${r.criados} novos · ${r.atualizados} atualizados · ${r.removidos} removidos.`;
      toast({
        title: "Planilha importada",
        description: r.extras.length ? `${base} ${r.extras.join(" ")}` : base,
        variant: r.extras.length ? "destructive" : undefined,
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
        impactos?: { criados?: string[]; removidos?: Record<string, any>[] };
        tetos?: { antes?: Record<string, any>[]; ano: number; mes: number } | null;
        config?: { antes: Record<string, any> | null; campos: string[] } | null;
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

      // Os cenários da área de simulação também voltam ao estado anterior.
      const imp = payload.impactos || {};
      if (imp.criados?.length) {
        const { error: e } = await (supabase as any).from("project_financial_impacts").delete().in("id", imp.criados);
        if (e) throw e;
      }
      if (imp.removidos?.length) {
        const { error: e } = await (supabase as any).from("project_financial_impacts").insert(imp.removidos);
        if (e) throw e;
      }

      // Config: devolve os campos tocados ao valor anterior (null inclusive).
      if (payload.config?.campos?.length) {
        const db = supabase as any;
        const { data: linha } = await db.from("finance_settings").select("*").limit(1).maybeSingle();
        if (linha) {
          const volta = Object.fromEntries(payload.config.campos.map((k) => [k, payload.config?.antes?.[k] ?? null]));
          const { error: e } = await db.from("finance_settings").update(volta).eq("id", linha.id);
          if (e) throw e;
        }
      }

      // Tetos: apaga o mês inteiro e recoloca o que existia antes.
      if (payload.tetos?.ano) {
        const db = supabase as any;
        const { error: e } = await db.from("finance_category_budgets")
          .delete().eq("year", payload.tetos.ano).eq("month", payload.tetos.mes);
        if (e) throw e;
        if (payload.tetos.antes?.length) {
          const { error: e3 } = await db.from("finance_category_budgets").insert(payload.tetos.antes);
          if (e3) throw e3;
        }
      }

      const { error: e2 } = await (supabase as any)
        .from("finance_import_batches").update({ desfeito_em: new Date().toISOString() }).eq("id", loteId);
      if (e2) throw e2;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["finance-transactions"] });
      queryClient.invalidateQueries({ queryKey: ["finance-import-batches"] });
      queryClient.invalidateQueries({ queryKey: ["finance-forecast-impacts"] });
      queryClient.invalidateQueries({ queryKey: ["finance-category-budgets"] });
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
