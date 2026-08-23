// Catálogo FIXO de categorias, separado PF (pessoal) × PJ (empresa). Puro/testável.
// A flag `scope` alimenta a DRE (PJ) e o painel de pró-labore (PF); `dreLine` dá a linha
// da DRE por default (o usuário ainda pode sobrescrever). `CATEGORY_ALIASES` colapsa as
// duplicatas de texto livre (Café/Alimentacao/gasolina…) nos totais sem migração de banco.
import type { DreLine } from "./financeDre";

export type CatScope = "PF" | "PJ";
export type CatType = "income" | "expense" | "transfer";
export interface CatDef {
  name: string;
  scope: CatScope;
  type: CatType;
  dreLine?: DreLine;
}

export const FINANCE_CATEGORIES: CatDef[] = [
  // 🏢 Empresa (PJ)
  { name: "Receita — Cliente", scope: "PJ", type: "income", dreLine: "receita" },
  { name: "Impostos", scope: "PJ", type: "expense", dreLine: "deducao" },
  { name: "Infra / COGS", scope: "PJ", type: "expense", dreLine: "custo" },
  { name: "Ferramentas", scope: "PJ", type: "expense", dreLine: "despesa_operacional" },
  { name: "Contador / Fiscal", scope: "PJ", type: "expense", dreLine: "despesa_operacional" },
  { name: "Equipamento", scope: "PJ", type: "expense", dreLine: "depreciacao" },
  { name: "Pró-labore", scope: "PJ", type: "transfer" },
  // 👤 Pessoal (PF)
  { name: "Moradia", scope: "PF", type: "expense" },
  { name: "Alimentação (casa)", scope: "PF", type: "expense" },
  { name: "Lazer / Social", scope: "PF", type: "expense" },
  { name: "Comida fora", scope: "PF", type: "expense" },
  { name: "Transporte", scope: "PF", type: "expense" },
  { name: "Vestuário", scope: "PF", type: "expense" },
  { name: "Saúde / Esporte", scope: "PF", type: "expense" },
  { name: "Assinaturas pessoais", scope: "PF", type: "expense" },
  { name: "Dívidas", scope: "PF", type: "expense" },
  { name: "Educação", scope: "PF", type: "expense" },
  { name: "Doações", scope: "PF", type: "expense" },
  { name: "Investimento / Reserva", scope: "PF", type: "transfer" },
  // Âncora de abertura de saldo (importação da planilha). É "transfer" de propósito: dinheiro que
  // já existia não é receita — como receita, inflaria a receita bruta e a estimativa de imposto.
  { name: "Saldo inicial", scope: "PF", type: "transfer" },
  { name: "Outros", scope: "PF", type: "expense" },
];

export const CATEGORIES_PJ = FINANCE_CATEGORIES.filter((c) => c.scope === "PJ");
export const CATEGORIES_PF = FINANCE_CATEGORIES.filter((c) => c.scope === "PF");

/** normaliza p/ casar duplicatas: minúsculo, sem acento, espaços colapsados. */
const norm = (s: string) =>
  s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().trim().replace(/\s+/g, " ");

