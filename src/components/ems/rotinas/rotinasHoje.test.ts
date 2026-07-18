import { describe, it } from "node:test";
import assert from "node:assert";
import { rotinasHoje, type HojeClientView } from "./rotinasHoje";

const TODAY = "2026-07-20";

const views: HojeClientView[] = [
  {
    client: { id: "conab", name: "CONAB", color: "#f00", invoice_day: 22 },
    todayItems: [
      { id: "i1", title: "Conferência diária", kind: "conferencia", client_id: "conab" },
      { id: "i2", title: "Feito hoje", kind: "tarefa", client_id: "conab" },
    ],
    doneItemIds: new Set(["i2"]), // i2 já feito → não entra
    overdueTasks: [{ id: "t1", title: "Enviar relatório", due_date: "2026-07-18" }],
    openTasks: [
      { id: "t1", title: "Enviar relatório", due_date: "2026-07-18" },
      { id: "t2", title: "Ligar cliente", due_date: "2026-07-20" },
    ],
    daysUntilInvoice: 2, // NF em 2 dias → entra (lead 5)
  },
  {
    client: { id: "nery", name: "Nery Agro", color: "#0f0", invoice_day: 1 },
    todayItems: [{ id: "i3", title: "Backup", kind: "tarefa", client_id: "nery" }],
    doneItemIds: new Set(),
    overdueTasks: [],
    openTasks: [],
    daysUntilInvoice: 20, // longe → não entra
  },
];

describe("rotinasHoje", () => {
  const r = rotinasHoje(views, TODAY);

  it("conta: 1 atrasado, 3 de hoje (i1 + i3 + t2), 1 NF", () => {
    assert.equal(r.counts.atrasado, 1);
    assert.equal(r.counts.hoje, 3);
    assert.equal(r.counts.nf, 1);
    assert.equal(r.counts.total, 5);
  });
  it("item já feito (i2) não aparece", () => assert.equal(r.rows.find((x) => x.itemId === "i2"), undefined));
  it("atrasado vem primeiro; NF por último", () => {
    assert.equal(r.rows[0].kind, "overdue");
    assert.equal(r.rows[r.rows.length - 1].kind, "nf");
  });
  it("tarefa atrasada calcula dias de atraso", () => assert.equal(r.rows[0].days, 2));
  it("itens de checklist carregam itemId p/ marcar", () => {
    assert.ok(r.rows.some((x) => x.kind === "item" && x.itemId === "i1"));
  });
});
