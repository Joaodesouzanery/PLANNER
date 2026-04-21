import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import {
  Target, Users, Sparkles, MessageSquare, Search, Workflow,
  TrendingUp, Briefcase, Wrench, Zap, CheckCircle2, AlertTriangle,
  BarChart3, HeartHandshake, Lightbulb, Rocket
} from "lucide-react";

const ICP_CARGOS = ["Diretores de Engenharia", "Gerentes de Obra", "CFOs", "Gerentes de Projetos", "Coordenadores de Planejamento"];
const ICP_SETORES = ["Construtoras (edificações)", "Construtoras (infraestrutura)", "Saneamento", "Incorporadoras"];
const DORES = [
  "Atrasos em obras",
  "Estouros de orçamento",
  "Falta de visibilidade em tempo real",
  "Retrabalho",
  "Decisões estratégicas tardias",
  "Comunicação fragmentada campo↔escritório",
  "Dependência de planilhas e processos manuais",
];

const VALOR_PROPS = [
  { icon: BarChart3, title: "Inteligência Operacional", desc: "Dados em tempo real do campo ao escritório" },
  { icon: TrendingUp, title: "Otimização de Custos & Prazos", desc: "CPI/SPI em tempo real, Three-Way Match" },
  { icon: Workflow, title: "Digitalização & Padronização", desc: "RDO digital substitui papel e planilhas" },
  { icon: Target, title: "Visibilidade 360°", desc: "Torre de Controle + Relatório 360" },
  { icon: Zap, title: "+19 Módulos Integrados", desc: "BIM 3D/4D/5D, LPS/Lean, Suprimentos, Qualidade" },
  { icon: CheckCircle2, title: "Foco no Mercado BR", desc: "SINAPI, SEINFRA, NRs, CLT" },
];

