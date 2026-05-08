import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  BarChart3,
  BriefcaseBusiness,
  Building2,
  CalendarClock,
  ClipboardList,
  Copy,
  Edit2,
  ExternalLink,
  FileSearch,
  Link2,
  LocateFixed,
  Loader2,
  Mail,
  MapPin,
  MessageSquareText,
  Minus,
  Navigation,
  Phone,
  Plus,
  RefreshCw,
  Save,
  Search,
  Send,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  X,
  UserPlus,
} from "lucide-react";
import { useCompany } from "@/contexts/CompanyContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type ProspectStatus = "new" | "researching" | "contacted" | "meeting" | "won" | "lost";
type ProspectPriority = "high" | "medium" | "low";

interface ProspectContact {
  type: string;
  value: string;
  name?: string;
}

interface DiagnosisEvidence {
  id: string;
  quote: string;
  source: "Sobre a vaga";
  sourceIndex: number;
  matchedKeywords: string[];
}

interface DiagnosisRisk {
  id: string;
  task: string;
  risk: string;
  module: string;
  recommendation: string;
  evidences: DiagnosisEvidence[];
}

interface ModuleMatch {
  moduleId: string;
  moduleName: string;
  category: string;
  score: number;
  priority: "Oferta principal" | "Complementares" | "Possivel expansao";
  demandSignals: string[];
  risk: string;
  recommendation: string;
  offerAngle: string;
  evidences: DiagnosisEvidence[];
}

interface GlobalModuleContext {
  generatedAt: string;
  totalProspects: number;
  topModules: Array<{
    moduleId: string;
    moduleName: string;
    count: number;
    percent: number;
  }>;
}

interface Diagnosis {
  caseTitle?: string;
  observedWork: string;
  operationalHypothesis: string;
  commonRisks: string[];
  whereConstruDataFits: string[];
  risks?: DiagnosisRisk[];
  moduleMatches?: ModuleMatch[];
  topModules?: ModuleMatch[];
  globalContext?: GlobalModuleContext;
  suggestedMessage: string;
  messageDraft?: string;
  sourceSnapshot?: {
    companyName: string;
    location: string;
    jobTitle: string;
    linkedinJobUrl: string;
    jobAbout: string;
    generatedFrom: "linkedin" | "manual";
    importedAt?: string;
  };
  generatedAt: string;
  updatedAt?: string;
}

interface Prospect {
  id: string;
  company_name: string;
  location: string | null;
  linkedin_job_url: string | null;
  job_title: string | null;
  job_about: string | null;
  contacts: ProspectContact[];
  extracted_tasks: string[];
  operational_diagnosis: Diagnosis | Record<string, never>;
  status: ProspectStatus;
  priority: ProspectPriority;
  meeting_date: string | null;
  notes: string | null;
  job_fingerprint?: string | null;
  created_at: string;
}

interface MapContact {
  id: string;
  name: string;
  company: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  project_id: string | null;
}

interface MapProject {
  id: string;
  title: string;
  client: string | null;
  status: string | null;
  due_date: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
}

interface MapTask {
  id: string;
  title: string;
  status: string | null;
  due_date: string | null;
  priority: string | null;
  contact_id: string | null;
  project_id: string | null;
}

interface MapEntity {
  id: string;
  type: "contact" | "project";
  title: string;
  subtitle: string;
  address: string;
  latitude: number;
  longitude: number;
  tasks: MapTask[];
}

interface ProspectForm {
  company_name: string;
  location: string;
  linkedin_job_url: string;
  job_title: string;
  job_about: string;
  contacts: ProspectContact[];
  status: ProspectStatus;
  priority: ProspectPriority;
  meeting_date: string;
  notes: string;
}

const emptyForm: ProspectForm = {
  company_name: "",
  location: "",
  linkedin_job_url: "",
  job_title: "",
  job_about: "",
  contacts: [{ type: "celular", value: "", name: "" }],
  status: "new",
  priority: "medium",
  meeting_date: "",
  notes: "",
};

const statusConfig: Record<ProspectStatus, { label: string; className: string }> = {
  new: { label: "Novo", className: "bg-blue-500/10 text-blue-500 border-blue-500/30" },
  researching: { label: "Pesquisa", className: "bg-cyan-500/10 text-cyan-500 border-cyan-500/30" },
  contacted: { label: "Contato feito", className: "bg-amber-500/10 text-amber-600 border-amber-500/30" },
  meeting: { label: "Reuniao", className: "bg-purple-500/10 text-purple-500 border-purple-500/30" },
  won: { label: "Ganho", className: "bg-emerald-500/10 text-emerald-500 border-emerald-500/30" },
  lost: { label: "Perdido", className: "bg-red-500/10 text-red-500 border-red-500/30" },
};

const priorityConfig: Record<ProspectPriority, { label: string; className: string }> = {
  high: { label: "Alta", className: "bg-red-500/10 text-red-500 border-red-500/30" },
  medium: { label: "Media", className: "bg-amber-500/10 text-amber-600 border-amber-500/30" },
  low: { label: "Baixa", className: "bg-sky-500/10 text-sky-500 border-sky-500/30" },
};

const construDataBase = {
  pitch:
    "Plataforma operacional para obras: integra campo, RDO, qualidade, medicao, planejamento, suprimentos, recursos, financeiro, auditoria e gestao executiva em uma unica base rastreavel.",
  pillars: [
    "RDO Inteligente",
    "Qualidade",
    "Medicao",
    "Planejamento",
    "Gestao 360",
    "Torre de Controle",
    "Suprimentos",
    "Mao de Obra",
    "Financeiro",
  ],
};

