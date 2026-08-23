// Planilha → estado-alvo do banco, e o diff contra o que já está lá. Puro e testável.
//
// Duas famílias de linha, com regras de sync diferentes:
//  · `planilha:lanc:*` — os fatos passados. Sync só DENTRO da janela que o arquivo cobre, para
//    reimportar uma planilha "enxuta" (só os últimos meses) nunca apagar histórico antigo.
//  · `planilha:cfg:*` — os recorrentes da Config. A tabela vem sempre completa no arquivo, então
//    sincroniza inteira.

import { categoryScope } from "../financeCategories";
import { normalizarCategoria } from "./planilhaNormalize";
import type { SnapshotPlanilha, SituacaoLinha, TipoLinha } from "./planilhaNormalize";

export interface LinhaAlvo {
  uid: string; // vai em import_fingerprint (identidade estável da linha)
  description: string;
  amount: number;
  type: TipoLinha;
  category: string | null;
  date: string;
  due_date: string;
  status: SituacaoLinha;
  is_recurring: boolean;
  recurrence_interval: string | null;
  recurrence_end_date: string | null;
  escopo: "pf" | "pj" | null;
  cliente: string | null; // nome; vira cliente_id na gravação
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
  is_recurring: boolean | null;
  recurrence_end_date: string | null;
}

export interface Alteracao {
  id: string;
  alvo: LinhaAlvo;
  antes: LinhaExistente;
  campos: string[];
}

export interface DiffPlanilha {
  novos: LinhaAlvo[];
  alterados: Alteracao[];
  removidos: LinhaExistente[];
  inalterados: number;
  janela: { inicio: string; fim: string } | null;
  foraDaJanela: number;
  naoEhDaPlanilha: LinhaExistente[]; // lançamentos de outra origem dentro da janela
}

const somaMes =(ano: number, mes: number, n: number) => {
  const t = ano * 12 + (mes - 1) + n;
  return { ano: Math.floor(t / 12), mes: (t % 12) + 1 };
};
const ehBissexto = (a: number) => (a % 4 === 0 && a % 100 !== 0) || a % 400 === 0;
const ultimoDia = (ano: number, mes: number) => [31, ehBissexto(ano) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][mes - 1];
const montar = (ano: number, mes: number, d: number) =>
  `${ano}-${String(mes).padStart(2, "0")}-${String(Math.min(d, ultimoDia(ano, mes))).padStart(2, "0")}`;

/**
 * Primeiro vencimento ESTRITAMENTE depois da data-base. O mês da data-base já está fechado nos
 * Lançamentos (o DAS de agosto foi pago dia 08; a planilha não cobra de novo dia 20), então
 * cobrar de novo duplicaria com o que já aconteceu.
 */
export const proximoVencimento = (dataBase: string, diaDoMes: number): string => {
  const ano = Number(dataBase.slice(0, 4));
  const mes = Number(dataBase.slice(5, 7));
  const desteMes = montar(ano, mes, diaDoMes);
  if (desteMes > dataBase) return desteMes;
  const p = somaMes(ano, mes, 1);
  return montar(p.ano, p.mes, diaDoMes);
};

/** Nome do cliente quando a linha é uma receita de contrato (usado p/ ligar cliente_id). */
const clienteDaDescricao = (descricao: string, clientes: string[]): string | null => {
  const d = descricao.toLowerCase();
  let achado: string | null = null;
  for (const nome of clientes) {
    const n = nome.toLowerCase();
    if (n && d.includes(n) && (!achado || n.length > achado.length)) achado = nome;
  }
  return achado;
};

const escopoDe = (categoria: string | null): "pf" | "pj" | null => {
  const s = categoryScope(categoria);
  return s === "PF" ? "pf" : s === "PJ" ? "pj" : null;
};

export interface OpcoesAlvo {
  clientes: string[]; // nomes de finance_clientes, p/ ligar as receitas
}

/**
 * Estado-alvo: o que o banco deve conter depois da importação.
 * Inclui a ÂNCORA de saldo — a planilha declara "saldo em caixa hoje" e o app deriva o saldo do
 * razão, então sem uma linha de abertura o número nunca bate. O valor é a diferença entre o
 * saldo declarado e o que os próprios lançamentos somam até a data-base.
 */
