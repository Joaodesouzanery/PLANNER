// Fase 2 — Central de Atenção do Conselho. Motor puro: recebe inputs já buscados por módulo
// e devolve UMA fila ranqueada (reds primeiro), clicável, dedup. Não busca/persiste nada.

export type Sev = "red" | "yellow" | "low";
export type Modulo = "financas" | "obrigacoes" | "riscos" | "documentos" | "tarefas" | "projetos" | "rotinas" | "comercial" | "inbox" | "capacidade";

export interface AttentionItem {
  id: string;
  modulo: Modulo;
  severidade: Sev;
  titulo: string;
  data?: string | null;
  deeplink: string;
}

export interface AttentionInputs {
  financeAlerts?: { key: string; severity: "high" | "medium" | "low"; message: string; date?: string | null }[];
  obrigacoes?: { id: string; titulo: string; dueDate: string; overdue: boolean }[];
  riscos?: { id: string; titulo: string; score: number; semRevisao: boolean }[];
  documentos?: { id: string; titulo: string; expiraEmDias: number }[];
  tarefas?: { id: string; titulo: string; atrasadaDias: number }[];
  projetos?: { id: string; titulo: string; atrasadoDias: number }[];
  rotinas?: { atrasado: number; hoje: number; nf: number };
  comercial?: { id: string; titulo: string; paradoDias: number }[];
  inboxBacklog?: number;
  capacidade?: { id: string; nome: string; sobrecarga: boolean }[];
}

const RANK: Record<Sev, number> = { red: 0, yellow: 1, low: 2 };
const finSev = (s: "high" | "medium" | "low"): Sev => (s === "high" ? "red" : s === "medium" ? "yellow" : "low");

export const buildBoardAttention = (i: AttentionInputs): AttentionItem[] => {
  const out: AttentionItem[] = [];

  for (const a of i.financeAlerts ?? [])
    out.push({ id: `fin:${a.key}`, modulo: "financas", severidade: finSev(a.severity), titulo: a.message, data: a.date ?? null, deeplink: "/ems/finance" });

  for (const o of i.obrigacoes ?? [])
    out.push({ id: `obr:${o.id}`, modulo: "obrigacoes", severidade: o.overdue ? "red" : "yellow", titulo: `Obrigação: ${o.titulo}`, data: o.dueDate, deeplink: "/ems/conselho?tab=obligations" });

  for (const r of i.riscos ?? [])
    out.push({ id: `ris:${r.id}`, modulo: "riscos", severidade: r.semRevisao ? "red" : "yellow", titulo: `Risco crítico: ${r.titulo}`, deeplink: "/ems/conselho?tab=risks" });

  for (const d of i.documentos ?? [])
    out.push({ id: `doc:${d.id}`, modulo: "documentos", severidade: d.expiraEmDias <= 7 ? "red" : d.expiraEmDias <= 15 ? "yellow" : "low", titulo: `Documento vence em ${d.expiraEmDias}d: ${d.titulo}`, deeplink: "/ems/conselho?tab=documents" });

  for (const t of i.tarefas ?? [])
    out.push({ id: `tsk:${t.id}`, modulo: "tarefas", severidade: t.atrasadaDias > 7 ? "red" : "yellow", titulo: `Tarefa atrasada (${t.atrasadaDias}d): ${t.titulo}`, deeplink: "/ems/projects" });

  for (const p of i.projetos ?? [])
    out.push({ id: `prj:${p.id}`, modulo: "projetos", severidade: p.atrasadoDias > 7 ? "red" : "yellow", titulo: `Projeto atrasado (${p.atrasadoDias}d): ${p.titulo}`, deeplink: "/ems/projects" });

  const rot = i.rotinas;
  if (rot) {
    if (rot.atrasado > 0) out.push({ id: "rot:atrasado", modulo: "rotinas", severidade: "red", titulo: `${rot.atrasado} rotina(s)/tarefa(s) atrasada(s)`, deeplink: "/ems/conselho?tab=rotinas" });
    if (rot.hoje > 0) out.push({ id: "rot:hoje", modulo: "rotinas", severidade: "yellow", titulo: `${rot.hoje} rotina(s) para hoje`, deeplink: "/ems/conselho?tab=rotinas" });
    if (rot.nf > 0) out.push({ id: "rot:nf", modulo: "rotinas", severidade: "low", titulo: `${rot.nf} NF vencendo`, deeplink: "/ems/conselho?tab=rotinas" });
  }

  for (const c of i.comercial ?? [])
    out.push({ id: `com:${c.id}`, modulo: "comercial", severidade: c.paradoDias > 21 ? "red" : "yellow", titulo: `Lead parado ${c.paradoDias}d: ${c.titulo}`, deeplink: "/ems/commercial" });

  if (i.inboxBacklog && i.inboxBacklog > 0)
    out.push({ id: "inbox:backlog", modulo: "inbox", severidade: i.inboxBacklog >= 10 ? "red" : "yellow", titulo: `${i.inboxBacklog} item(ns) sem tratar no inbox`, deeplink: "/ems/inbox" });

  for (const p of i.capacidade ?? [])
    if (p.sobrecarga) out.push({ id: `cap:${p.id}`, modulo: "capacidade", severidade: "yellow", titulo: `Capacidade: ${p.nome} sobrecarregado(a)`, deeplink: "/ems/conselho" });

  // Dedup por id + ordena por severidade (reds primeiro).
  const seen = new Set<string>();
  return out.filter((a) => (seen.has(a.id) ? false : (seen.add(a.id), true))).sort((a, b) => RANK[a.severidade] - RANK[b.severidade]);
};

/** Contagem por severidade (p/ o badge do sino). */
export const attentionCounts = (items: AttentionItem[]) => ({
  red: items.filter((i) => i.severidade === "red").length,
  yellow: items.filter((i) => i.severidade === "yellow").length,
  total: items.length,
});
