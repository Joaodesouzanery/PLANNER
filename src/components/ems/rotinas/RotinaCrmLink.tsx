import { useMemo } from "react";
import { Link2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCrmModulos } from "@/components/ems/crm/useCrmModulos";

/** Select compacto pra ligar um item de rotina a um módulo do CRM (do produto/empresa selecionado). */
export const ModuloLinkSelect = ({ value, onChange }: { value: string | null; onChange: (v: string | null) => void }) => {
  const { modulos } = useCrmModulos();
  if (modulos.length === 0) return null;
  return (
    <Select value={value ?? "none"} onValueChange={(v) => onChange(v === "none" ? null : v)}>
      <SelectTrigger className="h-7 w-[120px] text-xs"><SelectValue placeholder="CRM" /></SelectTrigger>
      <SelectContent>
        <SelectItem value="none">Sem link CRM</SelectItem>
        {modulos.map((m) => <SelectItem key={m.id} value={m.id!}>{m.name}</SelectItem>)}
      </SelectContent>
    </Select>
  );
};

/** Chip que mostra o módulo do CRM ligado ao item (some se não houver link ou módulo não estiver no escopo). */
export const RotinaCrmChip = ({ moduloId }: { moduloId?: string | null }) => {
  const { modulos } = useCrmModulos();
  const name = useMemo(() => modulos.find((m) => m.id === moduloId)?.name, [modulos, moduloId]);
  if (!moduloId || !name) return null;
  return (
    <Badge variant="outline" className="h-4 shrink-0 gap-0.5 px-1 text-[9px] font-normal text-primary border-primary/40">
      <Link2 className="h-2.5 w-2.5" />{name}
    </Badge>
  );
};
