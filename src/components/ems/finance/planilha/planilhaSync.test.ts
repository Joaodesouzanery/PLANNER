import { describe, it } from "node:test";
import assert from "node:assert";
import {
  conferir, construirAlvo, dataBaseDa, diffPlanilha, janelaDaPlanilha, mesKey, proximoVencimento,
  type LinhaAlvo, type LinhaExistente,
} from "./planilhaSync";
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

const rec = (uid: string, descricao: string, tipo: "income" | "expense", valor: number, dia: number, fim: string | null, sandbox = false) =>
  ({ uid, descricao, tipo, valor, dia, fim, parcelaAtual: null, totalParcelas: null, sandbox, linha: 1 });

// Junho e AGOSTO — julho de propósito ausente, para provar que o mês do meio não é tocado.
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
      rec("planilha:cfg:conab:income:1", "CONAB - atraso ago", "income", 1500, 22, "2026-08-22", true),
      rec("planilha:cfg:circle:income:1", "Circle", "income", 2000, 4, null),
      rec("planilha:cfg:macbook-parcela:expense:1", "Macbook (parcela)", "expense", 800, 11, "2027-04-11"),
    ],
  },
  totais: { porMes: [], saldoHoje: 5546.12 },
  avisos: [],
  ...over,
});

const CLIENTES = [{ id: "cli-circle", nome: "Circle" }, { id: "cli-iris", nome: "IRIS" }];

describe("planilhaSync — janela e data-base", () => {
  it("a janela é o CONJUNTO de meses do arquivo, não o intervalo", () => {
    const j = janelaDaPlanilha(snapshot())!;
    assert.deepEqual([...j.meses].sort(), ["2026-06", "2026-08"]);
    assert.equal(j.inicio, "2026-06-01"); // só para exibir
    assert.equal(j.fim, "2026-08-31");
    assert.equal(j.meses.has("2026-07"), false); // julho não está no arquivo → não é da planilha
  });

  it("sem data-base na Config, usa a MAIOR data — não a última linha da aba", () => {
    const snap = snapshot();
    snap.config.dataBase = null;
    // A aba pode estar ordenada do mais novo para o mais antigo; posição física não é data.
    snap.lancamentos = [snap.lancamentos[2], snap.lancamentos[0], snap.lancamentos[1]];
    assert.equal(dataBaseDa(snap), "2026-08-17");
  });
});

