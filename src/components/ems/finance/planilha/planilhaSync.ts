// Planilha → estado-alvo do banco, e o diff contra o que já está lá. Puro e testável.
//
// Três famílias de linha, com regras de sync diferentes:
//  · `planilha:lanc:*`   — os fatos passados. Sync só nos MESES que o arquivo cobre, para
//    reimportar uma planilha enxuta (só os últimos meses) nunca apagar histórico antigo.
//  · `planilha:cfg:*`    — os recorrentes da Config. A tabela vem sempre completa no arquivo,
//    então sincroniza inteira.
//  · `planilha:ancora:*` — a linha de abertura de saldo. Sempre uma só, sempre recalculada.
// Qualquer outro uid é de origem desconhecida: NUNCA é tocado.

import { categoryScope } from "../financeCategories";
import { normalizarCategoria } from "./planilhaNormalize";
import type { SnapshotPlanilha, SituacaoLinha, TipoLinha } from "./planilhaNormalize";

export const PREFIXO_LANC = "planilha:lanc:";
export const PREFIXO_CFG = "planilha:cfg:";
export const PREFIXO_ANCORA = "planilha:ancora:";
export const UID_ANCORA = `${PREFIXO_ANCORA}saldo-inicial`;

export interface LinhaAlvo {
  uid: string; // vai em import_fingerprint (identidade estável da linha)
  description: string;
  amount: number;
  type: TipoLinha;
  category: string | null;
  date: string;
  due_date: string;
  status: SituacaoLinha;
  settled_at: string | null;
  is_recurring: boolean;
  recurrence_interval: string | null;
  recurrence_end_date: string | null;
  escopo: "pf" | "pj" | null;
  cliente_id: string | null;
}

export interface LinhaExistente {
  id: string;
  uid: string;
  description: string;
  amount: number;
  type: string;
  category: string | null;
  date: string;
  due_date: string | null;
  status: string | null;
  settled_at: string | null;
  is_recurring: boolean | null;
  recurrence_interval: string | null;
  recurrence_end_date: string | null;
  escopo: string | null;
  cliente_id: string | null;
}

export interface Alteracao {
  id: string;
  alvo: LinhaAlvo;
  antes: LinhaExistente;
  campos: string[];
}

/** Meses que o arquivo cobre. `inicio`/`fim` são só para exibir; quem manda é `meses`. */
export interface Janela {
  inicio: string;
  fim: string;
  meses: Set<string>; // "AAAA-MM"
}

export interface DiffPlanilha {
  novos: LinhaAlvo[];
  alterados: Alteracao[];
  removidos: LinhaExistente[];
  inalterados: number;
  janela: Janela | null;
  foraDaJanela: number;
  naoEhDaPlanilha: LinhaExistente[]; // lançamentos de outra origem dentro da janela
  uidsRepetidos: string[]; // colisão de identidade: sinal de planilha malformada
}

const somaMes = (ano: number, mes: number, n: number) => {
  const t = ano * 12 + (mes - 1) + n;
  return { ano: Math.floor(t / 12), mes: (t % 12) + 1 };
};
const ehBissexto = (a: number) => (a % 4 === 0 && a % 100 !== 0) || a % 400 === 0;
const ultimoDia = (ano: number, mes: number) => [31, ehBissexto(ano) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][mes - 1];
const montar = (ano: number, mes: number, d: number) =>
  `${ano}-${String(mes).padStart(2, "0")}-${String(Math.min(d, ultimoDia(ano, mes))).padStart(2, "0")}`;
const mesDe = (iso: string) => iso.slice(0, 7);

const semAcento = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();

/**
 * Primeiro vencimento ESTRITAMENTE depois da data-base. O mês da data-base já está fechado nos
 * Lançamentos (o DAS de agosto foi pago dia 08; a planilha não cobra de novo dia 20), então
 * cobrar de novo duplicaria o que já aconteceu.
 */
export const proximoVencimento = (dataBase: string, diaDoMes: number): string => {
  const ano = Number(dataBase.slice(0, 4));
  const mes = Number(dataBase.slice(5, 7));
  const desteMes = montar(ano, mes, diaDoMes);
  if (desteMes > dataBase) return desteMes;
  const p = somaMes(ano, mes, 1);
  return montar(p.ano, p.mes, diaDoMes);
};

/**
 * Os meses que o arquivo cobre — CONJUNTO, não intervalo. Um arquivo com jun e ago não autoriza
 * mexer em julho: como intervalo contíguo, um mês faltando no Excel apagaria o mês no banco.
 */
