// Fase 1 — monta a lista "Hoje" cross-cliente a partir das clientViews do useRotinas. Puro/testável.
// Ordem: atrasados → hoje (itens recorrentes + tarefas do dia) → NF vencendo. Contagens por tipo.

export type HojeKind = "overdue" | "task-today" | "item" | "nf";

export interface HojeClientView {
  client: { id: string; name: string; color?: string | null; invoice_day: number | null };
  todayItems: { id: string; title: string; kind: string; client_id: string }[];
  doneItemIds: Set<string>;
  overdueTasks: { id: string; title: string; due_date: string | null }[];
  openTasks: { id: string; title: string; due_date: string | null }[];
  daysUntilInvoice: number | null;
}

export interface HojeRow {
  key: string;
  kind: HojeKind;
  clientId: string;
  clientName: string;
  clientColor?: string | null;
  title: string;
  itemId?: string; // checklist item (marcável)
  taskId?: string;
  days?: number; // atrasado: dias de atraso; nf: dias até vencer
}

export interface HojeResult {
  rows: HojeRow[];
  counts: { atrasado: number; hoje: number; nf: number; total: number };
}

const RANK: Record<HojeKind, number> = { overdue: 0, item: 1, "task-today": 1, nf: 2 };

const daysLate = (dueYmd: string, todayYmd: string) =>
  Math.round((Date.parse(`${todayYmd}T00:00:00Z`) - Date.parse(`${dueYmd}T00:00:00Z`)) / 86_400_000);

export const rotinasHoje = (views: HojeClientView[], today: string, nfLeadDays = 5): HojeResult => {
  const rows: HojeRow[] = [];
  for (const v of views) {
    const base = { clientId: v.client.id, clientName: v.client.name, clientColor: v.client.color ?? null };
    for (const t of v.overdueTasks) {
      rows.push({ ...base, key: `ot:${t.id}`, kind: "overdue", title: t.title, taskId: t.id, days: t.due_date ? daysLate(t.due_date, today) : 0 });
    }
    for (const it of v.todayItems) {
      if (!v.doneItemIds.has(it.id)) rows.push({ ...base, key: `it:${it.id}`, kind: "item", title: it.title, itemId: it.id });
    }
    for (const t of v.openTasks) {
      if (t.due_date === today) rows.push({ ...base, key: `tt:${t.id}`, kind: "task-today", title: t.title, taskId: t.id });
    }
    if (v.daysUntilInvoice != null && v.daysUntilInvoice <= nfLeadDays) {
      rows.push({ ...base, key: `nf:${v.client.id}`, kind: "nf", title: `NF dia ${v.client.invoice_day}`, days: v.daysUntilInvoice });
    }
  }
  rows.sort((a, b) => RANK[a.kind] - RANK[b.kind]);
  return {
    rows,
    counts: {
      atrasado: rows.filter((r) => r.kind === "overdue").length,
      hoje: rows.filter((r) => r.kind === "item" || r.kind === "task-today").length,
      nf: rows.filter((r) => r.kind === "nf").length,
      total: rows.length,
    },
  };
};
