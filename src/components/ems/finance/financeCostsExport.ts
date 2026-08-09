// Finanças · Custos — exportação (CSV/JSON) da reconciliação mensal + alertas.
// Puro/testável: transforma o relatório do mês numa estrutura estável para levar à IA.
import type { CostMonthReport, CostOccurrence } from "./financeCosts";
import type { DuplicateGroup } from "./financeAudit";

export interface CostExportRow {
  mes: string;
  tipo: string; // nome do bucket
  natureza: string; // fixo | variavel | outro
  descricao: string;
  categoria: string;
  vencimento: string;
  valor: number;
  situacao: "Pago" | "Em aberto";
  origem: string; // como o mês foi materializado
  recorrente: boolean;
  frequencia: string;
  escopo: string;
  produto_id: string;
  cliente_id: string;
  custo_id: string;
  transacao_id: string;
}

const ORIGEM_LABEL: Record<CostOccurrence["origin"], string> = {
  base: "Lançamento cadastrado no próprio mês",
  materializada: "Transação materializada (filha da recorrência)",
  projetada: "Ocorrência projetada da recorrência (sem transação ainda)",
};

export const originLabelForCost = (o: CostOccurrence["origin"]) => ORIGEM_LABEL[o];

export interface CostExport {
  mes: string;
  gerado_em: string;
  totais: { previsto: number; pago: number; em_aberto: number };
  por_tipo: { tipo: string; natureza: string; previsto: number; pago: number; em_aberto: number }[];
  custos: CostExportRow[];
  alertas: { motivo: string; mes: string; valor: number; lancamentos: { id: string; data: string; descricao: string; origem: string; situacao: string }[] }[];
}

export const buildCostExport = (
  report: CostMonthReport,
  duplicates: DuplicateGroup[] = [],
  generatedAt = new Date().toISOString(),
): CostExport => {
  const custos: CostExportRow[] = [];
  for (const g of report.groups) {
    for (const occ of g.items) {
      const c = occ.cost as CostExportRow extends never ? never : typeof occ.cost & {
        escopo?: string | null; produto_id?: string | null; cliente_id?: string | null;
      };
      custos.push({
        mes: report.month,
        tipo: g.bucket?.name || "Sem tipo",
        natureza: g.bucket?.kind || "—",
        descricao: c.description,
        categoria: c.category || "",
        vencimento: occ.due,
        valor: occ.amount,
        situacao: occ.paid ? "Pago" : "Em aberto",
        origem: ORIGEM_LABEL[occ.origin],
        recorrente: !!c.is_recurring,
        frequencia: c.recurrence_interval || "",
        escopo: c.escopo || "",
        produto_id: c.produto_id || "",
        cliente_id: c.cliente_id || "",
        custo_id: c.id,
        transacao_id: occ.txId || "",
      });
    }
  }
  return {
    mes: report.month,
    gerado_em: generatedAt,
    totais: { previsto: report.total, pago: report.paidTotal, em_aberto: report.pendingTotal },
    por_tipo: report.groups.map((g) => ({
      tipo: g.bucket?.name || "Sem tipo",
      natureza: g.bucket?.kind || "—",
      previsto: g.total,
      pago: g.paidTotal,
      em_aberto: g.total - g.paidTotal,
    })),
    custos,
    alertas: duplicates.map((d) => ({
      motivo: d.motivo,
      mes: d.month,
      valor: d.amount,
      lancamentos: d.rows.map((r) => ({ id: r.id, data: r.date, descricao: r.description, origem: r.origem, situacao: r.situacao })),
    })),
  };
};

const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""').replace(/\s*\n\s*/g, " ")}"`;

export const costExportToCsv = (data: CostExport): string => {
  const header = [
    "Mês", "Tipo", "Natureza", "Descrição", "Categoria", "Vencimento", "Valor",
    "Situação", "Origem", "Recorrente", "Frequência", "Escopo", "Produto", "Cliente", "CustoId", "TransacaoId",
  ];
  const lines = data.custos.map((r) =>
    [r.mes, r.tipo, r.natureza, r.descricao, r.categoria, r.vencimento, r.valor.toFixed(2), r.situacao,
      r.origem, r.recorrente ? "Sim" : "Não", r.frequencia, r.escopo, r.produto_id, r.cliente_id, r.custo_id, r.transacao_id]
      .map(esc).join(";"),
  );
  const alerts = data.alertas.length
    ? ["", esc("ALERTAS DE DUPLICIDADE"), ...data.alertas.map((a) =>
        [a.mes, a.valor.toFixed(2), a.motivo, a.lancamentos.map((l) => `${l.data} ${l.descricao} (${l.origem}/${l.situacao})`).join(" | ")]
          .map(esc).join(";"))]
    : [];
  const totals = [
    "",
    esc("TOTAIS"),
    [esc("Previsto"), esc(data.totais.previsto.toFixed(2))].join(";"),
    [esc("Pago"), esc(data.totais.pago.toFixed(2))].join(";"),
    [esc("Em aberto"), esc(data.totais.em_aberto.toFixed(2))].join(";"),
  ];
  return `\uFEFF${[header.join(";"), ...lines, ...totals, ...alerts].join("\n")}`;
};

export const costExportToJson = (data: CostExport): string => JSON.stringify(data, null, 2);
