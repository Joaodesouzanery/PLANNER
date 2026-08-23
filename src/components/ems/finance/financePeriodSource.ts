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
  sourceType: string; // papel no fluxo (transaction | plan | invoice | installment | project…)
  origin?: string | null; // origem REAL do dado (source_type do banco): planilha, csv, seed, materialized…
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
      accountId: t.finance_account_id || null, sourceType: "transaction", origin: t.source_type || null,
      paid: t.status === "reconciled" || !!t.settled_at, realized: true, projected: false, synthetic: isSyntheticId(String(t.id)),
    }));
  const seenIds = new Set(realized.map((r) => r.id));
  const scheduled: PeriodRow[] = (allEvents || [])
    .filter((e) => (e.kind === "income" || e.kind === "expense") && !e.isScenario && !seenIds.has(e.id))
    .map((e) => ({
      id: String(e.id), date: String(e.date).slice(0, 10), type: e.kind, amount: Number(e.amount),
      category: e.category || null, description: e.description, sourceId: e.sourceId || null,
      accountId: e.accountId || null, sourceType: e.sourceType, origin: e.origin || e.sourceType || null,
      paid: e.status === "reconciled", realized: false, projected: true, synthetic: isSyntheticId(String(e.id)),
    }));
  const score = (r: PeriodRow) => (r.paid ? 4 : 0) + (r.realized ? 2 : 0) + (r.synthetic ? 0 : 1);
  const merged = new Map<string, PeriodRow>();
  const standalone: PeriodRow[] = [];
  for (const row of [...realized, ...scheduled]) {
    if (!row.sourceId) { standalone.push(row); continue; }
    // O VALOR entra na chave: uma mesma origem pode ter várias linhas no mesmo dia (uma viagem
    // lança voo/hotel/alimentação com o mesmo source_id e a mesma data). Sem o valor, só a
    // primeira sobrevivia e a viagem entrava no fluxo pela fração do custo.
    const key = `${row.sourceId}|${row.date}|${row.type}|${row.amount.toFixed(2)}`;
    const existing = merged.get(key);
    if (!existing || score(row) > score(existing)) merged.set(key, row);
  }
  return dedupeEquivalent([...standalone, ...merged.values()]);
};

/**
 * Chave semântica de um lançamento: descrição normalizada (sem acento, sem "(2/10)",
 * sem pontuação e com as palavras ordenadas) + tipo + data + valor.
 * "Macbook" e "Macbook (2/10)" de 800 no mesmo dia geram a MESMA chave.
 */
export const entryKey = (r: Pick<PeriodRow, "description" | "type" | "date" | "amount">): string => {
  const desc = String(r.description || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\(\s*\d+\s*\/\s*\d+\s*\)/g, " ")
    .replace(/\b\d+\s*\/\s*\d+\b/g, " ")
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .sort()
    .join(" ");
  return `${desc}|${r.type}|${r.date}|${r.amount.toFixed(2)}`;
};

/**
 * Rede de segurança contra dupla contagem. Dentro de um grupo de mesma chave semântica
 * (descrição equivalente + tipo + data + valor), separa por descrição CRUA:
 *
 * - descrições DIFERENTES ("Macbook" × "Macbook (2/10)") = o mesmo pagamento escrito de dois
 *   jeitos (recorrência × parcela real) → fica só o principal;
 * - descrição IDÊNTICA repetida (4× "Zigpay" de R$ 46 no mesmo dia) = compras distintas →
 *   ficam todas. Engoli-las fazia o mês fechar a menos.
 *
 * O "principal" é o maior bucket (empate → o que tem a linha de maior score). Dentro dele
 * ficam as linhas REAIS do banco; se não houver nenhuma, fica a de maior score do grupo —
 * é assim que a ocorrência sintética some quando existe a linha real do mesmo dia.
 * Independe da ordem de entrada e preserva a ordem original na saída.
 */
export const dedupeEquivalent = (rows: PeriodRow[]): PeriodRow[] => {
  const score = (r: PeriodRow) => (r.paid ? 4 : 0) + (r.realized ? 2 : 0) + (r.synthetic ? 0 : 1);
  const ehReal = (r: PeriodRow) => r.realized && !r.synthetic;
  const melhorScore = (idx: number[]) => idx.reduce((m, i) => Math.max(m, score(rows[i])), -1);

  const grupos = new Map<string, number[]>();
  rows.forEach((row, i) => {
    const key = entryKey(row);
    const g = grupos.get(key);
    if (g) g.push(i); else grupos.set(key, [i]);
  });

  const manter = new Set<number>();
  for (const indices of grupos.values()) {
    if (indices.length === 1) { manter.add(indices[0]); continue; }

    const buckets = new Map<string, number[]>();
    for (const i of indices) {
      const desc = String(rows[i].description || "").trim();
      const b = buckets.get(desc);
      if (b) b.push(i); else buckets.set(desc, [i]);
    }

    let principal: number[] = [];
    for (const b of buckets.values()) {
      if (!principal.length) { principal = b; continue; }
      if (b.length > principal.length || (b.length === principal.length && melhorScore(b) > melhorScore(principal))) principal = b;
    }

    const reais = principal.filter((i) => ehReal(rows[i]));
    if (reais.length) { reais.forEach((i) => manter.add(i)); continue; }
    manter.add(indices.reduce((best, i) => (score(rows[i]) > score(rows[best]) ? i : best), indices[0]));
  }
  return rows.filter((_, i) => manter.has(i));
};

