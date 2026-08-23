import { describe, it } from "node:test";
import assert from "node:assert";
import {
  parseValor, parseData, parseTipo, parseSituacao, normalizarCategoria,
  fimPorParcelas, lerLancamentos, lerConfig, type Grade,
} from "./planilhaNormalize";

const HOJE = "2026-08-20";

describe("planilha — leitura de célula", () => {
  it("valor pt-BR", () => {
    assert.equal(parseValor("R$ 1.234,56"), 1234.56);
    assert.equal(parseValor("R$ 5.546,12"), 5546.12);
    assert.equal(parseValor("R$ 1.500"), 1500);
    assert.equal(parseValor("2.000,00"), 2000);
    assert.equal(parseValor(800), 800);
    assert.equal(parseValor("(R$ 495)"), -495); // parênteses = negativo
    assert.equal(parseValor(""), null);
    assert.equal(parseValor("—"), null);
  });

  it("data dd/mm/aa, dd/mm/aaaa e ISO", () => {
    assert.equal(parseData("04/06/26"), "2026-06-04");
    assert.equal(parseData("20/08/2026"), "2026-08-20");
    assert.equal(parseData("2026-08-20"), "2026-08-20");
    assert.equal(parseData("31/04/2026"), "2026-04-30"); // dia inválido é grudado no fim do mês
    assert.equal(parseData("sem data"), null);
  });

  it("tipo e situação", () => {
    assert.equal(parseTipo("Entrada"), "income");
    assert.equal(parseTipo("Saída"), "expense");
    assert.equal(parseTipo("saida"), "expense");
    assert.equal(parseSituacao("Pago", "2026-06-05", HOJE), "reconciled");
    assert.equal(parseSituacao("Recebido", "2026-06-05", HOJE), "reconciled");
    // "Atrasado" não vira estado: fica lançado e não-pago; o app deriva o atraso pela data.
    assert.equal(parseSituacao("Atrasado", "2026-06-05", HOJE), "confirmed");
    assert.equal(parseSituacao("", "2026-09-30", HOJE), "planned"); // futuro sem situação
  });
});

describe("planilha — normalização de categoria (as correções)", () => {
  it("ENTRADA nunca fica com categoria de despesa", () => {
    // Na planilha: "RAONI (via Sauz Comunicação)" e "Circle — software (real)" vêm como Operacional (PJ).
    assert.equal(normalizarCategoria("Operacional (PJ)", "RAONI (via Sauz Comunicação)", "income"), "Receita — Cliente");
    assert.equal(normalizarCategoria("(sem categoria)", "IRIS - Pagamento", "income"), "Receita — Cliente");
    assert.equal(normalizarCategoria("Receita", "CIRCLE - Pagamento", "income"), "Receita — Cliente");
  });

  it("guarda-chuva 'Operacional (PJ)' é desmembrado pela descrição", () => {
    assert.equal(normalizarCategoria("Operacional (PJ)", "Macbook (parcelado 10x)", "expense"), "Equipamento");
    assert.equal(normalizarCategoria("Operacional (PJ)", "Supabase", "expense"), "Infra / COGS");
    assert.equal(normalizarCategoria("Operacional (PJ)", "Claude Code", "expense"), "Ferramentas");
    assert.equal(normalizarCategoria("Operacional (PJ)", "Contador", "expense"), "Contador / Fiscal");
    assert.equal(normalizarCategoria("Operacional (PJ)", "Contabilidade", "expense"), "Contador / Fiscal");
    assert.equal(normalizarCategoria("Operacional (PJ)", "Domínio AgroTorre", "expense"), "Ferramentas");
  });

  it("imposto cai em Impostos (linha de DEDUÇÃO da DRE), não em despesa operacional", () => {
    assert.equal(normalizarCategoria("Operacional (PJ)", "DAS — Simples Nacional", "expense"), "Impostos");
    assert.equal(normalizarCategoria("DAS / Imposto Simples", "DAS", "expense"), "Impostos");
  });

  it("categorias da planilha sem espaço na barra passam a casar", () => {
    assert.equal(normalizarCategoria("Lazer/Social", "Outback", "expense"), "Lazer / Social");
    assert.equal(normalizarCategoria("Saúde/Esporte", "Cerrado MMA", "expense"), "Saúde / Esporte");
    assert.equal(normalizarCategoria("Alimentação (casa)", "Mercado", "expense"), "Alimentação (casa)");
    assert.equal(normalizarCategoria("Doacao", "Doacao Fralda", "expense"), "Doações");
  });

  it("categoria vazia cai na descrição antes de virar Outros", () => {
    assert.equal(normalizarCategoria("", "Gasolina Cascol", "expense"), "Transporte");
    assert.equal(normalizarCategoria("", "xyz sem sentido", "expense"), "Outros");
  });
});

