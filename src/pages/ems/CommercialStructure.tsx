import { motion } from "framer-motion";
import { EMSLayout } from "@/components/ems/EMSLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Building2, Users, Target, TrendingUp, BarChart3, Briefcase,
  CheckCircle2, ArrowRight, Lightbulb, Wrench, Star, DollarSign, 
  BookOpen, Megaphone, Search, Handshake
} from "lucide-react";

const funnelStages = [
  { step: 1, title: "Prospecção", desc: "Identificação de potenciais clientes (prefeituras, empresas) que se encaixam no ICP.", responsible: "BDR", b2g: "Identificação de contato chave e necessidade inicial.", b2b: "Identificação de contato chave e necessidade inicial.", color: "bg-blue-500/10 border-blue-500/30 text-blue-500" },
  { step: 2, title: "Qualificação (SQL)", desc: "Validação da oportunidade: Budget, Authority, Need, Timeline (BANT).", responsible: "SDR/BDR", b2g: "Reunião agendada com decisor e confirmação de BANT.", b2b: "Reunião agendada com decisor e confirmação de BANT.", color: "bg-violet-500/10 border-violet-500/30 text-violet-500" },
  { step: 3, title: "Descoberta/Diagnóstico", desc: "Entendimento aprofundado das dores, desafios e objetivos do cliente.", responsible: "AE", b2g: "Documento de levantamento de necessidades assinado/validado.", b2b: "Documento de levantamento de necessidades assinado/validado.", color: "bg-amber-500/10 border-amber-500/30 text-amber-500" },
  { step: 4, title: "Demonstração/POC", desc: "Apresentação da solução focando em como ela resolve as dores específicas do cliente. POC se necessário.", responsible: "AE", b2g: "Cliente engajado na demo/POC, feedback positivo e solicitação de proposta.", b2b: "Cliente engajado na demo/POC, feedback positivo e solicitação de proposta.", color: "bg-emerald-500/10 border-emerald-500/30 text-emerald-500" },
  { step: 5, title: "Proposta/Negociação", desc: "Elaboração e apresentação da proposta comercial. Negociação de termos e condições.", responsible: "AE", b2g: "Proposta formalmente apresentada e em discussão.", b2b: "Proposta formalmente apresentada e em discussão.", color: "bg-orange-500/10 border-orange-500/30 text-orange-500" },
  { step: 6, title: "Apoio à Licitação (B2G)", desc: "Auxílio na elaboração do Termo de Referência (TR) e acompanhamento do processo licitatório.", responsible: "AE + Jurídico", b2g: "Edital publicado com requisitos alinhados à solução.", b2b: "N/A", color: "bg-cyan-500/10 border-cyan-500/30 text-cyan-500" },
  { step: 7, title: "Fechamento", desc: "Assinatura do contrato.", responsible: "AE", b2g: "Contrato assinado.", b2b: "Contrato assinado.", color: "bg-green-500/10 border-green-500/30 text-green-500" },
  { step: 8, title: "Onboarding/Implementação", desc: "Configuração da plataforma, treinamento da equipe do cliente.", responsible: "CSM", b2g: "Cliente com acesso à plataforma e treinamento inicial concluído.", b2b: "Cliente com acesso à plataforma e treinamento inicial concluído.", color: "bg-pink-500/10 border-pink-500/30 text-pink-500" },
  { step: 9, title: "Sucesso do Cliente", desc: "Acompanhamento contínuo, garantia de adoção, identificação de upsell/cross-sell.", responsible: "CSM", b2g: "Cliente satisfeito, uso contínuo da plataforma, renovação de contrato.", b2b: "Cliente satisfeito, uso contínuo da plataforma, renovação de contrato.", color: "bg-rose-500/10 border-rose-500/30 text-rose-500" },
];

