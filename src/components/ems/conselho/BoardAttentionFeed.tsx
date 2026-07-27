import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, Check, Clock, EyeOff, Moon, RotateCcw, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useBoardAttention } from "./useBoardAttention";
import { useAttentionState } from "./useAttentionState";
import type { Modulo, Sev } from "./boardAttention";

const sevStyle: Record<Sev, string> = {
  red: "border-red-500/30 bg-red-500/5",
  yellow: "border-amber-500/30 bg-amber-500/5",
  low: "border-border/50 bg-muted/20",
};
const sevDot: Record<Sev, string> = { red: "bg-red-500", yellow: "bg-amber-500", low: "bg-muted-foreground" };
const modLabel: Record<Modulo, string> = {
  financas: "Finanças", obrigacoes: "Obrigações", riscos: "Riscos", documentos: "Documentos",
  tarefas: "Tarefas", projetos: "Projetos", rotinas: "Rotinas", comercial: "Comercial", inbox: "Inbox", capacidade: "Capacidade", clientes: "Clientes",
};
const sourceLabel: Record<string, string> = {
  obrigacoes: "Obrigações", riscos: "Riscos", documentos: "Documentos", tarefas: "Tarefas",
  projetos: "Projetos", comercial: "Comercial", inbox: "Inbox", capacidade: "Capacidade", clientes: "Clientes",
};
const stateLabel: Record<string, string> = { resolved: "resolvido", deferred: "adiado", ignored: "ignorado", open: "soneca" };

const IconBtn = ({ title, onClick, children, tone }: { title: string; onClick: () => void; children: React.ReactNode; tone?: string }) => (
  <button onClick={onClick} title={title} className={cn("shrink-0 rounded p-1 text-muted-foreground transition-colors hover:bg-muted", tone)}>{children}</button>
);

export const BoardAttentionFeed = () => {
  const { items, counts, failedSources } = useBoardAttention();
  const att = useAttentionState();
  const navigate = useNavigate();
  const [showHidden, setShowHidden] = useState(false);

  const visible = useMemo(() => items.filter((i) => !att.isHidden(i.id)), [items, att]);
  const hidden = useMemo(() => items.filter((i) => att.isHidden(i.id)), [items, att]);

  return (
    <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2 flex-wrap">
          <Bell className="h-4 w-4 text-primary" /> Central de Atenção
          {visible.length > 0 && <span className="rounded-full bg-primary/15 text-primary px-2 text-xs font-mono">{visible.length}</span>}
          {counts.red > 0 && <span className="rounded-full bg-red-500/15 text-red-500 px-2 text-[10px]">{counts.red} crítico{counts.red > 1 ? "s" : ""}</span>}
          <div className="ml-auto flex items-center gap-2">
            {hidden.length > 0 && (
              <button onClick={() => setShowHidden((v) => !v)} className="text-[11px] text-muted-foreground hover:text-foreground">
                {showHidden ? "ocultar" : `resolvidos/adiados (${hidden.length})`}
              </button>
            )}
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-1.5">
        {failedSources.length > 0 && (
          <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 p-2 text-[11px] text-amber-300">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
            <span>Dados parciais — não foi possível ler: <b>{failedSources.map((s) => sourceLabel[s] || s).join(", ")}</b> (RLS/tabela indisponível). A fila pode estar incompleta.</span>
          </div>
        )}

        {visible.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nada exigindo sua atenção agora. ✓</p>
        ) : (
          visible.map((i) => (
            <div key={i.id} className={cn("flex items-center gap-1.5 rounded-lg border p-2 text-sm", sevStyle[i.severidade])}>
              <span className={cn("h-2 w-2 shrink-0 rounded-full", sevDot[i.severidade])} />
              <button onClick={() => navigate(i.deeplink)} className="min-w-0 flex-1 truncate text-left hover:underline">
                <span className="mr-1.5 text-[10px] uppercase tracking-wide text-muted-foreground">{modLabel[i.modulo]}</span>
                {i.titulo}
              </button>
              <IconBtn title="Resolvido" onClick={() => att.setState(i.id, "resolved")} tone="hover:text-emerald-500"><Check className="h-3.5 w-3.5" /></IconBtn>
              <IconBtn title="Soneca 7 dias" onClick={() => att.snooze(i.id, 7)} tone="hover:text-sky-400"><Moon className="h-3.5 w-3.5" /></IconBtn>
              <IconBtn title="Adiar" onClick={() => att.setState(i.id, "deferred")} tone="hover:text-amber-400"><Clock className="h-3.5 w-3.5" /></IconBtn>
              <IconBtn title="Ignorar" onClick={() => att.setState(i.id, "ignored")}><EyeOff className="h-3.5 w-3.5" /></IconBtn>
            </div>
          ))
        )}

        {showHidden && hidden.map((i) => {
          const st = att.byKey.get(i.id);
          return (
            <div key={i.id} className="flex items-center gap-1.5 rounded-lg border border-border/40 bg-muted/10 p-2 text-sm opacity-70">
              <span className="min-w-0 flex-1 truncate">
                <span className="mr-1.5 text-[10px] uppercase tracking-wide text-muted-foreground">{modLabel[i.modulo]}</span>
                {i.titulo}
                <span className="ml-1.5 text-[10px] text-muted-foreground">· {st ? stateLabel[st.state] || st.state : "oculto"}</span>
              </span>
              <IconBtn title="Reabrir" onClick={() => att.setState(i.id, "open")} tone="hover:text-primary"><RotateCcw className="h-3.5 w-3.5" /></IconBtn>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
};

export default BoardAttentionFeed;
