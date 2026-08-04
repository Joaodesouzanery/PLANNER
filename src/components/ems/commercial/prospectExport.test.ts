import { describe, it, expect } from "vitest";
import { validateProspectForm, friendlyDbError, filterProspects, buildExportRows, toCsv, toJson } from "./prospectExport";

describe("prospectExport", () => {
  it("valida empresa obrigatória e URL", () => {
    expect(validateProspectForm({ company_name: "" })).toContain("Informe o nome da empresa.");
    expect(validateProspectForm({ company_name: "X", linkedin_job_url: "abc" }).length).toBe(1);
    expect(validateProspectForm({ company_name: "X", linkedin_job_url: "https://linkedin.com/jobs/view/1" })).toEqual([]);
  });

  it("traduz erros do banco", () => {
    expect(friendlyDbError({ code: "23505", message: "duplicate key" })).toMatch(/duplicad/i);
    expect(friendlyDbError({ message: "Failed to fetch" })).toMatch(/conexão/i);
    expect(friendlyDbError({ message: "could not find the 'x' column of 'y' in the schema cache" })).toMatch(/base ainda não tem/i);
  });

  it("filtra por empresa e status", () => {
    const list = [
      { company_name: "A", status: "new" },
      { company_name: "B", status: "won" },
    ];
    expect(filterProspects(list, { companies: ["A"] })).toHaveLength(1);
    expect(filterProspects(list, { statuses: ["won"] })[0].company_name).toBe("B");
    expect(filterProspects(list, {})).toHaveLength(2);
  });

  it("CSV e JSON compartilham a mesma estrutura", () => {
    const rows = buildExportRows([{ company_name: "A", job_about: "faz x", status: "new" }], () => ["tarefa 1"]);
    expect(rows[0].demandas).toEqual(["tarefa 1"]);
    expect(toCsv(rows)).toContain("tarefa 1");
    const parsed = JSON.parse(toJson(rows, { companies: ["A"] }));
    expect(parsed.total).toBe(1);
    expect(parsed.vagas[0].demandas).toEqual(["tarefa 1"]);
    expect(parsed.filtros.empresas).toEqual(["A"]);
  });
});
