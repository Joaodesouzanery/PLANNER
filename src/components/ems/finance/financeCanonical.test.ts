import { describe, it } from "node:test";
import assert from "node:assert";
import { canonicalTotals, saldoAbertura, saldoRealHoje, menorSaldo } from "./financeCanonical";

// Helper: monta uma PeriodRow mínima. paid=Recebido/Pago, realized=já aconteceu.
type Row = ReturnType<typeof row>;
const row = (o: {
  date: string; type: "income" | "expense"; amount: number;
  paid?: boolean; realized?: boolean; sourceType?: string; id?: string;
}) => ({
  id: o.id ?? `${o.date}-${o.type}-${o.amount}`, date: o.date, type: o.type, amount: o.amount,
  category: null, description: "x", sourceId: null, accountId: null,
  sourceType: o.sourceType ?? "transaction",
  paid: !!o.paid, realized: !!o.realized, projected: !o.realized, synthetic: false,
});

// Cenário jul/2026 da especificação.
const TODAY = "2026-07-11";
const rows: Row[] = [
  // saldo de abertura (junho, realizado): +1.055,81
  row({ date: "2026-06-20", type: "income", amount: 1055.81, paid: true, realized: true }),
  // julho — entradas recebidas (reais): 5.500
  row({ date: "2026-07-08", type: "income", amount: 2000, paid: true, realized: true }), // IRIS
  row({ date: "2026-07-10", type: "income", amount: 1500, paid: true, realized: true }), // RAONI
  row({ date: "2026-07-05", type: "income", amount: 2000, paid: true, realized: true }),
  // julho — "Lançado" (confirmed): realizado mas NÃO recebido → previsto
  row({ date: "2026-07-10", type: "income", amount: 1500, paid: false, realized: true }), // CONAB
  // julho — a receber (planned, futuro)
  row({ date: "2026-07-17", type: "income", amount: 1250, paid: false, realized: false }), // Compizzo
  // julho — saídas pagas: 1.560
  row({ date: "2026-07-06", type: "expense", amount: 1000, paid: true, realized: true }),
  row({ date: "2026-07-07", type: "expense", amount: 560, paid: true, realized: true }),
  // julho — a pagar (previsto): 1.082
  row({ date: "2026-07-11", type: "expense", amount: 800, paid: false, realized: false, sourceType: "installment" }), // Macbook 1/10
  row({ date: "2026-07-12", type: "expense", amount: 95, paid: false, realized: true }), // Seguro
  row({ date: "2026-07-13", type: "expense", amount: 187, paid: false, realized: true }), // Cerrado
];

describe("financeCanonical — totais canônicos (jul/2026)", () => {
  const t = canonicalTotals(rows, "2026-07-01", "2026-07-31");
  it("entradas realizadas = só recebido (5.500)", () => assert.equal(t.entradasRealizadas, 5500));
  it("entradas previstas = tudo (8.250)", () => assert.equal(t.entradasPrevistas, 8250));
  it("saídas realizadas = só pago (1.560)", () => assert.equal(t.saidasRealizadas, 1560));
  it("saídas previstas = tudo (2.642)", () => assert.equal(t.saidasPrevistas, 2642));
  it("a receber = previsto não-recebido (2.750)", () => assert.equal(t.aReceber, 2750));
  it("a pagar = previsto não-pago, inclui parcela (1.082)", () => assert.equal(t.aPagar, 1082));
});

describe("financeCanonical — saldos", () => {
  it("saldo de abertura (jul) = realizado antes do mês (1.055,81)", () =>
    assert.equal(Number(saldoAbertura(rows, "2026-07-01").toFixed(2)), 1055.81));
  it("saldo real hoje = abertura + recebido − pago (4.995,81)", () =>
    assert.equal(Number(saldoRealHoje(rows, TODAY).toFixed(2)), 4995.81));
  it("Lançado (confirmed, não recebido) NÃO entra no saldo real", () => {
    // sem o CONAB de 1.500 o saldo real seria o mesmo → confirma que confirmed não conta
    const semConab = rows.filter((r) => r.amount !== 1500 || r.paid);
    assert.equal(saldoRealHoje(semConab, TODAY), saldoRealHoje(rows, TODAY));
  });
});

describe("financeCanonical — menor saldo (curva diária)", () => {
  it("olha o vale da curva, não o líquido do período", () => {
    const ms = menorSaldo(rows, 90, TODAY);
    // a partir de 4.995,81, as saídas previstas (Macbook/Seguro/Cerrado) puxam o piso pra baixo
    assert.ok(ms.saldo < 4995.81);
    assert.ok(ms.saldo > 0);
  });
});
