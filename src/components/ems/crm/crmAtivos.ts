// Matriz de ativos de conteúdo — tipos + motor de conversão. Puro/testável (sem React/Supabase).
// Métrica de DECISÃO = leads_gerados (passo adiante); impressions/views/opens = diagnóstico.

export type AtivoTipo = "pdf" | "vsl" | "video" | "post";

export interface CrmAtivo {
  id?: string;
  modulo_id: string | null; // NULL = guarda-chuva (nível empresa)
  tipo: AtivoTipo;
  titulo: string;
  angulo_de_dor: string | null;
  variante_de_copy: string | null;
  canal: string | null;
  data: string | null;
  leads_gerados: number;
  impressions: number | null;
  views: number | null;
  opens: number | null;
  notes: string | null;
}

export const ATIVO_TIPO_LABEL: Record<AtivoTipo, string> = { pdf: "PDF", vsl: "VSL", video: "Vídeo", post: "Post" };
export const ATIVO_TIPOS: AtivoTipo[] = ["post", "video", "pdf", "vsl"];

export interface GroupStat {
  key: string;
  label: string;
  ativos: number;
  leads: number;
}
export interface AtivosMetrics {
  totalAtivos: number;
  totalLeads: number;
  porAngulo: GroupStat[];
  porCopy: GroupStat[];
  porModulo: GroupStat[]; // key = modulo_id (ou "sem" p/ guarda-chuva); label resolvido na UI
  porTipo: GroupStat[];
  bestAngulo: GroupStat | null;
  bestCopy: GroupStat | null;
}

const groupBy = (
  ativos: CrmAtivo[],
  keyFn: (a: CrmAtivo) => string | null,
  labelFn: (key: string, a: CrmAtivo) => string,
): GroupStat[] => {
  const map = new Map<string, { leads: number; ativos: number; label: string }>();
  for (const a of ativos) {
    const k = keyFn(a);
    if (k == null || k === "") continue; // dimensão vazia não entra
    const cur = map.get(k);
    const leads = Number(a.leads_gerados) || 0;
    if (cur) { cur.leads += leads; cur.ativos += 1; }
    else map.set(k, { leads, ativos: 1, label: labelFn(k, a) });
  }
  return [...map.entries()]
    .map(([key, v]) => ({ key, label: v.label, leads: v.leads, ativos: v.ativos }))
    .sort((a, b) => b.leads - a.leads || b.ativos - a.ativos);
};

/** Agrega conversão (leads) por ângulo de dor, variante de copy, módulo e tipo. Opcionalmente filtra por módulo. */
export const computeAtivosMetrics = (ativos: CrmAtivo[], moduloId?: string | null): AtivosMetrics => {
  const rows = moduloId ? ativos.filter((a) => a.modulo_id === moduloId) : ativos;
  const porAngulo = groupBy(rows, (a) => a.angulo_de_dor, (k) => k);
  const porCopy = groupBy(rows, (a) => a.variante_de_copy, (k) => k);
  const porModulo = groupBy(rows, (a) => a.modulo_id ?? "sem", (k) => k);
  const porTipo = groupBy(rows, (a) => a.tipo, (k) => ATIVO_TIPO_LABEL[k as AtivoTipo] || k);
  return {
    totalAtivos: rows.length,
    totalLeads: rows.reduce((s, a) => s + (Number(a.leads_gerados) || 0), 0),
    porAngulo,
    porCopy,
    porModulo,
    porTipo,
    bestAngulo: porAngulo[0] ?? null,
    bestCopy: porCopy[0] ?? null,
  };
};