const b2gPlaybook = {
  message: { title: "Resiliência, Transparência e Eficiência Pública", focus: "Não venda software, venda a capacidade de proteger vidas, otimizar recursos públicos e garantir a continuidade dos serviços em momentos de crise. Venda a soberania tecnológica e a capacidade de tomar decisões baseadas em dados para o bem-estar da população.", language: "Formal, técnica, alinhada com terminologia governamental (LGPD, e-PING, Plano Diretor, Defesa Civil)." },
  prospecting: { stakeholders: ["Secretários (Planejamento, Obras, Defesa Civil, Meio Ambiente)", "Prefeitos e Vereadores", "Diretores de TI", "Procuradores"], channels: ["Eventos governamentais (congressos de municípios)", "Workshops com associações (CNM, FNP)", "Publicações acadêmicas (UnB)", "Webinars sobre gestão de riscos e cidades inteligentes"], extra: ["Engajamento Político: há vontade política para investir em tecnologia e resiliência?", "Maturidade Digital: qual o nível de digitalização atual do município?", "Histórico de Crises: o município já enfrentou desastres que justifiquem urgência?"] },
  sales: ["Venda Consultiva: reuniões de diagnóstico aprofundadas; apresentar a solução como co-criada com a academia.", "Demonstração de Valor: cases de sucesso com ROI social e econômico (vidas salvas, custos evitados, agilidade na resposta).", "Apoio à Licitação: suporte técnico para elaboração do Termo de Referência (TR), garantindo qualidade da aquisição pública.", "Negociação: flexibilidade em modelos de precificação (licença anual, por módulo, por população) e prazos de pagamento."],
};

const b2bPlaybook = {
  message: { title: "Eficiência, Redução de Custos e Vantagem Competitiva", focus: "Venda a capacidade de otimizar projetos, reduzir retrabalho, melhorar a comunicação e aumentar a lucratividade. Venda a inovação e a vantagem competitiva no mercado.", language: "Direta, focada em resultados, com terminologia do setor (BIM, Lean Construction, cronograma, orçamento)." },
  prospecting: { accounts: ["Construtoras e incorporadoras em projetos de infraestrutura", "Escritórios de engenharia inovadores", "Consultorias de gestão e tecnologia"], channels: ["LinkedIn Sales Navigator", "Apollo.io / cold e-mail", "Indicações e eventos do setor (feiras de construção)", "Webinars sobre tecnologia na construção"], extra: ["Volume de Projetos: quantos projetos a empresa gerencia anualmente?", "Tecnologia Atual: quais softwares já utiliza? Há abertura para novas tecnologias?", "Dores Específicas: problemas com comunicação, atrasos, estouro de orçamento, falta de visibilidade?"] },
  sales: ["Venda de Valor: apresentar como ferramenta que resolve problemas específicos com ROI claro. Usar cases com métricas.", "Demonstração Interativa: demos personalizadas com dados relevantes ao negócio do cliente. Oferecer trials/POCs.", "Negociação: foco no valor entregue e na economia gerada. Precificação SaaS transparente (licença por usuário/módulo)."],
};

const salesStack = [
  { icon: Target, title: "CRM", desc: "Gerenciar o funil, registrar interações e automatizar tarefas.", examples: "Salesforce, HubSpot" },
  { icon: Search, title: "Prospecção", desc: "Identificação e qualificação de leads B2B e B2G.", examples: "LinkedIn Sales Navigator, Apollo.io, Ramper" },
  { icon: Megaphone, title: "Automação de Marketing", desc: "Sequências de e-mail, lead scoring e nutrição de leads.", examples: "HubSpot, RD Station" },
  { icon: BookOpen, title: "Plataformas de Licitação", desc: "Monitoramento de editais e processos licitatórios.", examples: "ConLicitação, Comprasnet" },
  { icon: Star, title: "Apresentação", desc: "Demos interativas e materiais ricos para o cliente.", examples: "e-books, whitepapers, case studies" },
];

const kpis = {
  bdr: ["SQLs Gerados: oportunidades que atendem ao BANT e foram aceitas pelos AEs", "Taxa de Conversão Lead → SQL: % de leads que se tornam SQLs", "Reuniões Agendadas: quantidade de reuniões qualificadas realizadas", "Tempo Médio de Resposta ao Lead: agilidade no primeiro contato"],
  ae: ["ARR Fechado: valor total dos contratos anuais fechados (métrica principal)", "Novos Contratos Fechados: quantidade de novos clientes adquiridos", "Taxa de Conversão Oportunidade → Cliente: % de SQLs que viram clientes", "ACV (Annual Contract Value): valor médio dos contratos", "Ciclo Médio de Vendas: tempo desde o primeiro contato até o fechamento", "Taxa de Sucesso em Licitações (B2G): % de licitações ganhas"],
  csm: ["Churn Rate: % de clientes que renovam seus contratos", "NRR (Net Revenue Retention): crescimento da receita de clientes existentes", "Receita de Upsell/Cross-sell: valor de módulos adicionais para clientes existentes", "NPS / CSAT: medidas de satisfação do cliente", "Adoção da Plataforma: funcionalidades utilizadas, frequência de uso, usuários ativos"],
};