export const janelaDaPlanilha = (snap: SnapshotPlanilha): Janela | null => {
  const meses = new Set(snap.lancamentos.map((l) => mesDe(l.data)));
  if (!meses.size) return null;
  const ordenados = [...meses].sort();
  const ultimo = ordenados[ordenados.length - 1];
  return {
    inicio: `${ordenados[0]}-01`,
    fim: montar(Number(ultimo.slice(0, 4)), Number(ultimo.slice(5, 7)), 31),
    meses,
  };
};

/** Data-base da Config, com a MAIOR data dos lançamentos como reserva (não a última linha da aba). */
export const dataBaseDa = (snap: SnapshotPlanilha): string | null =>
  snap.config.dataBase || snap.lancamentos.reduce((m, l) => (l.data > m ? l.data : m), "") || null;

export interface Cliente {
  id: string;
  nome: string;
}

/** Cliente citado na descrição da receita. Compara sem acento e exigindo palavra inteira. */
const clienteDaDescricao = (descricao: string, clientes: Cliente[]): string | null => {
  const d = semAcento(descricao);
  let achado: Cliente | null = null;
  for (const c of clientes) {
    const n = semAcento(c.nome);
    if (n.length < 3) continue; // "BR", "GN" casariam qualquer coisa
    // Fronteira de palavra nas duas pontas: "Iris" não pode casar "Turismo Irises".
    const antes = d.indexOf(n) - 1;
    const i = d.indexOf(n);
    if (i < 0) continue;
    const okAntes = i === 0 || !/[a-z0-9]/.test(d[antes]);
    const okDepois = i + n.length >= d.length || !/[a-z0-9]/.test(d[i + n.length]);
    if (okAntes && okDepois && (!achado || n.length > semAcento(achado.nome).length)) achado = c;
  }
  return achado?.id ?? null;
};

const escopoDe = (categoria: string | null): "pf" | "pj" | null => {
  const s = categoryScope(categoria);
  return s === "PF" ? "pf" : s === "PJ" ? "pj" : null;
};

export interface OpcoesAlvo {
  clientes: Cliente[];
  /**
   * Caixa realizado que JÁ está no banco, sobreviverá à importação e não veio deste arquivo
   * (lançamentos de meses que o arquivo não cobre). Sem isso, a âncora de saldo dupla-conta esse
   * histórico e o saldo do app fica maior que o declarado na planilha.
   */
  realizadoPreservado?: number;
}

export interface ResultadoAlvo {
  /** Estado-alvo completo, âncora incluída. */
  linhas: LinhaAlvo[];
  /** A mesma referência que já está em `linhas` — exposta só para a prévia. Não concatenar. */
  ancora: LinhaAlvo | null;
  ignoradas: number; // linhas de simulação (sandbox) da Config
  encerradas: number; // recorrentes cujo prazo já venceu
}

/**
 * Estado-alvo: o que o banco deve conter depois da importação.
 *
 * Inclui a ÂNCORA de saldo — a planilha declara "saldo em caixa hoje" e o app deriva o saldo do
 * razão, então sem uma linha de abertura o número nunca bate. Ela é datada no último dia do mês
 * anterior ao primeiro mês do arquivo: dentro de um mês reportado, inflaria o resultado dele.
 */
