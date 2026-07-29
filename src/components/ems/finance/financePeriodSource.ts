// Universo canônico do fluxo (realizado + previsto), com dedup por (origem,data,tipo). Puro/testável.
// Extraído de useFinanceData.ts p/ poder ser testado sem carregar React/Supabase.

export interface PeriodRow {
  id: string;
  date: string;
  type: "income" | "expense";
  amount: number;
  category: string | null;
  description: string;
  sourceId: string | null;
  accountId: string | null;
  sourceType: string;
  paid: boolean; // Recebido/Pago (o dinheiro moveu) = REAL
  realized: boolean; // já aconteceu (não-planejado & data passou) = base do saldo inicial (carry)
  projected: boolean; // não é linha realizada (previsto)
  synthetic: boolean; // ocorrência de recorrência (sem linha no banco)
}

/** Data efetiva de um lançamento (vencimento quando houver), p/ agrupar por mês de forma consistente. */
export const effectiveDate = (t: { date: string; due_date?: string | null }) => String(t.due_date || t.date).slice(0, 10);

/** "Realizado" = já aconteceu: não é planejado E a data efetiva já chegou. */
export const isRealized = (
  t: { status?: string | null; date: string; due_date?: string | null },
  today: string = new Date().toISOString().slice(0, 10),
) => t.status !== "planned" && effectiveDate(t) <= today;

/** Id sintético = ocorrência gerada de recorrência (…-future-N ou …-rN). */
export const isSyntheticId = (id: string) => id.includes("-future-") || /-r\d+$/.test(id);

/**
 * Universo unificado do fluxo: realizado (dashboardTransactions) + previsto (allEvents).
 * `paid` = Recebido/Pago (dinheiro moveu → conta como REAL). `realized` = já aconteceu
 * (base do saldo inicial / carry). `projected` = previsto. Dedup por (origem,data,tipo)
 * preferindo pago > realizado > não-sintético (evita contar 2x recorrência materializada).
 * Exclui cenários. Linhas SEM sourceId não passam pela dedup (ficam avulsas).
 */
export const buildPeriodSource = (dashboardTransactions: any[], allEvents: any[]): PeriodRow[] => {
  const realized: PeriodRow[] = dashboardTransactions
    .filter((t) => t.type === "income" || t.type === "expense")
    .map((t) => ({
      id: String(t.id), date: effectiveDate(t), type: t.type, amount: Number(t.amount),
      category: t.category || null, description: t.description, sourceId: t.source_id || String(t.id),
      accountId: t.finance_account_id || null, sourceType: "transaction",
      paid: t.status === "reconciled" || !!t.settled_at, realized: true, projected: false, synthetic: isSyntheticId(String(t.id)),
    }));
  const seenIds = new Set(realized.map((r) => r.id));
  const scheduled: PeriodRow[] = (allEvents || [])
    .filter((e) => (e.kind === "income" || e.kind === "expense") && !e.isScenario && !seenIds.has(e.id))
    .map((e) => ({
      id: String(e.id), date: String(e.date).slice(0, 10), type: e.kind, amount: Number(e.amount),
      category: e.category || null, description: e.description, sourceId: e.sourceId || null,
      accountId: e.accountId || null, sourceType: e.sourceType,
      paid: e.status === "reconciled", realized: false, projected: true, synthetic: isSyntheticId(String(e.id)),
    }));
  const score = (r: PeriodRow) => (r.paid ? 4 : 0) + (r.realized ? 2 : 0) + (r.synthetic ? 0 : 1);
  const merged = new Map<string, PeriodRow>();
  const standalone: PeriodRow[] = [];
  for (const row of [...realized, ...scheduled]) {
    if (!row.sourceId) { standalone.push(row); continue; }
    const key = `${row.sourceId}|${row.date}|${row.type}`;
    const existing = merged.get(key);
    if (!existing || score(row) > score(existing)) merged.set(key, row);
  }
  return [...standalone, ...merged.values()];
};
