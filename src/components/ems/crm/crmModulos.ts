// Dimensão de MÓDULO do CRM (land & expand). Puro/testável — sem React/Supabase.
// Um módulo é uma cunha dentro de um produto (company): dor/comprador/canal próprios.
import { STAGE_COLOR_OPTIONS, DEFAULT_STAGE_COLOR, slugifyStage } from "./crmStages";

export type ModuloTipo = "aquisicao" | "retencao";

export interface CrmModulo {
  id?: string;
  key: string;
  name: string;
  dor: string | null;
  comprador: string | null;
  canal_forte: string | null;
  tipo: ModuloTipo;
  color: string;
  order_index: number;
}

// Reusa a paleta e o slug das etapas — mesma linguagem visual.
export const MODULO_COLOR_OPTIONS = STAGE_COLOR_OPTIONS;
export const DEFAULT_MODULO_COLOR = DEFAULT_STAGE_COLOR;
export const slugifyModulo = slugifyStage;

export const MODULO_TIPO_LABEL: Record<ModuloTipo, string> = {
  aquisicao: "Aquisição",
  retencao: "Retenção",
};

/** Só os módulos de aquisição entram no funil/expansão; retenção (ex.: Economia) é tratado à parte. */
export const isAquisicao = (m: { tipo: ModuloTipo }) => m.tipo === "aquisicao";
