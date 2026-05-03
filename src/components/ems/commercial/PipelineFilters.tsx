import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Search, Building2, TrendingUp, CalendarClock, X } from "lucide-react";
import { Slider } from "@/components/ui/slider";

interface PipelineFiltersProps {
  companies: string[];
  onFiltersChange: (filters: PipelineFilterState) => void;
}

export interface PipelineFilterState {
  search: string;
  company: string;
  progressMin: number;
  progressMax: number;
  createdAfter: string;
  createdBefore: string;
}

const PipelineFilters = ({ companies, onFiltersChange }: PipelineFiltersProps) => {
  const [filters, setFilters] = useState<PipelineFilterState>({
    search: "", company: "", progressMin: 0, progressMax: 100,
    createdAfter: "", createdBefore: "",
  });

  const update = (partial: Partial<PipelineFilterState>) => {
    const next = { ...filters, ...partial };
    setFilters(next);
    onFiltersChange(next);
  };

  const hasActive = filters.company || filters.progressMin > 0 || filters.progressMax < 100 || filters.createdAfter || filters.createdBefore;

  const clearAll = () => {
    const cleared: PipelineFilterState = { search: filters.search, company: "", progressMin: 0, progressMax: 100, createdAfter: "", createdBefore: "" };
    setFilters(cleared);
    onFiltersChange(cleared);
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={filters.search} onChange={(e) => update({ search: e.target.value })} placeholder="Buscar no pipeline..." className="pl-10" />
        </div>
        <Select value={filters.company || "all"} onValueChange={(v) => update({ company: v === "all" ? "" : v })}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <div className="flex items-center gap-1.5 truncate">
              <Building2 className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{filters.company || "Todas empresas"}</span>
            </div>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas empresas</SelectItem>
            {companies.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
        <div className="flex items-center gap-2 flex-1 min-w-0 w-full">
          <TrendingUp className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <span className="text-xs text-muted-foreground whitespace-nowrap">Progresso: {filters.progressMin}% – {filters.progressMax}%</span>
          <Slider
            value={[filters.progressMin, filters.progressMax]}
            min={0} max={100} step={5}
            onValueChange={([min, max]) => update({ progressMin: min, progressMax: max })}
            className="flex-1"
          />
        </div>
        <div className="flex gap-2 items-center w-full sm:w-auto">
          <CalendarClock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <Input type="date" value={filters.createdAfter} onChange={(e) => update({ createdAfter: e.target.value })} className="min-w-0 flex-1 sm:w-[140px] text-xs" placeholder="De" />
          <span className="text-xs text-muted-foreground">–</span>
          <Input type="date" value={filters.createdBefore} onChange={(e) => update({ createdBefore: e.target.value })} className="min-w-0 flex-1 sm:w-[140px] text-xs" placeholder="Até" />
        </div>
      </div>

      {hasActive && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-muted-foreground">Filtros:</span>
          {filters.company && (
            <Badge variant="outline" className="text-xs gap-1 cursor-pointer hover:opacity-70" onClick={() => update({ company: "" })}>
              {filters.company} <X className="h-3 w-3" />
            </Badge>
          )}
          {(filters.progressMin > 0 || filters.progressMax < 100) && (
            <Badge variant="outline" className="text-xs gap-1 cursor-pointer hover:opacity-70" onClick={() => update({ progressMin: 0, progressMax: 100 })}>
              {filters.progressMin}%–{filters.progressMax}% <X className="h-3 w-3" />
            </Badge>
          )}
          {(filters.createdAfter || filters.createdBefore) && (
            <Badge variant="outline" className="text-xs gap-1 cursor-pointer hover:opacity-70" onClick={() => update({ createdAfter: "", createdBefore: "" })}>
              Período <X className="h-3 w-3" />
            </Badge>
          )}
          <button className="text-xs text-primary hover:underline" onClick={clearAll}>Limpar todos</button>
        </div>
      )}
    </div>
  );
};

export default PipelineFilters;
