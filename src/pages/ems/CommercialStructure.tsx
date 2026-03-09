import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { EMSLayout } from "@/components/ems/EMSLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useCompany } from "@/contexts/CompanyContext";
import {
  useCompanyCommercialStructure,
  type FunnelStage,
  type PlaybookData,
  type SalesStackItem,
  type KpisData,
  type CommissionRole,
  type CommissionData,
} from "@/hooks/useCompanyCommercialStructure";
import {
  Building2, Users, Target, TrendingUp, BarChart3, Briefcase,
  CheckCircle2, ArrowRight, Lightbulb, Wrench, Star, DollarSign,
  BookOpen, Megaphone, Search, Handshake, Pencil, Save, X, Plus, Trash2,
  Copy, Eye, FileDown, GitCompareArrows
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { exportCommercialStructurePdf } from "@/utils/commercialStructurePdf";

// ─── Default reference data ─────────────────────────────────────────

const defaultFunnelStages: FunnelStage[] = [
  { step: 1, title: "Prospecção", desc: "Identificação de potenciais clientes (prefeituras, empresas) que se encaixam no ICP.", responsible: "BDR", b2g: "Identificação de contato chave e necessidade inicial.", b2b: "Identificação de contato chave e necessidade inicial." },
  { step: 2, title: "Qualificação (SQL)", desc: "Validação da oportunidade: Budget, Authority, Need, Timeline (BANT).", responsible: "SDR/BDR", b2g: "Reunião agendada com decisor e confirmação de BANT.", b2b: "Reunião agendada com decisor e confirmação de BANT." },
  { step: 3, title: "Descoberta/Diagnóstico", desc: "Entendimento aprofundado das dores, desafios e objetivos do cliente.", responsible: "AE", b2g: "Documento de levantamento de necessidades assinado/validado.", b2b: "Documento de levantamento de necessidades assinado/validado." },
  { step: 4, title: "Demonstração/POC", desc: "Apresentação da solução focando em como ela resolve as dores específicas do cliente. POC se necessário.", responsible: "AE", b2g: "Cliente engajado na demo/POC, feedback positivo e solicitação de proposta.", b2b: "Cliente engajado na demo/POC, feedback positivo e solicitação de proposta." },
  { step: 5, title: "Proposta/Negociação", desc: "Elaboração e apresentação da proposta comercial. Negociação de termos e condições.", responsible: "AE", b2g: "Proposta formalmente apresentada e em discussão.", b2b: "Proposta formalmente apresentada e em discussão." },
  { step: 6, title: "Apoio à Licitação (B2G)", desc: "Auxílio na elaboração do Termo de Referência (TR) e acompanhamento do processo licitatório.", responsible: "AE + Jurídico", b2g: "Edital publicado com requisitos alinhados à solução.", b2b: "N/A" },
  { step: 7, title: "Fechamento", desc: "Assinatura do contrato.", responsible: "AE", b2g: "Contrato assinado.", b2b: "Contrato assinado." },
  { step: 8, title: "Onboarding/Implementação", desc: "Configuração da plataforma, treinamento da equipe do cliente.", responsible: "CSM", b2g: "Cliente com acesso à plataforma e treinamento inicial concluído.", b2b: "Cliente com acesso à plataforma e treinamento inicial concluído." },
  { step: 9, title: "Sucesso do Cliente", desc: "Acompanhamento contínuo, garantia de adoção, identificação de upsell/cross-sell.", responsible: "CSM", b2g: "Cliente satisfeito, uso contínuo da plataforma, renovação de contrato.", b2b: "Cliente satisfeito, uso contínuo da plataforma, renovação de contrato." },
];

const defaultB2GPlaybook: PlaybookData = {
  message: { title: "Resiliência, Transparência e Eficiência Pública", focus: "Não venda software, venda a capacidade de proteger vidas, otimizar recursos públicos e garantir a continuidade dos serviços em momentos de crise.", language: "Formal, técnica, alinhada com terminologia governamental (LGPD, e-PING, Plano Diretor, Defesa Civil)." },
  prospecting: { stakeholders: ["Secretários (Planejamento, Obras, Defesa Civil, Meio Ambiente)", "Prefeitos e Vereadores", "Diretores de TI", "Procuradores"], channels: ["Eventos governamentais (congressos de municípios)", "Workshops com associações (CNM, FNP)", "Publicações acadêmicas (UnB)", "Webinars sobre gestão de riscos e cidades inteligentes"], extra: ["Engajamento Político: há vontade política para investir em tecnologia e resiliência?", "Maturidade Digital: qual o nível de digitalização atual do município?", "Histórico de Crises: o município já enfrentou desastres que justifiquem urgência?"] },
  sales: ["Venda Consultiva: reuniões de diagnóstico aprofundadas.", "Demonstração de Valor: cases de sucesso com ROI social e econômico.", "Apoio à Licitação: suporte técnico para elaboração do TR.", "Negociação: flexibilidade em modelos de precificação e prazos."],
};

const defaultB2BPlaybook: PlaybookData = {
  message: { title: "Eficiência, Redução de Custos e Vantagem Competitiva", focus: "Venda a capacidade de otimizar projetos, reduzir retrabalho, melhorar a comunicação e aumentar a lucratividade.", language: "Direta, focada em resultados, com terminologia do setor (BIM, Lean Construction, cronograma, orçamento)." },
  prospecting: { accounts: ["Construtoras e incorporadoras em projetos de infraestrutura", "Escritórios de engenharia inovadores", "Consultorias de gestão e tecnologia"], channels: ["LinkedIn Sales Navigator", "Apollo.io / cold e-mail", "Indicações e eventos do setor", "Webinars sobre tecnologia na construção"], extra: ["Volume de Projetos: quantos projetos a empresa gerencia anualmente?", "Tecnologia Atual: quais softwares já utiliza?", "Dores Específicas: problemas com comunicação, atrasos, estouro de orçamento?"] },
  sales: ["Venda de Valor: apresentar como ferramenta com ROI claro.", "Demonstração Interativa: demos personalizadas com dados relevantes.", "Negociação: foco no valor entregue e precificação SaaS transparente."],
};

const defaultSalesStack: SalesStackItem[] = [
  { title: "CRM", desc: "Gerenciar o funil, registrar interações e automatizar tarefas.", examples: "Salesforce, HubSpot" },
  { title: "Prospecção", desc: "Identificação e qualificação de leads B2B e B2G.", examples: "LinkedIn Sales Navigator, Apollo.io, Ramper" },
  { title: "Automação de Marketing", desc: "Sequências de e-mail, lead scoring e nutrição de leads.", examples: "HubSpot, RD Station" },
  { title: "Plataformas de Licitação", desc: "Monitoramento de editais e processos licitatórios.", examples: "ConLicitação, Comprasnet" },
  { title: "Apresentação", desc: "Demos interativas e materiais ricos para o cliente.", examples: "e-books, whitepapers, case studies" },
];

const defaultKpis: KpisData = {
  bdr: ["SQLs Gerados: oportunidades que atendem ao BANT e foram aceitas pelos AEs", "Taxa de Conversão Lead → SQL: % de leads que se tornam SQLs", "Reuniões Agendadas: quantidade de reuniões qualificadas realizadas", "Tempo Médio de Resposta ao Lead: agilidade no primeiro contato"],
  ae: ["ARR Fechado: valor total dos contratos anuais fechados", "Novos Contratos Fechados: quantidade de novos clientes adquiridos", "Taxa de Conversão Oportunidade → Cliente: % de SQLs que viram clientes", "ACV (Annual Contract Value): valor médio dos contratos", "Ciclo Médio de Vendas: tempo desde o primeiro contato até o fechamento", "Taxa de Sucesso em Licitações (B2G): % de licitações ganhas"],
  csm: ["Churn Rate: % de clientes que renovam seus contratos", "NRR (Net Revenue Retention): crescimento da receita de clientes existentes", "Receita de Upsell/Cross-sell: valor de módulos adicionais", "NPS / CSAT: medidas de satisfação do cliente", "Adoção da Plataforma: funcionalidades utilizadas, frequência de uso"],
};

const defaultCommission: CommissionData = {
  roles: [
    { role: "SDR/BDR", base: "70–80% do OTE", variable: "20–30% do OTE", items: ["Por SQL Gerado: valor fixo por cada SQL aceito pelo AE", "Por Reunião Agendada: valor fixo por cada reunião qualificada", "Bônus por Fechamento: 1–2% do ARR do contrato fechado"] },
    { role: "Account Executive (AE)", base: "50–60% do OTE", variable: "40–50% do OTE", items: ["% do ARR Ano 1: 8–12% para B2B, 5–10% para B2G", "Aceleradores: 1,5x ou 2x para vendas acima de 100% da meta", "Bônus por Qualidade: bônus se cliente tiver alta adoção ou NRR positivo"] },
    { role: "Customer Success Manager (CSM)", base: "70–80% do OTE", variable: "20–30% do OTE", items: ["% de Renovação: 2–5% sobre o ARR renovado dos clientes", "% de Upsell/Cross-sell: 5–10% sobre a receita adicional gerada", "Bônus por NPS/CSAT: atrelado à satisfação do cliente"] },
  ],
  considerations: ["Transparência: modelo claro, simples e acessível a toda a equipe.", "Alinhamento: incentivos ligados a ARR, retenção e expansão.", "Revisão Anual: atualizar o modelo para manter relevância.", "Incentivos Não Financeiros: reconhecimento e desenvolvimento profissional."],
};

const stageColors = [
  "bg-blue-500/10 border-blue-500/30 text-blue-500",
  "bg-violet-500/10 border-violet-500/30 text-violet-500",
  "bg-amber-500/10 border-amber-500/30 text-amber-500",
  "bg-emerald-500/10 border-emerald-500/30 text-emerald-500",
  "bg-orange-500/10 border-orange-500/30 text-orange-500",
  "bg-cyan-500/10 border-cyan-500/30 text-cyan-500",
  "bg-green-500/10 border-green-500/30 text-green-500",
  "bg-pink-500/10 border-pink-500/30 text-pink-500",
  "bg-rose-500/10 border-rose-500/30 text-rose-500",
];

const stackIcons = [Target, Search, Megaphone, BookOpen, Star];

// ─── Editable list helper ───────────────────────────────────────────

const EditableList = ({ items, onChange, placeholder = "Item" }: { items: string[]; onChange: (items: string[]) => void; placeholder?: string }) => (
  <div className="space-y-1.5">
    {items.map((item, i) => (
      <div key={i} className="flex items-center gap-2">
        <Input
          value={item}
          onChange={(e) => { const copy = [...items]; copy[i] = e.target.value; onChange(copy); }}
          placeholder={placeholder}
          className="text-xs h-8"
        />
        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => onChange(items.filter((_, j) => j !== i))}>
          <Trash2 className="h-3.5 w-3.5 text-destructive" />
        </Button>
      </div>
    ))}
    <Button variant="outline" size="sm" className="text-xs h-7" onClick={() => onChange([...items, ""])}>
      <Plus className="h-3 w-3 mr-1" /> Adicionar
    </Button>
  </div>
);

