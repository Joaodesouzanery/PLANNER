// Importar planilha: escolher arquivo → PRÉVIA (nada gravado ainda) → aplicar → desfazer.
// A prévia é o coração: mostra o que vai mudar linha a linha e a conferência contra os totais
// que a própria planilha declara, para o usuário aprovar sabendo o que acontece.

import { useRef, useState } from "react";
import { AlertTriangle, Check, FileSpreadsheet, Loader2, Minus, Pencil, Plus, RotateCcw, Upload } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { usePlanilhaImport } from "./usePlanilhaImport";

const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const dataBr = (iso: string) => iso.split("-").reverse().join("/");

const ROTULO_CAMPO: Record<string, string> = {
  description: "descrição", amount: "valor", type: "tipo", category: "categoria",
  date: "data", due_date: "vencimento", status: "situação", settled_at: "data de quitação",
  is_recurring: "recorrência", recurrence_interval: "intervalo", recurrence_end_date: "fim da recorrência",
  escopo: "escopo PF/PJ", cliente_id: "cliente",
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const PlanilhaImportDialog = ({ open, onOpenChange }: Props) => {
  const { analise, analisando, analisar, limpar, aplicar, aplicando, desfazer, desfazendo, ultimoLote } = usePlanilhaImport();
  const inputRef = useRef<HTMLInputElement>(null);
  const [removerOutras, setRemoverOutras] = useState(true);

  const fechar = (aberto: boolean) => {
    if (!aberto) limpar();
    onOpenChange(aberto);
  };

  const diff = analise?.diff;
  // Também "muda" quando há linhas de outra origem para limpar — senão o botão fica desabilitado
  // justamente quando o que falta é tornar a planilha a fonte única do período.
  const semMudanca = diff
    && !diff.novos.length && !diff.alterados.length && !diff.removidos.length
    && !(removerOutras && diff.naoEhDaPlanilha.length);

  return (
    <Dialog open={open} onOpenChange={fechar}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" /> Importar planilha financeira
          </DialogTitle>
          <DialogDescription>
            A planilha é a fonte da verdade das Transações. Reimportar sincroniza (cria, atualiza e remove) — nunca duplica.
          </DialogDescription>
        </DialogHeader>

        {!analise && (
          <div className="space-y-4">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={analisando}
              className="w-full rounded-lg border-2 border-dashed p-10 text-center transition hover:border-primary hover:bg-muted/40 disabled:opacity-60"
            >
              {analisando ? (
                <Loader2 className="mx-auto h-8 w-8 animate-spin text-muted-foreground" />
              ) : (
                <Upload className="mx-auto h-8 w-8 text-muted-foreground" />
              )}
              <p className="mt-3 font-medium">{analisando ? "Lendo a planilha…" : "Escolher o arquivo .xlsx"}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Lê as abas Lançamentos, Config e Visão Geral. Nada é gravado até você conferir a prévia.
              </p>
            </button>
            <input
              ref={inputRef}
              type="file"
              accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = ""; // permite reescolher o MESMO arquivo depois de editar no Excel
                if (f) void analisar(f);
              }}
            />

            {ultimoLote && (
              <div className="flex items-center justify-between rounded-lg border bg-muted/30 p-3 text-sm">
                <div>
                  <p className="font-medium">Última importação · {new Date(ultimoLote.created_at).toLocaleString("pt-BR")}</p>
                  <p className="text-muted-foreground">
                    {ultimoLote.arquivo} — {ultimoLote.criados} novos · {ultimoLote.atualizados} atualizados · {ultimoLote.removidos} removidos
                  </p>
                </div>
                <Button variant="outline" size="sm" disabled={desfazendo} onClick={() => desfazer(ultimoLote.id)}>
                  {desfazendo ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="mr-1 h-3.5 w-3.5" />}
                  Desfazer
                </Button>
              </div>
            )}
          </div>
        )}

        {analise && diff && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <Badge variant="outline" className="gap-1"><FileSpreadsheet className="h-3 w-3" />{analise.arquivo}</Badge>
              {diff.janela && (
                <span className="text-muted-foreground">
                  período do arquivo: {dataBr(diff.janela.inicio)} a {dataBr(diff.janela.fim)}
                </span>
              )}
            </div>

            <div className="grid grid-cols-4 gap-2">
              {[
                { rotulo: "novos", n: diff.novos.length, cor: "text-emerald-600", Icone: Plus },
                { rotulo: "atualizados", n: diff.alterados.length, cor: "text-amber-600", Icone: Pencil },
                { rotulo: "removidos", n: diff.removidos.length, cor: "text-rose-600", Icone: Minus },
                { rotulo: "sem mudança", n: diff.inalterados, cor: "text-muted-foreground", Icone: Check },
              ].map(({ rotulo, n, cor, Icone }) => (
                <div key={rotulo} className="rounded-lg border p-3 text-center">
                  <Icone className={`mx-auto h-4 w-4 ${cor}`} />
                  <p className={`mt-1 text-xl font-semibold ${cor}`}>{n}</p>
                  <p className="text-xs text-muted-foreground">{rotulo}</p>
                </div>
              ))}
            </div>

            {semMudanca && (
              <p className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3 text-sm">
                O app já está igual a esta planilha. Aplicar não muda nada.
              </p>
            )}

            {!!analise.conferencia.porMes.length && (
              <div className="rounded-lg border">
                <div className="flex items-center gap-2 border-b p-2 text-sm font-medium">
                  {analise.conferencia.bate
                    ? <><Check className="h-4 w-4 text-emerald-600" /> Conferência: bate com os totais da planilha</>
                    : <><AlertTriangle className="h-4 w-4 text-amber-600" /> Conferência: há diferença nos totais</>}
                </div>
                <table className="w-full text-sm">
                  <thead className="text-xs text-muted-foreground">
                    <tr><th className="p-2 text-left">Mês</th><th className="p-2 text-right">Entradas</th><th className="p-2 text-right">Saídas</th></tr>
                  </thead>
                  <tbody>
                    {analise.conferencia.porMes.map((m) => (
                      <tr key={m.mes} className={!m.comparavel ? "opacity-50" : m.bate ? "" : "bg-amber-500/5"}>
                        <td className="p-2">
                          {m.mes}
                          {!m.comparavel && (
                            <span className="ml-1 text-xs text-muted-foreground">
                              {m.reconhecido ? "· projeção da planilha" : "· não é um mês"}
                            </span>
                          )}
                        </td>
                        <td className="p-2 text-right tabular-nums">
                          {m.comparavel ? brl(m.entradasApp) : "—"}
                          {m.comparavel && !m.bate && <span className="ml-1 text-xs text-muted-foreground">(planilha: {brl(m.entradasPlanilha)})</span>}
                        </td>
                        <td className="p-2 text-right tabular-nums">
                          {m.comparavel ? brl(m.saidasApp) : "—"}
                          {m.comparavel && !m.bate && <span className="ml-1 text-xs text-muted-foreground">(planilha: {brl(m.saidasPlanilha)})</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <ScrollArea className="max-h-64 rounded-lg border">
              <div className="divide-y text-sm">
                {diff.novos.slice(0, 40).map((l) => (
                  <div key={l.uid} className="flex items-center gap-2 p-2">
                    <Plus className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
                    <span className="w-20 shrink-0 text-muted-foreground">{dataBr(l.date)}</span>
                    <span className="flex-1 truncate">{l.description}</span>
                    <span className="tabular-nums">{brl(l.type === "expense" ? -l.amount : l.amount)}</span>
                  </div>
                ))}
                {diff.alterados.slice(0, 40).map((a) => (
                  <div key={a.id} className="flex items-center gap-2 p-2">
                    <Pencil className="h-3.5 w-3.5 shrink-0 text-amber-600" />
                    <span className="w-20 shrink-0 text-muted-foreground">{dataBr(a.alvo.date)}</span>
                    <span className="flex-1 truncate">{a.alvo.description}</span>
                    <span className="text-xs text-muted-foreground">
                      muda {a.campos.map((c) => ROTULO_CAMPO[c] || c).join(", ")}
                    </span>
                  </div>
                ))}
                {diff.removidos.slice(0, 40).map((r) => (
                  <div key={r.id} className="flex items-center gap-2 p-2">
                    <Minus className="h-3.5 w-3.5 shrink-0 text-rose-600" />
                    <span className="w-20 shrink-0 text-muted-foreground">{dataBr(r.due_date || r.date)}</span>
                    <span className="flex-1 truncate line-through opacity-70">{r.description}</span>
                    <span className="tabular-nums opacity-70">{brl(r.amount)}</span>
                  </div>
                ))}
              </div>
            </ScrollArea>

            {!!diff.foraDaJanela && (
              <p className="text-xs text-muted-foreground">
                {diff.foraDaJanela} lançamento(s) de meses que este arquivo não cobre ficam intactos.
              </p>
            )}
            {!!analise.ignoradas && (
              <p className="text-xs text-muted-foreground">
                {analise.ignoradas} linha(s) de simulação da Config ignoradas (não entram na sobra).
              </p>
            )}
            {!!analise.encerradas && (
              <p className="text-xs text-muted-foreground">
                {analise.encerradas} recorrente(s) da Config já com o prazo vencido — não viram compromisso.
              </p>
            )}
            {!!diff.uidsRepetidos.length && (
              <p className="flex items-start gap-1.5 text-xs text-amber-600">
                <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
                {diff.uidsRepetidos.length} linha(s) com identidade repetida foram ignoradas — confira se a planilha
                tem descrições duplicadas na mesma data.
              </p>
            )}
            {analise.snapshot.avisos.map((a) => (
              <p key={a} className="flex items-start gap-1.5 text-xs text-amber-600">
                <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />{a}
              </p>
            ))}

            {!!diff.naoEhDaPlanilha.length && (
              <label className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-sm">
                <Checkbox checked={removerOutras} onCheckedChange={(v) => setRemoverOutras(v === true)} className="mt-0.5" />
                <span>
                  Remover os <strong>{diff.naoEhDaPlanilha.length}</strong> lançamentos de outra origem que estão dentro do
                  período da planilha (seed, CSV, manuais). É o que faz a planilha ser a fonte única — e dá para desfazer.
                </span>
              </label>
            )}
          </div>
        )}

        <DialogFooter>
          {analise && <Button variant="ghost" onClick={limpar}>Escolher outro arquivo</Button>}
          <Button variant="outline" onClick={() => fechar(false)}>Cancelar</Button>
          <Button disabled={!analise || aplicando || semMudanca} onClick={() => aplicar({ removerOutras })}>
            {aplicando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Aplicar importação
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
