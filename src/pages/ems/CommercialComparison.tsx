import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { EMSLayout } from "@/components/ems/EMSLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { useCompany, type Company } from "@/contexts/CompanyContext";
import { supabase } from "@/integrations/supabase/client";
import type {
  FunnelStage,
  PlaybookData,
  KpisData,
  CommissionData,
} from "@/hooks/useCompanyCommercialStructure";
import { BarChart3, Building2, Target, DollarSign, TrendingUp, GitCompareArrows } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
} from "recharts";

const CHART_COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--accent))",
  "hsl(var(--secondary))",
  "hsl(var(--ring))",
  "hsl(var(--muted-foreground))",
];

const DOT_CLASSES = ["bg-primary", "bg-accent", "bg-secondary", "bg-ring", "bg-muted-foreground"];

interface CompanyStructure {
  company: Company;
  sections: Record<string, any>;
}

const CommercialComparison = () => {
  const { companies } = useCompany();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const { data: allStructures = [], isLoading } = useQuery({
    queryKey: ["all-commercial-structures"],
    queryFn: async () => {
      const { data, error } = await supabase.from("company_commercial_structure" as any).select("*");
      if (error) throw error;
      return data as any[];
    },
  });

  const companyStructures: CompanyStructure[] = companies
    .map((company) => {
      const rows = allStructures.filter((r: any) => r.company_id === company.id);
      if (rows.length === 0) return null;
      const sections: Record<string, any> = {};
      rows.forEach((r: any) => {
        sections[r.section] = r.content;
      });
      return { company, sections };
    })
    .filter(Boolean) as CompanyStructure[];

  const selected = companyStructures.filter((cs) => selectedIds.includes(cs.company.id));

  const toggleCompany = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const funnelComparisonData = () => {
    if (selected.length === 0) return [];
    const maxSteps = Math.max(...selected.map((s) => ((s.sections.funnel_stages as FunnelStage[]) || []).length));
    return Array.from({ length: maxSteps }, (_, i) => {
      const point: Record<string, string | number> = { step: `Etapa ${i + 1}` };
      selected.forEach((cs) => {
        const stages = (cs.sections.funnel_stages as FunnelStage[]) || [];
        point[cs.company.name] = stages[i] ? 1 : 0;
      });
      return point;
    });
  };

  const kpiComparisonData = () =>
    selected.map((cs) => {
      const kpis = cs.sections.kpis as KpisData | undefined;
      return {
        name: cs.company.name,
        "KPIs BDR": kpis?.bdr?.length || 0,
        "KPIs AE": kpis?.ae?.length || 0,
        "KPIs CSM": kpis?.csm?.length || 0,
      };
    });

  const channelRadarData = () => {
    const allChannels = new Set<string>();
    selected.forEach((cs) => {
      const b2g = cs.sections.playbook_b2g as PlaybookData | undefined;
      const b2b = cs.sections.playbook_b2b as PlaybookData | undefined;
      b2g?.prospecting.channels.forEach((c) => allChannels.add(c.substring(0, 25)));
      b2b?.prospecting.channels.forEach((c) => allChannels.add(c.substring(0, 25)));
    });

    return Array.from(allChannels)
      .slice(0, 8)
      .map((channel) => {
        const point: Record<string, string | number> = { channel };
        selected.forEach((cs) => {
          const b2g = cs.sections.playbook_b2g as PlaybookData | undefined;
          const b2b = cs.sections.playbook_b2b as PlaybookData | undefined;
          const all = [...(b2g?.prospecting.channels || []), ...(b2b?.prospecting.channels || [])];
          point[cs.company.name] = all.some((c) => c.startsWith(channel.substring(0, 15))) ? 1 : 0;
        });
        return point;
      });
  };

  const commissionComparisonData = () =>
    selected.map((cs) => {
      const comm = cs.sections.commission as CommissionData | undefined;
      return {
        name: cs.company.name,
        Papéis: comm?.roles?.length || 0,
        "Itens de Comissão": comm?.roles?.reduce((sum, r) => sum + r.items.length, 0) || 0,
        Considerações: comm?.considerations?.length || 0,
      };
    });

  return (
    <EMSLayout>
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-6 p-3 sm:p-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-heading font-bold text-foreground flex items-center gap-2">
            <GitCompareArrows className="h-5 w-5 sm:h-6 sm:w-6 text-primary" /> Comparativo Comercial
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Compare as estruturas comerciais de diferentes empresas lado a lado.
          </p>
        </div>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Building2 className="h-4 w-4 text-primary" /> Selecionar Empresas para Comparar
            </CardTitle>
          </CardHeader>
          <CardContent>
            {companyStructures.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {isLoading ? "Carregando..." : "Nenhuma empresa possui estrutura comercial customizada ainda."}
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                {companyStructures.map((cs, i) => (
                  <label
                    key={cs.company.id}
                    className="flex items-center gap-2 cursor-pointer p-2.5 rounded-lg border border-border hover:bg-muted/50 transition-colors"
                  >
                    <Checkbox checked={selectedIds.includes(cs.company.id)} onCheckedChange={() => toggleCompany(cs.company.id)} />
                    <div className="flex items-center gap-1.5 min-w-0">
                      <div className={`h-3 w-3 rounded-full ${DOT_CLASSES[i % DOT_CLASSES.length]}`} />
                      <span className="text-sm font-medium truncate">{cs.company.name}</span>
                    </div>
                    <Badge variant="outline" className="text-[10px] ml-auto">
                      {Object.keys(cs.sections).length} seções
                    </Badge>
                  </label>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {selected.length >= 2 && (
          <Tabs defaultValue="funnel">
            <TabsList className="w-full h-auto gap-1 p-1 flex-nowrap overflow-x-auto justify-start">
              <TabsTrigger value="funnel" className="flex items-center gap-1.5 whitespace-nowrap text-xs sm:text-sm"><Target className="h-3.5 w-3.5" />Funil</TabsTrigger>
              <TabsTrigger value="kpis" className="flex items-center gap-1.5 whitespace-nowrap text-xs sm:text-sm"><BarChart3 className="h-3.5 w-3.5" />KPIs</TabsTrigger>
              <TabsTrigger value="channels" className="flex items-center gap-1.5 whitespace-nowrap text-xs sm:text-sm"><TrendingUp className="h-3.5 w-3.5" />Canais</TabsTrigger>
              <TabsTrigger value="commission" className="flex items-center gap-1.5 whitespace-nowrap text-xs sm:text-sm"><DollarSign className="h-3.5 w-3.5" />Comissão</TabsTrigger>
              <TabsTrigger value="detail" className="flex items-center gap-1.5 whitespace-nowrap text-xs sm:text-sm"><Building2 className="h-3.5 w-3.5" />Detalhes</TabsTrigger>
            </TabsList>

            <TabsContent value="funnel" className="mt-4 space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Cobertura do Funil de Vendas</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <div className="h-[280px] sm:h-[350px] min-w-[560px] sm:min-w-0">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={funnelComparisonData()}>
                          <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                          <XAxis dataKey="step" tick={{ fontSize: 11 }} />
                          <YAxis tick={{ fontSize: 11 }} />
                          <Tooltip />
                          <Legend />
                          {selected.map((cs, i) => (
                            <Bar key={cs.company.id} dataKey={cs.company.name} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                          ))}
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {selected.map((cs, i) => (
                  <Card key={cs.company.id} className="border-t-2" style={{ borderTopColor: CHART_COLORS[i % CHART_COLORS.length] }}>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">{cs.company.name}</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {((cs.sections.funnel_stages as FunnelStage[]) || []).map((s, j) => (
                        <div key={j} className="text-xs p-2 rounded bg-muted/30 border border-border/50">
                          <span className="font-semibold">{s.step}. {s.title}</span>
                          <span className="text-muted-foreground ml-1">— {s.responsible}</span>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="kpis" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Quantidade de KPIs por Papel</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <div className="h-[280px] sm:h-[350px] min-w-[560px] sm:min-w-0">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={kpiComparisonData()}>
                          <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                          <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                          <YAxis tick={{ fontSize: 11 }} />
                          <Tooltip />
                          <Legend />
                          <Bar dataKey="KPIs BDR" fill={CHART_COLORS[0]} />
                          <Bar dataKey="KPIs AE" fill={CHART_COLORS[1]} />
                          <Bar dataKey="KPIs CSM" fill={CHART_COLORS[2]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="channels" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Canais de Prospecção (Radar)</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <div className="h-[320px] sm:h-[400px] min-w-[560px] sm:min-w-0">
                      <ResponsiveContainer width="100%" height="100%">
                        <RadarChart data={channelRadarData()}>
                          <PolarGrid />
                          <PolarAngleAxis dataKey="channel" tick={{ fontSize: 9 }} />
                          <PolarRadiusAxis tick={{ fontSize: 9 }} />
                          {selected.map((cs, i) => (
                            <Radar
                              key={cs.company.id}
                              name={cs.company.name}
                              dataKey={cs.company.name}
                              stroke={CHART_COLORS[i % CHART_COLORS.length]}
                              fill={CHART_COLORS[i % CHART_COLORS.length]}
                              fillOpacity={0.2}
                            />
                          ))}
                          <Legend />
                        </RadarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="commission" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Estrutura de Comissionamento</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <div className="h-[280px] sm:h-[350px] min-w-[560px] sm:min-w-0">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={commissionComparisonData()}>
                          <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                          <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                          <YAxis tick={{ fontSize: 11 }} />
                          <Tooltip />
                          <Legend />
                          <Bar dataKey="Papéis" fill={CHART_COLORS[2]} />
                          <Bar dataKey="Itens de Comissão" fill={CHART_COLORS[1]} />
                          <Bar dataKey="Considerações" fill={CHART_COLORS[0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="detail" className="mt-4">
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {selected.map((cs, i) => {
                  const funnel = (cs.sections.funnel_stages as FunnelStage[]) || [];
                  const kpis = cs.sections.kpis as KpisData | undefined;
                  const comm = cs.sections.commission as CommissionData | undefined;

                  return (
                    <Card key={cs.company.id} className="border-t-2" style={{ borderTopColor: CHART_COLORS[i % CHART_COLORS.length] }}>
                      <CardHeader>
                        <CardTitle className="text-base">{cs.company.name}</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3 text-xs">
                        <div>
                          <p className="font-semibold text-sm mb-1">📊 Resumo</p>
                          <p>Etapas do Funil: <strong>{funnel.length}</strong></p>
                          <p>KPIs BDR: <strong>{kpis?.bdr?.length || 0}</strong></p>
                          <p>KPIs AE: <strong>{kpis?.ae?.length || 0}</strong></p>
                          <p>KPIs CSM: <strong>{kpis?.csm?.length || 0}</strong></p>
                          <p>Papéis Comissionados: <strong>{comm?.roles?.length || 0}</strong></p>
                        </div>
                        <div>
                          <p className="font-semibold text-sm mb-1">🎯 Etapas</p>
                          {funnel.map((s, j) => (
                            <p key={j} className="text-muted-foreground">
                              {s.step}. {s.title} ({s.responsible})
                            </p>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </TabsContent>
          </Tabs>
        )}

        {selected.length < 2 && companyStructures.length > 0 && (
          <Card className="border-dashed border-primary/30 bg-primary/5">
            <CardContent className="p-6 text-center">
              <p className="text-sm text-muted-foreground">
                Selecione pelo menos <strong>2 empresas</strong> para visualizar o comparativo.
              </p>
            </CardContent>
          </Card>
        )}
      </motion.div>
    </EMSLayout>
  );
};

export default CommercialComparison;
