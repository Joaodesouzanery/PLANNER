import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { useBoardAttention } from "./useBoardAttention";
import { useAttentionState } from "./useAttentionState";

// Badge de itens ABERTOS da Central de Atenção (mesma fonte da fila → bate exatamente).
// Nota de perf: monta useBoardAttention no sidebar (cache react-query de 120s, compartilhado com o Conselho).
export const AttentionBadge = ({ collapsed }: { collapsed?: boolean }) => {
  const { items } = useBoardAttention();
  const att = useAttentionState();
  const count = useMemo(() => items.filter((i) => !att.isHidden(i.id)).length, [items, att]);

  if (count <= 0) return null;
  if (collapsed) return <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-red-500" />;
  return <span className={cn("ml-auto rounded-full bg-red-500/20 text-red-400 px-1.5 text-[10px] font-mono")}>{count > 99 ? "99+" : count}</span>;
};

export default AttentionBadge;
