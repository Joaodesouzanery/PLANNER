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

type ProspectStatus = "new" | "researching" | "contacted" | "meeting" | "won" | "lost";
type ProspectPriority = "high" | "medium" | "low";

interface ProspectContact {
  type: string;
  value: string;
  name?: string;
}

interface Diagnosis {
  observedWork: string;
  operationalHypothesis: string;
  commonRisks: string[];
  whereConstruDataFits: string[];
  suggestedMessage: string;
  generatedAt: string;
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
  medium: { label: "Media", className: "bg-amber-500/10 text-amber-600 border-amber-500/30" },
  low: { label: "Baixa", className: "bg-sky-500/10 text-sky-500 border-sky-500/30" },
};

// ConstruData base (lida da landing page https://www.construdata.software/)
const construDataBase = {
  pitch:
    "Plataforma operacional para obras e saneamento: integra campo, qualidade, medicao, planejamento, suprimentos e gestao em uma unica base operacional, com origem e rastreabilidade em cada dado.",
  pillars: [
    "RDO inteligente (boletim, equipe, clima, servicos, fotos, GPS e assinatura)",
    "Qualidade (FVS, nao conformidades e evidencias tecnicas)",
    "Recursos (mao de obra, equipamentos e produtividade)",
    "Medicao liberada com quantidades por servico, origem e evidencia",
    "Gestao com CPI, SPI, custo, prazo e risco em tempo real",
    "Torre de controle com alertas, decisoes e proximos passos por projeto",
  ],
};

