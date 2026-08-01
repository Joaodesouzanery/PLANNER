// Regra-Mestre · leitura "as-of mês" de um valor de config datado. Puro/testável.
// Dado o histórico de vigências de uma key, retorna o valor que vale num dado mês = a vigência de maior
// effective_date que já começou até o FIM daquele mês. Antes da 1ª vigência → null (o caller usa fallback).

export interface ConfigRow {
  key: string;
  value: number;
  effective_date: string; // "yyyy-MM-dd"
}

const endOfMonth = (monthKey: string) => {
  // monthKey "yyyy-MM" → último dia do mês em "yyyy-MM-dd" (compara lexicograficamente com effective_date).
  const [y, m] = monthKey.split("-").map(Number);
  const last = new Date(y, m, 0).getDate(); // dia 0 do mês seguinte = último dia deste mês
  return `${monthKey}-${String(last).padStart(2, "0")}`;
};

// Valor da key vigente no mês (ou null se nenhuma vigência começou até o fim do mês).
export const configAsOf = (rows: ConfigRow[], key: string, monthKey: string): number | null => {
  const limite = endOfMonth(monthKey);
  let best: ConfigRow | null = null;
  for (const r of rows) {
    if (r.key !== key) continue;
    if (r.effective_date > limite) continue; // ainda não entrou em vigor neste mês
    if (!best || r.effective_date > best.effective_date) best = r;
  }
  return best ? Number(best.value) : null;
};

// Soma do valor de uma key ao longo dos meses de um período [fromMonth..toMonth] inclusive.
// Usa o fallback quando algum mês está antes da 1ª vigência. Base do pró-labore total do DRE por período.
export const configSumOverMonths = (
  rows: ConfigRow[],
  key: string,
  fromMonth: string,
  toMonth: string,
  fallback = 0,
): number => {
  let total = 0;
  for (const m of monthsBetween(fromMonth, toMonth)) {
    total += configAsOf(rows, key, m) ?? fallback;
  }
  return total;
};

// Lista de "yyyy-MM" de fromMonth até toMonth (inclusive). Vazia se toMonth < fromMonth.
export const monthsBetween = (fromMonth: string, toMonth: string): string[] => {
  const [fy, fm] = fromMonth.split("-").map(Number);
  const [ty, tm] = toMonth.split("-").map(Number);
  const out: string[] = [];
  let cur = fy * 12 + (fm - 1);
  const end = ty * 12 + (tm - 1);
  while (cur <= end) {
    out.push(`${Math.floor(cur / 12)}-${String((cur % 12) + 1).padStart(2, "0")}`);
    cur += 1;
  }
  return out;
};
