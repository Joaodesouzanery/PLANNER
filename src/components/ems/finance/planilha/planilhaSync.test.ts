import { describe, it } from "node:test";
import assert from "node:assert";
import { conferir, construirAlvo, diffPlanilha, proximoVencimento, type LinhaAlvo, type LinhaExistente } from "./planilhaSync";
import type { SnapshotPlanilha } from "./planilhaNormalize";

const BASE = "2026-08-20";

describe("planilhaSync — próximo vencimento do recorrente", () => {
  // Conferido contra o Diário da própria planilha (data-base 20/08/2026).
  it("dispara depois da data-base, nunca no mês já fechado", () => {
    assert.equal(proximoVencimento(BASE, 4), "2026-09-04"); // Circle: Diário mostra 2.000 em 04/09
    assert.equal(proximoVencimento(BASE, 22), "2026-08-22"); // CONAB: 22/08 ainda é depois de 20/08
    // DAS dia 20 = a própria data-base. Já foi pago em 08/08 (está nos Lançamentos);
    // cobrar de novo em 20/08 duplicaria o mês.
    assert.equal(proximoVencimento(BASE, 20), "2026-09-20");
  });
  it("dia 31 é grudado no fim do mês curto", () => {
    assert.equal(proximoVencimento("2026-08-31", 31), "2026-09-30");
  });
});

const lanc = (n: number, data: string, descricao: string, tipo: "income" | "expense", valor: number, situacao: "reconciled" | "confirmed" | "planned" = "reconciled") => ({
  uid: `planilha:lanc:${data}:${descricao.toLowerCase()}:${tipo}:${n}`,
  data, descricao, categoria: tipo === "income" ? "Receita — Cliente" : "Outros",
  categoriaOriginal: null, tipo, situacao, valor, linha: n,
});

const snapshot = (over: Partial<SnapshotPlanilha> = {}): SnapshotPlanilha => ({
  lancamentos: [
    lanc(1, "2026-06-04", "CIRCLE - Pagamento", "income", 2000),
    lanc(2, "2026-06-10", "Supabase", "expense", 100),
    lanc(3, "2026-08-17", "Zigpay", "expense", 46),
  ],
  config: {
    saldoHoje: 5546.12, dataBase: BASE, tetos: [], variavelTotal: 1900,
    reservaSeparada: 3000, provisionado: 0,
    recorrentes: [
      { uid: "planilha:cfg:conab:income", descricao: "CONAB - atraso ago", tipo: "income", valor: 1500, dia: 22, fim: "2026-08-22", parcelaAtual: null, totalParcelas: null, sandbox: true, linha: 7 },
      { uid: "planilha:cfg:circle:income", descricao: "Circle", tipo: "income", valor: 2000, dia: 4, fim: null, parcelaAtual: null, totalParcelas: null, sandbox: false, linha: 10 },
      { uid: "planilha:cfg:macbook:expense", descricao: "Macbook (parcela)", tipo: "expense", valor: 800, dia: 11, fim: "2027-04-11", parcelaAtual: 2, totalParcelas: 10, sandbox: false, linha: 12 },
    ],
  },
  totais: { porMes: [], saldoHoje: 5546.12 },
  avisos: [],
  ...over,
});

