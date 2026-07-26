// Motor de aposentadoria (FIRE) — juros compostos mensais em PODER DE COMPRA DE HOJE (retorno REAL).
// Puro/testável. Portado do motor HTML do usuário. Não busca nem persiste nada.

/** Taxa mensal equivalente a um retorno real anual (%). */
export const mrate = (realAnnual: number): number => Math.pow(1 + realAnnual / 100, 1 / 12) - 1;

/** Montante que gera Z/mês para sempre a uma taxa de retirada segura (SWR %). Z*12 / (swr/100). */
export const targetFor = (z: number, swrPct: number): number => (z * 12) / (swrPct / 100);

/** Meses até acumular `target` partindo de P0, poupando Y/mês, a taxa mensal r. Cap 1200 → Infinity. */
export const monthsTo = (target: number, P0: number, Y: number, r: number): number => {
  if (P0 >= target) return 0;
  let p = P0;
  for (let m = 1; m <= 1200; m++) {
    p = p * (1 + r) + Y;
    if (p >= target) return m;
  }
  return Infinity;
};

/** Aporte/mês necessário para atingir `target` em `t` meses (FV de anuidade). Guarda r=0 (linear). */
export const reqY = (target: number, P0: number, t: number, r: number): number => {
  if (t <= 0) return Math.max(0, target - P0);
  const grown = P0 * Math.pow(1 + r, t);
  const factor = r === 0 ? t : (Math.pow(1 + r, t) - 1) / r;
  return Math.max(0, (target - grown) / factor);
};

export interface SeriesPoint { m: number; v: number }
/** Trajetória do patrimônio mês a mês (para o gráfico). */
export const series = (P0: number, Y: number, r: number, months: number): SeriesPoint[] => {
  const out: SeriesPoint[] = [{ m: 0, v: P0 }];
  let p = P0;
  const cap = Math.min(Math.max(0, Math.round(months)), 1200);
  for (let m = 1; m <= cap; m++) { p = p * (1 + r) + Y; out.push({ m, v: p }); }
  return out;
};
