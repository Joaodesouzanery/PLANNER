import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { PiggyBank, Target, TrendingUp, AlertTriangle, Database, Gift } from "lucide-react";
import { Area, AreaChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { fmtCurrency, tooltipStyle } from "./useFinanceData";
import { useFinanceWorkspace } from "./useFinanceWorkspace";
import { useFinanceSettings } from "./useFinanceSettings";
import { usePatrimonio } from "./usePatrimonio";
import { computeCfo } from "./financeCfo";
import { mrate, targetFor, monthsTo, reqY, series } from "./retirement";

const todayIso = () => format(new Date(), "yyyy-MM-dd");
const brl0 = (v: number) => `R$ ${Math.round(v).toLocaleString("pt-BR")}`;
const brlK = (v: number) => (v >= 1e6 ? `R$ ${(v / 1e6).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}M` : v >= 1000 ? `R$ ${Math.round(v / 1000)}k` : `R$ ${Math.round(v)}`);
const oneDec = (v: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

type Mode = "A" | "B";
const KEY = "fin-aposentadoria";
interface Saved { mode: Mode; age: number; Y: number; Z: number; P0: number; R: number; swr: number; ageT: number; income: number }
const DEFAULTS: Saved = { mode: "A", age: 23, Y: 4000, Z: 15000, P0: 0, R: 4, swr: 3.5, ageT: 50, income: 8250 };
const load = (): Saved => { try { return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) || "{}") }; } catch { return DEFAULTS; } };

const Seg = ({ opts, value, onChange }: { opts: [string, string][]; value: string; onChange: (v: string) => void }) => (
  <div className="inline-flex w-full rounded-lg border border-border/50 bg-background/40 p-0.5">
    {opts.map(([v, l]) => (
      <button key={v} onClick={() => onChange(v)} className={cn("flex-1 rounded-md px-2 py-1.5 text-xs transition-colors", value === v ? "bg-primary text-primary-foreground font-medium" : "text-muted-foreground hover:text-foreground")}>{l}</button>
    ))}
  </div>
);

const Kpi = ({ label, value, hint, big, tone }: { label: string; value: string; hint?: string; big?: boolean; tone?: string }) => (
  <div className={cn("rounded-xl border p-4", big ? "border-primary/30 bg-primary/5" : "border-border/50 bg-background/40")}>
    <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
    <p className={cn("mt-1 font-mono font-bold leading-tight", big ? "text-2xl" : "text-xl", tone)}>{value}</p>
    {hint && <p className="mt-1 text-[11px] text-muted-foreground">{hint}</p>}
  </div>
);

