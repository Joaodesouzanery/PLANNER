// Composição do patrimônio líquido. Puro/testável.
//
// Regra anti-dupla-contagem (provada):
//   `saldoRealHoje` (razão canônico) = Σ (recebido − pago) de income/expense; NUNCA inclui
//   saldo de abertura de conta nem transferências (buildPeriodSource filtra só income/expense).
//   Logo o único valor de uma conta de investimento/reserva que NÃO está no razão é o seu
//   `opening_balance` (principal pré-existente). Somar o saldo ATUAL da conta duplicaria a parte
//   que veio de aporte/renda já contada no caixa. Por isso `investimentos` usa o saldo de abertura.
//
//   Caso dominante: quem tem "R$ 50k no CDB" cadastra opening_balance = 50k (sem lançamentos) →
//   investimentos = 50k, igual à reserva atual. Quem financia o investimento via renda rastreada
//   (opening ≈ 0) mantém o dinheiro no caixa (já contado) — patrimônio certo, só rotulado "caixa".

export interface NetWorthParts {
  caixa: number; // saldoRealHoje (razão) — dinheiro do fluxo recebido/pago
  investimentos: number; // Σ opening_balance das contas savings/investment no escopo
  ativosManuais: number; // itens de ativo cadastrados à mão
  passivosAuto: number; // parcelas + saldo de recorrências com prazo
  passivosManuais: number; // dívidas cadastradas à mão
}

export interface NetWorth {
  ativos: number;
  passivos: number;
  patrimonioLiquido: number;
}

export const computeNetWorth = (p: NetWorthParts): NetWorth => {
  const ativos = p.caixa + p.investimentos + p.ativosManuais;
  const passivos = p.passivosAuto + p.passivosManuais;
  return { ativos, passivos, patrimonioLiquido: ativos - passivos };
};

/** Soma o saldo de ABERTURA (principal) das contas de reserva/investimento — parte fora do razão. */
export const investimentosPrincipal = (
  accounts: { account_type?: string | null; opening_balance?: number | string | null }[],
): number =>
  accounts
    .filter((a) => a.account_type === "savings" || a.account_type === "investment")
    .reduce((s, a) => s + Number(a.opening_balance || 0), 0);
