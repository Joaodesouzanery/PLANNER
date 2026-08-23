import { describe, it } from "node:test";
import assert from "node:assert";
import { buildCategoryMonthPivot, hojeLocalIso, janelaDeMeses, pivotParaSerie, rotuloMes } from "./financeCategoryPivot";
import type { PeriodRow } from "./financePeriodSource";

// Mês fechado: nenhum teste depende do relógio de quem roda a suíte.
const HOJE = "2026-09-15";

const row = (date: string, category: string | null, amount: number, over: Partial<PeriodRow> = {}): PeriodRow => ({
  id: `${date}-${category}-${amount}`, date, type: "expense", amount, category,
  description: category || "x", sourceId: null, accountId: null, sourceType: "transaction",
  paid: true, realized: true, projected: false, synthetic: false, ...over,
});

describe("pivô — janela de meses", () => {
  it("vira o ano para trás sem erro", () => {
    assert.deepEqual(janelaDeMeses("2026-08", 3), ["2026-06", "2026-07", "2026-08"]);
    assert.deepEqual(janelaDeMeses("2026-02", 4), ["2025-11", "2025-12", "2026-01", "2026-02"]);
    assert.deepEqual(janelaDeMeses("2026-01", 1), ["2026-01"]);
    assert.deepEqual(janelaDeMeses("2026-12", 13)[0], "2025-12");
  });
  it("rótulo curto pt-BR", () => {
    assert.equal(rotuloMes("2026-06"), "jun/26");
    assert.equal(rotuloMes("2025-12"), "dez/25");
  });
  it("hoje usa o fuso local, não UTC", () => {
    // 23h30 de 31/08 em Brasília já é 01/09 em UTC — o mês do pivô viraria errado.
    assert.equal(hojeLocalIso(new Date(2026, 7, 31, 23, 30)), "2026-08-31");
  });
});

