// Regra-Mestre · dados iniciais do doc "Preenchimento do Sistema" (Nery Tecnologia, escopo consolidado).
// Puro: só define os conjuntos; o useSeedMyData insere com dedup por chave natural. Nada aqui é fixo no
// código do app — vira linha editável nas tabelas de finanças/estratégia. Dates relativas usam o `today`.

export interface SeedReceita { cliente: string; description: string; amount: number; endDate?: string; }
export interface SeedCusto { description: string; amount: number; category: string; endDate?: string; }
export interface SeedTeto { category: string; teto: number; }
export interface SeedDivida { label: string; value: number; }
export interface SeedConfig { key: string; value: number; effective_date: string; note?: string; }
export interface SeedAcao { descricao: string; quinzena?: string; }
export interface SeedKr { descricao: string; tipo: "financeira" | "operacional"; trimestre?: string; acoes: SeedAcao[]; }
export interface SeedObjetivo { titulo: string; tipo: "financeira" | "operacional"; metrica?: string; alvo?: number; krs: SeedKr[]; }

export const SEED_CLIENTES = [
  { nome: "IRIS", recorrente: true },
  { nome: "Circle", recorrente: true },
  { nome: "RAONI", recorrente: true },
  { nome: "Compizzo", recorrente: true },
  { nome: "CONAB", recorrente: false },
];

// Receita recorrente por cliente. Sem endDate → entra no MRR "pra sempre"; CONAB tem fim → temporário.
export const SEED_RECEITA: SeedReceita[] = [
  { cliente: "IRIS", description: "IRIS — mensalidade (administrativo)", amount: 2000 },
  { cliente: "Circle", description: "Circle — software", amount: 2000 },
  { cliente: "RAONI", description: "RAONI (dentro de IRIS/Circle)", amount: 1500 },
  { cliente: "Compizzo", description: "Compizzo — ConstruData", amount: 1250 },
  { cliente: "CONAB", description: "CONAB — projeto (temporário)", amount: 1500, endDate: "2027-03-31" },
];

// Custos PJ recorrentes. DAS com categoria "DAS" → cai na linha de DEDUÇÃO da DRE (heurística \bdas\b),
// não em despesa operacional (não dobra o imposto estimado).
export const SEED_CUSTOS: SeedCusto[] = [
  { description: "Contador", amount: 150, category: "Contador / Fiscal" },
  { description: "Claude Code", amount: 120, category: "Ferramentas" },
  { description: "Internet", amount: 100, category: "Ferramentas" },
  { description: "Supabase", amount: 125, category: "Infra / COGS" },
  { description: "Domínios", amount: 25, category: "Infra / COGS" },
  { description: "Seguro Macbook", amount: 95, category: "Ferramentas" },
  { description: "Macbook (parcela)", amount: 800, category: "Equipamento", endDate: "2027-05-31" },
  { description: "DAS — Simples Nacional", amount: 495, category: "DAS" },
];

// Dívidas: mensal como despesa recorrente (burn, SEM fim → não duplica o passivo) + saldo devedor no patrimônio.
export const SEED_DIVIDA_MENSAL = { description: "Dívidas cartões (Itaú/Nubank/BRB)", amount: 190, category: "Dívidas" };
export const SEED_DIVIDAS: SeedDivida[] = [
  { label: "Itaú (saldo)", value: 700 },
  { label: "Nubank (saldo)", value: 600 },
  { label: "BRB (saldo)", value: 500 },
];

// Tetos PF (mês corrente). Categorias canônicas do catálogo.
export const SEED_TETOS: SeedTeto[] = [
  { category: "Lazer / Social", teto: 1100 },
  { category: "Transporte", teto: 400 },
  { category: "Alimentação (casa)", teto: 350 },
  { category: "Vestuário", teto: 150 },
  { category: "Saúde / Esporte", teto: 187 },
  { category: "Dívidas", teto: 190 },
  { category: "Outros", teto: 150 },
];

export const SEED_SETTINGS = { tax_regime: "simples", tax_rate: 6, reserve_months: 6, prolabore_mensal: 2310 };

// Patrimônio: Guardado 3.000 = conta savings (vira reserva + entra no patrimônio); Caixa 4.700 = ativo manual
// (o "caixa" derivado do razão é ledger-based, então o disponível inicial entra como ativo). Investido 0.
export const SEED_ACCOUNTS = [
  { name: "Guardado (reserva)", account_type: "savings", opening_balance: 3000 },
];
export const SEED_NETWORTH_ASSETS = [
  { label: "Caixa disponível", category: "caixa", value: 4700 },
];
export const SEED_SINKING = [
  { title: "Reserva de emergência", target: 15000, monthly: 0, balance: 3000 },
];

// Pró-labore e tax_rate na camada datada. A vigência de hoje é preenchida pelo builder.
export const buildSeedConfig = (today: string): SeedConfig[] => [
  { key: "prolabore", value: 2310, effective_date: today, note: "formalizado (INSS)" },
  { key: "prolabore", value: 3500, effective_date: "2027-01-01", note: "reajuste planejado" },
  { key: "tax_rate", value: 6, effective_date: today, note: "Simples ~6%" },
];

// Estratégia (Tela 6). Trimestre/ano vêm do builder.
export const buildSeedEstrategia = (year: number, trimestre: string) => ({
  visao: {
    titulo: "Viver de renda com tranquilidade e seguir empreendendo por escolha",
    horizonte: "10-15a",
    metrica_alvo: "patrimonio",
    valor_alvo: 15000000,
    prazo: null as string | null,
  },
  objetivos: [
    {
      titulo: "Escalar a Nery", tipo: "financeira", metrica: "mrr", alvo: 50000,
      krs: [
        { descricao: "Lançar AgroTorre + fechar ≥2 clientes", tipo: "operacional", trimestre, acoes: [{ descricao: "Iniciar desenvolvimento/lançamento AgroTorre" }] },
        { descricao: "Novos clientes ConstruData (+2)", tipo: "operacional", trimestre, acoes: [{ descricao: "Prospecção ConstruData (listar + abordar leads)" }] },
        { descricao: "Novo cliente IRIS/Circle (+1, ≥2.500)", tipo: "operacional", trimestre, acoes: [{ descricao: "Abordar 1 lead IRIS/Circle" }] },
      ],
    },
    { titulo: "Base pessoal (reserva + 1º aporte)", tipo: "financeira", metrica: "reserva", alvo: 30000, krs: [] },
    { titulo: "Preparar mudança (carro + aluguel)", tipo: "operacional", krs: [] },
  ] as SeedObjetivo[],
  ano: year,
});

// Trimestre "yyyy-Qn" a partir de uma data "yyyy-MM-dd".
export const quarterKey = (isoDate: string): string => {
  const [y, m] = isoDate.split("-").map(Number);
  return `${y}-Q${Math.floor((m - 1) / 3) + 1}`;
};
