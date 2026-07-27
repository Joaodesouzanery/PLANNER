// Templates de quadro (funil) por segmento — gera um kanban inicial padronizado em vez de criar etapa
// a etapa. Puro/testável. Cada template = um conjunto de crm_stages (keys estáveis + Perdido/Nutrição).
import { DEFAULT_STAGES, type CrmStage } from "./crmStages";

type StageDef = [key: string, title: string, color: string, outcome?: "won" | "lost" | null, offtrack?: boolean];

const mk = (defs: StageDef[]): CrmStage[] =>
  defs.map(([key, title, color, outcome = null, is_offtrack = false], i) => ({
    key, title, color, outcome, is_offtrack, order_index: i,
  }));

// Cores (mesmas classes do STAGE_COLOR_OPTIONS).
const C = {
  slate: "from-slate-500/15 border-slate-500/30",
  blue: "from-blue-500/15 border-blue-500/30",
  cyan: "from-cyan-500/15 border-cyan-500/30",
  teal: "from-teal-500/15 border-teal-500/30",
  amber: "from-amber-500/15 border-amber-500/30",
  purple: "from-purple-500/15 border-purple-500/30",
  emerald: "from-emerald-500/15 border-emerald-500/30",
  red: "from-red-500/15 border-red-500/30",
  zinc: "from-zinc-500/15 border-zinc-500/30",
};

const PERDIDO: StageDef = ["perdido", "Perdido", C.red, "lost", true];
const NUTRICAO: StageDef = ["nutricao", "Em nutrição", C.zinc, null, true];

export interface StageTemplate {
  key: string;
  name: string;
  description: string;
  segmentHints: string[]; // valores de finance_clientes.segment que sugerem este template
  stages: CrmStage[];
}

export const STAGE_TEMPLATES: StageTemplate[] = [
  {
    key: "funil-7",
    name: "Funil de vendas (7 etapas)",
    description: "O padrão do documento: Lista → Cliente + Perdido/Nutrição fora da esteira.",
    segmentHints: [],
    stages: DEFAULT_STAGES,
  },
  {
    key: "consultoria",
    name: "Consultoria",
    description: "Venda consultiva: diagnóstico e proposta antes do fechamento.",
    segmentHints: ["consultoria", "consulting", "servicos", "serviços"],
    stages: mk([
      ["lista", "Lista", C.slate],
      ["abordado", "Abordado", C.blue],
      ["diagnostico", "Diagnóstico", C.cyan],
      ["proposta", "Proposta", C.amber],
      ["fechamento", "Fechamento", C.purple],
      ["onboarding", "Onboarding", C.teal],
      ["cliente", "Cliente", C.emerald, "won"],
      PERDIDO,
      NUTRICAO,
    ]),
  },
  {
    key: "saas",
    name: "SaaS / Assinatura",
    description: "Trial → ativação → expansão, com foco em conversão de conta.",
    segmentHints: ["saas", "assinatura", "software", "subscription"],
    stages: mk([
      ["lead", "Lead", C.slate],
      ["ativado", "Ativado (trial)", C.blue],
      ["qualificado", "Qualificado", C.cyan],
      ["demo", "Demo", C.teal],
      ["proposta", "Proposta", C.amber],
      ["fechamento", "Fechamento", C.purple],
      ["cliente", "Cliente", C.emerald, "won"],
      PERDIDO,
      NUTRICAO,
    ]),
  },
  {
    key: "agro-obra",
    name: "Agro / Obra",
    description: "Sinal (obra/licitação) → visita → documento de 1 página → obra.",
    segmentHints: ["agro", "obra", "construcao", "construção", "saneamento", "engenharia"],
    stages: mk([
      ["lista", "Lista", C.slate],
      ["sinal", "Sinal / Visita", C.blue],
      ["documento", "Documento (1 pág)", C.teal],
      ["qualificado", "Qualificado", C.cyan],
      ["proposta", "Proposta", C.amber],
      ["fechamento", "Fechamento", C.purple],
      ["obra", "Obra / Onboarding", C.emerald, "won"],
      PERDIDO,
      NUTRICAO,
    ]),
  },
  {
    key: "generico",
    name: "Genérico (enxuto)",
    description: "5 colunas simples pra começar rápido.",
    segmentHints: [],
    stages: mk([
      ["novo", "Novo", C.slate],
      ["contato", "Contato", C.blue],
      ["followup", "Followup", C.amber],
      ["proposta", "Proposta", C.purple],
      ["fechado", "Fechado", C.emerald, "won"],
      PERDIDO,
    ]),
  },
];

export const DEFAULT_TEMPLATE_KEY = "funil-7";

/** Sugere um template a partir do segmento dominante da carteira (finance_clientes.segment). */
export const suggestTemplate = (segment?: string | null): StageTemplate => {
  const seg = (segment || "").toLowerCase().trim();
  if (seg) {
    const hit = STAGE_TEMPLATES.find((t) => t.segmentHints.some((h) => seg.includes(h) || h.includes(seg)));
    if (hit) return hit;
  }
  return STAGE_TEMPLATES.find((t) => t.key === DEFAULT_TEMPLATE_KEY) ?? STAGE_TEMPLATES[0];
};
