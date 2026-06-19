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
}

export interface ProjectionBreakdown {
  historicalAverageIncome: number;
  historicalAverageExpense: number;
  historicalMonthsConsideredIncome: number;
  historicalMonthsConsideredExpense: number;
  recurringBaselineIncome: number;
  recurringBaselineExpense: number;
  chosenIncome: number;
  chosenExpense: number;
  incomeSourceUsed: "historical" | "recurring" | "none";
  expenseSourceUsed: "historical" | "recurring" | "none";
  recurringSources: RecurringSource[];
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
  if (i.startsWith("week") || i === "semanal") return 4.345; // semanas por mês (média)
  if (i.startsWith("year") || i === "anual" || i === "annual") return 1 / 12;
  return 1; // monthly por padrão
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
      };
    });

export interface ComputeProjectionInput {
  monthlyData: MonthlyHistoryRow[];
  recurringTransactions: ProjectionRecurringTx[];
  futureMonthLabels: string[]; // ex: ["jul/26", "ago/26", "set/26"]
}

export interface ComputeProjectionResult {
  rows: ProjectionRow[];
  breakdown: ProjectionBreakdown;
}

export const computeProjection = (
  input: ComputeProjectionInput,
): ComputeProjectionResult => {
  const { monthlyData, recurringTransactions, futureMonthLabels } = input;
  const last3 = monthlyData.slice(-3);
  const incomeMonths = last3.filter((m) => m.income > 0);
  const expenseMonths = last3.filter((m) => m.expense > 0);
  const histAvgInc =
    incomeMonths.length > 0
      ? incomeMonths.reduce((a, m) => a + m.income, 0) / incomeMonths.length
      : 0;
  const histAvgExp =
    expenseMonths.length > 0
      ? expenseMonths.reduce((a, m) => a + m.expense, 0) / expenseMonths.length
      : 0;

  const sources = buildRecurringSources(recurringTransactions);
  const recInc = sources
    .filter((s) => s.type === "income")
    .reduce((sum, s) => sum + s.monthlyEquivalent, 0);
  const recExp = sources
    .filter((s) => s.type === "expense")
    .reduce((sum, s) => sum + s.monthlyEquivalent, 0);

  const chosenIncome = Math.max(histAvgInc, recInc);
  const chosenExpense = Math.max(histAvgExp, recExp);

  const incomeSourceUsed: ProjectionBreakdown["incomeSourceUsed"] =
    chosenIncome <= 0
      ? "none"
      : recInc >= histAvgInc
      ? "recurring"
      : "historical";
  const expenseSourceUsed: ProjectionBreakdown["expenseSourceUsed"] =
    chosenExpense <= 0
      ? "none"
      : recExp >= histAvgExp
      ? "recurring"
      : "historical";

  const rows: ProjectionRow[] = [];
  last3.forEach((m) =>
    rows.push({
      month: m.month,
      income: m.income,
      expense: m.expense,
      balance: m.balance,
      projected: false,
    }),
  );
  futureMonthLabels.forEach((label) =>
    rows.push({
      month: label,
      income: Math.round(chosenIncome),
      expense: Math.round(chosenExpense),
      balance: Math.round(chosenIncome - chosenExpense),
      projected: true,
    }),
  );

  return {
    rows,
    breakdown: {
      historicalAverageIncome: histAvgInc,
      historicalAverageExpense: histAvgExp,
      historicalMonthsConsideredIncome: incomeMonths.length,
      historicalMonthsConsideredExpense: expenseMonths.length,
      recurringBaselineIncome: recInc,
      recurringBaselineExpense: recExp,
      chosenIncome,
      chosenExpense,
      incomeSourceUsed,
      expenseSourceUsed,
      recurringSources: sources,
    },
  };
};