const moduleCatalog = [
  {
    moduleId: "rdo-inteligente",
    moduleName: "RDO Inteligente",
    category: "Campo",
    keywords: ["rdo", "diario", "boletim", "foto", "fotos", "texto", "formulario", "servicos executados", "assinatura", "campo", "execucao"],
    demandSignals: ["Foto, texto ou formulario viram diario estruturado.", "Servicos executados seguem para Medicao."],
    risk: "Registros de campo ficam incompletos, tardios ou sem origem confiavel para medicao e auditoria.",
    recommendation: "Estruturar RDO com fotos, textos, formularios, assinatura e servicos vinculados a medicao.",
    offerAngle: "Transformar o registro diario da obra em dado operacional rastreavel.",
    weight: 10,
  },
  {
    moduleId: "rdo-automatico",
    moduleName: "RDO automatico",
    category: "Campo",
    keywords: ["boletim por foto", "foto do boletim", "leitura de boletim", "ocr", "assinatura presente", "preservando o original", "auditoria"],
    demandSignals: ["Le boletim por foto.", "Identifica campos e assinatura preservando original para auditoria."],
    risk: "Boletins fisicos podem perder informacoes, assinatura e comprovacao original.",
    recommendation: "Usar leitura automatica de boletins com preservacao do documento original para auditoria.",
    offerAngle: "Reduzir digitacao manual e manter prova operacional auditavel.",
    weight: 8,
  },
  {
    moduleId: "qualidade",
    moduleName: "Qualidade",
    category: "Qualidade",
    keywords: ["fvs", "qualidade", "nao conformidade", "nao conformidades", "bloqueio tecnico", "inspecao", "vistoria", "evidencia tecnica", "liberacao"],
    demandSignals: ["FVS, nao conformidades, evidencias e bloqueios tecnicos antes da medicao."],
    risk: "Servicos podem ser medidos sem evidencias ou liberacao tecnica adequada.",
    recommendation: "Vincular FVS, nao conformidades e bloqueios tecnicos ao fluxo de medicao.",
    offerAngle: "Evitar medicao de servico sem qualidade comprovada.",
    weight: 9,
  },
  {
    moduleId: "medicao",
    moduleName: "Medicao",
    category: "Controle",
    keywords: ["medicao", "medicoes", "quantidade", "quantidades", "servico", "servicos", "contrato", "evidencia", "boletim de medicao", "status de qualidade"],
    demandSignals: ["Quantidades consolidadas por servico, contrato, origem, qualidade e evidencia."],
    risk: "Medicoes podem ficar sem lastro de campo, contrato, evidencia ou status de qualidade.",
    recommendation: "Consolidar medicao por servico, contrato, origem e evidencia operacional.",
    offerAngle: "Dar lastro operacional forte para aprovar medicao.",
    weight: 10,
  },
  {
    moduleId: "planejamento",
    moduleName: "Planejamento",
    category: "Prazo",
    keywords: ["planejamento", "cronograma", "curva", "restricao", "restricoes", "look-ahead", "prazo", "atraso", "frente", "impacto"],
    demandSignals: ["Cronograma, curva, restricoes, look-ahead e impacto real do campo sobre prazo."],
    risk: "O cronograma pode nao refletir as restricoes e impactos reais do campo.",
    recommendation: "Conectar execucao, restricoes e avancos reais ao planejamento da obra.",
    offerAngle: "Mostrar impacto real do campo no prazo.",
    weight: 9,
  },
  {
    moduleId: "gestao-360",
    moduleName: "Gestao 360",
    category: "Executivo",
    keywords: ["cpi", "spi", "custo", "prazo", "risco", "alerta", "alertas", "indicador", "indicadores", "executivo", "diretoria", "gestao"],
    demandSignals: ["CPI, SPI, custo, prazo, risco e alertas executivos conectados ao campo."],
    risk: "A diretoria recebe indicadores tarde ou desconectados da origem operacional.",
    recommendation: "Conectar campo, custo, prazo, risco e alertas em uma visao executiva.",
    offerAngle: "Levar a obra para uma visao executiva em tempo quase real.",
    weight: 8,
  },
  {
    moduleId: "relatorio-360",
    moduleName: "Relatorio 360",
    category: "Executivo",
    keywords: ["relatorio", "relatorios", "foto", "fotos", "decisao", "decisoes", "historico", "mapa", "indicadores", "consolidado"],
    demandSignals: ["Relatorios vivos com fotos, decisoes, historico, mapa e indicadores."],
    risk: "Relatorios podem virar retrabalho manual sem fotos, decisoes e historico integrados.",
    recommendation: "Gerar relatorios vivos a partir dos registros operacionais da obra.",
    offerAngle: "Trocar relatorios estaticos por acompanhamento vivo e rastreavel.",
    weight: 7,
  },
  {
    moduleId: "torre-controle",
    moduleName: "Torre de Controle",
    category: "Executivo",
    keywords: ["torre de controle", "war room", "multiobra", "portfolio", "projetos", "alertas", "mapa", "drill-down", "diretoria"],
    demandSignals: ["War room multiobra com portfolio, projetos, alertas, mapa e drill-down."],
    risk: "Gestao multiobra perde prioridade, alertas e visao comparativa entre projetos.",
    recommendation: "Usar torre de controle para portfolio, alertas, mapa e drill-down por obra.",
    offerAngle: "Dar comando multiobra para diretoria e operacao.",
    weight: 7,
  },
  {
    moduleId: "projetos",
    moduleName: "Projetos",
    category: "Governanca",
    keywords: ["obra", "obras", "projeto", "projetos", "nucleo", "nucleos", "orcamento", "documentos", "responsabilidades", "governanca"],
    demandSignals: ["Cada obra centraliza orcamento, documentos, BIM, planejamento, execucao, medicoes e governanca."],
    risk: "Informacoes centrais da obra ficam fragmentadas entre documentos, orcamento e responsaveis.",
    recommendation: "Centralizar obra, nucleo, orcamento, documentos e responsabilidades em Projetos.",
    offerAngle: "Criar uma base unica por obra.",
    weight: 8,
  },
  {
    moduleId: "mapa-interativo",
    moduleName: "Mapa Interativo",
    category: "Territorio",
    keywords: ["mapa", "territorio", "trecho", "trechos", "rede", "redes", "frente", "frentes", "status fisico", "georreferenciado", "localizacao"],
    demandSignals: ["Trechos, redes, frentes, status fisico, custo e risco no territorio."],
    risk: "Frentes, trechos e redes podem ficar sem leitura territorial de status, custo e risco.",
    recommendation: "Mapear frentes, trechos, redes e status fisico em mapa operacional.",
    offerAngle: "Enxergar a obra no territorio, nao so em planilhas.",
    weight: 8,
  },
  {
    moduleId: "suprimentos",
    moduleName: "Suprimentos inteligente",
    category: "Suprimentos",
    keywords: ["suprimentos", "requisicao", "requisicoes", "cotacao", "cotacoes", "compra", "compras", "pedido", "pedidos", "contrato", "recebimento", "nota fiscal", "notas fiscais", "almoxarifado", "estoque", "material", "materiais", "equipamentos", "frotas"],
    demandSignals: ["Requisicao, cotacao, pedido, contrato, recebimento, nota fiscal, almoxarifado e estoque conectados."],
    risk: "Materiais, compras e notas podem perder rastreabilidade ate prazo, custo e impacto na obra.",
    recommendation: "Conectar requisicoes, cotacoes, compras, estoque, notas e cronograma.",
    offerAngle: "Dar rastreabilidade de suprimentos ate o impacto operacional e financeiro.",
    weight: 10,
  },
  {
    moduleId: "mao-de-obra",
    moduleName: "Mao de Obra",
    category: "Recursos",
    keywords: ["mao de obra", "equipe", "equipes", "colaborador", "colaboradores", "funcionario", "funcionarios", "alocacao", "apontamento", "apontamentos", "produtividade", "disponibilidade", "ponto", "custo por frente"],
    demandSignals: ["Cadastro, equipes, alocacao diaria, disponibilidade, produtividade e custo por frente."],
    risk: "Equipe, produtividade e custo por frente ficam dificeis de conferir e comparar.",
    recommendation: "Controlar equipes, alocacao, apontamentos, disponibilidade, produtividade e custo.",
    offerAngle: "Transformar mao de obra em indicador operacional por frente.",
    weight: 10,
  },
  {
    moduleId: "equipamentos",
    moduleName: "Equipamentos",
    category: "Recursos",
    keywords: ["equipamento", "equipamentos", "frota", "frotas", "manutencao", "disponibilidade", "produtividade por frente", "maquina", "maquinas"],
    demandSignals: ["Frota, manutencao, disponibilidade e produtividade por frente."],
    risk: "Equipamentos podem gerar custo e atraso sem leitura de disponibilidade e produtividade.",
    recommendation: "Controlar frota, manutencao, disponibilidade e produtividade por frente.",
    offerAngle: "Conectar equipamento parado ou improdutivo ao impacto na obra.",
    weight: 7,
  },
  {
    moduleId: "bim",
    moduleName: "BIM 3D/4D/5D",
    category: "Projetos",
    keywords: ["bim", "3d", "4d", "5d", "modelo", "orcamento", "modelo bim", "prazo e custo"],
    demandSignals: ["Modelo, prazo e custo conectados ao planejamento e orcamento."],
    risk: "Modelo, planejamento e custo podem ficar desconectados da execucao.",
    recommendation: "Conectar BIM 3D/4D/5D a planejamento, orcamento e acompanhamento.",
    offerAngle: "Transformar BIM em base operacional de prazo e custo.",
    weight: 6,
  },
  {
    moduleId: "evm",
    moduleName: "EVM",
    category: "Financeiro",
    keywords: ["evm", "valor agregado", "custo planejado", "executado", "previsto", "cpi", "spi", "desvio"],
    demandSignals: ["Valor agregado com custo planejado, executado e previsto."],
    risk: "Custo, prazo e progresso podem ser analisados sem previsao confiavel de desvio.",
    recommendation: "Aplicar EVM com CPI/SPI, custo planejado, executado e previsto.",
    offerAngle: "Antecipar desvio financeiro e de prazo com valor agregado.",
    weight: 7,
  },
  {
    moduleId: "lps-lean",
    moduleName: "LPS / Lean e agenda",
    category: "Prazo",
    keywords: ["lps", "lean", "last planner", "look-ahead", "ppc", "restricoes", "compromissos", "pareto", "melhoria continua", "agenda", "semanas"],
    demandSignals: ["Look-ahead de 6 semanas, PPC semanal, restricoes, compromissos, agenda e cronogramas."],
    risk: "Compromissos semanais, restricoes e causas de atraso ficam sem rotina de aprendizagem.",
    recommendation: "Usar LPS/Lean com look-ahead, PPC, restricoes e Pareto de causas.",
    offerAngle: "Criar rotina de producao confiavel e melhoria continua.",
    weight: 8,
  },
  {
    moduleId: "agenda-cronogramas",
    moduleName: "Agenda e Cronogramas",
    category: "Prazo",
    keywords: ["agenda", "calendario", "cronograma", "linha de base", "curva", "tarefas", "marcos", "conflitos", "atraso por frente"],
    demandSignals: ["Calendario operacional, linha de base, curva, tarefas, marcos, conflitos e impacto de atraso por frente."],
    risk: "Agenda, tarefas e conflitos podem nao refletir atraso por frente.",
    recommendation: "Unificar agenda operacional, cronogramas, marcos, conflitos e impacto por frente.",
    offerAngle: "Dar clareza diaria de agenda e impacto no cronograma.",
    weight: 8,
  },
  {
    moduleId: "financeiro",
    moduleName: "Financeiro operacional",
    category: "Financeiro",
    keywords: ["financeiro", "contrato", "contratos", "contas a pagar", "contas a receber", "fluxo de caixa", "custo", "custos", "medicoes aprovadas", "impacto financeiro", "previsao"],
    demandSignals: ["Contratos, medicoes, custos de suprimentos, mao de obra, equipamentos e fluxo de caixa."],
    risk: "Campo, medicao, compras e contratos podem nao alimentar previsao financeira confiavel.",
    recommendation: "Conectar medicoes aprovadas, custos, contratos, fluxo de caixa, EVM e CPI/SPI.",
    offerAngle: "Ligar operacao de campo ao financeiro da obra.",
    weight: 8,
  },
  {
    moduleId: "pre-construcao",
    moduleName: "Pre-construcao",
    category: "Planejamento",
    keywords: ["pre-construcao", "estudo", "estudos", "cenario", "cenarios", "risco", "orcamento inicial", "premissa", "premissas", "viabilidade"],
    demandSignals: ["Estudos, cenarios, risco, orcamento inicial e premissas."],
    risk: "Premissas iniciais, riscos e orcamento podem nao seguir para a operacao.",
    recommendation: "Registrar estudos, cenarios, premissas, risco e orcamento inicial.",
    offerAngle: "Levar a decisao de pre-construcao para a execucao rastreavel.",
    weight: 6,
  },
  {
    moduleId: "auditoria",
    moduleName: "Auditoria",
    category: "Governanca",
    keywords: ["auditoria", "aprovacao", "aprovacoes", "historico", "retencao", "exportacao", "acao critica", "acoes criticas", "rastreabilidade", "trilha"],
    demandSignals: ["Acoes criticas, aprovacoes, historico, retencao e exportacao."],
    risk: "Decisoes, aprovacoes e evidencias podem nao ter trilha auditavel.",
    recommendation: "Criar trilha de auditoria com acoes criticas, aprovacoes, historico e exportacao.",
    offerAngle: "Proteger decisoes e evidencias com governanca auditavel.",
    weight: 7,
  },
  {
    moduleId: "automacao-operacional",
    moduleName: "Automacao operacional",
    category: "Automacao",
    keywords: ["automacao", "alerta", "alertas", "excecao", "excecoes", "bloqueio", "bloqueios", "reconciliacao", "trilha de decisao", "sem dupla digitacao"],
    demandSignals: ["Alertas de excecao, bloqueios por qualidade, reconciliacao de dados e trilha de decisao."],
    risk: "Excecoes, bloqueios e decisoes podem depender de monitoramento manual.",
    recommendation: "Automatizar alertas, bloqueios, reconciliacao de dados e trilha de decisao.",
    offerAngle: "Reduzir dependencia de controle manual e dupla digitacao.",
    weight: 7,
  },
  {
    moduleId: "quantitativos-automaticos",
    moduleName: "Quantitativos automaticos",
    category: "Controle",
    keywords: ["quantitativo", "quantitativos", "consolidar", "consolidacao", "origem rastreavel", "dupla digitacao", "itens de projeto", "servicos do rdo"],
    demandSignals: ["Servicos do RDO, itens de projeto, medicoes, materiais e frentes consolidados com origem rastreavel."],
    risk: "Servicos, materiais e medicoes podem ser digitados mais de uma vez sem origem rastreavel.",
    recommendation: "Consolidar quantitativos automaticamente a partir de RDO, projeto, materiais e frentes.",
    offerAngle: "Evitar dupla digitacao e criar quantitativo com origem rastreavel.",
    weight: 8,
  },
];

const contactIcons: Record<string, typeof Phone> = {
  celular: Phone,
  email: Mail,
  linkedin: Link2,
  outro: UserPlus,
};

const normalize = (value: string) =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const splitSentences = (text: string) =>
  text
    .split(/\n|\.|;|\u2022|-/)
    .map((part) => part.trim())
    .filter((part) => part.length > 12);

const splitEvidenceChunks = (text: string): Array<{ quote: string; sourceIndex: number }> =>
  text
    .split(/\n|\.|;|\u2022|-/)
    .map((part) => part.trim())
    .filter((part) => part.length > 12)
    .map((quote, index) => ({ quote, sourceIndex: index + 1 }));

const extractTasks = (about: string) => {
  return computeModuleMatches(about).map((match) => match.moduleName);
};

const buildTaskEvidence = (about: string) => {
  const chunks = splitEvidenceChunks(about);
  return moduleCatalog
    .map((module) => {
      const hits = chunks.filter((chunk) => {
        const normalized = normalize(chunk.quote);
        return module.keywords.some((keyword) => normalized.includes(normalize(keyword)));
      });
      return { label: module.moduleName, examples: hits.slice(0, 2).map((hit) => hit.quote), count: hits.length };
    })
    .filter((task) => task.count > 0);
};

const priorityByIndex = (index: number): ModuleMatch["priority"] => {
  if (index === 0) return "Oferta principal";
  if (index <= 3) return "Complementares";
  return "Possivel expansao";
};