export const construirAlvo = (snap: SnapshotPlanilha, opts: OpcoesAlvo): { linhas: LinhaAlvo[]; ancora: LinhaAlvo | null; ignoradas: number } => {
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
      is_recurring: false,
      recurrence_interval: null,
      recurrence_end_date: null,
      escopo: escopoDe(l.categoria),
      cliente: l.tipo === "income" ? clienteDaDescricao(l.descricao, opts.clientes) : null,
    });
  }

  const dataBase = snap.config.dataBase || snap.lancamentos.at(-1)?.data || null;
  let ignoradas = 0;
  for (const r of snap.config.recorrentes) {
    if (r.sandbox) { ignoradas += 1; continue; } // simulação: não entra na sobra (vira cenário)
    if (!dataBase) continue;
    const venc = proximoVencimento(dataBase, r.dia);
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
      // SEMPRE "planned": a âncora recorrente é um compromisso futuro. Se entrasse como paga, as
      // ocorrências passadas geradas pelo motor herdariam "pago" e duplicariam com os Lançamentos.
      status: "planned",
      is_recurring: true,
      recurrence_interval: "monthly",
      recurrence_end_date: r.fim,
      escopo: escopoDe(categoria),
      cliente: r.tipo === "income" ? clienteDaDescricao(r.descricao, opts.clientes) : null,
    });
  }

  // Âncora de saldo.
  let ancora: LinhaAlvo | null = null;
  const saldoDeclarado = snap.config.saldoHoje;
  if (saldoDeclarado != null && snap.lancamentos.length && dataBase) {
    const realizado = snap.lancamentos
      .filter((l) => l.situacao === "reconciled" && l.data <= dataBase)
      .reduce((a, l) => a + (l.tipo === "income" ? l.valor : -l.valor), 0);
    const diferenca = Math.round((saldoDeclarado - realizado) * 100) / 100;
    if (Math.abs(diferenca) >= 0.01) {
      // Último dia do mês ANTERIOR ao primeiro lançamento — se caísse dentro do primeiro mês,
      // inflaria o resultado daquele mês e a Visão Geral não bateria com a planilha.
      const primeira = snap.lancamentos.reduce((min, l) => (l.data < min ? l.data : min), snap.lancamentos[0].data);
      const ant = somaMes(Number(primeira.slice(0, 4)), Number(primeira.slice(5, 7)), -1);
      const anterior = montar(ant.ano, ant.mes, 31);
      ancora = {
        uid: "planilha:ancora:saldo-inicial",
        description: "Saldo inicial (planilha)",
        amount: Math.abs(diferenca),
        type: diferenca >= 0 ? "income" : "expense",
        category: "Saldo inicial",
        date: anterior,
        due_date: anterior,
        status: "reconciled",
        is_recurring: false,
        recurrence_interval: null,
        recurrence_end_date: null,
        escopo: null,
        cliente: null,
      };
      linhas.push(ancora);
    }
  }

  return { linhas, ancora, ignoradas };
};

const CAMPOS: (keyof LinhaAlvo & keyof LinhaExistente)[] = [
  "description", "amount", "type", "category", "date", "due_date", "status", "is_recurring", "recurrence_end_date",
];

const igual = (a: unknown, b: unknown) => {
  if (typeof a === "number" || typeof b === "number") return Math.abs(Number(a || 0) - Number(b || 0)) < 0.005;
  if (typeof a === "boolean" || typeof b === "boolean") return Boolean(a) === Boolean(b);
  return (a ?? null) === (b ?? null) || String(a ?? "") === String(b ?? "");
};

/**
 * A linha cai dentro da janela? Para uma linha comum é a data. Para uma ÂNCORA RECORRENTE é o
 * intervalo que ela cobre: uma recorrência de 2025 sem data-fim continua gerando ocorrências
 * dentro do período da planilha, e essas ocorrências duplicariam com os lançamentos importados.
 */
const tocaAJanela = (l: LinhaExistente, janela: { inicio: string; fim: string }): boolean => {
  const data = l.due_date || l.date;
  if (!l.is_recurring) return data >= janela.inicio && data <= janela.fim;
  return data <= janela.fim && (!l.recurrence_end_date || l.recurrence_end_date >= janela.inicio);
};

