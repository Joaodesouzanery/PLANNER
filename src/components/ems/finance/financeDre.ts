// DRE (Demonstração do Resultado) + EBITDA. Puro/testável. Opera sobre o universo canônico
// PeriodRow[] (realizado × previsto via `paid`). Classifica cada categoria numa linha da DRE
// por heurística, com override do usuário vencendo. Simples Nacional: IR embutido (sem IRPJ à parte).
import type { PeriodRow } from "./useFinanceData";
import { catalogDreLine, canonicalCategory } from "./financeCategories";

export type DreLine = "receita" | "deducao" | "custo" | "despesa_operacional" | "resultado_financeiro" | "depreciacao";

export const DRE_LINE_LABEL: Record<DreLine, string> = {
  receita: "Receita",
  deducao: "Impostos / deduções",
  custo: "Custo (CMV/CPV)",
  despesa_operacional: "Despesa operacional",
  resultado_financeiro: "Resultado financeiro",
  depreciacao: "Depreciação / amortização",
};

// Ordem importa: a primeira regex que casar vence (imposto antes de financeiro etc.).
const HEUR: { line: DreLine; re: RegExp }[] = [
  { line: "deducao", re: /imposto|tribut|\bdas\b|simples|\biss\b|icms|\bpis\b|cofins|inss/i },
  { line: "resultado_financeiro", re: /juros|\biof\b|tarifa|banc[aá]ri|\bmulta|encargo|financeir/i },
  { line: "depreciacao", re: /deprecia|amortiz/i },
  { line: "custo", re: /custo|\bcmv\b|\bcpv\b|insumo|mercadoria|fornecedor|mat[eé]ria.?prima|frete|logistic/i },
];

/** Categoria → linha da DRE. Override do usuário vence; senão heurística; senão despesa operacional.
 *  A chave do override normaliza categoria vazia/nula para "Sem categoria" (bate com computeDre). */
export const mapCategoryToDreLine = (category: string | null, overrides: Record<string, DreLine> = {}): DreLine => {
  const c = (category || "").trim();
  const key = c || "Sem categoria";
  if (overrides[key]) return overrides[key]; // override explícito do usuário vence
  const fromCatalog = catalogDreLine(category); // categoria fixa do catálogo (Infra→custo, Equipamento→depreciação…)
  if (fromCatalog) return fromCatalog;
  const hay = c.toLowerCase();
  for (const h of HEUR) if (h.re.test(hay)) return h.line;
  return "despesa_operacional";
};

export interface DreResult {
  receitaBruta: number;
  deducoes: number;
  deducoesEstimada: boolean; // true = estimada por taxRate (sem linhas de imposto)
  receitaLiquida: number;
  custo: number;
  lucroBruto: number;
  margemBruta: number; // 0..1 sobre receita líquida
  despesaOperacional: number;
  ebitda: number;
  margemEbitda: number;
  depreciacaoAmortizacao: number;
  ebit: number;
  resultadoFinanceiro: number; // negativo = despesa financeira
  lucroLiquido: number;
  margemLiquida: number;
  prolabore: number; // retirada do dono (PJ→PF) no período
  lucroEmpresa: number; // = lucroLiquido − prolabore (o que sobra NA empresa)
  porCategoria: { category: string; line: DreLine; value: number }[];
}

export interface DreOptions {
  taxRate?: number; // % — estima dedução quando não há linha de imposto
  overrides?: Record<string, DreLine>;
  dAndAManual?: number;
  basis?: "caixa" | "competencia"; // caixa = só pago; competência = tudo no período
  prolabore?: number; // pró-labore do MÊS (config); a linha da DRE usa o proporcional ao período
  prolaboreTotal?: number; // pró-labore JÁ SOMADO no período (camada datada); se presente, ignora prolabore×periodMonths
  periodMonths?: number; // nº de meses do período (p/ escalar o pró-labore mensal); default 1
}

export const computeDre = (rows: PeriodRow[], from: string, to: string, opts: DreOptions = {}): DreResult => {
  const basis = opts.basis ?? "caixa";
  const overrides = opts.overrides ?? {};
  const inP = (r: PeriodRow) => r.date >= from && r.date <= to && (basis === "competencia" || r.paid);

  const byLine: Record<DreLine, number> = { receita: 0, deducao: 0, custo: 0, despesa_operacional: 0, resultado_financeiro: 0, depreciacao: 0 };
  const catMap = new Map<string, { line: DreLine; value: number }>();
  let receitaBruta = 0;
  for (const r of rows) {
    if (!inP(r)) continue;
    if (r.type === "income") {
      // Receita financeira (rendimentos/juros recebidos) NÃO infla a receita bruta nem a base do imposto:
      // entra líquida no resultado financeiro (que assim pode ser positivo).
      if (mapCategoryToDreLine(r.category, overrides) === "resultado_financeiro") byLine.resultado_financeiro -= r.amount;
      else receitaBruta += r.amount;
      continue;
    }
    // Pró-labore é tratado só pela linha de settings (opts.prolabore) — nunca conta como despesa (evita dobra).
    if (canonicalCategory(r.category) === "Pró-labore") continue;
    const line = mapCategoryToDreLine(r.category, overrides);
    byLine[line] += r.amount;
    const key = r.category || "Sem categoria";
    const e = catMap.get(key) || { line, value: 0 };
    e.value += r.amount;
    catMap.set(key, e);
  }

  const rate = (opts.taxRate ?? 0) / 100;
  // Dedução = piso do imposto: pelo menos a estimativa (receita×alíquota), mesmo que só parte tenha sido lançada.
  const estimativaImposto = rate > 0 && receitaBruta > 0 ? receitaBruta * rate : 0;
  const deducoes = Math.max(byLine.deducao, estimativaImposto);
  const deducoesEstimada = deducoes > byLine.deducao; // topou/estimou acima do que foi de fato lançado

  const receitaLiquida = receitaBruta - deducoes;
  const custo = byLine.custo;
  const lucroBruto = receitaLiquida - custo;
  const despesaOperacional = byLine.despesa_operacional;
  const ebitda = lucroBruto - despesaOperacional;
  const depreciacaoAmortizacao = byLine.depreciacao + (opts.dAndAManual ?? 0) * Math.max(1, opts.periodMonths ?? 1);
  const ebit = ebitda - depreciacaoAmortizacao;
  const resultadoFinanceiro = -byLine.resultado_financeiro;
  const lucroLiquido = ebit + resultadoFinanceiro;
  // Camada datada: se veio o total já somado no período, usa; senão escala o mensal pelo nº de meses.
  const prolabore = opts.prolaboreTotal != null
    ? Math.max(0, opts.prolaboreTotal)
    : Math.max(0, opts.prolabore ?? 0) * Math.max(1, opts.periodMonths ?? 1);
  const lucroEmpresa = lucroLiquido - prolabore;
  const m = (x: number) => (receitaLiquida > 0 ? x / receitaLiquida : 0);

  return {
    receitaBruta, deducoes, deducoesEstimada, receitaLiquida, custo,
    lucroBruto, margemBruta: m(lucroBruto), despesaOperacional,
    ebitda, margemEbitda: m(ebitda), depreciacaoAmortizacao, ebit,
    resultadoFinanceiro, lucroLiquido, margemLiquida: m(lucroLiquido),
    prolabore, lucroEmpresa,
    porCategoria: [...catMap.entries()].map(([category, v]) => ({ category, line: v.line, value: v.value })).sort((a, b) => b.value - a.value),
  };
};