const commission = [
  {
    role: "SDR/BDR",
    base: "70–80% do OTE",
    variable: "20–30% do OTE",
    items: ["Por SQL Gerado: valor fixo por cada SQL aceito pelo AE", "Por Reunião Agendada: valor fixo por cada reunião qualificada", "Bônus por Fechamento: 1–2% do ARR do contrato fechado gerado pelo SDR/BDR"],
    color: "border-blue-500/30 bg-blue-500/5",
  },
  {
    role: "Account Executive (AE)",
    base: "50–60% do OTE",
    variable: "40–50% do OTE",
    items: ["% do ARR Ano 1: 8–12% para B2B, 5–10% para B2G", "Aceleradores: 1,5x ou 2x para vendas acima de 100% da meta", "Bônus por Qualidade: bônus se cliente tiver alta adoção ou NRR positivo"],
    color: "border-violet-500/30 bg-violet-500/5",
  },
  {
    role: "Customer Success Manager (CSM)",
    base: "70–80% do OTE",
    variable: "20–30% do OTE",
    items: ["% de Renovação: 2–5% sobre o ARR renovado dos clientes", "% de Upsell/Cross-sell: 5–10% sobre a receita adicional gerada", "Bônus por NPS/CSAT: atrelado à satisfação do cliente"],
    color: "border-emerald-500/30 bg-emerald-500/5",
  },
];

