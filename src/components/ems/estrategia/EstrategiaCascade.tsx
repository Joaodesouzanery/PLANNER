import { useEffect, useState } from "react";
import { format } from "date-fns";
import {
  ChevronDown, ChevronRight, Plus, Pencil, Trash2, Target, Flag, ListChecks,
  CircleDot, Circle, CheckCircle2, TrendingUp, Sparkles, Gauge, Wallet,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { fmtCurrency } from "@/components/ems/finance/useFinanceData";
import { goalViability } from "@/components/ems/finance/financeGoalViability";
import { useEstrategia, type VisaoNode, type ObjetivoNode, type KrNode, type Acao, type AcaoStatus } from "./useEstrategia";
import { useEstrategiaSignals } from "./useEstrategiaSignals";
import {
  visaoProgress, objetivoProgress, krProgress, metricValue,
  type Semaforo, type EstrTipo, type Progress, type FinMetrics,
} from "./estrategiaProgress";

const todayIso = () => format(new Date(), "yyyy-MM-dd");

const SEM: Record<Semaforo, { bar: string; text: string; ring: string }> = {
  verde: { bar: "bg-emerald-500", text: "text-emerald-400", ring: "border-emerald-500/40 bg-emerald-500/10" },
  amarelo: { bar: "bg-amber-500", text: "text-amber-400", ring: "border-amber-500/40 bg-amber-500/10" },
  vermelho: { bar: "bg-destructive", text: "text-destructive", ring: "border-destructive/40 bg-destructive/10" },
};
const METRICAS = [
  { v: "mrr", label: "MRR (receita recorrente)" },
  { v: "reserva", label: "Reserva / caixa" },
  { v: "patrimonio", label: "Patrimônio líquido" },
  { v: "sobra", label: "Sobra mensal" },
];
const NONE = "__none__";

const pctLabel = (p: number) => `${Math.round(p * 100)}%`;

const Bar = ({ p, sem }: { p: number; sem: Semaforo }) => (
  <div className="h-2 w-full rounded-full bg-muted/40 overflow-hidden">
    <div className={cn("h-full rounded-full transition-all", SEM[sem].bar)} style={{ width: `${Math.min(100, Math.round(p * 100))}%` }} />
  </div>
);

// Rótulo do "atual → alvo" conforme o tipo (financeira mostra R$; operacional mostra ações feitas).
const ProgressLine = ({ prog, tipo }: { prog: Progress; tipo: EstrTipo }) => {
  const s = SEM[prog.semaforo];
  const label = tipo === "financeira"
    ? `${fmtCurrency(prog.atual)} / ${prog.alvo ? fmtCurrency(prog.alvo) : "—"}`
    : `${prog.atual}/${prog.alvo} ações`;
  return (
    <div className="flex-1 min-w-[120px]">
      <div className="flex items-center justify-between gap-2 mb-1">
        <span className="text-[10px] text-muted-foreground truncate">{label}</span>
        <span className={cn("text-[11px] font-mono font-bold", s.text)}>{pctLabel(prog.pct)}</span>
      </div>
      <Bar p={prog.pct} sem={prog.semaforo} />
    </div>
  );
};

// Linha de viabilidade (só metas financeiras com prazo): "no ritmo da sobra, chega/não chega em {data}".
const Viability = ({ alvo, atual, prazo, sobra }: { alvo: number; atual: number; prazo: string; sobra: number }) => {
  const v = goalViability(alvo, atual, prazo, sobra, todayIso());
  if (alvo <= 0) return null;
  const tone = v.verdict === "on-track" ? "text-emerald-400" : v.verdict === "stretch" ? "text-amber-400" : "text-destructive";
  const msg = v.verdict === "on-track" ? "no ritmo, você chega" : v.verdict === "stretch" ? "aperta, mas dá" : "não chega no ritmo atual";
  return (
    <p className={cn("text-[10px] flex items-center gap-1 mt-1", tone)}>
      <Gauge className="h-3 w-3 shrink-0" />
      {msg}{v.dataProjetada ? ` · projeção ${v.dataProjetada}` : ""}{v.aporteNecessario > 0 ? ` · faltam ${fmtCurrency(v.aporteNecessario)}/mês` : ""}
    </p>
  );
};

type EditKind = "visao" | "objetivo" | "kr" | "acao";
interface EditState { kind: EditKind; parentId?: string; data?: any; }
// Handlers específicos da ação (folha), passados como bloco único pela árvore.
interface AcaoOps { cycle: (a: Acao) => void; lancar: (a: Acao) => void; remover: (a: Acao) => void; }

// ── Ação (folha da cascata) ─────────────────────────────────────────────────────────────────
const STATUS_ICON: Record<AcaoStatus, typeof Circle> = { todo: Circle, doing: CircleDot, done: CheckCircle2 };
const nextStatus: Record<AcaoStatus, AcaoStatus> = { todo: "doing", doing: "done", done: "todo" };

const AcaoRow = ({ acao, ops, onEdit, onDelete }: {
  acao: Acao; ops: AcaoOps; onEdit: () => void; onDelete: () => void;
}) => {
  const Icon = STATUS_ICON[acao.status];
  const custo = Number(acao.custo_estimado) || 0;
  const noFluxo = !!acao.transacao_id;
  return (
    <div className="flex items-center gap-2 py-1.5 pl-2 pr-1 rounded-md hover:bg-muted/30 group">
      <button onClick={() => ops.cycle(acao)} title="Mudar status" className={cn("shrink-0", acao.status === "done" ? "text-emerald-400" : acao.status === "doing" ? "text-amber-400" : "text-muted-foreground hover:text-foreground")}>
        <Icon className="h-4 w-4" />
      </button>
      <span className={cn("flex-1 text-xs truncate", acao.status === "done" && "line-through text-muted-foreground")}>{acao.descricao}</span>
      {custo > 0 && (
        noFluxo
          ? <button onClick={() => ops.remover(acao)} title="Remover do fluxo" className="shrink-0"><Badge variant="outline" className="text-[9px] gap-0.5 text-emerald-400 border-emerald-500/40"><Wallet className="h-2.5 w-2.5" />no fluxo</Badge></button>
          : <button onClick={() => ops.lancar(acao)} title="Lançar custo no fluxo (previsto)" className="shrink-0"><Badge variant="outline" className="text-[9px] gap-0.5 hover:text-primary hover:border-primary/40"><Wallet className="h-2.5 w-2.5" />{fmtCurrency(custo)}</Badge></button>
      )}
      {acao.quinzena ? <span className="text-[9px] text-muted-foreground shrink-0">{acao.quinzena}</span> : null}
      <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-primary" onClick={onEdit}><Pencil className="h-3 w-3" /></Button>
        <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-destructive" onClick={onDelete}><Trash2 className="h-3 w-3" /></Button>
      </div>
    </div>
  );
};

// ── Componente principal ────────────────────────────────────────────────────────────────────
export const EstrategiaCascade = () => {
  const est = useEstrategia();
  const fin = useEstrategiaSignals().fin;
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<EditState | null>(null);

  const toggle = (id: string) => setExpanded((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const del = (kind: EditKind, id: string) => {
    const map = { visao: est.deleteVisao, objetivo: est.deleteObjetivo, kr: est.deleteKr, acao: est.deleteAcao } as const;
    map[kind].mutate(id);
  };
  const acaoOps: AcaoOps = {
    cycle: (a) => est.setAcaoStatus.mutate({ id: a.id, status: nextStatus[a.status] }),
    lancar: (a) => est.lancarNoFluxo.mutate(a),
    remover: (a) => est.removerDoFluxo.mutate(a),
  };

  if (est.isLoading) return <div className="py-12 text-center text-sm text-muted-foreground">Carregando estratégia…</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold flex items-center gap-1.5"><Sparkles className="h-4 w-4 text-primary" />Cascata da estratégia</h3>
          <p className="text-[11px] text-muted-foreground">O sonho (BHAG) desce até a ação de 15 dias. O progresso é calculado — metas financeiras leem o dado real, operacionais somam as ações feitas.</p>
        </div>
        <Button size="sm" onClick={() => setEditing({ kind: "visao" })} className="gap-1 shrink-0"><Plus className="h-3.5 w-3.5" />Nova visão</Button>
      </div>

      {est.tree.length === 0 ? (
        <Card className="border-dashed border-border/60 bg-card/40">
          <CardContent className="py-10 text-center text-muted-foreground">
            <div className="p-3 rounded-full bg-primary/10 w-fit mx-auto mb-3"><Flag className="h-6 w-6 text-primary" /></div>
            <p className="text-sm">Nenhuma visão ainda.</p>
            <p className="text-xs mt-1">Comece pelo sonho grande (10–15 anos) — depois quebre em objetivos, KRs e ações.</p>
            <Button size="sm" variant="outline" className="mt-3 gap-1" onClick={() => setEditing({ kind: "visao" })}><Plus className="h-3.5 w-3.5" />Criar visão</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {est.tree.map((v) => (
            <VisaoCard
              key={v.id} visao={v} fin={fin} expanded={expanded} toggle={toggle}
              onAdd={setEditing} onEdit={setEditing} onDelete={del} acaoOps={acaoOps}
            />
          ))}
        </div>
      )}

      <EditDialog editing={editing} onClose={() => setEditing(null)} est={est} />
    </div>
  );
};

// ── Cartão da Visão ─────────────────────────────────────────────────────────────────────────
const VisaoCard = ({ visao, fin, expanded, toggle, onAdd, onEdit, onDelete, acaoOps }: {
  visao: VisaoNode; fin: FinMetrics;
  expanded: Set<string>; toggle: (id: string) => void;
  onAdd: (e: EditState) => void; onEdit: (e: EditState) => void; onDelete: (k: EditKind, id: string) => void;
  acaoOps: AcaoOps;
}) => {
  const prog = visaoProgress(visao, fin);
  const s = SEM[prog.semaforo];
  const isFin = !!visao.metrica_alvo;
  return (
    <Card className={cn("border-l-2", s.ring)}>
      <CardContent className="p-3 space-y-2">
        <div className="flex items-start gap-2">
          <div className="p-1.5 rounded-lg bg-primary/10 mt-0.5 shrink-0"><Flag className="h-4 w-4 text-primary" /></div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="font-semibold text-sm">{visao.titulo}</h4>
              <Badge variant="outline" className="text-[9px]">{visao.horizonte}</Badge>
              {isFin && <Badge variant="outline" className="text-[9px] gap-0.5"><TrendingUp className="h-2.5 w-2.5" />{METRICAS.find((m) => m.v === visao.metrica_alvo)?.label || visao.metrica_alvo}</Badge>}
            </div>
            <div className="flex items-center gap-3 mt-1.5">
              <ProgressLine prog={prog} tipo={isFin ? "financeira" : "operacional"} />
            </div>
            {isFin && visao.prazo && (
              <Viability alvo={Number(visao.valor_alvo) || 0} atual={metricValue(visao.metrica_alvo, fin) ?? 0} prazo={visao.prazo} sobra={fin.sobra} />
            )}
          </div>
          <div className="flex gap-0.5 shrink-0">
            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-primary" title="Novo objetivo" onClick={() => onAdd({ kind: "objetivo", parentId: visao.id })}><Plus className="h-3.5 w-3.5" /></Button>
            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-primary" onClick={() => onEdit({ kind: "visao", data: visao })}><Pencil className="h-3.5 w-3.5" /></Button>
            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => onDelete("visao", visao.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
          </div>
        </div>

        {visao.objetivos.length > 0 && (
          <div className="pl-3 ml-2 border-l border-border/50 space-y-2">
            {visao.objetivos.map((o) => (
              <ObjetivoCard key={o.id} obj={o} fin={fin} expanded={expanded} toggle={toggle} onAdd={onAdd} onEdit={onEdit} onDelete={onDelete} acaoOps={acaoOps} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

// ── Objetivo ────────────────────────────────────────────────────────────────────────────────
const ObjetivoCard = ({ obj, fin, expanded, toggle, onAdd, onEdit, onDelete, acaoOps }: {
  obj: ObjetivoNode; fin: FinMetrics;
  expanded: Set<string>; toggle: (id: string) => void;
  onAdd: (e: EditState) => void; onEdit: (e: EditState) => void; onDelete: (k: EditKind, id: string) => void;
  acaoOps: AcaoOps;
}) => {
  const prog = objetivoProgress(obj, fin);
  const open = expanded.has(obj.id);
  const prazo = obj.tipo === "financeira" && obj.ano ? `${obj.ano}-12-01` : null;
  return (
    <div className="rounded-lg border border-border/40 bg-background/40 p-2 space-y-1.5">
      <div className="flex items-center gap-1.5">
        <button onClick={() => toggle(obj.id)} className="shrink-0 text-muted-foreground hover:text-foreground">
          {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
        </button>
        <Target className="h-3.5 w-3.5 text-primary shrink-0" />
        <span className="text-xs font-medium truncate flex-1">{obj.titulo}</span>
        {obj.ano ? <Badge variant="outline" className="text-[9px] shrink-0">{obj.ano}</Badge> : null}
        <Badge variant="outline" className={cn("text-[9px] shrink-0", obj.tipo === "financeira" && "text-primary")}>{obj.tipo === "financeira" ? "financeira" : "operacional"}</Badge>
        <div className="flex gap-0.5 shrink-0">
          <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-primary" title="Novo KR" onClick={() => onAdd({ kind: "kr", parentId: obj.id })}><Plus className="h-3 w-3" /></Button>
          <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-primary" onClick={() => onEdit({ kind: "objetivo", data: obj })}><Pencil className="h-3 w-3" /></Button>
          <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-destructive" onClick={() => onDelete("objetivo", obj.id)}><Trash2 className="h-3 w-3" /></Button>
        </div>
      </div>
      <div className="pl-6"><ProgressLine prog={prog} tipo={obj.tipo} /></div>
      {obj.tipo === "financeira" && prazo && (
        <div className="pl-6"><Viability alvo={Number(obj.alvo) || 0} atual={metricValue(obj.metrica, fin) ?? 0} prazo={prazo} sobra={fin.sobra} /></div>
      )}

      {open && (
        <div className="pl-6 space-y-1.5 pt-1">
          {obj.krs.length === 0 ? (
            <p className="text-[10px] text-muted-foreground italic">Sem resultados-chave. <button className="underline hover:text-foreground" onClick={() => onAdd({ kind: "kr", parentId: obj.id })}>adicionar</button></p>
          ) : obj.krs.map((k) => (
            <KrCard key={k.id} kr={k} fin={fin} expanded={expanded} toggle={toggle} onAdd={onAdd} onEdit={onEdit} onDelete={onDelete} acaoOps={acaoOps} />
          ))}
        </div>
      )}
    </div>
  );
};

// ── KR ──────────────────────────────────────────────────────────────────────────────────────
const KrCard = ({ kr, fin, expanded, toggle, onAdd, onEdit, onDelete, acaoOps }: {
  kr: KrNode; fin: FinMetrics;
  expanded: Set<string>; toggle: (id: string) => void;
  onAdd: (e: EditState) => void; onEdit: (e: EditState) => void; onDelete: (k: EditKind, id: string) => void;
  acaoOps: AcaoOps;
}) => {
  const prog = krProgress(kr, fin);
  const open = expanded.has(kr.id);
  return (
    <div className="rounded-md border border-border/30 bg-card/40 p-1.5 space-y-1">
      <div className="flex items-center gap-1.5">
        <button onClick={() => toggle(kr.id)} className="shrink-0 text-muted-foreground hover:text-foreground">
          {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        </button>
        <ListChecks className="h-3 w-3 text-muted-foreground shrink-0" />
        <span className="text-[11px] truncate flex-1">{kr.descricao}</span>
        {kr.trimestre ? <span className="text-[9px] text-muted-foreground shrink-0">{kr.trimestre}</span> : null}
        <div className="flex gap-0.5 shrink-0">
          <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-primary" title="Nova ação" onClick={() => onAdd({ kind: "acao", parentId: kr.id })}><Plus className="h-3 w-3" /></Button>
          <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-primary" onClick={() => onEdit({ kind: "kr", data: kr })}><Pencil className="h-3 w-3" /></Button>
          <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-destructive" onClick={() => onDelete("kr", kr.id)}><Trash2 className="h-3 w-3" /></Button>
        </div>
      </div>
      <div className="pl-5"><ProgressLine prog={prog} tipo={kr.tipo} /></div>
      {open && (
        <div className="pl-5 pt-1">
          {kr.acoes.length === 0 ? (
            <p className="text-[10px] text-muted-foreground italic">Sem ações. <button className="underline hover:text-foreground" onClick={() => onAdd({ kind: "acao", parentId: kr.id })}>adicionar</button></p>
          ) : kr.acoes.map((a) => (
            <AcaoRow key={a.id} acao={a} ops={acaoOps} onEdit={() => onEdit({ kind: "acao", data: a })} onDelete={() => onDelete("acao", a.id)} />
          ))}
        </div>
      )}
    </div>
  );
};

// ── Dialog de edição/criação (um formulário que se adapta ao tipo) ────────────────────────────
const TITLES: Record<EditKind, string> = { visao: "Visão / BHAG", objetivo: "Objetivo anual", kr: "Resultado-chave (KR)", acao: "Ação quinzenal" };

const EditDialog = ({ editing, onClose, est }: { editing: EditState | null; onClose: () => void; est: ReturnType<typeof useEstrategia>; }) => {
  const [form, setForm] = useState<any>({});
  useEffect(() => {
    if (!editing) return;
    setForm(editing.data ? { ...editing.data } : defaultForm(editing.kind));
  }, [editing]);

  if (!editing) return null;
  const { kind, parentId, data } = editing;
  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));
  const isFin = form.tipo === "financeira";

  const save = () => {
    const id = data?.id;
    if (kind === "visao") est.saveVisao.mutate({ id, ...form, metrica_alvo: form.metrica_alvo === NONE ? null : form.metrica_alvo });
    else if (kind === "objetivo") est.saveObjetivo.mutate({ id, visao_id: data?.visao_id ?? parentId, ...form });
    else if (kind === "kr") est.saveKr.mutate({ id, objetivo_id: data?.objetivo_id ?? parentId, ...form });
    else est.saveAcao.mutate({ id, key_result_id: data?.key_result_id ?? parentId, ...form });
    onClose();
  };

  return (
    <Dialog open={!!editing} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>{data ? "Editar" : "Novo"} · {TITLES[kind]}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          {/* Título/descrição */}
          {(kind === "visao" || kind === "objetivo") && (
            <Field label="Título"><Input value={form.titulo || ""} onChange={(e) => set("titulo", e.target.value)} placeholder={kind === "visao" ? "Ex.: ser referência nacional em…" : "Ex.: dobrar o MRR"} /></Field>
          )}
          {(kind === "kr" || kind === "acao") && (
            <Field label="Descrição"><Textarea rows={2} value={form.descricao || ""} onChange={(e) => set("descricao", e.target.value)} placeholder={kind === "kr" ? "Ex.: fechar 10 novos contratos" : "Ex.: gravar 4 VSLs"} /></Field>
          )}

          {/* Visão: horizonte, métrica financeira, alvo, prazo */}
          {kind === "visao" && (
            <>
              <Field label="Horizonte"><Input value={form.horizonte || ""} onChange={(e) => set("horizonte", e.target.value)} placeholder="10-15a" /></Field>
              <Field label="Métrica financeira (opcional — puxa o dado real)">
                <Select value={form.metrica_alvo || NONE} onValueChange={(v) => set("metrica_alvo", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>Nenhuma (progresso pelas ações)</SelectItem>
                    {METRICAS.map((m) => <SelectItem key={m.v} value={m.v}>{m.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
              {form.metrica_alvo && form.metrica_alvo !== NONE && (
                <div className="grid grid-cols-2 gap-2">
                  <Field label="Alvo (R$)"><Input type="number" value={form.valor_alvo ?? ""} onChange={(e) => set("valor_alvo", e.target.value)} /></Field>
                  <Field label="Prazo"><Input type="date" value={form.prazo || ""} onChange={(e) => set("prazo", e.target.value)} /></Field>
                </div>
              )}
            </>
          )}

          {/* Objetivo/KR: tipo + (se financeira) métrica + alvo */}
          {(kind === "objetivo" || kind === "kr") && (
            <>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Tipo">
                  <Select value={form.tipo || "operacional"} onValueChange={(v) => set("tipo", v as EstrTipo)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="operacional">Operacional (soma ações)</SelectItem>
                      <SelectItem value="financeira">Financeira (dado real)</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                {kind === "objetivo"
                  ? <Field label="Ano"><Input type="number" value={form.ano ?? ""} onChange={(e) => set("ano", e.target.value)} placeholder="2026" /></Field>
                  : <Field label="Trimestre"><Input value={form.trimestre || ""} onChange={(e) => set("trimestre", e.target.value)} placeholder="2026-Q1" /></Field>}
              </div>
              {isFin && (
                <div className="grid grid-cols-2 gap-2">
                  <Field label="Métrica">
                    <Select value={form.metrica || ""} onValueChange={(v) => set("metrica", v)}>
                      <SelectTrigger><SelectValue placeholder="escolher" /></SelectTrigger>
                      <SelectContent>{METRICAS.map((m) => <SelectItem key={m.v} value={m.v}>{m.label}</SelectItem>)}</SelectContent>
                    </Select>
                  </Field>
                  <Field label="Alvo"><Input type="number" value={form.alvo ?? ""} onChange={(e) => set("alvo", e.target.value)} /></Field>
                </div>
              )}
            </>
          )}

          {/* Ação: quinzena, status, custo */}
          {kind === "acao" && (
            <div className="grid grid-cols-2 gap-2">
              <Field label="Quinzena"><Input value={form.quinzena || ""} onChange={(e) => set("quinzena", e.target.value)} placeholder="2026-Q1-1" /></Field>
              <Field label="Status">
                <Select value={form.status || "todo"} onValueChange={(v) => set("status", v as AcaoStatus)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todo">A fazer</SelectItem>
                    <SelectItem value="doing">Fazendo</SelectItem>
                    <SelectItem value="done">Feita</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Custo estimado (R$) — vira previsto no fluxo"><Input type="number" value={form.custo_estimado ?? ""} onChange={(e) => set("custo_estimado", e.target.value)} /></Field>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={save}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="space-y-1"><Label className="text-[11px] text-muted-foreground">{label}</Label>{children}</div>
);

const defaultForm = (kind: EditKind): any => {
  if (kind === "visao") return { titulo: "", horizonte: "10-15a", metrica_alvo: NONE, valor_alvo: "", prazo: "" };
  if (kind === "objetivo") return { titulo: "", tipo: "operacional", ano: new Date().getFullYear(), metrica: "", alvo: "" };
  if (kind === "kr") return { descricao: "", tipo: "operacional", trimestre: "", metrica: "", alvo: "" };
  return { descricao: "", status: "todo", quinzena: "", custo_estimado: "" };
};

export default EstrategiaCascade;
