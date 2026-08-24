// Leitura do .xlsx → SnapshotPlanilha. A lib entra por `await import()` dinâmico (mesmo padrão
// de src/lib/exportPdf.ts com o jspdf) para não somar ao bundle de quem nunca importa planilha.
//
// A busca de aba é tolerante: a planilha tem "Lançamentos", mas um "Salvar como" pode produzir
// "Lancamentos", "LANÇAMENTOS" ou "Lançamentos (2)". Só o miolo do nome importa.

import {
  lerConfig, lerLancamentos, lerTotaisDeclarados,
  type Grade, type SnapshotPlanilha,
} from "./planilhaNormalize";

export type NomeAba = "lancamentos" | "config" | "visaoGeral";

/** Sinônimos por aba, já sem acento e em minúsculo. */
const ABAS: Record<NomeAba, string[]> = {
  lancamentos: ["lancamentos", "lancamento", "transacoes", "movimentacoes", "extrato"],
  config: ["config", "configuracao", "configuracoes", "parametros"],
  visaoGeral: ["visao geral", "visaogeral", "resumo", "dashboard", "overview"],
};

const semAcento = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim();

/**
 * Índice (0-based) da aba cujo nome casa com um dos sinônimos. Casamento exato primeiro,
 * depois "contém" — assim "Config" ganha de "Configurações antigas" quando as duas existem.
 */
export const acharAba = (nomes: string[], sinonimos: string[]): number => {
  const limpos = nomes.map(semAcento);
  const exato = limpos.findIndex((n) => sinonimos.includes(n));
  if (exato >= 0) return exato;
  return limpos.findIndex((n) => sinonimos.some((s) => n.includes(s)));
};

/** Data de hoje em ISO, no fuso local (não em UTC — senão de madrugada o dia "volta"). */
export const hojeLocal = (d: Date = new Date()): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export class PlanilhaInvalidaError extends Error {}

/**
 * Lê o arquivo e devolve o snapshot. Só a aba Lançamentos é obrigatória — sem Config o app
 * segue funcionando (perde os recorrentes e a âncora de saldo), e isso vira aviso, não erro.
 */
export const lerPlanilha = async (arquivo: File, hoje = hojeLocal()): Promise<SnapshotPlanilha> => {
  const { default: readXlsxFile, readSheetNames } = await import("read-excel-file");

  let nomes: string[];
  try {
    nomes = await readSheetNames(arquivo);
  } catch {
    throw new PlanilhaInvalidaError("Não consegui abrir o arquivo. Envie a planilha em .xlsx (não .csv nem .xls).");
  }

  const grade = async (qual: NomeAba): Promise<Grade | null> => {
    const i = acharAba(nomes, ABAS[qual]);
    if (i < 0) return null;
    // `sheet` é 1-based na lib. Sem schema, devolve a matriz crua.
    // O cast passa por `unknown` porque o `CellValue` da lib declara `typeof Date` (o construtor)
    // onde entrega uma instância de Date — a tipagem deles não bate com o runtime.
    return (await readXlsxFile(arquivo, { sheet: i + 1 })) as unknown as Grade;
  };

  const gLanc = await grade("lancamentos");
  if (!gLanc) {
    throw new PlanilhaInvalidaError(
      `Não achei a aba "Lançamentos" nesta planilha. Abas encontradas: ${nomes.join(", ") || "nenhuma"}.`,
    );
  }

  // DUAS PASSADAS de propósito. A situação de uma linha sem coluna "Situação" é derivada de
  // "a data já passou?", e ancorar isso no RELÓGIO faria o mesmo arquivo mudar de um dia para o
  // outro — o lançamento de 21/08 vira "lançado" no dia 21 e a reimportação acusaria alteração.
  // Passada 1 só descobre a data de referência do arquivo; passada 2 usa ela como corte.
  const previa = lerLancamentos(gLanc, hoje);
  // A maior data JÁ PASSADA do arquivo. A maior data absoluta não serve: uma planilha com
  // previsões até dez/26 marcaria todas elas como já lançadas, porque o corte ficaria depois de
  // tudo. Com o corte no passado, o previsto continua previsto.
  const maiorData = previa.linhas.reduce((m, l) => (l.data <= hoje && l.data > m ? l.data : m), "") || null;

  const gConfig = await grade("config");
  const cfg = gConfig
    ? lerConfig(gConfig, hoje, maiorData)
    : { config: { saldoHoje: null, dataBase: null, tetos: [], variavelTotal: null, reservaSeparada: null, provisionado: null, recorrentes: [] }, avisos: ["Aba Config não encontrada: recorrentes e saldo declarado ficaram de fora."] };

  // A data-base declarada na Config é a melhor referência: é estável e é o que o usuário quis
  // dizer com "a planilha está atualizada até aqui".
  const referencia = cfg.config.dataBase || maiorData || hoje;
  const { linhas, avisos } = referencia === hoje ? previa : lerLancamentos(gLanc, referencia);
  const todosAvisos = [...avisos, ...cfg.avisos];

  const gVisao = await grade("visaoGeral");
  const totais = gVisao ? lerTotaisDeclarados(gVisao) : { porMes: [], saldoHoje: null };
  if (!gVisao) todosAvisos.push("Aba Visão Geral não encontrada: a conferência de totais foi pulada.");

  if (!linhas.length) todosAvisos.push("A aba Lançamentos não tinha nenhuma linha válida.");

  // Abas que existem no arquivo mas que a importação NÃO usa. Simulador e Estratégia são views
  // derivadas (e a planilha tem erros de fórmula neles) — o app recalcula esses números a partir
  // dos Lançamentos e da Config. Dito em voz alta para não parecer que sumiram em silêncio.
  const usadas = [ABAS.lancamentos, ABAS.config, ABAS.visaoGeral].map((sin) => acharAba(nomes, sin));
  const ignoradas = nomes.filter((_, i) => !usadas.includes(i));
  if (ignoradas.length) {
    todosAvisos.push(`Abas não usadas nesta importação: ${ignoradas.join(", ")}. O app recalcula esses números.`);
  }

  return { lancamentos: linhas, config: cfg.config, temConfig: !!gConfig, totais, avisos: todosAvisos };
};
