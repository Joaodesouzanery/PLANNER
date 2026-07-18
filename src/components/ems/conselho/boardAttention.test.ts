import { describe, it } from "node:test";
import assert from "node:assert";
import { buildBoardAttention, attentionCounts } from "./boardAttention";

describe("boardAttention", () => {
  const items = buildBoardAttention({
    financeAlerts: [
      { key: "receber:conab", severity: "high", message: "A receber vencido: CONAB", date: "2026-07-10" },
      { key: "reserva:baixa", severity: "medium", message: "Reserva abaixo do alvo" },
    ],
    obrigacoes: [{ id: "das", titulo: "DAS", dueDate: "2026-07-20", overdue: false }],
    riscos: [{ id: "r1", titulo: "Cliente único", score: 20, semRevisao: true }],
    documentos: [{ id: "d1", titulo: "Alvará", expiraEmDias: 5 }],
    tarefas: [{ id: "t1", titulo: "Enviar proposta", atrasadaDias: 9 }],
    rotinas: { atrasado: 2, hoje: 5, nf: 1 },
    comercial: [{ id: "c1", titulo: "Fazenda X", paradoDias: 25 }],
    inboxBacklog: 12,
    capacidade: [{ id: "p1", nome: "João", sobrecarga: true }],
  });

  it("reds vêm primeiro", () => assert.equal(items[0].severidade, "red"));
  it("junta todas as frentes (finanças, obrigações, riscos, docs, tarefas, rotinas, comercial, inbox, capacidade)", () => {
    const mods = new Set(items.map((i) => i.modulo));
    ["financas", "obrigacoes", "riscos", "documentos", "tarefas", "rotinas", "comercial", "inbox", "capacidade"].forEach((m) => assert.ok(mods.has(m as any), `faltou ${m}`));
  });
  it("cada item tem deeplink", () => assert.ok(items.every((i) => i.deeplink)));
  it("sem duplicados por id", () => {
    const ids = items.map((i) => i.id);
    assert.equal(ids.length, new Set(ids).size);
  });
  it("contagem: CONAB(high), risco s/ revisão, doc≤7, comercial>21, inbox≥10 → reds", () => {
    const c = attentionCounts(items);
    assert.ok(c.red >= 4);
    assert.equal(c.total, items.length);
  });
  it("rotinas viram 3 itens (atrasado red, hoje yellow, nf low)", () => {
    assert.ok(items.some((i) => i.id === "rot:atrasado" && i.severidade === "red"));
    assert.ok(items.some((i) => i.id === "rot:hoje" && i.severidade === "yellow"));
    assert.ok(items.some((i) => i.id === "rot:nf" && i.severidade === "low"));
  });
});
