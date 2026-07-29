// Motor de cadências/atividades (followup). Puro/testável — sem React/Supabase.
// Aplicar uma cadência a um deal gera atividades com data_prevista = hoje + dia_offset de cada passo.

const DAY = 86_400_000;
const addDaysIso = (todayIso: string, days: number): string =>
  new Date(Date.parse(`${todayIso.slice(0, 10)}T00:00:00Z`) + days * DAY).toISOString().slice(0, 10);

export type Canal = "whatsapp" | "ligacao" | "email" | "reuniao" | "nota";
export type CadenciaTipo = "inbound" | "outbound_frio" | "expansao" | "reativacao";

export interface CadenciaPasso {
  passo_n: number;
  canal: string;
  dia_offset: number;
  modelo_mensagem?: string | null;
}
export interface AtividadeSeed {
  deal_id: string;
  tipo: string;
  data_prevista: string;
  cadencia_id: string;
  passo_n: number;
  status: "pendente";
}

/** Gera as atividades futuras a partir dos passos da cadência (data_prevista = hoje + dia_offset). */
export const gerarAtividades = (
  dealId: string,
  cadenciaId: string,
  passos: CadenciaPasso[],
  todayIso: string,
): AtividadeSeed[] =>
  [...passos]
    .sort((a, b) => a.passo_n - b.passo_n)
    .map((p) => ({
      deal_id: dealId,
      tipo: p.canal,
      cadencia_id: cadenciaId,
      passo_n: p.passo_n,
      data_prevista: addDaysIso(todayIso, Math.max(0, p.dia_offset)),
      status: "pendente" as const,
    }));

export interface AtividadeLite {
  data_prevista: string | null;
  status: string;
}
/** Está na fila do dia? pendente + data_prevista <= hoje. */
export const isFilaDoDia = (a: AtividadeLite, todayIso: string): boolean =>
  a.status === "pendente" && !!a.data_prevista && a.data_prevista <= todayIso.slice(0, 10);

export const CADENCIA_TIPO_LABEL: Record<CadenciaTipo, string> = {
  inbound: "Inbound (morno)",
  outbound_frio: "Outbound frio",
  expansao: "Expansão",
  reativacao: "Reativação",
};
export const CANAL_LABEL: Record<Canal, string> = {
  whatsapp: "WhatsApp", ligacao: "Ligação", email: "E-mail", reuniao: "Reunião", nota: "Nota",
};
export const CANAIS: Canal[] = ["whatsapp", "ligacao", "email", "reuniao", "nota"];
