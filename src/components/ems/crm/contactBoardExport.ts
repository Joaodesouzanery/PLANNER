// Agrupa os contatos dos quadros por empresa (quadro) + etapa, respeitando um filtro de visibilidade.
// Puro/testável — a base do export CSV/PDF do kanban de Contatos.

export interface ExportBoard {
  id: string;
  name: string;
  stages: { id: string; title: string }[];
}
export interface ExportCard {
  contact_id: string;
  stage_id: string;
}
export interface ExportContactInfo {
  name: string;
  company?: string | null;
  email?: string | null;
  phone?: string | null;
}
export interface ExportContact {
  nome: string;
  empresa: string;
  email: string;
  telefone: string;
}
export interface ExportGroup {
  empresa: string;
  etapa: string;
  contatos: ExportContact[];
}

export const groupContactsForExport = (
  boards: ExportBoard[],
  cardsByBoard: Map<string, ExportCard[]>,
  contactById: Map<string, ExportContactInfo>,
  visible: (contactId: string) => boolean,
  etapaFilter?: string | null,
): ExportGroup[] => {
  const groups: ExportGroup[] = [];
  for (const b of boards) {
    const cards = cardsByBoard.get(b.id) ?? [];
    for (const stage of b.stages) {
      if (etapaFilter && stage.title !== etapaFilter) continue;
      const contatos = cards
        .filter((c) => c.stage_id === stage.id && visible(c.contact_id))
        .map((c) => contactById.get(c.contact_id))
        .filter((ct): ct is ExportContactInfo => Boolean(ct))
        .map((ct) => ({ nome: ct.name, empresa: ct.company || "", email: ct.email || "", telefone: ct.phone || "" }));
      if (contatos.length) groups.push({ empresa: b.name, etapa: stage.title, contatos });
    }
  }
  return groups;
};
