import type { ForecastDay, ForecastEvent, ForecastSeries, UpcomingPayable } from "./financeTypes.ts";

const DAY_MS = 86_400_000;

const dateOnly = (date: string | Date) => {
  if (typeof date === "string") return date.slice(0, 10);
  return new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())).toISOString().slice(0, 10);
};

const addDays = (date: string, amount: number) => {
  const parsed = new Date(`${date}T00:00:00Z`);
  parsed.setUTCDate(parsed.getUTCDate() + amount);
  return parsed.toISOString().slice(0, 10);
};

const signedAmount = (event: ForecastEvent) =>
  event.kind === "income" || event.kind === "transfer_in" ? Number(event.amount) : -Number(event.amount);

export const confidenceWeight = (confidence?: ForecastEvent["confidence"]) =>
  confidence === "high" ? 0.9 : confidence === "low" ? 0.35 : 0.6;

const scenarioAmount = (event: ForecastEvent, scenario: "conservative" | "expected" | "optimistic") => {
  if (!event.isScenario) return signedAmount(event);
  const signed = signedAmount(event);
  const isIncome = signed >= 0;
  const weight = confidenceWeight(event.confidence);
  if (scenario === "conservative") return isIncome ? 0 : signed;
  if (scenario === "expected") return signed * weight;
  return isIncome ? signed : signed * weight;
};

export const buildForecastSeries = ({
  events,
  openingBalance,
  startDate = dateOnly(new Date()),
  days = 90,
  variableMonthlyExpense = 0,
}: {
  events: ForecastEvent[];
  openingBalance: number;
  startDate?: string;
  days?: number;
  /** Gasto variável mensal estimado (esperado − recorrente). Aplicado só nas linhas Esperado/Conservador
   *  como um "vazamento" diário, para a projeção não crescer rápido demais ignorando o gasto do dia-a-dia. */
  variableMonthlyExpense?: number;
}): ForecastSeries => {
  const dailyVariable = Math.max(0, variableMonthlyExpense) / 30;
  const endDate = addDays(startDate, Math.max(0, days - 1));
  const activeEvents = events.filter((event) =>
    event.status !== "skipped" && event.date >= startDate && event.date <= endDate
  );
  const byDate = new Map<string, ForecastEvent[]>();
  activeEvents.forEach((event) => {
    const key = dateOnly(event.date);
    byDate.set(key, [...(byDate.get(key) || []), event]);
  });

  let base = openingBalance;
  let conservative = openingBalance;
  let expected = openingBalance;
  let optimistic = openingBalance;
  let minimumBalance = openingBalance;
  let minimumBalanceDate = startDate;
  let firstNegativeDate: string | null = openingBalance < 0 ? startDate : null;
  const result: ForecastDay[] = [];

  for (let index = 0; index < days; index += 1) {
    const date = addDays(startDate, index);
    const dayEvents = byDate.get(date) || [];
    const committed = dayEvents.filter((event) => !event.isScenario);
    const income = committed.filter((event) => event.kind === "income").reduce((sum, event) => sum + Number(event.amount), 0);
    const expense = committed.filter((event) => event.kind === "expense").reduce((sum, event) => sum + Number(event.amount), 0);
    const transferIn = committed.filter((event) => event.kind === "transfer_in").reduce((sum, event) => sum + Number(event.amount), 0);
    const transferOut = committed.filter((event) => event.kind === "transfer_out").reduce((sum, event) => sum + Number(event.amount), 0);
    base += income + transferIn - expense - transferOut;
    conservative += dayEvents.reduce((sum, event) => sum + scenarioAmount(event, "conservative"), 0) - dailyVariable;
    expected += dayEvents.reduce((sum, event) => sum + scenarioAmount(event, "expected"), 0) - dailyVariable;
    optimistic += dayEvents.reduce((sum, event) => sum + scenarioAmount(event, "optimistic"), 0);

    if (base < minimumBalance) {
      minimumBalance = base;
      minimumBalanceDate = date;
    }
    if (!firstNegativeDate && base < 0) firstNegativeDate = date;
    result.push({ date, income, expense, transferIn, transferOut, balance: base, conservative, expected, optimistic, events: dayEvents });
  }

  return { startDate, endDate, openingBalance, days: result, minimumBalance, minimumBalanceDate, firstNegativeDate };
};

