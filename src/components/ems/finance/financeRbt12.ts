// CFO v2 · Fase 5 — vigia do teto do Simples (RBT12 = receita bruta dos últimos 12 meses).
// NÃO faz aconselhamento fiscal: só compara com um limite configurável e projeta o estouro.
// Puro/testável. Faixas/alíquotas NÃO são hardcoded (mudam por lei; o usuário configura o limite).

export interface Rbt12 {
  rbt12: number;
  limite: number;
  headroom: number; // limite − rbt12
  pct: number; // 0..1
  mesesAteCruzar: number | null; // no ritmo do MRR; null = não cruza / já cruzou
  alert: boolean;
}

/** monthly: linhas mensais (oldest→newest) com `income`. mrrMensal = ritmo de entrada esperado. */
export const rbt12Status = (
  monthly: { income: number }[],
  limite: number | null | undefined,
  alertPct: number,
  mrrMensal: number,
): Rbt12 | null => {
  if (!limite || limite <= 0) return null;
  const window = monthly.slice(-12).map((m) => m.income);
  const rbt12 = window.reduce((a, x) => a + x, 0);
  const headroom = limite - rbt12;
  const pct = rbt12 / limite;

  // Projeta a janela deslizante: cada mês entra `mrrMensal` e sai o mês mais antigo.
  let mesesAteCruzar: number | null = null;
  if (rbt12 <= limite && mrrMensal > 0) {
    const w = [...window];
    let running = rbt12;
    for (let k = 1; k <= 60; k++) {
      const sai = w.shift() ?? 0;
      w.push(mrrMensal);
      running = running - sai + mrrMensal;
      if (running > limite) { mesesAteCruzar = k; break; }
    }
  }

  return { rbt12, limite, headroom, pct, mesesAteCruzar, alert: pct * 100 >= alertPct || rbt12 > limite };
};
