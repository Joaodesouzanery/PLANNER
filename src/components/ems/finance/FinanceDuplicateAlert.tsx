import { useMemo } from "react";
import { AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useFinanceWorkspace } from "./useFinanceWorkspace";
import { fmtCurrency } from "./useFinanceData";
import { buildAuditReport, monthsBackStart } from "./financeAudit";
import { useConfirm } from "@/hooks/useConfirm";

const todayIso = () => new Date().toISOString().slice(0, 10);
const isUuid = (v: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);

/**
 * Vigia de duplicidade (recorrência × parcela × manual): destaca suspeitas ANTES de somar,
 * com ação rápida de excluir a linha repetida. Usa o mesmo motor da aba Auditoria.
 */
export const FinanceDuplicateAlert = ({ months = 3 }: { months?: number }) => {
  const { canonical, deleteTransactionMutation } = useFinanceWorkspace();
  const confirm = useConfirm();

  const duplicates = useMemo(() => {
    const today = todayIso();
    const from = monthsBackStart(today, months);
    const [y, m] = today.slice(0, 7).split("-").map(Number);
    const to = new Date(Date.UTC(y, m + 1, 0)).toISOString().slice(0, 10); // inclui o mês seguinte
    return buildAuditReport(canonical.rows, from, to, today).duplicates;
  }, [canonical.rows, months]);

  if (!duplicates.length) return null;

  return (
    <Card className="border-amber-500/40 bg-amber-500/5">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2 text-amber-500">
          <AlertTriangle className="h-4 w-4" />
          {duplicates.length} possível(is) duplicidade(s) — revise antes de somar
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {duplicates.slice(0, 6).map((d) => (
          <div key={d.key} className="rounded-lg border border-amber-500/20 p-3 text-xs space-y-1">
            <p className="font-medium">{fmtCurrency(d.amount)} · {d.month} — {d.motivo}</p>
            {d.rows.map((r) => (
              <div key={r.id} className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground">{r.date} · {r.description} · <span className="text-foreground">{r.origem}</span> · {r.situacao}</span>
                {isUuid(r.id) && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 text-xs text-destructive hover:bg-destructive/10"
                    onClick={async () => {
                      if (await confirm({ title: "Excluir este lançamento?", description: `${r.description} · ${fmtCurrency(r.amount)}`, destructive: true, confirmText: "Excluir" }))
                        deleteTransactionMutation.mutate(r.id);
                    }}
                  >
                    Excluir
                  </Button>
                )}
              </div>
            ))}
          </div>
        ))}
        {duplicates.length > 6 && <p className="text-[11px] text-muted-foreground">+ {duplicates.length - 6} na aba Auditoria.</p>}
      </CardContent>
    </Card>
  );
};

export default FinanceDuplicateAlert;
