import {
  Archive,
  BookOpen,
  Briefcase,
  Gavel,
  Megaphone,
  Siren,
  Wrench,
} from "lucide-react";

/** Categorias de governanca que gravam em governance_items (BoardDomainPanel + radar). */
export const GOV_CATEGORIES = [
  { id: "legal", label: "Jurídico", icon: Gavel, color: "text-violet-500", bg: "bg-violet-500/10" },
  { id: "accounting", label: "Contabilidade", icon: BookOpen, color: "text-blue-500", bg: "bg-blue-500/10" },
  { id: "optimization", label: "Otimizações", icon: Wrench, color: "text-emerald-500", bg: "bg-emerald-500/10" },
  { id: "marketing", label: "Marketing", icon: Megaphone, color: "text-pink-500", bg: "bg-pink-500/10" },
  { id: "stack_backup", label: "Stack & Backup", icon: Archive, color: "text-amber-500", bg: "bg-amber-500/10" },
  { id: "crisis", label: "Crises", icon: Siren, color: "text-red-500", bg: "bg-red-500/10" },
  { id: "admin", label: "Administrativo", icon: Briefcase, color: "text-cyan-500", bg: "bg-cyan-500/10" },
] as const;

export const STATUS_OPTIONS = [
  { value: "open", label: "Aberto" },
  { value: "in_review", label: "Em análise" },
  { value: "in_progress", label: "Em execução" },
  { value: "done", label: "Concluído" },
  { value: "archived", label: "Arquivado" },
];

export const PRIORITY_OPTIONS = [
  { value: "low", label: "Baixa" },
  { value: "medium", label: "Média" },
  { value: "high", label: "Alta" },
  { value: "critical", label: "Crítica" },
];

export const RISK_CATEGORIES = [
  { value: "operational", label: "Operacional" },
  { value: "financial", label: "Financeiro" },
  { value: "legal", label: "Jurídico" },
  { value: "reputational", label: "Reputacional" },
  { value: "strategic", label: "Estratégico" },
  { value: "technology", label: "Tecnologia" },
  { value: "compliance", label: "Compliance" },
];

export const OBLIGATION_CATEGORIES = [
  { value: "fiscal", label: "Fiscal" },
  { value: "accounting", label: "Contábil" },
  { value: "legal", label: "Jurídico" },
  { value: "contractual", label: "Contratual" },
  { value: "license", label: "Licença/Alvará" },
];

export const FREQUENCY_OPTIONS = [
  { value: "once", label: "Única" },
  { value: "monthly", label: "Mensal" },
  { value: "quarterly", label: "Trimestral" },
  { value: "semiannual", label: "Semestral" },
  { value: "annual", label: "Anual" },
];

export const CRITICALITY_OPTIONS = [
  { value: "low", label: "Baixa" },
  { value: "medium", label: "Média" },
  { value: "high", label: "Alta" },
  { value: "critical", label: "Crítica" },
];

export const MONTH_LABELS = [
  "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
  "Jul", "Ago", "Set", "Out", "Nov", "Dez",
];

export const today = () => new Date().toISOString().slice(0, 10);

export const dateLabel = (date?: string | null) => {
  if (!date) return "Sem data";
  const [year, month, day] = date.slice(0, 10).split("-");
  if (!year || !month || !day) return date;
  return `${day}/${month}/${year}`;
};

/** Banda de severidade derivada do score 1..25 (probability*impact). */
export const riskBand = (score: number) => {
  if (score >= 16) return { label: "Crítico", tone: "red" as const };
  if (score >= 10) return { label: "Alto", tone: "amber" as const };
  if (score >= 5) return { label: "Médio", tone: "yellow" as const };
  return { label: "Baixo", tone: "emerald" as const };
};
