// KPIs financeiros úteis (empresa + SaaS/assinatura/consultoria). Puro/testável.
// Deriva da DRE + monthlyData + CFO + MRR + clientes — NÃO recalcula saldo/renda; consolida.
// KPIs sem dado suficiente retornam null (a UI mostra "configure X" em vez de número falso).

export interface KpiInputs {
  // Rentabilidade (da DRE)
  receitaBruta: number;
  receitaLiquida: number;
  margemBruta: number; // 0..1
  margemEbitda: number;
  margemLiquida: number;
  custosFixos: number; // p/ ponto de equilíbrio
  margemContribuicaoPct: number; // 0..1
  // Crescimento (monthlyData oldest→newest, income)
  monthlyIncome: number[];
  // Recorrência / SaaS
  mrr: number;
  mrrPrev: number;
  expansao: number;
  churn: number;
  nClientesRecorrentes: number;
  // Aquisição
  novosClientesMes: number;
  custoComercialMes: number;
  // Ticket / recebimento
  receitaRecebidaMes: number;
  nEntradasMes: number;
  aReceber: number;
  aReceberVencido: number;
  // Liquidez / fôlego
  saldoDisponivel: number;
  despesaMensal: number;
  runwayMeses: number;
}

export interface Kpis {
  margemBruta: number;
  margemEbitda: number;
  margemLiquida: number;
  pontoEquilibrio: number | null; // faturamento mínimo/mês
  crescimentoMoM: number | null;
  crescimentoYoY: number | null;
  mrr: number;
  arr: number;
  nrr: number | null; // net revenue retention
  churnRate: number | null;
  arpu: number | null;
  ltv: number | null;
  cac: number | null;
  ltvCac: number | null;
  paybackCacMeses: number | null;
  ticketMedio: number | null;
  dso: number | null; // dias
  inadimplencia: number | null; // 0..1
  coberturaMeses: number | null; // saldo / despesa
  runwayMeses: number;
}

const div = (a: number, b: number): number | null => (b > 0 ? a / b : null);

export const computeKpis = (i: KpiInputs): Kpis => {
  const n = i.monthlyIncome.length;
  const cur = i.monthlyIncome[n - 1] ?? 0;
  const prevM = n >= 2 ? i.monthlyIncome[n - 2] : null;
  const prevY = n >= 13 ? i.monthlyIncome[n - 13] : null;

  const arpu = div(i.mrr, i.nClientesRecorrentes);
  const churnRate = div(i.churn, i.mrrPrev);
  const cac = i.custoComercialMes > 0 ? div(i.custoComercialMes, i.novosClientesMes) : null;
  const ltv = arpu != null && churnRate != null && churnRate > 0 ? arpu / churnRate : null;

  return {
    margemBruta: i.margemBruta,
    margemEbitda: i.margemEbitda,
    margemLiquida: i.margemLiquida,
    pontoEquilibrio: i.margemContribuicaoPct > 0 ? i.custosFixos / i.margemContribuicaoPct : null,
    crescimentoMoM: prevM != null && prevM > 0 ? (cur - prevM) / prevM : null,
    crescimentoYoY: prevY != null && prevY > 0 ? (cur - prevY) / prevY : null,
    mrr: i.mrr,
    arr: i.mrr * 12,
    nrr: i.mrrPrev > 0 ? (i.mrrPrev + i.expansao - i.churn) / i.mrrPrev : null,
    churnRate,
    arpu,
    ltv,
    cac,
    ltvCac: ltv != null && cac != null && cac > 0 ? ltv / cac : null,
    paybackCacMeses: cac != null && arpu != null && arpu > 0 ? cac / arpu : null,
    ticketMedio: div(i.receitaRecebidaMes, i.nEntradasMes),
    dso: i.receitaLiquida > 0 ? (i.aReceber / i.receitaLiquida) * 30 : null,
    inadimplencia: div(i.aReceberVencido, i.receitaRecebidaMes + i.aReceberVencido),
    coberturaMeses: div(i.saldoDisponivel, i.despesaMensal),
    runwayMeses: i.runwayMeses,
  };
};
