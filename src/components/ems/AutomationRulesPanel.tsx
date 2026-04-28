import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Play, Save, Zap } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { toast } from "@/hooks/use-toast";

const emptyRule = {
  name: "Contrato vencendo em 30 dias",
  description: "Cria uma tarefa e alerta no Daily quando um contrato estiver perto do vencimento.",
  trigger_type: "document_expiry",
  days: "30",
  document_type: "contract",
  action_type: "create_task_daily_alert",
};

export const AutomationRulesPanel = () => {
  const { selectedCompanyId } = useCompany();
  const queryClient = useQueryClient();
  const [form, setForm] = useState(emptyRule);
  const hasCompanyFilter = selectedCompanyId !== "all";

  const { data: rules = [] } = useQuery({
    queryKey: ["automation-rules", selectedCompanyId],
    staleTime: 1000 * 60 * 2,
    queryFn: async () => {
      let q = (supabase as any).from("automation_rules").select("*").order("created_at", { ascending: false });
      if (hasCompanyFilter) q = q.eq("company_id", selectedCompanyId);
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
  });

  const { data: events = [] } = useQuery({
    queryKey: ["automation-events", selectedCompanyId],
    staleTime: 1000 * 60,
    queryFn: async () => {
      let q = (supabase as any).from("automation_events").select("*").order("created_at", { ascending: false }).limit(10);
      if (hasCompanyFilter) q = q.eq("company_id", selectedCompanyId);
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
  });

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await (supabase as any).from("automation_rules").insert({
        name: form.name,
        description: form.description || null,
        trigger_type: form.trigger_type,
        conditions: { days: Number(form.days), document_type: form.document_type },
        action_type: form.action_type,
        action_payload: { task_priority: "high", surface: "daily_report" },
        enabled: true,
        company_id: hasCompanyFilter ? selectedCompanyId : null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["automation-rules"] });
      toast({ title: "Regra de automação criada" });
    },
    onError: (error: any) => toast({ title: "Erro ao criar regra", description: error?.message, variant: "destructive" }),
  });

  const logEvent = useMutation({
    mutationFn: async (rule: any) => {
      const { error } = await (supabase as any).from("automation_events").insert({
        rule_id: rule.id,
        source_type: "manual_simulation",
        action_type: rule.action_type,
        status: "logged",
        result: "Simulação registrada. A regra fica pronta para execução por rotina futura.",
        company_id: hasCompanyFilter ? selectedCompanyId : null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["automation-events"] });
      toast({ title: "Evento registrado" });
    },
  });

  return (
    <div className="grid gap-4 xl:grid-cols-[0.85fr_1.15fr]">
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><Zap className="h-4 w-4 text-primary" /> Nova regra</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Nome da regra" />
          <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Descrição" />
          <div className="grid grid-cols-2 gap-2">
            <Select value={form.trigger_type} onValueChange={(value) => setForm({ ...form, trigger_type: value })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="document_expiry">Documento vencendo</SelectItem>
                <SelectItem value="status_change">Mudança de status</SelectItem>
                <SelectItem value="date_window">Janela de data</SelectItem>
              </SelectContent>
            </Select>
            <Input type="number" min={1} value={form.days} onChange={(e) => setForm({ ...form, days: e.target.value })} />
            <Select value={form.document_type} onValueChange={(value) => setForm({ ...form, document_type: value })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="contract">Contrato</SelectItem>
                <SelectItem value="invoice">Nota fiscal</SelectItem>
                <SelectItem value="legal">Jurídico</SelectItem>
                <SelectItem value="accounting">Contábil</SelectItem>
              </SelectContent>
            </Select>
            <Select value={form.action_type} onValueChange={(value) => setForm({ ...form, action_type: value })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="create_task_daily_alert">Tarefa + Daily</SelectItem>
                <SelectItem value="daily_alert">Somente Daily</SelectItem>
                <SelectItem value="log_event">Somente log</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button onClick={() => save.mutate()} disabled={!form.name.trim() || save.isPending} className="w-full">
            <Save className="h-4 w-4 mr-2" /> Salvar regra
          </Button>
        </CardContent>
      </Card>

      <div className="space-y-4">
        <Card>
          <CardHeader><CardTitle className="text-base">Regras ativas</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {rules.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">Nenhuma regra criada.</p>
            ) : rules.map((rule: any) => (
              <div key={rule.id} className="rounded-lg border p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold">{rule.name}</p>
                    {rule.description && <p className="text-xs text-muted-foreground">{rule.description}</p>}
                  </div>
                  <Badge variant={rule.enabled ? "default" : "secondary"}>{rule.enabled ? "Ativa" : "Pausada"}</Badge>
                </div>
                <Button variant="outline" size="sm" className="h-8 mt-3" onClick={() => logEvent.mutate(rule)}>
                  <Play className="h-3.5 w-3.5 mr-1" /> Simular registro
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Histórico</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {events.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">Sem eventos de automação.</p>
            ) : events.map((event: any) => (
              <div key={event.id} className="rounded border p-2 text-xs">
                <div className="flex justify-between gap-2"><strong>{event.action_type}</strong><span>{new Date(event.created_at).toLocaleDateString("pt-BR")}</span></div>
                {event.result && <p className="text-muted-foreground mt-1">{event.result}</p>}
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