const computeModuleMatches = (about: string): ModuleMatch[] => {
  const chunks = splitEvidenceChunks(about);

  return moduleCatalog
    .map((module) => {
      const evidences = chunks
        .map((chunk) => {
          const normalized = normalize(chunk.quote);
          const matchedKeywords = module.keywords.filter((keyword) => normalized.includes(normalize(keyword)));
          if (matchedKeywords.length === 0) return null;

          return {
            id: `evidencia-${module.moduleId}-${chunk.sourceIndex}`,
            quote: chunk.quote,
            source: "Sobre a vaga" as const,
            sourceIndex: chunk.sourceIndex,
            matchedKeywords,
          };
        })
        .filter(Boolean) as DiagnosisEvidence[];

      if (evidences.length === 0) return null;

      const uniqueKeywords = new Set(evidences.flatMap((evidence) => evidence.matchedKeywords.map(normalize)));
      const score = Math.min(100, module.weight * uniqueKeywords.size + evidences.length * 8);

      return {
        moduleId: module.moduleId,
        moduleName: module.moduleName,
        category: module.category,
        score,
        priority: "Possivel expansao" as const,
        demandSignals: module.demandSignals,
        risk: module.risk,
        recommendation: module.recommendation,
        offerAngle: module.offerAngle,
        evidences: evidences.slice(0, 3),
      };
    })
    .filter(Boolean)
    .sort((a, b) => b!.score - a!.score)
    .map((match, index) => ({ ...match!, priority: priorityByIndex(index) }));
};

const buildRiskFindings = (about: string): DiagnosisRisk[] => {
  return computeModuleMatches(about).map((match) => ({
    id: `risco-${match.moduleId}`,
    task: match.moduleName,
    risk: match.risk,
    module: match.moduleName,
    recommendation: match.recommendation,
    evidences: match.evidences,
  }));
};

