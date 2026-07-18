import { useMemo, useState } from "react";
import { endOfMonth, endOfYear, format, startOfMonth, startOfYear, subMonths } from "date-fns";
import { FileBarChart, SlidersHorizontal } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { fmtCurrency } from "./useFinanceData";
import { useFinanceWorkspace } from "./useFinanceWorkspace";
import { useFinanceSettings } from "./useFinanceSettings";
import { useDreCategories } from "./useDreCategories";
import { computeDre, mapCategoryToDreLine, DRE_LINE_LABEL, type DreLine } from "./financeDre";

const pct = (v: number) => `${(v * 100).toFixed(1)}%`;
const LINES: DreLine[] = ["receita", "deducao", "custo", "despesa_operacional", "resultado_financeiro", "depreciacao"];

const DreRow = ({ label, value, kind, margem }: { label: string; value: number; kind?: "sub" | "total" | "ebitda"; margem?: number }) => (
  <div className={cn("flex items-center justify-between gap-2 px-3 py-1.5 text-sm", kind === "total" && "border-t border-border/60 font-semibold", kind === "ebitda" && "border-t border-primary/40 bg-primary/5 font-bold rounded")}>
    <span className={cn(kind === "sub" && "pl-3 text-muted-foreground")}>{label}</span>
    <span className="flex items-center gap-2 font-mono">
      {margem != null && <span className="text-[10px] text-muted-foreground">{pct(margem)}</span>}
      <span className={cn(value < 0 && "text-destructive")}>{fmtCurrency(value)}</span>
    </span>
  </div>
);

export const FinanceDre = () => {
  const workspace = useFinanceWorkspace();
  const { settings } = useFinanceSettings();
  const { overrides, missing, setOverride } = useDreCategories();
  const [periodType, setPeriodType] = useState<"mes" | "tri" | "ano">("mes");
  const [basis, setBasis] = useState<"caixa" | "competencia">("caixa");
  const [dAndA, setDAndA] = useState("");
  const [showClassifier, setShowClassifier] = useState(false);

  const { from, to, label } = useMemo(() => {
    const now = new Date();
    if (periodType === "ano") return { from: format(startOfYear(now), "yyyy-MM-dd"), to: format(endOfYear(now), "yyyy-MM-dd"), label: format(now, "yyyy") };
    if (periodType === "tri") return { from: format(startOfMonth(subMonths(now, 2)), "yyyy-MM-dd"), to: format(endOfMonth(now), "yyyy-MM-dd"), label: "últimos 3 meses" };
    return { from: format(startOfMonth(now), "yyyy-MM-dd"), to: format(endOfMonth(now), "yyyy-MM-dd"), label: format(now, "MM/yyyy") };
  }, [periodType]);

  const dre = useMemo(
    () => computeDre(workspace.canonical.rows, from, to, { taxRate: settings.tax_rate, overrides, dAndAManual: Number(dAndA) || 0, basis }),
    [workspace.canonical.rows, from, to, settings.tax_rate, overrides, dAndA, basis],
  );

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-base flex items-center gap-2"><FileBarChart className="h-4 w-4 text-primary" />DRE — resultado ({label})</CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            <Select value={periodType} onValueChange={(v) => setPeriodType(v as any)}><SelectTrigger className="h-8 w-[130px] text-xs"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="mes">Mês atual</SelectItem><SelectItem value="tri">Trimestre</SelectItem><SelectItem value="ano">Ano (YTD)</SelectItem></SelectContent></Select>
            <Select value={basis} onValueChange={(v) => setBasis(v as any)}><SelectTrigger className="h-8 w-[130px] text-xs"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="caixa">Caixa (pago)</SelectItem><SelectItem value="competencia">Competência</SelectItem></SelectContent></Select>
            <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-xs" onClick={() => setShowClassifier((s) => !s)}><SlidersHorizontal className="h-3.5 w-3.5" />Classificar</Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="rounded-xl border border-border/50">
          <DreRow label="Receita bruta" value={dre.receitaBruta} />
          <DreRow label={`(−) Impostos / deduções${dre.deducoesEstimada ? " (estimado)" : ""}`} value={-dre.deducoes} kind="sub" />
          <DreRow label="= Receita líquida" value={dre.receitaLiquida} kind="total" />
          <DreRow label="(−) Custo (CMV/CPV)" value={-dre.custo} kind="sub" />
          <DreRow label="= Lucro bruto" value={dre.lucroBruto} kind="total" margem={dre.margemBruta} />
          <DreRow label="(−) Despesas operacionais" value={-dre.despesaOperacional} kind="sub" />
          <DreRow label="= EBITDA" value={dre.ebitda} kind="ebitda" margem={dre.margemEbitda} />
          <DreRow label="(−) Depreciação / amortização" value={-dre.depreciacaoAmortizacao} kind="sub" />
          <DreRow label="= EBIT" value={dre.ebit} kind="total" />
          <DreRow label="(+/−) Resultado financeiro" value={dre.resultadoFinanceiro} kind="sub" />
          <DreRow label="= Lucro líquido" value={dre.lucroLiquido} kind="total" margem={dre.margemLiquida} />
        </div>

        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5"><Label className="text-[11px]">Deprec./amort. mensal (manual)</Label><Input type="number" value={dAndA} onChange={(e) => setDAndA(e.target.value)} placeholder="0" className="h-7 w-24 text-xs" /></span>
          <span>Simples Nacional: IR embutido nos impostos (sem IRPJ à parte).</span>
        </div>

        {showClassifier && (
          <div className="rounded-lg border border-dashed border-border/50 p-3">
            <p className="mb-2 text-xs font-medium">Classificar categorias na DRE {missing && <span className="text-amber-400">· aplique a migration finance_dre_categories p/ salvar</span>}</p>
            <div className="space-y-1.5 max-h-64 overflow-y-auto">
              {dre.porCategoria.map((c) => (
                <div key={c.category} className="flex items-center justify-between gap-2 text-sm">
                  <span className="min-w-0 flex-1 truncate">{c.category} <span className="text-xs text-muted-foreground">· {fmtCurrency(c.value)}</span></span>
                  <Select value={mapCategoryToDreLine(c.category, overrides)} onValueChange={(v) => setOverride.mutate({ category: c.category, dre_line: v as DreLine })}>
                    <SelectTrigger className="h-7 w-[190px] text-xs" disabled={missing}><SelectValue /></SelectTrigger>
                    <SelectContent>{LINES.map((l) => <SelectItem key={l} value={l}>{DRE_LINE_LABEL[l]}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              ))}
              {dre.porCategoria.length === 0 && <p className="text-xs text-muted-foreground">Sem despesas no período.</p>}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default FinanceDre;
