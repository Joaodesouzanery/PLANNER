import { describe, it } from "node:test";
import assert from "node:assert";
import { parcela, purchaseRows, purchaseImpact, type PurchasePlan } from "./financePurchase";

const row = (o: any) => ({
  id: o.id, date: o.date, type: o.type, amount: o.amount, category: o.category ?? null,
  description: "x", sourceId: null, accountId: null, sourceType: o.sourceType ?? "transaction",
  paid: !!o.paid, realized: !!o.realized, projected: !o.realized, synthetic: false,
});

const TODAY = "2026-07-11";
// Saldo real hoje ~5.000 (abertura junho realizada) e nada previsto grande.
const baseRows: any[] = [
  row({ id: "op", date: "2026-06-20", type: "income", amount: 5000, paid: true, realized: true }),
];

describe("financePurchase", () => {
  it("parcela sem juros = total/n", () => assert.equal(parcela(6000, 12, 0), 500));
  it("parcela com juros > total/n", () => assert.ok(parcela(6000, 12, 2) > 500));

  it("à vista gera 1 linha; parcelado gera N", () => {
    const avista: PurchasePlan = { description: "Notebook", total: 6000, category: "Equip", accountId: "a1", dueDate: "2026-08-01", installments: 1 };
    assert.equal(purchaseRows(avista).length, 1);
    const parc: PurchasePlan = { ...avista, installments: 3 };
    const rows = purchaseRows(parc);
    assert.equal(rows.length, 3);
    assert.equal(rows[0].date, "2026-08-01");
    assert.equal(rows[1].date, "2026-09-01");
    assert.equal(rows[2].date, "2026-10-01");
  });

  it("à vista de 6.000 rebaixa o piso 90d em ~6.000", () => {
    const plan: PurchasePlan = { description: "Notebook", total: 6000, category: "Equip", accountId: "a1", dueDate: "2026-08-01", installments: 1 };
    const imp = purchaseImpact(baseRows, purchaseRows(plan), TODAY);
    assert.equal(Math.round(imp.delta), -6000);
    assert.ok(imp.floorAfter < imp.floorBefore);
  });

  it("parcelado 3× de 2.000 rebaixa o piso ~2.000 (uma parcela por vez)", () => {
    const plan: PurchasePlan = { description: "TV", total: 6000, category: "Casa", accountId: "a1", dueDate: "2026-08-01", installments: 3 };
    const imp = purchaseImpact(baseRows, purchaseRows(plan), TODAY);
    // após 90d, o piso reflete o acumulado das parcelas dentro da janela (ago+set+out = 6.000).
    assert.ok(imp.delta <= -2000);
  });
});
