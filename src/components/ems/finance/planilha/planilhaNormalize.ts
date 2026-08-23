// Planilha → lançamentos do app. Puro e testável (sem React, sem Supabase, sem lib de xlsx).
// Recebe a grade crua de cada aba e devolve linhas já normalizadas + a Config + os totais que a
// própria planilha declara (usados depois para conferir se a importação bateu).
//
// Regras de correção aplicadas aqui (a planilha é a fonte, mas alguns campos vêm inconsistentes
// e quebrariam MRR/DRE se entrassem crus). Cada uma está comentada no ponto onde acontece.

import { canonicalCategory, categoryDef } from "../financeCategories";

export type Celula = string | number | boolean | Date | null | undefined;
export type Grade = Celula[][];

export type TipoLinha = "income" | "expense";
export type SituacaoLinha = "reconciled" | "confirmed" | "planned";

export interface LancamentoPlanilha {
  uid: string;
  data: string; // ISO
  descricao: string;
  categoria: string | null;
  categoriaOriginal: string | null;
  tipo: TipoLinha;
  situacao: SituacaoLinha;
  valor: number;
  linha: number; // nº da linha na planilha (mensagens de erro)
}

export interface RecorrentePlanilha {
  uid: string;
  descricao: string;
  tipo: TipoLinha;
  valor: number;
  dia: number;
  fim: string | null; // ISO — vazio = sem fim
  parcelaAtual: number | null;
  totalParcelas: number | null;
  sandbox: boolean; // linha de simulação: não entra na sobra
  linha: number;
}

export interface ConfigPlanilha {
  saldoHoje: number | null;
  dataBase: string | null;
  tetos: { categoria: string; teto: number }[];
  variavelTotal: number | null;
  reservaSeparada: number | null;
  provisionado: number | null;
  recorrentes: RecorrentePlanilha[];
}

export interface TotaisDeclarados {
  porMes: { mes: string; entradas: number; saidas: number }[];
  saldoHoje: number | null;
}

export interface SnapshotPlanilha {
  lancamentos: LancamentoPlanilha[];
  config: ConfigPlanilha;
  totais: TotaisDeclarados;
  avisos: string[];
}

// ───────────────────────── parsers de célula ─────────────────────────

const texto = (c: Celula): string => (c == null ? "" : String(c).trim());

/** Valor pt-BR: "R$ 1.234,56" · "1.234,56" · "1234.56" · 1234.56 → number. */
export const parseValor = (c: Celula): number | null => {
  if (typeof c === "number") return Number.isFinite(c) ? c : null;
  const s = texto(c);
  if (!s) return null;
  const limpo = s.replace(/R\$/gi, "").replace(/\s/g, "").replace(/\((.*)\)/, "-$1"); // (1.234) = negativo
  // pt-BR: ponto é milhar, vírgula é decimal. Sem vírgula, ponto pode ser decimal (1234.56).
  const norm = limpo.includes(",") ? limpo.replace(/\./g, "").replace(",", ".") : limpo;
  const n = Number(norm);
  return Number.isFinite(n) ? n : null;
};

const ehBissexto = (a: number) => (a % 4 === 0 && a % 100 !== 0) || a % 400 === 0;
const diasNoMes = (ano: number, mes: number) => [31, ehBissexto(ano) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][mes - 1];
const iso = (ano: number, mes: number, dia: number) =>
  `${ano}-${String(mes).padStart(2, "0")}-${String(Math.min(dia, diasNoMes(ano, mes))).padStart(2, "0")}`;

