// DRE (Demonstração do Resultado) + EBITDA. Puro/testável. Opera sobre o universo canônico
// PeriodRow[] (realizado × previsto via `paid`). Classifica cada categoria numa linha da DRE
// por heurística, com override do usuário vencendo. Simples Nacional: IR embutido (sem IRPJ à parte).
import type { PeriodRow } from "./useFinanceData";

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

/** Categoria → linha da DRE. Override do usuário vence; senão heurística; senão despesa operacional. */
export const mapCategoryToDreLine = (category: string | null, overrides: Record<string, DreLine> = {}): DreLine => {
  const c = (category || "").trim();
  if (c && overrides[c]) return overrides[c];
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
  porCategoria: { category: string; line: DreLine; value: number }[];
}

export interface DreOptions {
  taxRate?: number; // % — estima dedução quando não há linha de imposto
  overrides?: Record<string, DreLine>;
  dAndAManual?: number;
  basis?: "caixa" | "competencia"; // caixa = só pago; competência = tudo no período
}

export const computeDre = (rows: PeriodRow[], from: string, to: string, opts: DreOptions = {}): DreResult => {
  const basis = opts.basis ?? "caixa";
  const overrides = opts.overrides ?? {};
  const inP = (r: PeriodRow) => r.date >= from && r.date <= to && (basis === "competencia" || r.paid);

  const receitaBruta = rows.reduce((a, r) => (r.type === "income" && inP(r) ? a + r.amount : a), 0);

  const byLine: Record<DreLine, number> = { receita: 0, deducao: 0, custo: 0, despesa_operacional: 0, resultado_financeiro: 0, depreciacao: 0 };
  const catMap = new Map<string, { line: DreLine; value: number }>();
  for (const r of rows) {
    if (r.type !== "expense" || !inP(r)) continue;
    const line = mapCategoryToDreLine(r.category, overrides);
    byLine[line] += r.amount;
    const key = r.category || "Sem categoria";
    const e = catMap.get(key) || { line, value: 0 };
    e.value += r.amount;
    catMap.set(key, e);
  }

  const rate = (opts.taxRate ?? 0) / 100;
  const deducoesEstimada = byLine.deducao <= 0 && rate > 0 && receitaBruta > 0;
  const deducoes = deducoesEstimada ? receitaBruta * rate : byLine.deducao;

  const receitaLiquida = receitaBruta - deducoes;
  const custo = byLine.custo;
  const lucroBruto = receitaLiquida - custo;
  const despesaOperacional = byLine.despesa_operacional;
  const ebitda = lucroBruto - despesaOperacional;
  const depreciacaoAmortizacao = byLine.depreciacao + (opts.dAndAManual ?? 0);
  const ebit = ebitda - depreciacaoAmortizacao;
  const resultadoFinanceiro = -byLine.resultado_financeiro;
  const lucroLiquido = ebit + resultadoFinanceiro;
  const m = (x: number) => (receitaLiquida > 0 ? x / receitaLiquida : 0);

  return {
    receitaBruta, deducoes, deducoesEstimada, receitaLiquida, custo,
    lucroBruto, margemBruta: m(lucroBruto), despesaOperacional,
    ebitda, margemEbitda: m(ebitda), depreciacaoAmortizacao, ebit,
    resultadoFinanceiro, lucroLiquido, margemLiquida: m(lucroLiquido),
    porCategoria: [...catMap.entries()].map(([category, v]) => ({ category, line: v.line, value: v.value })).sort((a, b) => b.value - a.value),
  };
};
