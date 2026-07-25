import { useMemo } from "react";
import { ArrowRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { useCrm } from "./useCrm";
import { crmPortfolio } from "./crmPortfolio";

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const pct = (v: number) => `${Math.round(v * 100)}%`;
const DOT: Record<string, string> = { green: "bg-emerald-500", yellow: "bg-amber-500", red: "bg-red-500" };

const Tile = ({ label, value, hint, tone }: { label: string; value: string | number; hint?: string; tone?: string }) => (
  <div className="rounded-xl border border-border/50 bg-background/40 p-3">
    <p className="text-[11px] text-muted-foreground">{label}</p>
    <p className={cn("mt-1 font-mono text-lg font-bold leading-tight", tone)}>{value}</p>
    {hint && <p className="text-[10px] text-muted-foreground mt-0.5 truncate">{hint}</p>}
  </div>
);

export const ServicingTower = ({ crm, onSelectCustomer }: { crm: ReturnType<typeof useCrm>; onSelectCustomer: (id: string) => void }) => {
  const p = useMemo(() => {
    const custs = crm.customers.map((c) => ({ id: c.id, nome: c.nome, recorrente: c.recorrente, health: c.health, ongoing: crm.revenueByCustomer.get(c.id)?.ongoing ?? 0 }));
    return crmPortfolio(custs, crm.deals as any[], crm.nbaItems);
  }, [crm.customers, crm.deals, crm.nbaItems, crm.revenueByCustomer]);

  const atRisk = useMemo(
    () => crm.customers
      .filter((c) => (c.health || "green") !== "green")
      .map((c) => ({ ...c, ongoing: crm.revenueByCustomer.get(c.id)?.ongoing ?? 0 }))
      .sort((a, b) => (a.health === "red" ? -1 : 1) - (b.health === "red" ? -1 : 1) || b.ongoing - a.ongoing),
    [crm.customers, crm.revenueByCustomer],
  );

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-7 gap-2">
        <Tile label="Clientes" value={p.totalClientes} hint={`${p.ativos} saudáveis`} />
        <Tile label="Em risco" value={p.emRisco} tone={p.emRisco > 0 ? "text-destructive" : "text-emerald-400"} />
        <Tile label="Atenção" value={p.atencao} tone={p.atencao > 0 ? "text-amber-400" : ""} />
        <Tile label="MRR" value={brl(p.mrr)} hint="receita recorrente" />
        <Tile label="Concentração top-1" value={pct(p.top1Share)} tone={p.top1Share > 0.3 ? "text-amber-400" : ""} hint={`HHI ${p.hhi.toFixed(2)}`} />
        <Tile label="Deals abertos" value={p.dealsAbertos} hint={`forecast ${brl(p.forecast)}`} />
        <Tile label="Follow-ups vencidos" value={p.followUpsVencidos} tone={p.followUpsVencidos > 0 ? "text-amber-400" : "text-emerald-400"} hint={`${p.esfriandoCount} esfriando`} />
      </div>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Clientes exigindo atenção</CardTitle></CardHeader>
        <CardContent className="space-y-1">
          {atRisk.length === 0 ? (
            <p className="text-sm text-muted-foreground">Toda a carteira saudável. ✓</p>
          ) : (
            atRisk.map((c) => (
              <div key={c.id} className="flex items-center gap-2 rounded-lg border border-border/50 p-2 text-sm">
                <span className={cn("h-2 w-2 shrink-0 rounded-full", DOT[c.health || "green"])} />
                <span className="flex-1 truncate">{c.nome}{c.next_action_desc ? <span className="text-xs text-muted-foreground"> · {c.next_action_desc}</span> : ""}</span>
                <span className="font-mono text-xs text-muted-foreground shrink-0">{brl(c.ongoing)}/mês</span>
                <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => onSelectCustomer(c.id)}><ArrowRight className="h-3.5 w-3.5" /></Button>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ServicingTower;
