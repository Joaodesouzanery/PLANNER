// Pure projection logic. Kept free of React/Supabase so it can be unit tested
// with `node --test` and reused by the UI tooltip/modal that explains how each
// projected month was calculated.

export interface ProjectionRecurringTx {
  id: string;
  description?: string | null;
  category?: string | null;
  amount: number | string;
  type: "income" | "expense";
  is_recurring?: boolean | null;
  recurrence_interval?: string | null;
  recurrence_end_date?: string | null;
}

export interface MonthlyHistoryRow {
  month: string;
  income: number;
  expense: number;
  balance: number;
}

export interface RecurringSource {
  id: string;
  description: string;
  category: string | null;
  type: "income" | "expense";
  rawAmount: number;
  interval: string;
  factor: number;
  monthlyEquivalent: number;
  endDate: string | null; // contrato com prazo; null = indefinido
}

export interface ProjectionBreakdown {
  historicalAverageIncome: number;
  historicalAverageExpense: number;
  historicalMonthsConsideredIncome: number;
  historicalMonthsConsideredExpense: number;
  historyWindow: number;
  recurringBaselineIncome: number;
  recurringBaselineExpense: number;
  chosenIncome: number;
  chosenExpense: number;
  incomeSourceUsed: "historical" | "recurring" | "none";
  expenseSourceUsed: "historical" | "recurring" | "none";
  recurringSources: RecurringSource[];
  alerts: ProjectionAlert[];
}

export interface ProjectionAlert {
  level: "info" | "warning";
  message: string;
}

export interface ProjectionRow {
  month: string;
  income: number;
  expense: number;
  balance: number;
  projected: boolean;
}

const normalizeInterval = (interval: string | null | undefined) =>
  String(interval || "monthly").trim().toLowerCase();

export const intervalFactor = (interval: string): number => {
  const i = normalizeInterval(interval);
  if (i.startsWith("week") || i === "semanal") return 4.345;
  if (i.startsWith("year") || i === "anual" || i === "annual") return 1 / 12;
  return 1;
};

export const buildRecurringSources = (
  transactions: ProjectionRecurringTx[],
): RecurringSource[] =>
  transactions
    .filter((t) => t.is_recurring && (t.type === "income" || t.type === "expense"))
    .map((t) => {
      const interval = normalizeInterval(t.recurrence_interval);
      const factor = intervalFactor(interval);
      const rawAmount = Number(t.amount) || 0;
      return {
        id: String(t.id),
        description: String(t.description || "(sem descrição)"),
        category: t.category ?? null,
        type: t.type,
        rawAmount,
        interval,
        factor,
        monthlyEquivalent: rawAmount * factor,
        endDate: t.recurrence_end_date ?? null,
      };
    });

export interface ComputeProjectionInput {
  monthlyData: MonthlyHistoryRow[];
  recurringTransactions: ProjectionRecurringTx[];
  futureMonthLabels: string[];
  futureMonthKeys?: string[]; // "yyyy-MM" alinhado 1:1 com futureMonthLabels; habilita corte de contratos por mes
  historyWindow?: number; // 3, 6, 12. default 3
  recurringOverride?: { income?: number; expense?: number }; // for scenarios
}

export interface ComputeProjectionResult {
  rows: ProjectionRow[];
  breakdown: ProjectionBreakdown;
}

