import { describe, it } from "node:test";
import assert from "node:assert";
import { groupContactsForExport, type ExportBoard, type ExportCard, type ExportContactInfo } from "./contactBoardExport";

const boards: ExportBoard[] = [
  { id: "b1", name: "ConstruData", stages: [{ id: "novo", title: "Novo" }, { id: "prop", title: "Proposta" }] },
  { id: "b2", name: "AgroTorre", stages: [{ id: "novo", title: "Novo" }] },
];
const cardsByBoard = new Map<string, ExportCard[]>([
  ["b1", [{ contact_id: "c1", stage_id: "novo" }, { contact_id: "c2", stage_id: "prop" }]],
  ["b2", [{ contact_id: "c3", stage_id: "novo" }]],
]);
const contactById = new Map<string, ExportContactInfo>([
  ["c1", { name: "Ana", company: "Obra X", email: "a@x.com", phone: "1" }],
  ["c2", { name: "Bia", company: "Obra Y", email: null, phone: null }],
  ["c3", { name: "Caio", company: "Fazenda Z", email: "c@z.com", phone: "3" }],
]);
const all = () => true;

describe("contactBoardExport — groupContactsForExport", () => {
  it("agrupa por empresa (quadro) + etapa, ignorando etapas vazias", () => {
    const g = groupContactsForExport(boards, cardsByBoard, contactById, all);
    assert.equal(g.length, 3); // ConstruData·Novo, ConstruData·Proposta, AgroTorre·Novo
    const cd = g.find((x) => x.empresa === "ConstruData" && x.etapa === "Novo")!;
    assert.equal(cd.contatos[0].nome, "Ana");
    assert.equal(cd.contatos[0].email, "a@x.com");
    assert.equal(g.find((x) => x.etapa === "Proposta")!.contatos[0].telefone, ""); // null → ""
  });

  it("respeita o filtro de visibilidade", () => {
    const soC3 = (id: string) => id === "c3";
    const g = groupContactsForExport(boards, cardsByBoard, contactById, soC3);
    assert.equal(g.length, 1);
    assert.equal(g[0].empresa, "AgroTorre");
  });

  it("filtra por etapa (título)", () => {
    const g = groupContactsForExport(boards, cardsByBoard, contactById, all, "Novo");
    assert.equal(g.length, 2); // só as colunas "Novo"
    assert.ok(g.every((x) => x.etapa === "Novo"));
  });
});