export const FinanceAposentadoria = () => {
  const init = load();
  const [mode, setMode] = useState<Mode>(init.mode);
  const [age, setAge] = useState(init.age);
  const [Y, setY] = useState(init.Y);
  const [Z, setZ] = useState(init.Z);
  const [P0, setP0] = useState(init.P0);
  const [R, setR] = useState(init.R);
  const [swr, setSwr] = useState(init.swr);
  const [ageT, setAgeT] = useState(init.ageT);
  const [income, setIncome] = useState(init.income);

  useEffect(() => {
    try { localStorage.setItem(KEY, JSON.stringify({ mode, age, Y, Z, P0, R, swr, ageT, income })); } catch { /* noop */ }
  }, [mode, age, Y, Z, P0, R, swr, ageT, income]);

  // Dado REAL do usuário (sobra + patrimônio + faturamento) — pré-preenche via "Usar meu dado".
  const ws = useFinanceWorkspace();
  const { settings } = useFinanceSettings();
  const patr = usePatrimonio();
  const cfo = useMemo(() => computeCfo(ws.canonical.rows, settings, ws.reserveBalance, todayIso(), ws.expectedMonthly), [ws.canonical.rows, settings, ws.reserveBalance, ws.expectedMonthly]);
  const sobraReal = Math.max(0, Math.round(cfo.sobraMensal || 0));
  const faturamentoReal = Math.round(cfo.faturamentoMensal || 0);
  const investivelReal = useMemo(() => {
    const ativos = (patr.items || []).filter((i: any) => i.kind === "asset").reduce((a: number, i: any) => a + Number(i.value), 0);
    return Math.max(0, Math.round((ws.canonical.saldoRealHoje || 0) + ativos));
  }, [patr.items, ws.canonical.saldoRealHoje]);
  const usarMeuDado = () => { setY(sobraReal); setP0(investivelReal); if (faturamentoReal > 0) setIncome(faturamentoReal); };

  // Motor.
  const r = mrate(R);
  const target = targetFor(Z, swr);
  const { months, retAge, Yeff } = useMemo(() => {
    if (mode === "A") {
      const m = monthsTo(target, P0, Y, r);
      return { months: m, retAge: m === Infinity ? null : age + m / 12, Yeff: Y };
    }
    const m = Math.max(1, (ageT - age) * 12);
    return { months: m, retAge: ageT, Yeff: reqY(target, P0, m, r) };
  }, [mode, target, P0, Y, r, age, ageT]);

  const chartMonths = months === Infinity ? 100 * 12 : months;
  const data = useMemo(() => series(P0, Yeff, r, chartMonths).map((p) => ({ age: Math.round((age + p.m / 12) * 10) / 10, v: p.v })), [P0, Yeff, r, chartMonths, age]);
  const crossAge = retAge != null ? Math.round((retAge) * 10) / 10 : null;

  const sens = useMemo(() => [3000, 4000, 6000, 8000, 12000].map((y) => {
    const m = monthsTo(target, P0, y, r);
    return { y, m, age: m === Infinity ? null : age + m / 12 };
  }), [target, P0, r, age]);

  // Máximo adaptativo do slider de poupança: nunca fica abaixo do Y atual (ex.: sobra real > 15k),
  // senão o Radix cortaria o valor pré-preenchido na 1ª interação.
  const yMax = Math.max(15000, Math.ceil(Y / 1000) * 1000);
  const pctRenda = income > 0 ? Math.round((Yeff / income) * 100) : 0;
  const warns: string[] = [];
  if (R > 6) warns.push(`Você está usando ${oneDec(R)}% real — otimista para 40 anos. O real de hoje (~9%) é pico de juros; a média sustentável fica entre 3 e 5%.`);
  if (swr >= 4) warns.push("Retirada de 4% assume ~30 anos de aposentadoria. Aposentando cedo (renda por 40–50 anos), prefira 3–3,5% — senão o dinheiro pode acabar.");
  if (mode === "A" && retAge != null && retAge > 65) warns.push("Nesse ritmo você se aposenta depois dos 65 — considere aumentar a poupança ou a renda (o efeito é grande, veja a tabela).");
  warns.push(`Você não contribui ao INSS: os ${brl0(Z)}/mês saem 100% do seu bolso. Se um dia contribuir, parte disso abate do alvo.`);

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[340px_minmax(0,1fr)]">
      {/* CONTROLES */}
      <Card className="h-fit">
        <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><PiggyBank className="h-4 w-4 text-primary" />Suas premissas</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <Button variant="outline" size="sm" className="w-full gap-2" onClick={usarMeuDado} title={`Sobra ${brl0(sobraReal)}/mês · investível ${brl0(investivelReal)}`}>
            <Database className="h-4 w-4" /> Usar meu dado real
          </Button>

          <div><Label className="text-xs text-muted-foreground">Modo</Label><Seg opts={[["A", "Poupo → vejo a idade"], ["B", "Quero idade → vejo o quanto"]]} value={mode} onChange={(v) => setMode(v as Mode)} /></div>

          <div className="grid grid-cols-2 gap-2">
            <div><Label className="text-xs text-muted-foreground">Idade hoje</Label><Input type="number" value={age} onChange={(e) => setAge(Number(e.target.value) || 0)} className="mt-1 font-mono" /></div>
            <div><Label className="text-xs text-muted-foreground">Já investido</Label><Input type="number" value={P0} onChange={(e) => setP0(Number(e.target.value) || 0)} className="mt-1 font-mono" /></div>
          </div>

          {mode === "A" ? (
            <div>
              <Label className="text-xs text-muted-foreground flex justify-between">Poupo por mês <span className="font-mono text-primary">{brl0(Y)}</span></Label>
              <Slider value={[Y]} min={0} max={yMax} step={250} onValueChange={(v) => setY(v[0])} className="mt-2" />
            </div>
          ) : (
            <div>
              <Label className="text-xs text-muted-foreground flex justify-between">Quero me aposentar aos <span className="font-mono text-primary">{ageT}</span></Label>
              <Slider value={[ageT]} min={30} max={75} step={1} onValueChange={(v) => setAgeT(v[0])} className="mt-2" />
            </div>
          )}

          <div><Label className="text-xs text-muted-foreground">Renda-alvo na aposentadoria (hoje/mês)</Label><Input type="number" value={Z} onChange={(e) => setZ(Number(e.target.value) || 0)} className="mt-1 font-mono" /></div>

          <div>
            <Label className="text-xs text-muted-foreground flex justify-between">Retorno REAL ao ano <span className="font-mono text-primary">{oneDec(R)}%</span></Label>
            <Slider value={[R]} min={2} max={9} step={0.25} onValueChange={(v) => setR(v[0])} className="mt-2" />
            <p className="mt-1 text-[10px] text-muted-foreground">Acima da inflação. Padrão 4% (conservador p/ 40 anos).</p>
          </div>

          <div><Label className="text-xs text-muted-foreground">Taxa de retirada segura</Label><Seg opts={[["3", "3,0%"], ["3.5", "3,5%"], ["4", "4,0%"]]} value={String(swr)} onChange={(v) => setSwr(Number(v))} /></div>
        </CardContent>
      </Card>

      {/* SAÍDA */}
      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {mode === "A" ? (
            <Kpi big label="Idade de aposentadoria" tone={retAge == null ? "text-destructive" : "text-primary"}
              value={retAge == null ? "nunca" : `${oneDec(retAge)} anos`}
              hint={retAge == null ? "nesse ritmo não chega — aumente a poupança" : `${oneDec(months / 12)} anos guardando ${brl0(Y)}/mês`} />
          ) : (
            <Kpi big label="Poupança necessária/mês" tone="text-primary" value={brl0(Yeff)}
              hint={`para se aposentar aos ${ageT} (${Math.round(months / 12)} anos) · ~${pctRenda}% de ${brl0(income)}`} />
          )}
          <Kpi label="Montante necessário" value={brlK(target)} hint={`gera ${brl0(Z)}/mês a ${oneDec(swr)}%`} />
        </div>

        <Card>
          <CardHeader className="pb-1"><CardTitle className="text-sm text-muted-foreground flex items-center gap-2"><TrendingUp className="h-4 w-4" />Trajetória do patrimônio (em R$ de hoje)</CardTitle></CardHeader>
          <CardContent>
            <div className="h-[260px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data} margin={{ top: 8, right: 12, left: 4, bottom: 0 }}>
                  <defs><linearGradient id="apoFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.35} /><stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0.02} /></linearGradient></defs>
                  <CartesianGrid strokeDasharray="3 4" stroke="hsl(var(--border))" />
                  <XAxis dataKey="age" type="number" domain={["dataMin", "dataMax"]} stroke="hsl(var(--muted-foreground))" fontSize={11} tickFormatter={(v) => `${Math.round(v)}`} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickFormatter={brlK} width={54} />
                  <Tooltip contentStyle={tooltipStyle} formatter={(v: any) => [fmtCurrency(Number(v)), "Patrimônio"]} labelFormatter={(v) => `${oneDec(Number(v))} anos`} />
                  <ReferenceLine y={target} stroke="hsl(var(--primary))" strokeDasharray="5 4" label={{ value: `meta ${brlK(target)}`, position: "insideTopRight", fill: "hsl(var(--primary))", fontSize: 11 }} />
                  {crossAge != null && <ReferenceLine x={crossAge} stroke="hsl(142.1, 76.2%, 36.3%)" strokeDasharray="3 3" label={{ value: `${Math.round(crossAge)} anos`, position: "top", fill: "hsl(142.1, 76.2%, 36.3%)", fontSize: 11 }} />}
                  <Area type="monotone" dataKey="v" stroke="hsl(var(--primary))" strokeWidth={2.5} fill="url(#apoFill)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Target className="h-4 w-4 text-primary" />E se eu poupar mais ou menos? (mesma meta de {brl0(Z)}/mês)</CardTitle></CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader><TableRow><TableHead className="text-xs">Poupança/mês</TableHead><TableHead className="text-xs text-right">Idade ao aposentar</TableHead><TableHead className="text-xs text-right">Anos guardando</TableHead></TableRow></TableHeader>
              <TableBody>
                {sens.map((row) => (
                  <TableRow key={row.y} className="hover:bg-muted/30">
                    <TableCell className="font-mono text-sm">{brl0(row.y)}</TableCell>
                    <TableCell className={cn("text-right font-mono text-sm", row.age == null && "text-destructive")}>{row.age == null ? "nunca" : `${oneDec(row.age)} anos`}</TableCell>
                    <TableCell className={cn("text-right font-mono text-sm", row.age == null ? "text-destructive" : "text-muted-foreground")}>{row.m === Infinity ? "nunca chega" : `${oneDec(row.m / 12)}`}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <div className="rounded-xl border border-primary/25 bg-primary/5 p-3 text-sm flex items-start gap-2">
          <Gift className="h-4 w-4 text-primary shrink-0 mt-0.5" />
          <p>{mode === "A"
            ? <>Guardar <b>{brl0(Y)}/mês</b> (~{pctRenda}% de {brl0(income)}) te leva ao alvo de <b>{brlK(target)}</b>. </>
            : <>Guardar <b>{brl0(Yeff)}/mês</b> é o que a meta exige. </>}
            Esse montante rende <b>{brl0(Z)}/mês</b> para sempre a {oneDec(swr)}% — sua independência financeira.</p>
        </div>

        <div className="rounded-xl border border-amber-500/25 bg-amber-500/5 p-3 text-sm text-amber-200/90 space-y-2">
          <p className="flex items-center gap-2 font-medium text-amber-300"><AlertTriangle className="h-4 w-4" />O que encarar (muda tudo em prazo longo)</p>
          {warns.map((w, i) => <p key={i} className="text-[13px]" dangerouslySetInnerHTML={{ __html: w.replace(/(\d[\d.,]*%|R\$ [\d.,]+)/g, "<b>$1</b>") }} />)}
        </div>

        <p className="text-[11px] text-muted-foreground leading-relaxed">
          Tudo em <b>poder de compra de hoje</b> (retorno já líquido de inflação). Ferramenta educativa de projeção, não recomendação de investimento — para alocação, PGBL/VGBL e regime de IR, consulte um planejador (CFP).
        </p>
      </div>
    </div>
  );
};

export default FinanceAposentadoria;
