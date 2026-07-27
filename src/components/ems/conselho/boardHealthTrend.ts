// Conselho · Tendência de saúde — compara snapshots de board_health_snapshots. Puro/testável.

export interface HealthSnapshot {
  snapshot_date: string;
  overall_score: number | null;
  financial_score: number | null;
  risk_score: number | null;
  governance_score: number | null;
  compliance_score: number | null;
}

export interface DropInfo { key: string; label: string; delta: number; from: number; to: number }

const DIMS: { key: keyof HealthSnapshot; label: string }[] = [
  { key: "financial_score", label: "Financeiro" },
  { key: "risk_score", label: "Risco" },
  { key: "governance_score", label: "Governança" },
  { key: "compliance_score", label: "Compliance" },
];

/** Dimensão que MAIS caiu entre dois snapshots (maior delta negativo). null se nada piorou. */
export const biggestDrop = (prev: HealthSnapshot | undefined, curr: HealthSnapshot | undefined): DropInfo | null => {
  if (!prev || !curr) return null;
  let worst: DropInfo | null = null;
  for (const d of DIMS) {
    const from = Number(prev[d.key] ?? 0);
    const to = Number(curr[d.key] ?? 0);
    const delta = to - from;
    if (delta < 0 && (!worst || delta < worst.delta)) worst = { key: d.key as string, label: d.label, delta, from, to };
  }
  return worst;
};

/** Variação do score geral entre dois snapshots (curr − prev). */
export const overallDelta = (prev?: HealthSnapshot, curr?: HealthSnapshot): number =>
  prev && curr ? Number(curr.overall_score ?? 0) - Number(prev.overall_score ?? 0) : 0;
