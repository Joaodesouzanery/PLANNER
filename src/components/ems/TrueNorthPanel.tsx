import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Compass, Save, Target } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { toast } from "@/hooks/use-toast";

export const TrueNorthPanel = ({ compact = false }: { compact?: boolean }) => {
  const { selectedCompanyId } = useCompany();
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ vision: "", three_year_goal: "", values: "", decision_principles: "", current_focus: "" });
  const hasCompanyFilter = selectedCompanyId !== "all";

  const { data: north = null } = useQuery({
    queryKey: ["true-north", selectedCompanyId],
    staleTime: 1000 * 60 * 5,
    queryFn: async () => {
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      let q = (supabase as any)
        .from("true_north")
        .select("*")
        .eq("user_id", userData.user.id)
        .order("updated_at", { ascending: false })
        .limit(1);
      q = hasCompanyFilter ? q.eq("company_id", selectedCompanyId) : q.is("company_id", null);
      const { data, error } = await q;
      if (error) throw error;
      return data?.[0] || null;
    },
  });

  useEffect(() => {
    setForm({
      vision: north?.vision || "",
      three_year_goal: north?.three_year_goal || "",
      values: (north?.values || []).join("\n"),
      decision_principles: (north?.decision_principles || []).join("\n"),
      current_focus: north?.current_focus || "",
    });
  }, [north]);

  const save = useMutation({
    mutationFn: async () => {
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      const payload = {
        user_id: userData.user.id,
        vision: form.vision || null,
        three_year_goal: form.three_year_goal || null,
        values: form.values.split("\n").map((v) => v.trim()).filter(Boolean),
        decision_principles: form.decision_principles.split("\n").map((v) => v.trim()).filter(Boolean),
        current_focus: form.current_focus || null,
        company_id: hasCompanyFilter ? selectedCompanyId : null,
      };
      const query = (supabase as any).from("true_north");
      const { error } = north?.id ? await query.update(payload).eq("id", north.id) : await query.insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["true-north"] });
      toast({ title: "Norte Verdadeiro atualizado" });
    },
    onError: (error: any) => toast({ title: "Erro ao salvar Norte", description: error?.message, variant: "destructive" }),
  });

  const values = form.values.split("\n").map((v) => v.trim()).filter(Boolean);
  const principles = form.decision_principles.split("\n").map((v) => v.trim()).filter(Boolean);

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Compass className="h-5 w-5 text-primary" /> Norte Verdadeiro
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {compact ? (
          <>
            <div>
              <p className="text-xs text-muted-foreground">Foco atual</p>
              <p className="font-semibold">{form.current_focus || "Defina o foco que orienta as decisões."}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Visão de 3 anos</p>
              <p className="text-sm">{form.three_year_goal || "Ainda não definida."}</p>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {principles.slice(0, 4).map((principle) => <Badge key={principle} variant="outline" className="text-[10px]">{principle}</Badge>)}
            </div>
          </>
        ) : (
          <>
            <Input placeholder="Foco atual" value={form.current_focus} onChange={(e) => setForm({ ...form, current_focus: e.target.value })} />
            <Textarea placeholder="Visão" value={form.vision} onChange={(e) => setForm({ ...form, vision: e.target.value })} />
            <Textarea placeholder="Objetivo de 3 anos" value={form.three_year_goal} onChange={(e) => setForm({ ...form, three_year_goal: e.target.value })} />
            <div className="grid gap-3 md:grid-cols-2">
              <Textarea placeholder="Valores, um por linha" value={form.values} onChange={(e) => setForm({ ...form, values: e.target.value })} />
              <Textarea placeholder="Princípios de decisão, um por linha" value={form.decision_principles} onChange={(e) => setForm({ ...form, decision_principles: e.target.value })} />
            </div>
            <Button onClick={() => save.mutate()} disabled={save.isPending}>
              <Save className="h-4 w-4 mr-2" /> Salvar Norte
            </Button>
          </>
        )}
        {!compact && values.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            <Target className="h-4 w-4 text-primary" />
            {values.map((value) => <Badge key={value} variant="secondary" className="text-[10px]">{value}</Badge>)}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
