import { useMemo, useState } from "react";
import { format, addMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Card, CardContent } from "@/components/ui/card";
import { Sparkles, TrendingUp, Calendar, Wallet, AlertCircle } from "lucide-react";
import { fmtCurrency } from "./useFinanceData";
import { cn } from "@/lib/utils";

export interface SavingsGoalInputs {
  itemName: string;
  targetPrice: number;
  monthlyIncome: number;
  monthlyExpenses: number;
  savingsPercent: number;
  hypotheticalIncome: number;
  installmentValue: number;
  installmentsTotal: number;
}

export interface SavingsGoalOutputs {
  monthsToReach: number;
  monthlySaving: number;
  surplus: number;
  reachDate: string | null;
  hypotheticalMonths: number;
  hypotheticalSaving: number;
  extraInstallments: number;
}

interface Props {
  value: SavingsGoalInputs;
  onChange: (v: SavingsGoalInputs) => void;
  onComputed?: (out: SavingsGoalOutputs) => void;
}

const num = (v: any) => Number(v || 0);

export const SavingsGoalForm = ({ value, onChange, onComputed }: Props) => {
  const set = (patch: Partial<SavingsGoalInputs>) => onChange({ ...value, ...patch });

  const out = useMemo<SavingsGoalOutputs>(() => {
    const surplus = Math.max(0, num(value.monthlyIncome) - num(value.monthlyExpenses));
    const monthlySaving = surplus * (num(value.savingsPercent) / 100);
    const monthsToReach = monthlySaving > 0 ? Math.ceil(num(value.targetPrice) / monthlySaving) : 0;
    const reachDate = monthsToReach > 0 ? format(addMonths(new Date(), monthsToReach), "MMMM 'de' yyyy", { locale: ptBR }) : null;

    const hypoSurplus = Math.max(0, num(value.hypotheticalIncome) - num(value.monthlyExpenses));
    const hypothetical = hypoSurplus * (num(value.savingsPercent) / 100);
    const hypotheticalMonths = hypothetical > 0 ? Math.ceil(num(value.targetPrice) / hypothetical) : 0;

    const extraIncome = Math.max(0, num(value.hypotheticalIncome) - num(value.monthlyIncome));
    const extraInstallments = num(value.installmentValue) > 0 ? Math.floor(extraIncome / num(value.installmentValue)) : 0;

    return { surplus, monthlySaving, monthsToReach, reachDate, hypotheticalMonths, hypotheticalSaving: hypothetical, extraInstallments };
  }, [value]);

  void onComputed;

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 flex items-start gap-2">
        <Sparkles className="h-4 w-4 text-primary mt-0.5" />
        <p className="text-xs text-muted-foreground">Calcule quanto e em quanto tempo voce alcanca o objetivo, simulando rendas e parcelas.</p>
      </div>

      <div>
        <Label>Nome do objetivo *</Label>
        <Input value={value.itemName} onChange={(e) => set({ itemName: e.target.value })} placeholder="Ex: Notebook novo" className="rounded-xl" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Preco-alvo (R$)</Label>
          <Input type="number" step="0.01" value={value.targetPrice || ""} onChange={(e) => set({ targetPrice: Number(e.target.value) })} className="rounded-xl font-mono" />
        </div>
        <div>
          <Label>Renda mensal atual</Label>
          <Input type="number" step="0.01" value={value.monthlyIncome || ""} onChange={(e) => set({ monthlyIncome: Number(e.target.value) })} className="rounded-xl font-mono" />
        </div>
        <div>
          <Label>Custos fixos mensais</Label>
          <Input type="number" step="0.01" value={value.monthlyExpenses || ""} onChange={(e) => set({ monthlyExpenses: Number(e.target.value) })} className="rounded-xl font-mono" />
        </div>
        <div>
          <Label>Renda hipotetica (opcional)</Label>
          <Input type="number" step="0.01" value={value.hypotheticalIncome || ""} onChange={(e) => set({ hypotheticalIncome: Number(e.target.value) })} className="rounded-xl font-mono" placeholder="Ex: 5500" />
        </div>
      </div>

      <div>
        <Label className="flex items-center justify-between">
          <span>% da sobra para economizar</span>
          <span className="text-primary font-mono">{value.savingsPercent}%</span>
        </Label>
        <Slider value={[value.savingsPercent]} onValueChange={([v]) => set({ savingsPercent: v })} min={0} max={100} step={5} className="mt-2" />
      </div>

      <div className="grid grid-cols-2 gap-3 pt-2 border-t border-border/50">
        <div>
          <Label className="text-xs text-muted-foreground">Simular parcelas: valor</Label>
          <Input type="number" step="0.01" value={value.installmentValue || ""} onChange={(e) => set({ installmentValue: Number(e.target.value) })} className="rounded-xl font-mono" placeholder="Ex: 200" />
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">N de parcelas atuais</Label>
          <Input type="number" value={value.installmentsTotal || ""} onChange={(e) => set({ installmentsTotal: Number(e.target.value) })} className="rounded-xl font-mono" placeholder="Ex: 10" />
        </div>
      </div>

      <Card className="border-primary/30 bg-gradient-to-br from-primary/5 to-transparent">
        <CardContent className="p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <Metric icon={Wallet} label="Sobra mensal" value={fmtCurrency(out.surplus)} />
            <Metric icon={TrendingUp} label="Economia/mes" value={fmtCurrency(out.monthlySaving)} color="text-emerald-400" />
            <Metric icon={Calendar} label="Meses ate atingir" value={out.monthsToReach > 0 ? `${out.monthsToReach} meses` : "—"} />
            <Metric icon={Calendar} label="Data prevista" value={out.reachDate || "—"} small />
          </div>

          {num(value.hypotheticalIncome) > 0 && (
            <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3">
              <p className="text-xs text-muted-foreground mb-1">Cenario com renda de {fmtCurrency(num(value.hypotheticalIncome))}:</p>
              <p className="text-sm">
                Economia <span className="font-mono text-emerald-400">{fmtCurrency(out.hypotheticalSaving)}</span>/mes,
                {" "}objetivo em <span className="font-mono text-emerald-400">{out.hypotheticalMonths} meses</span>
                {out.monthsToReach > 0 && out.hypotheticalMonths > 0 && out.hypotheticalMonths < out.monthsToReach && (
                  <span className="text-emerald-400"> ({out.monthsToReach - out.hypotheticalMonths} meses mais rapido)</span>
                )}
              </p>
              {num(value.installmentValue) > 0 && out.extraInstallments > 0 && (
                <p className="text-xs text-muted-foreground mt-2">
                  Com a renda extra, voce conseguiria cobrir <span className="font-mono text-emerald-400">+{out.extraInstallments}</span> parcela(s) de {fmtCurrency(num(value.installmentValue))} por mes.
                </p>
              )}
            </div>
          )}

          {out.monthlySaving === 0 && num(value.targetPrice) > 0 && (
            <div className="flex items-start gap-2 text-xs text-amber-500">
              <AlertCircle className="h-4 w-4 mt-0.5" />
              <span>Ajuste renda, custos ou % para gerar uma economia mensal positiva.</span>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

const Metric = ({ icon: Icon, label, value, color, small }: any) => (
  <div className="rounded-lg border border-border/50 bg-background/40 p-2.5">
    <div className="flex items-center gap-1.5 text-xs text-muted-foreground"><Icon className="h-3 w-3" />{label}</div>
    <p className={cn("font-bold font-mono mt-1", small ? "text-xs" : "text-base", color)}>{value}</p>
  </div>
);

export const computeSavingsOutputs = (value: SavingsGoalInputs): SavingsGoalOutputs => {
  const surplus = Math.max(0, num(value.monthlyIncome) - num(value.monthlyExpenses));
  const monthlySaving = surplus * (num(value.savingsPercent) / 100);
  const monthsToReach = monthlySaving > 0 ? Math.ceil(num(value.targetPrice) / monthlySaving) : 0;
  const reachDate = monthsToReach > 0 ? format(addMonths(new Date(), monthsToReach), "yyyy-MM-dd") : null;
  const hypoSurplus = Math.max(0, num(value.hypotheticalIncome) - num(value.monthlyExpenses));
  const hypothetical = hypoSurplus * (num(value.savingsPercent) / 100);
  const hypotheticalMonths = hypothetical > 0 ? Math.ceil(num(value.targetPrice) / hypothetical) : 0;
  const extraIncome = Math.max(0, num(value.hypotheticalIncome) - num(value.monthlyIncome));
  const extraInstallments = num(value.installmentValue) > 0 ? Math.floor(extraIncome / num(value.installmentValue)) : 0;
  return { surplus, monthlySaving, monthsToReach, reachDate, hypotheticalMonths, hypotheticalSaving: hypothetical, extraInstallments };
};

export const emptySavingsGoal = (): SavingsGoalInputs => ({
  itemName: "",
  targetPrice: 0,
  monthlyIncome: 0,
  monthlyExpenses: 0,
  savingsPercent: 30,
  hypotheticalIncome: 0,
  installmentValue: 0,
  installmentsTotal: 0,
});
