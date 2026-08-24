/* eslint-disable @typescript-eslint/no-explicit-any */
// Importação da planilha: analisar (sem gravar nada) → conferir a prévia → aplicar → desfazer.
//
// O motor é todo puro (planilhaParse/Normalize/Sync). Aqui só tem I/O: ler o banco, gravar o
// lote e mexer em financial_transactions. Nada é escrito antes de o usuário aprovar a prévia.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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

/** Tudo que foi LIDO (arquivo + banco). A análise é derivada disto, nunca guardada crua. */
interface Bruto {
  arquivo: string;
  snapshot: SnapshotPlanilha;
  clientes: { id: string; nome: string }[];
  /** TODAS as linhas do usuário — o casamento por fingerprint é por usuário, não por empresa. */
  todas: any[];
  /** Só as linhas do escopo atual — é o saldo que a âncora precisa fechar. */
  doEscopo: any[];
  daPlanilha: LinhaExistente[];
  outras: LinhaExistente[];
  brutas: Map<string, Record<string, any>>;
  janela: Janela | null;
  dataBase: string | null;
  /** Linhas da planilha que estão em OUTRA empresa — a importação as traz para o escopo atual. */
  foraDoEscopo: number;
}

export interface AnalisePlanilha {
  arquivo: string;
  /** Data-base lida da Config — se vier errada, os recorrentes disparam no mês errado. */
  dataBase: string | null;
  /** Linhas da planilha hoje em outra empresa — a importação as traz para o escopo atual. */
  foraDoEscopo: number;
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

/**
 * Deriva a análise do que foi lido. Depende de `removerOutras` porque a ÂNCORA de saldo depende:
 * ela cobre a diferença entre o saldo declarado e o que vai SOBRAR no banco, e as linhas de outra
 * origem dentro do período sobrevivem ou não conforme essa decisão.
 */
const derivar = (b: Bruto, removerOutras: boolean): AnalisePlanilha => {
  const { snapshot, janela, dataBase } = b;
  const paraRemoverIds = new Set(
    removerOutras && janela
      ? diffPlanilha([], [], b.outras, janela, snapshot.temConfig).naoEhDaPlanilha.map((o) => o.id)
      : [],
  );

  // Só o ESCOPO atual: o saldo que a âncora fecha é o da empresa selecionada, e somar o caixa de
  // outra empresa faria a âncora nascer com o valor (ou o sinal) errado.
  const realizadoPreservado = !janela || !dataBase ? 0 : b.doEscopo.reduce((a, t) => {
    const uid = t.import_fingerprint || "";
    if (uid.startsWith(PREFIXO_ANCORA)) return a; // a âncora antiga é recalculada, não preservada
    const data = t.due_date || t.date;
    const ehDaPlanilha = t.source_type === ORIGEM && !!uid;
    // Linha da planilha DENTRO da janela será substituída pelo alvo — o alvo já a contabiliza.
    // FORA da janela ela é preservada (diffPlanilha a conta em `foraDaJanela`), então o caixa dela
    // sobrevive e PRECISA entrar aqui: foi exatamente isso que a refatoração quebrou.
    if (ehDaPlanilha && janela.meses.has(String(data).slice(0, 7))) return a;
    if (paraRemoverIds.has(t.id)) return a; // vai ser removida nesta importação
    // "Pago" no app é `status === "reconciled" || settled_at` (financePeriodSource.ts:47).
    if (!(t.status === "reconciled" || t.settled_at) || data > dataBase) return a;
    return a + (t.type === "income" ? Number(t.amount) : -Number(t.amount));
  }, 0);

  const { linhas, ancora, ignoradas, encerradas } = construirAlvo(snapshot, { clientes: b.clientes, realizadoPreservado });
  const diff = diffPlanilha(linhas, b.daPlanilha, b.outras, janela, snapshot.temConfig);

  return {
    arquivo: b.arquivo, dataBase, foraDoEscopo: b.foraDoEscopo, snapshot, alvo: linhas, ancora, diff,
    conferencia: conferir(snapshot, linhas, janela), janela, ignoradas, encerradas, brutas: b.brutas,
  };
};

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
  "is_recurring", "recurrence_interval", "recurrence_end_date", "escopo", "cliente_id", "company_id",
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
const gravarConfig = async (snapshot: SnapshotPlanilha, guardar: GuardarAntes) => {
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
  // Já está tudo igual? Não escreve — senão uma reimportação idêntica deixaria um lote no
  // histórico dizendo que houve algo a desfazer quando não houve.
  if (atual && Object.entries(definidos).every(([k, v]) => Number(atual[k]) === Number(v))) return nada;
  // Colunas que talvez ainda não existam (migration mais nova que o deploy) são descartadas —
  // mandá-las derrubaria o upsert inteiro.
  const seguro = atual ? Object.fromEntries(Object.entries(definidos).filter(([k]) => k in atual)) : definidos;
  if (!Object.keys(seguro).length) {
    return { ...nada, aviso: "A config do app ainda não tem os campos de reserva/provisionado (migration pendente)." };
  }

  // Guarda só os campos tocados: o desfazer restaura exatamente o que havia antes (inclusive null).
  const campos = Object.keys(seguro);
  const antes = atual ? Object.fromEntries(campos.map((k) => [k, atual[k] ?? null])) : null;
  // Primeiro o que restaura campos sobrescritos — isso vale mesmo se o upsert falhar depois.
  await guardar({ antes, campos });

  const { error: erro } = await db.from("finance_settings").upsert({ ...(atual ?? {}), ...seguro }, { onConflict: "user_id" });
  if (erro) return { ...nada, aviso: `Não consegui gravar a config: ${erro.message}` };
  // `criou` só é gravado DEPOIS do sucesso: afirmá-lo antes faria o desfazer APAGAR uma linha de
  // config que a importação não criou (e que o usuário pode ter criado no app nesse meio-tempo).
  if (!atual) await guardar({ antes, campos, criou: true });
  return { antes, campos, aviso: null };
};

/**
 * Tetos por categoria do bloco "GASTO VARIÁVEL" da Config → finance_category_budgets.
 * Gravados no MÊS CORRENTE (é onde o painel de orçamento olha); a tabela é por (categoria, ano, mês)
 * e não herda de meses anteriores. Substituição total do mês, com o estado anterior guardado
 * para o desfazer.
 */
const gravarTetos = async (snapshot: SnapshotPlanilha, guardar: GuardarAntes) => {
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

  // Já está igual? Não escreve nada. Sem isto, reimportar o MESMO arquivo apagava e recriava os
  // tetos toda vez — e a promessa "reimportar não muda nada" deixava de valer.
  const assinatura = (pares: [string, number][]) =>
    pares.map(([c, v]) => `${c}=${v}`).sort().join("|");
  const atualAssinatura = assinatura(anteriores.map((a): [string, number] => [String(a.category), Number(a.teto)]));
  const alvoAssinatura = assinatura(snapshot.config.tetos.map((t): [string, number] => [t.categoria, t.teto]));
  if (atualAssinatura === alvoAssinatura) return { ...vazio, ano: 0, mes: 0 };

  await guardar({ antes: anteriores, ano, mes });
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

/**
 * Fábrica do callback "guarde este estado anterior AGORA". As três funções abaixo apagam dados
 * antes de recriá-los; sem gravar o `antes` no lote primeiro, uma falha no meio deixaria o
 * usuário sem nada para restaurar.
 */
type GuardarAntes = (valor: unknown) => Promise<void>;
const marcarAntes = (
  desfazer: Record<string, unknown>,
  chave: string,
  marcar: () => Promise<void>,
): GuardarAntes => async (valor) => {
  desfazer[chave] = valor;
  await marcar();
};

const MARCA_SANDBOX = "planilha:sandbox:";

/**
 * As 3 primeiras linhas da Config são a área de SIMULAÇÃO da planilha. Elas aparecem no Diário
 * dela, mas não entram no "sobra base" — que é exatamente o contrato de um CENÁRIO no app
 * (`project_financial_impacts`: soma no fluxo previsto, fora do canônico).
 * Sync por substituição: o conjunto é pequeno e vem completo no arquivo.
 */
const sincronizarSandbox = async (snapshot: SnapshotPlanilha, companyId: string | null, dataBase: string | null, guardar: GuardarAntes) => {
  const vazio = { criados: [] as string[], removidos: [] as Record<string, any>[], aviso: null as string | null, ignoradasPorData: 0 };
  // Mesma guarda de gravarConfig/gravarTetos: um arquivo SEM a aba Config não é prova de que o
  // usuário apagou as simulações. Sem isto, importar um arquivo parcial varreria os cenários.
  if (!snapshot.temConfig) return vazio;

  const db = supabase as any;
  // Escopado pela empresa: sem isto, importar numa empresa apagaria as simulações de todas as
  // outras e as recriaria na selecionada.
  const q = db.from("project_financial_impacts").select("*").like("notes", `${MARCA_SANDBOX}%`);
  const { data: atuais, error } = await (companyId ? q.eq("company_id", companyId) : q.is("company_id", null));
  // Tabela ausente (migration não aplicada) não pode derrubar a importação inteira.
  if (error) return vazio;

  const antigos = (atuais || []) as Record<string, any>[];
  const linhas = dataBase
    ? snapshot.config.recorrentes
      .filter((r) => r.sandbox)
      .map((r) => ({ r, venc: proximoVencimento(dataBase, r.dia) }))
      .filter(({ r, venc }) => !r.fim || venc <= r.fim)
    : [];

  // Mesmo conjunto de simulações? Não mexe. Apagar e recriar cenários idênticos a cada
  // reimportação trocaria os ids sem motivo e sujaria o histórico com lotes vazios.
  const assinatura = (itens: { uid: string; valor: number; venc: string; tipo: string }[]) =>
    itens.map((i) => `${i.uid}|${i.valor}|${i.venc}|${i.tipo}`).sort().join("~");
  const atualAssinatura = assinatura(antigos.map((a) => ({
    uid: String(a.notes || "").slice(MARCA_SANDBOX.length),
    valor: Number(a.amount), venc: String(a.expected_date || ""),
    tipo: a.impact_type === "revenue" ? "income" : "expense",
  })));
  const alvoAssinatura = assinatura(linhas.map(({ r, venc }) => ({ uid: r.uid, valor: r.valor, venc, tipo: r.tipo })));
  if (atualAssinatura === alvoAssinatura) return vazio;

  await guardar({ removidos: antigos, criados: [] });

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
  if (e2) return { ...vazio, removidos: antigos, aviso: `Não consegui gravar as simulações: ${e2.message}` };

  const criados = ((inseridos || []) as any[]).map((i) => i.id as string);
  // Os ids entram no desfazer AGORA: se a etapa seguinte falhar, esses cenários já criados
  // precisam poder ser apagados — senão o desfazer reinsere os antigos e duplica tudo.
  await guardar({ removidos: antigos, criados });

  const hoje = new Date().toISOString().slice(0, 10);
  return {
    criados,
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
  const [bruto, setBruto] = useState<Bruto | null>(null);
  const [removerOutras, setRemoverOutras] = useState(true);
  const [analisando, setAnalisando] = useState(false);

  const companyId = selectedCompanyId !== "all" ? selectedCompanyId : null;

  // A prévia é DERIVADA: mudar "remover linhas de outra origem" recalcula o diff e a âncora de
  // saldo na hora, em vez de o Aplicar fazer algo diferente do que a tela mostrou.
  const analise = useMemo(() => (bruto ? derivar(bruto, removerOutras) : null), [bruto, removerOutras]);

  const { data: lotes = [] } = useQuery({
    queryKey: ["finance-import-batches", selectedCompanyId],
    queryFn: async () => {
      const q = (supabase as any)
        .from("finance_import_batches")
        .select("id, arquivo, criados, atualizados, removidos, inalterados, janela_inicio, janela_fim, conferencia, avisos, desfeito_em, created_at")
        .order("created_at", { ascending: false })
        .limit(10);
      // `.eq("company_id", null)` vira `company_id=eq.null` no PostgREST e não casa NADA — no modo
      // "Todas as empresas" o histórico e o Desfazer sumiriam da tela.
      const { data, error } = await (companyId ? q.eq("company_id", companyId) : q.is("company_id", null));
      if (error) throw error;
      return (data || []) as LoteImport[];
    },
    retry: false,
  });

  // Lote sem nada para desfazer é APAGADO ao fim da importação (ver `aplicar`), então todo lote
  // que sobrevive aqui tem payload — inclusive os que só mexeram em Config/tetos/cenários e os que
  // falharam no meio. Filtrar por contadores de transação esconderia justamente esses.
  const ultimoLote = lotes.find((l) => !l.desfeito_em) || null;

  const limpar = useCallback(() => setBruto(null), []);

  // Trocar de empresa invalida a prévia: ela foi calculada contra outro escopo e aplicá-la
  // apagaria linhas da empresa antiga e inseriria na nova.
  const escopoAtual = useRef(companyId);
  useEffect(() => { escopoAtual.current = companyId; setBruto(null); setRemoverOutras(true); }, [companyId]);

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

      const brutas = new Map<string, Record<string, any>>(todas.map((t) => [t.id, t]));
      const daPlanilha = todas.filter((t) => t.source_type === ORIGEM && t.import_fingerprint).map(projetar);
      // Só as linhas da EMPRESA selecionada podem ser oferecidas para remoção — o select acima é
      // por usuário (a RLS é por user_id), então sem este filtro a prévia proporia apagar
      // lançamentos de outra empresa.
      // Uma linha marcada como da planilha mas SEM fingerprint é órfã: não casa com nada. Entra
      // aqui para pelo menos aparecer na prévia em vez de ficar invisível para sempre.
      const noEscopo = (t: any) => (companyId ? t.company_id === companyId : !t.company_id);
      const outras = todas
        .filter((t) => t.source_type !== ORIGEM || !t.import_fingerprint)
        .filter(noEscopo)
        .map(projetar);

      // Ler o arquivo e o banco leva segundos; se a empresa mudou nesse meio-tempo, a prévia foi
      // montada contra outro escopo e instalá-la faria o Aplicar mexer na empresa errada.
      if (escopoAtual.current !== companyId) return;

      setRemoverOutras(true);
      setBruto({
        arquivo: arquivo.name, snapshot, clientes, todas, doEscopo: todas.filter(noEscopo),
        daPlanilha, outras, brutas,
        janela: janelaDaPlanilha(snapshot), dataBase: dataBaseDa(snapshot),
        // A planilha é UMA por usuário; se linhas dela estiverem em outra empresa, a importação as
        // traz para o escopo atual. Contadas para a prévia poder dizer isso em voz alta.
        foraDoEscopo: todas.filter((t) => t.source_type === ORIGEM && t.import_fingerprint && !noEscopo(t)).length,
      });
    } catch (e: any) {
      setBruto(null);
      toast({ title: "Não consegui ler a planilha", description: e?.message, variant: "destructive" });
    } finally {
      setAnalisando(false);
    }
  }, [toast, companyId]);

