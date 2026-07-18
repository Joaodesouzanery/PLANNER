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
  // Planejado (compras futuras/previstos do mês) — aditivo; 0 quando não informado.
  planejado: number;
  comprometido: number; // realizado + planejado
  comprometidoPct: number;
}

/** Combina tetos com realizado (e, opcional, planejado) por categoria. */
export const buildBudgetLines = (
  tetos: CategoryBudget[],
  realizadoPorCat: Record<string, number>,
  planejadoPorCat: Record<string, number> = {},
): BudgetLine[] => {
  const cats = new Set<string>([...tetos.map((t) => t.category), ...Object.keys(realizadoPorCat), ...Object.keys(planejadoPorCat)]);
  return [...cats]
    .map((category) => {
      const teto = tetos.find((t) => t.category === category)?.teto ?? 0;
      const realizado = realizadoPorCat[category] ?? 0;
      const planejado = planejadoPorCat[category] ?? 0;
      const comprometido = realizado + planejado;
      return {
        category,
        teto,
        realizado,
        usoPct: teto > 0 ? realizado / teto : 0,
        saldo: teto - realizado,
        estourou: teto > 0 && realizado > teto,
        orcada: teto > 0,
        planejado,
        comprometido,
        comprometidoPct: teto > 0 ? comprometido / teto : 0,
      };
    })
    .sort((a, b) => b.comprometido - a.comprometido);
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
