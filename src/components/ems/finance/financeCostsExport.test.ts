import { describe, it, expect } from "vitest";
import { buildCostExport, costExportToCsv, costExportToJson } from "./financeCostsExport";
import { buildCostMonth, type CostBucket, type CostTx } from "./financeCosts";

const buckets: CostBucket[] = [{ id: "b1", name: "Custos Fixos", kind: "fixo", color: null, sort_order: 0 }];
const base: CostTx = {
  id: "c1", description: "Supabase", amount: 125, type: "expense", date: "2026-08-05",
  is_recurring: true, recurrence_interval: "monthly", cost_bucket_id: "b1", category: "Software",
};

describe("financeCostsExport", () => {
  it("exporta linhas com origem da materialização e totais", () => {
    const child: CostTx = { id: "x1", description: "Supabase", amount: 125, type: "expense", date: "2026-09-05", source_id: "c1", status: "reconciled" };
    const report = buildCostMonth(buckets, [base], [base, child], "2026-09");
    const data = buildCostExport(report, [], "2026-09-10T00:00:00.000Z");
    expect(data.totais).toEqual({ previsto: 125, pago: 125, em_aberto: 0 });
    expect(data.custos[0].origem).toContain("materializada");
    expect(data.custos[0].transacao_id).toBe("x1");
    expect(data.por_tipo[0].tipo).toBe("Custos Fixos");
  });

  it("marca ocorrência ainda projetada e serializa CSV/JSON", () => {
    const report = buildCostMonth(buckets, [base], [base], "2026-10");
    const data = buildCostExport(report);
    expect(data.custos[0].origem).toContain("projetada");
    const csv = costExportToCsv(data);
    expect(csv).toContain("Supabase");
    expect(csv).toContain("TOTAIS");
    expect(JSON.parse(costExportToJson(data)).mes).toBe("2026-10");
  });
});