describe("planilhaSync — estado-alvo", () => {
  it("a âncora de saldo cobre a diferença entre o saldo declarado e o razão", () => {
    // Realizado até a data-base: +2000 −100 −46 = 1854. Declarado 5546,12 → falta 3692,12.
    const { ancora } = construirAlvo(snapshot(), { clientes: [] });
    assert.ok(ancora);
    assert.equal(ancora!.type, "income");
    assert.equal(ancora!.amount, 3692.12);
    assert.equal(ancora!.status, "reconciled");
    assert.equal(ancora!.category, "Saldo inicial"); // categoria "transfer": fora da DRE
    assert.equal(ancora!.date, "2026-05-31"); // mês anterior ao 1º mês do arquivo
  });

  it("desconta o histórico PRESERVADO — senão o saldo do app fica maior que o da planilha", () => {
    // Reimportar uma planilha enxuta (só ago) deixa jun/jul intactos no banco. Se a âncora
    // ignorasse esse caixa, ele seria contado duas vezes.
    const { ancora } = construirAlvo(snapshot(), { clientes: [], realizadoPreservado: 1900 });
    assert.equal(ancora!.amount, 1792.12); // 5546,12 − 1854 − 1900
  });

  it("sem diferença, sem âncora (o razão já explica o saldo)", () => {
    const snap = snapshot();
    snap.config.saldoHoje = 1854;
    assert.equal(construirAlvo(snap, { clientes: [] }).ancora, null);
  });

  it("recorrente entra como PLANEJADO e sem settled_at — um vencimento futuro não nasce pago", () => {
    const { linhas } = construirAlvo(snapshot(), { clientes: [] });
    const circle = linhas.find((l) => l.uid === "planilha:cfg:circle:income:1")!;
    assert.equal(circle.status, "planned");
    assert.equal(circle.settled_at, null);
    assert.equal(circle.is_recurring, true);
    assert.equal(circle.date, "2026-09-04"); // primeiro vencimento DEPOIS da data-base
    const macbook = linhas.find((l) => l.uid.includes("macbook"))!;
    assert.equal(macbook.recurrence_end_date, "2027-04-11");
    assert.equal(macbook.category, "Equipamento"); // Config não tem categoria: sai da descrição
    assert.equal(macbook.escopo, "pj");
  });

  it("recorrente com prazo já vencido não vira compromisso fantasma", () => {
    const snap = snapshot();
    // CONAB vence 22/08; com data-base em 25/08 o próximo seria 22/09, depois do fim.
    snap.config.dataBase = "2026-08-25";
    snap.config.recorrentes = [rec("planilha:cfg:conab:income:1", "CONAB", "income", 1500, 22, "2026-08-22")];
    const { linhas, encerradas } = construirAlvo(snap, { clientes: [] });
    assert.equal(encerradas, 1);
    assert.ok(!linhas.some((l) => l.uid.startsWith("planilha:cfg:")));
  });

  it("linha SANDBOX não vira compromisso (é simulação, fica fora da sobra)", () => {
    const { linhas, ignoradas } = construirAlvo(snapshot(), { clientes: [] });
    assert.equal(ignoradas, 1);
    assert.ok(!linhas.some((l) => l.uid.includes("conab")));
  });

  it("liga o cliente por palavra inteira, sem acento", () => {
    const { linhas } = construirAlvo(snapshot(), { clientes: CLIENTES });
    assert.equal(linhas.find((l) => l.uid.includes("2026-06-04"))!.cliente_id, "cli-circle");
    assert.equal(linhas.find((l) => l.description === "Supabase")!.cliente_id, null); // saída não tem cliente
  });

  it("não casa cliente no meio de outra palavra", () => {
    const snap = snapshot();
    snap.lancamentos = [lanc(1, "2026-06-04", "Turismo Irises Ltda", "income", 100)];
    assert.equal(construirAlvo(snap, { clientes: CLIENTES }).linhas[0].cliente_id, null);
  });
});

/**
 * Simula a ida-e-volta REAL pelo banco: `is_recurring` volta null, `amount` volta number e
 * `settled_at` (timestamptz) volta com hora e fuso. Sem isso, o teste de idempotência só provava
 * que a comparação é reflexiva.
 */
const existente = (l: LinhaAlvo, id: string, over: Partial<LinhaExistente> = {}): LinhaExistente => ({
  id, uid: l.uid, description: l.description, amount: l.amount, type: l.type,
  category: l.category, date: l.date, due_date: l.due_date, status: l.status,
  settled_at: l.settled_at ? `${l.settled_at}T00:00:00+00:00` : null,
  is_recurring: l.is_recurring || null,
  recurrence_interval: l.recurrence_interval, recurrence_end_date: l.recurrence_end_date,
  escopo: l.escopo, cliente_id: l.cliente_id, ...over,
});

