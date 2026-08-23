import { useEffect, useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { UserRound, Plus, Trash2, SlidersHorizontal, Landmark, CalendarClock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { fmtCurrency } from "@/components/ems/finance/useFinanceData";
import { useConfigTimeline } from "@/components/ems/finance/useConfigTimeline";
import { useFinanceSettings } from "@/components/ems/finance/useFinanceSettings";
import { useCategoryBudgets } from "@/components/ems/finance/useCategoryBudgets";
import { CATEGORIES_PF } from "@/components/ems/finance/financeCategories";

const fmtVig = (d: string) => format(new Date(d + "T00:00:00"), "dd/MM/yyyy", { locale: ptBR });

// Aba "Config": a superfície de controle datada/editável. Escreve nas tabelas de finanças (fonte única);
// o Finanças/DRE só LÊ. Direção: cockpit edita → Finanças deriva → cascata lê os números reais.
export const EstrategiaConfig = () => {
  return (
    <div className="space-y-5">
      <ProLaboreTimeline />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <TetosEditor />
        <PjSettings />
      </div>
    </div>
  );
};

// ── Linha do tempo do pró-labore ──────────────────────────────────────────────────────────────
const ProLaboreTimeline = () => {
  const cfg = useConfigTimeline();
  const rows = cfg.byKey("prolabore");
  const [valor, setValor] = useState("");
  const [data, setData] = useState("");

  const add = () => {
    if (!valor || !data) return;
    cfg.saveValue.mutate({ key: "prolabore", value: Number(valor), effective_date: data });
    setValor(""); setData("");
  };

  return (
    <Card className="border-border/50 bg-card/60">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-1.5"><UserRound className="h-4 w-4 text-primary" />Pró-labore · linha do tempo</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-[11px] text-muted-foreground">
          Sua retirada mensal (PJ→PF). Cada vigência vale a partir da data — o DRE de cada mês usa o valor certo.
          Ex.: <span className="text-foreground">2.310 hoje → 3.500 em jan/27</span>.
        </p>
        {rows.length === 0 ? (
          <p className="text-xs text-muted-foreground italic">Nenhuma vigência ainda. Adicione a primeira abaixo.</p>
        ) : (
          <div className="space-y-1">
            {rows.map((r) => (
              <div key={r.id} className="flex items-center gap-2 py-1.5 px-2 rounded-md hover:bg-muted/30 group">
                <CalendarClock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <span className="text-xs text-muted-foreground">a partir de {fmtVig(r.effective_date)}</span>
                <span className="ml-auto font-mono text-sm font-semibold">{fmtCurrency(Number(r.value))}</span>
                {r.note ? <span className="text-[10px] text-muted-foreground hidden sm:inline">· {r.note}</span> : null}
                <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100" onClick={() => cfg.deleteValue.mutate(r.id)}><Trash2 className="h-3 w-3" /></Button>
              </div>
            ))}
          </div>
        )}
        <div className="flex items-end gap-2 border-t border-border/40 pt-3">
          <div className="space-y-1"><Label className="text-[11px] text-muted-foreground">Valor (R$)</Label><Input type="number" value={valor} onChange={(e) => setValor(e.target.value)} placeholder="3500" className="h-8 w-28" /></div>
          <div className="space-y-1"><Label className="text-[11px] text-muted-foreground">A partir de</Label><Input type="date" value={data} onChange={(e) => setData(e.target.value)} className="h-8 w-40" /></div>
          <Button size="sm" onClick={add} disabled={!valor || !data} className="h-8 gap-1"><Plus className="h-3.5 w-3.5" />Adicionar vigência</Button>
        </div>
      </CardContent>
    </Card>
  );
};

// ── Tetos com seletor de mês ──────────────────────────────────────────────────────────────────
const TetosEditor = () => {
  const [month, setMonth] = useState(() => format(new Date(), "yyyy-MM"));
  const [y, m] = month.split("-").map(Number);
  const budgets = useCategoryBudgets(y, m);
  const byCat = new Map(budgets.budgets.map((b) => [b.category, b.teto]));
  const [draft, setDraft] = useState<Record<string, string>>({});
  useEffect(() => { setDraft({}); }, [month]); // troca de mês limpa rascunhos não salvos

  const save = (category: string) => {
    const v = draft[category];
    if (v === undefined || v === "") return;
    budgets.setTeto.mutate({ category, teto: Number(v) });
    setDraft((d) => { const n = { ...d }; delete n[category]; return n; });
  };

  return (
    <Card className="border-border/50 bg-card/60">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-sm flex items-center gap-1.5"><SlidersHorizontal className="h-4 w-4 text-primary" />Tetos (por mês)</CardTitle>
          <Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="h-8 w-36" />
        </div>
      </CardHeader>
      <CardContent className="space-y-1.5">
        <p className="text-[11px] text-muted-foreground">Limite mensal por categoria PF. Cada mês tem seu teto — dá pra setar meses futuros (ex.: baixar Lazer de 1.100 pra 800).</p>
        {CATEGORIES_PF.filter((c) => c.type === "expense").map((c) => {
          const cur = byCat.get(c.name);
          const val = draft[c.name] ?? (cur != null ? String(cur) : "");
          return (
            <div key={c.name} className="flex items-center gap-2">
              <span className="text-xs flex-1 truncate">{c.name}</span>
              <Input type="number" value={val} onChange={(e) => setDraft((d) => ({ ...d, [c.name]: e.target.value }))} onBlur={() => save(c.name)} placeholder="—" className="h-7 w-24 text-right font-mono text-xs" />
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
};

// ── Settings da PJ (regime, alíquota, meses de reserva) ───────────────────────────────────────
const PjSettings = () => {
  const { settings, save } = useFinanceSettings();
  const [form, setForm] = useState({
    tax_regime: settings.tax_regime ?? "simples",
    tax_rate: settings.tax_rate != null ? String(settings.tax_rate) : "6",
    reserve_months: settings.reserve_months != null ? String(settings.reserve_months) : "6",
  });
  // Sincroniza quando o settings carrega (assíncrono) — senão o form fica nos defaults.
  useEffect(() => {
    setForm({
      tax_regime: settings.tax_regime ?? "simples",
      tax_rate: settings.tax_rate != null ? String(settings.tax_rate) : "6",
      reserve_months: settings.reserve_months != null ? String(settings.reserve_months) : "6",
    });
  }, [settings.tax_regime, settings.tax_rate, settings.reserve_months]);
  const salvar = () => save.mutate({
    tax_regime: form.tax_regime,
    tax_rate: form.tax_rate === "" ? null : Number(form.tax_rate),
    reserve_months: form.reserve_months === "" ? null : Number(form.reserve_months),
  });

  return (
    <Card className="border-border/50 bg-card/60">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-1.5"><Landmark className="h-4 w-4 text-primary" />Empresa / imposto</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-1">
          <Label className="text-[11px] text-muted-foreground">Regime</Label>
          <Select value={form.tax_regime} onValueChange={(v) => setForm((f) => ({ ...f, tax_regime: v }))}>
            <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="simples">Simples Nacional</SelectItem>
              <SelectItem value="presumido">Lucro Presumido</SelectItem>
              <SelectItem value="mei">MEI</SelectItem>
              <SelectItem value="pf">Pessoa Física</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1"><Label className="text-[11px] text-muted-foreground">Alíquota efetiva (%)</Label><Input type="number" value={form.tax_rate} onChange={(e) => setForm((f) => ({ ...f, tax_rate: e.target.value }))} className="h-8" /></div>
          <div className="space-y-1"><Label className="text-[11px] text-muted-foreground">Reserva (meses)</Label><Input type="number" value={form.reserve_months} onChange={(e) => setForm((f) => ({ ...f, reserve_months: e.target.value }))} className="h-8" /></div>
        </div>
        <p className="text-[10px] text-muted-foreground">DAS entra como despesa recorrente (cai na dedução da DRE). O alvo de reserva = meses × custo mensal — sobe sozinho quando o custo cresce (ex.: aluguel).</p>
        <Button size="sm" onClick={salvar} disabled={save.isPending}>Salvar</Button>
      </CardContent>
    </Card>
  );
};

export default EstrategiaConfig;
