// Templates de módulos por PRODUTO — semeia o catálogo de módulos em vez de criar um a um.
// ConstruData vem preenchido da tabela dos docs; os outros produtos como starters mínimos.
import type { CrmModulo, ModuloTipo } from "./crmModulos";

type Def = [key: string, name: string, dor: string, comprador: string, canal: string, tipo?: ModuloTipo, color?: string];

const C = {
  slate: "from-slate-500/15 border-slate-500/30",
  blue: "from-blue-500/15 border-blue-500/30",
  cyan: "from-cyan-500/15 border-cyan-500/30",
  teal: "from-teal-500/15 border-teal-500/30",
  amber: "from-amber-500/15 border-amber-500/30",
  purple: "from-purple-500/15 border-purple-500/30",
  emerald: "from-emerald-500/15 border-emerald-500/30",
  zinc: "from-zinc-500/15 border-zinc-500/30",
};
const PALETTE = [C.blue, C.cyan, C.teal, C.amber, C.purple, C.emerald, C.slate];

const mk = (defs: Def[]): CrmModulo[] =>
  defs.map(([key, name, dor, comprador, canal, tipo = "aquisicao", color], i) => ({
    key,
    name,
    dor,
    comprador,
    canal_forte: canal,
    tipo,
    color: color || PALETTE[i % PALETTE.length],
    order_index: i,
  }));

export interface ModuloTemplate {
  key: string;
  name: string; // nome do produto
  hints: string[]; // casa com o nome da company
  modulos: CrmModulo[];
}

export const MODULO_TEMPLATES: ModuloTemplate[] = [
  {
    key: "construdata",
    name: "ConstruData",
    hints: ["construdata", "constru", "obra", "construção", "construcao"],
    modulos: mk([
      ["rdo", "Diário de Obra (RDO)", "Não sei o que foi feito no campo", "Engenheiro / mestre de obra", "Outbound + conteúdo"],
      ["medicao", "Medição", "Glosa de medição, medição não defensável", "Diretor / financeiro da construtora", "Outbound"],
      ["equipamentos", "Equipamentos", "Controle de máquinas, custo de equipamento", "Almoxarife / diretor de operações", "Conteúdo + outbound"],
      ["financeiro", "Financeiro", "Custo de obra estourando", "Diretor financeiro", "Outbound"],
      ["manutencao-predial", "Manutenção Predial", "Prédio sem manutenção rastreável", "Síndico / administradora de condomínio", "Scraping de prédios"],
      ["economia", "Economia (Extrato)", "Não é venda — é retenção", "Cliente já ativo", "Interno (mensal)", "retencao", C.zinc],
    ]),
  },
  {
    key: "agrotorre",
    name: "AgroTorre",
    hints: ["agrotorre", "agro", "torre", "fazenda", "safra"],
    modulos: mk([
      ["romaneio", "Romaneio", "Dado de WhatsApp vira dado estruturado", "Produtor / gerente de fazenda", "Conteúdo (ICP difícil de listar)"],
    ]),
  },
  {
    key: "regulacao",
    name: "Regulação (Observatório)",
    hints: ["regulacao", "regulação", "observatorio", "observatório", "iris", "circle"],
    modulos: mk([
      ["observatorio", "Observatório da Regulação", "Acompanhar mudanças regulatórias sem garimpar", "Jurídico / compliance / relações institucionais", "Conteúdo"],
    ]),
  },
  {
    key: "jornalismo",
    name: "Jornalismo",
    hints: ["jornalismo", "jornal", "midia", "mídia", "imprensa"],
    modulos: mk([
      ["cobertura", "Cobertura", "A definir — 1 cliente hoje", "A definir", "A definir"],
    ]),
  },
];

export const suggestModuloTemplate = (companyName?: string | null): ModuloTemplate | null => {
  const n = (companyName || "").toLowerCase().trim();
  if (!n) return null;
  return MODULO_TEMPLATES.find((t) => t.hints.some((h) => n.includes(h) || h.includes(n))) ?? null;
};
