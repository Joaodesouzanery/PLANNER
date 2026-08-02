// B2 — Lentes de visualização das Finanças (puro/testável).
// A lente NUNCA altera o dado: é só um filtro de leitura sobre a fonte única.
//   escopo  → PF / PJ / Tudo   (linhas sem escopo definido permanecem sempre visíveis)
//   produto → dimensão (ConstruData, IRIS, Circle, AgroTorre, Nery Jornal, Grupo Nery)
//   cliente → recorte por cliente
export type LensEscopo = "all" | "pf" | "pj";

/** "all" = sem filtro · "none" = só linhas sem classificação · uuid = aquele item. */
export type LensPick = string;

export interface FinanceLens {
  escopo: LensEscopo;
  produtoId: LensPick;
  clienteId: LensPick;
}

export const DEFAULT_LENS: FinanceLens = { escopo: "all", produtoId: "all", clienteId: "all" };

export interface LensRow {
  escopo?: string | null;
  produto_id?: string | null;
  cliente_id?: string | null;
}

const pickMatches = (value: string | null | undefined, pick: LensPick) => {
  if (pick === "all") return true;
  if (pick === "none") return !value;
  return value === pick;
};

/** Escopo: linha sem escopo classificado passa em qualquer lente (não some dado do usuário). */
export const matchLens = (row: LensRow, lens: FinanceLens): boolean => {
  if (lens.escopo !== "all" && row.escopo && row.escopo !== lens.escopo) return false;
  if (!pickMatches(row.produto_id ?? null, lens.produtoId)) return false;
  if (!pickMatches(row.cliente_id ?? null, lens.clienteId)) return false;
  return true;
};

/** true quando a lente está aberta (nenhum recorte ativo) — permite pular o filtro. */
export const isLensOpen = (lens: FinanceLens) =>
  lens.escopo === "all" && lens.produtoId === "all" && lens.clienteId === "all";
