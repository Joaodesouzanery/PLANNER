// CFO v2 · Fase 3 — orçado × realizado por categoria. Puro/testável.
export interface CategoryBudget { category: string; teto: number }

export interface BudgetLine {
  category: string;
  teto: number;
  realizado: number;
  usoPct: number; // 0..N (1 = 100%)
  saldo: number; // teto − realizado (negativo = estourou)
  estourou: boolean;
  orcada: boolean;
}

/** Combina tetos (por categoria) com o realizado (por categoria) num quadro por categoria. */
export const buildBudgetLines = (tetos: CategoryBudget[], realizadoPorCat: Record<string, number>): BudgetLine[] => {
  const cats = new Set<string>([...tetos.map((t) => t.category), ...Object.keys(realizadoPorCat)]);
  return [...cats]
    .map((category) => {
      const teto = tetos.find((t) => t.category === category)?.teto ?? 0;
      const realizado = realizadoPorCat[category] ?? 0;
      return {
        category,
        teto,
        realizado,
        usoPct: teto > 0 ? realizado / teto : 0,
        saldo: teto - realizado,
        estourou: teto > 0 && realizado > teto,
        orcada: teto > 0,
      };
    })
    .sort((a, b) => b.realizado - a.realizado);
};

/** Total dos tetos e do realizado (só categorias orçadas, p/ o resumo do card). */
export const budgetTotals = (lines: BudgetLine[]) => {
  const orcadas = lines.filter((l) => l.orcada);
  return {
    tetoTotal: orcadas.reduce((a, l) => a + l.teto, 0),
    realizadoOrcado: orcadas.reduce((a, l) => a + l.realizado, 0),
    estouros: orcadas.filter((l) => l.estourou).length,
  };
};
