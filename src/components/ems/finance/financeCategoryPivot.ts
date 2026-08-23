// Pivô categoria × mês — a tabela central da Visão Geral da planilha, que o app não tinha.
// Puro e testável: entra o universo canônico (PeriodRow), sai a matriz pronta para tabela,
// barras e linha de tendência.

import { canonicalCategory, categoryDef } from "./financeCategories";
import type { PeriodRow } from "./financePeriodSource";

export interface LinhaPivot {
  categoria: string;
  porMes: number[]; // um valor por mês, na ordem de `meses`
  total: number;
  media: number;
  /**
   * Variação do último mês contra a média dos meses anteriores COM movimento.
   * null quando não há base de comparação (categoria que estreou no último mês).
   * Quando o último mês está em curso, o valor dele é projetado para o mês inteiro antes de
   * comparar — senão todo dia 5 do mês toda categoria apareceria despencando 80%.
   */
  tendencia: number | null;
  /** Média dos meses anteriores usada como base da tendência — para a tabela poder explicá-la. */
  baseTendencia: number | null;
}

export interface Pivot {
  meses: string[]; // "2026-06", "2026-07", …
  rotulos: string[]; // "jun/26", "jul/26", …
  linhas: LinhaPivot[];
  totalPorMes: number[];
  total: number;
  /** O último mês da janela é o mês em curso (dados incompletos). */
  parcialNoFim: boolean;
  /** Fração do último mês já decorrida (1 quando o mês está fechado). */
  fracaoDoUltimoMes: number;
}

const MES_CURTO = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const ehBissexto = (a: number) => (a % 4 === 0 && a % 100 !== 0) || a % 400 === 0;
const diasNoMes = (ano: number, mes: number) => [31, ehBissexto(ano) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][mes - 1];
const cent = (n: number) => Math.round(n * 100) / 100;

/** Hoje em ISO no fuso LOCAL — `toISOString()` é UTC e vira o mês errado perto da meia-noite. */
export const hojeLocalIso = (d: Date = new Date()): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** "2026-06" → "jun/26". Sem date-fns: a chave já é uma string ISO de mês. */
export const rotuloMes = (chave: string): string => {
  const mes = Number(chave.slice(5, 7));
  if (!mes || mes < 1 || mes > 12) return chave;
  return `${MES_CURTO[mes - 1]}/${chave.slice(2, 4)}`;
};

/** Os N meses terminando em `ate` (inclusive), do mais antigo para o mais recente. */
export const janelaDeMeses = (ate: string, n: number): string[] => {
  const ano = Number(ate.slice(0, 4));
  const mes = Number(ate.slice(5, 7));
  const out: string[] = [];
  for (let i = n - 1; i >= 0; i -= 1) {
    const t = ano * 12 + (mes - 1) - i;
    out.push(`${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, "0")}`);
  }
  return out;
};

export interface OpcoesPivot {
  /** Mês final da janela, "AAAA-MM". Default: o mês mais recente que aparece nas linhas. */
  ate?: string;
  meses?: number; // quantos meses a janela cobre (default 3, como na planilha)
  tipo?: "expense" | "income";
  /** Só o que já aconteceu (default). Com false, entra o previsto também. */
  somenteRealizado?: boolean;
  /** Transferência (pró-labore, aporte na reserva, âncora de saldo) não é gasto nem receita. */
  incluirTransferencias?: boolean;
  hoje?: string; // injetável para teste
}

const ehTransferencia = (categoria: string | null) => categoryDef(categoria)?.type === "transfer";

/**
 * Matriz categoria × mês. Ordena por total decrescente — o que mais pesa aparece primeiro,
 * que é a leitura que a planilha faz.
 */
