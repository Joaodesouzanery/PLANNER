import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { startOfWeek, endOfWeek, format } from "date-fns";
import { ClipboardCheck, ChevronLeft, ChevronRight, FileDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useCompany } from "@/contexts/CompanyContext";
import { fmtCurrency } from "@/components/ems/finance/useFinanceData";
import { useFinanceWorkspace } from "@/components/ems/finance/useFinanceWorkspace";
import { useFinanceSettings } from "@/components/ems/finance/useFinanceSettings";
import { computeCfo } from "@/components/ems/finance/financeCfo";
import { exportTablePdf, type PdfSection } from "@/lib/exportPdf";

const db = supabase as any;
const iso = (d: Date) => format(d, "yyyy-MM-dd");
const todayIso = () => iso(new Date());
const safe = async (build: () => any): Promise<any[]> => {
  try { const { data, error } = await build(); if (error) return []; return data ?? []; } catch { return []; }
};

const STEPS = ["Caixa & financeiro", "Riscos", "Obrigações & compliance", "Decisões & estratégia", "Prioridades da semana"];
const NOTE_KEYS = ["caixa", "riscos", "obrigacoes", "decisoes", "prioridades"] as const;
type NoteKey = (typeof NOTE_KEYS)[number];

export const WeeklyReviewWizard = () => {
  const qc = useQueryClient();
  const { selectedCompanyId } = useCompany();
  const scoped = selectedCompanyId && selectedCompanyId !== "all";
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [notes, setNotes] = useState<Record<NoteKey, string>>({ caixa: "", riscos: "", obrigacoes: "", decisoes: "", prioridades: "" });

  const periodStart = iso(startOfWeek(new Date(), { weekStartsOn: 1 }));
  const periodEnd = iso(endOfWeek(new Date(), { weekStartsOn: 1 }));

  // Passo 1 — financeiro (mesma fonte do Painel CFO).
  const ws = useFinanceWorkspace();
  const { settings } = useFinanceSettings();
  const cfo = useMemo(() => computeCfo(ws.canonical.rows, settings, ws.reserveBalance, todayIso(), ws.expectedMonthly), [ws.canonical.rows, settings, ws.reserveBalance, ws.expectedMonthly]);

  const co = (q: any) => (scoped ? q.eq("company_id", selectedCompanyId) : q);
  const { data: risks = [] } = useQuery({
    queryKey: ["wr-risks", selectedCompanyId], enabled: open, staleTime: 60_000,
    queryFn: () => safe(() => co(db.from("board_risks").select("title,score,status,review_date").neq("status", "closed")).order("score", { ascending: false }).limit(8)),
  });
  const { data: obligations = [] } = useQuery({
    queryKey: ["wr-obl", selectedCompanyId], enabled: open, staleTime: 60_000,
    queryFn: () => safe(() => co(db.from("board_obligation_occurrences").select("period_label,due_date,status,amount").eq("status", "pending")).order("due_date", { ascending: true }).limit(10)),
  });
  const { data: decisions = [] } = useQuery({
    queryKey: ["wr-dec", selectedCompanyId], enabled: open, staleTime: 60_000,
    queryFn: () => safe(() => co(db.from("decision_logs").select("title,decision,created_at")).order("created_at", { ascending: false }).limit(8)),
  });

  const today = todayIso();
  const criticos = (risks as any[]).filter((r) => Number(r.score) >= 16 && (!r.review_date || r.review_date < today)).length;
  const atrasadas = (obligations as any[]).filter((o) => o.due_date < today).length;

  const save = useMutation({
    mutationFn: async () => {
      const agenda = STEPS.map((s, i) => `${i + 1}. ${s}`).join(" · ");
      const summary = `Caixa: ${notes.caixa || "—"}\nRiscos: ${notes.riscos || "—"}\nObrigações: ${notes.obrigacoes || "—"}`;
      const { error } = await db.from("review_cycles").insert({
        cycle_type: "weekly", period_start: periodStart, period_end: periodEnd,
        agenda, summary, decisions: notes.decisoes || null, next_actions: notes.prioridades || null,
        company_id: scoped ? selectedCompanyId : null,
      });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["decisions"] }); qc.invalidateQueries({ queryKey: ["health-reviews"] }); },
    onError: (e: any) => toast({ title: "Erro ao salvar review", description: e?.message, variant: "destructive" }),
  });

  const gerarPdf = async () => {
    const sections: PdfSection[] = [
      { heading: "1. Caixa & financeiro", body: [
        ["Saldo (líq. imposto)", fmtCurrency(cfo.saldoLiquidoImposto)],
        ["Sobra mensal", fmtCurrency(cfo.sobraMensal)],
        ["Runway", cfo.burnMensal > 0 ? `${cfo.runwayMeses.toFixed(1)} meses` : "—"],
        ["Imposto a recolher", fmtCurrency(cfo.impostoARecolher)],
        ["Anotações", notes.caixa || "—"],
      ] },
      { heading: "2. Riscos", head: [["Risco", "Score", "Status"]], body: (risks as any[]).map((r) => [r.title, r.score, r.status]).concat([["Anotações", notes.riscos || "—", ""]]) },
      { heading: "3. Obrigações & compliance", head: [["Período", "Vencimento", "Valor"]], body: (obligations as any[]).map((o) => [o.period_label || "—", o.due_date, o.amount != null ? fmtCurrency(Number(o.amount)) : "—"]).concat([["Anotações", notes.obrigacoes || "—", ""]]) },
      { heading: "4. Decisões & estratégia", head: [["Data", "Decisão"]], body: (decisions as any[]).map((d) => [String(d.created_at).slice(0, 10), d.title || d.decision]).concat([["Anotações", notes.decisoes || "—"]]) },
      { heading: "5. Prioridades da semana", body: [[notes.prioridades || "—"]] },
    ];
    await exportTablePdf({ title: "Weekly Review", subtitle: `Semana ${periodStart} a ${periodEnd}`, filename: `weekly-review-${periodStart}.pdf`, sections });
  };

  const finish = async () => {
    await save.mutateAsync();
    await gerarPdf();
    toast({ title: "Review salva + PDF gerado" });
    setOpen(false); setStep(0);
  };

  const note = (k: NoteKey, ph: string) => (
    <Textarea value={notes[k]} onChange={(e) => setNotes((n) => ({ ...n, [k]: e.target.value }))} placeholder={ph} rows={3} className="text-sm" />
  );

  return (
    <>
      <Button variant="outline" size="sm" className="gap-2" onClick={() => setOpen(true)}><ClipboardCheck className="h-4 w-4" />Weekly Review</Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><ClipboardCheck className="h-4 w-4 text-primary" />Weekly Review — passo {step + 1}/5</DialogTitle></DialogHeader>
          <Progress value={((step + 1) / 5) * 100} className="h-1.5" />
          <p className="text-sm font-medium">{STEPS[step]}</p>

          <div className="space-y-3 max-h-[50vh] overflow-y-auto">
            {step === 0 && (<>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="rounded-lg border border-border/50 p-2"><p className="text-[11px] text-muted-foreground">Sobra/mês</p><p className="font-mono font-bold">{fmtCurrency(cfo.sobraMensal)}</p></div>
                <div className="rounded-lg border border-border/50 p-2"><p className="text-[11px] text-muted-foreground">Runway</p><p className="font-mono font-bold">{cfo.burnMensal > 0 ? `${cfo.runwayMeses.toFixed(1)} m` : "—"}</p></div>
              </div>
              {note("caixa", "Leitura do caixa da semana, o que mudou…")}
            </>)}
            {step === 1 && (<>
              <p className="text-xs text-muted-foreground">{risks.length} riscos abertos · <b className="text-red-400">{criticos} críticos sem revisão</b></p>
              <div className="space-y-1">{(risks as any[]).slice(0, 5).map((r, i) => <div key={i} className="flex justify-between text-xs"><span className="truncate">{r.title}</span><span className="font-mono text-muted-foreground">{r.score}</span></div>)}</div>
              {note("riscos", "Riscos que subiram/caíram, mitigações…")}
            </>)}
            {step === 2 && (<>
              <p className="text-xs text-muted-foreground">{obligations.length} obrigações pendentes · <b className="text-amber-400">{atrasadas} atrasadas</b></p>
              <div className="space-y-1">{(obligations as any[]).slice(0, 5).map((o, i) => <div key={i} className="flex justify-between text-xs"><span className="truncate">{o.period_label || "Obrigação"}</span><span className="font-mono text-muted-foreground">{o.due_date}</span></div>)}</div>
              {note("obrigacoes", "Compliance da semana, o que pagar/enviar…")}
            </>)}
            {step === 3 && (<>
              <div className="space-y-1">{(decisions as any[]).slice(0, 5).map((d, i) => <div key={i} className="text-xs truncate"><span className="text-muted-foreground">{String(d.created_at).slice(0, 10)}</span> · {d.title || d.decision}</div>)}</div>
              {note("decisoes", "Decisões tomadas / a tomar, estratégia…")}
            </>)}
            {step === 4 && note("prioridades", "As 3 prioridades da próxima semana…")}
          </div>

          <div className="flex items-center justify-between gap-2 pt-1">
            <Button variant="ghost" size="sm" disabled={step === 0} onClick={() => setStep((s) => s - 1)}><ChevronLeft className="h-4 w-4" />Voltar</Button>
            {step < 4
              ? <Button size="sm" onClick={() => setStep((s) => s + 1)}>Próximo<ChevronRight className="h-4 w-4" /></Button>
              : <Button size="sm" className="gap-2" disabled={save.isPending} onClick={finish}><FileDown className="h-4 w-4" />Concluir + PDF</Button>}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default WeeklyReviewWizard;