const FUNNEL_FLOWS = [
  { flow: "Flow 1", title: "Connection Request", desc: "Pedido de conexão SEM pitch. Foco em personalização e interesse genuíno.", color: "bg-blue-500/10 text-blue-600 border-blue-500/30" },
  { flow: "Flow 2", title: "Follow-up 1 (Value)", desc: "Conteúdo de valor: artigo, insight ou dado de mercado relevante.", color: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30" },
  { flow: "Flow 3", title: "Follow-up 2 (Case)", desc: "Mini estudo de caso. Ex: 'cliente saiu de 38% para 72% PPC em 4 meses'.", color: "bg-amber-500/10 text-amber-600 border-amber-500/30" },
  { flow: "Flow 4", title: "Follow-up 3 (Soft CTA)", desc: "Convite para conversa rápida ou demo sem compromisso.", color: "bg-purple-500/10 text-purple-600 border-purple-500/30" },
];

const ROTINAS = [
  {
    role: "SDR / BDR",
    icon: Search,
    color: "text-blue-500",
    items: [
      "Prospecção diária no LinkedIn Sales Navigator",
      "Qualificação BANT (Budget, Authority, Need, Timeline)",
      "Outreach personalizado (LinkedIn + e-mail)",
      "Agendamento de demos (meta primária)",
      "Atualização rigorosa do CRM",
    ],
  },
  {
    role: "Account Executive",
    icon: Briefcase,
    color: "text-emerald-500",
    items: [
      "Reunião de descoberta (entender dores)",
      "Demonstração da solução conectada às dores",
      "Proposta personalizada com ROI claro",
      "Negociação e fechamento",
      "Handoff suave para Customer Success",
    ],
  },
  {
    role: "Customer Success",
    icon: HeartHandshake,
    color: "text-purple-500",
    items: [
      "Onboarding estruturado",
      "Check-ins regulares e QBRs",
      "Identificação de upsell/cross-sell",
      "Coleta de feedback e cases",
      "Gestão proativa de renovações",
    ],
  },
];

const KPIS = [
  { role: "SDR/BDR", metrics: ["Leads qualificados", "Reuniões agendadas", "Taxa conexão→reunião"] },
  { role: "AE", metrics: ["Demos realizadas", "Demo→proposta", "Taxa de fechamento", "MRR gerado"] },
  { role: "CSM", metrics: ["Adoção da plataforma", "NPS", "Churn rate", "Upsell/cross-sell"] },
  { role: "Gerente Comercial", metrics: ["Receita total", "CAC", "LTV", "LTV/CAC ratio"] },
];

const FERRAMENTAS = [
  { cat: "CRM", items: ["HubSpot", "Salesforce", "Pipedrive"] },
  { cat: "Sales Intelligence", items: ["LinkedIn Sales Navigator"] },
  { cat: "Outreach / Cadência", items: ["Apollo.io", "Outreach.io"] },
  { cat: "Agendamento", items: ["Calendly", "Cal.com"] },
  { cat: "Automação LinkedIn", items: ["Salesrobot", "Waalaxy"] },
];

const SAFETY_LIMITS = [
  "20-40 pedidos de conexão por dia",
  "60-100 mensagens por dia (com warm-up)",
  "Atrasos randomizados entre ações",
  "Templates únicos por lead (variações via IA)",
  "Monitoramento contínuo da saúde da conta",
];

export const PlaybookContent = () => {
  return (
    <div className="space-y-4">
      {/* Intro */}
      <Card className="border-primary/20 bg-gradient-to-br from-primary/5 via-background to-purple-500/5">
        <CardContent className="pt-5">
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-primary to-purple-500 flex items-center justify-center flex-shrink-0">
              <Rocket className="h-5 w-5 text-white" />
            </div>
            <div>
              <h2 className="font-bold text-base md:text-lg mb-1">Playbook Comercial — Atlântico ConstruData</h2>
              <p className="text-xs md:text-sm text-muted-foreground">
                Diretrizes para rotinas, automações e formação de uma equipe comercial de alta performance,
                com foco em estratégia de conteúdo e prospecção via LinkedIn.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ICP */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Target className="h-4 w-4 text-primary" /> Público-Alvo Ideal (ICP)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <p className="text-xs font-semibold text-muted-foreground mb-1.5">Cargos</p>
            <div className="flex flex-wrap gap-1.5">
              {ICP_CARGOS.map((c) => <Badge key={c} variant="secondary" className="text-xs">{c}</Badge>)}
            </div>
          </div>
          <div>
            <p className="text-xs font-semibold text-muted-foreground mb-1.5">Setores</p>
            <div className="flex flex-wrap gap-1.5">
              {ICP_SETORES.map((s) => <Badge key={s} variant="outline" className="text-xs">{s}</Badge>)}
            </div>
          </div>
          <div>
            <p className="text-xs font-semibold text-muted-foreground mb-1.5">Porte</p>
            <p className="text-xs">Empresas de médio a grande porte que dependem de planilhas e buscam digitalização.</p>
          </div>
          <div>
            <p className="text-xs font-semibold text-muted-foreground mb-1.5">Dores Comuns</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5">
              {DORES.map((d) => (
                <div key={d} className="flex items-center gap-2 text-xs">
                  <AlertTriangle className="h-3 w-3 text-amber-500 flex-shrink-0" /> {d}
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Proposta de Valor */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" /> Proposta de Valor
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {VALOR_PROPS.map((v) => {
              const Icon = v.icon;
              return (
                <div key={v.title} className="p-3 rounded-lg border bg-muted/30 hover:bg-muted/50 transition-colors">
                  <Icon className="h-4 w-4 text-primary mb-1.5" />
                  <p className="font-semibold text-xs mb-0.5">{v.title}</p>
                  <p className="text-[11px] text-muted-foreground leading-snug">{v.desc}</p>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Funil de Mensagens */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-primary" /> Funil de Mensagens (LinkedIn)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {FUNNEL_FLOWS.map((f) => (
              <div key={f.flow} className={`p-3 rounded-lg border ${f.color}`}>
                <div className="flex items-center gap-2 mb-1">
                  <Badge className={f.color + " border"}>{f.flow}</Badge>
                  <p className="font-semibold text-xs">{f.title}</p>
                </div>
                <p className="text-[11px] leading-snug">{f.desc}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Estratégia de Conteúdo */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Lightbulb className="h-4 w-4 text-primary" /> Estratégia de Conteúdo
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="formats">
              <AccordionTrigger className="text-xs font-semibold">Novos Formatos & Abordagens</AccordionTrigger>
              <AccordionContent className="text-xs space-y-2 text-muted-foreground">
                <p><strong className="text-foreground">📈 Estudos de Caso:</strong> resultados concretos (ex: 38% → 72% PPC em 4 meses).</p>
                <p><strong className="text-foreground">🔍 Insights de Mercado:</strong> tendências ConstruTech, regulamentações, futuro da gestão de obras.</p>
                <p><strong className="text-foreground">📚 Conteúdo Educacional:</strong> "Como calcular CPI/SPI", "Last Planner na prática".</p>
                <p><strong className="text-foreground">💬 Conteúdo Interativo:</strong> enquetes e perguntas abertas.</p>
                <p><strong className="text-foreground">🎬 Vídeos Curtos:</strong> demos, depoimentos, dicas rápidas.</p>
                <p><strong className="text-foreground">✍️ Artigos de Opinião:</strong> posicionamento sobre temas relevantes.</p>
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="frequency">
              <AccordionTrigger className="text-xs font-semibold">Frequência & Workflow com IA</AccordionTrigger>
              <AccordionContent className="text-xs space-y-2 text-muted-foreground">
                <p><strong className="text-foreground">Frequência:</strong> 2-3 posts por semana.</p>
                <p><strong className="text-foreground">Estrutura de mensagem personalizada:</strong> gancho pessoal → contexto → valor → CTA suave.</p>
                <p><strong className="text-foreground">CTA padrão:</strong> sempre direcionar para <a href="https://www.construdata.software/" target="_blank" rel="noreferrer" className="text-primary underline">construdata.software</a>.</p>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </CardContent>
      </Card>

      {/* Rotinas */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Workflow className="h-4 w-4 text-primary" /> Rotinas Comerciais Essenciais
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {ROTINAS.map((r) => {
              const Icon = r.icon;
              return (
                <div key={r.role} className="p-3 rounded-lg border bg-muted/30">
                  <div className="flex items-center gap-2 mb-2">
                    <Icon className={`h-4 w-4 ${r.color}`} />
                    <p className="font-semibold text-xs">{r.role}</p>
                  </div>
                  <ul className="space-y-1">
                    {r.items.map((it, i) => (
                      <li key={i} className="text-[11px] flex items-start gap-1.5 text-muted-foreground">
                        <CheckCircle2 className="h-3 w-3 text-emerald-500 flex-shrink-0 mt-0.5" />
                        <span>{it}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* KPIs */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-primary" /> KPIs por Função
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {KPIS.map((k) => (
              <div key={k.role} className="p-3 rounded-lg border">
                <p className="text-xs font-bold text-primary mb-1.5">{k.role}</p>
                <div className="flex flex-wrap gap-1">
                  {k.metrics.map((m) => (
                    <Badge key={m} variant="secondary" className="text-[10px]">{m}</Badge>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Ferramentas */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Wrench className="h-4 w-4 text-primary" /> Stack Recomendado
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {FERRAMENTAS.map((f) => (
            <div key={f.cat} className="flex items-center gap-2 flex-wrap">
              <p className="text-xs font-semibold text-muted-foreground min-w-[140px]">{f.cat}:</p>
              <div className="flex flex-wrap gap-1">
                {f.items.map((i) => <Badge key={i} variant="outline" className="text-[10px]">{i}</Badge>)}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Limites Seguros */}
      <Card className="border-amber-500/30 bg-amber-500/5">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2 text-amber-700 dark:text-amber-400">
            <AlertTriangle className="h-4 w-4" /> Automação Segura no LinkedIn
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground mb-2">
            Use ferramentas cloud-based que simulam comportamento humano. Respeite os limites:
          </p>
          <ul className="space-y-1">
            {SAFETY_LIMITS.map((l, i) => (
              <li key={i} className="text-xs flex items-start gap-2">
                <CheckCircle2 className="h-3 w-3 text-amber-600 flex-shrink-0 mt-0.5" />
                <span>{l}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {/* Equipe */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" /> Estrutura de Equipe
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {[
              { r: "SDR / BDR", d: "Prospecção e qualificação de leads" },
              { r: "Account Executive", d: "Conduz ciclo de vendas: demo → fechamento" },
              { r: "Customer Success Manager", d: "Adoção, satisfação e retenção" },
              { r: "Gerente Comercial", d: "Estratégia, metas e desempenho da equipe" },
            ].map((e) => (
              <div key={e.r} className="p-2.5 rounded-lg border bg-muted/30">
                <p className="text-xs font-semibold">{e.r}</p>
                <p className="text-[11px] text-muted-foreground">{e.d}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
