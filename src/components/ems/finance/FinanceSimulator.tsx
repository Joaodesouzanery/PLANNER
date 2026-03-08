import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import { ShoppingCart, Calculator, Copy, FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import { ResponsiveContainer, AreaChart, Area, CartesianGrid, XAxis, YAxis, Tooltip } from "recharts";
import jsPDF from "jspdf";
import { useFinanceData, fmtCurrency, tooltipStyle } from "./useFinanceData";

const FinanceSimulator = () => {
  const { monthlyData, toast } = useFinanceData();
  const [simItemName, setSimItemName] = useState("");
  const [simItemPrice, setSimItemPrice] = useState(0);
  const [simMonthlyIncome, setSimMonthlyIncome] = useState(0);
  const [simMonthlyExpenses, setSimMonthlyExpenses] = useState(0);

  const simAvailable = Math.max(0, simMonthlyIncome - simMonthlyExpenses);
  const healthyLevels = [
    { label: "Conservador", percent: 10, color: "text-emerald-400", border: "border-emerald-500/30", bg: "bg-emerald-500/5", emoji: "🛡️" },
    { label: "Moderado", percent: 20, color: "text-blue-400", border: "border-blue-500/30", bg: "bg-blue-500/5", emoji: "⚖️" },
    { label: "Agressivo", percent: 30, color: "text-amber-400", border: "border-amber-500/30", bg: "bg-amber-500/5", emoji: "🔥" },
    { label: "Limite", percent: 50, color: "text-red-400", border: "border-red-500/30", bg: "bg-red-500/5", emoji: "⚠️" },
  ];
  const simResults = healthyLevels.map(level => {
    const maxInstallment = simMonthlyIncome * (level.percent / 100);
    const installments = maxInstallment > 0 ? Math.ceil(simItemPrice / maxInstallment) : 0;
    const monthlyPayment = installments > 0 ? simItemPrice / installments : 0;
    const percentOfIncome = simMonthlyIncome > 0 ? (monthlyPayment / simMonthlyIncome) * 100 : 0;
    const remainsAfter = simAvailable - monthlyPayment;
    return { ...level, maxInstallment, installments, monthlyPayment, percentOfIncome, remainsAfter, healthy: remainsAfter >= 0 };
  });

  // Amortization chart data
  const amortizationData = useMemo(() => {
    const best = simResults.find(r => r.healthy && r.percent <= 20) || simResults.find(r => r.healthy);
    if (!best || best.installments <= 0) return [];
    const data = [];
    let remaining = simItemPrice;
    const payment = best.monthlyPayment;
    for (let i = 0; i <= best.installments; i++) {
      data.push({ month: `Mês ${i}`, saldo: Math.round(remaining) });
      remaining = Math.max(0, remaining - payment);
    }
    return data;
  }, [simItemPrice, simResults]);

  const autoFillSim = () => {
    const last3 = monthlyData.slice(-3);
    const avgInc = last3.length > 0 ? last3.reduce((a, m) => a + m.income, 0) / last3.length : 0;
    const avgExp = last3.length > 0 ? last3.reduce((a, m) => a + m.expense, 0) / last3.length : 0;
    setSimMonthlyIncome(Math.round(avgInc));
    setSimMonthlyExpenses(Math.round(avgExp));
    toast({ title: "Valores preenchidos com base na média dos últimos 3 meses" });
  };

  const handleCopy = () => {
    const best = simResults.find(r => r.healthy && r.percent <= 20) || simResults.find(r => r.healthy);
    const lines = [
      `📊 Simulação de Parcelas — ${simItemName || "Item"}`,
      `Preço: ${fmtCurrency(simItemPrice)}`,
      `Renda: ${fmtCurrency(simMonthlyIncome)} | Despesas: ${fmtCurrency(simMonthlyExpenses)} | Sobra: ${fmtCurrency(simAvailable)}`,
      "",
      ...simResults.map(r => `${r.emoji} ${r.label} (${r.percent}%): ${r.installments}x de ${fmtCurrency(r.monthlyPayment)} — ${r.healthy ? "✅ Saudável" : "❌ Não recomendado"}`),
      "",
      best ? `✅ Recomendação: ${best.installments}x de ${fmtCurrency(best.monthlyPayment)} (${best.percentOfIncome.toFixed(1)}% da renda)` : "⚠️ Item acima do orçamento",
    ];
    navigator.clipboard.writeText(lines.join("\n"));
    toast({ title: "Copiado!", description: "Resultado copiado para a área de transferência" });
  };

  const handleExportPDF = () => {
    const doc = new jsPDF();
    const best = simResults.find(r => r.healthy && r.percent <= 20) || simResults.find(r => r.healthy);
    const pageW = doc.internal.pageSize.getWidth();
    const margin = 20;
    const contentW = pageW - margin * 2;
    doc.setFillColor(99, 102, 241); doc.rect(0, 0, pageW, 8, "F");
    doc.setFontSize(20); doc.setTextColor(30, 30, 30); doc.text("Simulação de Parcelas", margin, 22);
    doc.setFontSize(10); doc.setTextColor(120, 120, 120); doc.text(`Gerado em ${new Date().toLocaleDateString("pt-BR")}`, margin, 28);
    let y = 38;
    const cardW = (contentW - 9) / 4;
    [{ label: "Item", value: simItemName || "—" }, { label: "Preço", value: fmtCurrency(simItemPrice) }, { label: "Renda", value: fmtCurrency(simMonthlyIncome) }, { label: "Sobra", value: fmtCurrency(simAvailable) }].forEach((s, i) => {
      const cx = margin + i * (cardW + 3);
      doc.setFillColor(245, 245, 250); doc.roundedRect(cx, y, cardW, 18, 3, 3, "F");
      doc.setFontSize(8); doc.setTextColor(120, 120, 120); doc.text(s.label, cx + 4, y + 7);
      doc.setFontSize(10); doc.setTextColor(30, 30, 30); doc.text(s.value, cx + 4, y + 14);
    });
    y = 66; doc.setFontSize(14); doc.setTextColor(30, 30, 30); doc.text("Opções de Parcelamento", margin, y); y += 8;
    simResults.forEach(r => {
      doc.setFillColor(r.healthy ? 240 : 255, r.healthy ? 253 : 245, r.healthy ? 244 : 245);
      doc.roundedRect(margin, y, contentW, 18, 3, 3, "F");
      doc.setFontSize(10); doc.setTextColor(30, 30, 30); doc.text(`${r.label} (${r.percent}%): ${r.installments}x de ${fmtCurrency(r.monthlyPayment)}`, margin + 6, y + 7);
      doc.setFontSize(9); doc.setTextColor(80, 80, 80); doc.text(`${r.percentOfIncome.toFixed(1)}% comprometido | Sobra: ${fmtCurrency(r.remainsAfter)}`, margin + 6, y + 13);
      y += 22;
    });
    if (best) {
      y += 4; doc.setFillColor(236, 253, 245); doc.roundedRect(margin, y, contentW, 14, 3, 3, "F");
      doc.setFontSize(10); doc.setTextColor(6, 95, 70); doc.text(`Recomendação: ${best.installments}x de ${fmtCurrency(best.monthlyPayment)} (${best.percentOfIncome.toFixed(1)}% da renda)`, margin + 6, y + 9);
    }
    doc.setFillColor(99, 102, 241); doc.rect(0, doc.internal.pageSize.getHeight() - 4, pageW, 4, "F");
    doc.save(`simulacao-parcelas-${(simItemName || "item").toLowerCase().replace(/\s+/g, "-")}.pdf`);
    toast({ title: "PDF gerado!" });
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="space-y-4">
        <Card className="border border-border/50 bg-card/80">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2"><ShoppingCart className="h-4 w-4 text-primary" />O que quer comprar?</CardTitle>
              <Button variant="outline" size="sm" className="rounded-xl text-xs border-primary/30 hover:bg-primary/10" onClick={autoFillSim}>Auto-preencher renda</Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div><Label className="text-sm">Nome do item</Label><Input value={simItemName} onChange={e => setSimItemName(e.target.value)} placeholder="Ex: Computador, iPhone, Carro..." className="mt-1 rounded-xl" /></div>
            <div><Label className="text-sm">Preço total (R$)</Label><Input type="number" value={simItemPrice || ""} onChange={e => setSimItemPrice(Number(e.target.value))} placeholder="0,00" className="mt-1 rounded-xl font-mono" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-sm">Renda mensal (R$)</Label><Input type="number" value={simMonthlyIncome || ""} onChange={e => setSimMonthlyIncome(Number(e.target.value))} placeholder="0,00" className="mt-1 rounded-xl font-mono" /></div>
              <div><Label className="text-sm">Despesas fixas (R$)</Label><Input type="number" value={simMonthlyExpenses || ""} onChange={e => setSimMonthlyExpenses(Number(e.target.value))} placeholder="0,00" className="mt-1 rounded-xl font-mono" /></div>
            </div>
            <div className="flex items-center justify-between p-3 rounded-xl bg-muted/30 border border-border/50">
              <span className="text-sm text-muted-foreground">Sobra mensal</span>
              <span className={cn("font-bold font-mono", simAvailable > 0 ? "text-emerald-400" : "text-destructive")}>{fmtCurrency(simAvailable)}</span>
            </div>
          </CardContent>
        </Card>
        <Card className="border border-amber-500/20 bg-amber-500/5">
          <CardContent className="p-4">
            <p className="text-sm font-medium text-amber-400 mb-1">💡 Regra de ouro</p>
            <p className="text-xs text-muted-foreground">Parcelas não devem comprometer mais de <span className="text-amber-400 font-bold">30%</span> da sua renda.</p>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        {simItemPrice > 0 && simMonthlyIncome > 0 ? (
          <>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm" className="rounded-xl text-xs border-primary/30 hover:bg-primary/10 gap-1.5" onClick={handleCopy}><Copy className="h-3.5 w-3.5" />Copiar</Button>
              <Button variant="outline" size="sm" className="rounded-xl text-xs border-primary/30 hover:bg-primary/10 gap-1.5" onClick={handleExportPDF}><FileText className="h-3.5 w-3.5" />Exportar PDF</Button>
            </div>

            <Card className="border border-primary/30 bg-gradient-to-br from-primary/5 to-transparent">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Calculator className="h-4 w-4 text-primary" />
                  Opções de parcelamento {simItemName && <Badge variant="outline" className="border-primary/30 text-primary ml-1">{simItemName}</Badge>}
                </CardTitle>
                <p className="text-xs text-muted-foreground">Preço: <span className="font-mono font-bold text-foreground">{fmtCurrency(simItemPrice)}</span></p>
              </CardHeader>
              <CardContent className="space-y-3">
                {simResults.map(r => (
                  <motion.div key={r.label} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                    className={cn("p-4 rounded-xl border transition-all", r.border, r.bg, !r.healthy && "opacity-50")}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span>{r.emoji}</span><span className={cn("font-medium text-sm", r.color)}>{r.label}</span>
                        <Badge variant="outline" className={cn("text-[10px]", r.border)}>{r.percent}% da renda</Badge>
                      </div>
                      {!r.healthy && <Badge variant="destructive" className="text-[10px]">Não recomendado</Badge>}
                    </div>
                    <div className="grid grid-cols-3 gap-3 text-center">
                      <div><p className="text-2xl font-bold font-mono text-foreground">{r.installments}x</p><p className="text-[10px] text-muted-foreground">parcelas</p></div>
                      <div><p className={cn("text-lg font-bold font-mono", r.color)}>{fmtCurrency(r.monthlyPayment)}</p><p className="text-[10px] text-muted-foreground">por mês</p></div>
                      <div><p className="text-lg font-bold font-mono text-foreground">{r.percentOfIncome.toFixed(1)}%</p><p className="text-[10px] text-muted-foreground">da renda</p></div>
                    </div>
                    {r.healthy && (
                      <div className="mt-2 pt-2 border-t border-border/30 flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">Sobra após parcela:</span>
                        <span className={cn("font-mono font-medium", r.remainsAfter >= 0 ? "text-emerald-400" : "text-destructive")}>{fmtCurrency(r.remainsAfter)}</span>
                      </div>
                    )}
                    <Progress value={r.percentOfIncome} className="h-1.5 mt-2" />
                  </motion.div>
                ))}
              </CardContent>
            </Card>

            {/* Amortization Chart */}
            {amortizationData.length > 0 && (
              <Card className="border border-border/50 bg-card/80">
                <CardHeader className="pb-2"><CardTitle className="text-base">Amortização do Saldo Devedor</CardTitle></CardHeader>
                <CardContent>
                  <div className="h-[220px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={amortizationData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={10} interval={Math.max(0, Math.floor(amortizationData.length / 6))} />
                        <YAxis stroke="hsl(var(--muted-foreground))" fontSize={10} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
                        <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => fmtCurrency(v)} />
                        <Area type="monotone" dataKey="saldo" stroke="hsl(0, 84.2%, 60.2%)" fill="hsl(0, 84.2%, 60.2%)" fillOpacity={0.15} strokeWidth={2} name="Saldo Devedor" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Best recommendation */}
            {(() => {
              const best = simResults.find(r => r.healthy && r.percent <= 20) || simResults.find(r => r.healthy);
              if (!best) return (
                <Card className="border border-destructive/30 bg-destructive/5"><CardContent className="p-4 text-center"><p className="text-destructive font-medium">⚠️ Este item está acima do seu orçamento atual</p></CardContent></Card>
              );
              return (
                <Card className="border border-emerald-500/30 bg-emerald-500/5">
                  <CardContent className="p-4">
                    <p className="text-emerald-400 font-medium mb-2">✅ Recomendação saudável</p>
                    <p className="text-sm text-muted-foreground">
                      Compre {simItemName || "o item"} em <span className="text-emerald-400 font-bold font-mono">{best.installments}x</span> de{" "}
                      <span className="text-emerald-400 font-bold font-mono">{fmtCurrency(best.monthlyPayment)}</span>,
                      comprometendo apenas <span className="text-emerald-400 font-bold">{best.percentOfIncome.toFixed(1)}%</span> da sua renda.
                    </p>
                  </CardContent>
                </Card>
              );
            })()}

            {/* Custom installments */}
            <Card className="border border-border/50 bg-card/80">
              <CardHeader className="pb-2"><CardTitle className="text-sm">Simular parcelas personalizadas</CardTitle></CardHeader>
              <CardContent>
                <div className="grid grid-cols-4 gap-2">
                  {[3, 6, 10, 12, 18, 24, 36, 48].map(n => {
                    const monthly = simItemPrice / n;
                    const pct = simMonthlyIncome > 0 ? (monthly / simMonthlyIncome) * 100 : 0;
                    const isHealthy = pct <= 30 && monthly <= simAvailable;
                    return (
                      <div key={n} className={cn("p-2 rounded-lg border text-center transition-all", isHealthy ? "border-emerald-500/30 bg-emerald-500/5" : "border-destructive/20 bg-destructive/5 opacity-60")}>
                        <p className="text-lg font-bold font-mono">{n}x</p>
                        <p className={cn("text-xs font-mono", isHealthy ? "text-emerald-400" : "text-destructive")}>{fmtCurrency(monthly)}</p>
                        <p className="text-[10px] text-muted-foreground">{pct.toFixed(0)}%</p>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </>
        ) : (
          <Card className="border border-border/50 bg-card/80">
            <CardContent className="py-16 text-center">
              <div className="inline-flex p-4 rounded-2xl bg-muted/30 mb-3"><ShoppingCart className="h-8 w-8 text-muted-foreground/50" /></div>
              <p className="text-muted-foreground text-sm">Preencha o preço do item e sua renda para ver as opções de parcelamento saudáveis</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default FinanceSimulator;