describe("planilhaSync — diff", () => {
  const snap = snapshot();
  const janela = janelaDaPlanilha(snap);
  const { linhas } = construirAlvo(snap, { clientes: CLIENTES });
  const banco = () => linhas.map((l, i) => existente(l, `db${i}`));

  it("reimportar o MESMO arquivo não muda nada (idempotente)", () => {
    // Passa pela coerção do Postgres: is_recurring null e settled_at com hora/fuso.
    const d = diffPlanilha(linhas, banco(), [], janela);
    assert.equal(d.novos.length, 0);
    assert.equal(d.alterados.length, 0);
    assert.equal(d.removidos.length, 0);
    assert.equal(d.inalterados, linhas.length);
  });

  it("settled_at com hora e fuso (timestamptz) não vira mudança falsa", () => {
    const db = banco().map((e) => ({ ...e, settled_at: e.settled_at ? e.settled_at.replace("+00:00", "-03:00") : null }));
    assert.equal(diffPlanilha(linhas, db, [], janela).alterados.length, 0);
  });

  it("mudar o dia da quitação continua sendo detectado", () => {
    const db = banco();
    const i = db.findIndex((e) => e.settled_at);
    db[i] = { ...db[i], settled_at: "2020-01-01T00:00:00+00:00" };
    assert.deepEqual(diffPlanilha(linhas, db, [], janela).alterados[0].campos, ["settled_at"]);
  });

  it("valor editado no Excel vira ALTERADO, não uma linha nova", () => {
    // É exatamente o que o fingerprint antigo (data|descrição|valor|tipo) errava.
    const db = banco();
    const alvo = linhas.map((l) => (l.uid === linhas[1].uid ? { ...l, amount: 137.5 } : l));
    const d = diffPlanilha(alvo, db, [], janela);
    assert.equal(d.novos.length, 0);
    assert.equal(d.alterados.length, 1);
    assert.deepEqual(d.alterados[0].campos, ["amount"]);
  });

  it("cliente cadastrado DEPOIS da 1ª importação é corrigido na reimportação", () => {
    // Antes, cliente_id era gravado mas não comparado: ficava null para sempre e o MRR não via a receita.
    const semCliente = construirAlvo(snap, { clientes: [] }).linhas;
    const d = diffPlanilha(linhas, semCliente.map((l, i) => existente(l, `db${i}`)), [], janela);
    // As duas receitas da Circle (o recebimento de junho e a âncora recorrente da Config).
    assert.equal(d.alterados.length, 2);
    assert.ok(d.alterados.every((a) => a.campos.length === 1 && a.campos[0] === "cliente_id"));
  });

  it("linha apagada no Excel some do app — mas só nos meses do arquivo", () => {
    const antigo = existente(linhas[0], "db-antigo", {
      uid: "planilha:lanc:2026-01-05:aluguel:expense:1", date: "2026-01-05", due_date: "2026-01-05",
    });
    const d = diffPlanilha(linhas.slice(1), [...banco(), antigo], [], janela);
    assert.equal(d.removidos.length, 1);
    assert.equal(d.removidos[0].id, "db0"); // o lançamento de junho saiu da planilha
    assert.equal(d.foraDaJanela, 1); // janeiro é intocado: reimportar planilha enxuta não apaga histórico
  });

  it("mês AUSENTE do arquivo não é tocado, mesmo entre o primeiro e o último", () => {
    // O arquivo cobre jun e ago. Julho não está nele — como intervalo contíguo, seria apagado.
    const julho = existente(linhas[0], "db-julho", {
      uid: "planilha:lanc:2026-07-15:aluguel:expense:1", date: "2026-07-15", due_date: "2026-07-15",
    });
    const d = diffPlanilha(linhas, [...banco(), julho], [], janela);
    assert.equal(d.removidos.length, 0);
    assert.equal(d.foraDaJanela, 1);
  });

  it("uid desconhecido no banco NUNCA é apagado", () => {
    const estranho = existente(linhas[0], "db-manual", { uid: "csv:2026-06-05:algo" });
    const d = diffPlanilha(linhas, [...banco(), estranho], [], janela);
    assert.equal(d.removidos.length, 0);
  });

  it("recorrente removido da Config é removido mesmo com data fora da janela", () => {
    // A aba Config vem sempre completa no arquivo, então sincroniza inteira.
    const orfao = existente(linhas[0], "db-cfg", {
      uid: "planilha:cfg:antigo:expense:1", date: "2027-12-01", due_date: "2027-12-01",
    });
    const d = diffPlanilha(linhas, [...banco(), orfao], [], janela);
    assert.deepEqual(d.removidos.map((r) => r.id), ["db-cfg"]);
    assert.equal(d.foraDaJanela, 0);
  });

  it("uid repetido é reportado, não vira insert cego a cada importação", () => {
    const d = diffPlanilha([...linhas, linhas[0]], banco(), [], janela);
    assert.deepEqual(d.uidsRepetidos, [linhas[0].uid]);
    assert.equal(d.novos.length, 0);
  });

  it("aponta o que é de outra origem dentro da janela (a planilha é a fonte única ali)", () => {
    const dentro = existente(linhas[0], "manual-1", { uid: "", date: "2026-06-20", due_date: "2026-06-20" });
    const emJulho = existente(linhas[0], "manual-2", { uid: "", date: "2026-07-01", due_date: "2026-07-01" });
    const d = diffPlanilha(linhas, [], [dentro, emJulho], janela);
    assert.deepEqual(d.naoEhDaPlanilha.map((r) => r.id), ["manual-1"]);
  });

  it("recorrente antigo que só ATRAVESSA a janela vira aviso, nunca remoção", () => {
    // Âncora de 2025 sem prazo: as ocorrências caem em jun/ago/26 e duplicariam com a planilha —
    // mas apagá-la mataria também o histórico de 2025, que o arquivo não cobre e não repõe.
    const velho = existente(linhas[0], "seed-1", {
      uid: "", date: "2025-03-10", due_date: "2025-03-10", is_recurring: true, recurrence_end_date: null,
    });
    const encerrado = existente(linhas[0], "seed-2", {
      uid: "", date: "2025-03-10", due_date: "2025-03-10", is_recurring: true, recurrence_end_date: "2025-12-10",
    });
    const d = diffPlanilha(linhas, [], [velho, encerrado], janela);
    assert.deepEqual(d.naoEhDaPlanilha, []); // nada removível
    assert.deepEqual(d.recorrentesQueCruzam.map((r) => r.id), ["seed-1"]);
  });

  it("recorrente de outra origem que COMEÇA dentro da janela é removível", () => {
    const dentro = existente(linhas[0], "manual-rec", {
      uid: "", date: "2026-06-05", due_date: "2026-06-05", is_recurring: true, recurrence_end_date: null,
    });
    const d = diffPlanilha(linhas, [], [dentro], janela);
    assert.deepEqual(d.naoEhDaPlanilha.map((r) => r.id), ["manual-rec"]);
    assert.deepEqual(d.recorrentesQueCruzam, []);
  });
});