describe("planilhaSync — estado-alvo", () => {
  it("a âncora de saldo cobre a diferença entre o saldo declarado e o razão", () => {
    // Realizado até a data-base: +2000 −100 −46 = 1854. Declarado 5546,12 → falta 3692,12.
    const { ancora } = construirAlvo(snapshot(), { clientes: [] });
    assert.ok(ancora);
    assert.equal(ancora!.type, "income");
    assert.equal(ancora!.amount, 3692.12);
    assert.equal(ancora!.status, "reconciled");
    // Fica no mês ANTERIOR ao primeiro lançamento, para não inflar o resultado de junho.
    assert.equal(ancora!.date, "2026-05-31");
  });

  it("sem diferença, sem âncora (razão já explica o saldo)", () => {
    const snap = snapshot();
    snap.config.saldoHoje = 1854;
    const { ancora } = construirAlvo(snap, { clientes: [] });
    assert.equal(ancora, null);
  });

  it("recorrente da Config entra como PLANEJADO — senão as ocorrências passadas viram 'pagas' e duplicam", () => {
    const { linhas } = construirAlvo(snapshot(), { clientes: [] });
    const circle = linhas.find((l) => l.uid === "planilha:cfg:circle:income")!;
    assert.equal(circle.status, "planned");
    assert.equal(circle.is_recurring, true);
    assert.equal(circle.date, "2026-09-04"); // primeiro vencimento DEPOIS da data-base
    assert.equal(circle.recurrence_end_date, null);
    const macbook = linhas.find((l) => l.uid === "planilha:cfg:macbook:expense")!;
    assert.equal(macbook.recurrence_end_date, "2027-04-11");
    assert.equal(macbook.category, "Equipamento"); // Config não tem categoria: sai da descrição
  });

  it("linha SANDBOX não vira compromisso (é simulação, fica fora da sobra)", () => {
    const { linhas, ignoradas } = construirAlvo(snapshot(), { clientes: [] });
    assert.equal(ignoradas, 1);
    assert.ok(!linhas.some((l) => l.uid.includes("conab")));
  });

  it("liga o cliente pelo nome na descrição da receita", () => {
    const { linhas } = construirAlvo(snapshot(), { clientes: ["Circle", "IRIS"] });
    assert.equal(linhas.find((l) => l.uid.includes("2026-06-04"))!.cliente, "Circle");
    assert.equal(linhas.find((l) => l.description === "Supabase")!.cliente, null); // saída não tem cliente
  });
});

const existente = (l: LinhaAlvo, id: string, over: Partial<LinhaExistente> = {}): LinhaExistente => ({
  id, uid: l.uid, description: l.description, amount: l.amount, type: l.type,
  category: l.category, date: l.date, due_date: l.due_date, status: l.status,
  is_recurring: l.is_recurring, recurrence_end_date: l.recurrence_end_date, ...over,
});

