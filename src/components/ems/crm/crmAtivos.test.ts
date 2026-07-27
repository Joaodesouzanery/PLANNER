import { describe, it } from "node:test";
import assert from "node:assert";
import { computeAtivosMetrics, type CrmAtivo } from "./crmAtivos";

const a = (o: Partial<CrmAtivo>): CrmAtivo => ({
  modulo_id: null, tipo: "post", titulo: "x", angulo_de_dor: null, variante_de_copy: null,
  canal: null, data: null, leads_gerados: 0, impressions: null, views: null, opens: null, notes: null, ...o,
});

describe("crmAtivos — computeAtivosMetrics", () => {
  it("agrega leads por ângulo/copy/tipo/módulo e acha os melhores", () => {
    const ativos: CrmAtivo[] = [
      a({ modulo_id: "m1", tipo: "post", angulo_de_dor: "glosa", variante_de_copy: "A", leads_gerados: 10 }),
      a({ modulo_id: "m1", tipo: "video", angulo_de_dor: "glosa", variante_de_copy: "B", leads_gerados: 5 }),
      a({ modulo_id: "m2", tipo: "post", angulo_de_dor: "atraso", variante_de_copy: "A", leads_gerados: 3 }),
    ];
    const m = computeAtivosMetrics(ativos);
    assert.equal(m.totalAtivos, 3);
    assert.equal(m.totalLeads, 18);
    assert.equal(m.bestAngulo?.key, "glosa");
    assert.equal(m.bestAngulo?.leads, 15);
    assert.equal(m.bestCopy?.key, "A"); // 10 + 3 = 13 > B(5)
    assert.equal(m.bestCopy?.leads, 13);
    assert.equal(m.porModulo.find((g) => g.key === "m1")!.leads, 15);
    assert.equal(m.porTipo.find((g) => g.key === "post")!.leads, 13);
  });

  it("filtra por módulo", () => {
    const ativos: CrmAtivo[] = [
      a({ modulo_id: "m1", angulo_de_dor: "glosa", leads_gerados: 10 }),
      a({ modulo_id: "m2", angulo_de_dor: "atraso", leads_gerados: 7 }),
    ];
    const m = computeAtivosMetrics(ativos, "m1");
    assert.equal(m.totalAtivos, 1);
    assert.equal(m.totalLeads, 10);
    assert.equal(m.bestAngulo?.key, "glosa");
  });

  it("ignora dimensão vazia e não quebra sem dados", () => {
    const m0 = computeAtivosMetrics([]);
    assert.equal(m0.totalAtivos, 0);
    assert.equal(m0.bestAngulo, null);
    const m1 = computeAtivosMetrics([a({ angulo_de_dor: null, variante_de_copy: "", leads_gerados: 4 })]);
    assert.equal(m1.porAngulo.length, 0); // ângulo null não entra
    assert.equal(m1.porCopy.length, 0); // copy "" não entra
    assert.equal(m1.totalLeads, 4);
  });
});
