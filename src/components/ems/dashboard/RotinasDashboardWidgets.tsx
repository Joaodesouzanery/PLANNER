import { useMemo } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle, ArrowUpRight, ListChecks, Clock } from "lucide-react";
import { useRotinas } from "@/hooks/useRotinas";

const boardUrl = (clientId?: string) =>
  clientId ? `/ems/board?tab=rotinas&client=${clientId}` : "/ems/board?tab=rotinas";

export const RotinasDashboardWidgets = () => {
  const { isLoading, clients, clientViews } = useRotinas();

  const summary = useMemo(() => {
    return clients.map((c) => {
      const view = clientViews.get(c.id);
      if (!view) return null;
      const totalChecks = view.conferenciaProgress.total + view.tarefaProgress.total;
      const doneChecks = view.conferenciaProgress.done + view.tarefaProgress.done;
      const pct = totalChecks > 0 ? Math.round((doneChecks / totalChecks) * 100) : 0;
      const criticalOpen = view.openTasks.filter((t) => t.priority === "high" || t.priority === "urgent").length;
      return { client: c, pct, openTasks: view.openTasks.length, criticalOpen, daysInvoice: view.daysUntilInvoice };
    }).filter(Boolean) as Array<{ client: typeof clients[number]; pct: number; openTasks: number; criticalOpen: number; daysInvoice: number | null }>;
  }, [clients, clientViews]);

  const criticalTasks = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const list: Array<{ id: string; title: string; clientId: string; clientName: string; due: string | null; priority: string; overdue: boolean }> = [];
    clients.forEach((c) => {
      const v = clientViews.get(c.id);
      if (!v) return;
      v.openTasks.forEach((t) => {
        const overdue = !!t.due_date && t.due_date < today;
        const critical = t.priority === "high" || t.priority === "urgent" || overdue;
        if (critical) list.push({ id: t.id, title: t.title, clientId: c.id, clientName: c.name, due: t.due_date, priority: t.priority, overdue });
      });
    });
    return list
      .sort((a, b) => (a.due ?? "9999").localeCompare(b.due ?? "9999"))
      .slice(0, 8);
  }, [clients, clientViews]);

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><ListChecks className="h-4 w-4 text-primary" />Rotinas (Conselho)</CardTitle></CardHeader>
        <CardContent><div className="grid gap-2 sm:grid-cols-3"><Skeleton className="h-20" /><Skeleton className="h-20" /><Skeleton className="h-20" /></div></CardContent>
      </Card>
    );
  }

  if (clients.length === 0) return null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <Card className="lg:col-span-2">
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2"><ListChecks className="h-4 w-4 text-primary" />Rotinas — visão por cliente</CardTitle>
          <Button asChild variant="ghost" size="sm" className="h-7 gap-1 text-xs">
            <Link to={boardUrl()}>Abrir Conselho <ArrowUpRight className="h-3 w-3" /></Link>
          </Button>
        </CardHeader>
        <CardContent className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {summary.length === 0 ? (
            <p className="text-xs text-muted-foreground col-span-full py-4 text-center">Nenhum cliente com rotina configurada.</p>
          ) : summary.map((s) => (
            <Link key={s.client.id} to={boardUrl(s.client.id)} className="block rounded-lg border border-border/50 p-3 hover:border-primary/40 transition-colors bg-card/40">
              <div className="flex items-start justify-between gap-2 mb-1.5">
                <p className="text-sm font-medium truncate">{s.client.name}</p>
                {s.criticalOpen > 0 && <Badge variant="destructive" className="text-[10px] gap-1 shrink-0"><AlertTriangle className="h-3 w-3" />{s.criticalOpen}</Badge>}
              </div>
              <Progress value={s.pct} className="h-1.5 mb-1.5" />
              <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                <span>{s.pct}% hoje</span>
                <span>{s.openTasks} abertas</span>
              </div>
              {s.daysInvoice != null && s.daysInvoice <= 7 && (
                <p className="mt-1 text-[10px] text-amber-500 flex items-center gap-1"><Clock className="h-3 w-3" />NF em {s.daysInvoice}d</p>
              )}
            </Link>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-destructive" />Tarefas críticas</CardTitle>
          <Badge variant="outline" className="text-[10px]">{criticalTasks.length}</Badge>
        </CardHeader>
        <CardContent className="space-y-1.5">
          {criticalTasks.length === 0 ? (
            <p className="text-xs text-muted-foreground py-4 text-center">Sem tarefas críticas. ✨</p>
          ) : criticalTasks.map((t) => (
            <Link key={t.id} to={boardUrl(t.clientId)} className="block rounded-md border border-border/40 p-2 hover:border-primary/40 transition-colors bg-card/30">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-medium truncate flex-1">{t.title}</p>
                {t.overdue && <Badge variant="destructive" className="text-[10px] shrink-0">Atrasada</Badge>}
              </div>
              <p className="text-[10px] text-muted-foreground mt-0.5 truncate">{t.clientName}{t.due ? ` · vence ${t.due.split("-").reverse().join("/")}` : ""}</p>
            </Link>
          ))}
        </CardContent>
      </Card>
    </div>
  );
};