export const computeProjection = (
  input: ComputeProjectionInput,
): ComputeProjectionResult => {
  const { monthlyData, recurringTransactions, futureMonthLabels, futureMonthKeys, historyWindow = 3, recurringOverride } = input;
  const window = Math.max(1, Math.min(24, historyWindow));
  const last = monthlyData.slice(-window);
  const incomeMonths = last.filter((m) => m.income > 0);
  const expenseMonths = last.filter((m) => m.expense > 0);
  const histAvgInc =
    incomeMonths.length > 0
      ? incomeMonths.reduce((a, m) => a + m.income, 0) / incomeMonths.length
      : 0;
  const histAvgExp =
    expenseMonths.length > 0
      ? expenseMonths.reduce((a, m) => a + m.expense, 0) / expenseMonths.length
      : 0;

  const sources = buildRecurringSources(recurringTransactions);
  const recIncCalc = sources
    .filter((s) => s.type === "income")
    .reduce((sum, s) => sum + s.monthlyEquivalent, 0);
  const recExpCalc = sources
    .filter((s) => s.type === "expense")
    .reduce((sum, s) => sum + s.monthlyEquivalent, 0);

  const recInc = recurringOverride?.income ?? recIncCalc;
  const recExp = recurringOverride?.expense ?? recExpCalc;

  const chosenIncome = Math.max(histAvgInc, recInc);
  const chosenExpense = Math.max(histAvgExp, recExp);

  const incomeSourceUsed: ProjectionBreakdown["incomeSourceUsed"] =
    chosenIncome <= 0 ? "none" : recInc >= histAvgInc ? "recurring" : "historical";
  const expenseSourceUsed: ProjectionBreakdown["expenseSourceUsed"] =
    chosenExpense <= 0 ? "none" : recExp >= histAvgExp ? "recurring" : "historical";

  const alerts: ProjectionAlert[] = [];
  if (incomeMonths.length < Math.min(3, window)) {
    alerts.push({
      level: "warning",
      message: `Pouco histórico de entradas (${incomeMonths.length} mês${incomeMonths.length === 1 ? "" : "es"} com dado). A projeção pode ser imprecisa.`,
    });
  }
  if (expenseMonths.length < Math.min(3, window)) {
    alerts.push({
      level: "warning",
      message: `Pouco histórico de saídas (${expenseMonths.length} mês${expenseMonths.length === 1 ? "" : "es"} com dado).`,
    });
  }
  if (incomeSourceUsed === "recurring" && histAvgInc > 0 && recInc > histAvgInc * 1.5) {
    alerts.push({
      level: "info",
      message: "A baseline recorrente de entradas é bem maior que a média histórica — projeção está dominada pelas recorrências configuradas.",
    });
  }
  if (expenseSourceUsed === "recurring" && histAvgExp > 0 && recExp > histAvgExp * 1.5) {
    alerts.push({
      level: "info",
      message: "A baseline recorrente de saídas é bem maior que a média histórica.",
    });
  }
  if (chosenIncome === 0 && chosenExpense === 0) {
    alerts.push({ level: "warning", message: "Sem dados suficientes para projetar. Cadastre rendas/despesas recorrentes ou adicione transações." });
  }

  const rows: ProjectionRow[] = [];
  last.forEach((m) =>
    rows.push({
      month: m.month,
      income: m.income,
      expense: m.expense,
      balance: m.balance,
      projected: false,
    }),
  );
  // Baseline recorrente ATIVA no mes (contratos com prazo saem do calculo apos o termino).
  // Sem monthKey ("yyyy-MM"), nao ha corte por mes -> soma todas as fontes (comportamento antigo).
  const activeRecurring = (monthKey: string | null, kind: "income" | "expense") =>
    sources
      .filter((s) => s.type === kind && (!s.endDate || !monthKey || s.endDate.slice(0, 7) >= monthKey))
      .reduce((sum, s) => sum + s.monthlyEquivalent, 0);

  futureMonthLabels.forEach((label, i) => {
    const monthKey = futureMonthKeys?.[i] ?? null;
    const monthRecInc = recurringOverride?.income ?? activeRecurring(monthKey, "income");
    const monthRecExp = recurringOverride?.expense ?? activeRecurring(monthKey, "expense");
    const monthIncome = Math.max(histAvgInc, monthRecInc);
    const monthExpense = Math.max(histAvgExp, monthRecExp);
    rows.push({
      month: label,
      income: Math.round(monthIncome),
      expense: Math.round(monthExpense),
      balance: Math.round(monthIncome - monthExpense),
      projected: true,
    });
  });

  return {
    rows,
    breakdown: {
      historicalAverageIncome: histAvgInc,
      historicalAverageExpense: histAvgExp,
      historicalMonthsConsideredIncome: incomeMonths.length,
      historicalMonthsConsideredExpense: expenseMonths.length,
      historyWindow: window,
      recurringBaselineIncome: recInc,
      recurringBaselineExpense: recExp,
      chosenIncome,
      chosenExpense,
      incomeSourceUsed,
      expenseSourceUsed,
      recurringSources: sources,
      alerts,
    },
  };
};
