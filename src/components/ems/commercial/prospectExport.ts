// Prospecção · validação do formulário + export filtrado (CSV/JSON) das vagas.
// Puro/testável: sem React, sem Supabase. A UI só chama estas funções.

export interface ProspectLike {
  id?: string;
  company_name?: string | null;
  location?: string | null;
  job_title?: string | null;
  job_about?: string | null;
  status?: string | null;
  priority?: string | null;
  linkedin_job_url?: string | null;
  extracted_tasks?: string[] | null;
  notes?: string | null;
  meeting_date?: string | null;
  contacts?: { type?: string; value?: string }[] | null;
}

export interface ExportFilters {
  companies?: string[]; // vazio/undefined = todas
  statuses?: string[]; // vazio/undefined = todos
}

/** Erros de preenchimento (lista vazia = pode salvar). */
export const validateProspectForm = (form: ProspectLike): string[] => {
  const errors: string[] = [];
  const name = (form.company_name || "").trim();
  if (!name) errors.push("Informe o nome da empresa.");
  else if (name.length > 160) errors.push("Nome da empresa muito longo (máx. 160 caracteres).");

  const url = (form.linkedin_job_url || "").trim();
  if (url) {
    let parsed: URL | null = null;
    try {
      parsed = new URL(url);
    } catch {
      parsed = null;
    }
    if (!parsed || !/^https?:$/.test(parsed.protocol)) errors.push("O link da vaga precisa começar com http:// ou https://.");
  }

  const about = (form.job_about || "").trim();
  if (about.length > 20000) errors.push("Descrição da vaga muito longa (máx. 20.000 caracteres).");

  const meeting = (form.meeting_date || "").trim();
  if (meeting && Number.isNaN(new Date(meeting).getTime())) errors.push("Data de reunião inválida.");

  return errors;
};

/** Traduz erro do banco/rede em mensagem clara para o usuário. */
export const friendlyDbError = (error: unknown): string => {
  const e = error as { message?: string; code?: string; details?: string } | null;
  const msg = String(e?.message || e || "Erro desconhecido");
  const code = String(e?.code || "");
  if (code === "23505" || /duplicate key/i.test(msg)) return "Já existe um registro com esses dados (vaga duplicada).";
  if (code === "42501" || /row-level security|permission denied/i.test(msg)) return "Sem permissão para salvar. Faça login novamente e tente de novo.";
  if (/schema cache|column .* does not exist/i.test(msg)) return "A base ainda não tem esse campo. Recarregue a página; se persistir, avise para atualizar o banco.";
  if (/Failed to fetch|NetworkError|Failed to send a request/i.test(msg)) return "Falha de conexão com o servidor. Verifique sua internet e tente novamente.";
  if (/invalid input syntax for type date/i.test(msg)) return "Data inválida em algum campo.";
  return msg;
};

/** Aplica os filtros de empresa/status ao conjunto de prospects. */
export const filterProspects = <T extends ProspectLike>(list: T[], filters: ExportFilters = {}): T[] => {
  const companies = (filters.companies || []).filter(Boolean);
  const statuses = (filters.statuses || []).filter(Boolean);
  return list.filter((p) => {
    if (companies.length && !companies.includes(String(p.company_name || ""))) return false;
    if (statuses.length && !statuses.includes(String(p.status || ""))) return false;
    return true;
  });
};

export interface ExportRow {
  empresa: string;
  local: string;
  vaga: string;
  status: string;
  prioridade: string;
  demandas: string[];
  link: string;
  descricao: string;
  reuniao: string;
  notas: string;
}

/** Normaliza cada prospect para a MESMA estrutura em CSV e JSON. */
export const buildExportRows = (
  list: ProspectLike[],
  extractTasks: (about: string) => string[] = () => [],
): ExportRow[] =>
  list.map((p) => ({
    empresa: String(p.company_name || ""),
    local: String(p.location || ""),
    vaga: String(p.job_title || ""),
    status: String(p.status || ""),
    prioridade: String(p.priority || ""),
    demandas: p.extracted_tasks?.length ? p.extracted_tasks : extractTasks(String(p.job_about || "")),
    link: String(p.linkedin_job_url || ""),
    descricao: String(p.job_about || ""),
    reuniao: String(p.meeting_date || ""),
    notas: String(p.notes || ""),
  }));

const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""').replace(/\s*\n\s*/g, " ")}"`;

export const CSV_HEADER = ["Empresa", "Local", "Vaga", "Status", "Prioridade", "O que a vaga pede", "Link", "Descrição", "Reunião", "Notas"];

export const toCsv = (rows: ExportRow[]): string => {
  const lines = rows.map((r) =>
    [r.empresa, r.local, r.vaga, r.status, r.prioridade, r.demandas.join(" | "), r.link, r.descricao, r.reuniao, r.notas]
      .map(esc)
      .join(";"),
  );
  return `\uFEFF${[CSV_HEADER.join(";"), ...lines].join("\n")}`;
};

/** JSON com a mesma estrutura do CSV + metadados, pronto para colar na IA. */
export const toJson = (rows: ExportRow[], filters: ExportFilters = {}): string =>
  JSON.stringify(
    {
      gerado_em: new Date().toISOString(),
      filtros: { empresas: filters.companies || [], status: filters.statuses || [] },
      total: rows.length,
      vagas: rows,
    },
    null,
    2,
  );
