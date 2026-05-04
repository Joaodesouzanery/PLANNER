import { useMemo, useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ShoppingCart, Wallet, AlertTriangle, CheckCircle2, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import { ResponsiveContainer, AreaChart, Area, CartesianGrid, XAxis, YAxis, Tooltip, ReferenceLine } from "recharts";
import { useFinanceData, fmtCurrency, tooltipStyle } from "./useFinanceData";
import { addMonths, format } from "date-fns";
import { ptBR } from "date-fns/locale";

const PurchaseImpactCalculator = () => {
  const { projectionData, capitalEvolution, monthlyData } = useFinanceData();

  // Auto-detected averages
  const last3 = monthlyData.slice(-3);
  const incomeMonths = last3.filter(m => m.income > 0);
  const expenseMonths = last3.filter(m => m.expense > 0);
  const autoIncome = incomeMonths.length ? Math.round(incomeMonths.reduce((a, m) => a + m.income, 0) / incomeMonths.length) : 0;
  const autoExpense = expenseMonths.length ? Math.round(expenseMonths.reduce((a, m) => a + m.expense, 0) / expenseMonths.length) : 0;

  const [mode, setMode] = useState<"cash" | "installments">("installments");
  const [itemName, setItemName] = useState("");
  const [price, setPrice] = useState<string>("");
  const [installments, setInstallments] = useState<string>("12");
  const [interestRate, setInterestRate] = useState<string>("0"); // % a.m.
  const [income, setIncome] = useState<string>(String(autoIncome || ""));
  const [expense, setExpense] = useState<string>(String(autoExpense || ""));
  const [usingAuto, setUsingAuto] = useState(true);

  useEffect(() => {
    if (usingAuto) {
      setIncome(String(autoIncome || ""));
      setExpense(String(autoExpense || ""));
    }
  }, [autoIncome, autoExpense, usingAuto]);

  const resetToAuto = () => {
    setUsingAuto(true);
    setIncome(String(autoIncome || ""));
    setExpense(String(autoExpense || ""));
  };

  const result = useMemo(() => {
    const p = Number(price) || 0;
    const n = Math.max(1, Number(installments) || 1);
    const i = Math.max(0, Number(interestRate) || 0) / 100;
    const inc = Number(income) || 0;
    const exp = Number(expense) || 0;
    const baseBalance = inc - exp;

    let monthlyPayment = 0;
    let totalPaid = p;
    let durationMonths = 0;

    if (mode === "cash") {
      monthlyPayment = 0;
      totalPaid = p;
      durationMonths = 1;
    } else {
      durationMonths = n;
      if (i > 0) {
        monthlyPayment = p * (i * Math.pow(1 + i, n)) / (Math.pow(1 + i, n) - 1);
      } else {
        monthlyPayment = p / n;
      }
      totalPaid = monthlyPayment * n;
    }

    const percentOfIncome = inc > 0 ? (monthlyPayment / inc) * 100 : 0;
    const remainsAfter = baseBalance - monthlyPayment;
    const interestCost = totalPaid - p;

    let risk: "ok" | "alert" | "danger" = "ok";
    if (mode === "cash") {
      // À vista: gasta capital de uma vez
      const currentCapital = capitalEvolution.length ? capitalEvolution[capitalEvolution.length - 1].capital : 0;
      if (p > currentCapital) risk = "danger";
      else if (p > currentCapital * 0.5) risk = "alert";
    } else {
      if (percentOfIncome > 30 || remainsAfter < 0) risk = "danger";
      else if (percentOfIncome > 15) risk = "alert";
    }

    // Build projection: extend N months, add this purchase impact
    const startCapital = capitalEvolution.length ? capitalEvolution[capitalEvolution.length - 1].capital : 0;
    const horizon = Math.max(durationMonths + 2, 6);
    const chart: { month: string; baseline: number; impacted: number }[] = [];
    let baseRunning = startCapital;
    let impRunning = startCapital;

    if (mode === "cash") impRunning -= p;

    for (let m = 1; m <= horizon; m++) {
      const d = addMonths(new Date(), m);
      baseRunning += baseBalance;
      impRunning += baseBalance - (mode === "installments" && m <= n ? monthlyPayment : 0);
      chart.push({ month: format(d, "MMM/yy", { locale: ptBR }), baseline: Math.round(baseRunning), impacted: Math.round(impRunning) });
    }

    return { monthlyPayment, totalPaid, interestCost, percentOfIncome, remainsAfter, risk, chart, durationMonths, baseBalance };
  }, [price, installments, interestRate, income, expense, mode, capitalEvolution]);

  const riskColor = result.risk === "danger" ? "text-destructive" : result.risk === "alert" ? "text-amber-500" : "text-emerald-500";
  const riskBg = result.risk === "danger" ? "bg-destructive/10 border-destructive/30" : result.risk === "alert" ? "bg-amber-500/10 border-amber-500/30" : "bg-emerald-500/10 border-emerald-500/30";
  const riskLabel = result.risk === "danger" ? "Alto risco" : result.risk === "alert" ? "Atenção" : "Confortável";
  const RiskIcon = result.risk === "ok" ? CheckCircle2 : AlertTriangle;

  return (
    <Card className="border border-border/50 bg-card/80">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <ShoppingCart className="h-4 w-4 text-primary" />
          Calculadora de Impacto: Compra à Vista vs Parcelada
        </CardTitle>
        <p className="text-xs text-muted-foreground italic">
          Simula o impacto da compra na sua renda e capital projetado.
        </p>
      </CardHeader>
      <CardContent className="space-y-5">
        <Tabs value={mode} onValueChange={(v) => setMode(v as any)}>
          <TabsList className="grid w-full grid-cols-2 max-w-sm">
            <TabsTrigger value="cash" className="gap-1.5"><Wallet className="h-3.5 w-3.5" />À vista</TabsTrigger>
            <TabsTrigger value="installments" className="gap-1.5"><ShoppingCart className="h-3.5 w-3.5" />Parcelada</TabsTrigger>
          </TabsList>

          <TabsContent value={mode} className="mt-4 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Item / Descrição</Label>
                <Input value={itemName} onChange={(e) => setItemName(e.target.value)} placeholder="Ex: Notebook novo" />
              </div>
              <div>
                <Label className="text-xs">Valor total (R$)</Label>
                <Input type="number" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="0,00" />
              </div>
              {mode === "installments" && (
                <>
                  <div>
                    <Label className="text-xs">Número de parcelas</Label>
                    <Input type="number" min={1} value={installments} onChange={(e) => setInstallments(e.target.value)} />
                  </div>
                  <div>
                    <Label className="text-xs">Juros mensal (%) — 0 para sem juros</Label>
                    <Input type="number" step="0.1" min={0} value={interestRate} onChange={(e) => setInterestRate(e.target.value)} />
                  </div>
                </>
              )}
            </div>

            <div className="rounded-lg border border-dashed border-border p-3 bg-card/40 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-muted-foreground">
                  Renda e despesas {usingAuto ? "(média automática dos últimos 3 meses)" : "(manual)"}
                </p>
                {!usingAuto && (
                  <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={resetToAuto}>
                    <RotateCcw className="h-3 w-3 mr-1" /> Usar média auto
                  </Button>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Renda mensal (R$)</Label>
                  <Input type="number" value={income} onChange={(e) => { setIncome(e.target.value); setUsingAuto(false); }} />
                </div>
                <div>
                  <Label className="text-xs">Despesas mensais (R$)</Label>
                  <Input type="number" value={expense} onChange={(e) => { setExpense(e.target.value); setUsingAuto(false); }} />
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        {Number(price) > 0 && (
          <>
            <div className={cn("rounded-lg border p-4 flex items-start gap-3", riskBg)}>
              <RiskIcon className={cn("h-5 w-5 mt-0.5", riskColor)} />
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <p className={cn("font-semibold text-sm", riskColor)}>{riskLabel}</p>
                  <Badge variant="outline" className="text-[10px]">
                    {mode === "cash" ? "À vista" : `${result.durationMonths}x`}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  {mode === "cash"
                    ? `Você vai desembolsar ${fmtCurrency(Number(price))} de uma só vez. Seu capital projetado cai imediatamente.`
                    : `${fmtCurrency(result.monthlyPayment)}/mês representam ${result.percentOfIncome.toFixed(1)}% da sua renda. Sobram ${fmtCurrency(result.remainsAfter)} no balanço mensal após esta parcela.`}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Card className="bg-card/60">
                <CardContent className="p-3">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Parcela</p>
                  <p className="text-lg font-bold font-mono tabular-nums mt-1">{fmtCurrency(result.monthlyPayment)}</p>
                </CardContent>
              </Card>
              <Card className="bg-card/60">
                <CardContent className="p-3">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Total pago</p>
                  <p className="text-lg font-bold font-mono tabular-nums mt-1">{fmtCurrency(result.totalPaid)}</p>
                </CardContent>
              </Card>
              <Card className="bg-card/60">
                <CardContent className="p-3">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Juros totais</p>
                  <p className="text-lg font-bold font-mono tabular-nums mt-1 text-amber-500">{fmtCurrency(result.interestCost)}</p>
                </CardContent>
              </Card>
              <Card className="bg-card/60">
                <CardContent className="p-3">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">% da renda</p>
                  <p className={cn("text-lg font-bold font-mono tabular-nums mt-1", riskColor)}>{result.percentOfIncome.toFixed(1)}%</p>
                </CardContent>
              </Card>
            </div>

            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2">Capital projetado: com vs sem a compra</p>
              <div className="h-[260px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={result.chart}>
                    <defs>
                      <linearGradient id="baseG" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="hsl(var(--muted-foreground))" stopOpacity={0.3} />
                        <stop offset="100%" stopColor="hsl(var(--muted-foreground))" stopOpacity={0.0} />
                      </linearGradient>
                      <linearGradient id="impG" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                        <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
                    <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => fmtCurrency(v)} />
                    <ReferenceLine y={0} stroke="hsl(var(--destructive))" strokeDasharray="3 3" />
                    <Area type="monotone" dataKey="baseline" stroke="hsl(var(--muted-foreground))" strokeWidth={2} strokeDasharray="4 4" fill="url(#baseG)" name="Sem a compra" />
                    <Area type="monotone" dataKey="impacted" stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#impG)" name="Com a compra" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default PurchaseImpactCalculator;
