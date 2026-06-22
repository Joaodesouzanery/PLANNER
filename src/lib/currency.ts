// Utilitarios de moeda/numero no padrao pt-BR (R$ 1.234,56).
// Mantidos puros (sem React) para serem reusados por inputs com mascara e por
// qualquer calculo. Casa com o estilo de `fmtCurrency` em useFinanceData.

/** Formata um numero como moeda BRL: 1234.5 -> "R$ 1.234,50". */
export const formatCurrencyBR = (value: number, decimals = 2): string =>
  `R$ ${formatNumberBR(value, decimals)}`;

/** Formata um numero no padrao pt-BR (milhar com ponto, decimal com virgula). */
export const formatNumberBR = (value: number, decimals = 2): string => {
  if (!Number.isFinite(value)) return (0).toLocaleString("pt-BR", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  return value.toLocaleString("pt-BR", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
};

/**
 * Converte uma string digitada (pt-BR ou solta) em numero.
 * Aceita "1.234,56", "1234,56", "1234.56", "R$ 1.200" etc.
 * Retorna NaN para entradas vazias/invalidas para que o chamador decida o fallback.
 */
export const parseCurrencyBR = (raw: string): number => {
  if (raw == null) return NaN;
  let s = String(raw).trim();
  if (!s) return NaN;
  // remove tudo que nao for digito, virgula, ponto ou sinal de menos
  s = s.replace(/[^\d.,-]/g, "");
  if (!s || s === "-" || s === "," || s === ".") return NaN;
  const hasComma = s.includes(",");
  const hasDot = s.includes(".");
  if (hasComma && hasDot) {
    // assume pt-BR: ponto = milhar, virgula = decimal
    s = s.replace(/\./g, "").replace(",", ".");
  } else if (hasComma) {
    // virgula como separador decimal
    s = s.replace(",", ".");
  }
  // se so tem ponto, mantem como decimal (ex: "1234.56")
  const n = Number(s);
  return Number.isFinite(n) ? n : NaN;
};

export interface NumberConstraints {
  min?: number;
  max?: number;
  allowNegative?: boolean; // default false
  integer?: boolean; // default false
}

/** Limita um numero a faixa/sinal/inteiro configurados. */
export const clampNumber = (value: number, c: NumberConstraints = {}): number => {
  let n = Number.isFinite(value) ? value : 0;
  if (c.integer) n = Math.trunc(n);
  if (!c.allowNegative && n < 0) n = 0;
  if (c.min != null && n < c.min) n = c.min;
  if (c.max != null && n > c.max) n = c.max;
  return n;
};

/** Valida um numero contra as constraints. Retorna mensagem de erro ou null. */
export const validateNumber = (value: number, c: NumberConstraints = {}): string | null => {
  if (!Number.isFinite(value)) return "Valor invalido";
  if (!c.allowNegative && value < 0) return "Nao pode ser negativo";
  if (c.integer && !Number.isInteger(value)) return "Use um numero inteiro";
  if (c.min != null && value < c.min) return `Minimo ${formatNumberBR(c.min, c.integer ? 0 : 2)}`;
  if (c.max != null && value > c.max) return `Maximo ${formatNumberBR(c.max, c.integer ? 0 : 2)}`;
  return null;
};
