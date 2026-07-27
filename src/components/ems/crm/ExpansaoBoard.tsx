import { useMemo } from "react";
import { TrendingUp, Trophy, Plus, ArrowUpRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useCompany } from "@/contexts/CompanyContext";
import type { useCrm } from "./useCrm";
import { useCrmModulos } from "./useCrmModulos";
import { computeExpansao, type ExpansaoDeal, type ExpansaoModulo, type ExpansaoCliente } from "./expansaoBoard";

/** Board de expansão: contas landed (≥1 módulo ganho) × módulos ainda abertos = pipeline de upsell. */
export const ExpansaoBoard = ({ crm, onSelectCustomer }: { crm: ReturnType<typeof useCrm>; onSelectCustomer: (id: string) => void }) => {
  const { selectedCompanyId } = useCompany();
  const { modulos } = useCrmModulos();

  const rows = useMemo(
    () =>
      computeExpansao(
        crm.customers.map((c) => ({ id: c.id, nome: c.nome })) as ExpansaoCliente[],
        crm.deals as unknown as ExpansaoDeal[],
        modulos as unknown as ExpansaoModulo[],
      ),
    [crm.customers, crm.deals, modulos],
  );

  const abrirDeal = (customerId: string, nome: string, moduloId: string, moduloName: string) =>
    crm.createDeal.mutate({ customerId, title: `${moduloName} — ${nome}`, moduloId });

  if (selectedCompanyId === "all") {
    return <p className="text-sm text-muted-foreground text-center py-10">Selecione um produto (empresa) no topo para ver a expansão por módulo.</p>;
  }
  if (modulos.filter((m) => m.tipo === "aquisicao").length === 0) {
    return <p className="text-sm text-muted-foreground text-center py-10">Cadastre os módulos deste produto (aba Oportunidades → Módulos) para montar o board de expansão.</p>;
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">Cada linha é uma conta que já comprou um módulo (a prova) e tem outros módulos abertos (o upsell). Ordenado por prova disponível.</p>
      {rows.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-10">Nenhuma conta landed ainda. Ganhe um deal de um módulo e a conta aparece aqui com os próximos módulos a oferecer.</p>
      )}
      {rows.map((r) => (
        <Card key={r.cliente.id} className="border border-border/50 bg-card/80">
          <CardContent className="p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <button className="font-semibold text-sm hover:text-primary flex items-center gap-1.5" onClick={() => onSelectCustomer(r.cliente.id)}>
                {r.cliente.nome} <ArrowUpRight className="h-3.5 w-3.5 opacity-50" />
              </button>
              <Badge variant="outline" className="gap-1 text-[10px] text-emerald-400 border-emerald-500/30">
                <Trophy className="h-3 w-3" />{r.provaScore} {r.provaScore === 1 ? "módulo ativo" : "módulos ativos"}
              </Badge>
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              {r.ativos.map((m) => (
                <Badge key={m.id} variant="secondary" className="gap-1 text-[10px] bg-emerald-500/10 text-emerald-400">
                  <Trophy className="h-2.5 w-2.5" />{m.name}
                </Badge>
              ))}
            </div>

            {r.abertos.length > 0 ? (
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <span className="flex items-center gap-1 text-[11px] text-muted-foreground"><TrendingUp className="h-3.5 w-3.5" />Expandir:</span>
                {r.abertos.map((m) => (
                  <Button
                    key={m.id}
                    size="sm"
                    variant="outline"
                    className="h-6 gap-1 rounded-full px-2 text-[11px]"
                    disabled={crm.createDeal.isPending}
                    onClick={() => abrirDeal(r.cliente.id, r.cliente.nome, m.id, m.name)}
                  >
                    <Plus className="h-3 w-3" />{m.name}
                  </Button>
                ))}
              </div>
            ) : (
              <p className="mt-2 text-[11px] text-emerald-400/80">Todos os módulos de aquisição já vendidos. 🎉</p>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

export default ExpansaoBoard;