  const aplicar = useMutation({
    mutationFn: async () => {
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

      // O estado anterior de TODOS os updates é montado e gravado ANTES de qualquer UPDATE sair.
      // Fazendo depois, uma falha no meio deixaria as linhas já sobrescritas sem nada para restaurar.
      const atualizados = diff.alterados.map((alt) => {
        const bruta = brutas.get(alt.id) || {};
        const antes: Record<string, any> = {};
        for (const c of CAMPOS_ESCRITOS) antes[c] = bruta[c] ?? null;
        return { id: alt.id, antes };
      });
      desfazer.atualizados = atualizados;
      if (atualizados.length) await marcar();
      for (const alt of diff.alterados) {
        const { error } = await supabase
          .from("financial_transactions")
          .update({ ...paraBanco(alt.alvo), company_id: companyId } as any)
          .eq("id", alt.id);
        if (error) throw error;
      }

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

      // Cada uma destas etapas apaga algo. `marcar()` entre elas garante que o "antes" já está no
      // banco quando o delete acontece — senão uma falha na etapa seguinte perderia o estado.
      const config = await gravarConfig(analise.snapshot, marcarAntes(desfazer, "config", marcar));
      const sandbox = await sincronizarSandbox(
        analise.snapshot, companyId, dataBaseDa(analise.snapshot), marcarAntes(desfazer, "impactos", marcar),
      );
      const tetos = await gravarTetos(analise.snapshot, marcarAntes(desfazer, "tetos", marcar));
      const extras = [
        config.aviso,
        sandbox.aviso,
        tetos.aviso,
        sandbox.ignoradasPorData
          ? `${sandbox.ignoradasPorData} simulação(ões) com data já passada não aparecem no fluxo.`
          : null,
      ].filter(Boolean) as string[];
      const avisos = [...analise.snapshot.avisos, ...extras];

      const mexeu = criados.length + atualizados.length + removidos.length;
      const { error: erroFinal } = await db.from("finance_import_batches").update({
        criados: criados.length,
        atualizados: atualizados.length,
        removidos: removidos.length,
        avisos,
        desfazer,
      }).eq("id", loteId);
      if (erroFinal) throw erroFinal;

      // Reimportação idêntica não deixa rastro: um lote 0/0/0 só polui o histórico. Se a Config,
      // os tetos ou os cenários mudaram, o lote fica (há o que desfazer).
      const mexeuConfig = !!config.campos.length || !!tetos.ano || !!sandbox.criados.length || !!sandbox.removidos.length;
      if (!mexeu && !mexeuConfig) await db.from("finance_import_batches").delete().eq("id", loteId);

      return { criados: criados.length, atualizados: atualizados.length, removidos: removidos.length, extras, mexeu };
    },
    onSuccess: (r) => {
      setBruto(null);
      queryClient.invalidateQueries({ queryKey: ["finance-transactions"] });
      queryClient.invalidateQueries({ queryKey: ["finance-import-batches"] });
      queryClient.invalidateQueries({ queryKey: ["finance-settings"] });
      queryClient.invalidateQueries({ queryKey: ["finance-forecast-impacts"] });
      queryClient.invalidateQueries({ queryKey: ["finance-category-budgets"] });
      const base = r.mexeu
        ? `${r.criados} novos · ${r.atualizados} atualizados · ${r.removidos} removidos.`
        : "Nenhuma transação mudou — o app já estava igual à planilha.";
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
        config?: { antes: Record<string, any> | null; campos: string[]; criou?: boolean } | null;
      };

      for (const lote of pedacos(payload.criados || [], 200)) {
        const { error: e } = await supabase.from("financial_transactions").delete().in("id", lote);
        if (e) throw e;
      }
      for (const a of payload.atualizados || []) {
        const { error: e } = await supabase.from("financial_transactions").update(a.antes as any).eq("id", a.id);
        if (e) throw e;
      }
      // upsert, não insert: se um desfazer anterior falhou no meio, parte das linhas já voltou —
      // um insert cru estouraria duplicate key e o desfazer nunca mais rodaria.
      for (const pedaco of pedacos(payload.removidos || [], 200)) {
        const { error: e } = await supabase.from("financial_transactions").upsert(pedaco as any, { onConflict: "id" });
        if (e) throw e;
      }

      // Os cenários da área de simulação também voltam ao estado anterior.
      const imp = payload.impactos || {};
      if (imp.criados?.length) {
        const { error: e } = await (supabase as any).from("project_financial_impacts").delete().in("id", imp.criados);
        if (e) throw e;
      }
      if (imp.removidos?.length) {
        const { error: e } = await (supabase as any)
          .from("project_financial_impacts").upsert(imp.removidos, { onConflict: "id" });
        if (e) throw e;
      }

      // Config: devolve os campos tocados ao valor anterior (null inclusive).
      if (payload.config?.campos?.length) {
        const db = supabase as any;
        const { data: linha } = await db.from("finance_settings").select("*").limit(1).maybeSingle();
        if (linha) {
          if (payload.config.criou) {
            // A linha de config não existia antes da importação: desfazer é removê-la, não zerar
            // campos (zerar deixaria uma config órfã que o usuário nunca criou).
            const { error: e } = await db.from("finance_settings").delete().eq("id", linha.id);
            if (e) throw e;
          } else {
            const volta = Object.fromEntries(payload.config.campos.map((k) => [k, payload.config?.antes?.[k] ?? null]));
            const { error: e } = await db.from("finance_settings").update(volta).eq("id", linha.id);
            if (e) throw e;
          }
        }
      }

      // Tetos: apaga o mês inteiro e recoloca o que existia antes.
      if (payload.tetos?.ano) {
        const db = supabase as any;
        const { error: e } = await db.from("finance_category_budgets")
          .delete().eq("year", payload.tetos.ano).eq("month", payload.tetos.mes);
        if (e) throw e;
        if (payload.tetos.antes?.length) {
          const { error: e3 } = await db.from("finance_category_budgets").upsert(payload.tetos.antes, { onConflict: "id" });
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
    removerOutras, setRemoverOutras,
    aplicar: () => aplicar.mutate(), aplicando: aplicar.isPending,
    desfazer: desfazer.mutate, desfazendo: desfazer.isPending,
    lotes, ultimoLote,
  };
};
