// Finanças · Custos (fixos, variáveis e tipos personalizados).
// Um "custo" é uma transação de saída recorrente (is_recurring) classificada num bucket.
// Este módulo é puro/testável: decide se o custo incide no mês, qual o vencimento e se já foi checado.

export interface CostBucket {
  id: string;
  name: string;
  kind: string; // "fixo" | "variavel" | "outro"
  color: string | null;
  sort_order: number;
}

export interface CostTx {
  id: string;
  description: string;
  amount: number;
  type: "income" | "expense";
  category?: string | null;
  date: string;
  due_date?: string | null;
  status?: string | null;
  settled_at?: string | null;
  is_recurring?: boolean | null;
  recurrence_interval?: string | null;
  recurrence_end_date?: string | null;
  cost_bucket_id?: string | null;
  source_id?: string | null;
}

export const monthOf = (d: string) => String(d).slice(0, 7);
const effDate = (t: CostTx) => String(t.due_date || t.date).slice(0, 10);
export const isPaidTx = (t: CostTx) => t.status === "reconciled" || !!t.settled_at;

/** Vencimento do custo no mês (mantém o dia do lançamento base, com clamp no fim do mês). */
export const dueDateInMonth = (cost: CostTx, month: string): string => {
  const day = Number(effDate(cost).slice(8, 10)) || 1;
  const [y, m] = month.split("-").map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return `${month}-${String(Math.min(day, last)).padStart(2, "0")}`;
};

/** O custo incide neste mês? (recorrência mensal/semanal = todo mês; anual = mesmo mês do início). */
export const occursInMonth = (cost: CostTx, month: string): boolean => {
  const start = monthOf(effDate(cost));
  if (!cost.is_recurring) return start === month;
  if (month < start) return false;
  const end = cost.recurrence_end_date ? monthOf(cost.recurrence_end_date) : null;
  if (end && month > end) return false;
  if (cost.recurrence_interval === "yearly") return start.slice(5) === month.slice(5);
  return true;
};

export interface CostOccurrence {
  cost: CostTx;
  due: string;
  amount: number;
  paid: boolean;
  /** Id da transação real daquele mês (para editar/desmarcar), quando existir. */
  txId: string | null;
}

/**
 * Checagem do mês: pago se a própria linha do custo cai no mês e está quitada,
 * ou se existe uma transação materializada (source_id = custo) quitada no mês.
 */
export const occurrenceFor = (cost: CostTx, month: string, all: CostTx[]): CostOccurrence => {
  const due = dueDateInMonth(cost, month);
  const self = monthOf(effDate(cost)) === month ? cost : null;
  const child = all.find((t) => t.id !== cost.id && t.source_id === cost.id && monthOf(effDate(t)) === month) || null;
  const row = (child && isPaidTx(child) ? child : self && isPaidTx(self) ? self : child || self) as CostTx | null;
  return {
    cost,
    due: row ? effDate(row) : due,
    amount: Number(row?.amount ?? cost.amount),
    paid: row ? isPaidTx(row) : false,
    txId: row && row.id !== cost.id ? row.id : self ? cost.id : null,
  };
};

export interface CostBucketGroup {
  bucket: CostBucket | null;
  items: CostOccurrence[];
  total: number;
  paidTotal: number;
}

export interface CostMonthReport {
  month: string;
  groups: CostBucketGroup[];
  total: number;
  paidTotal: number;
  pendingTotal: number;
}

/** Painel do mês: custos por bucket, total previsto e total já checado. */
export const buildCostMonth = (
  buckets: CostBucket[],
  costs: CostTx[],
  all: CostTx[],
  month: string,
): CostMonthReport => {
  const active = costs.filter((c) => c.type === "expense" && occursInMonth(c, month));
  const byBucket = new Map<string, CostOccurrence[]>();
  for (const c of active) {
    const key = c.cost_bucket_id || "__none__";
    const arr = byBucket.get(key) || [];
    arr.push(occurrenceFor(c, month, all));
    byBucket.set(key, arr);
  }
  const ordered = [...buckets].sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name));
  const groups: CostBucketGroup[] = [];
  for (const b of ordered) {
    const items = (byBucket.get(b.id) || []).sort((x, y) => x.due.localeCompare(y.due));
    groups.push({ bucket: b, items, total: sum(items), paidTotal: sum(items.filter((i) => i.paid)) });
  }
  const loose = (byBucket.get("__none__") || []).sort((x, y) => x.due.localeCompare(y.due));
  if (loose.length) groups.push({ bucket: null, items: loose, total: sum(loose), paidTotal: sum(loose.filter((i) => i.paid)) });
  const total = groups.reduce((s, g) => s + g.total, 0);
  const paidTotal = groups.reduce((s, g) => s + g.paidTotal, 0);
  return { month, groups, total, paidTotal, pendingTotal: total - paidTotal };
};

const sum = (items: CostOccurrence[]) => items.reduce((s, i) => s + i.amount, 0);

export const shiftMonth = (month: string, delta: number): string => {
  const [y, m] = month.split("-").map(Number);
  const idx = y * 12 + (m - 1) + delta;
  return `${Math.floor(idx / 12)}-${String((idx % 12) + 1).padStart(2, "0")}`;
};
