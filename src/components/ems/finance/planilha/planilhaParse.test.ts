import { describe, it } from "node:test";
import assert from "node:assert";
import { acharAba, hojeLocal } from "./planilhaParse";

describe("planilhaParse — achar a aba", () => {
  const LANC = ["lancamentos", "lancamento", "transacoes", "movimentacoes", "extrato"];

  it("acha com acento, caixa alta e espaço sobrando", () => {
    assert.equal(acharAba(["Visão Geral", "Config", "Diário", "Lançamentos"], LANC), 3);
    assert.equal(acharAba(["LANÇAMENTOS "], LANC), 0);
    assert.equal(acharAba(["Lancamentos"], LANC), 0);
  });

  it("aceita o nome sujo que um 'Salvar como' produz", () => {
    assert.equal(acharAba(["Resumo", "Lançamentos (2)"], LANC), 1);
  });

  it("nome exato ganha do 'contém'", () => {
    const CFG = ["config", "configuracao", "configuracoes", "parametros"];
    assert.equal(acharAba(["Configurações antigas", "Config"], CFG), 1);
  });

  it("devolve -1 quando não existe", () => {
    assert.equal(acharAba(["Plan1", "Plan2"], LANC), -1);
    assert.equal(acharAba([], LANC), -1);
  });
});

describe("planilhaParse — hoje", () => {
  it("usa o fuso local, não UTC (senão de madrugada o dia volta um)", () => {
    // 23h de 20/08 em Brasília já é 21/08 em UTC; a planilha fala do dia local.
    assert.equal(hojeLocal(new Date(2026, 7, 20, 23, 30)), "2026-08-20");
    assert.equal(hojeLocal(new Date(2026, 0, 5)), "2026-01-05");
  });
});
