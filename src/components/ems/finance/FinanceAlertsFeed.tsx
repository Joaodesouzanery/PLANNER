import { useState } from "react";
import { Bell, X, AlertTriangle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useFinanceAlerts } from "./useFinanceAlerts";
import type { Severity } from "./financeAlerts";

const KEY = "finance-alerts-dismissed";
const load = (): Set<string> => {
  try { return new Set<string>(JSON.parse(localStorage.getItem(KEY) || "[]")); } catch { return new Set<string>(); }
};

const sevStyle: Record<Severity, string> = {
  high: "border-destructive/30 bg-destructive/5",
  medium: "border-amber-500/30 bg-amber-500/5",
  low: "border-border/50 bg-muted/20",
};
const sevIcon: Record<Severity, string> = { high: "text-destructive", medium: "text-amber-500", low: "text-muted-foreground" };

export const FinanceAlertsFeed = () => {
  const { alerts } = useFinanceAlerts();
  const [dismissed, setDismissed] = useState<Set<string>>(load);
  const visible = alerts.filter((a) => !dismissed.has(a.key));

  const dismiss = (k: string) => setDismissed((prev) => {
    const n = new Set(prev); n.add(k);
    try { localStorage.setItem(KEY, JSON.stringify([...n])); } catch { /* noop */ }
    return n;
  });

  if (visible.length === 0) return null;

  return (
    <Card className="border-border/50">
      <CardContent className="p-3 space-y-1.5">
        <p className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
          <Bell className="h-3.5 w-3.5" />Alertas
          <span className="rounded-full bg-primary/15 text-primary px-1.5 text-[10px] font-mono">{visible.length}</span>
        </p>
        {visible.map((a) => (
          <div key={a.key} className={cn("flex items-center gap-2 rounded-lg border p-2 text-xs", sevStyle[a.severity])}>
            <AlertTriangle className={cn("h-3.5 w-3.5 shrink-0", sevIcon[a.severity])} />
            <span className="flex-1">{a.message}</span>
            <button onClick={() => dismiss(a.key)} className="text-muted-foreground hover:text-foreground shrink-0" title="Dispensar"><X className="h-3.5 w-3.5" /></button>
          </div>
        ))}
      </CardContent>
    </Card>
  );
};

export default FinanceAlertsFeed;
