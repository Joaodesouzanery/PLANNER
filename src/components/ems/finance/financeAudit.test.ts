import { describe, it, expect } from "vitest";
import { buildAuditReport, monthsBackStart, detectDuplicates } from "./financeAudit";
import type { PeriodRow } from "./financePeriodSource";

const row = (p: Partial<PeriodRow>): PeriodRow => ({
  id: "1", date: "2026-08-01", type: "expense", amount: 100, category: null, description: "x",
  sourceId: null, accountId: null, sourceType: "transaction", paid: false, realized: false,
  projected: true, synthetic: false, ...p,
});

describe("financeAudit", () => {
  it("monthsBackStart pega o 1º dia de 2 meses atrás", () => {
    expect(monthsBackStart("2026-08-04", 2)).toBe("2026-07-01");
    expect(monthsBackStart("2026-01-15", 2)).toBe("2025-12-01");
  });

  it("resume por origem e situação", () => {
    const rows = [
      row({ id: "a", type: "income", amount: 1000, paid: true, sourceType: "transaction", date: "2026-07-05" }),
      row({ id: "b", amount: 300, paid: false, sourceType: "recurring", date: "2026-07-10" }),
    ];
    const rep = buildAuditReport(rows, "2026-07-01", "2026-08-31", "2026-08-04");
    expect(rep.summary.entradasPagas).toBe(1000);
    expect(rep.summary.saldoRealizado).toBe(1000);
    expect(rep.rows.find((r) => r.id === "b")?.situacao).toBe("Vencido");
    expect(rep.summary.porOrigem.map((o) => o.origem)).toContain("Recorrência");
  });

  it("detecta recorrência × parcela com mesmo valor e descrição parecida", () => {
    const rows = [
      row({ id: "a", amount: 800, description: "Macbook (parcela)", sourceType: "recurring", sourceId: "r1", date: "2026-08-04" }),
      row({ id: "b", amount: 800, description: "Macbook (2/10)", sourceType: "installment", sourceId: "i1", date: "2026-08-04" }),
      row({ id: "c", amount: 50, description: "Café", sourceType: "transaction", sourceId: "t1", date: "2026-08-04" }),
    ];
    const rep = buildAuditReport(rows, "2026-08-01", "2026-08-31", "2026-08-04");
    expect(rep.duplicates).toHaveLength(1);
    expect(rep.duplicates[0].amount).toBe(800);
  });

  it("não marca duplicidade quando as descrições não têm nada em comum", () => {
    const dup = detectDuplicates([
      { id: "a", date: "2026-08-01", type: "expense", amount: 100, description: "Aluguel", category: null, origem: "Recorrência", situacao: "Previsto", sourceId: "1", sourceType: "recurring" },
      { id: "b", date: "2026-08-02", type: "expense", amount: 100, description: "Internet", category: null, origem: "Parcela", situacao: "Previsto", sourceId: "2", sourceType: "installment" },
    ]);
    expect(dup).toHaveLength(0);
  });
});