describe("planilha — fim da recorrência a partir das parcelas", () => {
  // As 5 datas conferidas contra a coluna "Fim" da planilha (data-base 20/08/2026).
  it("bate com as datas que a planilha calculou", () => {
    assert.equal(fimPorParcelas("2026-08-20", 11, 2, 10), "2027-04-11"); // Macbook
    assert.equal(fimPorParcelas("2026-08-20", 12, 2, 12), "2027-06-12"); // Seguro Macbook
    assert.equal(fimPorParcelas("2026-08-20", 17, 2, 3), "2026-09-17"); // Terno
    assert.equal(fimPorParcelas("2026-08-20", 6, 2, 7), "2027-01-06"); // Dívida Nubank
    assert.equal(fimPorParcelas("2026-08-20", 18, 2, 11), "2027-05-18"); // Dívida Itaú
    assert.equal(fimPorParcelas("2026-08-20", 15, 2, 14), "2027-08-15"); // Dívida BB
  });
  it("sem parcelas → sem fim", () => {
    assert.equal(fimPorParcelas("2026-08-20", 4, 0, 0), null);
  });
});

describe("planilha — aba Lançamentos", () => {
  const grade: Grade = [
    ["LANÇAMENTOS REAIS (jun–ago/26) — categorias normalizadas"],
    [],
    ["Data", "Descrição", "Categoria", "Tipo", "Situação", "Valor"],
    ["04/06/26", "CIRCLE - Pagamento", "Receita", "Entrada", "Atrasado", "R$ 2.000,00"],
    ["17/08/26", "Zigpay", "Lazer/Social", "Saída", "Pago", "R$ 46,00"],
    ["17/08/26", "Zigpay", "Lazer/Social", "Saída", "Pago", "R$ 10,00"],
    ["17/08/26", "Zigpay", "Lazer/Social", "Saída", "Pago", "R$ 46,00"],
    ["17/08/26", "Zigpay", "Lazer/Social", "Saída", "Pago", "R$ 10,00"],
    [],
    ["", "", "", "", "", ""],
  ];

  it("lê as linhas e ignora vazias", () => {
    const { linhas } = lerLancamentos(grade, HOJE);
    assert.equal(linhas.length, 5);
  });

  it("as 4 repetições de Zigpay ganham identidade própria (não colapsam no sync)", () => {
    const { linhas } = lerLancamentos(grade, HOJE);
    const zig = linhas.filter((l) => l.descricao === "Zigpay");
    assert.equal(zig.length, 4);
    assert.equal(new Set(zig.map((l) => l.uid)).size, 4); // 4 uids distintos
    assert.equal(zig.reduce((a, l) => a + l.valor, 0), 112);
  });

  it("aplica as correções de categoria e situação", () => {
    const { linhas } = lerLancamentos(grade, HOJE);
    const circle = linhas[0];
    assert.equal(circle.tipo, "income");
    assert.equal(circle.categoria, "Receita — Cliente");
    assert.equal(circle.situacao, "confirmed"); // "Atrasado" = lançado e não pago
    assert.equal(linhas[1].categoria, "Lazer / Social");
    assert.equal(linhas[1].situacao, "reconciled");
  });
});

