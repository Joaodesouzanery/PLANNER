import { describe, it, expect } from "vitest";
import { buildCostMonth, occursInMonth, dueDateInMonth, shiftMonth, type CostTx, type CostBucket } from "./financeCosts";

const cost = (p: Partial<CostTx>): CostTx => ({
  id: "c1", description: "Aluguel", amount: 1000, type: "expense", date: "2026-01-10",
  is_recurring: true, recurrence_interval: "monthly", cost_bucket_id: "b1", ...p,
});

const buckets: CostBucket[] = [
  { id: "b1", name: "Custos Fixos", kind: "fixo", color: null, sort_order: 0 },
  { id: "b2", name: "Custos Variáveis", kind: "variavel", color: null, sort_order: 1 },
];

describe("financeCosts", () => {
  it("recorrência mensal incide em todo mês após o início e respeita o término", () => {
    const c = cost({ recurrence_end_date: "2026-06-30" });
    expect(occursInMonth(c, "2025-12")).toBe(false);
    expect(occursInMonth(c, "2026-03")).toBe(true);
    expect(occursInMonth(c, "2026-07")).toBe(false);
  });

  it("recorrência anual só no mesmo mês; avulso só no mês do lançamento", () => {
    expect(occursInMonth(cost({ recurrence_interval: "yearly" }), "2026-01")).toBe(true);
    expect(occursInMonth(cost({ recurrence_interval: "yearly" }), "2026-02")).toBe(false);
    expect(occursInMonth(cost({ is_recurring: false }), "2026-02")).toBe(false);
  });

  it("clampa o dia de vencimento no fim do mês", () => {
    expect(dueDateInMonth(cost({ date: "2026-01-31" }), "2026-02")).toBe("2026-02-28");
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
  });

  it("marca o mês como pago quando existe transação materializada quitada", () => {
    const base = cost({});
    const child: CostTx = { id: "x", description: "Aluguel", amount: 1000, type: "expense", date: "2026-03-10", source_id: "c1", status: "reconciled" };
    const rep = buildCostMonth(buckets, [base], [base, child], "2026-03");
    expect(rep.total).toBe(1000);
    expect(rep.paidTotal).toBe(1000);
    expect(rep.groups[0].items[0].txId).toBe("x");
  });

  it("agrupa por bucket e separa custos sem tipo", () => {
    const rep = buildCostMonth(
      buckets,
      [cost({}), cost({ id: "c2", amount: 300, cost_bucket_id: "b2" }), cost({ id: "c3", amount: 50, cost_bucket_id: null })],
      [],
      "2026-04",
    );
    expect(rep.groups.map((g) => g.bucket?.name ?? "—")).toEqual(["Custos Fixos", "Custos Variáveis", "—"]);
    expect(rep.total).toBe(1350);
    expect(rep.pendingTotal).toBe(1350);
  });
});