const buildGlobalModuleContext = (prospects: Prospect[]): GlobalModuleContext => {
  const prospectsWithJobs = prospects.filter((prospect) => prospect.job_about?.trim()).length || 1;
  const counts = new Map<string, { moduleId: string; moduleName: string; count: number }>();

  prospects.forEach((prospect) => {
    const matches = hasDiagnosis(prospect.operational_diagnosis) && prospect.operational_diagnosis.moduleMatches?.length
      ? prospect.operational_diagnosis.moduleMatches
      : computeModuleMatches(prospect.job_about || "");
    new Set(matches.map((match) => match.moduleId)).forEach((moduleId) => {
      const moduleName = matches.find((match) => match.moduleId === moduleId)?.moduleName || moduleId;
      const current = counts.get(moduleId) || { moduleId, moduleName, count: 0 };
      current.count += 1;
      counts.set(moduleId, current);
    });
  });

  return {
    generatedAt: new Date().toISOString(),
    totalProspects: prospectsWithJobs,
    topModules: Array.from(counts.values())
      .map((item) => ({ ...item, percent: Math.round((item.count / prospectsWithJobs) * 100) }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8),
  };
};

const generateDiagnosis = (form: ProspectForm, _tasks: string[], prospectsContext: Prospect[] = []): Diagnosis => {
  const moduleMatches = computeModuleMatches(form.job_about);
  const topModules = moduleMatches.slice(0, 6);
  const moduleNames = topModules.map((match) => match.moduleName);
  const constructionSignals = moduleNames.length > 0 ? moduleNames.join(", ") : "gestao administrativa e operacional de obra";
  const risks = topModules.length > 0
    ? topModules.map((match) => match.risk)
    : [
        "RDO preenchido tarde ou incompleto.",
        "Fotos sem vinculo com etapa, local ou responsavel.",
        "Decisoes importantes perdidas entre obra e escritorio.",
        "Diretoria recebendo informacao consolidada tarde.",
        "Suprimentos sem rastreabilidade ate o impacto na obra.",
        "Medicao sem evidencia operacional forte.",
      ];

  const problemList = moduleNames.length > 0 ? moduleNames.slice(0, 4).join(", ") : "registros soltos, baixa rastreabilidade e consolidacao tardia";
  const construFit = Array.from(new Set([...moduleNames, ...construDataBase.pillars])).slice(0, 8);
  const featuresMessage = construFit.slice(0, 3).join("; ");
  const suggestedMessage =
    `Ola! Vi que a ${form.company_name || "empresa"} esta com a vaga de ${form.job_title || "operacao de obra"} aberta, normalmente ligada a ${problemList}. ` +
    `Isso costuma indicar a necessidade de mais controle sobre o que acontece em campo, menos dependencia de planilhas soltas e mais velocidade para a diretoria enxergar avancos, pendencias e gargalos. ` +
    `O ConstruData entrega exatamente isso, com ${featuresMessage}. Podemos agendar uma reuniao rapida de 20 minutos?\n\n` +
    `Como funciona o meu trabalho: em X dias, identificamos X, Y, Z problemas e encontramos solucoes X, Y, Z, otimizando a operacao em X, Y, Z. Alem disso, voce recebe relatorios do que melhorou e do que ainda esta travando a operacao.`;

  return {
    caseTitle: `Caso operacional - ${form.company_name || "Empresa sem nome"}`,
    observedWork: `${form.job_title || "Vaga analisada"}${form.location ? ` em ${form.location}` : ""}${form.company_name ? ` - ${form.company_name}` : ""}. Pelo tipo e porte da obra observado, a descricao indica rotinas ligadas a ${constructionSignals}.`,
    operationalHypothesis:
      `Pelo tipo e porte da obra, e provavel que exista alto volume de registro de campo, fotos, solicitacoes, medicoes, qualidade e alinhamento entre obra e escritorio. Quando isso depende de planilhas soltas e repasses manuais, a diretoria tende a enxergar avancos, pendencias e gargalos tarde demais, perdendo velocidade na decisao.`,
    commonRisks: risks,
    whereConstruDataFits: construFit,
    risks: buildRiskFindings(form.job_about),
    moduleMatches,
    topModules,
    globalContext: buildGlobalModuleContext(prospectsContext),
    suggestedMessage,
    messageDraft: suggestedMessage,
    sourceSnapshot: {
      companyName: form.company_name,
      location: form.location,
      jobTitle: form.job_title,
      linkedinJobUrl: form.linkedin_job_url,
      jobAbout: form.job_about,
      generatedFrom: form.linkedin_job_url ? "linkedin" : "manual",
      importedAt: new Date().toISOString(),
    },
    generatedAt: new Date().toISOString(),
  };
};

const hasDiagnosis = (value: Prospect["operational_diagnosis"]): value is Diagnosis =>
  !!value && "suggestedMessage" in value;

const extractLinkedInJobId = (url: string) => {
  const match = url.match(/jobs\/view\/(\d+)/i) || url.match(/[?&]currentJobId=(\d+)/i);
  return match?.[1] || "";
};

const stableHash = (value: string) => {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
};

const buildJobFingerprint = (data: Pick<ProspectForm, "company_name" | "job_title" | "job_about" | "linkedin_job_url">) => {
  const linkedInId = extractLinkedInJobId(data.linkedin_job_url || "");
  if (linkedInId) return `linkedin:${linkedInId}`;

  const normalized = [
    normalize(data.company_name || ""),
    normalize(data.job_title || ""),
    normalize((data.job_about || "").slice(0, 700)),
  ].join("|");

  return normalized.replace(/\|/g, "").trim() ? `manual:${stableHash(normalized)}` : "";
};

const getProspectFingerprint = (prospect: Prospect) =>
  prospect.job_fingerprint ||
  buildJobFingerprint({
    company_name: prospect.company_name || "",
    job_title: prospect.job_title || "",
    job_about: prospect.job_about || "",
    linkedin_job_url: prospect.linkedin_job_url || "",
  });

const MAP_WIDTH = 1000;
const MAP_HEIGHT = 520;
const TILE_SIZE = 256;
const DEFAULT_MAP_CENTER = { lat: -14.235, lng: -51.925 };

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const toWorldPoint = (lat: number, lng: number, zoom: number) => {
  const scale = TILE_SIZE * 2 ** zoom;
  const sin = Math.sin((clamp(lat, -85.0511, 85.0511) * Math.PI) / 180);
  return {
    x: ((lng + 180) / 360) * scale,
    y: (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * scale,
  };
};

const getMapTiles = (center: { lat: number; lng: number }, zoom: number) => {
  const centerPoint = toWorldPoint(center.lat, center.lng, zoom);
  const startTileX = Math.floor((centerPoint.x - MAP_WIDTH / 2) / TILE_SIZE);
  const endTileX = Math.floor((centerPoint.x + MAP_WIDTH / 2) / TILE_SIZE);
  const startTileY = Math.floor((centerPoint.y - MAP_HEIGHT / 2) / TILE_SIZE);
  const endTileY = Math.floor((centerPoint.y + MAP_HEIGHT / 2) / TILE_SIZE);
  const maxTile = 2 ** zoom;
  const tiles: Array<{ key: string; url: string; x: number; y: number }> = [];

  for (let x = startTileX; x <= endTileX; x += 1) {
    for (let y = startTileY; y <= endTileY; y += 1) {
      if (y < 0 || y >= maxTile) continue;
      const wrappedX = ((x % maxTile) + maxTile) % maxTile;
      const subdomain = ["a", "b", "c"][Math.abs(x + y) % 3];
      tiles.push({
        key: `${zoom}-${x}-${y}`,
        url: `https://${subdomain}.basemaps.cartocdn.com/dark_all/${zoom}/${wrappedX}/${y}@2x.png`,
        x: x * TILE_SIZE - centerPoint.x + MAP_WIDTH / 2,
        y: y * TILE_SIZE - centerPoint.y + MAP_HEIGHT / 2,
      });
    }
  }

  return tiles;
};

const projectToMap = (lat: number, lng: number, center: { lat: number; lng: number }, zoom: number) => {
  const point = toWorldPoint(lat, lng, zoom);
  const centerPoint = toWorldPoint(center.lat, center.lng, zoom);
  return {
    x: point.x - centerPoint.x + MAP_WIDTH / 2,
    y: point.y - centerPoint.y + MAP_HEIGHT / 2,
  };
};

const taskDueState = (task: Pick<MapTask, "due_date" | "status">, todayIso: string) => {
  if (!task.due_date || task.status === "completed") return "none";
  if (task.due_date < todayIso) return "overdue";
  if (task.due_date === todayIso) return "today";
  return "future";
};

export const Prospecting = () => {
  const queryClient = useQueryClient();
  const { selectedCompanyId } = useCompany();
  const [searchQuery, setSearchQuery] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProspect, setEditingProspect] = useState<Prospect | null>(null);
  const [selectedProspect, setSelectedProspect] = useState<Prospect | null>(null);
  const [form, setForm] = useState<ProspectForm>(emptyForm);
  const [linkedinPaste, setLinkedinPaste] = useState("");
  const [messageDraft, setMessageDraft] = useState("");
  const [mapZoom, setMapZoom] = useState(4);
  const [mapCenter, setMapCenter] = useState(DEFAULT_MAP_CENTER);
  const [mapTaskFilter, setMapTaskFilter] = useState<"all" | "overdue" | "today">("all");
  const [mapLayers, setMapLayers] = useState({ contacts: true, projects: true });
  const [selectedMapEntity, setSelectedMapEntity] = useState<MapEntity | null>(null);

  const { data: prospects = [], isLoading } = useQuery({
    queryKey: ["commercial-prospects", selectedCompanyId],
    queryFn: async () => {
      let query = (supabase as any)
        .from("commercial_prospects")
        .select("*")
        .order("created_at", { ascending: false });
      if (selectedCompanyId !== "all") query = query.eq("company_id", selectedCompanyId);
      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as Prospect[];
    },
  });

  const { data: mapContacts = [] } = useQuery({
    queryKey: ["prospecting-map-contacts", selectedCompanyId],
    queryFn: async () => {
      let query = (supabase as any)
        .from("contacts")
        .select("id, name, company, email, phone, address, latitude, longitude, project_id")
        .not("latitude", "is", null)
        .not("longitude", "is", null)
        .order("name");
      if (selectedCompanyId !== "all") query = query.eq("company_id", selectedCompanyId);
      const { data, error } = await query;
      if (error) throw error;
      return (data || []).map((item: any) => ({
        ...item,
        latitude: item.latitude == null ? null : Number(item.latitude),
        longitude: item.longitude == null ? null : Number(item.longitude),
      })) as MapContact[];
    },
  });

  const { data: mapProjects = [] } = useQuery({
    queryKey: ["prospecting-map-projects", selectedCompanyId],
    queryFn: async () => {
      let query = (supabase as any)
        .from("projects")
        .select("id, title, client, status, due_date, address, latitude, longitude")
        .not("latitude", "is", null)
        .not("longitude", "is", null)
        .order("title");
      if (selectedCompanyId !== "all") query = query.eq("company_id", selectedCompanyId);
      const { data, error } = await query;
      if (error) throw error;
      return (data || []).map((item: any) => ({
        ...item,
        latitude: item.latitude == null ? null : Number(item.latitude),
        longitude: item.longitude == null ? null : Number(item.longitude),
      })) as MapProject[];
    },
  });

  const { data: mapTasks = [] } = useQuery({
    queryKey: ["prospecting-map-tasks", selectedCompanyId],
    queryFn: async () => {
      let query = (supabase as any)
        .from("tasks")
        .select("id, title, status, due_date, priority, contact_id, project_id")
        .or("contact_id.not.is.null,project_id.not.is.null")
        .order("due_date", { ascending: true });
      if (selectedCompanyId !== "all") query = query.eq("company_id", selectedCompanyId);
      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as MapTask[];
    },
  });

  const filteredProspects = useMemo(() => {
    const query = normalize(searchQuery);
    if (!query) return prospects;
    return prospects.filter((prospect) =>
      [prospect.company_name, prospect.location, prospect.job_title, prospect.job_about]
        .filter(Boolean)
        .some((value) => normalize(value || "").includes(query))
    );
  }, [prospects, searchQuery]);

  useEffect(() => {
    if (!selectedProspect) return;
    const updated = prospects.find((prospect) => prospect.id === selectedProspect.id);
    if (updated && updated !== selectedProspect) setSelectedProspect(updated);
  }, [prospects, selectedProspect]);

  const taskReport = useMemo(() => {
    const companiesWithJobs = prospects.filter((prospect) => prospect.job_about?.trim()).length || 1;
    const counts = new Map<string, { count: number; companies: string[] }>();

    prospects.forEach((prospect) => {
      const tasks = prospect.extracted_tasks?.length ? prospect.extracted_tasks : extractTasks(prospect.job_about || "");
      new Set(tasks).forEach((task) => {
        const current = counts.get(task) || { count: 0, companies: [] };
        current.count += 1;
        current.companies.push(prospect.company_name);
        counts.set(task, current);
      });
    });

    return Array.from(counts.entries())
      .map(([label, data]) => ({
        label,
        count: data.count,
        percent: Math.round((data.count / companiesWithJobs) * 100),
        companies: data.companies,
      }))
      .sort((a, b) => b.count - a.count);
  }, [prospects]);

  const moduleReport = useMemo(() => {
    const companiesWithJobs = prospects.filter((prospect) => prospect.job_about?.trim()).length || 1;
    const counts = new Map<string, { moduleId: string; moduleName: string; count: number; companies: string[] }>();

    prospects.forEach((prospect) => {
      const matches = hasDiagnosis(prospect.operational_diagnosis) && prospect.operational_diagnosis.moduleMatches?.length
        ? prospect.operational_diagnosis.moduleMatches
        : computeModuleMatches(prospect.job_about || "");

      new Set(matches.map((match) => match.moduleId)).forEach((moduleId) => {
        const moduleName = matches.find((match) => match.moduleId === moduleId)?.moduleName || moduleId;
        const current = counts.get(moduleId) || { moduleId, moduleName, count: 0, companies: [] };
        current.count += 1;
        current.companies.push(prospect.company_name);
        counts.set(moduleId, current);
      });
    });

    return Array.from(counts.values())
      .map((item) => ({ ...item, percent: Math.round((item.count / companiesWithJobs) * 100) }))
      .sort((a, b) => b.count - a.count);
  }, [prospects]);

  const formFingerprint = useMemo(() => buildJobFingerprint(form), [form.company_name, form.job_title, form.job_about, form.linkedin_job_url]);
  const formModuleMatches = useMemo(() => computeModuleMatches(form.job_about), [form.job_about]);
  const duplicateProspect = useMemo(() => {
    if (!formFingerprint) return null;
    return prospects.find((prospect) =>
      prospect.id !== editingProspect?.id &&
      getProspectFingerprint(prospect) === formFingerprint
    ) || null;
  }, [prospects, formFingerprint, editingProspect?.id]);

  const todayIso = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const mapEntities = useMemo<MapEntity[]>(() => {
    const contactEntities = mapContacts
      .filter((contact) => mapLayers.contacts && contact.latitude != null && contact.longitude != null)
      .map((contact) => {
        const tasks = mapTasks.filter((task) => task.contact_id === contact.id || (contact.project_id && task.project_id === contact.project_id));
        return {
          id: contact.id,
          type: "contact" as const,
          title: contact.name,
          subtitle: contact.company || "Contato sem empresa vinculada",
          address: contact.address || "Endereco nao informado",
          latitude: Number(contact.latitude),
          longitude: Number(contact.longitude),
          tasks,
        };
      });

    const projectEntities = mapProjects
      .filter((project) => mapLayers.projects && project.latitude != null && project.longitude != null)
      .map((project) => ({
        id: project.id,
        type: "project" as const,
        title: project.title,
        subtitle: project.client || "Projeto sem cliente vinculado",
        address: project.address || "Endereco nao informado",
        latitude: Number(project.latitude),
        longitude: Number(project.longitude),
        tasks: mapTasks.filter((task) => task.project_id === project.id),
      }));

    return [...contactEntities, ...projectEntities].filter((entity) => {
      if (mapTaskFilter === "all") return true;
      return entity.tasks.some((task) => taskDueState(task, todayIso) === mapTaskFilter);
    });
  }, [mapContacts, mapProjects, mapTasks, mapLayers.contacts, mapLayers.projects, mapTaskFilter, todayIso]);

  const mapStats = useMemo(() => {
    const uniqueTasks = new Map<string, MapTask>();
    mapEntities.forEach((entity) => entity.tasks.forEach((task) => uniqueTasks.set(task.id, task)));
    const tasks = Array.from(uniqueTasks.values());
    return {
      visible: mapEntities.length,
      overdue: tasks.filter((task) => taskDueState(task, todayIso) === "overdue").length,
      today: tasks.filter((task) => taskDueState(task, todayIso) === "today").length,
    };
  }, [mapEntities, todayIso]);

  useEffect(() => {
    if (mapEntities.length === 0) return;
    const lat = mapEntities.reduce((sum, entity) => sum + entity.latitude, 0) / mapEntities.length;
    const lng = mapEntities.reduce((sum, entity) => sum + entity.longitude, 0) / mapEntities.length;
    setMapCenter((current) => (current.lat === DEFAULT_MAP_CENTER.lat && current.lng === DEFAULT_MAP_CENTER.lng ? { lat, lng } : current));
  }, [mapEntities]);

  const mapTiles = useMemo(() => getMapTiles(mapCenter, mapZoom), [mapCenter, mapZoom]);
  const clusteredMapEntities = useMemo(() => {
    const projected = mapEntities
      .map((entity) => ({ entity, ...projectToMap(entity.latitude, entity.longitude, mapCenter, mapZoom) }))
      .filter((item) => item.x > -80 && item.x < MAP_WIDTH + 80 && item.y > -80 && item.y < MAP_HEIGHT + 80);
    const clusters: Array<{ id: string; x: number; y: number; entities: MapEntity[] }> = [];

    projected.forEach((item) => {
      const cluster = clusters.find((current) => Math.hypot(current.x - item.x, current.y - item.y) < 44);
      if (cluster) {
        cluster.entities.push(item.entity);
        cluster.x = (cluster.x * (cluster.entities.length - 1) + item.x) / cluster.entities.length;
        cluster.y = (cluster.y * (cluster.entities.length - 1) + item.y) / cluster.entities.length;
      } else {
        clusters.push({ id: item.entity.id, x: item.x, y: item.y, entities: [item.entity] });
      }
    });

    return clusters;
  }, [mapEntities, mapCenter, mapZoom]);

  const saveProspectMutation = useMutation({
    mutationFn: async () => {
      if (duplicateProspect) {
        throw new Error(`Vaga duplicada: ja existe um prospect para ${duplicateProspect.company_name}. Abra o registro existente para revisar.`);
      }
      const tasks = extractTasks(form.job_about);
      const diagnosis = generateDiagnosis(form, tasks, prospects);
      const existingDiagnosis = editingProspect && hasDiagnosis(editingProspect.operational_diagnosis)
        ? editingProspect.operational_diagnosis
        : null;
      if (existingDiagnosis?.messageDraft && existingDiagnosis.sourceSnapshot?.jobAbout === form.job_about) {
        diagnosis.messageDraft = existingDiagnosis.messageDraft;
        diagnosis.suggestedMessage = existingDiagnosis.messageDraft;
      }
      const contacts = form.contacts.filter((contact) => contact.value.trim());
      const payload = {
        company_name: form.company_name.trim(),
        location: form.location.trim() || null,
        linkedin_job_url: form.linkedin_job_url.trim() || null,
        job_title: form.job_title.trim() || null,
        job_about: form.job_about.trim() || null,
        contacts,
        extracted_tasks: tasks,
        operational_diagnosis: diagnosis,
        job_fingerprint: formFingerprint || null,
        status: form.status,
        priority: form.priority,
        meeting_date: form.meeting_date || null,
        notes: form.notes.trim() || null,
        company_id: selectedCompanyId !== "all" ? selectedCompanyId : null,
      };

      if (editingProspect) {
        const { error } = await (supabase as any).from("commercial_prospects").update(payload).eq("id", editingProspect.id);
        if (error) throw error;
      } else {
        const { error } = await (supabase as any).from("commercial_prospects").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["commercial-prospects"] });
      setDialogOpen(false);
      resetForm();
      toast({ title: editingProspect ? "Prospect atualizado!" : "Prospect criado!" });
    },
    onError: (error: any) => {
      toast({ title: "Erro ao salvar prospect", description: error?.message, variant: "destructive" });
    },
  });

  const deleteProspectMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("commercial_prospects").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["commercial-prospects"] });
      setSelectedProspect(null);
      toast({ title: "Prospect removido" });
    },
    onError: (error: any) => {
      toast({ title: "Erro ao remover prospect", description: error?.message, variant: "destructive" });
    },
  });

  const regenerateDiagnosisMutation = useMutation({
    mutationFn: async (prospect: Prospect) => {
      const nextForm = prospectToForm(prospect);
      const tasks = extractTasks(nextForm.job_about);
      const diagnosis = generateDiagnosis(nextForm, tasks, prospects);
      const jobFingerprint = buildJobFingerprint(nextForm);
      const { error } = await (supabase as any)
        .from("commercial_prospects")
        .update({ extracted_tasks: tasks, operational_diagnosis: diagnosis, job_fingerprint: jobFingerprint || null })
        .eq("id", prospect.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["commercial-prospects"] });
      toast({ title: "Diagnostico atualizado!" });
    },
    onError: (error: any) => {
      toast({ title: "Erro ao gerar diagnostico", description: error?.message, variant: "destructive" });
    },
  });

  const logImport = async (
    status: "success" | "error",
    payload: { url?: string; errorMessage?: string; summary?: any }
  ) => {
    try {
      await (supabase as any).from("linkedin_import_logs").insert({
        linkedin_url: payload.url || null,
        status,
        error_message: payload.errorMessage || null,
        extracted_summary: payload.summary || {},
        company_id: selectedCompanyId !== "all" ? selectedCompanyId : null,
        completed_at: new Date().toISOString(),
      });
      queryClient.invalidateQueries({ queryKey: ["linkedin-import-logs"] });
    } catch (e) {
      console.warn("Falha ao registrar log de import:", e);
    }
  };

  const saveDiagnosisMessageMutation = useMutation({
    mutationFn: async ({ prospect, draft }: { prospect: Prospect; draft: string }) => {
      const currentDiagnosis = hasDiagnosis(prospect.operational_diagnosis)
        ? prospect.operational_diagnosis
        : generateDiagnosis(prospectToForm(prospect), prospect.extracted_tasks || []);
      const nextDiagnosis: Diagnosis = {
        ...currentDiagnosis,
        suggestedMessage: draft,
        messageDraft: draft,
        updatedAt: new Date().toISOString(),
      };

      const { error } = await (supabase as any)
        .from("commercial_prospects")
        .update({ operational_diagnosis: nextDiagnosis })
        .eq("id", prospect.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["commercial-prospects"] });
      toast({ title: "Mensagem do diagnostico salva!" });
    },
    onError: (error: any) => {
      toast({ title: "Erro ao salvar mensagem", description: error?.message, variant: "destructive" });
    },
  });

  const importLinkedInMutation = useMutation({
    mutationFn: async () => {
      const url = form.linkedin_job_url.trim();
      const text = linkedinPaste.trim();
      if (!url && !text) {
        throw new Error("Informe a URL da vaga ou cole o texto antes de importar.");
      }
      const body = url ? { url, text: text || undefined } : { text };
      const { data, error } = await supabase.functions.invoke("linkedin-job-parser", { body });
      if (error) {
        let detail = error.message;
        try {
          const ctx: any = (error as any).context;
          if (ctx?.json) {
            const json = await ctx.json();
            if (json?.error) detail = json.error;
          } else if (ctx?.text) {
            detail = await ctx.text();
          }
        } catch {
          // ignore
        }
        throw new Error(detail || "Falha ao chamar a importacao da vaga.");
      }
      if (data?.error) throw new Error(data.error);
      return { data: data as { companyName?: string; location?: string; jobTitle?: string; about?: string }, url };
    },
    onSuccess: ({ data, url }) => {
      setForm((prev) => ({
        ...prev,
        company_name: data.companyName || prev.company_name,
        location: data.location || prev.location,
        job_title: data.jobTitle || prev.job_title,
        job_about: data.about || prev.job_about,
      }));
      logImport("success", {
        url,
        summary: {
          companyName: data.companyName,
          jobTitle: data.jobTitle,
          location: data.location,
          aboutLength: data.about?.length || 0,
        },
      });
      toast({ title: "Vaga importada", description: "Revise os dados antes de salvar o prospect." });
    },
    onError: (error: any) => {
      const msg = error?.message || "Erro desconhecido ao importar pela URL.";
      logImport("error", { url: form.linkedin_job_url.trim() || undefined, errorMessage: msg });
      toast({
        title: "Nao consegui importar pela URL",
        description: `${msg} Se a URL exigir login no LinkedIn, cole o texto da vaga no campo de apoio.`,
        variant: "destructive",
      });
    },
  });

  const { data: importLogs = [] } = useQuery({
    queryKey: ["linkedin-import-logs", selectedCompanyId],
    queryFn: async () => {
      let q = (supabase as any)
        .from("linkedin_import_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(20);
      if (selectedCompanyId !== "all") q = q.eq("company_id", selectedCompanyId);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as Array<{
        id: string;
        linkedin_url: string | null;
        status: string;
        error_message: string | null;
        extracted_summary: any;
        created_at: string;
      }>;
    },
  });

  const resetForm = () => {
    setForm(emptyForm);
    setLinkedinPaste("");
    setEditingProspect(null);
  };

  const prospectToForm = (prospect: Prospect): ProspectForm => ({
    company_name: prospect.company_name || "",
    location: prospect.location || "",
    linkedin_job_url: prospect.linkedin_job_url || "",
    job_title: prospect.job_title || "",
    job_about: prospect.job_about || "",
    contacts: prospect.contacts?.length ? prospect.contacts : [{ type: "celular", value: "", name: "" }],
    status: prospect.status || "new",
    priority: prospect.priority || "medium",
    meeting_date: prospect.meeting_date || "",
    notes: prospect.notes || "",
  });

  const openCreate = () => {
    resetForm();
    setDialogOpen(true);
  };

  const openEdit = (prospect: Prospect) => {
    setEditingProspect(prospect);
    setForm(prospectToForm(prospect));
    setLinkedinPaste("");
    setDialogOpen(true);
  };

  const updateContact = (index: number, value: Partial<ProspectContact>) => {
    setForm((prev) => ({
      ...prev,
      contacts: prev.contacts.map((contact, contactIndex) => (contactIndex === index ? { ...contact, ...value } : contact)),
    }));
  };

  const addContact = () => {
    setForm((prev) => ({ ...prev, contacts: [...prev.contacts, { type: "celular", value: "", name: "" }] }));
  };

  const removeContact = (index: number) => {
    setForm((prev) => ({
      ...prev,
      contacts: prev.contacts.length === 1 ? prev.contacts : prev.contacts.filter((_, contactIndex) => contactIndex !== index),
    }));
  };

  const copyMessage = async () => {
    if (!messageDraft.trim()) return;
    try {
      await navigator.clipboard.writeText(messageDraft);
      toast({ title: "Mensagem copiada!" });
    } catch (error: any) {
      toast({ title: "Erro ao copiar", description: error?.message, variant: "destructive" });
    }
  };

  const sendMessage = () => {
    if (!selectedProspect || !messageDraft.trim()) return;
    const email = selectedProspect.contacts?.find((contact) => contact.type === "email" && contact.value)?.value;
    const phone = selectedProspect.contacts?.find((contact) => contact.type === "celular" && contact.value)?.value;

    if (email) {
      const subject = encodeURIComponent(`Diagnostico operacional - ${selectedProspect.company_name}`);
      const body = encodeURIComponent(messageDraft);
      window.open(`mailto:${email}?subject=${subject}&body=${body}`, "_blank");
      return;
    }

    if (phone) {
      const cleanPhone = phone.replace(/\D/g, "");
      window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(messageDraft)}`, "_blank");
      return;
    }

    toast({ title: "Nenhum email ou celular salvo", description: "Adicione um contato na empresa antes de enviar." });
  };

  const selectedDiagnosis = selectedProspect && hasDiagnosis(selectedProspect.operational_diagnosis)
    ? selectedProspect.operational_diagnosis
    : null;

  const selectedRisks = selectedDiagnosis
    ? selectedDiagnosis.risks?.length
      ? selectedDiagnosis.risks
      : buildRiskFindings(selectedProspect?.job_about || "")
    : [];

  const selectedModuleMatches = selectedDiagnosis
    ? selectedDiagnosis.topModules?.length
      ? selectedDiagnosis.topModules
      : computeModuleMatches(selectedProspect?.job_about || "").slice(0, 6)
    : [];

  useEffect(() => {
    setMessageDraft(selectedDiagnosis?.messageDraft || selectedDiagnosis?.suggestedMessage || "");
  }, [selectedDiagnosis?.generatedAt, selectedDiagnosis?.updatedAt, selectedProspect?.id]);

  const totalWithDiagnosis = prospects.filter((prospect) => hasDiagnosis(prospect.operational_diagnosis)).length;
  const meetingCount = prospects.filter((prospect) => prospect.status === "meeting").length;
  const contactedCount = prospects.filter((prospect) => ["contacted", "meeting", "won"].includes(prospect.status)).length;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
        <div>
          <h2 className="text-xl font-heading font-bold flex items-center gap-2">
            <FileSearch className="h-5 w-5 text-primary" />
            Prospecção
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Empresas para abordar, leitura de vagas do LinkedIn e diagnostico operacional preliminar.
          </p>
        </div>
        <Button className="gap-2 rounded-xl shadow-lg shadow-primary/20" onClick={openCreate}>
          <Plus className="h-4 w-4" />
          Adicionar empresa
        </Button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "Empresas", value: prospects.length, icon: Building2, className: "text-primary bg-primary/10 border-primary/20" },
          { label: "Contactadas", value: contactedCount, icon: MessageSquareText, className: "text-amber-600 bg-amber-500/10 border-amber-500/20" },
          { label: "Reunioes", value: meetingCount, icon: CalendarClock, className: "text-purple-500 bg-purple-500/10 border-purple-500/20" },
          { label: "Diagnosticos", value: totalWithDiagnosis, icon: Sparkles, className: "text-emerald-500 bg-emerald-500/10 border-emerald-500/20" },
        ].map((stat) => (
          <Card key={stat.label} className={cn("border", stat.className.split(" ").find((item) => item.startsWith("border-")))}>
            <CardContent className="p-4 flex items-center gap-3">
              <div className={cn("p-2 rounded-lg", stat.className)}>
                <stat.icon className="h-4 w-4" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stat.value}</p>
                <p className="text-xs text-muted-foreground">{stat.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="overflow-hidden border-zinc-800 bg-zinc-950 text-zinc-100 shadow-2xl shadow-black/30">
        <CardHeader className="border-b border-zinc-800/80 pb-3">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <CardTitle className="text-base flex items-center gap-2 text-zinc-50">
                <Navigation className="h-4 w-4 text-cyan-300" />
                Mapa operacional de clientes e projetos
              </CardTitle>
              <p className="text-xs text-zinc-500 mt-1">
                Coloquei o mapa aqui, antes da tabela, para virar a visao de comando da prospeccao sem esconder o diagnostico.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {[
                { key: "all", label: "Todos" },
                { key: "overdue", label: `Vencidas ${mapStats.overdue}` },
                { key: "today", label: `Hoje ${mapStats.today}` },
              ].map((filter) => (
                <Button
                  key={filter.key}
                  variant={mapTaskFilter === filter.key ? "secondary" : "outline"}
                  size="sm"
                  className={cn(
                    "h-8 rounded-lg border-zinc-800 text-xs",
                    mapTaskFilter === filter.key ? "bg-zinc-100 text-zinc-950" : "bg-zinc-900/70 text-zinc-300 hover:bg-zinc-800"
                  )}
                  onClick={() => setMapTaskFilter(filter.key as typeof mapTaskFilter)}
                >
                  {filter.label}
                </Button>
              ))}
              <Button
                variant="outline"
                size="sm"
                className={cn("h-8 rounded-lg border-zinc-800 text-xs", mapLayers.contacts ? "bg-cyan-400/10 text-cyan-200" : "bg-zinc-900/70 text-zinc-500")}
                onClick={() => setMapLayers((prev) => ({ ...prev, contacts: !prev.contacts }))}
              >
                Contatos
              </Button>
              <Button
                variant="outline"
                size="sm"
                className={cn("h-8 rounded-lg border-zinc-800 text-xs", mapLayers.projects ? "bg-emerald-400/10 text-emerald-200" : "bg-zinc-900/70 text-zinc-500")}
                onClick={() => setMapLayers((prev) => ({ ...prev, projects: !prev.projects }))}
              >
                Projetos
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_320px]">
            <div className="relative h-[460px] overflow-hidden bg-black">
              <div className="absolute left-3 top-3 z-20 flex flex-col gap-2">
                <Button size="icon" variant="outline" className="h-9 w-9 border-zinc-700 bg-zinc-950/90 text-zinc-100 hover:bg-zinc-800" onClick={() => setMapZoom((zoom) => Math.min(14, zoom + 1))}>
                  <Plus className="h-4 w-4" />
                </Button>
                <Button size="icon" variant="outline" className="h-9 w-9 border-zinc-700 bg-zinc-950/90 text-zinc-100 hover:bg-zinc-800" onClick={() => setMapZoom((zoom) => Math.max(3, zoom - 1))}>
                  <Minus className="h-4 w-4" />
                </Button>
                <Button
                  size="icon"
                  variant="outline"
                  className="h-9 w-9 border-zinc-700 bg-zinc-950/90 text-zinc-100 hover:bg-zinc-800"
                  onClick={() => {
                    if (mapEntities.length === 0) return;
                    setMapCenter({
                      lat: mapEntities.reduce((sum, entity) => sum + entity.latitude, 0) / mapEntities.length,
                      lng: mapEntities.reduce((sum, entity) => sum + entity.longitude, 0) / mapEntities.length,
                    });
                    setMapZoom(mapEntities.length > 1 ? 5 : 10);
                  }}
                >
                  <LocateFixed className="h-4 w-4" />
                </Button>
              </div>

              <div className="absolute inset-0">
                {mapTiles.map((tile) => (
                  <img
                    key={tile.key}
                    src={tile.url}
                    alt=""
                    className="absolute select-none opacity-95"
                    draggable={false}
                    style={{
                      left: `${(tile.x / MAP_WIDTH) * 100}%`,
                      top: `${(tile.y / MAP_HEIGHT) * 100}%`,
                      width: `${(TILE_SIZE / MAP_WIDTH) * 100}%`,
                      height: `${(TILE_SIZE / MAP_HEIGHT) * 100}%`,
                    }}
                  />
                ))}
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_30%,rgba(34,211,238,0.12),transparent_42%),linear-gradient(180deg,rgba(0,0,0,0.15),rgba(0,0,0,0.55))]" />
              </div>

              {clusteredMapEntities.map((cluster) => {
                const hasOverdue = cluster.entities.some((entity) => entity.tasks.some((task) => taskDueState(task, todayIso) === "overdue"));
                const hasToday = cluster.entities.some((entity) => entity.tasks.some((task) => taskDueState(task, todayIso) === "today"));
                const only = cluster.entities[0];
                const color = hasOverdue ? "bg-red-400 border-red-200 shadow-red-500/40" : hasToday ? "bg-amber-300 border-amber-100 shadow-amber-500/30" : only.type === "project" ? "bg-emerald-300 border-emerald-100 shadow-emerald-500/30" : "bg-cyan-300 border-cyan-100 shadow-cyan-500/30";
                return (
                  <button
                    key={cluster.entities.map((entity) => entity.id).join("-")}
                    type="button"
                    className={cn(
                      "absolute z-10 -translate-x-1/2 -translate-y-1/2 border text-zinc-950 shadow-lg transition hover:scale-110",
                      cluster.entities.length > 1 ? "h-9 min-w-9 rounded-full px-2 text-xs font-bold" : "h-5 w-5 rounded-full ring-4 ring-white/15",
                      color
                    )}
                    style={{ left: `${(cluster.x / MAP_WIDTH) * 100}%`, top: `${(cluster.y / MAP_HEIGHT) * 100}%` }}
                    onClick={() => {
                      if (cluster.entities.length > 1) {
                        setMapCenter({
                          lat: cluster.entities.reduce((sum, entity) => sum + entity.latitude, 0) / cluster.entities.length,
                          lng: cluster.entities.reduce((sum, entity) => sum + entity.longitude, 0) / cluster.entities.length,
                        });
                        setMapZoom((zoom) => Math.min(14, zoom + 2));
                      } else {
                        setSelectedMapEntity(only);
                        setMapCenter({ lat: only.latitude, lng: only.longitude });
                      }
                    }}
                  >
                    {cluster.entities.length > 1 ? cluster.entities.length : ""}
                  </button>
                );
              })}

              {mapEntities.length === 0 && (
                <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/40">
                  <div className="max-w-sm text-center">
                    <MapPin className="mx-auto h-9 w-9 text-zinc-600 mb-3" />
                    <p className="text-sm font-semibold text-zinc-200">Nenhum contato ou projeto com coordenadas</p>
                    <p className="text-xs text-zinc-500 mt-1">Cadastre um endereco em Contatos ou Projetos para preencher latitude e longitude automaticamente.</p>
                  </div>
                </div>
              )}

              <div className="absolute bottom-3 left-3 z-20 rounded-full border border-zinc-800 bg-zinc-950/90 px-3 py-1 text-[10px] text-zinc-400">
                CARTO, OpenStreetMap contributors - {mapStats.visible} pontos visiveis
              </div>
            </div>

            <div className="border-t border-zinc-800 bg-zinc-950/95 p-4 xl:border-l xl:border-t-0">
              {selectedMapEntity ? (
                <div className="space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <Badge variant="outline" className={cn("mb-2 border-zinc-700 text-[10px]", selectedMapEntity.type === "project" ? "text-emerald-300" : "text-cyan-300")}>
                        {selectedMapEntity.type === "project" ? "Projeto" : "Contato"}
                      </Badge>
                      <h3 className="text-sm font-semibold text-zinc-50">{selectedMapEntity.title}</h3>
                      <p className="text-xs text-zinc-500">{selectedMapEntity.subtitle}</p>
                    </div>
                    <Button size="icon" variant="ghost" className="h-8 w-8 text-zinc-500 hover:bg-zinc-900 hover:text-zinc-100" onClick={() => setSelectedMapEntity(null)}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-3">
                    <p className="text-[10px] uppercase tracking-[0.18em] text-zinc-500">Endereco</p>
                    <p className="mt-1 text-xs text-zinc-300">{selectedMapEntity.address}</p>
                  </div>
                  <div>
                    <div className="mb-2 flex items-center justify-between">
                      <p className="text-xs font-semibold text-zinc-200">Tarefas vencidas/hoje</p>
                      <Badge variant="outline" className="border-zinc-700 text-[10px] text-zinc-400">{selectedMapEntity.tasks.length}</Badge>
                    </div>
                    <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                      {selectedMapEntity.tasks
                        .filter((task) => ["overdue", "today"].includes(taskDueState(task, todayIso)))
                        .map((task) => {
                          const state = taskDueState(task, todayIso);
                          return (
                            <div key={task.id} className={cn("rounded-lg border p-2.5", state === "overdue" ? "border-red-500/30 bg-red-500/10" : "border-amber-500/30 bg-amber-500/10")}>
                              <p className="text-xs font-medium text-zinc-100">{task.title}</p>
                              <p className="mt-1 text-[10px] text-zinc-400">
                                {state === "overdue" ? "Vencida" : "Hoje"} {task.due_date ? `- ${new Date(task.due_date + "T00:00:00").toLocaleDateString("pt-BR")}` : ""}
                              </p>
                            </div>
                          );
                        })}
                      {selectedMapEntity.tasks.filter((task) => ["overdue", "today"].includes(taskDueState(task, todayIso))).length === 0 && (
                        <p className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-3 text-xs text-zinc-500">Sem tarefas vencidas ou para hoje neste ponto.</p>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex h-full min-h-[240px] flex-col justify-between">
                  <div>
                    <SlidersHorizontal className="h-5 w-5 text-zinc-500 mb-3" />
                    <h3 className="text-sm font-semibold text-zinc-100">Clique em um pin</h3>
                    <p className="mt-1 text-xs text-zinc-500">O painel abre com cliente/projeto, endereco e tarefas vencidas ou de hoje. Clusters aproximam o zoom para manter o mapa legivel.</p>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="rounded-lg border border-zinc-800 p-2">
                      <p className="text-lg font-bold text-zinc-50">{mapStats.visible}</p>
                      <p className="text-[10px] text-zinc-500">pontos</p>
                    </div>
                    <div className="rounded-lg border border-red-500/30 p-2">
                      <p className="text-lg font-bold text-red-300">{mapStats.overdue}</p>
                      <p className="text-[10px] text-zinc-500">vencidas</p>
                    </div>
                    <div className="rounded-lg border border-amber-500/30 p-2">
                      <p className="text-lg font-bold text-amber-200">{mapStats.today}</p>
                      <p className="text-[10px] text-zinc-500">hoje</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.35fr)_minmax(360px,0.65fr)] gap-4">
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <BriefcaseBusiness className="h-4 w-4 text-primary" />
                  Empresas para prospectar
                </CardTitle>
                <div className="relative w-full sm:w-72">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    className="pl-9 rounded-xl"
                    placeholder="Buscar empresa, vaga ou local..."
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="h-40 rounded-xl bg-muted/30 animate-pulse" />
              ) : filteredProspects.length === 0 ? (
                <div className="py-14 text-center">
                  <Building2 className="h-10 w-10 mx-auto text-muted-foreground/50 mb-3" />
                  <p className="text-sm font-medium">Nenhuma empresa cadastrada</p>
                  <p className="text-xs text-muted-foreground mt-1">Adicione uma vaga do LinkedIn ou cadastre manualmente.</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="h-9 px-3">Empresa</TableHead>
                      <TableHead className="hidden h-9 px-3 lg:table-cell">Vaga</TableHead>
                      <TableHead className="h-9 px-3">Status</TableHead>
                      <TableHead className="hidden h-9 px-3 md:table-cell">Modulos</TableHead>
                      <TableHead className="h-9 px-3 text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredProspects.map((prospect) => {
                      const moduleBadges = hasDiagnosis(prospect.operational_diagnosis) && prospect.operational_diagnosis.topModules?.length
                        ? prospect.operational_diagnosis.topModules
                        : computeModuleMatches(prospect.job_about || "");
                      return (
                        <TableRow
                          key={prospect.id}
                          className={cn("cursor-pointer", selectedProspect?.id === prospect.id && "bg-muted/60")}
                          onClick={() => setSelectedProspect(prospect)}
                        >
                          <TableCell className="px-3 py-2">
                            <div className="space-y-0.5">
                              <p className="text-sm font-medium leading-tight">{prospect.company_name}</p>
                              <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                                {prospect.location && (
                                  <span className="flex items-center gap-1">
                                    <MapPin className="h-3 w-3" />
                                    {prospect.location}
                                  </span>
                                )}
                                {prospect.contacts?.[0]?.value && (
                                  <span className="flex items-center gap-1">
                                    <Phone className="h-3 w-3" />
                                    {prospect.contacts[0].value}
                                  </span>
                                )}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="hidden max-w-[260px] px-3 py-2 lg:table-cell">
                            <p className="truncate text-sm">{prospect.job_title || "Vaga nao informada"}</p>
                            {prospect.linkedin_job_url && (
                              <a
                                href={prospect.linkedin_job_url}
                                target="_blank"
                                rel="noreferrer"
                                className="text-xs text-primary inline-flex items-center gap-1"
                                onClick={(event) => event.stopPropagation()}
                              >
                                LinkedIn <ExternalLink className="h-3 w-3" />
                              </a>
                            )}
                          </TableCell>
                          <TableCell className="px-3 py-2">
                            <div className="flex flex-col gap-0.5">
                              <Badge variant="outline" className={cn("w-fit text-[11px]", statusConfig[prospect.status]?.className)}>
                                {statusConfig[prospect.status]?.label || prospect.status}
                              </Badge>
                              <Badge variant="outline" className={cn("w-fit text-[11px]", priorityConfig[prospect.priority]?.className)}>
                                {priorityConfig[prospect.priority]?.label || prospect.priority}
                              </Badge>
                            </div>
                          </TableCell>
                          <TableCell className="hidden px-3 py-2 md:table-cell">
                            <div className="flex flex-wrap gap-1 max-w-[280px]">
                              {moduleBadges.slice(0, 2).map((module) => (
                                <Badge key={module.moduleId} variant="secondary" className="text-[10px]">
                                  {module.moduleName}
                                </Badge>
                              ))}
                              {moduleBadges.length > 2 && <Badge variant="outline" className="text-[10px]">+{moduleBadges.length - 2}</Badge>}
                              {moduleBadges.length === 0 && <Badge variant="outline" className="text-[10px]">Sem sinais</Badge>}
                            </div>
                          </TableCell>
                          <TableCell className="px-3 py-2 text-right">
                            <div className="flex justify-end gap-1">
                              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(event) => { event.stopPropagation(); openEdit(prospect); }}>
                                <Edit2 className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                                onClick={(event) => { event.stopPropagation(); deleteProspectMutation.mutate(prospect.id); }}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-primary" />
                Tarefas que mais aparecem nas vagas
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {taskReport.length === 0 ? (
                <p className="text-sm text-muted-foreground py-6 text-center">Cadastre vagas para gerar o relatorio de recorrencia.</p>
              ) : (
                taskReport.map((task) => (
                  <div key={task.label} className="space-y-1.5">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium">{task.label}</p>
                        <p className="text-xs text-muted-foreground truncate max-w-[680px]">
                          {task.companies.slice(0, 4).join(", ")}
                          {task.companies.length > 4 ? ` +${task.companies.length - 4}` : ""}
                        </p>
                      </div>
                      <span className="text-sm font-bold tabular-nums">{task.percent}%</span>
                    </div>
                    <Progress value={task.percent} className="h-2" />
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                Modulos ConstruData mais indicados
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {moduleReport.length === 0 ? (
                <p className="text-sm text-muted-foreground py-6 text-center">Cadastre vagas com descricao para ranquear os modulos recomendados.</p>
              ) : (
                moduleReport.slice(0, 10).map((module) => (
                  <div key={module.moduleId} className="space-y-1.5">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium">{module.moduleName}</p>
                        <p className="text-xs text-muted-foreground truncate max-w-[680px]">
                          {module.count} empresa{module.count > 1 ? "s" : ""}: {module.companies.slice(0, 4).join(", ")}
                          {module.companies.length > 4 ? ` +${module.companies.length - 4}` : ""}
                        </p>
                      </div>
                      <span className="text-sm font-bold tabular-nums">{module.percent}%</span>
                    </div>
                    <Progress value={module.percent} className="h-2" />
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Link2 className="h-4 w-4 text-primary" />
                Histórico de importações do LinkedIn
              </CardTitle>
            </CardHeader>
            <CardContent>
              {importLogs.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  Nenhuma importação registrada ainda.
                </p>
              ) : (
                <div className="space-y-2 max-h-72 overflow-y-auto">
                  {importLogs.map((log) => {
                    const ok = log.status === "success";
                    return (
                      <div
                        key={log.id}
                        className={cn(
                          "rounded-lg border p-2.5 text-xs flex items-start gap-2",
                          ok
                            ? "border-emerald-500/30 bg-emerald-500/5"
                            : "border-red-500/30 bg-red-500/5"
                        )}
                      >
                        <Badge
                          variant="outline"
                          className={cn(
                            "shrink-0 text-[10px]",
                            ok
                              ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/30"
                              : "bg-red-500/10 text-red-500 border-red-500/30"
                          )}
                        >
                          {ok ? "Sucesso" : "Erro"}
                        </Badge>
                        <div className="min-w-0 flex-1">
                          <p className="font-medium truncate">
                            {log.extracted_summary?.companyName || log.linkedin_url || "Importação manual"}
                          </p>
                          {log.extracted_summary?.jobTitle && (
                            <p className="text-muted-foreground truncate">
                              {log.extracted_summary.jobTitle}
                              {log.extracted_summary?.aboutLength
                                ? ` • ${log.extracted_summary.aboutLength} caracteres`
                                : ""}
                            </p>
                          )}
                          {log.error_message && (
                            <p className="text-red-500/80 mt-1 break-words">{log.error_message}</p>
                          )}
                          <p className="text-[10px] text-muted-foreground mt-1">
                            {new Date(log.created_at).toLocaleString("pt-BR")}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <Card className="xl:sticky xl:top-4 xl:self-start">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                Caso/Diagnostico Operacional
              </CardTitle>
              {selectedProspect && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 gap-2 rounded-lg"
                  onClick={() => regenerateDiagnosisMutation.mutate(selectedProspect)}
                  disabled={regenerateDiagnosisMutation.isPending}
                >
                  <RefreshCw className={cn("h-3.5 w-3.5", regenerateDiagnosisMutation.isPending && "animate-spin")} />
                  Regerar
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {!selectedProspect ? (
              <div className="py-12 text-center">
                <ClipboardList className="h-10 w-10 mx-auto text-muted-foreground/50 mb-3" />
                <p className="text-sm font-medium">Selecione uma empresa</p>
                <p className="text-xs text-muted-foreground mt-1">O caso gerado pela vaga fica salvo aqui para revisar antes da reuniao.</p>
              </div>
            ) : !selectedDiagnosis ? (
              <div className="py-12 text-center">
                <AlertTriangle className="h-10 w-10 mx-auto text-amber-500/70 mb-3" />
                <p className="text-sm font-medium">Sem diagnostico gerado</p>
                <p className="text-xs text-muted-foreground mt-1">Edite e salve a empresa ou clique em regerar.</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Caso salvo</p>
                  <h3 className="font-bold text-lg">{selectedDiagnosis.caseTitle || `Caso operacional - ${selectedProspect.company_name}`}</h3>
                  <p className="text-xs text-muted-foreground">{selectedProspect.job_title || "Vaga sem titulo"}</p>
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    <Badge variant="outline" className="text-[10px]">
                      Fonte: {selectedDiagnosis.sourceSnapshot?.generatedFrom === "linkedin" ? "LinkedIn" : "Manual"}
                    </Badge>
                    {selectedDiagnosis.sourceSnapshot?.linkedinJobUrl && (
                      <a href={selectedDiagnosis.sourceSnapshot.linkedinJobUrl} target="_blank" rel="noreferrer">
                        <Badge variant="outline" className="text-[10px] gap-1 cursor-pointer hover:bg-primary/10">
                          Vaga original <ExternalLink className="h-3 w-3" />
                        </Badge>
                      </a>
                    )}
                  </div>
                </div>

                {[
                  { title: "1. Obra observada", content: selectedDiagnosis.observedWork },
                  { title: "2. Hipótese operacional", content: selectedDiagnosis.operationalHypothesis },
                ].map((section) => (
                  <div key={section.title} className="rounded-lg border p-3 bg-muted/20">
                    <p className="text-xs font-semibold mb-1">{section.title}</p>
                    <p className="text-xs text-muted-foreground leading-relaxed">{section.content}</p>
                  </div>
                ))}

                <div className="rounded-lg border p-3 bg-primary/5 border-primary/20">
                  <p className="text-xs font-semibold mb-2">Modulos recomendados por prioridade</p>
                  {selectedModuleMatches.length === 0 ? (
                    <p className="text-xs text-muted-foreground">Nenhum modulo foi identificado a partir do Sobre a vaga.</p>
                  ) : (
                    <div className="space-y-3">
                      {["Oferta principal", "Complementares", "Possivel expansao"].map((priority) => {
                        const modules = selectedModuleMatches.filter((module) => module.priority === priority);
                        if (modules.length === 0) return null;
                        return (
                          <div key={priority} className="space-y-2">
                            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">{priority}</p>
                            {modules.map((module) => (
                              <div key={module.moduleId} className="rounded-lg border bg-background/80 p-3">
                                <div className="flex items-start justify-between gap-3">
                                  <div className="min-w-0">
                                    <p className="text-xs font-semibold">{module.moduleName}</p>
                                    <p className="text-[11px] text-muted-foreground mt-1">{module.offerAngle}</p>
                                  </div>
                                  <Badge variant="outline" className="text-[10px] shrink-0">{module.score} pts</Badge>
                                </div>
                                <Progress value={Math.min(100, module.score * 10)} className="h-1.5 mt-2" />
                                <div className="flex flex-wrap gap-1.5 mt-2">
                                  {module.evidences.slice(0, 3).map((evidence) => (
                                    <a
                                      key={evidence.id}
                                      href={`#fonte-${evidence.sourceIndex}`}
                                      className="text-[10px] rounded-full border px-2 py-0.5 text-muted-foreground hover:border-primary/40 hover:bg-primary/5"
                                    >
                                      #{evidence.sourceIndex} {evidence.matchedKeywords.slice(0, 2).join(", ")}
                                    </a>
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="rounded-lg border p-3 bg-amber-500/5 border-amber-500/20">
                  <p className="text-xs font-semibold mb-2">Riscos, evidencias e modulo associado</p>
                  <div className="space-y-3">
                    {selectedRisks.length > 0 ? selectedRisks.map((risk) => (
                      <div key={risk.id} className="rounded-lg border bg-background/80 p-3">
                        <div className="flex items-start gap-2">
                          <AlertTriangle className="h-3.5 w-3.5 text-amber-500 mt-0.5 shrink-0" />
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-semibold">{risk.risk}</p>
                            <div className="flex flex-wrap gap-1.5 mt-2">
                              <Badge variant="secondary" className="text-[10px]">{risk.task}</Badge>
                              <Badge variant="outline" className="text-[10px] bg-emerald-500/5 border-emerald-500/30">
                                {risk.module}
                              </Badge>
                            </div>
                            <p className="text-[11px] text-muted-foreground leading-relaxed mt-2">
                              Recomendacao: {risk.recommendation}
                            </p>
                            <div className="mt-2 space-y-1.5">
                              {risk.evidences.map((evidence) => (
                                <a
                                  key={evidence.id}
                                  href={`#fonte-${evidence.sourceIndex}`}
                                  className="block rounded-md border border-dashed bg-muted/30 p-2 text-[11px] text-muted-foreground hover:border-primary/40 hover:bg-primary/5"
                                >
                                  <span className="font-semibold text-foreground">[{evidence.source} #{evidence.sourceIndex}]</span>{" "}
                                  "{evidence.quote}"
                                </a>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    )) : selectedDiagnosis.commonRisks.map((risk) => (
                      <div key={risk} className="text-xs text-muted-foreground flex items-start gap-2">
                        <AlertTriangle className="h-3 w-3 text-amber-500 mt-0.5 shrink-0" />
                        <span>{risk}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-lg border p-3">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-2">
                    <p className="text-xs font-semibold">3. Mensagem sugerida revisavel</p>
                    <div className="flex gap-1">
                      <Button variant="outline" size="sm" className="h-8 gap-1.5" onClick={copyMessage} disabled={!messageDraft.trim()}>
                        <Copy className="h-3.5 w-3.5" />
                        Copiar
                      </Button>
                      <Button variant="outline" size="sm" className="h-8 gap-1.5" onClick={sendMessage} disabled={!messageDraft.trim()}>
                        <Send className="h-3.5 w-3.5" />
                        Enviar
                      </Button>
                    </div>
                  </div>
                  <Textarea
                    value={messageDraft}
                    onChange={(event) => setMessageDraft(event.target.value)}
                    rows={9}
                    className="text-xs resize-none bg-muted/30"
                  />
                  <Button
                    size="sm"
                    className="mt-2 h-8 gap-1.5 rounded-lg"
                    onClick={() => saveDiagnosisMessageMutation.mutate({ prospect: selectedProspect, draft: messageDraft })}
                    disabled={!messageDraft.trim() || saveDiagnosisMessageMutation.isPending}
                  >
                    <Save className="h-3.5 w-3.5" />
                    {saveDiagnosisMessageMutation.isPending ? "Salvando..." : "Salvar revisao"}
                  </Button>
                </div>

                {selectedDiagnosis.sourceSnapshot?.jobAbout && (
                  <div className="rounded-lg border p-3 bg-muted/20">
                    <p className="text-xs font-semibold mb-2">Fonte salva: Sobre a vaga</p>
                    <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                      {splitEvidenceChunks(selectedDiagnosis.sourceSnapshot.jobAbout).map((chunk) => (
                        <p key={chunk.sourceIndex} id={`fonte-${chunk.sourceIndex}`} className="text-[11px] text-muted-foreground leading-relaxed rounded-md bg-background/70 p-2">
                          <span className="font-semibold text-foreground">#{chunk.sourceIndex}</span> {chunk.quote}
                        </p>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>{editingProspect ? "Editar empresa de prospecção" : "Adicionar empresa de prospecção"}</DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="space-y-4">
              <div className="rounded-lg border p-3 bg-muted/20 space-y-3">
                <div>
                  <label className="text-sm font-medium">Link da vaga no LinkedIn</label>
                  <div className="flex gap-2 mt-1">
                    <Input
                      value={form.linkedin_job_url}
                      onChange={(event) => setForm((prev) => ({ ...prev, linkedin_job_url: event.target.value }))}
                      placeholder="https://www.linkedin.com/jobs/view/..."
                      className="rounded-xl"
                    />
                    <Button
                      variant="outline"
                      className="rounded-xl gap-2"
                      onClick={() => importLinkedInMutation.mutate()}
                      disabled={importLinkedInMutation.isPending || (!form.linkedin_job_url.trim() && !linkedinPaste.trim())}
                    >
                      {importLinkedInMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
                      Importar
                    </Button>
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium">Texto colado da vaga (fallback)</label>
                  <Textarea
                    value={linkedinPaste}
                    onChange={(event) => setLinkedinPaste(event.target.value)}
                    placeholder="Cole aqui o conteudo da vaga quando o LinkedIn bloquear a leitura pela URL."
                    rows={3}
                    className="mt-1 rounded-xl"
                  />
                </div>
                {formFingerprint && (
                  <p className="text-[10px] text-muted-foreground mt-2">
                    Fingerprint: {formFingerprint}
                  </p>
                )}
                {duplicateProspect && (
                  <p className="text-[11px] text-red-500 mt-2">
                    Prospect duplicado bloqueado. Abra o registro existente para revisar.
                  </p>
                )}
              </div>

              {duplicateProspect && (
                <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-3">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-red-600">Vaga duplicada detectada</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Ja existe um prospect para {duplicateProspect.company_name}
                        {duplicateProspect.job_title ? ` - ${duplicateProspect.job_title}` : ""}. A criacao fica bloqueada para evitar registros repetidos.
                      </p>
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-2 h-8 rounded-lg"
                        onClick={() => {
                          setSelectedProspect(duplicateProspect);
                          setDialogOpen(false);
                          resetForm();
                        }}
                      >
                        Abrir registro existente
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium">Empresa *</label>
                  <Input
                    value={form.company_name}
                    onChange={(event) => setForm((prev) => ({ ...prev, company_name: event.target.value }))}
                    placeholder="Nome da empresa"
                    className="mt-1 rounded-xl"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Localização</label>
                  <Input
                    value={form.location}
                    onChange={(event) => setForm((prev) => ({ ...prev, location: event.target.value }))}
                    placeholder="Cidade, UF"
                    className="mt-1 rounded-xl"
                  />
                </div>
              </div>

              <div>
                <label className="text-sm font-medium">Título da vaga</label>
                <Input
                  value={form.job_title}
                  onChange={(event) => setForm((prev) => ({ ...prev, job_title: event.target.value }))}
                  placeholder="Ex: Assistente Administrativo de Obras"
                  className="mt-1 rounded-xl"
                />
              </div>

              <div>
                <label className="text-sm font-medium">Sobre a vaga</label>
                <Textarea
                  value={form.job_about}
                  onChange={(event) => setForm((prev) => ({ ...prev, job_about: event.target.value }))}
                  placeholder="Cole ou revise somente a descricao Sobre a vaga..."
                  rows={9}
                  className="mt-1 rounded-xl"
                />
              </div>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-sm font-medium">Status</label>
                  <Select value={form.status} onValueChange={(value) => setForm((prev) => ({ ...prev, status: value as ProspectStatus }))}>
                    <SelectTrigger className="mt-1 rounded-xl"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(statusConfig).map(([key, config]) => <SelectItem key={key} value={key}>{config.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium">Prioridade</label>
                  <Select value={form.priority} onValueChange={(value) => setForm((prev) => ({ ...prev, priority: value as ProspectPriority }))}>
                    <SelectTrigger className="mt-1 rounded-xl"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(priorityConfig).map(([key, config]) => <SelectItem key={key} value={key}>{config.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium">Reunião</label>
                  <Input
                    type="date"
                    value={form.meeting_date}
                    onChange={(event) => setForm((prev) => ({ ...prev, meeting_date: event.target.value }))}
                    className="mt-1 rounded-xl"
                  />
                </div>
              </div>

              <div className="rounded-lg border p-3 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">Contatos salvos</p>
                  <Button variant="outline" size="sm" className="h-8 rounded-lg gap-2" onClick={addContact}>
                    <Plus className="h-3.5 w-3.5" />
                    Contato
                  </Button>
                </div>
                <div className="space-y-2">
                  {form.contacts.map((contact, index) => {
                    const Icon = contactIcons[contact.type] || UserPlus;
                    return (
                      <div key={index} className="grid grid-cols-[110px_1fr_auto] gap-2">
                        <Select value={contact.type} onValueChange={(value) => updateContact(index, { type: value })}>
                          <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="celular">Celular</SelectItem>
                            <SelectItem value="email">Email</SelectItem>
                            <SelectItem value="linkedin">LinkedIn</SelectItem>
                            <SelectItem value="outro">Outro</SelectItem>
                          </SelectContent>
                        </Select>
                        <div className="relative">
                          <Icon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input
                            value={contact.value}
                            onChange={(event) => updateContact(index, { value: event.target.value })}
                            placeholder="Valor do contato"
                            className="pl-9 rounded-xl"
                          />
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-10 w-10 text-muted-foreground hover:text-destructive"
                          onClick={() => removeContact(index)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="text-sm font-medium">Notas internas</label>
                <Textarea
                  value={form.notes}
                  onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))}
                  placeholder="Contexto da abordagem, pessoas-chave, sinais da obra..."
                  rows={4}
                  className="mt-1 rounded-xl"
                />
              </div>

              <div className="rounded-lg border p-3 bg-primary/5 border-primary/20">
                <p className="text-sm font-semibold flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-primary" />
                  Diagnóstico automático
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Ao salvar, a plataforma extrai demandas da descrição, ranqueia os módulos ConstruData e grava o diagnóstico operacional preliminar com mensagem sugerida.
                </p>
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {formModuleMatches.slice(0, 5).map((module) => (
                    <Badge key={module.moduleId} variant="secondary" className="text-[10px]">
                      {module.moduleName} ({module.score})
                    </Badge>
                  ))}
                  {formModuleMatches.length === 0 && <Badge variant="outline" className="text-[10px]">Aguardando descrição da vaga</Badge>}
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" className="rounded-xl w-full sm:w-auto" onClick={() => { setDialogOpen(false); resetForm(); }}>
              Cancelar
            </Button>
            <Button
              className="rounded-xl shadow-lg shadow-primary/20 w-full sm:w-auto gap-2"
              onClick={() => saveProspectMutation.mutate()}
              disabled={!form.company_name.trim() || saveProspectMutation.isPending || !!duplicateProspect}
            >
              <Save className="h-4 w-4" />
              {saveProspectMutation.isPending ? "Salvando..." : "Salvar prospect"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
};

export default Prospecting;
