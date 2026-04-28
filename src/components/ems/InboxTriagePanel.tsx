import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Archive, CheckCircle2, FileText, FolderKanban, Inbox, ListTodo, Scale } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { toast } from "@/hooks/use-toast";

type TargetType = "task" | "project" | "governance" | "decision" | "note";

const targetConfig: Record<TargetType, { label: string; icon: any }> = {
  task: { label: "Tarefa", icon: ListTodo },
  project: { label: "Projeto", icon: FolderKanban },
  governance: { label: "Conselho", icon: FileText },
  decision: { label: "Decisão", icon: Scale },
  note: { label: "Nota", icon: Archive },
};

export const InboxTriagePanel = ({ compact = false }: { compact?: boolean }) => {
  const { selectedCompanyId } = useCompany();
  const queryClient = useQueryClient();
  const [triagingId, setTriagingId] = useState<string | null>(null);
  const hasCompanyFilter = selectedCompanyId !== "all";

  const { data: items = [] } = useQuery({
    queryKey: ["unified-inbox", selectedCompanyId],
    staleTime: 1000 * 30,
    queryFn: async () => {
      let q = (supabase as any)
        .from("unified_inbox")
        .select("*")
        .neq("status", "triaged")
        .order("created_at", { ascending: false })
        .limit(compact ? 5 : 20);
      if (hasCompanyFilter) q = q.eq("company_id", selectedCompanyId);
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
  });

  const triage = useMutation({
    mutationFn: async ({ item, target }: { item: any; target: TargetType }) => {
      let targetId: string | null = null;
      const company_id = hasCompanyFilter ? selectedCompanyId : null;

      if (target === "task") {
        const { data, error } = await (supabase as any).from("tasks").insert({
          title: item.title,
          description: item.content || null,
          priority: item.priority || "medium",
          due_date: item.due_date || null,
          status: "pending",
          company_id,
        }).select("id").single();
        if (error) throw error;
        targetId = data?.id || null;
      } else if (target === "project") {
        const { data, error } = await (supabase as any).from("projects").insert({
          title: item.title,
          description: item.content || null,
          due_date: item.due_date || null,
          priority: item.priority || "medium",
          status: "todo",
          company_id,
        }).select("id").single();
        if (error) throw error;
        targetId = data?.id || null;
      } else if (target === "governance") {
        const { data, error } = await (supabase as any).from("governance_items").insert({
          category: "admin",
          title: item.title,
          description: item.content || null,
          priority: item.priority || "medium",
          due_date: item.due_date || null,
          status: "open",
          company_id,
        }).select("id").single();
        if (error) throw error;
        targetId = data?.id || null;
      } else if (target === "decision") {
        const { data, error } = await (supabase as any).from("decision_logs").insert({
          title: item.title,
          context: item.content || null,
          review_date: item.due_date || null,
          company_id,
        }).select("id").single();
        if (error) throw error;
        targetId = data?.id || null;
      } else {
        const { data, error } = await (supabase as any).from("quick_notes").insert({
          content: `${item.title}${item.content ? `\n\n${item.content}` : ""}`,
          company_id,
        }).select("id").single();
        if (error) throw error;
        targetId = data?.id || null;
      }

      const { error } = await (supabase as any).from("unified_inbox").update({
        status: "triaged",
        target_type: target,
        target_id: targetId,
        triaged_at: new Date().toISOString(),
      }).eq("id", item.id);
      if (error) throw error;
    },
    onMutate: ({ item }) => setTriagingId(item.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["unified-inbox"] });
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      queryClient.invalidateQueries({ queryKey: ["governance-items"] });
      queryClient.invalidateQueries({ queryKey: ["decision-logs"] });
      toast({ title: "Item triado" });
    },
    onError: (error: any) => toast({ title: "Erro ao triar", description: error?.message, variant: "destructive" }),
    onSettled: () => setTriagingId(null),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Inbox className="h-4 w-4 text-primary" /> Inbox Unificado
          <Badge variant="secondary" className="ml-auto">{items.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">Inbox limpo.</p>
        ) : items.map((item: any) => (
          <div key={item.id} className="rounded-lg border p-3 space-y-2">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold truncate">{item.title}</p>
                {item.content && <p className="text-xs text-muted-foreground line-clamp-2">{item.content}</p>}
              </div>
              <Badge variant="outline" className="text-[10px] shrink-0">{item.priority}</Badge>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {(Object.keys(targetConfig) as TargetType[]).map((target) => {
                const Icon = targetConfig[target].icon;
                return (
                  <Button key={target} variant="outline" size="sm" className="h-7 text-[11px]" disabled={triagingId === item.id} onClick={() => triage.mutate({ item, target })}>
                    {target === "task" && triagingId === item.id ? <CheckCircle2 className="h-3 w-3 mr-1" /> : <Icon className="h-3 w-3 mr-1" />}
                    {targetConfig[target].label}
                  </Button>
                );
              })}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
};