const CommercialStructure = () => {
  return (
    <EMSLayout>
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-6 p-4 sm:p-6">
        <div>
          <h1 className="text-2xl font-heading font-bold text-foreground flex items-center gap-2">
            <Briefcase className="h-6 w-6 text-primary" /> Estrutura Comercial
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Playbooks, funil de vendas, KPIs e modelo de comissionamento — referência estratégica adaptada ao seu cenário.</p>
        </div>

        <Tabs defaultValue="funnel">
          <TabsList className="w-full flex-wrap h-auto gap-1 p-1">
            <TabsTrigger value="funnel" className="flex items-center gap-1.5"><Target className="h-3.5 w-3.5" />Etapas do Funil</TabsTrigger>
            <TabsTrigger value="b2g" className="flex items-center gap-1.5"><Building2 className="h-3.5 w-3.5" />Playbook B2G</TabsTrigger>
            <TabsTrigger value="b2b" className="flex items-center gap-1.5"><Briefcase className="h-3.5 w-3.5" />Playbook B2B</TabsTrigger>
            <TabsTrigger value="stack" className="flex items-center gap-1.5"><Wrench className="h-3.5 w-3.5" />Sales Stack</TabsTrigger>
            <TabsTrigger value="kpis" className="flex items-center gap-1.5"><BarChart3 className="h-3.5 w-3.5" />KPIs</TabsTrigger>
            <TabsTrigger value="commission" className="flex items-center gap-1.5"><DollarSign className="h-3.5 w-3.5" />Comissionamento</TabsTrigger>
          </TabsList>

          {/* FUNNEL STAGES */}
          <TabsContent value="funnel" className="mt-4 space-y-3">
            <p className="text-sm text-muted-foreground">9 etapas do funil adaptadas ao seu contexto comercial (B2G e B2B).</p>
            <div className="space-y-2">
              {funnelStages.map((s, i) => (
                <motion.div key={s.step} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }}>
                  <Card className={`border ${s.color.split(" ")[1]} transition-all hover:shadow-md`}>
                    <CardContent className="p-4">
                      <div className="flex flex-col sm:flex-row sm:items-start gap-3">
                        <div className={`flex items-center justify-center w-8 h-8 rounded-full shrink-0 text-sm font-bold ${s.color}`}>{s.step}</div>
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2 mb-1">
                            <h3 className="font-semibold text-sm text-foreground">{s.title}</h3>
                            <Badge variant="outline" className={`text-[10px] ${s.color.split(" ")[0]} ${s.color.split(" ")[2]} border ${s.color.split(" ")[1]}`}>{s.responsible}</Badge>
                          </div>
                          <p className="text-xs text-muted-foreground mb-2">{s.desc}</p>
                          <div className="grid sm:grid-cols-2 gap-2">
                            <div className="p-2 rounded-lg bg-blue-500/5 border border-blue-500/20">
                              <p className="text-[10px] font-semibold text-blue-400 mb-0.5">🏛 B2G</p>
                              <p className="text-xs text-muted-foreground">{s.b2g}</p>
                            </div>
                            <div className="p-2 rounded-lg bg-violet-500/5 border border-violet-500/20">
                              <p className="text-[10px] font-semibold text-violet-400 mb-0.5">🏢 B2B</p>
                              <p className="text-xs text-muted-foreground">{s.b2b}</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          </TabsContent>

          {/* B2G PLAYBOOK */}
          <TabsContent value="b2g" className="mt-4 space-y-4">
            <Card className="border-blue-500/30 bg-blue-500/5">
              <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><Lightbulb className="h-4 w-4 text-blue-400" />Mensagem Central</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                <p className="text-sm font-medium text-foreground">{b2gPlaybook.message.title}</p>
                <p className="text-sm text-muted-foreground"><strong>Foco:</strong> {b2gPlaybook.message.focus}</p>
                <p className="text-sm text-muted-foreground"><strong>Linguagem:</strong> {b2gPlaybook.message.language}</p>
              </CardContent>
            </Card>
            <div className="grid sm:grid-cols-2 gap-4">
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Users className="h-4 w-4 text-primary" />Mapeamento de Stakeholders</CardTitle></CardHeader>
                <CardContent className="space-y-1.5">
                  {b2gPlaybook.prospecting.stakeholders.map((s, i) => (
                    <div key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                      <CheckCircle2 className="h-3.5 w-3.5 text-blue-400 shrink-0 mt-0.5" />{s}
                    </div>
                  ))}
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Megaphone className="h-4 w-4 text-primary" />Canais de Prospecção</CardTitle></CardHeader>
                <CardContent className="space-y-1.5">
                  {b2gPlaybook.prospecting.channels.map((c, i) => (
                    <div key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                      <ArrowRight className="h-3.5 w-3.5 text-blue-400 shrink-0 mt-0.5" />{c}
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
            <Card className="border-amber-500/30">
              <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Target className="h-4 w-4 text-amber-400" />Qualificação Adicional além do BANT</CardTitle></CardHeader>
              <CardContent className="space-y-1.5">
                {b2gPlaybook.prospecting.extra.map((e, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                    <CheckCircle2 className="h-3.5 w-3.5 text-amber-400 shrink-0 mt-0.5" />{e}
                  </div>
                ))}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Handshake className="h-4 w-4 text-primary" />Abordagem de Vendas e Negociação</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {b2gPlaybook.sales.map((s, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs text-muted-foreground p-2 rounded-lg bg-muted/30 border border-border/50">
                    <ArrowRight className="h-3.5 w-3.5 text-blue-400 shrink-0 mt-0.5" />{s}
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          {/* B2B PLAYBOOK */}
          <TabsContent value="b2b" className="mt-4 space-y-4">
            <Card className="border-violet-500/30 bg-violet-500/5">
              <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><Lightbulb className="h-4 w-4 text-violet-400" />Mensagem Central</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                <p className="text-sm font-medium text-foreground">{b2bPlaybook.message.title}</p>
                <p className="text-sm text-muted-foreground"><strong>Foco:</strong> {b2bPlaybook.message.focus}</p>
                <p className="text-sm text-muted-foreground"><strong>Linguagem:</strong> {b2bPlaybook.message.language}</p>
              </CardContent>
            </Card>
            <div className="grid sm:grid-cols-2 gap-4">
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Building2 className="h-4 w-4 text-primary" />Mapeamento de Contas</CardTitle></CardHeader>
                <CardContent className="space-y-1.5">
                  {b2bPlaybook.prospecting.accounts.map((a, i) => (
                    <div key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                      <CheckCircle2 className="h-3.5 w-3.5 text-violet-400 shrink-0 mt-0.5" />{a}
                    </div>
                  ))}
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Search className="h-4 w-4 text-primary" />Canais de Prospecção</CardTitle></CardHeader>
                <CardContent className="space-y-1.5">
                  {b2bPlaybook.prospecting.channels.map((c, i) => (
                    <div key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                      <ArrowRight className="h-3.5 w-3.5 text-violet-400 shrink-0 mt-0.5" />{c}
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
            <Card className="border-amber-500/30">
              <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Target className="h-4 w-4 text-amber-400" />Qualificação Adicional além do BANT</CardTitle></CardHeader>
              <CardContent className="space-y-1.5">
                {b2bPlaybook.prospecting.extra.map((e, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                    <CheckCircle2 className="h-3.5 w-3.5 text-amber-400 shrink-0 mt-0.5" />{e}
                  </div>
                ))}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Handshake className="h-4 w-4 text-primary" />Abordagem de Vendas e Negociação</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {b2bPlaybook.sales.map((s, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs text-muted-foreground p-2 rounded-lg bg-muted/30 border border-border/50">
                    <ArrowRight className="h-3.5 w-3.5 text-violet-400 shrink-0 mt-0.5" />{s}
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          {/* SALES STACK */}
          <TabsContent value="stack" className="mt-4">
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {salesStack.map((tool, i) => (
                <motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}>
                  <Card className="h-full">
                    <CardContent className="p-4 flex flex-col gap-2">
                      <div className="flex items-center gap-2">
                        <div className="p-2 rounded-lg bg-primary/10"><tool.icon className="h-4 w-4 text-primary" /></div>
                        <h3 className="font-semibold text-sm">{tool.title}</h3>
                      </div>
                      <p className="text-xs text-muted-foreground">{tool.desc}</p>
                      <div className="mt-auto pt-2 border-t border-border/50">
                        <p className="text-[10px] text-muted-foreground"><span className="font-medium text-foreground">Ex:</span> {tool.examples}</p>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          </TabsContent>

          {/* KPIs */}
          <TabsContent value="kpis" className="mt-4 space-y-4">
            {[
              { role: "SDR/BDR", subtitle: "Geração de Oportunidades", items: kpis.bdr, color: "border-blue-500/30 bg-blue-500/5", iconColor: "text-blue-400" },
              { role: "Account Executive (AE)", subtitle: "Fechamento de Vendas", items: kpis.ae, color: "border-violet-500/30 bg-violet-500/5", iconColor: "text-violet-400" },
              { role: "CSM", subtitle: "Sucesso e Expansão do Cliente", items: kpis.csm, color: "border-emerald-500/30 bg-emerald-500/5", iconColor: "text-emerald-400" },
            ].map((group, g) => (
              <Card key={g} className={`border ${group.color}`}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <TrendingUp className={`h-4 w-4 ${group.iconColor}`} />{group.role}
                    <span className="text-xs font-normal text-muted-foreground">— {group.subtitle}</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="grid sm:grid-cols-2 gap-2">
                  {group.items.map((kpi, i) => {
                    const [label, ...rest] = kpi.split(": ");
                    return (
                      <div key={i} className="flex items-start gap-2 p-2 rounded-lg bg-card/80 border border-border/50 text-xs">
                        <BarChart3 className={`h-3.5 w-3.5 shrink-0 mt-0.5 ${group.iconColor}`} />
                        <span><strong className="text-foreground">{label}:</strong> <span className="text-muted-foreground">{rest.join(": ")}</span></span>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          {/* COMMISSION */}
          <TabsContent value="commission" className="mt-4 space-y-4">
            <p className="text-sm text-muted-foreground">Modelo OTE (On-Target Earnings): remuneração total esperada ao atingir 100% da meta = salário base + comissão.</p>
            <div className="grid sm:grid-cols-3 gap-4">
              {commission.map((c, i) => (
                <Card key={i} className={`border ${c.color}`}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">{c.role}</CardTitle>
                    <div className="flex gap-2 flex-wrap">
                      <Badge variant="outline" className="text-[10px]">Base: {c.base}</Badge>
                      <Badge variant="outline" className="text-[10px]">Variável: {c.variable}</Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-1.5">
                    {c.items.map((item, j) => {
                      const [label, ...rest] = item.split(": ");
                      return (
                        <div key={j} className="flex items-start gap-2 text-xs">
                          <DollarSign className="h-3.5 w-3.5 text-emerald-400 shrink-0 mt-0.5" />
                          <span><strong className="text-foreground">{label}:</strong> <span className="text-muted-foreground">{rest.join(": ")}</span></span>
                        </div>
                      );
                    })}
                  </CardContent>
                </Card>
              ))}
            </div>
            <Card className="border-amber-500/30 bg-amber-500/5">
              <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Star className="h-4 w-4 text-amber-400" />Considerações Adicionais</CardTitle></CardHeader>
              <CardContent className="grid sm:grid-cols-2 gap-2">
                {["Transparência: modelo claro, simples e acessível a toda a equipe.", "Alinhamento: incentivos ligados a ARR, retenção e expansão para novos mercados.", "Revisão Anual: atualizar o modelo para manter relevância e competitividade.", "Incentivos Não Financeiros: reconhecimento, desenvolvimento profissional e participação estratégica."].map((tip, i) => {
                  const [label, ...rest] = tip.split(": ");
                  return (
                    <div key={i} className="flex items-start gap-2 text-xs p-2 rounded-lg bg-card/80 border border-border/50">
                      <CheckCircle2 className="h-3.5 w-3.5 text-amber-400 shrink-0 mt-0.5" />
                      <span><strong className="text-foreground">{label}:</strong> <span className="text-muted-foreground">{rest.join(": ")}</span></span>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </motion.div>
    </EMSLayout>
  );
};

export default CommercialStructure;