export const summarizeForecastByMonth = (series: ForecastSeries) => {
  const map = new Map<string, { month: string; income: number; expense: number; balance: number; expected: number }>();
  series.days.forEach((day) => {
    const month = day.date.slice(0, 7);
    const current = map.get(month) || { month, income: 0, expense: 0, balance: day.balance, expected: day.expected };
    current.income += day.income;
    current.expense += day.expense;
    current.balance = day.balance;
    current.expected = day.expected;
    map.set(month, current);
  });
  return Array.from(map.values());
};

export const getUpcomingPayables = (
  events: ForecastEvent[],
  today = dateOnly(new Date()),
  horizonDays = 45,
): UpcomingPayable[] => {
  const endDate = addDays(today, horizonDays);
  return events
    .filter((event) => event.kind === "expense" && !event.isScenario && event.status !== "reconciled" && event.status !== "skipped")
    // Despesas de transacao com status "confirmed" ja sao tratadas como realizadas
    // no Dashboard (entram no saldo). Logo nao devem aparecer em "Falta pagar".
    // PIX/a vista do dia: marque "Ja paguei" (reconciled) ou deixe como confirmado.
    // Faturas de cartao fechadas (sourceType "invoice", status "confirmed") seguem devidas.
    .filter((event) => !(event.sourceType === "transaction" && event.status === "confirmed"))
    .filter((event) => event.date <= endDate)
    .map((event) => {
      const daysUntilDue = Math.round((new Date(`${event.date}T00:00:00Z`).getTime() - new Date(`${today}T00:00:00Z`).getTime()) / DAY_MS);
      return {
        id: event.id,
        description: event.description,
        dueDate: event.date,
        amount: Number(event.amount),
        daysUntilDue,
        status: daysUntilDue < 0 ? "overdue" as const : daysUntilDue === 0 ? "today" as const : daysUntilDue <= 7 ? "soon" as const : "future" as const,
        accountId: event.accountId,
        sourceType: event.sourceType,
      };
    })
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
};

export const createImportFingerprint = (row: { date: string; description: string; amount: number; type: string }) =>
  `${row.date}|${row.description.trim().toLocaleLowerCase("pt-BR")}|${Number(row.amount).toFixed(2)}|${row.type}`;

export const parseFinanceCsv = (content: string) => {
  const lines = content.replace(/^\uFEFF/, "").split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return [];
  const separator = lines[0].includes(";") ? ";" : ",";
  const headers = lines[0].split(separator).map((item) => item.trim().toLocaleLowerCase("pt-BR"));
  const find = (...names: string[]) => headers.findIndex((header) => names.includes(header));
  const indexes = {
    date: find("data", "date", "vencimento"),
    description: find("descrição", "descricao", "description", "histórico", "historico"),
    amount: find("valor", "amount"),
    type: find("tipo", "type"),
    category: find("categoria", "category"),
  };
  if (indexes.date < 0 || indexes.description < 0 || indexes.amount < 0) return [];
  return lines.slice(1).map((line) => {
    const columns = line.split(separator).map((item) => item.trim().replace(/^"|"$/g, ""));
    const rawAmount = columns[indexes.amount]?.replace(/R\$\s?/g, "").replace(/\./g, "").replace(",", ".") || "0";
    const rawType = indexes.type >= 0 ? columns[indexes.type]?.toLocaleLowerCase("pt-BR") : "";
    const type = rawType.includes("sa") || rawType.includes("desp") || Number(rawAmount) < 0 ? "expense" : "income";
    const rawDate = columns[indexes.date] || "";
    const date = rawDate.includes("/") ? rawDate.split("/").reverse().join("-") : rawDate.slice(0, 10);
    const row = {
      date,
      description: columns[indexes.description] || "",
      amount: Math.abs(Number(rawAmount)),
      type: type as "income" | "expense",
      category: indexes.category >= 0 ? columns[indexes.category] || null : null,
    };
    return { ...row, import_fingerprint: createImportFingerprint(row) };
  }).filter((row) => row.date && row.description && row.amount > 0);
};