/** Data: "04/06/26" · "04/06/2026" · "2026-06-04" · Date · serial do Excel → ISO. */
export const parseData = (c: Celula): string | null => {
  if (c instanceof Date && !Number.isNaN(c.getTime())) return iso(c.getFullYear(), c.getMonth() + 1, c.getDate());
  if (typeof c === "number" && Number.isFinite(c) && c > 0) {
    // serial do Excel (dias desde 1899-12-30, base do 1900 com o bug do ano bissexto)
    const ms = Math.round((c - 25569) * 86400000);
    const d = new Date(ms);
    return Number.isNaN(d.getTime()) ? null : iso(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
  }
  const s = texto(c);
  if (!s) return null;
  const isoDireto = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoDireto) return iso(Number(isoDireto[1]), Number(isoDireto[2]), Number(isoDireto[3]));
  const br = s.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})/);
  if (!br) return null;
  const dia = Number(br[1]);
  const mes = Number(br[2]);
  let ano = Number(br[3]);
  if (ano < 100) ano += 2000; // "26" → 2026
  if (mes < 1 || mes > 12 || dia < 1 || dia > 31) return null;
  return iso(ano, mes, dia);
};

/** "Entrada"/"Receita"/"Crédito" → income; "Saída"/"Despesa"/"Débito" → expense. */
export const parseTipo = (c: Celula): TipoLinha | null => {
  const s = texto(c).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  if (!s) return null;
  if (/^(entrada|receita|credito|income|recebimento)/.test(s)) return "income";
  if (/^(saida|despesa|debito|expense|pagamento)/.test(s)) return "expense";
  return null;
};

/**
 * Situação da planilha → status do app.
 * Pago/Recebido = dinheiro moveu (reconciled). Atrasado = lançado e vencido, não pago (confirmed).
 * Vazio/Previsto = ainda não aconteceu (planned). "Atrasado" NÃO é gravado como estado: o app
 * deriva atraso de (não pago + vencido), então basta não marcar como pago.
 */
export const parseSituacao = (c: Celula, data: string, hoje: string): SituacaoLinha => {
  const s = texto(c).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  if (/pago|recebido|conciliado|quitado/.test(s)) return "reconciled";
  if (/atrasad|vencid|pendente|aberto/.test(s)) return "confirmed";
  if (/previst|agendad|futur/.test(s)) return "planned";
  return data <= hoje ? "confirmed" : "planned"; // sem situação: passado = lançado, futuro = previsto
};

const slug = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);

const semAcento = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();

// ───────────────────────── categoria ─────────────────────────

const ehCategoriaDeReceita = (nome: string | null) => !!nome && categoryDef(nome)?.type === "income";
const ehDoCatalogo = (nome: string | null) => !!nome && !!categoryDef(nome);

/** Guarda-chuva da planilha: agrupa coisas muito diferentes (Macbook, Supabase, DAS, contador…). */
const GUARDA_CHUVA = /^operacional/i;

/**
 * Imposto. Mesma régua da DRE: palavras por extenso em qualquer caixa, siglas só em MAIÚSCULA —
 * senão o "das" de "Gasolina das férias" viraria imposto.
 */
const ehImposto = (s: string) => /imposto|tribut|simples nacional/i.test(s) || /\b(DAS|ISS|ICMS|PIS|COFINS|INSS)\b/.test(s);

/**
 * Categoria a partir da DESCRIÇÃO. Os aliases do catálogo casam a string inteira ("gasolina"),
 * então "Gasolina Cascol" não resolvia — aqui tenta a frase toda, depois pares de palavras
 * ("cerrado mma", "simples nacional") e por fim palavra a palavra.
 */
export const categoriaPelaDescricao = (descricao: string): string | null => {
  const inteira = canonicalCategory(descricao);
  if (ehDoCatalogo(inteira)) return inteira;
  const palavras = semAcento(descricao).split(/[^a-z0-9]+/).filter(Boolean);
  for (let i = 0; i < palavras.length - 1; i += 1) {
    const c = canonicalCategory(`${palavras[i]} ${palavras[i + 1]}`);
    if (ehDoCatalogo(c)) return c;
  }
  for (const p of palavras) {
    const c = canonicalCategory(p);
    if (ehDoCatalogo(c)) return c;
  }
  return null;
};

