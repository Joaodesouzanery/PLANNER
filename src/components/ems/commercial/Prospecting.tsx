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
  Loader2,
  Mail,
  MapPin,
  MessageSquareText,
  Phone,
  Plus,
  RefreshCw,
  Save,
  Search,
  Send,
  Sparkles,
  Trash2,
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
import { OperationalMapPanel } from "@/components/ems/OperationalMapPanel";
import { useMapPins } from "@/hooks/useMapPins";

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
  medium: { label: "Média", className: "bg-amber-500/10 text-amber-600 border-amber-500/30" },
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
  const constructionSignals = moduleNames.length > 0 ? moduleNames.join(", ") : "gestão administrativa e operacional de obra";
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
    `Olá! Vi que a ${form.company_name || "empresa"} está com a vaga de ${form.job_title || "operação de obra"} aberta, normalmente ligada a ${problemList}. ` +
    `Isso costuma indicar a necessidade de mais controle sobre o que acontece em campo, menos dependencia de planilhas soltas e mais velocidade para a diretoria enxergar avancos, pendencias e gargalos. ` +
    `O ConstruData entrega exatamente isso, com ${featuresMessage}. Podemos agendar uma reuniao rapida de 20 minutos?\n\n` +
    `Como funciona o meu trabalho: em X dias, identificamos X, Y, Z problemas e encontramos soluções X, Y, Z, otimizando a operação em X, Y, Z. Além disso, você recebe relatórios do que melhorou e do que ainda está travando a operação.`;

  return {
    caseTitle: `Caso operacional - ${form.company_name || "Empresa sem nome"}`,
    observedWork: `${form.job_title || "Vaga analisada"}${form.location ? ` em ${form.location}` : ""}${form.company_name ? ` - ${form.company_name}` : ""}. Pelo tipo e porte da obra observado, a descricao indica rotinas ligadas a ${constructionSignals}.`,
    operationalHypothesis:
      `Pelo tipo e porte da obra, é provável que exista alto volume de registro de campo, fotos, solicitações, medições, qualidade e alinhamento entre obra e escritório. Quando isso depende de planilhas soltas e repasses manuais, a diretoria tende a enxergar avanços, pendências e gargalos tarde demais, perdendo velocidade na decisão.`,
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
  const [mapTaskFilter, setMapTaskFilter] = useState<"all" | "overdue" | "today">("all");
  const [mapLayers, setMapLayers] = useState({ contacts: true, projects: true });
  const { data: sharedMapPins = [] } = useMapPins();

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

  const prospectingMapPins = useMemo(() => {
    return sharedMapPins.filter((pin) => {
      const isContact = pin.id.startsWith("c-");
      const isProject = pin.id.startsWith("p-");
      if (isContact && !mapLayers.contacts) return false;
      if (isProject && !mapLayers.projects) return false;
      if (mapTaskFilter !== "all") return !!pin.alert;
      return true;
    });
  }, [sharedMapPins, mapLayers.contacts, mapLayers.projects, mapTaskFilter]);

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
        title: "Não consegui importar pela URL",
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

      <OperationalMapPanel
        title="Mapa operacional de clientes e projetos"
        description="Mesmo mapa usado em Dashboard, Contatos e Projetos."
        pinsOverride={prospectingMapPins}
        height={420}
        headerActions={
          <>
            {[
              { key: "all", label: "Todos" },
              { key: "overdue", label: "Com alerta" },
              { key: "today", label: "Hoje/atrasadas" },
            ].map((filter) => (
              <Button
                key={filter.key}
                variant={mapTaskFilter === filter.key ? "secondary" : "outline"}
                size="sm"
                className="h-8 rounded-lg text-xs"
                onClick={() => setMapTaskFilter(filter.key as typeof mapTaskFilter)}
              >
                {filter.label}
              </Button>
            ))}
            <Button
              variant="outline"
              size="sm"
              className={cn("h-8 rounded-lg text-xs", mapLayers.contacts && "bg-primary/10 text-primary")}
              onClick={() => setMapLayers((prev) => ({ ...prev, contacts: !prev.contacts }))}
            >
              Contatos
            </Button>
            <Button
              variant="outline"
              size="sm"
              className={cn("h-8 rounded-lg text-xs", mapLayers.projects && "bg-primary/10 text-primary")}
              onClick={() => setMapLayers((prev) => ({ ...prev, projects: !prev.projects }))}
            >
              Projetos
            </Button>
          </>
        }
      />

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
                            <p className="truncate text-sm">{prospect.job_title || "Vaga não informada"}</p>
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
