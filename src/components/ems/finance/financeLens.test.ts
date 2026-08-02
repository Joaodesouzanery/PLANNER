import { describe, expect, it } from "vitest";
import { DEFAULT_LENS, isLensOpen, matchLens } from "./financeLens";

describe("financeLens", () => {
  const row = { escopo: "pj", produto_id: "p1", cliente_id: "c1" };

  it("lente aberta passa tudo", () => {
    expect(isLensOpen(DEFAULT_LENS)).toBe(true);
    expect(matchLens(row, DEFAULT_LENS)).toBe(true);
  });

  it("filtra por escopo", () => {
    expect(matchLens(row, { ...DEFAULT_LENS, escopo: "pj" })).toBe(true);
    expect(matchLens(row, { ...DEFAULT_LENS, escopo: "pf" })).toBe(false);
  });

  it("linha sem escopo nunca some", () => {
    expect(matchLens({ escopo: null }, { ...DEFAULT_LENS, escopo: "pf" })).toBe(true);
  });

  it("filtra por produto e cliente", () => {
    expect(matchLens(row, { ...DEFAULT_LENS, produtoId: "p1" })).toBe(true);
    expect(matchLens(row, { ...DEFAULT_LENS, produtoId: "p2" })).toBe(false);
    expect(matchLens(row, { ...DEFAULT_LENS, clienteId: "c9" })).toBe(false);
  });

  it("pick 'none' isola o que ainda não foi classificado", () => {
    expect(matchLens({ produto_id: null }, { ...DEFAULT_LENS, produtoId: "none" })).toBe(true);
    expect(matchLens(row, { ...DEFAULT_LENS, produtoId: "none" })).toBe(false);
  });
});