export const buildCategoryMonthPivot = (rows: PeriodRow[], opcoes: OpcoesPivot = {}): Pivot => {
  const { meses: qtd = 3, tipo = "expense", somenteRealizado = true, incluirTransferencias = false } = opcoes;
  const hoje = opcoes.hoje || hojeLocalIso();

  const doTipo = rows.filter((r) =>
    r.type === tipo
    && (!somenteRealizado || r.realized)
    && (incluirTransferencias || !ehTransferencia(r.category)));

  const maisRecente = doTipo.reduce((max, r) => (r.date.slice(0, 7) > max ? r.date.slice(0, 7) : max), "0000-00");
  const ate = opcoes.ate || (maisRecente === "0000-00" ? hoje.slice(0, 7) : maisRecente);
  const meses = janelaDeMeses(ate, qtd);
  const indice = new Map(meses.map((m, i) => [m, i]));

  const ultimo = meses[meses.length - 1];
  const parcialNoFim = ultimo === hoje.slice(0, 7);
  const fracaoDoUltimoMes = parcialNoFim
    ? Number(hoje.slice(8, 10)) / diasNoMes(Number(ultimo.slice(0, 4)), Number(ultimo.slice(5, 7)))
    : 1;

  const porCategoria = new Map<string, number[]>();
  for (const r of doTipo) {
    const i = indice.get(r.date.slice(0, 7));
    if (i === undefined) continue;
    const nome = canonicalCategory(r.category) || "Sem categoria";
    let linha = porCategoria.get(nome);
    if (!linha) { linha = new Array(meses.length).fill(0); porCategoria.set(nome, linha); }
    linha[i] += r.amount;
  }

  const linhas: LinhaPivot[] = [...porCategoria.entries()].map(([categoria, porMes]) => {
    const total = porMes.reduce((a, v) => a + v, 0);
    const anteriores = porMes.slice(0, -1);
    // Só compara contra meses que existem de fato: uma categoria que só apareceu no último mês
    // não tem "tendência", tem estreia. Reportar +100% ali seria ruído.
    const comMovimento = anteriores.filter((v) => v !== 0);
    const base = comMovimento.length ? comMovimento.reduce((a, v) => a + v, 0) / comMovimento.length : 0;
    // Mês em curso projetado para o mês cheio: comparar meio mês com meses inteiros só produziria
    // quedas fantasma.
    const ultimoComparavel = porMes[porMes.length - 1] / (fracaoDoUltimoMes || 1);
    return {
      categoria,
      porMes: porMes.map(cent),
      total: cent(total),
      media: cent(total / meses.length),
      tendencia: base ? Math.round(((ultimoComparavel - base) / base) * 1000) / 10 : null,
      baseTendencia: base ? cent(base) : null,
    };
  });

  linhas.sort((a, b) => b.total - a.total || a.categoria.localeCompare(b.categoria, "pt-BR"));

  // Somado dos valores CRUS por mês (não dos já arredondados), para o rodapé fechar com as linhas.
  const totalPorMes = meses.map((_, i) => cent([...porCategoria.values()].reduce((a, l) => a + l[i], 0)));
  return {
    meses,
    rotulos: meses.map(rotuloMes),
    linhas,
    totalPorMes,
    total: cent(totalPorMes.reduce((a, v) => a + v, 0)),
    parcialNoFim,
    fracaoDoUltimoMes,
  };
};

/** Chave segura para o Recharts: `dataKey` string é lida como caminho (a.b), então "Cia. Aérea"
 *  viraria `obj["Cia"]["Aérea"]` e a série sumiria sem erro. */
export const chaveDaCategoria = (i: number) => `c${i}`;

/** Série pronta para o Recharts: um objeto por mês, com uma chave por categoria. */
export const pivotParaSerie = (pivot: Pivot, quantasCategorias = 6): Record<string, string | number>[] => {
  const top = pivot.linhas.slice(0, quantasCategorias);
  return pivot.meses.map((_, i) => {
    const ponto: Record<string, string | number> = { mes: pivot.rotulos[i] };
    top.forEach((l, j) => { ponto[chaveDaCategoria(j)] = l.porMes[i]; });
    return ponto;
  });
};
