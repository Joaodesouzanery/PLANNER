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

export interface SpendSample { category: string; amount: number; month: string } // month = "yyyy-MM"

/**
 * Sugere um teto por categoria a partir da MÉDIA das saídas pagas nos meses informados
 * (ex.: os 3 meses cheios anteriores). Divide pelo nº de meses da janela (meses sem gasto
 * puxam a média p/ baixo), aplica um corte leve `trim` (mira sobrar mais) e arredonda p/ passo
 * de 10. Categorias já vêm canonizadas pelo chamador. Puro/testável.
 */
export const suggestTetos = (samples: SpendSample[], months: string[], trim = 0.05): CategoryBudget[] => {
  const monthSet = new Set(months);
  const byCat = new Map<string, number>();
  for (const s of samples) {
    if (!monthSet.has(s.month)) continue;
    byCat.set(s.category, (byCat.get(s.category) ?? 0) + s.amount);
  }
  const n = Math.max(1, months.length);
  return [...byCat.entries()]
    .map(([category, total]) => ({ category, teto: Math.max(0, Math.round((total / n) * (1 - trim) / 10) * 10) }))
    .filter((t) => t.teto > 0)
    .sort((a, b) => b.teto - a.teto);
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
