import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Activity, Save } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { toast } from "@/hooks/use-toast";

const today = new Date().toISOString().slice(0, 10);
const emptyForm = { checkin_date: today, energy: "3", workload: "3", focus: "3", mood: "estável", notes: "" };

const statusFor = (item?: any) => {
  if (!item) return { label: "Sem check-in", tone: "secondary" as const };
  if (Number(item.energy) <= 2 || Number(item.workload) >= 5) return { label: "Atenção", tone: "destructive" as const };
  if (Number(item.energy) >= 4 && Number(item.focus) >= 4) return { label: "Boa capacidade", tone: "default" as const };
  return { label: "Estável", tone: "secondary" as const };
};

export const CapacityCheckinPanel = ({ compact = false }: { compact?: boolean }) => {
  const { selectedCompanyId } = useCompany();
  const queryClient = useQueryClient();
  const [form, setForm] = useState(emptyForm);
  const hasCompanyFilter = selectedCompanyId !== "all";

  const { data: checkins = [] } = useQuery({
    queryKey: ["capacity-checkins", selectedCompanyId],
    staleTime: 1000 * 60,
    queryFn: async () => {
      let q = (supabase as any)
        .from("capacity_checkins")
        .select("*")
        .order("checkin_date", { ascending: false })
        .limit(compact ? 3 : 8);
      if (hasCompanyFilter) q = q.eq("company_id", selectedCompanyId);
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
  });

  const latest = checkins[0];
  const status = statusFor(latest);

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await (supabase as any).from("capacity_checkins").insert({
        checkin_date: form.checkin_date,
        energy: Number(form.energy),
        workload: Number(form.workload),
        focus: Number(form.focus),
        mood: form.mood || null,
        notes: form.notes || null,
        company_id: hasCompanyFilter ? selectedCompanyId : null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["capacity-checkins"] });
      toast({ title: "Check-in salvo" });
    },
    onError: (error: any) => toast({ title: "Erro ao salvar capacidade", description: error?.message, variant: "destructive" }),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Activity className="h-4 w-4 text-primary" /> Capacidade Humana
          <Badge variant={status.tone} className="ml-auto">{status.label}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {!compact && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <Input type="date" value={form.checkin_date} onChange={(e) => setForm({ ...form, checkin_date: e.target.value })} />
              <Select value={form.energy} onValueChange={(value) => setForm({ ...form, energy: value })}>
                <SelectTrigger><SelectValue placeholder="Energia" /></SelectTrigger>
                <SelectContent>{[1, 2, 3, 4, 5].map((n) => <SelectItem key={n} value={String(n)}>Energia {n}</SelectItem>)}</SelectContent>
              </Select>
              <Select value={form.workload} onValueChange={(value) => setForm({ ...form, workload: value })}>
                <SelectTrigger><SelectValue placeholder="Carga" /></SelectTrigger>
                <SelectContent>{[1, 2, 3, 4, 5].map((n) => <SelectItem key={n} value={String(n)}>Carga {n}</SelectItem>)}</SelectContent>
              </Select>
              <Select value={form.focus} onValueChange={(value) => setForm({ ...form, focus: value })}>
                <SelectTrigger><SelectValue placeholder="Foco" /></SelectTrigger>
                <SelectContent>{[1, 2, 3, 4, 5].map((n) => <SelectItem key={n} value={String(n)}>Foco {n}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <Input placeholder="Humor operacional" value={form.mood} onChange={(e) => setForm({ ...form, mood: e.target.value })} />
            <Textarea placeholder="Observação rápida" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            <Button onClick={() => save.mutate()} disabled={save.isPending} className="w-full">
              <Save className="h-4 w-4 mr-2" /> Salvar check-in
            </Button>
          </div>
        )}

        <div className="space-y-2">
          {checkins.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Sem check-ins ainda.</p>
          ) : checkins.map((item: any) => (
            <div key={item.id} className="rounded-lg border p-2 text-xs flex items-center justify-between gap-2">
              <span>{new Date(`${item.checkin_date}T12:00:00`).toLocaleDateString("pt-BR")}</span>
              <span className="text-muted-foreground">Energia {item.energy} · Carga {item.workload} · Foco {item.focus}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};