// chave = forma normalizada da categoria antiga → nome canônico do catálogo.
export const CATEGORY_ALIASES: Record<string, string> = {
  // Comida fora
  cafe: "Comida fora", lanche: "Comida fora", restaurante: "Comida fora", mcdonalds: "Comida fora",
  bk: "Comida fora", "burger king": "Comida fora", ifood: "Comida fora", delivery: "Comida fora",
  // Alimentação (casa)
  alimentacao: "Alimentação (casa)", mercado: "Alimentação (casa)", supermercado: "Alimentação (casa)", comida: "Alimentação (casa)",
  // Transporte
  gasolina: "Transporte", combustivel: "Transporte", uber: "Transporte", "99": "Transporte", onibus: "Transporte", estacionamento: "Transporte",
  // Saúde / Esporte
  esporte: "Saúde / Esporte", academia: "Saúde / Esporte", "cerrado mma": "Saúde / Esporte", suplemento: "Saúde / Esporte", farmacia: "Saúde / Esporte", saude: "Saúde / Esporte",
  // Lazer / Social
  lazer: "Lazer / Social", bar: "Lazer / Social", balada: "Lazer / Social", cinema: "Lazer / Social", social: "Lazer / Social", outback: "Lazer / Social",
  // Formas SEM espaço na barra (como saem da planilha) — `norm` não mexe em "/", então
  // "lazer/social" não casava com o catálogo "lazer / social" e virava categoria legada.
  "lazer/social": "Lazer / Social", "saude/esporte": "Saúde / Esporte", "alimentacao (casa)": "Alimentação (casa)",
  // Receita genérica da planilha → categoria de receita do catálogo (dreLine: receita).
  receita: "Receita — Cliente", "receita cliente": "Receita — Cliente",
  doacao: "Doações", doacoes: "Doações",
  // Vestuário
  roupa: "Vestuário", sapato: "Vestuário", vestuario: "Vestuário",
  // Moradia
  aluguel: "Moradia", moradia: "Moradia", condominio: "Moradia", luz: "Moradia", agua: "Moradia",
  // Assinaturas
  streaming: "Assinaturas pessoais", netflix: "Assinaturas pessoais", spotify: "Assinaturas pessoais", assinatura: "Assinaturas pessoais", assinaturas: "Assinaturas pessoais",
  // Educação
  curso: "Educação", livro: "Educação", livros: "Educação", educacao: "Educação",
  // Dívidas
  divida: "Dívidas", dividas: "Dívidas", nubank: "Dívidas", itau: "Dívidas", brb: "Dívidas", cartao: "Dívidas",
  // Investimento / Reserva
  investimento: "Investimento / Reserva", reserva: "Investimento / Reserva", aporte: "Investimento / Reserva", cdb: "Investimento / Reserva",
  // Pró-labore
  "pro-labore": "Pró-labore", "pro labore": "Pró-labore", prolabore: "Pró-labore",
  "saldo inicial": "Saldo inicial", "saldo de abertura": "Saldo inicial",
  // Empresa
  infra: "Infra / COGS", supabase: "Infra / COGS", api: "Infra / COGS", gateway: "Infra / COGS",
  ferramenta: "Ferramentas", ferramentas: "Ferramentas", claude: "Ferramentas", internet: "Ferramentas", dominio: "Ferramentas",
  contador: "Contador / Fiscal", contabilidade: "Contador / Fiscal", mei: "Contador / Fiscal",
  // Imposto tem categoria PRÓPRIA com dreLine "deducao" — antes dependia da heurística \bdas\b
  // e, se a categoria viesse como outra coisa (ex.: "Operacional (PJ)"), o DAS caía em despesa
  // operacional e a dedução da DRE ficava subestimada.
  das: "Impostos", imposto: "Impostos", impostos: "Impostos", "simples nacional": "Impostos",
  "das / imposto simples": "Impostos", inss: "Impostos", iss: "Impostos", tributo: "Impostos", tributos: "Impostos",
  equipamento: "Equipamento", macbook: "Equipamento", notebook: "Equipamento",
};

const CATALOG_BY_NORM = new Map(FINANCE_CATEGORIES.map((c) => [norm(c.name), c.name]));
const CATALOG_BY_NAME = new Map(FINANCE_CATEGORIES.map((c) => [c.name, c] as const));

/** Nome canônico: catálogo (por forma normalizada) → alias → o original (legado passa reto). */
export const canonicalCategory = (raw: string | null | undefined): string | null => {
  if (!raw) return null; // null/undefined/"" → null (callers fazem `|| "Sem categoria"`)
  const n = norm(raw);
  return CATALOG_BY_NORM.get(n) ?? CATEGORY_ALIASES[n] ?? raw;
};

/** Definição do catálogo para uma categoria (após canonizar), ou undefined se legado/desconhecida. */
export const categoryDef = (name: string | null | undefined): CatDef | undefined => {
  const canon = canonicalCategory(name);
  return canon ? CATALOG_BY_NAME.get(canon) : undefined;
};

/** Escopo PF/PJ da categoria, ou null se não está no catálogo (legado). */
export const categoryScope = (name: string | null | undefined): CatScope | null => categoryDef(name)?.scope ?? null;

/** Linha da DRE sugerida pelo catálogo (só p/ categorias conhecidas). */
export const catalogDreLine = (name: string | null | undefined): DreLine | undefined => categoryDef(name)?.dreLine;

/** Transferência = dinheiro mudando de lugar (pró-labore, aporte na reserva, saldo de abertura). */
export const isTransferCategory = (name: string | null | undefined): boolean => categoryDef(name)?.type === "transfer";

export const CATEGORIA_SALDO_INICIAL = "Saldo inicial";

/**
 * Âncora de abertura de saldo criada pela importação da planilha. Ela existe só para o saldo
 * derivado do razão bater com o declarado — não é receita, não é despesa e não pode entrar em
 * NENHUM número de resultado (receita do mês, gráficos, base de imposto, alertas).
 */
export const isSaldoInicial = (name: string | null | undefined): boolean =>
  canonicalCategory(name) === CATEGORIA_SALDO_INICIAL;
