// CFO v2 · Fase 6 — viabilidade de meta/sinking fund. Puro/testável.
// Calcula de trás pra frente o aporte necessário/mês e se, no ritmo da sobra, a meta chega no prazo.

export type Verdict = "on-track" | "stretch" | "unfeasible";

export interface GoalViability {
  mesesRestantes: number;
  falta: number;
  aporteNecessario: number; // por mês, para bater no prazo
  verdict: Verdict;
  mesesNoRitmo: number | null; // meses p/ atingir poupando `sobra` (null = sobra ≤ 0)
  dataProjetada: string | null; // "yyyy-MM" no ritmo da sobra
  progressoNoPrazo: number; // 0..1 — quanto do alvo se alcança até o prazo no ritmo atual
}

const monthsBetween = (fromYmd: string, toYmd: string) => {
  const [fy, fm] = fromYmd.split("-").map(Number);
  const [ty, tm] = toYmd.split("-").map(Number);
  return (ty - fy) * 12 + (tm - fm);
};

const addMonthsKey = (ymd: string, n: number) => {
  const [y, m] = ymd.split("-").map(Number);
  const total = y * 12 + (m - 1) + n;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, "0")}`;
};

export const goalViability = (target: number, atual: number, prazoIso: string, sobra: number, today: string): GoalViability => {
  const mesesRestantes = Math.max(0, monthsBetween(today, prazoIso));
  const falta = Math.max(0, target - atual);
  const aporteNecessario = mesesRestantes > 0 ? falta / mesesRestantes : falta;

  const verdict: Verdict =
    aporteNecessario <= sobra ? "on-track"
      : aporteNecessario <= sobra * 1.5 ? "stretch"
        : "unfeasible";

  const mesesNoRitmo = sobra > 0 ? Math.ceil(falta / sobra) : null;
  const dataProjetada = mesesNoRitmo != null ? addMonthsKey(today, mesesNoRitmo) : null;
  const progressoNoPrazo = target > 0 ? Math.min(1, (atual + Math.max(0, sobra) * mesesRestantes) / target) : 0;

  return { mesesRestantes, falta, aporteNecessario, verdict, mesesNoRitmo, dataProjetada, progressoNoPrazo };
};
