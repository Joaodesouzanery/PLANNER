import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarClock, Save, Scale } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { toast } from "@/hooks/use-toast";

const emptyForm = {
  title: "",
  context: "",
  options_considered: "",
  decision: "",
  expected_result: "",
  review_date: "",
  outcome: "",
};

const dateLabel = (date?: string | null) => {
  if (!date) return "Sem revisão";
  const [year, month, day] = date.slice(0, 10).split("-");
  return year && month && day ? `${day}/${month}/${year}` : date;
};

export const DecisionLogPanel = ({ compact = false }: { compact?: boolean }) => {
  const { selectedCompanyId } = useCompany();
  const queryClient = useQueryClient();
  const [form, setForm] = useState(emptyForm);
  const hasCompanyFilter = selectedCompanyId !== "all";

  const { data: decisions = [] } = useQuery({
    queryKey: ["decision-logs", selectedCompanyId],
    staleTime: 1000 * 60 * 2,
    queryFn: async () => {
      let q = (supabase as any)
        .from("decision_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(compact ? 5 : 12);
      if (hasCompanyFilter) q = q.eq("company_id", selectedCompanyId);
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
  });

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await (supabase as any).from("decision_logs").insert({
        ...form,
        context: form.context || null,
        options_considered: form.options_considered || null,
        decision: form.decision || null,
        expected_result: form.expected_result || null,
        review_date: form.review_date || null,
        outcome: form.outcome || null,
        company_id: hasCompanyFilter ? selectedCompanyId : null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["decision-logs"] });
      setForm(emptyForm);
      toast({ title: "Decisão registrada" });
    },
    onError: (error: any) => toast({ title: "Erro ao registrar decisão", description: error?.message, variant: "destructive" }),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Scale className="h-4 w-4 text-primary" /> Diário de Decisões
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {!compact && (
          <div className="space-y-3">
            <Input placeholder="Decisão ou tema" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            <Textarea placeholder="Contexto" value={form.context} onChange={(e) => setForm({ ...form, context: e.target.value })} />
            <Textarea placeholder="Opções consideradas" value={form.options_considered} onChange={(e) => setForm({ ...form, options_considered: e.target.value })} />
            <Textarea placeholder="Decisão tomada" value={form.decision} onChange={(e) => setForm({ ...form, decision: e.target.value })} />
            <div className="grid sm:grid-cols-[1fr_160px] gap-2">
              <Input placeholder="Resultado esperado / hipótese" value={form.expected_result} onChange={(e) => setForm({ ...form, expected_result: e.target.value })} />
              <Input type="date" value={form.review_date} onChange={(e) => setForm({ ...form, review_date: e.target.value })} />
            </div>
            <Button onClick={() => save.mutate()} disabled={!form.title.trim() || save.isPending} className="w-full">
              <Save className="h-4 w-4 mr-2" /> Registrar decisão
            </Button>
          </div>
        )}

        <div className="space-y-2">
          {decisions.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">Nenhuma decisão registrada.</p>
          ) : decisions.map((item: any) => (
            <div key={item.id} className="rounded-lg border p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold truncate">{item.title}</p>
                  {item.decision && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{item.decision}</p>}
                </div>
                <Badge variant="outline" className="text-[10px] gap-1 shrink-0">
                  <CalendarClock className="h-3 w-3" /> {dateLabel(item.review_date)}
                </Badge>
              </div>
              {item.expected_result && <p className="text-xs mt-2"><span className="font-medium">Hipótese:</span> {item.expected_result}</p>}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};
