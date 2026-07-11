// CFO v2 · Fase 4 — engine de alertas proativos. Puro/testável. NÃO persiste nada: alertas são
// derivados da fonte única (recalculados). Cada regra vira {key, severity, message, date, link}.
import type { CfoMetrics } from "./financeCfo";

export type Severity = "high" | "medium" | "low";
export interface Alert { key: string; severity: Severity; message: string; date?: string | null; link: string }

export interface AlertInputs {
  cfo: CfoMetrics;
  curva90?: { date: string; saldo: number }[]; // canonical.curva(90)
  reservaAlvo: number;
  impostoDueDays?: number | null; // dias até vencer o DAS (se conhecido)
  budgetEstouros?: { category: string; saldo: number }[];
  concentracaoTop1?: number | null; // 0..1
  concentracaoLimite?: number; // default 0.3
  rbt12?: { pct: number; cruzaEm?: string | null } | null; // Fase 5
  brl?: (n: number) => string;
}

const SEV_RANK: Record<Severity, number> = { high: 0, medium: 1, low: 2 };

export const buildAlerts = (i: AlertInputs): Alert[] => {
  const brl = i.brl ?? ((n: number) => `R$ ${n.toFixed(2)}`);
  const limite = i.concentracaoLimite ?? 0.3;
  const out: Alert[] = [];

  for (const r of i.cfo.aReceberVencidoRows) {
    out.push({ key: `receber:${r.id}`, severity: "high", message: `A receber vencido: ${(r.description || "recebível").trim()} ${brl(r.amount)} (venceu ${r.date})`, date: r.date, link: "transactions" });
  }

  if (i.curva90 && i.reservaAlvo > 0) {
    const fura = i.curva90.find((p) => p.saldo < i.reservaAlvo);
    if (fura) out.push({ key: "saldo:fura-reserva", severity: "medium", message: `O saldo projetado fura a reserva-alvo (${brl(i.reservaAlvo)}) em ${fura.date}.`, date: fura.date, link: "future" });
  }

  if (i.reservaAlvo > 0 && i.cfo.reservaAtual < i.reservaAlvo * 0.5) {
    out.push({ key: "reserva:baixa", severity: "medium", message: `Reserva abaixo do alvo — prioridade é separar ${brl(i.reservaAlvo)}.`, link: "overview" });
  }

  if (i.impostoDueDays != null && i.impostoDueDays <= 7 && i.cfo.impostoARecolher > 0) {
    out.push({ key: "imposto:vencer", severity: "high", message: `Imposto a recolher ${brl(i.cfo.impostoARecolher)} vence em ${i.impostoDueDays} dia(s).`, link: "overview" });
  } else if (i.cfo.impostoARecolher > 0) {
    out.push({ key: "imposto:recolher", severity: "low", message: `Imposto a recolher acumulado: ${brl(i.cfo.impostoARecolher)}.`, link: "overview" });
  }

  for (const b of i.budgetEstouros ?? []) {
    out.push({ key: `orcamento:${b.category}`, severity: "medium", message: `Orçamento estourado em ${b.category} (${brl(b.saldo)}).`, link: "overview" });
  }

  if (i.concentracaoTop1 != null && i.concentracaoTop1 > limite) {
    out.push({ key: "concentracao:alta", severity: "medium", message: `Concentração alta: o maior cliente é ${Math.round(i.concentracaoTop1 * 100)}% da receita.`, link: "overview" });
  }

  if (i.rbt12 && i.rbt12.pct >= 0.8) {
    out.push({ key: "rbt12:teto", severity: i.rbt12.pct >= 0.95 ? "high" : "medium", message: `RBT12 em ${Math.round(i.rbt12.pct * 100)}% do limite do Simples${i.rbt12.cruzaEm ? ` — no ritmo atual cruza em ${i.rbt12.cruzaEm}` : ""}.`, link: "overview" });
  }

  // Dedup por key + ordena por severidade.
  const seen = new Set<string>();
  return out.filter((a) => (seen.has(a.key) ? false : (seen.add(a.key), true))).sort((a, b) => SEV_RANK[a.severity] - SEV_RANK[b.severity]);
};
