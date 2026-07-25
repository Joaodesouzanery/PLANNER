// CRM · Campaign Management — resolução de segmento, funil de performance e demografia. Puro/testável.
// Adapta o pilar "Campaign Management" das telas de referência: segmentos dinâmicos contra o spine,
// funil enviados→abertos→responderam→converteram e composição por segmento/tier.

export interface SegmentFilter {
  health?: string[];
  stage?: string[];
  tier?: string[];
  segment?: string[];
  recorrente?: boolean;
  minMrr?: number;
}

export interface SegCustomer {
  id: string;
  health?: string | null;
  stage?: string | null;
  tier?: string | null;
  segment?: string | null;
  recorrente: boolean;
  ongoing: number;
}

const inFilter = (val: string | null | undefined, arr?: string[]) => !arr || arr.length === 0 || arr.includes(val || "");

/** Resolve um segmento: devolve os ids dos clientes que batem com TODOS os filtros presentes. */
export const resolveSegment = (customers: SegCustomer[], f: SegmentFilter): string[] =>
  customers
    .filter((c) =>
      inFilter(c.health, f.health) &&
      inFilter(c.stage, f.stage) &&
      inFilter(c.tier, f.tier) &&
      inFilter(c.segment, f.segment) &&
      (f.recorrente == null || c.recorrente === f.recorrente) &&
      (f.minMrr == null || c.ongoing >= f.minMrr),
    )
    .map((c) => c.id);

export interface RecipientLite {
  offer_status: string; // pending|sent|opened|responded|converted
  predicted_revenue?: number | null;
}

export interface CampaignPerformance {
  total: number;
  enviados: number;
  abertos: number;
  responderam: number;
  converteram: number;
  taxaResposta: number;    // responderam / enviados
  taxaConversao: number;   // converteram / enviados
  receitaProjetada: number; // Σ predicted_revenue de todos
  receitaRealizada: number; // Σ predicted_revenue dos convertidos
  porStatus: Record<string, number>;
}

const SENT = new Set(["sent", "opened", "responded", "converted"]);
const OPENED = new Set(["opened", "responded", "converted"]);
const RESPONDED = new Set(["responded", "converted"]);

/** Funil de performance da campanha a partir dos recipients. */
export const campaignPerformance = (recipients: RecipientLite[]): CampaignPerformance => {
  const porStatus: Record<string, number> = { pending: 0, sent: 0, opened: 0, responded: 0, converted: 0 };
  let enviados = 0, abertos = 0, responderam = 0, converteram = 0, receitaProjetada = 0, receitaRealizada = 0;
  for (const r of recipients) {
    const s = (r.offer_status || "pending").toLowerCase();
    porStatus[s] = (porStatus[s] ?? 0) + 1;
    const pred = Number(r.predicted_revenue) || 0;
    receitaProjetada += pred;
    if (SENT.has(s)) enviados++;
    if (OPENED.has(s)) abertos++;
    if (RESPONDED.has(s)) responderam++;
    if (s === "converted") { converteram++; receitaRealizada += pred; }
  }
  return {
    total: recipients.length,
    enviados, abertos, responderam, converteram,
    taxaResposta: enviados > 0 ? responderam / enviados : 0,
    taxaConversao: enviados > 0 ? converteram / enviados : 0,
    receitaProjetada, receitaRealizada,
    porStatus,
  };
};

/** Contagem por chave (demografia): [{label,value}] desc. Ignora vazios como "—". */
export const groupCount = <T>(items: T[], keyOf: (t: T) => string | null | undefined): { label: string; value: number }[] => {
  const m = new Map<string, number>();
  for (const it of items) {
    const k = (keyOf(it) || "—").toString();
    m.set(k, (m.get(k) ?? 0) + 1);
  }
  return [...m.entries()].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);
};

export const STATUS_LABEL: Record<string, string> = {
  pending: "A enviar", sent: "Enviado", opened: "Aberto", responded: "Respondeu", converted: "Converteu",
};
export const CHANNEL_LABEL: Record<string, string> = {
  email: "E-mail", whatsapp: "WhatsApp", call: "Ligação", linkedin: "LinkedIn",
};
export const CAMPAIGN_STATUS_LABEL: Record<string, string> = {
  draft: "Rascunho", active: "Ativa", paused: "Pausada", done: "Concluída",
};
