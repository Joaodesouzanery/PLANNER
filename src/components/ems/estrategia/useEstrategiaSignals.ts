import { useMemo } from "react";
import { format } from "date-fns";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { useFinMetrics } from "./useFinMetrics";
import type { FinMetrics } from "./estrategiaProgress";

// Estratégia · sinais de TODOS os módulos (não só Finanças).
// Vira o `extras` do motor de progresso: qualquer KR/Objetivo pode usar essas métricas
// pelo nome (ex.: métrica "projetos_ativos", "tarefas_concluidas_mes", "pipeline_valor").
const db = supabase as any;
const safe = async (build: () => any): Promise<any[]> => {
  try {
    const { data, error } = await build();
    if (error) return [];
    return data ?? [];
  } catch {
    return [];
  }
};

export interface EstrategiaSignals {
  fin: FinMetrics;
  metrics: Record<string, number>;
  isLoading: boolean;
  /** Blocos por módulo para o cockpit. */
  modules: {
    key: string;
    label: string;
    items: { label: string; value: string; alert?: boolean }[];
  }[];
}

const num = (v: unknown) => Number(v) || 0;

export const useEstrategiaSignals = (): EstrategiaSignals => {
  const { selectedCompanyId } = useCompany();
  const scoped = selectedCompanyId && selectedCompanyId !== "all";
  const co = (q: any) => (scoped ? q.eq("company_id", selectedCompanyId) : q);
  const fin = useFinMetrics();

  const today = format(new Date(), "yyyy-MM-dd");
  const monthStart = `${today.slice(0, 7)}-01`;

  const query = useQuery({
    queryKey: ["estrategia-signals", selectedCompanyId, today],
    staleTime: 60_000,
    queryFn: async () => {
      const [projects, tasks, opps, entries, atividades, contacts] = await Promise.all([
        safe(() => co(db.from("projects").select("id,status,due_date"))),
        safe(() => co(db.from("tasks").select("id,status,due_date,completed_at"))),
        safe(() => co(db.from("project_opportunities").select("id,status,estimated_value,due_date"))),
        safe(() => co(db.from("time_entries").select("hours,date").gte("date", monthStart))),
        safe(() => co(db.from("crm_atividades").select("id,status,data_prevista"))),
        safe(() => co(db.from("contacts").select("id,relationship_stage,pipeline_stage"))),
      ]);
      return { projects, tasks, opps, entries, atividades, contacts };
    },
  });

  const d = query.data ?? { projects: [], tasks: [], opps: [], entries: [], atividades: [], contacts: [] };

  return useMemo<EstrategiaSignals>(() => {
    const projetosAtivos = d.projects.filter((p: any) => p.status === "in_progress" || p.status === "active").length;
    const projetosConcluidos = d.projects.filter((p: any) => p.status === "done" || p.status === "completed").length;

    const tarefasAbertas = d.tasks.filter((t: any) => t.status !== "done" && t.status !== "completed").length;
    const tarefasAtrasadas = d.tasks.filter(
      (t: any) => t.status !== "done" && t.status !== "completed" && t.due_date && t.due_date < today,
    ).length;
    const tarefasConcluidasMes = d.tasks.filter((t: any) => t.completed_at && String(t.completed_at).slice(0, 10) >= monthStart).length;

    const oportunidadesAbertas = d.opps.filter((o: any) => o.status !== "won" && o.status !== "lost").length;
    const pipelineValor = d.opps
      .filter((o: any) => o.status !== "won" && o.status !== "lost")
      .reduce((a: number, o: any) => a + num(o.estimated_value), 0);
    const ganhosValor = d.opps.filter((o: any) => o.status === "won").reduce((a: number, o: any) => a + num(o.estimated_value), 0);

    const horasMes = d.entries.reduce((a: number, e: any) => a + num(e.hours), 0);
    const atividadesPendentes = d.atividades.filter((a: any) => a.status !== "feito" && a.status !== "done").length;
    const atividadesAtrasadas = d.atividades.filter(
      (a: any) => a.status !== "feito" && a.status !== "done" && a.data_prevista && String(a.data_prevista).slice(0, 10) < today,
    ).length;
    const contatosTotal = d.contacts.length;

    const metrics: Record<string, number> = {
      projetos_ativos: projetosAtivos,
      projetos_concluidos: projetosConcluidos,
      tarefas_abertas: tarefasAbertas,
      tarefas_atrasadas: tarefasAtrasadas,
      tarefas_concluidas_mes: tarefasConcluidasMes,
      oportunidades_abertas: oportunidadesAbertas,
      pipeline_valor: pipelineValor,
      ganhos_valor: ganhosValor,
      horas_mes: horasMes,
      atividades_pendentes: atividadesPendentes,
      atividades_atrasadas: atividadesAtrasadas,
      contatos: contatosTotal,
    };

    const money = (v: number) => `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    return {
      fin: { ...fin, extras: metrics },
      metrics,
      isLoading: query.isLoading,
      modules: [
        {
          key: "financas",
          label: "Finanças",
          items: [
            { label: "MRR", value: money(fin.mrr) },
            { label: "Sobra mensal", value: money(fin.sobra), alert: fin.sobra < 0 },
            { label: "Reserva", value: money(fin.reserva) },
            { label: "Patrimônio", value: money(fin.patrimonio) },
          ],
        },
        {
          key: "comercial",
          label: "Comercial & CRM",
          items: [
            { label: "Oportunidades abertas", value: String(oportunidadesAbertas) },
            { label: "Pipeline", value: money(pipelineValor) },
            { label: "Ganhos", value: money(ganhosValor) },
            { label: "Atividades atrasadas", value: String(atividadesAtrasadas), alert: atividadesAtrasadas > 0 },
          ],
        },
        {
          key: "execucao",
          label: "Projetos & Execução",
          items: [
            { label: "Projetos ativos", value: String(projetosAtivos) },
            { label: "Tarefas abertas", value: String(tarefasAbertas) },
            { label: "Tarefas atrasadas", value: String(tarefasAtrasadas), alert: tarefasAtrasadas > 0 },
            { label: "Concluídas no mês", value: String(tarefasConcluidasMes) },
          ],
        },
        {
          key: "capacidade",
          label: "Tempo & Relacionamento",
          items: [
            { label: "Horas no mês", value: horasMes.toLocaleString("pt-BR") },
            { label: "Atividades pendentes", value: String(atividadesPendentes) },
            { label: "Contatos na base", value: String(contatosTotal) },
          ],
        },
      ],
    };
  }, [d, fin, query.isLoading, today, monthStart]);
};
