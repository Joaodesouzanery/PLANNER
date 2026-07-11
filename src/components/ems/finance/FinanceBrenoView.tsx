import { useMemo } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { AlertTriangle, CircleDollarSign, FileDown, TrendingDown, Wallet } from "lucide-react";
import { Area, AreaChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { fmtCurrency, formatDateBR } from "./useFinanceData";
import { useFinanceWorkspace } from "./useFinanceWorkspace";
import { exportTablePdf } from "@/lib/exportPdf";
import { toast } from "sonner";

const dateLabel = (date: string) => format(new Date(`${date}T12:00:00`), "dd MMM", { locale: ptBR });
const monthLabel = (month: string) => format(new Date(`${month}-01T12:00:00`), "MMM/yy", { locale: ptBR });

/** Visao "Planilha do Breno": foco em saldo futuro, decisao pela otica do saldo. */
const FinanceBrenoView = () => {
  const workspace = useFinanceWorkspace();

  const chartData = useMemo(
    () => workspace.forecast90.days.map((day: any) => ({ ...day, label: dateLabel(day.date) })),
    [workspace.forecast90.days],
  );

  if (workspace.entitiesError) {
    return (
      <Card className="border-amber-500/30 bg-amber-500/5">
        <CardContent className="p-8 text-center">
          <AlertTriangle className="mx-auto mb-3 h-10 w-10 text-amber-500" />
          <h3 className="font-semibold">Estrutura financeira ainda nao aplicada</h3>
          <p className="mt-1 text-sm text-muted-foreground">Aplique a migration <code>20260614120000_finance_workspace_cpf_cnpj.sql</code> no Supabase.</p>
        </CardContent>
      </Card>
    );
  }

  const saldoHoje = workspace.canonical.saldoRealHoje; // fonte única (não recalcula)
  const menor90 = workspace.canonical.menorSaldo(90); // {date, saldo} — mesma fonte de Fluxo/Viagem/CFO
  const expectedEnd = workspace.forecast90.days[workspace.forecast90.days.length - 1]?.expected ?? saldoHoje;

  const exportPlanilha = async () => {
    const money = (v: number) => fmtCurrency(Number(v));
    try {
      await exportTablePdf({
        title: "Planilha do saldo",
        subtitle: `gerado em ${new Date().toLocaleString("pt-BR")}`,
        filename: "planilha-saldo.pdf",
        sections: [
          { heading: "Indicadores", head: [["Indicador", "Valor"]], body: [
            ["Saldo disponível hoje", money(saldoHoje)],
            ["Saldo esperado em 90 dias", money(expectedEnd)],
            ["Menor saldo em 90 dias", `${money(menor90.saldo)} (${formatDateBR(menor90.date)})`],
            ["Reserva", money(workspace.reserveBalance)],
          ] },
          { heading: "Resumo mês a mês", head: [["Mês", "Entradas", "Saídas", "Saldo final"]], body: workspace.monthlyForecast.length ? workspace.monthlyForecast.map((m: any) => [monthLabel(m.month), money(m.income), money(m.expense), money(m.balance)]) : [["—", "—", "—", "—"]] },
        ],
      });
      toast.success("Planilha exportada!");
    } catch (err: any) {
      toast.error("Falha ao exportar", { description: err?.message });
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3 rounded-xl border border-border/50 bg-muted/10 p-4">
        <div>
          <h2 className="text-lg font-semibold">Planilha do saldo</h2>
          <p className="text-sm text-muted-foreground">
            Controle simples e olhando para o futuro: decida pela ótica do saldo — para onde seu dinheiro vai e quanto sobra mês a mês.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={exportPlanilha} className="shrink-0"><FileDown className="h-4 w-4 mr-2" />Exportar</Button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Metric label="Saldo disponível hoje" value={fmtCurrency(saldoHoje)} icon={Wallet} tone={saldoHoje >= 0 ? "positive" : "negative"} />
        <Metric label="Saldo esperado em 90 dias" value={fmtCurrency(expectedEnd)} icon={CircleDollarSign} tone={expectedEnd >= 0 ? "positive" : "negative"} />
        <Metric label="Menor saldo em 90 dias" value={fmtCurrency(menor90.saldo)} hint={formatDateBR(menor90.date)} icon={TrendingDown} tone={menor90.saldo >= 0 ? "positive" : "negative"} />
        <Metric label="Reserva" value={fmtCurrency(workspace.reserveBalance)} icon={Wallet} tone="primary" />
      </div>

      {workspace.forecast90.firstNegativeDate && (
        <div className="flex items-center gap-3 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm">
          <AlertTriangle className="h-5 w-5 text-destructive" />
          <span>O saldo fica negativo em <strong>{formatDateBR(workspace.forecast90.firstNegativeDate)}</strong>. Ajuste pagamentos antes dessa data.</span>
        </div>
      )}

      <Card>
        <CardHeader><CardTitle className="text-base">Saldo futuro (próximos 90 dias)</CardTitle></CardHeader>
        <CardContent>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="label" fontSize={10} interval={9} stroke="hsl(var(--muted-foreground))" />
                <YAxis fontSize={10} tickFormatter={(value) => `${Math.round(value / 1000)}k`} stroke="hsl(var(--muted-foreground))" />
                <Tooltip formatter={(value: number) => fmtCurrency(value)} labelFormatter={(_, payload) => payload?.[0]?.payload?.date ? formatDateBR(payload[0].payload.date) : ""} />
                <ReferenceLine y={0} stroke="hsl(var(--destructive))" strokeDasharray="4 4" />
                <Area type="monotone" dataKey="expected" name="Esperado" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.12} strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Resumo mês a mês</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Mês</TableHead>
                <TableHead className="text-right">Entradas</TableHead>
                <TableHead className="text-right">Saídas</TableHead>
                <TableHead className="text-right">Saldo final</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {workspace.monthlyForecast.map((month: any) => (
                <TableRow key={month.month}>
                  <TableCell className="font-medium">{monthLabel(month.month)}</TableCell>
                  <TableCell className="text-right text-emerald-500 font-mono">{fmtCurrency(month.income)}</TableCell>
                  <TableCell className="text-right text-destructive font-mono">{fmtCurrency(month.expense)}</TableCell>
                  <TableCell className={cn("text-right font-mono font-semibold", month.balance >= 0 ? "text-foreground" : "text-destructive")}>{fmtCurrency(month.balance)}</TableCell>
                </TableRow>
              ))}
              {!workspace.monthlyForecast.length && (
                <TableRow><TableCell colSpan={4} className="py-10 text-center text-muted-foreground">Sem dados de projeção. Cadastre contas e lançamentos em Finanças.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

const Metric = ({ label, value, hint, icon: Icon, tone }: { label: string; value: string; hint?: string; icon: typeof Wallet; tone: "positive" | "negative" | "primary" }) => (
  <Card>
    <CardContent className="p-4">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className={cn("mt-1 text-lg xl:text-xl font-bold font-mono", tone === "positive" && "text-emerald-500", tone === "negative" && "text-destructive", tone === "primary" && "text-primary")}>{value}</p>
          {hint && <p className="mt-1 text-[10px] text-muted-foreground">{hint}</p>}
        </div>
        <Icon className="h-5 w-5 text-muted-foreground" />
      </div>
    </CardContent>
  </Card>
);

export default FinanceBrenoView;