// ─── Section renderers (read-only) ─────────────────────────────────

function FunnelReadOnly({ stages }: { stages: FunnelStage[] }) {
  return (
    <div className="space-y-2">
      {stages.map((s, i) => {
        const color = stageColors[i % stageColors.length];
        return (
          <motion.div key={s.step} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }}>
            <Card className={`border ${color.split(" ")[1]} transition-all hover:shadow-md`}>
              <CardContent className="p-4">
                <div className="flex flex-col sm:flex-row sm:items-start gap-3">
                  <div className={`flex items-center justify-center w-8 h-8 rounded-full shrink-0 text-sm font-bold ${color}`}>{s.step}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <h3 className="font-semibold text-sm text-foreground">{s.title}</h3>
                      <Badge variant="outline" className={`text-[10px] ${color.split(" ")[0]} ${color.split(" ")[2]} border ${color.split(" ")[1]}`}>{s.responsible}</Badge>
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
        );
      })}
    </div>
  );
}

function PlaybookReadOnly({ data, type }: { data: PlaybookData; type: "b2g" | "b2b" }) {
  const accent = type === "b2g" ? "blue" : "violet";
  return (
    <div className="space-y-4">
      <Card className={`border-${accent}-500/30 bg-${accent}-500/5`}>
        <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><Lightbulb className={`h-4 w-4 text-${accent}-400`} />Mensagem Central</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          <p className="text-sm font-medium text-foreground">{data.message.title}</p>
          <p className="text-sm text-muted-foreground"><strong>Foco:</strong> {data.message.focus}</p>
          <p className="text-sm text-muted-foreground"><strong>Linguagem:</strong> {data.message.language}</p>
        </CardContent>
      </Card>
      <div className="grid sm:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Users className="h-4 w-4 text-primary" />{type === "b2g" ? "Stakeholders" : "Mapeamento de Contas"}</CardTitle></CardHeader>
          <CardContent className="space-y-1.5">
            {(data.prospecting.stakeholders || data.prospecting.accounts || []).map((s, i) => (
              <div key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                <CheckCircle2 className={`h-3.5 w-3.5 text-${accent}-400 shrink-0 mt-0.5`} />{s}
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Megaphone className="h-4 w-4 text-primary" />Canais de Prospecção</CardTitle></CardHeader>
          <CardContent className="space-y-1.5">
            {data.prospecting.channels.map((c, i) => (
              <div key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                <ArrowRight className={`h-3.5 w-3.5 text-${accent}-400 shrink-0 mt-0.5`} />{c}
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
      <Card className="border-amber-500/30">
        <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Target className="h-4 w-4 text-amber-400" />Qualificação Adicional</CardTitle></CardHeader>
        <CardContent className="space-y-1.5">
          {data.prospecting.extra.map((e, i) => (
            <div key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
              <CheckCircle2 className="h-3.5 w-3.5 text-amber-400 shrink-0 mt-0.5" />{e}
            </div>
          ))}
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Handshake className="h-4 w-4 text-primary" />Abordagem de Vendas</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {data.sales.map((s, i) => (
            <div key={i} className="flex items-start gap-2 text-xs text-muted-foreground p-2 rounded-lg bg-muted/30 border border-border/50">
              <ArrowRight className={`h-3.5 w-3.5 text-${accent}-400 shrink-0 mt-0.5`} />{s}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function SalesStackReadOnly({ items }: { items: SalesStackItem[] }) {
  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {items.map((tool, i) => {
        const Icon = stackIcons[i % stackIcons.length];
        return (
          <Card key={i} className="h-full">
            <CardContent className="p-4 flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-primary/10"><Icon className="h-4 w-4 text-primary" /></div>
                <h3 className="font-semibold text-sm">{tool.title}</h3>
              </div>
              <p className="text-xs text-muted-foreground">{tool.desc}</p>
              <div className="mt-auto pt-2 border-t border-border/50">
                <p className="text-[10px] text-muted-foreground"><span className="font-medium text-foreground">Ex:</span> {tool.examples}</p>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function KpisReadOnly({ data }: { data: KpisData }) {
  const groups = [
    { role: "SDR/BDR", subtitle: "Geração de Oportunidades", items: data.bdr, color: "border-blue-500/30 bg-blue-500/5", iconColor: "text-blue-400" },
    { role: "Account Executive (AE)", subtitle: "Fechamento de Vendas", items: data.ae, color: "border-violet-500/30 bg-violet-500/5", iconColor: "text-violet-400" },
    { role: "CSM", subtitle: "Sucesso e Expansão", items: data.csm, color: "border-emerald-500/30 bg-emerald-500/5", iconColor: "text-emerald-400" },
  ];
  return (
    <div className="space-y-4">
      {groups.map((g, gi) => (
        <Card key={gi} className={`border ${g.color}`}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <TrendingUp className={`h-4 w-4 ${g.iconColor}`} />{g.role}
              <span className="text-xs font-normal text-muted-foreground">— {g.subtitle}</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="grid sm:grid-cols-2 gap-2">
            {g.items.map((kpi, i) => {
              const [label, ...rest] = kpi.split(": ");
              return (
                <div key={i} className="flex items-start gap-2 p-2 rounded-lg bg-card/80 border border-border/50 text-xs">
                  <BarChart3 className={`h-3.5 w-3.5 shrink-0 mt-0.5 ${g.iconColor}`} />
                  <span><strong className="text-foreground">{label}:</strong> <span className="text-muted-foreground">{rest.join(": ")}</span></span>
                </div>
              );
            })}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function CommissionReadOnly({ data }: { data: CommissionData }) {
  const colors = ["border-blue-500/30 bg-blue-500/5", "border-violet-500/30 bg-violet-500/5", "border-emerald-500/30 bg-emerald-500/5"];
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">Modelo OTE (On-Target Earnings): remuneração total esperada ao atingir 100% da meta.</p>
      <div className="grid sm:grid-cols-3 gap-4">
        {data.roles.map((c, i) => (
          <Card key={i} className={`border ${colors[i % colors.length]}`}>
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
        <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Star className="h-4 w-4 text-amber-400" />Considerações</CardTitle></CardHeader>
        <CardContent className="grid sm:grid-cols-2 gap-2">
          {data.considerations.map((tip, i) => {
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
    </div>
  );
}

// ─── Editable section wrappers ──────────────────────────────────────

function FunnelEditor({ stages, onSave }: { stages: FunnelStage[]; onSave: (data: FunnelStage[]) => void }) {
  const [data, setData] = useState<FunnelStage[]>(stages);

  const update = (idx: number, field: keyof FunnelStage, value: string | number) => {
    const copy = [...data];
    (copy[idx] as any)[field] = value;
    setData(copy);
  };

  const addStage = () => {
    setData([...data, { step: data.length + 1, title: "", desc: "", responsible: "", b2g: "", b2b: "" }]);
  };

  const removeStage = (idx: number) => {
    setData(data.filter((_, i) => i !== idx).map((s, i) => ({ ...s, step: i + 1 })));
  };

  return (
    <div className="space-y-3">
      {data.map((s, i) => (
        <Card key={i} className="border border-border">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-2">
              <div className="flex items-center justify-center w-8 h-8 rounded-full shrink-0 text-sm font-bold bg-primary/10 text-primary">{s.step}</div>
              <Input value={s.title} onChange={(e) => update(i, "title", e.target.value)} placeholder="Título da etapa" className="text-sm font-semibold h-8" />
              <Input value={s.responsible} onChange={(e) => update(i, "responsible", e.target.value)} placeholder="Responsável" className="text-xs h-8 w-32" />
              <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => removeStage(i)}>
                <Trash2 className="h-3.5 w-3.5 text-destructive" />
              </Button>
            </div>
            <Textarea value={s.desc} onChange={(e) => update(i, "desc", e.target.value)} placeholder="Descrição" className="text-xs min-h-[40px]" />
            <div className="grid sm:grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] font-semibold text-blue-400">🏛 Critério B2G</label>
                <Textarea value={s.b2g} onChange={(e) => update(i, "b2g", e.target.value)} className="text-xs min-h-[40px] mt-1" />
              </div>
              <div>
                <label className="text-[10px] font-semibold text-violet-400">🏢 Critério B2B</label>
                <Textarea value={s.b2b} onChange={(e) => update(i, "b2b", e.target.value)} className="text-xs min-h-[40px] mt-1" />
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={addStage}><Plus className="h-3.5 w-3.5 mr-1" /> Adicionar Etapa</Button>
        <Button size="sm" onClick={() => onSave(data)}><Save className="h-3.5 w-3.5 mr-1" /> Salvar</Button>
      </div>
    </div>
  );
}

function PlaybookEditor({ data: initial, onSave, type }: { data: PlaybookData; onSave: (data: PlaybookData) => void; type: "b2g" | "b2b" }) {
  const [data, setData] = useState<PlaybookData>(initial);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Mensagem Central</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          <Input value={data.message.title} onChange={(e) => setData({ ...data, message: { ...data.message, title: e.target.value } })} placeholder="Título" className="text-sm h-8" />
          <Textarea value={data.message.focus} onChange={(e) => setData({ ...data, message: { ...data.message, focus: e.target.value } })} placeholder="Foco" className="text-xs min-h-[60px]" />
          <Input value={data.message.language} onChange={(e) => setData({ ...data, message: { ...data.message, language: e.target.value } })} placeholder="Linguagem" className="text-xs h-8" />
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">{type === "b2g" ? "Stakeholders" : "Contas"}</CardTitle></CardHeader>
        <CardContent>
          <EditableList
            items={data.prospecting.stakeholders || data.prospecting.accounts || []}
            onChange={(items) => setData({ ...data, prospecting: { ...data.prospecting, [type === "b2g" ? "stakeholders" : "accounts"]: items } })}
          />
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Canais</CardTitle></CardHeader>
        <CardContent>
          <EditableList items={data.prospecting.channels} onChange={(channels) => setData({ ...data, prospecting: { ...data.prospecting, channels } })} />
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Qualificação Adicional</CardTitle></CardHeader>
        <CardContent>
          <EditableList items={data.prospecting.extra} onChange={(extra) => setData({ ...data, prospecting: { ...data.prospecting, extra } })} />
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Abordagem de Vendas</CardTitle></CardHeader>
        <CardContent>
          <EditableList items={data.sales} onChange={(sales) => setData({ ...data, sales })} />
        </CardContent>
      </Card>
      <Button size="sm" onClick={() => onSave(data)}><Save className="h-3.5 w-3.5 mr-1" /> Salvar</Button>
    </div>
  );
}

function KpisEditor({ data: initial, onSave }: { data: KpisData; onSave: (data: KpisData) => void }) {
  const [data, setData] = useState<KpisData>(initial);
  return (
    <div className="space-y-4">
      {[
        { key: "bdr" as const, label: "SDR/BDR" },
        { key: "ae" as const, label: "Account Executive (AE)" },
        { key: "csm" as const, label: "CSM" },
      ].map((g) => (
        <Card key={g.key}>
          <CardHeader className="pb-2"><CardTitle className="text-sm">{g.label}</CardTitle></CardHeader>
          <CardContent>
            <EditableList items={data[g.key]} onChange={(items) => setData({ ...data, [g.key]: items })} placeholder="KPI: descrição" />
          </CardContent>
        </Card>
      ))}
      <Button size="sm" onClick={() => onSave(data)}><Save className="h-3.5 w-3.5 mr-1" /> Salvar</Button>
    </div>
  );
}

function CommissionEditor({ data: initial, onSave }: { data: CommissionData; onSave: (data: CommissionData) => void }) {
  const [data, setData] = useState<CommissionData>(initial);

  const updateRole = (idx: number, field: keyof CommissionRole, value: any) => {
    const copy = { ...data, roles: [...data.roles] };
    (copy.roles[idx] as any)[field] = value;
    setData(copy);
  };

  return (
    <div className="space-y-4">
      {data.roles.map((r, i) => (
        <Card key={i}>
          <CardHeader className="pb-2"><CardTitle className="text-sm">{r.role}</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <Input value={r.base} onChange={(e) => updateRole(i, "base", e.target.value)} placeholder="Base" className="text-xs h-8" />
              <Input value={r.variable} onChange={(e) => updateRole(i, "variable", e.target.value)} placeholder="Variável" className="text-xs h-8" />
            </div>
            <EditableList items={r.items} onChange={(items) => updateRole(i, "items", items)} placeholder="Item de comissão" />
          </CardContent>
        </Card>
      ))}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Considerações</CardTitle></CardHeader>
        <CardContent>
          <EditableList items={data.considerations} onChange={(considerations) => setData({ ...data, considerations })} />
        </CardContent>
      </Card>
      <Button size="sm" onClick={() => onSave(data)}><Save className="h-3.5 w-3.5 mr-1" /> Salvar</Button>
    </div>
  );
}

function SalesStackEditor({ items: initial, onSave }: { items: SalesStackItem[]; onSave: (data: SalesStackItem[]) => void }) {
  const [data, setData] = useState<SalesStackItem[]>(initial);

  const update = (idx: number, field: keyof SalesStackItem, value: string) => {
    const copy = [...data];
    copy[idx] = { ...copy[idx], [field]: value };
    setData(copy);
  };

  return (
    <div className="space-y-3">
      {data.map((item, i) => (
        <Card key={i}>
          <CardContent className="p-3 space-y-2">
            <div className="flex items-center gap-2">
              <Input value={item.title} onChange={(e) => update(i, "title", e.target.value)} placeholder="Título" className="text-sm font-semibold h-8" />
              <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => setData(data.filter((_, j) => j !== i))}>
                <Trash2 className="h-3.5 w-3.5 text-destructive" />
              </Button>
            </div>
            <Input value={item.desc} onChange={(e) => update(i, "desc", e.target.value)} placeholder="Descrição" className="text-xs h-8" />
            <Input value={item.examples} onChange={(e) => update(i, "examples", e.target.value)} placeholder="Exemplos" className="text-xs h-8" />
          </CardContent>
        </Card>
      ))}
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={() => setData([...data, { title: "", desc: "", examples: "" }])}>
          <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar Ferramenta
        </Button>
        <Button size="sm" onClick={() => onSave(data)}><Save className="h-3.5 w-3.5 mr-1" /> Salvar</Button>
      </div>
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────────────

const CommercialStructure = () => {
  const { selectedCompanyId, selectedCompany, companies } = useCompany();
  const navigate = useNavigate();
  const hasCompany = selectedCompanyId !== "all" && !!selectedCompany;
  const { getSection, upsertSection, isLoading } = useCompanyCommercialStructure(hasCompany ? selectedCompanyId : null);

  const [viewMode, setViewMode] = useState<"reference" | "company">(hasCompany ? "company" : "reference");
  const [activeTab, setActiveTab] = useState("funnel");
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    if (!hasCompany) setViewMode("reference");
  }, [hasCompany]);

  // Get company-specific data or fall back to defaults
  const funnel = (viewMode === "company" && hasCompany ? getSection<FunnelStage[]>("funnel_stages") : null) || defaultFunnelStages;
  const b2g = (viewMode === "company" && hasCompany ? getSection<PlaybookData>("playbook_b2g") : null) || defaultB2GPlaybook;
  const b2b = (viewMode === "company" && hasCompany ? getSection<PlaybookData>("playbook_b2b") : null) || defaultB2BPlaybook;
  const stack = (viewMode === "company" && hasCompany ? getSection<SalesStackItem[]>("sales_stack") : null) || defaultSalesStack;
  const kpisData = (viewMode === "company" && hasCompany ? getSection<KpisData>("kpis") : null) || defaultKpis;
  const commissionData = (viewMode === "company" && hasCompany ? getSection<CommissionData>("commission") : null) || defaultCommission;

  const isCompanyView = viewMode === "company" && hasCompany;

  const handleCopyFromReference = () => {
    // Save all default data as company data
    const saves = [
      upsertSection.mutateAsync({ section: "funnel_stages", content: defaultFunnelStages }),
      upsertSection.mutateAsync({ section: "playbook_b2g", content: defaultB2GPlaybook }),
      upsertSection.mutateAsync({ section: "playbook_b2b", content: defaultB2BPlaybook }),
      upsertSection.mutateAsync({ section: "sales_stack", content: defaultSalesStack }),
      upsertSection.mutateAsync({ section: "kpis", content: defaultKpis }),
      upsertSection.mutateAsync({ section: "commission", content: defaultCommission }),
    ];
    Promise.all(saves);
  };

  const hasCompanyData = viewMode === "company" && hasCompany && getSection("funnel_stages") !== null;

  return (
    <EMSLayout>
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-6 p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-heading font-bold text-foreground flex items-center gap-2">
              <Briefcase className="h-6 w-6 text-primary" /> Estrutura Comercial
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {isCompanyView
                ? `Versão customizada para ${selectedCompany?.name}`
                : "Referência estratégica — playbooks, funil, KPIs e comissionamento."}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {hasCompany && (
              <>
                <Button
                  variant={viewMode === "reference" ? "default" : "outline"}
                  size="sm"
                  onClick={() => { setViewMode("reference"); setEditing(false); }}
                  className="text-xs"
                >
                  <Eye className="h-3.5 w-3.5 mr-1" /> Referência
                </Button>
                <Button
                  variant={viewMode === "company" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setViewMode("company")}
                  className="text-xs"
                >
                  <Building2 className="h-3.5 w-3.5 mr-1" /> {selectedCompany?.name}
                </Button>
              </>
            )}
            {isCompanyView && (
              <Button
                variant={editing ? "destructive" : "outline"}
                size="sm"
                onClick={() => setEditing(!editing)}
                className="text-xs"
              >
                {editing ? <><X className="h-3.5 w-3.5 mr-1" /> Cancelar</> : <><Pencil className="h-3.5 w-3.5 mr-1" /> Editar</>}
              </Button>
            )}
          </div>
        </div>

        {isCompanyView && !hasCompanyData && !isLoading && (
          <Card className="border-dashed border-primary/30 bg-primary/5">
            <CardContent className="p-6 text-center space-y-3">
              <p className="text-sm text-muted-foreground">
                Nenhuma estrutura customizada para <strong>{selectedCompany?.name}</strong> ainda.
              </p>
              <Button size="sm" onClick={handleCopyFromReference}>
                <Copy className="h-3.5 w-3.5 mr-1" /> Copiar da Referência e Personalizar
              </Button>
            </CardContent>
          </Card>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="w-full flex-wrap h-auto gap-1 p-1">
            <TabsTrigger value="funnel" className="flex items-center gap-1.5"><Target className="h-3.5 w-3.5" />Funil</TabsTrigger>
            <TabsTrigger value="b2g" className="flex items-center gap-1.5"><Building2 className="h-3.5 w-3.5" />B2G</TabsTrigger>
            <TabsTrigger value="b2b" className="flex items-center gap-1.5"><Briefcase className="h-3.5 w-3.5" />B2B</TabsTrigger>
            <TabsTrigger value="stack" className="flex items-center gap-1.5"><Wrench className="h-3.5 w-3.5" />Stack</TabsTrigger>
            <TabsTrigger value="kpis" className="flex items-center gap-1.5"><BarChart3 className="h-3.5 w-3.5" />KPIs</TabsTrigger>
            <TabsTrigger value="commission" className="flex items-center gap-1.5"><DollarSign className="h-3.5 w-3.5" />Comissão</TabsTrigger>
          </TabsList>

          <TabsContent value="funnel" className="mt-4">
            {editing && isCompanyView ? (
              <FunnelEditor stages={funnel} onSave={(data) => { upsertSection.mutate({ section: "funnel_stages", content: data }); setEditing(false); }} />
            ) : (
              <FunnelReadOnly stages={funnel} />
            )}
          </TabsContent>

          <TabsContent value="b2g" className="mt-4">
            {editing && isCompanyView ? (
              <PlaybookEditor data={b2g} type="b2g" onSave={(data) => { upsertSection.mutate({ section: "playbook_b2g", content: data }); setEditing(false); }} />
            ) : (
              <PlaybookReadOnly data={b2g} type="b2g" />
            )}
          </TabsContent>

          <TabsContent value="b2b" className="mt-4">
            {editing && isCompanyView ? (
              <PlaybookEditor data={b2b} type="b2b" onSave={(data) => { upsertSection.mutate({ section: "playbook_b2b", content: data }); setEditing(false); }} />
            ) : (
              <PlaybookReadOnly data={b2b} type="b2b" />
            )}
          </TabsContent>

          <TabsContent value="stack" className="mt-4">
            {editing && isCompanyView ? (
              <SalesStackEditor items={stack} onSave={(data) => { upsertSection.mutate({ section: "sales_stack", content: data }); setEditing(false); }} />
            ) : (
              <SalesStackReadOnly items={stack} />
            )}
          </TabsContent>

          <TabsContent value="kpis" className="mt-4">
            {editing && isCompanyView ? (
              <KpisEditor data={kpisData} onSave={(data) => { upsertSection.mutate({ section: "kpis", content: data }); setEditing(false); }} />
            ) : (
              <KpisReadOnly data={kpisData} />
            )}
          </TabsContent>

          <TabsContent value="commission" className="mt-4">
            {editing && isCompanyView ? (
              <CommissionEditor data={commissionData} onSave={(data) => { upsertSection.mutate({ section: "commission", content: data }); setEditing(false); }} />
            ) : (
              <CommissionReadOnly data={commissionData} />
            )}
          </TabsContent>
        </Tabs>
      </motion.div>
    </EMSLayout>
  );
};

export default CommercialStructure;
