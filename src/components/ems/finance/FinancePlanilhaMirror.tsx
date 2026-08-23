// Espelho da Visão Geral da planilha, no topo do dashboard: o bloco CAIXA (saldo − reserva −
// provisionado = caixa livre), os números de fôlego e a agenda de recebimentos/pagamentos deste
// mês em diante. Tudo derivado do mesmo read-model canônico — nenhum número novo é inventado aqui.

import { useMemo } from "react";
import { format, addMonths, startOfMonth } from "date-fns";
import { AlertTriangle, CalendarClock, PiggyBank, TrendingDown, Wallet } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { fmtCurrency, type PeriodRow } from "./useFinanceData";
import { useFinanceWorkspace } from "./useFinanceWorkspace";
import { useFinanceSettings } from "./useFinanceSettings";
import { computeCfo } from "./financeCfo";

const todayIso = () => format(new Date(), "yyyy-MM-dd");
const dataBr = (iso: string) => {
  const [a, m, d] = iso.split("-");
  return `${d}/${m}/${a.slice(2)}`; // com ano: a agenda cobre 12 meses e "10/01" seria ambíguo
};

/** A planilha lista "deste mês em diante" — 12 meses cobrem o horizonte que ela projeta. */
const HORIZONTE_MESES = 12;

const Linha = ({ rotulo, valor, desconto, forte, dica }: {
  rotulo: string; valor: number; desconto?: boolean; forte?: boolean; dica?: string;
}) => (
  <div className={cn("flex items-start justify-between gap-2 py-1.5", forte && "border-t pt-2 font-semibold")}>
    <div className="min-w-0">
      <span className={cn("text-sm", !forte && "text-muted-foreground")}>{rotulo}</span>
      {dica && <p className="text-xs text-muted-foreground">{dica}</p>}
    </div>
    <span className={cn(
      "shrink-0 tabular-nums",
      forte ? "text-lg" : "text-sm",
      // Só o desconto é exibido com sinal fixo; um saldo negativo tem que APARECER negativo.
      !desconto && valor < 0 && "text-destructive",
    )}>
      {desconto ? `−${fmtCurrency(Math.abs(valor))}` : fmtCurrency(valor)}
    </span>
  </div>
);

