// Camada CFO — métricas de nível CFO derivadas do read-model canônico. Funções puras/testáveis.
import type { PeriodRow } from "./useFinanceData";
import { saldoRealHoje } from "./financeCanonical";

export interface CfoSettings {
  tax_rate: number; // % efetivo
  reserve_months: number; // meses de custo p/ reserva
  cdi_monthly_liquid: number; // % ao mês líquido
}
export const DEFAULT_CFO: CfoSettings = { tax_rate: 6, reserve_months: 6, cdi_monthly_liquid: 0.9 };

/** Renda/despesa mensal esperada (max média histórica × baseline recorrente) — vinda de `computeProjection`. */
export interface ExpectedMonthly { income: number; expense: number; }

const isImpostoRow = (r: PeriodRow) => /imposto|tribut|\bdas\b|simples/i.test(`${r.category || ""} ${r.description || ""}`);

export interface CfoMetrics {
  saldoDisponivel: number;
  saldoLiquidoImposto: number;
  faturamentoMensal: number; // média entradas recebidas 3 meses fechados
  despesaMensal: number; // média saídas pagas 3 meses fechados
  impostoMensal: number;
  receitaLiquida: number;
  sobraMensal: number;
  taxaPoupanca: number; // 0..1
  burnMensal: number; // despesa + imposto
  runwayMeses: number;
  impostoARecolher: number;
  reservaAlvo: number;
  reservaAtual: number;
  reservaPct: number; // 0..1
  aReceberVencido: number;
  aReceberVencidoRows: PeriodRow[];
}

/**
 * @param reservaAtual reserva já separada (ex.: saldo de contas savings/investment do workspace).
 */
export const computeCfo = (rows: PeriodRow[], s: CfoSettings, reservaAtual: number, today: string, expected: ExpectedMonthly): CfoMetrics => {
  const rate = (s.tax_rate || 0) / 100;
  const saldoDisponivel = saldoRealHoje(rows, today);
  // Renda/despesa mensal ESPERADA (fonte única = aba Projeções): max(média histórica, baseline recorrente).
  // Antes derivava só do "pago" nos 3 meses fechados → com histórico curto zerava a renda e quebrava tudo.
  const faturamentoMensal = Math.max(0, expected.income || 0);
  const despesaMensal = Math.max(0, expected.expense || 0);
  const impostoMensal = faturamentoMensal * rate;
  const receitaLiquida = faturamentoMensal - impostoMensal;
  const sobraMensal = receitaLiquida - despesaMensal;
  const taxaPoupanca = receitaLiquida > 0 ? sobraMensal / receitaLiquida : 0;
  // Burn = despesa esperada; o imposto já é descontado no saldo líquido (reserva-alvo = meses × despesa).
  const burnMensal = despesaMensal;

  // Imposto a recolher = Σ receita recebida × alíquota − Σ imposto já pago.
  const receitaRecebida = rows.reduce((a, r) => (r.type === "income" && r.paid && r.date <= today ? a + r.amount : a), 0);
  const impostoPago = rows.reduce((a, r) => (r.type === "expense" && r.paid && isImpostoRow(r) ? a + r.amount : a), 0);
  const impostoARecolher = Math.max(0, receitaRecebida * rate - impostoPago);
  const saldoLiquidoImposto = saldoDisponivel - impostoARecolher;

  const runwayMeses = burnMensal > 0 ? saldoLiquidoImposto / burnMensal : 0;
  const reservaAlvo = (s.reserve_months || 0) * burnMensal;
  const reservaPct = reservaAlvo > 0 ? Math.min(1, reservaAtual / reservaAlvo) : 0;

  // Aging = só recebíveis REAIS vencidos (não recorrências/projeções sintéticas, que não são "atraso").
  const aReceberVencidoRows = rows
    .filter((r) => r.type === "income" && !r.paid && r.date < today && !r.synthetic && !r.projected && r.sourceType === "transaction")
    .sort((a, b) => a.date.localeCompare(b.date));
  const aReceberVencido = aReceberVencidoRows.reduce((a, r) => a + r.amount, 0);

  return {
    saldoDisponivel, saldoLiquidoImposto, faturamentoMensal, despesaMensal, impostoMensal,
    receitaLiquida, sobraMensal, taxaPoupanca, burnMensal, runwayMeses, impostoARecolher,
    reservaAlvo, reservaAtual, reservaPct, aReceberVencido, aReceberVencidoRows,
  };
};

/** Meses até atingir a reserva-alvo poupando `sobraMensal` (a partir de `reservaAtual`). */
export const mesesParaReserva = (m: CfoMetrics): number | null => {
  if (m.reservaAtual >= m.reservaAlvo) return 0;
  if (m.sobraMensal <= 0) return null;
  return Math.ceil((m.reservaAlvo - m.reservaAtual) / m.sobraMensal);
};

/** Valor futuro de aportes mensais no CDI. FV = aporte × [((1+i)^n − 1)/i]. */
export const fvAportes = (aporteMensal: number, meses: number, taxaMensalPct: number): number => {
  const i = (taxaMensalPct || 0) / 100;
  if (i <= 0) return aporteMensal * meses;
  return aporteMensal * ((Math.pow(1 + i, meses) - 1) / i);
};
