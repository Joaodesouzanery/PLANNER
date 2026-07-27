// Funil de vendas DB-backed: etapas (colunas) do kanban de deals. Puro/testável — sem React/Supabase.
// project_opportunities.stage guarda a `key`. O padrão são as 7 etapas do documento + 2 estados fora
// da esteira (Perdido / Em nutrição), como a especificação do funil pede.

export interface CrmStage {
  id?: string; // id do banco (ausente no template padrão não-persistido)
  key: string; // slug estável gravado em project_opportunities.stage
  title: string;
  order_index: number;
  color: string; // classes tailwind do gradiente (ex.: "from-blue-500/15 border-blue-500/30")
  outcome: "won" | "lost" | null;
  is_offtrack: boolean; // Perdido / Em nutrição — fora da esteira principal
}

// Motivos de perda estruturados (dropdown obrigatório ao mover o deal pra uma etapa "perdido").
export const LOSS_REASONS = ["Preço", "Timing", "Sem dor", "Sem orçamento", "Concorrente", "Sumiu", "Outro"];

export const STAGE_COLOR_OPTIONS: { key: string; label: string; cls: string }[] = [
  { key: "slate", label: "Ardósia", cls: "from-slate-500/15 border-slate-500/30" },
  { key: "blue", label: "Azul", cls: "from-blue-500/15 border-blue-500/30" },
  { key: "cyan", label: "Ciano", cls: "from-cyan-500/15 border-cyan-500/30" },
  { key: "teal", label: "Teal", cls: "from-teal-500/15 border-teal-500/30" },
  { key: "amber", label: "Âmbar", cls: "from-amber-500/15 border-amber-500/30" },
  { key: "purple", label: "Roxo", cls: "from-purple-500/15 border-purple-500/30" },
  { key: "emerald", label: "Verde", cls: "from-emerald-500/15 border-emerald-500/30" },
  { key: "red", label: "Vermelho", cls: "from-red-500/15 border-red-500/30" },
  { key: "zinc", label: "Cinza", cls: "from-zinc-500/15 border-zinc-500/30" },
];
export const DEFAULT_STAGE_COLOR = STAGE_COLOR_OPTIONS[1].cls;

// Funil padrão = as 7 etapas do documento + 2 estados fora da esteira (Perdido / Em nutrição).
export const DEFAULT_STAGES: CrmStage[] = [
  { key: "lista", title: "Lista", order_index: 0, color: "from-slate-500/15 border-slate-500/30", outcome: null, is_offtrack: false },
  { key: "enriquecido", title: "Enriquecido", order_index: 1, color: "from-blue-500/15 border-blue-500/30", outcome: null, is_offtrack: false },
  { key: "abordado", title: "Abordado", order_index: 2, color: "from-cyan-500/15 border-cyan-500/30", outcome: null, is_offtrack: false },
  { key: "documento", title: "Documento", order_index: 3, color: "from-teal-500/15 border-teal-500/30", outcome: null, is_offtrack: false },
  { key: "qualificado", title: "Qualificado", order_index: 4, color: "from-amber-500/15 border-amber-500/30", outcome: null, is_offtrack: false },
  { key: "fechamento", title: "Fechamento", order_index: 5, color: "from-purple-500/15 border-purple-500/30", outcome: null, is_offtrack: false },
  { key: "cliente", title: "Cliente", order_index: 6, color: "from-emerald-500/15 border-emerald-500/30", outcome: "won", is_offtrack: false },
  { key: "perdido", title: "Perdido", order_index: 7, color: "from-red-500/15 border-red-500/30", outcome: "lost", is_offtrack: true },
  { key: "nutricao", title: "Em nutrição", order_index: 8, color: "from-zinc-500/15 border-zinc-500/30", outcome: null, is_offtrack: true },
];

// Vocabulário legado do DealKanban antigo (nova/qualificacao/proposta/negociacao/ganha/perdida) → novas keys.
export const LEGACY_STAGE_MAP: Record<string, string> = {
  nova: "lista",
  qualificacao: "qualificado",
  proposta: "fechamento",
  negociacao: "fechamento",
  ganha: "cliente",
  ganho: "cliente",
  perdida: "perdido",
  perdido: "perdido",
  nutricao: "nutricao",
};

/** Resolve o stage bruto de um deal para uma `key` que EXISTE na lista de etapas atual — nada fica órfão. */
export const resolveStageKey = (raw: string | null | undefined, stages: CrmStage[]): string => {
  const keys = new Set(stages.map((s) => s.key));
  const x = (raw || "").toLowerCase().trim();
  if (keys.has(x)) return x;
  const mapped = LEGACY_STAGE_MAP[x];
  if (mapped && keys.has(mapped)) return mapped;
  const firstOnTrack = stages.find((s) => !s.is_offtrack) ?? stages[0];
  return firstOnTrack?.key ?? x;
};

/** Slug ASCII estável para a key de uma etapa criada pelo usuário. */
export const slugifyStage = (title: string): string =>
  (title || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40) || "etapa";