/**
 * Categoria final da linha. Quatro correções que evitam quebrar MRR/DRE/receita por cliente:
 *  1. ENTRADA nunca fica com categoria de despesa — na planilha há recebimentos marcados como
 *     "Operacional (PJ)" e um como "(sem categoria)"; assim eles somem do MRR e da receita.
 *  2. Imposto vai para "Impostos" (linha de DEDUÇÃO), venha a pista da categoria ou da descrição.
 *  3. Guarda-chuva "Operacional (PJ)" numa SAÍDA é desmembrado pela descrição (macbook→Equipamento,
 *     supabase→Infra/COGS, claude→Ferramentas, contador→Contador/Fiscal…), senão a DRE joga tudo
 *     em despesa operacional.
 *  4. Categoria vazia cai na descrição antes de virar "Outros".
 */
export const normalizarCategoria = (
  categoriaBruta: Celula,
  descricao: string,
  tipo: TipoLinha,
): string | null => {
  const bruta = texto(categoriaBruta).replace(/^\(sem categoria\)$/i, "");
  const canon = bruta ? canonicalCategory(bruta) : null;

  if (tipo === "income") return ehCategoriaDeReceita(canon) ? canon : "Receita — Cliente"; // (1)
  if (ehImposto(bruta) || ehImposto(descricao)) return "Impostos"; // (2)
  if (canon && GUARDA_CHUVA.test(canon) && !ehDoCatalogo(canon)) return categoriaPelaDescricao(descricao) || canon; // (3)
  if (canon) return canon;
  return categoriaPelaDescricao(descricao) || "Outros"; // (4)
};

// ───────────────────────── leitura das grades ─────────────────────────


/** Acha o índice da coluna cujo cabeçalho casa com um dos rótulos. */
const acharColuna = (cabecalho: Celula[], rotulos: string[]): number =>
  cabecalho.findIndex((c) => {
    const h = semAcento(texto(c));
    return !!h && rotulos.some((r) => h === r || h.startsWith(r));
  });

/** Acha a linha de cabeçalho: a primeira que tem "data" (ou "descricao") + "valor". */
export const acharCabecalho = (grade: Grade, obrigatorias: string[][]): number => {
  for (let i = 0; i < Math.min(grade.length, 40); i += 1) {
    const linha = grade[i] || [];
    if (obrigatorias.every((rotulos) => acharColuna(linha, rotulos) >= 0)) return i;
  }
  return -1;
};

const COL = {
  data: ["data", "dia do lancamento"],
  descricao: ["descricao", "historico", "lancamento"],
  categoria: ["categoria"],
  tipo: ["tipo"],
  situacao: ["situacao", "status"],
  valor: ["valor", "amount"],
  dia: ["dia"],
  fim: ["fim"],
  parcelaAtual: ["parcela atual"],
  totalParcelas: ["total parcelas", "total de parcelas"],
};

/** Aba "Lançamentos" → linhas reais. */
export const lerLancamentos = (grade: Grade, hoje: string): { linhas: LancamentoPlanilha[]; avisos: string[] } => {
  const avisos: string[] = [];
  const h = acharCabecalho(grade, [COL.data, COL.valor]);
  if (h < 0) return { linhas: [], avisos: ["Não achei o cabeçalho da aba Lançamentos (preciso de Data e Valor)."] };

  const cab = grade[h];
  const iData = acharColuna(cab, COL.data);
  const iDesc = acharColuna(cab, COL.descricao);
  const iCat = acharColuna(cab, COL.categoria);
  const iTipo = acharColuna(cab, COL.tipo);
  const iSit = acharColuna(cab, COL.situacao);
  const iValor = acharColuna(cab, COL.valor);

  const linhas: LancamentoPlanilha[] = [];
  const ocorrencias = new Map<string, number>(); // desambigua repetições legítimas (4× "Zigpay" no mesmo dia)

  for (let i = h + 1; i < grade.length; i += 1) {
    const l = grade[i] || [];
    const data = parseData(l[iData]);
    const valor = parseValor(l[iValor]);
    const descricao = iDesc >= 0 ? texto(l[iDesc]) : "";
    if (!data || valor == null || !descricao) continue; // linha vazia/subtotal
    if (valor === 0) continue;

    const tipo = (iTipo >= 0 ? parseTipo(l[iTipo]) : null) ?? (valor < 0 ? "expense" : "income");
    const categoriaOriginal = iCat >= 0 ? texto(l[iCat]) || null : null;
    const chave = `${data}|${slug(descricao)}|${tipo}`;
    const n = (ocorrencias.get(chave) ?? 0) + 1;
    ocorrencias.set(chave, n);

    linhas.push({
      uid: `planilha:lanc:${data}:${slug(descricao)}:${tipo}:${n}`,
      data,
      descricao,
      categoria: normalizarCategoria(categoriaOriginal, descricao, tipo),
      categoriaOriginal,
      tipo,
      situacao: iSit >= 0 ? parseSituacao(l[iSit], data, hoje) : parseSituacao(null, data, hoje),
      valor: Math.abs(valor),
      linha: i + 1,
    });
  }
  if (!linhas.length) avisos.push("A aba Lançamentos não tinha nenhuma linha legível.");
  return { linhas, avisos };
};

