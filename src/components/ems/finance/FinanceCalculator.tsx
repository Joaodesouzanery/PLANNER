import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { motion } from "framer-motion";
import { Plus, Trash2, DollarSign, PiggyBank, Calculator, Clock, Percent } from "lucide-react";
import { cn } from "@/lib/utils";
import { useFinanceData, fmtCurrency } from "./useFinanceData";

const FinanceCalculator = () => {
  const { monthlyData, toast } = useFinanceData();
  const [calcGoals, setCalcGoals] = useState<{ id: number; name: string; amount: number }[]>([{ id: 1, name: "", amount: 0 }]);
  const [calcIncome, setCalcIncome] = useState(0);
  const [calcCurrentExpenses, setCalcCurrentExpenses] = useState(0);

  const calcTotalGoal = calcGoals.reduce((a, g) => a + (g.amount || 0), 0);
  const calcAvailableToSave = Math.max(0, calcIncome - calcCurrentExpenses);
  const calcMonthsNeeded = calcAvailableToSave > 0 ? Math.ceil(calcTotalGoal / calcAvailableToSave) : 0;
  const calcSavingsPercent = calcIncome > 0 ? ((calcAvailableToSave / calcIncome) * 100) : 0;

  const autoFillCalc = () => {
    const last3 = monthlyData.slice(-3);
    const avgInc = last3.length > 0 ? last3.reduce((a, m) => a + m.income, 0) / last3.length : 0;
    const avgExp = last3.length > 0 ? last3.reduce((a, m) => a + m.expense, 0) / last3.length : 0;
    setCalcIncome(Math.round(avgInc));
    setCalcCurrentExpenses(Math.round(avgExp));
    toast({ title: "Valores preenchidos com base na média dos últimos 3 meses" });
  };

  const addCalcGoal = () => setCalcGoals([...calcGoals, { id: Date.now(), name: "", amount: 0 }]);
  const removeCalcGoal = (id: number) => setCalcGoals(calcGoals.filter(g => g.id !== id));
  const updateCalcGoal = (id: number, field: "name" | "amount", value: string | number) => setCalcGoals(calcGoals.map(g => g.id === id ? { ...g, [field]: value } : g));

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="space-y-4">
        <Card className="border border-border/50 bg-card/80">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2"><DollarSign className="h-4 w-4 text-primary" />Sua Renda & Despesas</CardTitle>
              <Button variant="outline" size="sm" className="rounded-xl text-xs border-primary/30 hover:bg-primary/10" onClick={autoFillCalc}>Auto-preencher</Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div><Label className="text-sm">Renda mensal (R$)</Label><Input type="number" value={calcIncome || ""} onChange={e => setCalcIncome(Number(e.target.value))} placeholder="0,00" className="mt-1 rounded-xl font-mono" /></div>
            <div><Label className="text-sm">Despesas fixas mensais (R$)</Label><Input type="number" value={calcCurrentExpenses || ""} onChange={e => setCalcCurrentExpenses(Number(e.target.value))} placeholder="0,00" className="mt-1 rounded-xl font-mono" /></div>
            <div className="flex items-center justify-between p-3 rounded-xl bg-muted/30 border border-border/50">
              <span className="text-sm text-muted-foreground">Disponível para economia</span>
              <span className={cn("font-bold font-mono", calcAvailableToSave > 0 ? "text-emerald-400" : "text-destructive")}>{fmtCurrency(calcAvailableToSave)}</span>
            </div>
          </CardContent>
        </Card>

        <Card className="border border-border/50 bg-card/80">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2"><PiggyBank className="h-4 w-4 text-amber-400" />Metas de Gasto</CardTitle>
              <Button variant="outline" size="sm" className="rounded-xl text-xs" onClick={addCalcGoal}><Plus className="h-3 w-3 mr-1" />Adicionar</Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {calcGoals.map((goal) => (
              <motion.div key={goal.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex gap-2 items-end">
                <div className="flex-1"><Label className="text-xs text-muted-foreground">Com o quê?</Label><Input value={goal.name} onChange={e => updateCalcGoal(goal.id, "name", e.target.value)} placeholder="Ex: Carro, Viagem..." className="mt-1 rounded-xl text-sm" /></div>
                <div className="w-32"><Label className="text-xs text-muted-foreground">Quanto? (R$)</Label><Input type="number" value={goal.amount || ""} onChange={e => updateCalcGoal(goal.id, "amount", Number(e.target.value))} placeholder="0,00" className="mt-1 rounded-xl font-mono text-sm" /></div>
                {calcGoals.length > 1 && <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-xl" onClick={() => removeCalcGoal(goal.id)}><Trash2 className="h-3.5 w-3.5" /></Button>}
              </motion.div>
            ))}
            <div className="flex items-center justify-between p-3 rounded-xl bg-primary/5 border border-primary/20 mt-2">
              <span className="text-sm font-medium">Total da meta</span>
              <span className="font-bold font-mono text-primary">{fmtCurrency(calcTotalGoal)}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        <Card className="border border-primary/30 bg-gradient-to-br from-primary/5 to-transparent">
          <CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2"><Calculator className="h-4 w-4 text-primary" />Resultado</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {calcTotalGoal > 0 && calcAvailableToSave > 0 ? (
              <>
                <div className="p-4 rounded-xl bg-muted/30 border border-border/50 text-center">
                  <div className="flex items-center justify-center gap-2 mb-2"><Clock className="h-5 w-5 text-primary" /><span className="text-sm text-muted-foreground">Tempo necessário</span></div>
                  <p className="text-4xl font-bold font-mono text-primary">{calcMonthsNeeded}</p>
                  <p className="text-sm text-muted-foreground">{calcMonthsNeeded === 1 ? "mês" : "meses"}</p>
                </div>
                <div className="p-4 rounded-xl bg-muted/30 border border-border/50">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2"><Percent className="h-4 w-4 text-emerald-400" /><span className="text-sm text-muted-foreground">% da renda que vai economizar</span></div>
                    <span className="font-bold font-mono text-emerald-400">{calcSavingsPercent.toFixed(1)}%</span>
                  </div>
                  <Progress value={Math.min(calcSavingsPercent, 100)} className="h-3" />
                </div>
                {calcGoals.filter(g => g.amount > 0).length > 1 && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-muted-foreground">Detalhamento por meta</p>
                    {calcGoals.filter(g => g.amount > 0).map(goal => {
                      const goalPercent = calcTotalGoal > 0 ? (goal.amount / calcTotalGoal) * 100 : 0;
                      const monthlySave = calcAvailableToSave * (goalPercent / 100);
                      return (
                        <div key={goal.id} className="p-3 rounded-xl bg-muted/20 border border-border/40">
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-sm font-medium">{goal.name || "Sem nome"}</span>
                            <span className="text-xs font-mono text-primary">{fmtCurrency(goal.amount)}</span>
                          </div>
                          <div className="flex items-center justify-between text-xs text-muted-foreground">
                            <span>{goalPercent.toFixed(0)}% do total</span>
                            <span>Economizar {fmtCurrency(monthlySave)}/mês</span>
                          </div>
                          <Progress value={goalPercent} className="h-1.5 mt-2" />
                        </div>
                      );
                    })}
                  </div>
                )}
                <div className="p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/20">
                  <p className="text-sm font-medium text-emerald-400 mb-1">💡 Economize por mês</p>
                  <p className="text-2xl font-bold font-mono text-emerald-400">{fmtCurrency(calcAvailableToSave)}</p>
                  <p className="text-xs text-muted-foreground mt-1">para alcançar sua meta em {calcMonthsNeeded} meses</p>
                </div>
                <div className="space-y-2">
                  <p className="text-sm font-medium text-muted-foreground">⏩ Se economizar mais...</p>
                  {[1.25, 1.5, 2].map(mult => {
                    const extra = calcAvailableToSave * mult;
                    const months = extra > 0 ? Math.ceil(calcTotalGoal / extra) : 0;
                    return (
                      <div key={mult} className="flex items-center justify-between p-2.5 rounded-lg bg-muted/20 border border-border/30 text-sm">
                        <span className="text-muted-foreground">{fmtCurrency(extra)}/mês</span>
                        <span className="font-medium font-mono">{months} {months === 1 ? "mês" : "meses"}</span>
                      </div>
                    );
                  })}
                </div>
              </>
            ) : (
              <div className="text-center py-8">
                <div className="inline-flex p-4 rounded-2xl bg-muted/30 mb-3"><Calculator className="h-8 w-8 text-muted-foreground/50" /></div>
                <p className="text-muted-foreground text-sm">Preencha sua renda, despesas e metas para ver o cálculo</p>
                {calcIncome > 0 && calcCurrentExpenses >= calcIncome && <p className="text-destructive text-xs mt-2">⚠️ Suas despesas são iguais ou maiores que sua renda</p>}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default FinanceCalculator;
