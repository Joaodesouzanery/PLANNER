import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarClock, Save } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { useToast } from "@/hooks/use-toast";
import { dateLabel, today } from "./boardShared";

const CYCLE_OPTIONS = [
  { value: "monthly", label: "Mensal" },
  { value: "quarterly", label: "Trimestral" },
  { value: "annual", label: "Anual" },
];

const emptyReview = {
  cycle_type: "monthly", period_start: today(), period_end: today(),
  agenda: "", summary: "", decisions: "", next_actions: "",
};

export const MeetingsPanel = () => {
  const { selectedCompanyId } = useCompany();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [form, setForm] = useState(emptyReview);
  const hasCompanyFilter = selectedCompanyId !== "all";
  const companyFilter = (query: any) => hasCompanyFilter ? query.eq("company_id", selectedCompanyId) : query;

  const { data: reviews = [] } = useQuery({
    queryKey: ["review-cycles-board", selectedCompanyId],
    staleTime: 1000 * 60 * 2,
    queryFn: async () => {
      let q = (supabase as any).from("review_cycles").select("*")
        .in("cycle_type", ["monthly", "quarterly", "annual"])
        .order("period_start", { ascending: false }).limit(16);
      const { data, error } = await companyFilter(q);
      if (error) throw error;
      return data || [];
    },
  });

  const saveReview = useMutation({
    mutationFn: async () => {
      const { error } = await (supabase as any).from("review_cycles").insert({
        cycle_type: form.cycle_type,
        period_start: form.period_start,
        period_end: form.period_end,
        agenda: form.agenda || null,
        summary: form.summary || null,
        decisions: form.decisions || null,
        next_actions: form.next_actions || null,
        company_id: hasCompanyFilter ? selectedCompanyId : null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["review-cycles-board"] });
      queryClient.invalidateQueries({ queryKey: ["review-cycles"] });
      setForm(emptyReview);
      toast({ title: "Reunião registrada" });
    },
    onError: (error: any) => toast({ title: "Erro ao salvar reunião", description: error?.message, variant: "destructive" }),
  });

  const cycleLabel = (value: string) => CYCLE_OPTIONS.find((o) => o.value === value)?.label || value;

  return (
    <div className="grid gap-4 xl:grid-cols-[0.85fr_1.15fr]">
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><CalendarClock className="h-4 w-4 text-primary" /> Nova reunião do Conselho</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Select value={form.cycle_type} onValueChange={(v) => setForm({ ...form, cycle_type: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{CYCLE_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
          </Select>
          <div className="grid grid-cols-2 gap-2">
            <Input type="date" value={form.period_start} onChange={(e) => setForm({ ...form, period_start: e.target.value })} />
            <Input type="date" value={form.period_end} onChange={(e) => setForm({ ...form, period_end: e.target.value })} />
          </div>
          <Textarea placeholder="Pauta estratégica" value={form.agenda} onChange={(e) => setForm({ ...form, agenda: e.target.value })} />
          <Textarea placeholder="Resumo da situação" value={form.summary} onChange={(e) => setForm({ ...form, summary: e.target.value })} />
          <Textarea placeholder="Decisões tomadas" value={form.decisions} onChange={(e) => setForm({ ...form, decisions: e.target.value })} />
          <Textarea placeholder="Próximas ações" value={form.next_actions} onChange={(e) => setForm({ ...form, next_actions: e.target.value })} />
          <Button onClick={() => saveReview.mutate()} disabled={saveReview.isPending} className="w-full">
            <Save className="h-4 w-4 mr-2" /> Registrar reunião
          </Button>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Atas e memória das reuniões</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {reviews.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">Nenhuma reunião registrada.</p>
          ) : reviews.map((review: any) => (
            <div key={review.id} className="rounded-lg border p-3">
              <div className="flex justify-between gap-2 text-sm">
                <strong>{dateLabel(review.period_start)} - {dateLabel(review.period_end)}</strong>
                <Badge variant="secondary">{cycleLabel(review.cycle_type)}</Badge>
              </div>
              {review.agenda && <p className="text-xs mt-2"><span className="font-medium">Pauta:</span> {review.agenda}</p>}
              {review.summary && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{review.summary}</p>}
              {review.decisions && <p className="text-xs mt-2"><span className="font-medium">Decisões:</span> {review.decisions}</p>}
              {review.next_actions && <p className="text-xs mt-1"><span className="font-medium">Ações:</span> {review.next_actions}</p>}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
};
