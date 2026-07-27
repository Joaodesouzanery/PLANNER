import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCrmModulos } from "./useCrmModulos";

/** Filtro de módulo (funil por módulo). null = todos. Usa o catálogo do produto (company) atual. */
export const ModuloFilter = ({ value, onChange }: { value: string | null; onChange: (v: string | null) => void }) => {
  const { modulos } = useCrmModulos();
  if (modulos.length === 0) return null;
  return (
    <Select value={value ?? "all"} onValueChange={(v) => onChange(v === "all" ? null : v)}>
      <SelectTrigger className="h-7 w-[160px] text-xs"><SelectValue /></SelectTrigger>
      <SelectContent>
        <SelectItem value="all">Todos os módulos</SelectItem>
        {modulos.map((m) => (
          <SelectItem key={m.id} value={m.id!}>{m.name}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};

export default ModuloFilter;
