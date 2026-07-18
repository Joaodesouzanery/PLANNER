// Fase 3 — "Compra futura": monta a(s) linha(s) candidata(s) e mede o impacto no piso do caixa (90d),
// SEM escrever no banco (preview via menorSaldo puro). Puro/testável.
import type { PeriodRow } from "./useFinanceData";
import { menorSaldo } from "./financeCanonical";

export interface PurchasePlan {
  description: string;
  total: number;
  category: string | null;
  accountId: string | null;
  dueDate: string; // yyyy-MM-dd (à vista = data; parcelado = 1ª parcela)
  installments: number; // 1 = à vista
  interestMonthly?: number; // % a.m. (parcelado)
}

const addMonthsIso = (ymd: string, n: number) => {
  const [y, m, d] = ymd.split("-").map(Number);
  const total = y * 12 + (m - 1) + n;
  const yy = Math.floor(total / 12);
  const mm = (total % 12) + 1;
  const lastDay = new Date(Date.UTC(yy, mm, 0)).getUTCDate();
  return `${yy}-${String(mm).padStart(2, "0")}-${String(Math.min(d, lastDay)).padStart(2, "0")}`;
};

/** Valor da parcela: PMT com juros; sem juros = total/n. */
export const parcela = (total: number, n: number, jurosPct = 0): number => {
  if (n <= 1) return total;
  const i = (jurosPct || 0) / 100;
  if (i <= 0) return total / n;
  return (total * (i * Math.pow(1 + i, n))) / (Math.pow(1 + i, n) - 1);
};

/** Linhas candidatas (não persistidas) — uma por parcela, começando em dueDate. */
export const purchaseRows = (plan: PurchasePlan, sourceId = "__preview"): PeriodRow[] => {
  const n = Math.max(1, Math.floor(plan.installments || 1));
  const pmt = parcela(plan.total, n, plan.interestMonthly);
  return Array.from({ length: n }, (_, k) => ({
    id: `${sourceId}-${k}`,
    date: addMonthsIso(plan.dueDate, k),
    type: "expense" as const,
    amount: pmt,
    category: plan.category,
    description: n > 1 ? `${plan.description} (${k + 1}/${n})` : plan.description,
    sourceId,
    accountId: plan.accountId,
    sourceType: "purchase",
    paid: false,
    realized: false,
    projected: true,
    synthetic: true,
  })) as unknown as PeriodRow[];
};

export interface PurchaseImpact {
  floorBefore: number;
  floorAfter: number;
  delta: number; // negativo = piso cai
  diaAfter: string; // dia do menor saldo com a compra
  totalPago: number;
}

/** Piso do caixa (menor saldo 90d) antes × depois da compra. */
export const purchaseImpact = (rows: PeriodRow[], candidatas: PeriodRow[], today: string): PurchaseImpact => {
  const before = menorSaldo(rows, 90, today);
  const after = menorSaldo([...rows, ...candidatas], 90, today);
  return {
    floorBefore: before.saldo,
    floorAfter: after.saldo,
    delta: after.saldo - before.saldo,
    diaAfter: after.date,
    totalPago: candidatas.reduce((a, r) => a + r.amount, 0),
  };
};
