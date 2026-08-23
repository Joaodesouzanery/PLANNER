// Categoria × mês — a tabela central da Visão Geral da planilha, com o gráfico de barras e a
// tendência por categoria. Toda a conta vive em financeCategoryPivot.ts (puro e testado).

import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ArrowDownRight, ArrowUpRight, Minus, Table2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { fmtCurrency, tooltipStyle, PIE_COLORS } from "./useFinanceData";
import { useFinanceWorkspace } from "./useFinanceWorkspace";
import { buildCategoryMonthPivot, chaveDaCategoria, pivotParaSerie, type LinhaPivot } from "./financeCategoryPivot";

const MESES_OPCOES = [3, 6, 12] as const;
const TETO_TENDENCIA = 999; // acima disso o número deixa de informar e só estoura a coluna

const Tendencia = ({ linha, tipo }: { linha: LinhaPivot; tipo: "expense" | "income" }) => {
  if (linha.tendencia == null) {
    return <span className="text-xs text-muted-foreground" title="Sem mês anterior com movimento para comparar">estreia</span>;
  }
  const t = linha.tendencia;
  // Numa SAÍDA, subir é ruim; numa ENTRADA, subir é bom.
  const cor = t === 0 ? "text-muted-foreground" : (t > 0) === (tipo === "income") ? "text-emerald-400" : "text-destructive";
  const Icone = t > 0 ? ArrowUpRight : t < 0 ? ArrowDownRight : Minus;
  return (
    <span
      className={cn("inline-flex items-center gap-0.5 text-xs tabular-nums", cor)}
      title={linha.baseTendencia != null ? `contra a média dos meses anteriores: ${fmtCurrency(linha.baseTendencia)}` : undefined}
    >
      <Icone className="h-3 w-3" />
      {Math.abs(t) > TETO_TENDENCIA ? `>${TETO_TENDENCIA}%` : `${Math.abs(t).toFixed(1)}%`}
    </span>
  );
};

export const FinanceCategoryPivotCard = () => {
  const { canonical } = useFinanceWorkspace();
  const [tipo, setTipo] = useState<"expense" | "income">("expense");
  const [qtd, setQtd] = useState<number>(3);

  const pivot = useMemo(
    () => buildCategoryMonthPivot(canonical.rows, { tipo, meses: qtd }),
    [canonical.rows, tipo, qtd],
  );
  const serie = useMemo(() => pivotParaSerie(pivot, 6), [pivot]);
  const top = pivot.linhas.slice(0, 6);

  return (
    <Card className="border-border/50 bg-card/60">
      {/* O header fica SEMPRE montado: se sumisse no estado vazio, clicar em "Entradas" num
          workspace sem receitas tiraria o próprio controle de voltar para "Saídas". */}
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Table2 className="h-4 w-4" />Categoria × mês
          <span className="text-xs font-normal text-muted-foreground">só o realizado, sem transferências</span>
        </CardTitle>
        <div className="flex gap-2">
          <Tabs value={tipo} onValueChange={(v) => setTipo(v as "expense" | "income")}>
            <TabsList className="h-8 bg-muted/40">
              <TabsTrigger value="expense" className="h-6 text-xs">Saídas</TabsTrigger>
              <TabsTrigger value="income" className="h-6 text-xs">Entradas</TabsTrigger>
            </TabsList>
          </Tabs>
          <Tabs value={String(qtd)} onValueChange={(v) => setQtd(Number(v))}>
            <TabsList className="h-8 bg-muted/40">
              {MESES_OPCOES.map((n) => (
                <TabsTrigger key={n} value={String(n)} className="h-6 text-xs">{n}m</TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>
      </CardHeader>

      {!pivot.linhas.length ? (
        <CardContent className="py-8 text-center text-sm text-muted-foreground">
          Nenhuma {tipo === "expense" ? "saída" : "entrada"} realizada nestes {qtd} meses.
        </CardContent>
      ) : (
        <CardContent className="space-y-4">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-xs text-muted-foreground">
                  <th className="p-2 text-left font-medium">Categoria</th>
                  {pivot.rotulos.map((r, i) => (
                    <th key={pivot.meses[i]} className="p-2 text-right font-medium">
                      {r}
                      {pivot.parcialNoFim && i === pivot.rotulos.length - 1 && (
                        <span className="block text-[10px] font-normal opacity-70">parcial</span>
                      )}
                    </th>
                  ))}
                  <th className="p-2 text-right font-medium">Total</th>
                  <th className="p-2 text-right font-medium">Média</th>
                  <th className="p-2 text-right font-medium" title="Último mês contra a média dos anteriores (o mês em curso é projetado para o mês cheio)">
                    vs. anteriores
                  </th>
                </tr>
              </thead>
              <tbody>
                {pivot.linhas.map((l) => (
                  <tr key={l.categoria} className="border-b border-border/30 last:border-0">
                    <td className="p-2">{l.categoria}</td>
                    {l.porMes.map((v, i) => (
                      <td key={pivot.meses[i]} className="p-2 text-right tabular-nums">
                        {v ? fmtCurrency(v) : <span className="text-muted-foreground">—</span>}
                      </td>
                    ))}
                    <td className="p-2 text-right font-medium tabular-nums">{fmtCurrency(l.total)}</td>
                    <td className="p-2 text-right tabular-nums text-muted-foreground">{fmtCurrency(l.media)}</td>
                    <td className="p-2 text-right"><Tendencia linha={l} tipo={tipo} /></td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 font-semibold">
                  <td className="p-2">TOTAL</td>
                  {pivot.totalPorMes.map((v, i) => (
                    <td key={pivot.meses[i]} className="p-2 text-right tabular-nums">{fmtCurrency(v)}</td>
                  ))}
                  <td className="p-2 text-right tabular-nums">{fmtCurrency(pivot.total)}</td>
                  <td className="p-2 text-right tabular-nums text-muted-foreground">
                    {fmtCurrency(Math.round((pivot.total / pivot.meses.length) * 100) / 100)}
                  </td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="h-64">
              <p className="mb-1 text-xs text-muted-foreground">Peso por mês (6 maiores)</p>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={serie}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                  <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${Math.round(Number(v) / 1000)}k`} />
                  <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => fmtCurrency(v)} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  {top.map((l, i) => (
                    <Bar key={l.categoria} dataKey={chaveDaCategoria(i)} name={l.categoria} stackId="a" fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="h-64">
              <p className="mb-1 text-xs text-muted-foreground">Tendência por categoria</p>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={serie}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                  <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${Math.round(Number(v) / 1000)}k`} />
                  <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => fmtCurrency(v)} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  {top.map((l, i) => (
                    <Line key={l.categoria} type="monotone" dataKey={chaveDaCategoria(i)} name={l.categoria} stroke={PIE_COLORS[i % PIE_COLORS.length]} dot={false} strokeWidth={2} />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </CardContent>
      )}
    </Card>
  );
};

export default FinanceCategoryPivotCard;