const taskPatterns = [
  {
    label: "Controle de ponto e equipe",
    keywords: ["ponto", "colaborador", "funcionario", "equipe", "vale transporte", "alimentacao", "epi", "epis"],
    risk: "Controle de equipe disperso entre planilhas, papel e conversas, dificultando conferencia e tomada de decisao.",
    solution: "Gestao de equipe, registros de campo e evidencias operacionais vinculadas ao responsavel.",
  },
  {
    label: "Admissao, demissao e documentos",
    keywords: ["admissao", "demissao", "documentos", "documentacao", "arquivo", "arquivos"],
    risk: "Documentos importantes podem ficar fora do fluxo da obra e perder rastreabilidade entre campo e escritorio.",
    solution: "Centralizacao de documentos, trilha de responsabilidade e historico por obra.",
  },
  {
    label: "RDO, relatorios e planilhas",
    keywords: ["rdo", "relatorio", "relatorios", "planilha", "planilhas", "controle", "lancar", "sistema"],
    risk: "RDO preenchido tarde ou incompleto e relatorios consolidados depois que o problema ja impactou a obra.",
    solution: "RDO inteligente com fotos, clima, GPS, indicadores por obra e visao executiva.",
  },
  {
    label: "Notas fiscais, requisicoes e suprimentos",
    keywords: ["nota fiscal", "notas fiscais", "requisicao", "requisicoes", "material", "materiais", "pedido", "pedidos", "suprimentos"],
    risk: "Suprimentos sem rastreabilidade clara ate o impacto no prazo, custo e produtividade da obra.",
    solution: "Pedidos de material, rastreamento de requisicoes e comparacao entre consumo real e planejado.",
  },
  {
    label: "Fotos e evidencias de campo",
    keywords: ["foto", "fotos", "evidencia", "evidencias", "qualidade", "inspecao", "vistoria"],
    risk: "Fotos sem vinculo com etapa, local ou responsavel reduzem a forca operacional das evidencias.",
    solution: "Evidencias com origem, local, responsavel, etapa e rastreabilidade para auditoria e medicao.",
  },
  {
    label: "Apoio a engenharia e alinhamento",
    keywords: ["engenheiro", "mestre de obras", "demanda", "acompanhar", "apoio", "administrativa", "administrativo"],
    risk: "Decisoes importantes podem se perder entre obra e escritorio quando o fluxo depende de repasses manuais.",
    solution: "Modulos conectados entre campo, qualidade, suprimentos, planejamento e diretoria.",
  },
  {
    label: "Medicao, producao e avancos",
    keywords: ["medicao", "medicoes", "producao", "avanco", "avancos", "cronograma", "planejamento", "meta"],
    risk: "Medicao sem evidencia operacional forte dificulta confianca sobre avanco fisico e gargalos.",
    solution: "Controle de producao, metas, indicadores de avance e relatorios por periodo e projeto.",
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
    .replace(/[\u0300-\u036f]/g, "");

const splitSentences = (text: string) =>
  text
    .split(/\n|\.|;|•|-/)
    .map((part) => part.trim())
    .filter((part) => part.length > 12);

const extractTasks = (about: string) => {
  const normalized = normalize(about);
  return taskPatterns
    .filter((task) => task.keywords.some((keyword) => normalized.includes(normalize(keyword))))
    .map((task) => task.label);
};

const buildTaskEvidence = (about: string) => {
  const sentences = splitSentences(about);
  return taskPatterns
    .map((task) => {
      const hits = sentences.filter((sentence) => {
        const normalized = normalize(sentence);
        return task.keywords.some((keyword) => normalized.includes(normalize(keyword)));
      });
      return { label: task.label, examples: hits.slice(0, 2), count: hits.length };
    })
    .filter((task) => task.count > 0);
};

const generateDiagnosis = (form: ProspectForm, tasks: string[]): Diagnosis => {
  const matchedPatterns = taskPatterns.filter((pattern) => tasks.includes(pattern.label));
  const topTasks = matchedPatterns.slice(0, 4).map((task) => task.label);
  const constructionSignals = topTasks.length > 0 ? topTasks.join(", ") : "gestao administrativa e operacional de obra";
  const solutions = matchedPatterns.length > 0
    ? matchedPatterns.map((pattern) => pattern.solution)
    : construDataBase.pillars.slice(0, 3);

  const risks = matchedPatterns.length > 0
    ? matchedPatterns.map((pattern) => pattern.risk)
    : [
        "RDO preenchido tarde ou incompleto.",
        "Fotos sem vinculo com etapa, local ou responsavel.",
        "Decisoes importantes perdidas entre obra e escritorio.",
        "Diretoria recebendo informacao consolidada tarde.",
        "Suprimentos sem rastreabilidade ate o impacto na obra.",
        "Medicao sem evidencia operacional forte.",
      ];

  const problemList = topTasks.length > 0 ? topTasks.join(", ") : "registros soltos, baixa rastreabilidade e consolidacao tardia";
  const construFit = Array.from(new Set([...solutions, ...construDataBase.pillars])).slice(0, 6);
  const featuresMessage = construFit.slice(0, 3).join("; ");

  return {
    observedWork: `${form.job_title || "Vaga analisada"}${form.location ? ` em ${form.location}` : ""}${form.company_name ? ` - ${form.company_name}` : ""}. Pelo tipo e porte da obra observado, a descricao indica rotinas ligadas a ${constructionSignals}.`,
    operationalHypothesis:
      `Pelo tipo e porte da obra, e provavel que exista alto volume de registro de campo, fotos, solicitacoes, medicoes, qualidade e alinhamento entre obra e escritorio. Quando isso depende de planilhas soltas e repasses manuais, a diretoria tende a enxergar avancos, pendencias e gargalos tarde demais, perdendo velocidade na decisao.`,
    commonRisks: risks,
    whereConstruDataFits: construFit,
    suggestedMessage:
      `Ola! Vi que a ${form.company_name || "empresa"} esta com a vaga de ${form.job_title || "operacao de obra"} aberta, normalmente ligada a ${problemList}. ` +
      `Isso costuma indicar a necessidade de mais controle sobre o que acontece em campo, menos dependencia de planilhas soltas e mais velocidade para a diretoria enxergar avancos, pendencias e gargalos. ` +
      `O ConstruData entrega exatamente isso, com ${featuresMessage}. Podemos agendar uma reuniao rapida de 20 minutos?\n\n` +
      `Como funciona o meu trabalho: em X dias, identificamos X, Y, Z problemas e encontramos solucoes X, Y, Z, otimizando a operacao em X, Y, Z. Alem disso, voce recebe relatorios do que melhorou e do que ainda esta travando a operacao.`,
    generatedAt: new Date().toISOString(),
  };
};

const hasDiagnosis = (value: Prospect["operational_diagnosis"]): value is Diagnosis =>
  !!value && "suggestedMessage" in value;

export const Prospecting = () => {
  const queryClient = useQueryClient();
  const { selectedCompanyId } = useCompany();
  const [searchQuery, setSearchQuery] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProspect, setEditingProspect] = useState<Prospect | null>(null);
  const [selectedProspect, setSelectedProspect] = useState<Prospect | null>(null);
  const [form, setForm] = useState<ProspectForm>(emptyForm);
  const [linkedinPaste, setLinkedinPaste] = useState("");

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

  const saveProspectMutation = useMutation({
    mutationFn: async () => {
      const tasks = extractTasks(form.job_about);
      const diagnosis = generateDiagnosis(form, tasks);
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
      const diagnosis = generateDiagnosis(nextForm, tasks);
      const { error } = await (supabase as any)
        .from("commercial_prospects")
        .update({ extracted_tasks: tasks, operational_diagnosis: diagnosis })
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

  const selectedDiagnosis = selectedProspect && hasDiagnosis(selectedProspect.operational_diagnosis)
    ? selectedProspect.operational_diagnosis
    : null;

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
                      <TableHead>Empresa</TableHead>
                      <TableHead className="hidden lg:table-cell">Vaga</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="hidden md:table-cell">Tarefas</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredProspects.map((prospect) => {
                      const tasks = prospect.extracted_tasks?.length ? prospect.extracted_tasks : extractTasks(prospect.job_about || "");
                      return (
                        <TableRow
                          key={prospect.id}
                          className={cn("cursor-pointer", selectedProspect?.id === prospect.id && "bg-muted/60")}
                          onClick={() => setSelectedProspect(prospect)}
                        >
                          <TableCell>
                            <div className="space-y-1">
                              <p className="font-medium">{prospect.company_name}</p>
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
                          <TableCell className="hidden lg:table-cell max-w-[260px]">
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
                          <TableCell>
                            <div className="flex flex-col gap-1">
                              <Badge variant="outline" className={cn("w-fit text-[11px]", statusConfig[prospect.status]?.className)}>
                                {statusConfig[prospect.status]?.label || prospect.status}
                              </Badge>
                              <Badge variant="outline" className={cn("w-fit text-[11px]", priorityConfig[prospect.priority]?.className)}>
                                {priorityConfig[prospect.priority]?.label || prospect.priority}
                              </Badge>
                            </div>
                          </TableCell>
                          <TableCell className="hidden md:table-cell">
                            <div className="flex flex-wrap gap-1 max-w-[280px]">
                              {tasks.slice(0, 2).map((task) => (
                                <Badge key={task} variant="secondary" className="text-[10px]">
                                  {task}
                                </Badge>
                              ))}
                              {tasks.length > 2 && <Badge variant="outline" className="text-[10px]">+{tasks.length - 2}</Badge>}
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
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
                Diagnóstico salvo
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
                <p className="text-xs text-muted-foreground mt-1">O diagnostico da vaga fica salvo aqui para usar antes da reuniao.</p>
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
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Empresa</p>
                  <h3 className="font-bold text-lg">{selectedProspect.company_name}</h3>
                  <p className="text-xs text-muted-foreground">{selectedProspect.job_title || "Vaga sem titulo"}</p>
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

                <div className="rounded-lg border p-3 bg-amber-500/5 border-amber-500/20">
                  <p className="text-xs font-semibold mb-2">Riscos comuns na operação</p>
                  <ul className="space-y-1.5">
                    {selectedDiagnosis.commonRisks.map((risk) => (
                      <li key={risk} className="text-xs text-muted-foreground flex items-start gap-2">
                        <AlertTriangle className="h-3 w-3 text-amber-500 mt-0.5 shrink-0" />
                        <span>{risk}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="rounded-lg border p-3 bg-emerald-500/5 border-emerald-500/20">
                  <p className="text-xs font-semibold mb-2">Onde entra o ConstruData</p>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedDiagnosis.whereConstruDataFits.map((item) => (
                      <Badge key={item} variant="outline" className="text-[10px] bg-background">
                        {item}
                      </Badge>
                    ))}
                  </div>
                </div>

                <div className="rounded-lg border p-3">
                  <p className="text-xs font-semibold mb-2">3. Mensagem sugerida</p>
                  <Textarea value={selectedDiagnosis.suggestedMessage} readOnly rows={8} className="text-xs resize-none bg-muted/30" />
                </div>
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
              </div>

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
                  Ao salvar, a plataforma extrai tarefas recorrentes da descrição, calcula os relatórios e grava o diagnóstico operacional preliminar com mensagem sugerida.
                </p>
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {extractTasks(form.job_about).map((task) => (
                    <Badge key={task} variant="secondary" className="text-[10px]">{task}</Badge>
                  ))}
                  {extractTasks(form.job_about).length === 0 && <Badge variant="outline" className="text-[10px]">Aguardando descrição da vaga</Badge>}
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
              disabled={!form.company_name.trim() || saveProspectMutation.isPending}
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
