// Read-model CANÔNICO de Finanças. Fonte única de leitura: toda aba deve derivar seus
// números daqui (nunca recalcular saldo por conta própria). Funções puras e testáveis
// operando sobre o universo unificado `PeriodRow[]` de `buildPeriodSource`.
//
// Convenções (decididas com o usuário):
//   paid     = Recebido/Pago (o dinheiro moveu) → conta como REAL.
//   realized = já aconteceu (não-planejado & data passou; inclui "Lançado") → base do carry.
//   previsto = tudo agendado (planned + confirmed + reconciled), por vencimento.
import type { PeriodRow } from "./useFinanceData";

const todayStr = () => new Date().toISOString().slice(0, 10);
const monthStartOf = (d: string) => `${d.slice(0, 7)}-01`;
const sum = (rows: PeriodRow[], pred: (r: PeriodRow) => boolean) =>
  rows.reduce((a, r) => (pred(r) ? a + r.amount : a), 0);
const inPeriod = (r: PeriodRow, from: string, to: string) => r.date >= from && r.date <= to;

/** Uma linha está "atrasada"? previsto (não pago) e vencimento já passou. */
export const isAtrasado = (r: PeriodRow, today: string = todayStr()) => !r.paid && r.date < today;

export interface CanonicalTotals {
  entradasRealizadas: number; // pago/recebido no período
  saidasRealizadas: number;
  entradasPrevistas: number; // tudo (real + previsto) no período
  saidasPrevistas: number;
  aReceber: number; // previsto não-recebido
  aPagar: number; // previsto não-pago
  aReceberRows: PeriodRow[];
  aPagarRows: PeriodRow[];
}

/** Totais canônicos de um período [from,to] (yyyy-MM-dd), por effectiveDate. */
export const canonicalTotals = (rows: PeriodRow[], from: string, to: string): CanonicalTotals => {
  const inP = (r: PeriodRow) => inPeriod(r, from, to);
  const aReceberRows = rows.filter((r) => r.type === "income" && !r.paid && inP(r)).sort((a, b) => a.date.localeCompare(b.date));
  const aPagarRows = rows.filter((r) => r.type === "expense" && !r.paid && inP(r)).sort((a, b) => a.date.localeCompare(b.date));
  return {
    entradasRealizadas: sum(rows, (r) => r.type === "income" && r.paid && inP(r)),
    saidasRealizadas: sum(rows, (r) => r.type === "expense" && r.paid && inP(r)),
    entradasPrevistas: sum(rows, (r) => r.type === "income" && inP(r)),
    saidasPrevistas: sum(rows, (r) => r.type === "expense" && inP(r)),
    aReceber: aReceberRows.reduce((a, r) => a + r.amount, 0),
    aPagar: aPagarRows.reduce((a, r) => a + r.amount, 0),
    aReceberRows,
    aPagarRows,
  };
};

/** Saldo de abertura do mês = acumulado do que JÁ ACONTECEU (realizado) antes de `monthStart`. */
export const saldoAbertura = (rows: PeriodRow[], monthStart: string): number =>
  rows.reduce((a, r) => (r.realized && r.date < monthStart ? a + (r.type === "income" ? r.amount : -r.amount) : a), 0);

/**
 * Saldo real hoje = o número que TODAS as abas exibem como "saldo disponível".
 * = saldoAbertura(mês atual) + entradas recebidas − saídas pagas, do 1º do mês até hoje.
 * Independente do período navegado.
 */
export const saldoRealHoje = (rows: PeriodRow[], today: string = todayStr()): number => {
  const mStart = monthStartOf(today);
  const abertura = saldoAbertura(rows, mStart);
  const recebido = sum(rows, (r) => r.type === "income" && r.paid && r.date >= mStart && r.date <= today);
  const pago = sum(rows, (r) => r.type === "expense" && r.paid && r.date >= mStart && r.date <= today);
  return abertura + recebido - pago;
};

/**
 * Curva de saldo diária a partir do saldo real de hoje.
 * - Saídas não-pagas: vencidas + de hoje batem imediatamente (dia 0); as futuras, na data.
 * - Entradas não-pagas: só as futuras entram — recebível já vencido é incerto e não infla o piso.
 */
export const curvaDiaria = (rows: PeriodRow[], days: number, today: string = todayStr()) => {
  const base = saldoRealHoje(rows, today);
  const pend = rows
    .filter((r) => !r.paid && (r.type === "expense" || r.date > today))
    .map((r) => ({ date: r.date < today ? today : r.date, delta: r.type === "income" ? r.amount : -r.amount }))
    .sort((a, b) => a.date.localeCompare(b.date));
  const out: { date: string; saldo: number }[] = [];
  const start = new Date(`${today}T12:00:00`);
  let running = base;
  let i = 0;
  for (let k = 0; k <= days; k++) {
    const d = new Date(start.getTime() + k * 86_400_000).toISOString().slice(0, 10);
    while (i < pend.length && pend[i].date <= d) { running += pend[i].delta; i += 1; }
    out.push({ date: d, saldo: running });
  }
  return out;
};

/** Menor saldo nos próximos N dias (olha a curva diária, não o líquido do período). */
export const menorSaldo = (rows: PeriodRow[], n: number, today: string = todayStr()) => {
  const curva = curvaDiaria(rows, n, today);
  return curva.reduce((min, p) => (p.saldo < min.saldo ? p : min), curva[0] ?? { date: today, saldo: saldoRealHoje(rows, today) });
};
