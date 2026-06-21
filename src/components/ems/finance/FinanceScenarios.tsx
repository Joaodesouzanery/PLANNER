import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, Save, Trash2, GitCompare, TrendingUp, Copy, Download, Bookmark } from "lucide-react";
import { addMonths, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useCompany } from "@/contexts/CompanyContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useFinanceData, fmtCurrency, tooltipStyle } from "./useFinanceData";
import { computeProjection } from "./projectionCalc";
import { ResponsiveContainer, BarChart, Bar, CartesianGrid, XAxis, YAxis, Tooltip, Legend } from "recharts";

const PRESETS_KEY = "finance_history_window_presets";
type Preset = { id: string; label: string; window: number };
const loadPresets = (): Preset[] => {
  try { return JSON.parse(localStorage.getItem(PRESETS_KEY) || "[]"); } catch { return []; }
};
const savePresetsLs = (p: Preset[]) => localStorage.setItem(PRESETS_KEY, JSON.stringify(p));

interface Scenario {
  id: string;
  name: string;
  description: string | null;
  recurring_income: number;
  recurring_expense: number;
  history_window: number;
}

const emptyForm = { name: "", description: "", recurring_income: "", recurring_expense: "", history_window: "3" };

const db = supabase as any;

const FinanceScenarios = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { selectedCompanyId } = useCompany();
  const { monthlyData, rawTransactions } = useFinanceData();
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [leftId, setLeftId] = useState<string>("");
  const [rightId, setRightId] = useState<string>("");
  const [presets, setPresets] = useState<Preset[]>(loadPresets);
  const chartRef = useRef<HTMLDivElement>(null);

  useEffect(() => { savePresetsLs(presets); }, [presets]);

  const { data: scenarios = [] } = useQuery({
    queryKey: ["finance-scenarios", selectedCompanyId],
    queryFn: async () => {
      let q = db.from("finance_scenarios").select("*").order("created_at", { ascending: false });
      if (selectedCompanyId !== "all") q = q.eq("company_id", selectedCompanyId);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as Scenario[];
    },
  });

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        name: form.name.trim(),
        description: form.description || null,
        recurring_income: Number(form.recurring_income) || 0,
        recurring_expense: Number(form.recurring_expense) || 0,
        history_window: Number(form.history_window) || 3,
        company_id: selectedCompanyId !== "all" ? selectedCompanyId : null,
      };
      if (editingId) {
        const { error } = await db.from("finance_scenarios").update(payload).eq("id", editingId);
        if (error) throw error;
      } else {
        const { error } = await db.from("finance_scenarios").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["finance-scenarios"] });
      setForm(emptyForm);
      setEditingId(null);
      toast({ title: editingId ? "Cenário atualizado" : "Cenário salvo" });
    },
    onError: (e: any) => toast({ title: "Erro", description: e?.message, variant: "destructive" }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db.from("finance_scenarios").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["finance-scenarios"] });
      toast({ title: "Cenário removido" });
    },
  });

  const duplicate = useMutation({
    mutationFn: async (s: Scenario) => {
      const payload = {
        name: `${s.name} (cópia)`,
        description: s.description,
        recurring_income: s.recurring_income,
        recurring_expense: s.recurring_expense,
        history_window: s.history_window,
        company_id: selectedCompanyId !== "all" ? selectedCompanyId : null,
      };
      const { error } = await db.from("finance_scenarios").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["finance-scenarios"] });
      toast({ title: "Cenário duplicado" });
    },
    onError: (e: any) => toast({ title: "Erro ao duplicar", description: e?.message, variant: "destructive" }),
  });

  const savePresetFromForm = () => {
    const w = Number(form.history_window);
    if (!w) return;
    if (presets.some((p) => p.window === w)) {
      toast({ title: "Preset já existe", description: `Janela de ${w} meses já salva.` });
      return;
    }
    setPresets([...presets, { id: crypto.randomUUID(), label: `${w} meses`, window: w }]);
    toast({ title: "Preset salvo" });
  };


  const futureMonthLabels = useMemo(() => {
    const labels: string[] = [];
    for (let i = 1; i <= 6; i++) labels.push(format(addMonths(new Date(), i), "MMM/yy", { locale: ptBR }));
    return labels;
  }, []);

  const recurringTx = useMemo(() => rawTransactions.map((t) => ({
    id: t.id,
    description: t.description,
    category: t.category ?? null,
    amount: Number(t.amount),
    type: t.type,
    is_recurring: !!t.is_recurring,
    recurrence_interval: t.recurrence_interval ?? null,
  })), [rawTransactions]);

  const projectScenario = (s: Scenario | undefined) => {
    if (!s) return null;
    return computeProjection({
      monthlyData,
      recurringTransactions: recurringTx,
      futureMonthLabels,
      historyWindow: s.history_window,
      recurringOverride: { income: Number(s.recurring_income) || 0, expense: Number(s.recurring_expense) || 0 },
    });
  };

  const left = scenarios.find((s) => s.id === leftId);
  const right = scenarios.find((s) => s.id === rightId);
  const leftRes = projectScenario(left);
  const rightRes = projectScenario(right);

  const compareData = useMemo(() => {
    if (!leftRes || !rightRes) return [];
    const map = new Map<string, any>();
    leftRes.rows.filter((r) => r.projected).forEach((r) => map.set(r.month, { month: r.month, leftBalance: r.balance }));
    rightRes.rows.filter((r) => r.projected).forEach((r) => {
      const existing = map.get(r.month) ?? { month: r.month };
      existing.rightBalance = r.balance;
      map.set(r.month, existing);
    });
    return Array.from(map.values());
  }, [leftRes, rightRes]);

  const startEdit = (s: Scenario) => {
    setEditingId(s.id);
    setForm({
      name: s.name,
      description: s.description ?? "",
      recurring_income: String(s.recurring_income),
      recurring_expense: String(s.recurring_expense),
      history_window: String(s.history_window),
    });
  };

  const exportComparePdf = async () => {
    if (!leftRes || !rightRes || !left || !right) return;
    const [{ default: jsPDF }, { default: autoTable }, html2canvas] = await Promise.all([
      import("jspdf"),
      import("jspdf-autotable"),
      import("html2canvas").then((m) => m.default),
    ]);
    const doc = new jsPDF({ orientation: "landscape" });
    doc.setFontSize(16);
    doc.text(`Comparação de cenários: ${left.name} × ${right.name}`, 14, 16);
    doc.setFontSize(9);
    doc.text(`Gerado em ${new Date().toLocaleString("pt-BR")}`, 14, 22);

    let cursorY = 28;
    if (chartRef.current) {
      try {
        const canvas = await html2canvas(chartRef.current, { backgroundColor: "#0b0f17", scale: 2 });
        const img = canvas.toDataURL("image/png");
        const pageW = doc.internal.pageSize.getWidth() - 28;
        const imgH = (canvas.height * pageW) / canvas.width;
        doc.addImage(img, "PNG", 14, cursorY, pageW, Math.min(imgH, 90));
        cursorY += Math.min(imgH, 90) + 4;
      } catch (err) {
        console.warn("html2canvas falhou", err);
      }
    }

    autoTable(doc, {
      startY: cursorY,
      head: [["Mês", "Receita A", "Despesa A", "Saldo A", "Receita B", "Despesa B", "Saldo B", "Δ Saldo (B−A)", "Δ %"]],
      body: compareData.map((row: any) => {
        const lr = leftRes.rows.find((r) => r.month === row.month);
        const rr = rightRes.rows.find((r) => r.month === row.month);
        const a = row.leftBalance ?? 0;
        const b = row.rightBalance ?? 0;
        const diff = b - a;
        const pct = a !== 0 ? ((diff / Math.abs(a)) * 100).toFixed(1) + "%" : "—";
        return [row.month, fmtCurrency(lr?.income ?? 0), fmtCurrency(lr?.expense ?? 0), fmtCurrency(a), fmtCurrency(rr?.income ?? 0), fmtCurrency(rr?.expense ?? 0), fmtCurrency(b), fmtCurrency(diff), pct];
      }),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [40, 40, 60] },
    });

    autoTable(doc, {
      head: [["Cenário", "Fonte entradas", "Fonte saídas", "Entrada/mês", "Saída/mês", "Janela"]],
      body: [
        [left.name, leftRes.breakdown.incomeSourceUsed, leftRes.breakdown.expenseSourceUsed, fmtCurrency(leftRes.breakdown.chosenIncome), fmtCurrency(leftRes.breakdown.chosenExpense), `${left.history_window}m`],
        [right.name, rightRes.breakdown.incomeSourceUsed, rightRes.breakdown.expenseSourceUsed, fmtCurrency(rightRes.breakdown.chosenIncome), fmtCurrency(rightRes.breakdown.chosenExpense), `${right.history_window}m`],
      ],
      styles: { fontSize: 9 },
    });

    const alerts = [...leftRes.breakdown.alerts.map((a) => `[A] ${a.message}`), ...rightRes.breakdown.alerts.map((a) => `[B] ${a.message}`)];
    if (alerts.length > 0) {
      autoTable(doc, { head: [["Alertas"]], body: alerts.map((m) => [m]), styles: { fontSize: 8 } });
    }
    doc.save(`comparacao-${left.name}-vs-${right.name}.pdf`);
  };


  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Save className="h-4 w-4 text-primary" /> {editingId ? "Editar cenário" : "Novo cenário"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label className="text-xs">Nome</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="ex: Cenário base" />
            </div>
            <div>
              <Label className="text-xs">Janela histórica</Label>
              <div className="flex gap-1">
                <Select value={form.history_window} onValueChange={(v) => setForm({ ...form, history_window: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="3">3 meses</SelectItem>
                    <SelectItem value="6">6 meses</SelectItem>
                    <SelectItem value="12">12 meses</SelectItem>
                    {presets.filter((p) => ![3, 6, 12].includes(p.window)).map((p) => (
                      <SelectItem key={p.id} value={String(p.window)}>{p.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button type="button" variant="outline" size="icon" title="Salvar preset" onClick={savePresetFromForm}>
                  <Bookmark className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div>
              <Label className="text-xs">Renda recorrente / mês (R$)</Label>
              <Input type="number" value={form.recurring_income} onChange={(e) => setForm({ ...form, recurring_income: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs">Despesa fixa / mês (R$)</Label>
              <Input type="number" value={form.recurring_expense} onChange={(e) => setForm({ ...form, recurring_expense: e.target.value })} />
            </div>
          </div>
          <div>
            <Label className="text-xs">Descrição</Label>
            <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="h-16" placeholder="Hipóteses, premissas..." />
          </div>
          <div className="flex gap-2">
            <Button onClick={() => save.mutate()} disabled={!form.name.trim() || save.isPending}>
              <Plus className="h-4 w-4 mr-1" /> {editingId ? "Salvar alterações" : "Adicionar cenário"}
            </Button>
            {editingId && (
              <Button variant="outline" onClick={() => { setEditingId(null); setForm(emptyForm); }}>Cancelar</Button>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Cenários salvos ({scenarios.length})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {scenarios.length === 0 ? (
            <p className="py-4 text-sm text-muted-foreground text-center">Nenhum cenário salvo ainda.</p>
          ) : scenarios.map((s) => (
            <div key={s.id} className="flex items-center gap-2 rounded-lg border p-3">
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{s.name}</p>
                <p className="text-xs text-muted-foreground">
                  Entrada {fmtCurrency(Number(s.recurring_income))} · Saída {fmtCurrency(Number(s.recurring_expense))} · Janela {s.history_window}m
                </p>
                {s.description && <p className="text-[11px] text-muted-foreground mt-1 line-clamp-2">{s.description}</p>}
              </div>
              <Button size="sm" variant="outline" onClick={() => startEdit(s)}>Editar</Button>
              <Button size="sm" variant="ghost" title="Duplicar" onClick={() => duplicate.mutate(s)} disabled={duplicate.isPending}>
                <Copy className="h-4 w-4" />
              </Button>
              <Button size="sm" variant="ghost" className="text-destructive" onClick={() => remove.mutate(s.id)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <GitCompare className="h-4 w-4 text-primary" /> Comparar 2 cenários
          </CardTitle>
          <Button size="sm" variant="outline" disabled={!leftRes || !rightRes} onClick={exportComparePdf} className="gap-1">
            <Download className="h-3.5 w-3.5" /> PDF A×B
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label className="text-xs">Cenário A</Label>
              <Select value={leftId} onValueChange={setLeftId}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>{scenarios.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Cenário B</Label>
              <Select value={rightId} onValueChange={setRightId}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>{scenarios.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>

          {leftRes && rightRes && (
            <>
              <div className="grid gap-2 sm:grid-cols-2">
                <div className="rounded-lg border p-3 space-y-1">
                  <p className="text-sm font-semibold flex items-center gap-2"><Badge>A</Badge> {left?.name}</p>
                  <p className="text-xs text-muted-foreground">Entrada/mês usada: <span className="font-mono text-emerald-400">{fmtCurrency(leftRes.breakdown.chosenIncome)}</span></p>
                  <p className="text-xs text-muted-foreground">Saída/mês usada: <span className="font-mono text-destructive">{fmtCurrency(leftRes.breakdown.chosenExpense)}</span></p>
                </div>
                <div className="rounded-lg border p-3 space-y-1">
                  <p className="text-sm font-semibold flex items-center gap-2"><Badge variant="secondary">B</Badge> {right?.name}</p>
                  <p className="text-xs text-muted-foreground">Entrada/mês usada: <span className="font-mono text-emerald-400">{fmtCurrency(rightRes.breakdown.chosenIncome)}</span></p>
                  <p className="text-xs text-muted-foreground">Saída/mês usada: <span className="font-mono text-destructive">{fmtCurrency(rightRes.breakdown.chosenExpense)}</span></p>
                </div>
              </div>

              <div className="h-[280px]" ref={chartRef}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={compareData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
                    <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => fmtCurrency(v)} />
                    <Legend />
                    <Bar dataKey="leftBalance" name={`Saldo — ${left?.name}`} fill="hsl(var(--primary))" radius={[4,4,0,0]} />
                    <Bar dataKey="rightBalance" name={`Saldo — ${right?.name}`} fill="hsl(142.1, 76.2%, 36.3%)" radius={[4,4,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b text-muted-foreground">
                      <th className="text-left py-1.5">Mês</th>
                      <th className="text-right">Saldo A</th>
                      <th className="text-right">Saldo B</th>
                      <th className="text-right">Diferença (B − A)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {compareData.map((row) => {
                      const diff = (row.rightBalance ?? 0) - (row.leftBalance ?? 0);
                      return (
                        <tr key={row.month} className="border-b border-border/50">
                          <td className="py-1.5 font-mono">{row.month}</td>
                          <td className="text-right font-mono">{fmtCurrency(row.leftBalance ?? 0)}</td>
                          <td className="text-right font-mono">{fmtCurrency(row.rightBalance ?? 0)}</td>
                          <td className={`text-right font-mono ${diff >= 0 ? "text-emerald-400" : "text-destructive"}`}>{diff >= 0 ? "+" : ""}{fmtCurrency(diff)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {(!leftRes || !rightRes) && (
            <p className="py-6 text-sm text-muted-foreground text-center flex flex-col items-center gap-2">
              <TrendingUp className="h-6 w-6 text-muted-foreground/40" />
              Selecione 2 cenários acima para comparar mês a mês.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default FinanceScenarios;
