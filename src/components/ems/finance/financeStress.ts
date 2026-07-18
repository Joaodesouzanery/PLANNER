// Stress-test financeiro: e se a renda cair X%, se um cliente sair, se vier um gasto extra?
// Puro/testável. Reusa computeCfo (re-rodado com renda chocada) + menorSaldo. NÃO recalcula saldo.
import type { PeriodRow } from "./useFinanceData";
import { computeCfo, type CfoMetrics, type CfoSettings, type ExpectedMonthly } from "./financeCfo";
import { menorSaldo } from "./financeCanonical";

/** Fôlego (meses) dado o déficit mensal do cenário: se a sobra fica ≥ 0, é infinito. */
export const runwayShock = (cfo: CfoMetrics, deltaRenda: number): number => {
  const novaSobra = cfo.sobraMensal - deltaRenda;
  return novaSobra >= 0 ? Infinity : cfo.saldoLiquidoImposto / -novaSobra;
};

export interface Choque {
  rendaPct?: number; // 0.3 = renda −30%
  perderRenda?: number; // R$/mês fixo (ex.: cliente.ongoing)
  gastoExtra?: number; // saída pontual
  gastoExtraDate?: string; // yyyy-MM-dd (default hoje)
}

export type Veredito = "aguenta" | "aperta" | "quebra";

export interface StressResult {
  sobraBase: number;
  sobraChoque: number;
  runwayBase: number;
  runwayChoque: number;
  pisoBase: number;
  pisoChoque: number;
  perdaRendaMensal: number;
  veredito: Veredito;
}

export const stressScenario = (
  rows: PeriodRow[],
  expected: ExpectedMonthly,
  settings: CfoSettings,
  reservaAtual: number,
  today: string,
  choque: Choque,
): StressResult => {
  const base = computeCfo(rows, settings, reservaAtual, today, expected);
  const perda = (choque.perderRenda || 0) + (choque.rendaPct ? expected.income * choque.rendaPct : 0);
  const shocked = computeCfo(rows, settings, reservaAtual, today, { ...expected, income: Math.max(0, expected.income - perda) });

  const extraRows: PeriodRow[] = choque.gastoExtra
    ? ([{ id: "__stress", date: choque.gastoExtraDate || today, type: "expense", amount: choque.gastoExtra, category: null, description: "choque", sourceId: null, accountId: null, sourceType: "stress", paid: false, realized: false, projected: true, synthetic: true }] as unknown as PeriodRow[])
    : [];
  const pisoBase = menorSaldo(rows, 90, today).saldo;
  const pisoChoque = menorSaldo([...rows, ...extraRows], 90, today).saldo;

  const runwayBase = runwayShock(base, 0);
  const runwayChoque = runwayShock(shocked, 0);

  const veredito: Veredito =
    pisoChoque < 0 || (runwayChoque !== Infinity && runwayChoque < 3)
      ? "quebra"
      : shocked.sobraMensal < 0 || pisoChoque < reservaAtual
        ? "aperta"
        : "aguenta";

  return {
    sobraBase: base.sobraMensal,
    sobraChoque: shocked.sobraMensal,
    runwayBase,
    runwayChoque,
    pisoBase,
    pisoChoque,
    perdaRendaMensal: perda,
    veredito,
  };
};
