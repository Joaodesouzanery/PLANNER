// Finanças · auditoria de lançamentos (origem de cada valor) + detecção de duplicidade
// entre recorrências e parcelas. Puro/testável — opera sobre PeriodRow (universo canônico).
import type { PeriodRow } from "./financePeriodSource";

export interface AuditRow {
  id: string;
  date: string;
  type: "income" | "expense";
  amount: number;
  description: string;
  category: string | null;
  origem: string; // rótulo legível da origem
  situacao: "Pago/Recebido" | "Previsto" | "Vencido";
  sourceId: string | null;
  sourceType: string;
}

export interface AuditSummary {
  entradasPagas: number;
  saidasPagas: number;
  entradasPrevistas: number;
  saidasPrevistas: number;
  saldoRealizado: number; // entradas pagas − saídas pagas no recorte
  porOrigem: { origem: string; entradas: number; saidas: number; qtd: number }[];
}

export interface AuditReport {
  from: string;
  to: string;
  rows: AuditRow[];
  summary: AuditSummary;
  duplicates: DuplicateGroup[];
}

const LABELS: Record<string, string> = {
  transaction: "Lançamento manual",
  recurring: "Recorrência",
  installment: "Parcela",
  plan: "Planejamento",
  materialized: "Recorrência materializada",
  invoice: "Fatura de cartão",
  scenario: "Cenário",
};

export const originLabel = (r: PeriodRow): string => {
  if (r.synthetic) return "Recorrência (ocorrência gerada)";
  return LABELS[r.sourceType] || r.sourceType || "Origem desconhecida";
};

/** Primeiro dia do mês N meses atrás (inclusive o mês atual). */
export const monthsBackStart = (today: string, months: number): string => {
  const [y, m] = today.slice(0, 7).split("-").map(Number);
  const idx = y * 12 + (m - 1) - (months - 1);
  const yy = Math.floor(idx / 12);
  const mm = (idx % 12) + 1;
  return `${yy}-${String(mm).padStart(2, "0")}-01`;
};

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\(\s*\d+\s*\/\s*\d+\s*\)/g, " ") // "(2/10)"
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !["parcela", "pagamento", "mensal", "conta", "the", "com"].includes(w));

export interface DuplicateGroup {
  key: string;
  amount: number;
  month: string;
  rows: AuditRow[];
  motivo: string;
}

/**
 * Suspeita de duplicidade: mesmo valor, mesmo mês, descrições com termo em comum,
 * mas origens/registros diferentes (ex.: recorrência "Macbook (parcela)" + parcela "Macbook (2/10)").
 */
export const detectDuplicates = (rows: AuditRow[]): DuplicateGroup[] => {
  const buckets = new Map<string, AuditRow[]>();
  for (const r of rows) {
    const key = `${r.type}|${r.date.slice(0, 7)}|${r.amount.toFixed(2)}`;
    const arr = buckets.get(key);
    if (arr) arr.push(r);
    else buckets.set(key, [r]);
  }
  const out: DuplicateGroup[] = [];
  for (const [key, group] of buckets) {
    if (group.length < 2) continue;
    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) {
        const a = group[i];
        const b = group[j];
        if (a.sourceId && b.sourceId && a.sourceId === b.sourceId) continue; // mesma origem já é deduplicada
        const ta = new Set(norm(a.description));
        const shared = norm(b.description).filter((w) => ta.has(w));
        if (!shared.length) continue;
        const motivo =
          a.origem === b.origem
            ? `Dois lançamentos "${a.origem}" iguais no mês`
            : `${a.origem} × ${b.origem} com o mesmo valor e descrição parecida`;
        out.push({ key: `${key}|${a.id}|${b.id}`, amount: a.amount, month: a.date.slice(0, 7), rows: [a, b], motivo });
      }
    }
  }
  return out.sort((x, y) => y.amount - x.amount);
};

/** Relatório de auditoria de um recorte [from,to] com a origem de cada valor. */
export const buildAuditReport = (
  rows: PeriodRow[],
  from: string,
  to: string,
  today: string = new Date().toISOString().slice(0, 10),
): AuditReport => {
  const audit: AuditRow[] = rows
    .filter((r) => r.date >= from && r.date <= to)
    .map((r) => ({
      id: r.id,
      date: r.date,
      type: r.type,
      amount: r.amount,
      description: r.description || "(sem descrição)",
      category: r.category,
      origem: originLabel(r),
      situacao: r.paid ? "Pago/Recebido" : r.date < today ? "Vencido" : "Previsto",
      sourceId: r.sourceId,
      sourceType: r.sourceType,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const byOrigin = new Map<string, { origem: string; entradas: number; saidas: number; qtd: number }>();
  let entradasPagas = 0;
  let saidasPagas = 0;
  let entradasPrevistas = 0;
  let saidasPrevistas = 0;
  for (const r of audit) {
    const paid = r.situacao === "Pago/Recebido";
    if (r.type === "income") {
      entradasPrevistas += r.amount;
      if (paid) entradasPagas += r.amount;
    } else {
      saidasPrevistas += r.amount;
      if (paid) saidasPagas += r.amount;
    }
    const cur = byOrigin.get(r.origem) || { origem: r.origem, entradas: 0, saidas: 0, qtd: 0 };
    cur.qtd += 1;
    if (r.type === "income") cur.entradas += r.amount;
    else cur.saidas += r.amount;
    byOrigin.set(r.origem, cur);
  }

  return {
    from,
    to,
    rows: audit,
    summary: {
      entradasPagas,
      saidasPagas,
      entradasPrevistas,
      saidasPrevistas,
      saldoRealizado: entradasPagas - saidasPagas,
      porOrigem: [...byOrigin.values()].sort((a, b) => b.saidas + b.entradas - (a.saidas + a.entradas)),
    },
    duplicates: detectDuplicates(audit),
  };
};

export const auditToCsv = (report: AuditReport): string => {
  const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""').replace(/\s*\n\s*/g, " ")}"`;
  const header = ["Data", "Tipo", "Descrição", "Categoria", "Valor", "Origem", "Situação"];
  const lines = report.rows.map((r) =>
    [r.date, r.type === "income" ? "Entrada" : "Saída", r.description, r.category, r.amount.toFixed(2), r.origem, r.situacao]
      .map(esc)
      .join(";"),
  );
  return `\uFEFF${[header.join(";"), ...lines].join("\n")}`;
};