describe("planilha — aba Config", () => {
  const grade: Grade = [
    ["CONFIG — BAIXE o arquivo e edite no Excel/Sheets."],
    ["Saldo em caixa hoje (BB + Nubank)", "R$ 5.546"],
    [" · Nubank PJ (clientes pagam aqui)", "R$ 5.155,71"],
    ["Data-base", "20/08/2026"],
    [],
    ["Descrição", "Tipo", "Valor", "Dia", "Fim (vazio = sem fim)", "Parcela atual", "Total parcelas"],
    ["CONAB - atraso ago (previsão)", "Entrada", "R$ 1.500", 22, "22/08/2026", "", ""],
    ["", "", "", "", "", "", ""],
    ["", "", "", "", "", "", ""],
    ["Circle", "Entrada", "R$ 2.000", 4, "", "", ""],
    ["IRIS", "Entrada", "R$ 2.000", 8, "", "", ""],
    ["Macbook (parcela)", "Saída", "R$ 800", 11, "", 2, 10],
    ["DAS / Imposto Simples", "Saída", "R$ 495", 20, "", "", ""],
    [],
    ["GASTO VARIÁVEL — orçado por categoria (edite)"],
    ["Lazer / Social", "R$ 800"],
    ["Mercado / casa", "R$ 350"],
    ["Transporte (gasolina, uber)", "R$ 400"],
    ["Variável total / mês", "R$ 1.900"],
    [],
    ["(−) Reserva já separada", "R$ 3.000"],
    ["(−) Provisionado p/ objetivos (viagem etc.)", "R$ 0"],
  ];

  it("lê saldo, data-base, variável e reserva", () => {
    const { config } = lerConfig(grade, HOJE);
    assert.equal(config.saldoHoje, 5546);
    assert.equal(config.dataBase, "2026-08-20");
    assert.equal(config.variavelTotal, 1900);
    assert.equal(config.reservaSeparada, 3000);
    assert.equal(config.provisionado, 0);
  });

  it("lê os recorrentes e calcula o fim pelas parcelas", () => {
    const { config } = lerConfig(grade, HOJE);
    const macbook = config.recorrentes.find((r) => r.descricao.startsWith("Macbook"));
    assert.ok(macbook);
    assert.equal(macbook!.valor, 800);
    assert.equal(macbook!.dia, 11);
    assert.equal(macbook!.fim, "2027-04-11");
    assert.equal(macbook!.tipo, "expense");
    const circle = config.recorrentes.find((r) => r.descricao === "Circle");
    assert.equal(circle!.fim, null); // sem prazo = entra no MRR
    assert.equal(circle!.tipo, "income");
  });

  it("marca as 3 primeiras linhas como SANDBOX (simulação, fora da sobra)", () => {
    const { config } = lerConfig(grade, HOJE);
    const conab = config.recorrentes.find((r) => r.descricao.startsWith("CONAB"));
    assert.equal(conab!.sandbox, true);
    // Circle está na 4ª linha física (depois das 2 vazias do bloco de simulação) → permanente.
    const circle = config.recorrentes.find((r) => r.descricao === "Circle");
    assert.equal(circle!.sandbox, false);
  });

  it("duas linhas iguais na Config ganham uids distintos", () => {
    // Sem contador, a segunda nunca casava no diff: entrava como "nova" a cada importação.
    const repetida: Grade = [
      ["Descrição", "Tipo", "Valor", "Dia", "Fim (vazio = sem fim)", "Parcela atual", "Total parcelas"],
      ["", "", "", "", "", "", ""], ["", "", "", "", "", "", ""], ["", "", "", "", "", "", ""],
      ["Aluguel", "Saída", "R$ 1.000", 5, "", "", ""],
      ["Aluguel", "Saída", "R$ 1.000", 5, "", "", ""],
    ];
    const { config } = lerConfig(repetida, HOJE);
    const uids = config.recorrentes.map((r) => r.uid);
    assert.equal(uids.length, 2);
    assert.equal(new Set(uids).size, 2);
  });

  it("lê os tetos do bloco de gasto variável", () => {
    const { config } = lerConfig(grade, HOJE);
    const porCat = Object.fromEntries(config.tetos.map((t) => [t.categoria, t.teto]));
    assert.equal(porCat["Lazer / Social"], 800);
    assert.equal(porCat["Alimentação (casa)"], 350); // "Mercado / casa" → alias
    assert.equal(porCat["Transporte"], 400);
  });
});