export const FinancePlanilhaMirror = () => {
  const { canonical, reserveBalance, expectedMonthly, scope } = useFinanceWorkspace();
  const { settings } = useFinanceSettings();

  // UM número de reserva para o bloco inteiro — senão a barra do cartão e o tile de % se
  // contradizem lado a lado.
  const reservaDeclarada = settings.reserva_separada;
  const reservaAtual = reservaDeclarada ?? reserveBalance;

  const cfo = useMemo(
    () => computeCfo(canonical.rows, settings, reservaAtual, todayIso(), expectedMonthly),
    [canonical.rows, settings, reservaAtual, expectedMonthly],
  );

  // Reserva e provisionado são configurações GLOBAIS do usuário; o saldo é escopado pela lente
  // (PF/PJ/empresa). Descontar um global de um saldo escopado dá um número que não existe.
  const consolidado = scope === "consolidated";

  const caixa = useMemo(() => {
    // O desconto só usa a reserva DECLARADA na Config. `reserveBalance` sai do saldo das contas
    // (que parte de opening_balance), enquanto `saldoRealHoje` é 100% derivado do razão — subtrair
    // um do outro misturaria duas bases e daria caixa livre negativo sem motivo.
    // Clampados em zero: um valor negativo vindo de uma célula errada da planilha AUMENTARIA o
    // caixa livre em silêncio, que é o erro mais perigoso que este bloco pode cometer.
    const desconto = consolidado ? Math.max(0, reservaDeclarada ?? 0) : 0;
    const provisionado = consolidado ? Math.max(0, settings.provisionado ?? 0) : 0;
    const alvo = cfo.reservaAlvo;
    return {
      saldo: canonical.saldoRealHoje,
      desconto,
      provisionado,
      livre: canonical.saldoRealHoje - desconto - provisionado,
      alvo,
      pct: alvo > 0 ? Math.min(1, Math.max(0, reservaAtual / alvo)) : 0,
      declarada: reservaDeclarada != null,
    };
  }, [consolidado, reservaDeclarada, reservaAtual, settings.provisionado, canonical.saldoRealHoje, cfo.reservaAlvo]);

  // 180 dias, não 90: a planilha olha os próximos 6 meses, e é onde os buracos aparecem.
  const menor = useMemo(() => canonical.menorSaldo(180), [canonical]);

  const agenda = useMemo(() => {
    // Do 1º DIA DO MÊS, não de hoje: senão as contas já vencidas deste mês somem da tabela —
    // e elas continuam pesando no menor saldo, o que deixaria os dois números irreconciliáveis.
    const de = format(startOfMonth(new Date()), "yyyy-MM-dd");
    const ate = format(addMonths(new Date(), HORIZONTE_MESES), "yyyy-MM-dd");
    const hoje = todayIso();
    const t = canonical.totals(de, ate);
    const linhas = [
      ...t.aReceberRows.map((row) => ({ row, tipo: "receber" as const })),
      ...t.aPagarRows.map((row) => ({ row, tipo: "pagar" as const })),
    ]
      // "Vencido" com o mesmo critério do CFO: ocorrência gerada não está "em atraso".
      .map((l) => ({
        ...l,
        projetado: l.row.synthetic,
        vencido: l.row.date < hoje && !l.row.synthetic,
      }))
      .sort((a, b) => a.row.date.localeCompare(b.row.date));

    const somar = (p: (l: typeof linhas[number]) => boolean) =>
      linhas.reduce((a, l) => (p(l) ? a + (l.tipo === "receber" ? l.row.amount : -l.row.amount) : a), 0);

    return {
      linhas,
      firme: somar((l) => !l.projetado),
      projetado: somar((l) => l.projetado),
      vencidos: linhas.filter((l) => l.vencido).length,
      aReceber: t.aReceber,
      aPagar: t.aPagar,
    };
  }, [canonical]);

  // Sem baldes de despesa configurados o burn é 0 e todo indicador viraria "0 · alerta vermelho".
  const temBurn = cfo.burnMensal > 0;
  // Caixa livre negativo não é "−2 meses de fôlego": é fôlego zero. O número negativo dá a
  // impressão errada de que ainda há prazo.
  const folego = temBurn ? Math.max(0, caixa.livre) / cfo.burnMensal : null;

  const numeros = [
    {
      rotulo: "Fôlego", Icone: Wallet,
      valor: folego == null ? "—" : `${folego.toFixed(1)} meses`,
      // Fôlego do espelho parte do CAIXA LIVRE, não do saldo cheio: é o que este bloco promete.
      dica: !temBurn
        ? "defina o custo mensal nos Ajustes"
        : caixa.livre < 0 ? "caixa livre negativo" : `caixa livre ÷ ${fmtCurrency(cfo.burnMensal)}/mês`,
      alerta: folego != null && folego < 3,
    },
    {
      rotulo: "Reserva", Icone: PiggyBank,
      valor: cfo.reservaAlvo > 0 ? `${Math.round(cfo.reservaPct * 100)}%` : "—",
      dica: cfo.reservaAlvo > 0 ? `alvo ${fmtCurrency(cfo.reservaAlvo)}` : "sem alvo definido",
      alerta: cfo.reservaAlvo > 0 && cfo.reservaPct < 0.5,
    },
    {
      rotulo: "Sobra/mês", Icone: TrendingDown,
      valor: fmtCurrency(cfo.sobraMensal),
      dica: "receita líquida − despesa esperada",
      alerta: cfo.sobraMensal <= 0,
    },
    {
      rotulo: "Menor saldo (180d)", Icone: AlertTriangle,
      valor: fmtCurrency(menor.saldo),
      dica: `em ${dataBr(menor.date)} · só compromissos agendados`,
      alerta: menor.saldo < 0,
    },
  ];

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="border-border/50 bg-card/60">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base"><Wallet className="h-4 w-4" />Caixa</CardTitle>
          </CardHeader>
          <CardContent>
            <Linha rotulo="Saldo real hoje" valor={caixa.saldo} />
            <Linha
              rotulo="Reserva separada"
              valor={caixa.desconto}
              desconto
              dica={!consolidado
                ? "global do usuário — só é descontada no modo consolidado"
                : caixa.declarada ? undefined : "não declarada na Config — não está sendo descontada"}
            />
            <Linha rotulo="Provisionado" valor={caixa.provisionado} desconto />
            <Linha rotulo="Caixa livre" valor={caixa.livre} forte />
            {caixa.livre < 0 && (
              <p className="mt-2 text-xs text-destructive">
                O saldo não cobre a reserva e o provisionado — parte do que está separado já está em uso.
              </p>
            )}
            {caixa.alvo > 0 && (
              <div className="mt-3 space-y-1">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Reserva de emergência</span>
                  <span>{Math.round(caixa.pct * 100)}% de {fmtCurrency(caixa.alvo)}</span>
                </div>
                <Progress value={caixa.pct * 100} className="h-2" />
              </div>
            )}
          </CardContent>
        </Card>

        <div className="grid gap-3 sm:grid-cols-2 lg:col-span-2">
          {numeros.map(({ rotulo, valor, dica, Icone, alerta }) => (
            <Card key={rotulo} className="border-border/50 bg-card/60">
              <CardContent className="flex items-start gap-3 p-4">
                <div className={cn("rounded-lg p-2", alerta ? "bg-destructive/10" : "bg-primary/10")}>
                  <Icone className={cn("h-4 w-4", alerta ? "text-destructive" : "text-primary")} />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">{rotulo}</p>
                  <p className={cn("text-xl font-semibold tabular-nums", alerta && "text-destructive")}>{valor}</p>
                  <p className="truncate text-xs text-muted-foreground" title={dica}>{dica}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      <Card className="border-border/50 bg-card/60">
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <CalendarClock className="h-4 w-4" />A receber e a pagar — deste mês em diante
            {!!agenda.vencidos && (
              <Badge variant="outline" className="text-destructive">{agenda.vencidos} vencido(s)</Badge>
            )}
          </CardTitle>
          <div className="flex flex-wrap gap-2 text-xs">
            <Badge variant="outline" className="text-emerald-400">+{fmtCurrency(agenda.aReceber)}</Badge>
            <Badge variant="outline" className="text-destructive">−{fmtCurrency(agenda.aPagar)}</Badge>
            <Badge variant="outline" title="Saldo dos lançamentos já registrados (a receber − a pagar)">lançado {fmtCurrency(agenda.firme)}</Badge>
            {agenda.projetado !== 0 && <Badge variant="outline" className="text-muted-foreground" title="Saldo das ocorrências geradas pelas recorrências">recorrência {fmtCurrency(agenda.projetado)}</Badge>}
          </div>
        </CardHeader>
        <CardContent>
          {!agenda.linhas.length ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Nada em aberto nos próximos {HORIZONTE_MESES} meses.</p>
          ) : (
            <div className="max-h-72 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-card/95">
                  <tr className="border-b text-xs text-muted-foreground">
                    <th className="p-2 text-left font-medium">Data</th>
                    <th className="p-2 text-left font-medium">Descrição</th>
                    <th className="p-2 text-left font-medium">Categoria</th>
                    <th className="p-2 text-left font-medium">Tipo</th>
                    <th className="p-2 text-right font-medium">Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {agenda.linhas.map(({ row, tipo, vencido, projetado }: {
                    row: PeriodRow; tipo: "receber" | "pagar"; vencido: boolean; projetado: boolean;
                  }, i) => (
                    <tr key={`${tipo}-${row.id}-${i}`} className={cn("border-b border-border/30 last:border-0", vencido && "bg-destructive/5")}>
                      <td className="p-2 tabular-nums text-muted-foreground">{dataBr(row.date)}</td>
                      <td className="p-2">
                        {row.description}
                        {vencido && <span className="ml-1.5 text-xs text-destructive">vencido</span>}
                      </td>
                      <td className="p-2 text-muted-foreground">{row.category || "—"}</td>
                      <td className="p-2">
                        <div className="flex flex-wrap gap-1">
                          <Badge variant="outline" className={cn("text-xs", tipo === "receber" ? "text-emerald-400" : "text-destructive")}>
                            {tipo === "receber" ? "A receber" : "A pagar"}
                          </Badge>
                          {projetado && <Badge variant="outline" className="text-xs text-muted-foreground">projetado</Badge>}
                        </div>
                      </td>
                      <td className={cn("p-2 text-right tabular-nums", tipo === "receber" ? "text-emerald-400" : "text-destructive")}>
                        {tipo === "receber" ? "+" : "−"}{fmtCurrency(row.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default FinancePlanilhaMirror;