describe("pivô categoria × mês", () => {
  // Recorte real da planilha (jun–ago/26).
  const rows = [
    row("2026-06-10", "Alimentação (casa)", 300),
    row("2026-07-10", "Alimentação (casa)", 400),
    row("2026-08-10", "Alimentação (casa)", 500),
    row("2026-06-15", "Lazer / Social", 800),
    row("2026-07-15", "Lazer / Social", 600),
    row("2026-08-17", "Lazer / Social", 112), // as 4 linhas de Zigpay somadas
    row("2026-08-20", "Impostos", 495),
    row("2026-05-01", "Moradia", 9999), // fora da janela de 3 meses
  ];
  const pivot = () => buildCategoryMonthPivot(rows, { ate: "2026-08", hoje: HOJE });

  it("monta a matriz dos 3 meses e ignora o que está fora", () => {
    const p = pivot();
    assert.deepEqual(p.meses, ["2026-06", "2026-07", "2026-08"]);
    assert.deepEqual(p.rotulos, ["jun/26", "jul/26", "ago/26"]);
    assert.ok(!p.linhas.some((l) => l.categoria === "Moradia"));
    assert.deepEqual(p.totalPorMes, [1100, 1000, 1107]);
    assert.equal(p.total, 3207);
    assert.equal(p.parcialNoFim, false); // ago/26 já fechou (hoje é 15/09)
  });

  it("ordena por peso: quem mais gasta primeiro", () => {
    const p = pivot();
    assert.deepEqual(p.linhas.map((l) => l.categoria), ["Lazer / Social", "Alimentação (casa)", "Impostos"]);
    assert.equal(p.linhas[0].total, 1512);
    assert.equal(p.linhas[1].media, 400);
  });

  it("tendência compara o último mês com a média dos anteriores, e diz qual é a base", () => {
    const p = pivot();
    const lazer = p.linhas.find((l) => l.categoria === "Lazer / Social")!;
    assert.equal(lazer.tendencia, -84); // média jun/jul = 700; ago = 112
    assert.equal(lazer.baseTendencia, 700);
    const comida = p.linhas.find((l) => l.categoria === "Alimentação (casa)")!;
    assert.equal(comida.tendencia, 42.9); // média 350 → 500
    assert.equal(comida.baseTendencia, 350);
  });

  it("categoria que estreia no último mês não tem tendência (não é queda nem alta)", () => {
    const impostos = pivot().linhas.find((l) => l.categoria === "Impostos")!;
    assert.equal(impostos.tendencia, null);
    assert.equal(impostos.baseTendencia, null);
  });

  it("mês EM CURSO é projetado antes de virar tendência (senão todo dia 5 é queda de 80%)", () => {
    const meio = [
      row("2026-07-10", "Mercado", 600),
      row("2026-08-10", "Mercado", 600),
      row("2026-09-05", "Mercado", 100), // 10 dias de 30 → ritmo de 300/mês
    ];
    const p = buildCategoryMonthPivot(meio, { ate: "2026-09", hoje: "2026-09-10" });
    assert.equal(p.parcialNoFim, true);
    assert.equal(Math.round(p.fracaoDoUltimoMes * 100) / 100, 0.33); // 10/30
    // 100 ÷ (10/30) = 300; contra a base 600 → −50%. Sem a projeção daria −83,3%.
    assert.equal(p.linhas[0].tendencia, -50);
    assert.equal(p.linhas[0].porMes[2], 100); // a TABELA mostra o valor real, não o projetado
  });

  it("colapsa os apelidos de categoria (Lazer/Social e Lazer / Social são a mesma coisa)", () => {
    const p = buildCategoryMonthPivot(
      [row("2026-08-01", "Lazer/Social", 50), row("2026-08-02", "Lazer / Social", 50)],
      { ate: "2026-08", meses: 1, hoje: HOJE },
    );
    assert.equal(p.linhas.length, 1);
    assert.equal(p.linhas[0].total, 100);
  });

  it("sem categoria vira 'Sem categoria', não some da conta", () => {
    const p = buildCategoryMonthPivot([row("2026-08-01", null, 70)], { ate: "2026-08", meses: 1, hoje: HOJE });
    assert.equal(p.linhas[0].categoria, "Sem categoria");
    assert.equal(p.total, 70);
  });

  it("transferência não é gasto nem receita — âncora de saldo e aporte ficam de fora", () => {
    const comTransferencia = [
      row("2026-08-01", "Alimentação (casa)", 100),
      row("2026-08-02", "Investimento / Reserva", 5000),
      row("2026-08-03", "Saldo inicial", 3692.12, { type: "income" }),
    ];
    const saidas = buildCategoryMonthPivot(comTransferencia, { ate: "2026-08", meses: 1, hoje: HOJE });
    assert.equal(saidas.total, 100); // o aporte de 5.000 não é despesa
    const entradas = buildCategoryMonthPivot(comTransferencia, { ate: "2026-08", meses: 1, tipo: "income", hoje: HOJE });
    assert.equal(entradas.total, 0); // a âncora de saldo não é receita
    // Sob demanda, dá para ver tudo.
    assert.equal(buildCategoryMonthPivot(comTransferencia, { ate: "2026-08", meses: 1, incluirTransferencias: true, hoje: HOJE }).total, 5100);
  });

  it("por padrão só conta o realizado; o previsto entra sob demanda", () => {
    const previsto = row("2026-08-25", "Moradia", 1000, { realized: false, projected: true, paid: false });
    assert.equal(buildCategoryMonthPivot([previsto], { ate: "2026-08", meses: 1, hoje: HOJE }).total, 0);
    assert.equal(buildCategoryMonthPivot([previsto], { ate: "2026-08", meses: 1, somenteRealizado: false, hoje: HOJE }).total, 1000);
  });

  it("filtra por tipo: entradas e saídas não se misturam", () => {
    const entradas = [row("2026-08-05", "Receita — Cliente", 2000, { type: "income" })];
    assert.equal(buildCategoryMonthPivot([...rows, ...entradas], { ate: "2026-08", meses: 1, hoje: HOJE }).total, 1107);
    assert.equal(buildCategoryMonthPivot([...rows, ...entradas], { ate: "2026-08", meses: 1, tipo: "income", hoje: HOJE }).total, 2000);
  });

  it("sem `ate`, a janela termina no mês mais recente com dado", () => {
    const p = buildCategoryMonthPivot(rows, { meses: 2, hoje: HOJE });
    assert.deepEqual(p.meses, ["2026-07", "2026-08"]);
  });

  it("sem nenhuma linha, cai no mês corrente e não quebra", () => {
    const p = buildCategoryMonthPivot([], { meses: 3, hoje: HOJE });
    assert.deepEqual(p.meses, ["2026-07", "2026-08", "2026-09"]);
    assert.equal(p.total, 0);
    assert.deepEqual(p.linhas, []);
  });

  it("o rodapé fecha com a soma das linhas", () => {
    const p = pivot();
    assert.equal(p.total, p.linhas.reduce((a, l) => a + l.total, 0));
  });

  it("série do gráfico usa chave segura (categoria com ponto quebraria o dataKey do Recharts)", () => {
    const p = buildCategoryMonthPivot(
      [row("2026-08-01", "Cia. Aérea", 200), row("2026-08-02", "Outros", 100)],
      { ate: "2026-08", meses: 1, hoje: HOJE },
    );
    const serie = pivotParaSerie(p, 2);
    assert.deepEqual(serie[0], { mes: "ago/26", c0: 200, c1: 100 });
  });

  it("série do gráfico tem um ponto por mês", () => {
    const serie = pivotParaSerie(pivot(), 2);
    assert.equal(serie.length, 3);
    assert.deepEqual(serie[0], { mes: "jun/26", c0: 800, c1: 300 });
  });
});
