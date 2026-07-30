import { useState } from "react";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { CATEGORIES_PF, CATEGORIES_PJ, FINANCE_CATEGORIES, type CatType } from "./financeCategories";

const CUSTOM = "__custom__";

// Dropdown de categoria: lista FIXA agrupada (Empresa/Pessoal) + categorias legadas ainda
// usadas + escape "Outra…" (texto livre). Mata as duplicatas de texto livre na origem.
export const CategorySelect = ({
  value,
  onChange,
  allCategories = [],
  type,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  allCategories?: string[];
  type?: CatType; // filtra o catálogo pelo tipo do lançamento (transfer aparece em ambos)
  className?: string;
}) => {
  const [manual, setManual] = useState(false);
  const matchType = (t: CatType) => !type || t === type || t === "transfer";
  const pj = CATEGORIES_PJ.filter((c) => matchType(c.type));
  const pf = CATEGORIES_PF.filter((c) => matchType(c.type));
  const inCatalog = FINANCE_CATEGORIES.some((c) => c.name === value);
  const legacy = allCategories.filter((c) => c && !FINANCE_CATEGORIES.some((fc) => fc.name === c)).sort();
  const isLegacy = !!value && !inCatalog && legacy.includes(value);
  const showCustom = manual || (!!value && !inCatalog && !isLegacy);

  return (
    <div className="space-y-1.5">
      <Select
        value={showCustom ? CUSTOM : value || ""}
        onValueChange={(v) => {
          if (v === CUSTOM) { setManual(true); onChange(""); }
          else { setManual(false); onChange(v); }
        }}
      >
        <SelectTrigger className={className}><SelectValue placeholder="Escolha a categoria" /></SelectTrigger>
        <SelectContent>
          {pj.length > 0 && (
            <SelectGroup>
              <SelectLabel>🏢 Empresa (PJ)</SelectLabel>
              {pj.map((c) => <SelectItem key={c.name} value={c.name}>{c.name}</SelectItem>)}
            </SelectGroup>
          )}
          {pf.length > 0 && (
            <SelectGroup>
              <SelectLabel>👤 Pessoal (PF)</SelectLabel>
              {pf.map((c) => <SelectItem key={c.name} value={c.name}>{c.name}</SelectItem>)}
            </SelectGroup>
          )}
          {legacy.length > 0 && (
            <SelectGroup>
              <SelectLabel>Outras (legado)</SelectLabel>
              {legacy.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectGroup>
          )}
          <SelectItem value={CUSTOM}>Outra…</SelectItem>
        </SelectContent>
      </Select>
      {showCustom && (
        <Input
          autoFocus
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Categoria personalizada"
          className={className}
        />
      )}
    </div>
  );
};

export default CategorySelect;
