import { useMemo } from "react";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { ArrowDownRight, ArrowUpRight, TrendingDown, Wallet, Scale } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { fmtCurrency } from "./useFinanceData";
import { useFinanceWorkspace } from "./useFinanceWorkspace";

/** B3 — faixa macro: 5 números que respondem "como estou?" antes de qualquer drill-down. */
export const FinanceMacroPanel = () => {
  const { canonical } = useFinanceWorkspace();

  const macro = useMemo(() => {
    const now = new Date();
    const from = format(startOfMonth(now), "yyyy-MM-dd");
    const to = format(endOfMonth(now), "yyyy-MM-dd");
    const totals = canonical.totals(from, to);
    const menor = canonical.menorSaldo(90);
    const entradas = totals.entradasPrevistas;
    const saidas = totals.saidasPrevistas;
    return {
      saldo: canonical.saldoRealHoje,
      entradas,
      saidas,
      resultado: entradas - saidas,
      menorSaldo: menor.saldo,
      menorSaldoDate: menor.date,
    };
  }, [canonical]);

  const cards = [
    { key: "saldo", label: "Saldo real hoje", value: macro.saldo, icon: Wallet, hint: "Só o que já aconteceu" },
    { key: "in", label: "Entradas do mês", value: macro.entradas, icon: ArrowUpRight, hint: "Realizado + previsto", tone: "pos" as const },
    { key: "out", label: "Saídas do mês", value: macro.saidas, icon: ArrowDownRight, hint: "Realizado + previsto", tone: "neg" as const },
    { key: "res", label: "Resultado do mês", value: macro.resultado, icon: Scale, hint: "Entradas − saídas", signed: true },
    { key: "min", label: "Menor saldo (90d)", value: macro.menorSaldo, icon: TrendingDown, hint: macro.menorSaldoDate ? `em ${macro.menorSaldoDate.split("-").reverse().slice(0, 2).join("/")}` : "", signed: true },
  ];

  return (
    <div className="grid grid-cols-2 gap-2 md:grid-cols-3 lg:grid-cols-5">
      {cards.map((card) => {
        const Icon = card.icon;
        const tone =
          card.tone === "pos" ? "text-emerald-400"
            : card.tone === "neg" ? "text-muted-foreground"
              : card.signed ? (card.value < 0 ? "text-destructive" : "text-emerald-400")
                : "text-foreground";
        return (
          <Card key={card.key} className="border-border/50 bg-card/60">
            <CardContent className="p-3">
              <p className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                <Icon className="h-3 w-3" />
                {card.label}
              </p>
              <p className={cn("mt-1 font-mono text-base font-bold leading-none", tone)}>{fmtCurrency(card.value)}</p>
              <p className="mt-1 text-[10px] text-muted-foreground leading-tight">{card.hint}</p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};

export default FinanceMacroPanel;
