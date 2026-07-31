import { describe, it } from "node:test";
import assert from "node:assert";
import {
  krProgress,
  objetivoProgress,
  visaoProgress,
  semaforoOf,
  metricValue,
  type FinMetrics,
  type ObjetivoLite,
  type KrLite,
} from "./estrategiaProgress";

const FIN: FinMetrics = { mrr: 7000, reserva: 30000, patrimonio: 250000, sobra: 4000 };

describe("estrategiaProgress — semáforo 70%", () => {
  it("verde ≥ 70%", () => assert.equal(semaforoOf(0.72), "verde"));
  it("verde no limite exato 70%", () => assert.equal(semaforoOf(0.7), "verde"));
  it("amarelo entre 40% e 70%", () => assert.equal(semaforoOf(0.69), "amarelo"));
  it("amarelo no limite exato 40%", () => assert.equal(semaforoOf(0.4), "amarelo"));
  it("vermelho < 40%", () => assert.equal(semaforoOf(0.39), "vermelho"));
});

describe("estrategiaProgress — meta financeira lê o dado real (auto)", () => {
  // Objetivo financeiro "chegar a MRR 14k"; MRR real = 7k → ~50%, sem digitar nada.
  const obj: ObjetivoLite = { id: "o1", tipo: "financeira", metrica: "mrr", alvo: 14000, krs: [] };
  const p = objetivoProgress(obj, FIN);
  it("atual vem do MRR canônico", () => assert.equal(p.atual, 7000));
  it("progresso ≈ 50%", () => assert.equal(p.pct, 0.5));
  it("semáforo amarelo", () => assert.equal(p.semaforo, "amarelo"));
});

describe("estrategiaProgress — metricValue resolve as 4 métricas", () => {
  it("mrr", () => assert.equal(metricValue("mrr", FIN), 7000));
  it("reserva", () => assert.equal(metricValue("reserva", FIN), 30000));
  it("patrimonio", () => assert.equal(metricValue("patrimonio", FIN), 250000));
  it("patrimônio (acento)", () => assert.equal(metricValue("Patrimônio", FIN), 250000));
  it("sobra", () => assert.equal(metricValue("sobra", FIN), 4000));
  it("desconhecida → null", () => assert.equal(metricValue("vendas", FIN), null));
});

describe("estrategiaProgress — KR operacional soma ações feitas", () => {
  // 6 ações, 3 done → 50%.
  const kr: KrLite = {
    id: "k1",
    tipo: "operacional",
    acoes: [
      { id: "a1", status: "done" },
      { id: "a2", status: "done" },
      { id: "a3", status: "done" },
      { id: "a4", status: "doing" },
      { id: "a5", status: "todo" },
      { id: "a6", status: "todo" },
    ],
  };
  const p = krProgress(kr, FIN);
  it("atual = 3 feitas", () => assert.equal(p.atual, 3));
  it("alvo = 6 totais", () => assert.equal(p.alvo, 6));
  it("progresso = 50%", () => assert.equal(p.pct, 0.5));
  it("KR sem ações = 0%", () => assert.equal(krProgress({ id: "k0", tipo: "operacional", acoes: [] }, FIN).pct, 0));
});

describe("estrategiaProgress — objetivo operacional é rollup dos KRs", () => {
  // KR-A 100% (2/2), KR-B 0% (0/2) → média 50%.
  const obj: ObjetivoLite = {
    id: "o1",
    tipo: "operacional",
    krs: [
      { id: "kA", tipo: "operacional", acoes: [{ id: "1", status: "done" }, { id: "2", status: "done" }] },
      { id: "kB", tipo: "operacional", acoes: [{ id: "3", status: "todo" }, { id: "4", status: "todo" }] },
    ],
  };
  it("média dos KRs = 50%", () => assert.equal(objetivoProgress(obj, FIN).pct, 0.5));

  // Marcar mais uma ação done sobe o objetivo (rollup): KR-B vira 50% → média 75% → verde.
  const obj2: ObjetivoLite = {
    ...obj,
    krs: [obj.krs[0], { id: "kB", tipo: "operacional", acoes: [{ id: "3", status: "done" }, { id: "4", status: "todo" }] }],
  };
  const p2 = objetivoProgress(obj2, FIN);
  it("done a mais sobe pra 75%", () => assert.equal(p2.pct, 0.75));
  it("75% = verde", () => assert.equal(p2.semaforo, "verde"));
});

describe("estrategiaProgress — visão", () => {
  it("com métrica financeira própria usa o dado real", () => {
    const p = visaoProgress({ id: "v1", metrica_alvo: "patrimonio", valor_alvo: 500000, objetivos: [] }, FIN);
    assert.equal(p.atual, 250000);
    assert.equal(p.pct, 0.5);
  });
  it("sem métrica própria = média dos objetivos", () => {
    const p = visaoProgress(
      {
        id: "v1",
        objetivos: [
          { id: "o1", tipo: "financeira", metrica: "mrr", alvo: 14000, krs: [] }, // 50%
          { id: "o2", tipo: "financeira", metrica: "sobra", alvo: 8000, krs: [] }, // 50%
        ],
      },
      FIN,
    );
    assert.equal(p.pct, 0.5);
  });
});