/** Fim da recorrência a partir de "parcela atual/total" + dia, contado da data-base. */
export const fimPorParcelas = (dataBase: string, dia: number, parcelaAtual: number, totalParcelas: number): string | null => {
  if (!totalParcelas || !parcelaAtual || totalParcelas < parcelaAtual) return null;
  const [ano, mes] = dataBase.split("-").map(Number);
  const restantes = totalParcelas - parcelaAtual; // a atual é a deste mês
  const total = ano * 12 + (mes - 1) + restantes;
  return iso(Math.floor(total / 12), (total % 12) + 1, dia);
};

/** Aba "Config" → recorrentes + âncoras (saldo, data-base, tetos, reserva). */
export const lerConfig = (grade: Grade, hoje: string): { config: ConfigPlanilha; avisos: string[] } => {
  const avisos: string[] = [];
  const config: ConfigPlanilha = {
    saldoHoje: null, dataBase: null, tetos: [],
    variavelTotal: null, reservaSeparada: null, provisionado: null, recorrentes: [],
  };

  // Blocos "rótulo → valor" espalhados na aba: varre tudo procurando o par (texto, número).
  const acharValorPorRotulo = (regex: RegExp): { valor: number | null; linha: number } => {
    for (let i = 0; i < grade.length; i += 1) {
      const l = grade[i] || [];
      for (let j = 0; j < l.length; j += 1) {
        if (regex.test(semAcento(texto(l[j])))) {
          for (let k = j + 1; k < l.length; k += 1) {
            const v = parseValor(l[k]);
            if (v != null) return { valor: v, linha: i };
          }
        }
      }
    }
    return { valor: null, linha: -1 };
  };
  const acharDataPorRotulo = (regex: RegExp): string | null => {
    for (const l of grade) {
      for (let j = 0; j < (l || []).length; j += 1) {
        if (regex.test(semAcento(texto(l[j])))) {
          for (let k = j + 1; k < l.length; k += 1) {
            const d = parseData(l[k]);
            if (d) return d;
          }
        }
      }
    }
    return null;
  };

  config.saldoHoje = acharValorPorRotulo(/^saldo em caixa hoje/).valor;
  config.dataBase = acharDataPorRotulo(/^data-?base/) || hoje;
  config.variavelTotal = acharValorPorRotulo(/^variavel total/).valor;
  config.reservaSeparada = acharValorPorRotulo(/reserva ja separada/).valor;
  config.provisionado = acharValorPorRotulo(/provisionado/).valor;

  // Tetos do bloco "GASTO VARIÁVEL — orçado por categoria": pares (rótulo, valor) entre o título
  // do bloco e a linha de total.
  const iBloco = grade.findIndex((l) => (l || []).some((c) => /^gasto variavel/.test(semAcento(texto(c)))));
  if (iBloco >= 0) {
    for (let i = iBloco + 1; i < grade.length; i += 1) {
      const l = grade[i] || [];
      const rotulo = texto(l[0]);
      if (!rotulo) continue;
      if (/^variavel total|^entradas\/mes|^saidas fixas/.test(semAcento(rotulo))) break;
      const valor = parseValor(l.slice(1).find((c) => parseValor(c) != null));
      if (valor == null) continue;
      // "Transporte (gasolina, uber)" → "Transporte"; "Provisão anual ÷ 12 (…)" → "Provisão anual".
      const limpo = rotulo.replace(/\s*\(.*\)\s*$/, "").split("÷")[0].trim();
      const direto = canonicalCategory(limpo);
      // "Mercado / casa" não casa por alias exato — resolve por palavra ("mercado" → Alimentação).
      const categoria = ehDoCatalogo(direto) ? direto : categoriaPelaDescricao(limpo) || direto;
      if (categoria) config.tetos.push({ categoria, teto: valor });
    }
  }

  // Tabela de recorrentes.
  const h = acharCabecalho(grade, [COL.descricao, COL.valor, COL.dia]);
  if (h < 0) {
    avisos.push("Não achei a tabela de recorrentes na aba Config (preciso de Descrição, Valor e Dia).");
    return { config, avisos };
  }
  const cab = grade[h];
  const iDesc = acharColuna(cab, COL.descricao);
  const iTipo = acharColuna(cab, COL.tipo);
  const iValor = acharColuna(cab, COL.valor);
  const iDia = acharColuna(cab, COL.dia);
  const iFim = acharColuna(cab, COL.fim);
  const iPar = acharColuna(cab, COL.parcelaAtual);
  const iTot = acharColuna(cab, COL.totalParcelas);

  for (let i = h + 1; i < grade.length; i += 1) {
    const l = grade[i] || [];
    const descricao = texto(l[iDesc]);
    const valor = parseValor(l[iValor]);
    const dia = Number(parseValor(l[iDia]));
    if (!descricao || valor == null || !dia) {
      if (descricao && /^gasto variavel|^entradas\/mes/.test(semAcento(descricao))) break;
      continue;
    }
    const tipo = (iTipo >= 0 ? parseTipo(l[iTipo]) : null) ?? "expense";
    const parcelaAtual = iPar >= 0 ? parseValor(l[iPar]) : null;
    const totalParcelas = iTot >= 0 ? parseValor(l[iTot]) : null;
    const fimDireto = iFim >= 0 ? parseData(l[iFim]) : null;

    config.recorrentes.push({
      uid: `planilha:cfg:${slug(descricao)}:${tipo}`,
      descricao,
      tipo,
      valor: Math.abs(valor),
      dia: Math.min(Math.max(Math.round(dia), 1), 31),
      fim: fimDireto || (parcelaAtual && totalParcelas ? fimPorParcelas(config.dataBase || hoje, Math.round(dia), parcelaAtual, totalParcelas) : null),
      parcelaAtual: parcelaAtual ?? null,
      totalParcelas: totalParcelas ?? null,
      // As 3 primeiras LINHAS da tabela (posição física, algumas vazias) são a área
      // SANDBOX/simulação da planilha — não entram no salário estrutural nem na sobra.
      sandbox: i - h <= 3,
      linha: i + 1,
    });
  }

  return { config, avisos };
};

/** Totais que a própria planilha declara — base da conferência pós-importação. */
export const lerTotaisDeclarados = (grade: Grade): TotaisDeclarados => {
  const porMes: TotaisDeclarados["porMes"] = [];
  const h = acharCabecalho(grade, [["mes"], ["entradas"]]);
  if (h >= 0) {
    const cab = grade[h];
    const iMes = acharColuna(cab, ["mes"]);
    const iEnt = acharColuna(cab, ["entradas"]);
    const iSai = acharColuna(cab, ["saidas"]);
    for (let i = h + 1; i < grade.length; i += 1) {
      const l = grade[i] || [];
      const mes = texto(l[iMes]);
      const entradas = parseValor(l[iEnt]);
      const saidas = iSai >= 0 ? parseValor(l[iSai]) : null;
      if (!mes || entradas == null) continue;
      if (!/\d/.test(mes)) continue;
      porMes.push({ mes, entradas, saidas: saidas ?? 0 });
    }
  }
  return { porMes, saldoHoje: null };
};
