import { Building2, Layers, User, Users, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useClientes } from "./useClientes";
import type { FinanceLens, LensEscopo } from "./financeLens";
import { isLensOpen } from "./financeLens";
import type { FinanceProduto } from "./useFinanceLens";

const ESCOPOS: { value: LensEscopo; label: string }[] = [
  { value: "all", label: "Tudo" },
  { value: "pf", label: "PF" },
  { value: "pj", label: "PJ" },
];

interface Props {
  lens: FinanceLens;
  setLens: (lens: FinanceLens) => void;
  produtos: FinanceProduto[];
}

/** B2 — barra de lentes: PF/PJ/Tudo · por produto · por cliente. Só filtra leitura, nunca grava. */
export const FinanceLensBar = ({ lens, setLens, produtos }: Props) => {
  const { clientes } = useClientes();
  const open = isLensOpen(lens);

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border/50 bg-card/60 px-3 py-2">
      <span className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
        <Layers className="h-3.5 w-3.5" />
        Lente
      </span>

      <div className="flex items-center rounded-lg border border-border/50 bg-background/40 p-0.5">
        {ESCOPOS.map((item) => (
          <button
            key={item.value}
            type="button"
            onClick={() => setLens({ ...lens, escopo: item.value })}
            className={cn(
              "flex items-center gap-1 rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors",
              lens.escopo === item.value
                ? "bg-primary/15 text-primary"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {item.value === "pf" ? <User className="h-3 w-3" /> : item.value === "pj" ? <Building2 className="h-3 w-3" /> : null}
            {item.label}
          </button>
        ))}
      </div>

      <Select value={lens.produtoId} onValueChange={(value) => setLens({ ...lens, produtoId: value })}>
        <SelectTrigger className="h-8 w-[170px] text-xs">
          <SelectValue placeholder="Produto" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos os produtos</SelectItem>
          {produtos.map((produto) => (
            <SelectItem key={produto.id} value={produto.id}>
              {produto.name}
            </SelectItem>
          ))}
          <SelectItem value="none">Sem produto</SelectItem>
        </SelectContent>
      </Select>

      <Select value={lens.clienteId} onValueChange={(value) => setLens({ ...lens, clienteId: value })}>
        <SelectTrigger className="h-8 w-[170px] text-xs">
          <Users className="mr-1 h-3 w-3 text-muted-foreground" />
          <SelectValue placeholder="Cliente" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos os clientes</SelectItem>
          {clientes.map((cliente) => (
            <SelectItem key={cliente.id} value={cliente.id}>
              {cliente.nome}
            </SelectItem>
          ))}
          <SelectItem value="none">Sem cliente</SelectItem>
        </SelectContent>
      </Select>

      {!open && (
        <Button
          variant="ghost"
          size="sm"
          className="h-8 gap-1 text-[11px] text-muted-foreground"
          onClick={() => setLens({ escopo: "all", produtoId: "all", clienteId: "all" })}
        >
          <X className="h-3 w-3" />
          Limpar
        </Button>
      )}

      <span className="ml-auto text-[10px] text-muted-foreground">
        {open ? "Visão completa" : "Recorte ativo — os números abaixo seguem a lente"}
      </span>
    </div>
  );
};

export default FinanceLensBar;
