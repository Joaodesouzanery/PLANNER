// CFO v2 · Fase 2 — MRR real a partir das recorrências de ENTRADA. Puro/testável.
// MRR "verdadeiro" = recorrentes SEM prazo (endDate null). Contratos a prazo (ex.: Compizzo 2500/2)
// contam na receita recorrente do mês enquanto ativos, mas não no MRR.
import { intervalFactor } from "./projectionCalc";

export interface RecurringTx {
  id: string;
  amount: number | string;
  type: string;
  is_recurring?: boolean | null;
  recurrence_interval?: string | null;
  recurrence_end_date?: string | null;
  date: string;
}

export interface MrrContract { id: string; monthly: number; ongoing: boolean }

/** Contratos de ENTRADA recorrente faturando no mês `monthKey` ("yyyy-MM"). */
export const activeIncomeContracts = (txns: RecurringTx[], monthKey: string): MrrContract[] => {
  const start = `${monthKey}-01`;
  const end = `${monthKey}-31`;
  return txns
    .filter((t) => t.type === "income" && t.is_recurring && t.date <= end && (!t.recurrence_end_date || t.recurrence_end_date >= start))
    .map((t) => ({
      id: t.id,
      monthly: Number(t.amount) * intervalFactor(t.recurrence_interval || "monthly"),
      ongoing: !t.recurrence_end_date,
    }));
};

/** MRR = Σ recorrentes SEM prazo. */
export const mrrHeadline = (contracts: MrrContract[]): number =>
  contracts.filter((c) => c.ongoing).reduce((a, c) => a + c.monthly, 0);

/** Receita recorrente total do mês (inclui contratos a prazo ainda ativos). */
export const recurringTotal = (contracts: MrrContract[]): number =>
  contracts.reduce((a, c) => a + c.monthly, 0);

export interface MrrDeltas { novos: number; expansao: number; churn: number; liquido: number }

/** Variação entre dois meses (snapshots de {id, monthly}). */
export const mrrDeltas = (prev: { id: string; monthly: number }[], cur: { id: string; monthly: number }[]): MrrDeltas => {
  const p = new Map(prev.map((c) => [c.id, c.monthly]));
  const c = new Map(cur.map((x) => [x.id, x.monthly]));
  let novos = 0, expansao = 0, churn = 0;
  for (const x of cur) {
    if (!p.has(x.id)) novos += x.monthly;
    else if (x.monthly > (p.get(x.id) as number)) expansao += x.monthly - (p.get(x.id) as number);
  }
  for (const x of prev) {
    if (!c.has(x.id)) churn += x.monthly;
  }
  return { novos, expansao, churn, liquido: novos + expansao - churn };
};
