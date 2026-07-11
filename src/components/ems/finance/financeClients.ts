// CFO v2 · Fase 1 — concentração de receita por cliente. Puro/testável.
// `monthly` = run-rate mensal do cliente (inclui pontual); `ongoing` = parte recorrente SEM fim
// (o que o cliente contribui pro MRR, i.e. sai de vez se ele cancelar).
import { intervalFactor } from "./projectionCalc";

export interface ClientRevenue {
  id: string | null;
  nome: string;
  recorrente: boolean;
  monthly: number;
  ongoing: number;
}

export interface ClientTx {
  type: string;
  is_recurring?: boolean | null;
  amount: number | string;
  recurrence_interval?: string | null;
  recurrence_end_date?: string | null;
  cliente_id?: string | null;
}

/** Run-rate mensal por cliente a partir das ENTRADAS recorrentes (fonte do card e dos alertas). */
export const buildClientRevenue = (
  txns: ClientTx[],
  clientes: { id: string; nome: string; recorrente: boolean }[],
): { clients: ClientRevenue[]; semCliente: number } => {
  const nameById = new Map(clientes.map((c) => [c.id, c]));
  const rev = new Map<string, ClientRevenue>();
  for (const t of txns) {
    if (t.type !== "income" || !t.is_recurring) continue;
    const mEq = Number(t.amount) * intervalFactor(t.recurrence_interval || "monthly");
    const ongoing = t.recurrence_end_date ? 0 : mEq;
    const key = t.cliente_id || "__sem__";
    const meta = t.cliente_id ? nameById.get(t.cliente_id) : null;
    const e = rev.get(key) || { id: t.cliente_id || null, nome: meta?.nome || "Sem cliente", recorrente: meta?.recorrente ?? !t.recurrence_end_date, monthly: 0, ongoing: 0 };
    e.monthly += mEq;
    e.ongoing += ongoing;
    rev.set(key, e);
  }
  const semCliente = rev.get("__sem__")?.monthly ?? 0;
  return { clients: [...rev.values()].filter((e) => e.id !== null), semCliente };
};

export interface ClientConcentration {
  total: number;
  ranked: (ClientRevenue & { share: number })[];
  top1Share: number;
  top2Share: number;
  hhi: number; // 0..1 (Herfindahl–Hirschman): quanto maior, mais concentrado
}

export const clientConcentration = (clients: ClientRevenue[]): ClientConcentration => {
  const total = clients.reduce((a, c) => a + c.monthly, 0);
  const ranked = clients
    .map((c) => ({ ...c, share: total > 0 ? c.monthly / total : 0 }))
    .sort((a, b) => b.monthly - a.monthly);
  const top1Share = ranked[0]?.share ?? 0;
  const top2Share = (ranked[0]?.share ?? 0) + (ranked[1]?.share ?? 0);
  const hhi = ranked.reduce((a, c) => a + c.share * c.share, 0);
  return { total, ranked, top1Share, top2Share, hhi };
};

export interface ImpactoSaida {
  mrrPos: number; // MRR se o cliente sair
  novaSobra: number; // sobra mensal se o cliente sair
  runwaySeSair: number; // meses de fôlego se a nova sobra ficar negativa (Infinity se seguir positiva)
}

/** Impacto de perder um cliente: o MRR cai pela parte recorrente-sem-fim dele; se a sobra virar
 *  negativa, o caixa passa a queimar reserva → fôlego = saldo líquido / déficit mensal. */
export const impactoSeSair = (ongoing: number, mrr: number, sobra: number, saldoLiquido: number): ImpactoSaida => {
  const mrrPos = Math.max(0, mrr - ongoing);
  const novaSobra = sobra - ongoing;
  const runwaySeSair = novaSobra >= 0 ? Infinity : saldoLiquido / -novaSobra;
  return { mrrPos, novaSobra, runwaySeSair };
};