describe("planilhaSync — rótulo de mês", () => {
  it("entende as formas que a planilha usa, com e sem acento", () => {
    assert.equal(mesKey("jun./26"), "2026-06");
    assert.equal(mesKey("jul/2026"), "2026-07");
    assert.equal(mesKey("março/26"), "2026-03");
    assert.equal(mesKey("Julho de 2026"), "2026-07");
  });
  it("não inventa mês onde não tem", () => {
    assert.equal(mesKey("outros 26"), null); // "out" + "ros" não é outubro
    assert.equal(mesKey("Total 2026"), null);
    assert.equal(mesKey(""), null);
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
    const c = conferir(snap, construirAlvo(snap, { clientes: [] }).linhas);
    assert.equal(c.bate, false);
    assert.equal(c.porMes[0].entradasApp, 2000);
  });

  it("mês que a planilha PROJETA (fora do arquivo) não reprova a conferência", () => {
    // A Visão Geral projeta set–dez a partir dos recorrentes; não há Lançamentos nesses meses.
    const snap = snapshot({
      totais: {
        porMes: [{ mes: "jun./26", entradas: 2000, saidas: 100 }, { mes: "set./26", entradas: 2000, saidas: 800 }],
        saldoHoje: 5546.12,
      },
    });
    const c = conferir(snap, construirAlvo(snap, { clientes: [] }).linhas);
    assert.equal(c.bate, true);
    assert.equal(c.porMes[1].comparavel, false);
  });

  it("rótulo que não é mês fica marcado como não reconhecido", () => {
    const snap = snapshot({ totais: { porMes: [{ mes: "TOTAL", entradas: 15006, saidas: 0 }], saldoHoje: null } });
    const c = conferir(snap, construirAlvo(snap, { clientes: [] }).linhas);
    assert.equal(c.porMes[0].reconhecido, false);
    assert.equal(c.porMes[0].comparavel, false);
    assert.equal(c.bate, false); // nada comparável → não dá para afirmar que bate
  });

  it("a âncora de saldo não entra na conferência (não é lançamento da planilha)", () => {
    const snap = snapshot({ totais: { porMes: [{ mes: "mai./26", entradas: 0, saidas: 0 }], saldoHoje: 5546.12 } });
    const c = conferir(snap, construirAlvo(snap, { clientes: [] }).linhas);
    assert.equal(c.porMes[0].entradasApp, 0); // a âncora é 31/05 e vale 3.692
  });
});