/**
 * Diff entre o estado-alvo e o que já está no banco.
 * `existentes` deve trazer TODAS as linhas com source_type='planilha' (de qualquer data) mais as
 * de outras origens que caiam na janela — estas últimas viram `naoEhDaPlanilha`, porque a planilha
 * é a fonte única dentro do período que ela cobre.
 */
export const diffPlanilha = (
  alvo: LinhaAlvo[],
  existentes: LinhaExistente[],
  outrasOrigens: LinhaExistente[] = [],
): DiffPlanilha => {
  // Janela em MESES INTEIROS, não no intervalo exato das datas: se fosse pela menor/maior data,
  // apagar a primeira linha de junho no Excel encolheria a janela e essa mesma linha ficaria
  // "fora dela" — sobreviveria para sempre no app. O arquivo cobre meses, e manda no mês inteiro.
  const datas = alvo.filter((l) => l.uid.startsWith("planilha:lanc:")).map((l) => l.date).sort();
  const janela = datas.length
    ? {
        inicio: `${datas[0].slice(0, 7)}-01`,
        fim: montar(Number(datas[datas.length - 1].slice(0, 4)), Number(datas[datas.length - 1].slice(5, 7)), 31),
      }
    : null;

  const porUid = new Map(existentes.map((e) => [e.uid, e]));
  const novos: LinhaAlvo[] = [];
  const alterados: Alteracao[] = [];
  let inalterados = 0;

  for (const l of alvo) {
    const atual = porUid.get(l.uid);
    if (!atual) { novos.push(l); continue; }
    porUid.delete(l.uid);
    const campos = CAMPOS.filter((c) => !igual(l[c], atual[c]));
    if (campos.length) alterados.push({ id: atual.id, alvo: l, antes: atual, campos });
    else inalterados += 1;
  }

  // O que sobrou existia no banco e não está mais na planilha.
  const removidos: LinhaExistente[] = [];
  let foraDaJanela = 0;
  for (const sobrou of porUid.values()) {
    const ehLancamento = sobrou.uid.startsWith("planilha:lanc:");
    if (!ehLancamento) { removidos.push(sobrou); continue; } // Config vem completa: sincroniza inteira
    if (janela && tocaAJanela(sobrou, janela)) removidos.push(sobrou);
    else foraDaJanela += 1; // fora do período do arquivo: preservado
  }

  const naoEhDaPlanilha = janela ? outrasOrigens.filter((o) => tocaAJanela(o, janela)) : [];

  return { novos, alterados, removidos, inalterados, janela, foraDaJanela, naoEhDaPlanilha };
};

/** Conferência: o que o app calculou × o que a planilha declara. */
export interface Conferencia {
  porMes: { mes: string; entradasPlanilha: number; entradasApp: number; saidasPlanilha: number; saidasApp: number; bate: boolean }[];
  bate: boolean;
}

const mesKey = (rotulo: string): string | null => {
  // Os rótulos da planilha vêm como "jun./26", "jul/2026", "ago 26" — o ponto conta como separador.
  const m = rotulo.toLowerCase().match(/(jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)\w*[.\s/-]*(\d{2,4})/);
  if (!m) return null;
  const meses = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  const mi = meses.indexOf(m[1]) + 1;
  const ano = Number(m[2]) < 100 ? 2000 + Number(m[2]) : Number(m[2]);
  return `${ano}-${String(mi).padStart(2, "0")}`;
};

export const conferir = (snap: SnapshotPlanilha, linhas: LinhaAlvo[]): Conferencia => {
  const porMes = snap.totais.porMes.map((t) => {
    const chave = mesKey(t.mes);
    const doMes = chave ? linhas.filter((l) => l.uid.startsWith("planilha:lanc:") && l.date.startsWith(chave)) : [];
    const entradasApp = doMes.filter((l) => l.type === "income").reduce((a, l) => a + l.amount, 0);
    const saidasApp = doMes.filter((l) => l.type === "expense").reduce((a, l) => a + l.amount, 0);
    const bate = Math.abs(entradasApp - t.entradas) < 1 && Math.abs(saidasApp - t.saidas) < 1;
    return { mes: t.mes, entradasPlanilha: t.entradas, entradasApp, saidasPlanilha: t.saidas, saidasApp, bate };
  });
  return { porMes, bate: porMes.every((m) => m.bate) };
};
