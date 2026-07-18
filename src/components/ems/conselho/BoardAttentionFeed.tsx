import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useBoardAttention } from "./useBoardAttention";
import type { Modulo, Sev } from "./boardAttention";

const KEY = "board-attention-dismissed";
const load = (): Set<string> => {
  try { return new Set<string>(JSON.parse(localStorage.getItem(KEY) || "[]")); } catch { return new Set<string>(); }
};

const sevStyle: Record<Sev, string> = {
  red: "border-red-500/30 bg-red-500/5",
  yellow: "border-amber-500/30 bg-amber-500/5",
  low: "border-border/50 bg-muted/20",
};
const sevDot: Record<Sev, string> = { red: "bg-red-500", yellow: "bg-amber-500", low: "bg-muted-foreground" };
const modLabel: Record<Modulo, string> = {
  financas: "Finanças", obrigacoes: "Obrigações", riscos: "Riscos", documentos: "Documentos",
  tarefas: "Tarefas", projetos: "Projetos", rotinas: "Rotinas", comercial: "Comercial", inbox: "Inbox", capacidade: "Capacidade",
};

export const BoardAttentionFeed = () => {
  const { items, counts } = useBoardAttention();
  const navigate = useNavigate();
  const [dismissed, setDismissed] = useState<Set<string>>(load);
  const visible = items.filter((i) => !dismissed.has(i.id));

  const dismiss = (id: string) => setDismissed((prev) => {
    const n = new Set(prev); n.add(id);
    try { localStorage.setItem(KEY, JSON.stringify([...n])); } catch { /* noop */ }
    return n;
  });

  return (
    <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Bell className="h-4 w-4 text-primary" /> Central de Atenção
          {visible.length > 0 && <span className="rounded-full bg-primary/15 text-primary px-2 text-xs font-mono">{visible.length}</span>}
          {counts.red > 0 && <span className="rounded-full bg-red-500/15 text-red-500 px-2 text-[10px]">{counts.red} crítico{counts.red > 1 ? "s" : ""}</span>}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-1.5">
        {visible.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nada exigindo sua atenção agora. ✓</p>
        ) : (
          visible.map((i) => (
            <div key={i.id} className={cn("flex items-center gap-2 rounded-lg border p-2 text-sm", sevStyle[i.severidade])}>
              <span className={cn("h-2 w-2 shrink-0 rounded-full", sevDot[i.severidade])} />
              <button onClick={() => navigate(i.deeplink)} className="min-w-0 flex-1 truncate text-left hover:underline">
                <span className="mr-1.5 text-[10px] uppercase tracking-wide text-muted-foreground">{modLabel[i.modulo]}</span>
                {i.titulo}
              </button>
              <button onClick={() => dismiss(i.id)} className="shrink-0 text-muted-foreground hover:text-foreground" title="Dispensar"><X className="h-3.5 w-3.5" /></button>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
};

export default BoardAttentionFeed;
