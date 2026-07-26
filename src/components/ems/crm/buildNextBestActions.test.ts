import { describe, it } from "node:test";
import assert from "node:assert";
import { buildNextBestActions, forecastPonderado } from "./buildNextBestActions.ts";

const TODAY = "2026-07-25";

describe("buildNextBestActions", () => {
  const items = buildNextBestActions({
    today: TODAY,
    nextActions: [
      { customerId: "iris", customerName: "IRIS", contactId: "c1", date: "2026-07-10", desc: "ligar" }, // 15d atraso → red
      { customerId: "circle", customerName: "CIRCLE", contactId: "c2", date: "2026-07-23", desc: "email" }, // 2d atraso → yellow
      { customerId: "conab", customerName: "CONAB", contactId: "c3", date: "2026-08-01" }, // futura → ignora
    ],
    deals: [
      { id: "d1", customerId: "iris", customerName: "IRIS", title: "Expansão", value: 10000, stage: "proposta", expected_close_date: "2026-07-20" }, // vencido → red
      { id: "d2", customerId: "circle", customerName: "CIRCLE", title: "Upsell", value: 5000, stage: "proposta", expected_close_date: "2026-07-30" }, // 5d → yellow
      { id: "d3", customerId: "conab", customerName: "CONAB", title: "Ganho", value: 9, stage: "ganho", expected_close_date: "2026-07-01" }, // fechado → ignora
    ],
    concentracao: { customerId: "iris", customerName: "IRIS", top1Share: 0.52 }, // >0.5 → red
    esfriando: [{ customerId: "conab", customerName: "CONAB", dias: 70, ongoing: 1500 }], // >60 → red
  });

  it("reds primeiro", () => assert.equal(items[0].severidade, "red"));
  it("ignora follow-up futuro e deal fechado", () => {
    assert.ok(!items.some((x) => x.customerId === "conab" && x.tipo === "follow_up"));
    assert.ok(!items.some((x) => x.tipo.startsWith("deal") && x.customerName === "CONAB"));
  });
  it("gera as 6 ações esperadas", () => {
    // 2 follow-ups + 2 deals + 1 concentração + 1 esfriando = 6
    assert.equal(items.length, 6);
  });
  it("follow-up muito vencido é red; recente é yellow", () => {
    assert.equal(items.find((x) => x.customerName === "IRIS" && x.tipo === "follow_up")!.severidade, "red");
    assert.equal(items.find((x) => x.customerName === "CIRCLE" && x.tipo === "follow_up")!.severidade, "yellow");
  });
  it("dedup por id", () => {
    const ids = items.map((x) => x.id);
    assert.equal(ids.length, new Set(ids).size);
  });
});

describe("buildNextBestActions — streams enriquecidos (oferta/onboarding)", () => {
  const items = buildNextBestActions({
    today: TODAY,
    onboardingGaps: [
      { customerId: "iris", customerName: "IRIS", pendentes: 3 }, // yellow
      { customerId: "circle", customerName: "CIRCLE", pendentes: 0 }, // ignora (0 pendentes)
    ],
    ofertas: [
      { customerId: "conab", customerName: "CONAB", titulo: "propor expansão/upsell", valor: 5000 }, // low
    ],
  });

  it("gap de onboarding com pendentes vira yellow; 0 pendentes é ignorado", () => {
    const ob = items.filter((x) => x.tipo === "onboarding");
    assert.equal(ob.length, 1);
    assert.equal(ob[0].severidade, "yellow");
  });
  it("oferta vira low e não outranquea problemas", () => {
    const of = items.find((x) => x.tipo === "oferta");
    assert.equal(of?.severidade, "low");
    assert.equal(items[items.length - 1].tipo, "oferta"); // low fica por último
  });
});

describe("forecastPonderado", () => {
  it("só deals abertos, Σ valor×prob", () => {
    const f = forecastPonderado([
      { value: 10000, probability: 40, stage: "proposta" },
      { value: 5000, probability: 80, stage: "proposta" },
      { value: 9999, probability: 100, stage: "ganho" }, // fechado, ignora
    ]);
    assert.equal(f, 8000);
  });
});