export const construirAlvo = (snap: SnapshotPlanilha, opts: OpcoesAlvo): ResultadoAlvo => {
  const linhas: LinhaAlvo[] = [];

  for (const l of snap.lancamentos) {
    linhas.push({
      uid: l.uid,
      description: l.descricao,
      amount: l.valor,
      type: l.tipo,
      category: l.categoria,
      date: l.data,
      due_date: l.data,
      status: l.situacao,
      settled_at: l.situacao === "reconciled" ? l.data : null,
      is_recurring: false,
      recurrence_interval: null,
      recurrence_end_date: null,
      escopo: escopoDe(l.categoria),
      cliente_id: l.tipo === "income" ? clienteDaDescricao(l.descricao, opts.clientes) : null,
    });
  }

  const dataBase = dataBaseDa(snap);
  let ignoradas = 0;
  let encerradas = 0;
  for (const r of snap.config.recorrentes) {
    if (r.sandbox) { ignoradas += 1; continue; } // simulação: não entra na sobra (vira cenário)
    if (!dataBase) continue;
    const venc = proximoVencimento(dataBase, r.dia);
    // Prazo já vencido: `expandRecurringTransactions` empurra a própria âncora para o fluxo antes
    // de olhar o `recurrence_end_date`, então gravá-la criaria um compromisso fantasma.
    if (r.fim && venc > r.fim) { encerradas += 1; continue; }
    // Config não tem coluna de categoria: resolvida pela descrição, com a mesma régua dos lançamentos.
    const categoria = normalizarCategoria("", r.descricao, r.tipo);
    linhas.push({
      uid: r.uid,
      description: r.descricao,
      amount: r.valor,
      type: r.tipo,
      category: categoria,
      date: venc,
      due_date: venc,
      // Um vencimento FUTURO não pode nascer conciliado: gravaria `settled_at` e entraria no caixa
      // e na DRE como dinheiro que já moveu, contaminando inclusive o cálculo da âncora de saldo.
      status: "planned",
      settled_at: null,
      is_recurring: true,
      recurrence_interval: "monthly",
      recurrence_end_date: r.fim,
      escopo: escopoDe(categoria),
      cliente_id: r.tipo === "income" ? clienteDaDescricao(r.descricao, opts.clientes) : null,
    });
  }

  const janela = janelaDaPlanilha(snap);
  let ancora: LinhaAlvo | null = null;
  const saldoDeclarado = snap.config.saldoHoje;
  if (saldoDeclarado != null && janela && dataBase) {
    const realizadoNoArquivo = snap.lancamentos
      .filter((l) => l.situacao === "reconciled" && l.data <= dataBase)
      .reduce((a, l) => a + (l.tipo === "income" ? l.valor : -l.valor), 0);
    const diferenca = Math.round((saldoDeclarado - realizadoNoArquivo - (opts.realizadoPreservado || 0)) * 100) / 100;
    if (Math.abs(diferenca) >= 0.01) {
      const ant = somaMes(Number(janela.inicio.slice(0, 4)), Number(janela.inicio.slice(5, 7)), -1);
      const data = montar(ant.ano, ant.mes, 31);
      ancora = {
        uid: UID_ANCORA,
        description: "Saldo inicial (planilha)",
        amount: Math.abs(diferenca),
        type: diferenca >= 0 ? "income" : "expense",
        // Categoria "transfer" do catálogo: dinheiro que já existia não é receita nem despesa,
        // então não entra na DRE nem na base do imposto.
        category: "Saldo inicial",
        date: data,
        due_date: data,
        status: "reconciled",
        settled_at: data,
        is_recurring: false,
        recurrence_interval: null,
        recurrence_end_date: null,
        escopo: null,
        cliente_id: null,
      };
      linhas.push(ancora);
    }
  }

  return { linhas, ancora, ignoradas, encerradas };
};

// ───────────────────────── diff ─────────────────────────

/** Campos escritos pela importação. Tudo que é gravado tem que ser comparado, senão a planilha
 *  deixa de corrigir o campo depois da primeira gravação (ex.: cliente cadastrado só depois). */
const CAMPOS_TEXTO = ["description", "type", "category", "date", "due_date", "status", "settled_at",
  "recurrence_interval", "recurrence_end_date", "escopo", "cliente_id"] as const;

const igualTexto = (a: unknown, b: unknown) => (a ?? null) === (b ?? null);

const camposDiferentes = (alvo: LinhaAlvo, atual: LinhaExistente): string[] => {
  const out: string[] = [];
  if (Math.abs(alvo.amount - Number(atual.amount ?? 0)) >= 0.005) out.push("amount");
  if (Boolean(alvo.is_recurring) !== Boolean(atual.is_recurring)) out.push("is_recurring");
  for (const c of CAMPOS_TEXTO) if (!igualTexto(alvo[c], atual[c])) out.push(c);
  return out;
};

/** A linha cai dentro da janela? Para uma âncora RECORRENTE vale o intervalo que ela cobre: uma
 *  recorrência de 2025 sem prazo continua gerando ocorrências nos meses do arquivo, e essas
 *  ocorrências duplicariam com os lançamentos importados. */
const tocaAJanela = (l: LinhaExistente, janela: Janela): boolean => {
  const data = l.due_date || l.date;
  if (!l.is_recurring) return janela.meses.has(mesDe(data));
  const de = mesDe(data);
  const ate = l.recurrence_end_date ? mesDe(l.recurrence_end_date) : "9999-99";
  for (const m of janela.meses) if (m >= de && m <= ate) return true;
  return false;
};

/**
 * Diff entre o estado-alvo e o que já está no banco.
 * `existentes` traz as linhas com source_type='planilha' (de qualquer data); `outrasOrigens` traz
 * o resto — o que cair na janela vira `naoEhDaPlanilha`, porque dentro do período que ela cobre a
 * planilha é a fonte única.
 */
