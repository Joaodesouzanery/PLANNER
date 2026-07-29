import type { RefObject } from "react";
import { BarChart, Bar, AreaChart, Area, PieChart, Pie, Cell, CartesianGrid, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { PIE_COLORS, fmtCurrency, tooltipStyle } from "./useFinanceData";

// Gráficos do relatório renderizados OFFSCREEN (parent posiciona fora da tela) p/ captura via captureChart.
// Mesma config visual do FinanceDashboard.
export interface ReportChartRefs {
  revExp: RefObject<HTMLDivElement>;
  capital: RefObject<HTMLDivElement>;
  income: RefObject<HTMLDivElement>;
  expense: RefObject<HTMLDivElement>;
}

const box = "h-[260px] w-[700px] rounded-lg bg-card p-2";

export const FinanceReportCharts = ({
  monthlyData, capitalEvolution, incomeByCat, expenseByCat, refs,
}: {
  monthlyData: any[];
  capitalEvolution: any[];
  incomeByCat: { name: string; value: number }[];
  expenseByCat: { name: string; value: number }[];
  refs: ReportChartRefs;
}) => (
  <div className="space-y-4">
    <div ref={refs.revExp} className={box}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={monthlyData}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={11} />
          <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
          <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => fmtCurrency(v)} />
          <Legend />
          <Bar dataKey="income" fill="hsl(142.1, 76.2%, 36.3%)" name="Entradas" radius={[4, 4, 0, 0]} />
          <Bar dataKey="expense" fill="hsl(0, 84.2%, 60.2%)" name="Saídas" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
    <div ref={refs.capital} className={box}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={capitalEvolution}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={11} />
          <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
          <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => fmtCurrency(v)} />
          <Area type="monotone" dataKey="capital" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.15} strokeWidth={2} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
    <div ref={refs.income} className={box}>
      {incomeByCat.length > 0 ? (
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={incomeByCat} cx="50%" cy="50%" innerRadius={45} outerRadius={80} paddingAngle={3} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
              {incomeByCat.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
            </Pie>
            <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => fmtCurrency(v)} />
          </PieChart>
        </ResponsiveContainer>
      ) : <div className="flex h-full items-center justify-center text-sm italic text-muted-foreground">Nenhuma receita no período</div>}
    </div>
    <div ref={refs.expense} className={box}>
      {expenseByCat.length > 0 ? (
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={expenseByCat} cx="50%" cy="50%" innerRadius={45} outerRadius={80} paddingAngle={3} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
              {expenseByCat.map((_, i) => <Cell key={i} fill={PIE_COLORS[(i + 2) % PIE_COLORS.length]} />)}
            </Pie>
            <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => fmtCurrency(v)} />
          </PieChart>
        </ResponsiveContainer>
      ) : <div className="flex h-full items-center justify-center text-sm italic text-muted-foreground">Nenhuma despesa no período</div>}
    </div>
  </div>
);

export default FinanceReportCharts;