describe("planilhaSync — diff", () => {
  const { linhas } = construirAlvo(snapshot(), { clientes: [] });

  it("reimportar o MESMO arquivo não muda nada (idempotente)", () => {
    const d = diffPlanilha(linhas, linhas.map((l, i) => existente(l, `db${i}`)));
    assert.equal(d.novos.length, 0);
    assert.equal(d.alterados.length, 0);
    assert.equal(d.removidos.length, 0);
    assert.equal(d.inalterados, linhas.length);
  });

  it("valor editado no Excel vira ALTERADO, não uma linha nova", () => {
    // É exatamente o que o fingerprint antigo (data|descrição|valor|tipo) errava.
    const banco = linhas.map((l, i) => existente(l, `db${i}`));
    banco[1] = { ...banco[1], amount: 100 };
    const alvo = linhas.map((l) => (l.uid === linhas[1].uid ? { ...l, amount: 137.5 } : l));
    const d = diffPlanilha(alvo, banco);
    assert.equal(d.novos.length, 0);
    assert.equal(d.alterados.length, 1);
    assert.deepEqual(d.alterados[0].campos, ["amount"]);
  });

  it("linha apagada no Excel some do app — mas só dentro da janela do arquivo", () => {
    const banco = linhas.map((l, i) => existente(l, `db${i}`));
    const antigo = existente(linhas[0], "db-antigo", {
      uid: "planilha:lanc:2026-01-05:aluguel:expense:1", date: "2026-01-05", due_date: "2026-01-05",
    });
    const d = diffPlanilha(linhas.slice(1), [...banco, antigo]);
    // Janela = jun..ago em meses inteiros. Mesmo sendo a linha mais antiga que saiu do arquivo,
    // 04/06 está dentro de junho → removido (a janela por mês evita o órfão eterno).
    assert.equal(d.janela!.inicio, "2026-06-01");
    assert.equal(d.janela!.fim, "2026-08-31");
    assert.equal(d.removidos.length, 1);
    assert.equal(d.removidos[0].id, "db0");
    // O de janeiro está fora da janela: preservado (reimportar planilha enxuta não apaga histórico).
    assert.equal(d.foraDaJanela, 1);
  });

  it("recorrente removido da Config é removido mesmo com data fora da janela", () => {
    // A aba Config vem sempre completa no arquivo, então sincroniza inteira.
    const orfao = existente(linhas[0], "db-cfg", {
      uid: "planilha:cfg:antigo:expense", date: "2027-12-01", due_date: "2027-12-01",
    });
    const d = diffPlanilha(linhas, [...linhas.map((l, i) => existente(l, `db${i}`)), orfao]);
    assert.equal(d.removidos.length, 1);
    assert.equal(d.removidos[0].id, "db-cfg");
    assert.equal(d.foraDaJanela, 0);
  });

  it("aponta o que é de outra origem dentro da janela (a planilha é a fonte única ali)", () => {
    const outra = existente(linhas[0], "manual-1", { uid: "", date: "2026-07-01", due_date: "2026-07-01" });
    const fora = existente(linhas[0], "manual-2", { uid: "", date: "2026-02-01", due_date: "2026-02-01" });
    const d = diffPlanilha(linhas, [], [outra, fora]);
    assert.equal(d.naoEhDaPlanilha.length, 1);
    assert.equal(d.naoEhDaPlanilha[0].id, "manual-1");
  });

  it("recorrente antigo de outra origem conta como dentro da janela se ainda gera ocorrências nela", () => {
    // Âncora de 2025 sem data-fim: a data dela está fora, mas as ocorrências caem em jun–ago/26
    // e duplicariam com os lançamentos da planilha. Tem que ser apontada.
    const velho = existente(linhas[0], "seed-1", {
      uid: "", date: "2025-03-10", due_date: "2025-03-10", is_recurring: true, recurrence_end_date: null,
    });
    const encerrado = existente(linhas[0], "seed-2", {
      uid: "", date: "2025-03-10", due_date: "2025-03-10", is_recurring: true, recurrence_end_date: "2025-12-10",
    });
    const d = diffPlanilha(linhas, [], [velho, encerrado]);
    assert.deepEqual(d.naoEhDaPlanilha.map((r) => r.id), ["seed-1"]);
  });
});

describe("planilhaSync — conferência contra os totais declarados", () => {
  it("bate quando a soma do app é igual à da planilha", () => {
    const snap = snapshot({ totais: { porMes: [{ mes: "jun./26", entradas: 2000, saidas: 100 }], saldoHoje: 5546.12 } });
    const { linhas } = construirAlvo(snap, { clientes: [] });
    const c = conferir(snap, linhas);
    assert.equal(c.bate, true);
    assert.equal(c.porMes[0].entradasApp, 2000);
  });

  it("acusa a diferença quando não bate", () => {
    const snap = snapshot({ totais: { porMes: [{ mes: "jun/2026", entradas: 5400, saidas: 4129 }], saldoHoje: 5546.12 } });
    const { linhas } = construirAlvo(snap, { clientes: [] });
    const c = conferir(snap, linhas);
    assert.equal(c.bate, false);
    assert.equal(c.porMes[0].entradasPlanilha, 5400);
    assert.equal(c.porMes[0].entradasApp, 2000);
  });

  it("a âncora de saldo não entra na conferência (não é lançamento da planilha)", () => {
    const snap = snapshot({ totais: { porMes: [{ mes: "mai./26", entradas: 0, saidas: 0 }], saldoHoje: 5546.12 } });
    const { linhas } = construirAlvo(snap, { clientes: [] });
    assert.equal(conferir(snap, linhas).porMes[0].entradasApp, 0); // âncora é 31/05 e vale 3.692
  });
});