export const diffPlanilha = (
  alvo: LinhaAlvo[],
  existentes: LinhaExistente[],
  outrasOrigens: LinhaExistente[] = [],
  janela: Janela | null = null,
): DiffPlanilha => {
  const porUid = new Map<string, LinhaExistente>();
  const uidsRepetidos: string[] = [];
  for (const e of existentes) {
    if (!e.uid) continue;
    if (porUid.has(e.uid)) uidsRepetidos.push(e.uid);
    else porUid.set(e.uid, e);
  }

  const novos: LinhaAlvo[] = [];
  const alterados: Alteracao[] = [];
  const vistos = new Set<string>();
  let inalterados = 0;

  for (const l of alvo) {
    if (vistos.has(l.uid)) { uidsRepetidos.push(l.uid); continue; } // identidade duplicada: não insere cego
    vistos.add(l.uid);
    const atual = porUid.get(l.uid);
    if (!atual) { novos.push(l); continue; }
    porUid.delete(l.uid);
    const campos = camposDiferentes(l, atual);
    if (campos.length) alterados.push({ id: atual.id, alvo: l, antes: atual, campos });
    else inalterados += 1;
  }

  // O que sobrou existia no banco e não está mais na planilha.
  const removidos: LinhaExistente[] = [];
  let foraDaJanela = 0;
  for (const sobrou of porUid.values()) {
    const uid = sobrou.uid || "";
    // Lista de PERMISSÃO: só apaga o que a importação criou. Um uid desconhecido nunca é tocado.
    if (uid.startsWith(PREFIXO_CFG) || uid.startsWith(PREFIXO_ANCORA)) { removidos.push(sobrou); continue; }
    if (!uid.startsWith(PREFIXO_LANC)) continue;
    if (janela && tocaAJanela(sobrou, janela)) removidos.push(sobrou);
    else foraDaJanela += 1; // mês que o arquivo não cobre: preservado
  }

  const naoEhDaPlanilha = janela ? outrasOrigens.filter((o) => tocaAJanela(o, janela)) : [];

  return { novos, alterados, removidos, inalterados, janela, foraDaJanela, naoEhDaPlanilha, uidsRepetidos };
};

// ───────────────────────── conferência ─────────────────────────

export interface MesConferido {
  mes: string;
  reconhecido: boolean; // o rótulo virou um mês de verdade
  comparavel: boolean; // o mês está dentro do que o arquivo cobre (senão é projeção da planilha)
  entradasPlanilha: number;
  entradasApp: number;
  saidasPlanilha: number;
  saidasApp: number;
  bate: boolean;
}

export interface Conferencia {
  porMes: MesConferido[];
  bate: boolean;
}

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const NOMES = ["janeiro", "fevereiro", "marco", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

/** "jun./26" · "julho de 2026" · "março/26" → "AAAA-MM". Devolve null quando não é um mês. */
export const mesKey = (rotulo: string): string | null => {
  const m = semAcento(rotulo).match(/([a-z]+)\D*(\d{2,4})/);
  if (!m) return null;
  const palavra = m[1];
  // "outros 26" não é outubro: a palavra tem que ser a abreviação exata ou o nome completo.
  const i = MESES.indexOf(palavra) >= 0 ? MESES.indexOf(palavra) : NOMES.indexOf(palavra);
  if (i < 0) return null;
  const ano = Number(m[2]) < 100 ? 2000 + Number(m[2]) : Number(m[2]);
  return `${ano}-${String(i + 1).padStart(2, "0")}`;
};

/**
 * Conferência: o que o app calculou × o que a planilha declara.
 * Só meses RECONHECIDOS e DENTRO da janela entram no veredito — a Visão Geral também projeta
 * meses futuros (que vêm dos recorrentes, não dos Lançamentos), e compará-los daria vermelho
 * em toda importação correta.
 */
export const conferir = (snap: SnapshotPlanilha, linhas: LinhaAlvo[], janela: Janela | null = null): Conferencia => {
  const j = janela ?? janelaDaPlanilha(snap);
  const porMes = snap.totais.porMes.map((t): MesConferido => {
    const chave = mesKey(t.mes);
    const comparavel = !!chave && (!j || j.meses.has(chave));
    const doMes = chave ? linhas.filter((l) => l.uid.startsWith(PREFIXO_LANC) && mesDe(l.date) === chave) : [];
    const entradasApp = doMes.filter((l) => l.type === "income").reduce((a, l) => a + l.amount, 0);
    const saidasApp = doMes.filter((l) => l.type === "expense").reduce((a, l) => a + l.amount, 0);
    return {
      mes: t.mes,
      reconhecido: !!chave,
      comparavel,
      entradasPlanilha: t.entradas,
      entradasApp,
      saidasPlanilha: t.saidas,
      saidasApp,
      bate: Math.abs(entradasApp - t.entradas) < 1 && Math.abs(saidasApp - t.saidas) < 1,
    };
  });
  const comparaveis = porMes.filter((m) => m.comparavel);
  return { porMes, bate: comparaveis.length > 0 && comparaveis.every((m) => m.bate) };
};
