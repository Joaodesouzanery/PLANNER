// CRM · Servicing Control Tower — KPIs da carteira de clientes. Puro/testável.
// Reusa clientConcentration (finance) e forecastPonderado (NBA); não recalcula receita.
import { clientConcentration } from "@/components/ems/finance/financeClients";
import { forecastPonderado, type NbaItem } from "./buildNextBestActions";
import { CLOSED_STAGES } from "./crm360";

export interface PortfolioCustomer { id: string; nome: string; recorrente: boolean; health?: string | null; ongoing: number }

export interface CrmPortfolio {
  totalClientes: number;
  ativos: number;
  atencao: number;
  emRisco: number;
  mrr: number;
  top1Share: number;
  hhi: number;
  dealsAbertos: number;
  forecast: number;
  esfriandoCount: number;
  followUpsVencidos: number;
}

const CLOSED = CLOSED_STAGES;

export const crmPortfolio = (customers: PortfolioCustomer[], deals: { value?: number | null; probability?: number | null; stage?: string | null }[], nba: NbaItem[]): CrmPortfolio => {
  const conc = clientConcentration(customers.map((c) => ({ id: c.id, nome: c.nome, recorrente: c.recorrente, monthly: c.ongoing, ongoing: c.ongoing })));
  const emRisco = customers.filter((c) => (c.health || "green") === "red").length;
  const atencao = customers.filter((c) => (c.health || "green") === "yellow").length;
  return {
    totalClientes: customers.length,
    ativos: customers.length - emRisco - atencao,
    atencao,
    emRisco,
    mrr: customers.reduce((a, c) => a + c.ongoing, 0),
    top1Share: conc.top1Share,
    hhi: conc.hhi,
    dealsAbertos: deals.filter((d) => !CLOSED.has((d.stage || "").toLowerCase())).length,
    forecast: forecastPonderado(deals),
    esfriandoCount: nba.filter((n) => n.tipo === "esfriando").length,
    followUpsVencidos: nba.filter((n) => n.tipo === "follow_up").length,
  };
};
