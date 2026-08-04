import { useMemo, useState } from "react";
import { AlertTriangle, Download, ScrollText } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useFinanceWorkspace } from "./useFinanceWorkspace";
import { fmtCurrency } from "./useFinanceData";
import { buildAuditReport, auditToCsv, monthsBackStart } from "./financeAudit";

// Auditoria de lançamentos: mostra a ORIGEM de cada valor no recorte e aponta
// suspeitas de duplicidade (recorrência × parcela) para revisão manual.
const todayIso = () => new Date().toISOString().slice(0, 10);

export const FinanceAudit = () => {
  const workspace = useFinanceWorkspace();
  const [months, setMonths] = useState("2");

  const report = useMemo(() => {
    const today = todayIso();
    const from = monthsBackStart(today, Number(months));
    const [y, m] = today.slice(0, 7).split("-").map(Number);
    const to = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
    return buildAuditReport(workspace.canonical.rows, from, to, today);
  }, [workspace.canonical.rows, months]);

  const download = () => {
    const url = URL.createObjectURL(new Blob([auditToCsv(report)], { type: "text/csv;charset=utf-8;" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `auditoria-financeira-${report.from}_${report.to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const s = report.summary;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-heading font-bold flex items-center gap-2">
            <ScrollText className="h-5 w-5 text-primary" />
            Auditoria de lançamentos
          </h3>
          <p className="text-xs text-muted-foreground mt-1">
            Período {report.from} até {report.to} — origem de cada valor e checagem de duplicidades.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={months} onValueChange={setMonths}>
            <SelectTrigger className="w-40 rounded-xl"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="1">Mês atual</SelectItem>
              <SelectItem value="2">Últimos 2 meses</SelectItem>
              <SelectItem value="3">Últimos 3 meses</SelectItem>
              <SelectItem value="6">Últimos 6 meses</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" className="gap-2 rounded-xl" onClick={download} disabled={!report.rows.length}>
            <Download className="h-4 w-4" />
            CSV
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "Entradas recebidas", value: s.entradasPagas },
          { label: "Saídas pagas", value: s.saidasPagas },
          { label: "Saldo realizado", value: s.saldoRealizado },
          { label: "Previsto no período (líquido)", value: s.entradasPrevistas - s.saidasPrevistas },
        ].map((kpi) => (
          <Card key={kpi.label}>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">{kpi.label}</p>
              <p className="text-xl font-bold mt-1">{fmtCurrency(kpi.value)}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {report.duplicates.length > 0 && (
        <Card className="border-amber-500/30">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2 text-amber-500">
              <AlertTriangle className="h-4 w-4" />
              {report.duplicates.length} possível(is) duplicidade(s)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {report.duplicates.map((d) => (
              <div key={d.key} className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 text-xs space-y-1">
                <p className="font-medium">{fmtCurrency(d.amount)} · {d.month} — {d.motivo}</p>
                {d.rows.map((r) => (
                  <p key={r.id} className="text-muted-foreground">
                    {r.date} · {r.description} · <span className="text-foreground">{r.origem}</span> · {r.situacao}
                  </p>
                ))}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-sm">Por origem</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {s.porOrigem.map((o) => (
            <div key={o.origem} className="rounded-lg border border-border/50 p-3 text-xs">
              <p className="font-medium">{o.origem} <span className="text-muted-foreground">({o.qtd})</span></p>
              <p className="text-emerald-500 mt-1">+ {fmtCurrency(o.entradas)}</p>
              <p className="text-red-400">− {fmtCurrency(o.saidas)}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-sm">Lançamentos ({report.rows.length})</CardTitle></CardHeader>
        <CardContent className="p-0">
          <div className="max-h-[520px] overflow-auto">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-card border-b border-border/50">
                <tr className="text-left text-muted-foreground">
                  <th className="p-2">Data</th>
                  <th className="p-2">Descrição</th>
                  <th className="p-2">Origem</th>
                  <th className="p-2">Situação</th>
                  <th className="p-2 text-right">Valor</th>
                </tr>
              </thead>
              <tbody>
                {report.rows.map((r) => (
                  <tr key={r.id} className="border-b border-border/30">
                    <td className="p-2 whitespace-nowrap">{r.date}</td>
                    <td className="p-2">{r.description}<span className="block text-muted-foreground">{r.category || "—"}</span></td>
                    <td className="p-2">{r.origem}</td>
                    <td className="p-2">
                      <Badge variant="outline" className="text-[10px]">{r.situacao}</Badge>
                    </td>
                    <td className={`p-2 text-right font-medium ${r.type === "income" ? "text-emerald-500" : "text-red-400"}`}>
                      {r.type === "income" ? "+" : "−"} {fmtCurrency(r.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default FinanceAudit;
