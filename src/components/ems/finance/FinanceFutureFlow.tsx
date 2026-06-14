import { useMemo, useRef, useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  AlertTriangle, ArrowDownRight, ArrowRightLeft, ArrowUpRight, Building2, CalendarClock,
  CheckCircle2, CircleDollarSign, CreditCard, FileUp, Landmark, Plus, ShieldCheck, Wallet,
} from "lucide-react";
import { Area, AreaChart, CartesianGrid, Legend, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { fmtCurrency, formatDateBR } from "./useFinanceData";
import { useFinanceWorkspace } from "./useFinanceWorkspace";
import type { FinanceAccount, FinanceCardInvoice, ForecastEvent } from "./financeTypes";

const dateLabel = (date: string) => format(new Date(`${date}T12:00:00`), "dd MMM", { locale: ptBR });

const FinanceFutureFlow = () => {
  const workspace = useFinanceWorkspace();
  const fileRef = useRef<HTMLInputElement>(null);
  const [dialog, setDialog] = useState<"transaction" | "account" | "transfer" | "invoice" | null>(null);
  const [transactionKind, setTransactionKind] = useState<"income" | "expense">("expense");
  const [transactionForm, setTransactionForm] = useState({ description: "", amount: 0, category: "", due_date: format(new Date(), "yyyy-MM-dd"), finance_account_id: "", status: "planned" });
  const [accountForm, setAccountForm] = useState({ entity_id: "", name: "", account_type: "checking", opening_balance: 0, credit_limit: 0, closing_day: 10, due_day: 17 });
  const [transferForm, setTransferForm] = useState({ from_account_id: "", to_account_id: "", amount: 0, transfer_date: format(new Date(), "yyyy-MM-dd"), description: "", status: "confirmed" });
  const [invoiceForm, setInvoiceForm] = useState({ card_account_id: "", period_start: format(new Date(new Date().getFullYear(), new Date().getMonth(), 1), "yyyy-MM-dd"), period_end: format(new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0), "yyyy-MM-dd"), closing_date: format(new Date(), "yyyy-MM-dd"), due_date: format(new Date(), "yyyy-MM-dd"), amount: 0, status: "open" });
  const [timelineAccount, setTimelineAccount] = useState("all");
  const [timelineSource, setTimelineSource] = useState("all");

  const chartData = useMemo(() => workspace.forecast90.days.map((day) => ({
    ...day,
    label: dateLabel(day.date),
  })), [workspace.forecast90.days]);

  const timelineEvents = useMemo(() => workspace.filteredEvents
    .filter((event) => event.date >= workspace.forecast90.startDate && event.date <= workspace.forecast90.endDate)
    .filter((event) => timelineAccount === "all" || event.accountId === timelineAccount)
    .filter((event) => timelineSource === "all" || event.sourceType === timelineSource)
    .sort((a, b) => a.date.localeCompare(b.date)), [timelineAccount, timelineSource, workspace.filteredEvents, workspace.forecast90]);

  const cnpjIndicators = useMemo(() => {
    const expenses = workspace.filteredEvents.filter((event) => event.kind === "expense" && event.date <= workspace.forecast90.endDate);
    const sumBy = (terms: string[]) => expenses.filter((event) => terms.some((term) => `${event.category || ""} ${event.description}`.toLocaleLowerCase("pt-BR").includes(term))).reduce((sum, event) => sum + event.amount, 0);
    return {
      taxes: sumBy(["imposto", "tribut", "das", "simples"]),
      proLabore: sumBy(["pro-labore", "pró-labore", "pro labore"]),
      distributions: sumBy(["distribuição", "distribuicao", "lucro"]),
      personalTransfers: workspace.filteredEvents.filter((event) => event.sourceType === "transfer").reduce((sum, event) => sum + (event.kind === "transfer_out" ? event.amount : 0), 0),
    };
  }, [workspace.filteredEvents, workspace.forecast90.endDate]);

  const openTransaction = (kind: "income" | "expense", accountId = "") => {
    setTransactionKind(kind);
    setTransactionForm({ description: "", amount: 0, category: "", due_date: format(new Date(), "yyyy-MM-dd"), finance_account_id: accountId || workspace.selectedAccounts[0]?.id || "", status: "planned" });
    setDialog("transaction");
  };

  const saveTransaction = () => {
    const account = workspace.accounts.find((item) => item.id === transactionForm.finance_account_id);
    workspace.saveTransactionMutation.mutate({ form: {
      ...transactionForm,
      type: transactionKind,
      date: transactionForm.due_date,
      company_id: account?.company_id || null,
      source_type: "manual",
    } }, { onSuccess: () => setDialog(null) });
  };

  const confirmEvent = (event: ForecastEvent) => {
    if (event.sourceType === "transaction") workspace.reconcileTransactionMutation.mutate(event.sourceId || event.id);
    if (event.sourceType === "plan") {
      const item = workspace.planItems.find((planItem) => planItem.id === event.sourceId);
      if (item) workspace.confirmPlanItemMutation.mutate(item);
    }
  };

  const handleCsv = async (file?: File) => {
    if (!file || !workspace.selectedAccounts[0]) return;
    const content = await file.text();
    workspace.importCsvMutation.mutate({ content, accountId: workspace.selectedAccounts[0].id });
  };

  const payInvoice = (invoice: FinanceCardInvoice) => {
    const source = workspace.selectedAccounts.find((account) => account.account_type !== "credit_card");
    if (!source) return;
    workspace.payInvoiceMutation.mutate({ invoice, fromAccountId: source.id });
  };

  if (workspace.entitiesError) {
    return (
      <Card className="border-amber-500/30 bg-amber-500/5">
        <CardContent className="p-8 text-center">
          <AlertTriangle className="h-10 w-10 text-amber-500 mx-auto mb-3" />
          <h3 className="font-semibold">Estrutura financeira ainda nao aplicada</h3>
          <p className="text-sm text-muted-foreground mt-1">Aplique a migration <code>20260614120000_finance_workspace_cpf_cnpj.sql</code> no Supabase.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col xl:flex-row gap-3 xl:items-center xl:justify-between">
        <div className="flex flex-wrap gap-2 items-center">
          <Select value={workspace.scope} onValueChange={workspace.setScope}>
            <SelectTrigger className="w-[230px] rounded-xl"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="personal"><span className="flex items-center gap-2"><Wallet className="h-3.5 w-3.5" />Pessoal (CPF)</span></SelectItem>
              {workspace.entities.filter((entity) => entity.entity_type === "cnpj").map((entity) => <SelectItem key={entity.id} value={entity.id}>{entity.name} (CNPJ)</SelectItem>)}
              <SelectItem value="consolidated">Visao consolidada</SelectItem>
            </SelectContent>
          </Select>
          <Badge variant="outline" className="h-9 px-3">{workspace.selectedAccounts.length} contas</Badge>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={() => openTransaction("income")}><ArrowUpRight className="h-4 w-4 mr-1 text-emerald-500" />Entrada</Button>
          <Button size="sm" variant="outline" onClick={() => openTransaction("expense")}><ArrowDownRight className="h-4 w-4 mr-1 text-destructive" />Saida</Button>
          <Button size="sm" variant="outline" onClick={() => setDialog("transfer")}><ArrowRightLeft className="h-4 w-4 mr-1" />Transferir</Button>
          <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()}><FileUp className="h-4 w-4 mr-1" />Importar CSV</Button>
          <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={(event) => handleCsv(event.target.files?.[0])} />
          <Button size="sm" onClick={() => { setAccountForm({ ...accountForm, entity_id: workspace.selectedEntity?.id || workspace.entities[0]?.id || "" }); setDialog("account"); }}><Plus className="h-4 w-4 mr-1" />Conta</Button>
        </div>
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-5 gap-3">
        <Metric label="Saldo disponivel" value={fmtCurrency(workspace.openingBalance)} icon={Wallet} tone={workspace.openingBalance >= 0 ? "positive" : "negative"} />
        <Metric label="Menor saldo em 90 dias" value={fmtCurrency(workspace.forecast90.minimumBalance)} hint={formatDateBR(workspace.forecast90.minimumBalanceDate)} icon={AlertTriangle} tone={workspace.forecast90.minimumBalance >= 0 ? "positive" : "negative"} />
        <Metric label="Falta pagar (45 dias)" value={fmtCurrency(workspace.upcomingPayables.reduce((sum, item) => sum + item.amount, 0))} hint={`${workspace.upcomingPayables.length} compromissos`} icon={CalendarClock} tone="warning" />
        <Metric label="Reserva" value={fmtCurrency(workspace.reserveBalance)} icon={ShieldCheck} tone="primary" />
        <Metric label="Saldo esperado em 90 dias" value={fmtCurrency(workspace.forecast90.days.at(-1)?.expected || workspace.openingBalance)} icon={CircleDollarSign} tone="primary" />
      </div>

      {workspace.forecast90.firstNegativeDate && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 flex items-center gap-3 text-sm">
          <AlertTriangle className="h-5 w-5 text-destructive" />
          <span>O saldo-base fica negativo em <strong>{formatDateBR(workspace.forecast90.firstNegativeDate)}</strong>. Revise os pagamentos anteriores a essa data.</span>
        </div>
      )}

      {workspace.selectedEntity?.entity_type === "cnpj" && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[["Impostos reservados", cnpjIndicators.taxes], ["Pro-labore", cnpjIndicators.proLabore], ["Distribuicao de lucros", cnpjIndicators.distributions], ["Transferencias para CPF", cnpjIndicators.personalTransfers]].map(([label, value]) => (
            <div key={String(label)} className="rounded-xl border border-border/50 bg-card/60 p-3"><p className="text-xs text-muted-foreground">{label}</p><p className="font-bold font-mono mt-1">{fmtCurrency(Number(value))}</p></div>
          ))}
        </div>
      )}

      <Tabs defaultValue="horizon" className="space-y-4">
        <TabsList className="grid grid-cols-4 w-full max-w-2xl">
          <TabsTrigger value="horizon">Horizonte</TabsTrigger>
          <TabsTrigger value="accounts">Contas</TabsTrigger>
          <TabsTrigger value="cards">Cartoes</TabsTrigger>
          <TabsTrigger value="timeline">Linha do tempo</TabsTrigger>
        </TabsList>

        <TabsContent value="horizon" className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Saldo futuro: base e cenarios</CardTitle></CardHeader>
            <CardContent>
              <div className="h-[360px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="label" fontSize={10} interval={9} stroke="hsl(var(--muted-foreground))" />
                    <YAxis fontSize={10} tickFormatter={(value) => `${Math.round(value / 1000)}k`} stroke="hsl(var(--muted-foreground))" />
                    <Tooltip formatter={(value: number) => fmtCurrency(value)} labelFormatter={(_, payload) => payload?.[0]?.payload?.date ? formatDateBR(payload[0].payload.date) : ""} />
                    <Legend />
                    <ReferenceLine y={0} stroke="hsl(var(--destructive))" strokeDasharray="4 4" />
                    <Area type="monotone" dataKey="optimistic" name="Otimista" stroke="#22c55e" fill="#22c55e" fillOpacity={0.04} />
                    <Area type="monotone" dataKey="expected" name="Esperado" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.1} strokeWidth={2} />
                    <Area type="monotone" dataKey="conservative" name="Conservador" stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.04} />
                    <Area type="monotone" dataKey="balance" name="Comprometido" stroke="#94a3b8" fill="#94a3b8" fillOpacity={0.02} strokeDasharray="5 4" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <div className="grid xl:grid-cols-[1.3fr_.7fr] gap-4">
            <Card>
              <CardHeader><CardTitle className="text-base">Resumo dos proximos 12 meses</CardTitle></CardHeader>
              <CardContent className="p-0"><Table><TableHeader><TableRow><TableHead>Mes</TableHead><TableHead>Entradas</TableHead><TableHead>Saidas</TableHead><TableHead>Saldo final</TableHead><TableHead>Esperado</TableHead></TableRow></TableHeader><TableBody>
                {workspace.monthlyForecast.map((month) => <TableRow key={month.month}><TableCell className="font-medium">{format(new Date(`${month.month}-01T12:00:00`), "MMM/yy", { locale: ptBR })}</TableCell><TableCell className="text-emerald-500">{fmtCurrency(month.income)}</TableCell><TableCell className="text-destructive">{fmtCurrency(month.expense)}</TableCell><TableCell>{fmtCurrency(month.balance)}</TableCell><TableCell>{fmtCurrency(month.expected)}</TableCell></TableRow>)}
              </TableBody></Table></CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-base">Pressao financeira</CardTitle></CardHeader>
              <CardContent>
                <div className="grid grid-cols-10 gap-1.5">
                  {workspace.forecast90.days.map((day) => {
                    const pressure = day.expense - day.income;
                    return <div key={day.date} title={`${formatDateBR(day.date)}: ${fmtCurrency(pressure)}`} className={cn("aspect-square rounded-sm", day.balance < 0 ? "bg-destructive" : pressure > 0 ? "bg-amber-500/70" : day.income > 0 ? "bg-emerald-500/60" : "bg-muted")} />;
                  })}
                </div>
                <div className="flex gap-3 text-[10px] text-muted-foreground mt-3"><span>Verde: entrada</span><span>Amarelo: pressao</span><span>Vermelho: negativo</span></div>
              </CardContent>
            </Card>
          </div>
          {workspace.savedInstallments.some((item) => !item.added_to_flow_at) && (
            <Card><CardHeader><CardTitle className="text-base">Simulacoes prontas para o fluxo</CardTitle></CardHeader><CardContent className="grid md:grid-cols-2 gap-3">
              {workspace.savedInstallments.filter((item) => !item.added_to_flow_at).map((item) => <div key={item.id} className="flex items-center justify-between gap-3 rounded-lg border p-3"><div><p className="font-medium text-sm">{item.item_name}</p><p className="text-xs text-muted-foreground">{item.installments}x de {fmtCurrency(Number(item.monthly_payment))}</p></div><Button size="sm" variant="outline" disabled={!workspace.selectedAccounts.length} onClick={() => workspace.addInstallmentToFlowMutation.mutate({ installmentId: item.id, accountId: workspace.selectedAccounts[0].id })}>Adicionar ao fluxo</Button></div>)}
            </CardContent></Card>
          )}
        </TabsContent>

        <TabsContent value="accounts" className="space-y-4">
          <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {workspace.selectedAccounts.map((account) => (
              <Card key={account.id}>
                <CardContent className="p-5">
                  <div className="flex justify-between gap-3"><div className="flex gap-3"><div className="p-2 rounded-lg bg-primary/10"><AccountIcon account={account} /></div><div><p className="font-semibold">{account.name}</p><p className="text-xs text-muted-foreground">{account.account_type}</p></div></div>{account.is_default && <Badge variant="outline">Principal</Badge>}</div>
                  <p className="text-2xl font-bold font-mono mt-5">{fmtCurrency(workspace.accountBalances.get(account.id) || 0)}</p>
                  {account.account_type === "credit_card" && <p className="text-xs text-muted-foreground mt-1">Limite {fmtCurrency(Number(account.credit_limit || 0))}</p>}
                </CardContent>
              </Card>
            ))}
          </div>
          <Card><CardHeader><CardTitle className="text-base">Transferencias recentes</CardTitle></CardHeader><CardContent className="space-y-2">
            {workspace.transfers.slice(0, 10).map((transfer) => <div key={transfer.id} className="flex items-center justify-between rounded-lg border p-3 text-sm"><div><p className="font-medium">{transfer.description || "Transferencia"}</p><p className="text-xs text-muted-foreground">{workspace.accounts.find((a) => a.id === transfer.from_account_id)?.name} → {workspace.accounts.find((a) => a.id === transfer.to_account_id)?.name} · {formatDateBR(transfer.transfer_date)}</p></div><span className="font-mono">{fmtCurrency(Number(transfer.amount))}</span></div>)}
            {!workspace.transfers.length && <p className="text-sm text-muted-foreground text-center py-6">Nenhuma transferencia registrada.</p>}
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="cards" className="space-y-4">
          <div className="flex justify-end"><Button size="sm" onClick={() => setDialog("invoice")} disabled={!workspace.cardAccounts.length}><Plus className="h-4 w-4 mr-1" />Nova fatura</Button></div>
          <div className="grid lg:grid-cols-2 gap-4">
            {workspace.cardAccounts.map((card) => {
              const cardInvoices = workspace.invoices.filter((invoice) => invoice.card_account_id === card.id);
              const used = cardInvoices.filter((invoice) => invoice.status !== "paid").reduce((sum, invoice) => sum + Number(invoice.amount), 0);
              const limit = Number(card.credit_limit || 0);
              return <Card key={card.id}><CardHeader><CardTitle className="text-base flex items-center gap-2"><CreditCard className="h-4 w-4" />{card.name}</CardTitle></CardHeader><CardContent className="space-y-3"><div className="grid grid-cols-2 gap-3"><div><p className="text-xs text-muted-foreground">Utilizado</p><p className="font-bold font-mono">{fmtCurrency(used)}</p></div><div><p className="text-xs text-muted-foreground">Disponivel</p><p className="font-bold font-mono">{fmtCurrency(Math.max(0, limit - used))}</p></div></div><div className="h-2 bg-muted rounded-full overflow-hidden"><div className={cn("h-full", limit && used / limit > .8 ? "bg-destructive" : "bg-primary")} style={{ width: `${limit ? Math.min(100, used / limit * 100) : 0}%` }} /></div>{cardInvoices.map((invoice) => <div key={invoice.id} className="flex items-center justify-between border rounded-lg p-3"><div><p className="font-medium text-sm">{fmtCurrency(Number(invoice.amount))}</p><p className="text-xs text-muted-foreground">Vence {formatDateBR(invoice.due_date)} · {invoice.status}</p></div>{invoice.status !== "paid" && <Button size="sm" variant="outline" onClick={() => payInvoice(invoice)} disabled={!workspace.selectedAccounts.some((account) => account.account_type !== "credit_card")}>Pagar</Button>}</div>)}</CardContent></Card>;
            })}
          </div>
          {!workspace.cardAccounts.length && <Card><CardContent className="py-12 text-center text-muted-foreground"><CreditCard className="h-10 w-10 mx-auto mb-3 opacity-50" /><p>Crie uma conta do tipo cartao de credito para controlar limites e faturas.</p></CardContent></Card>}
        </TabsContent>

        <TabsContent value="timeline" className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Select value={timelineAccount} onValueChange={setTimelineAccount}><SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Todas as contas</SelectItem>{workspace.selectedAccounts.map((account) => <SelectItem key={account.id} value={account.id}>{account.name}</SelectItem>)}</SelectContent></Select>
            <Select value={timelineSource} onValueChange={setTimelineSource}><SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Todas as origens</SelectItem>{["transaction", "plan", "project", "transfer", "invoice", "installment"].map((source) => <SelectItem key={source} value={source}>{source}</SelectItem>)}</SelectContent></Select>
          </div>
          <Card><CardContent className="p-0 overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Data</TableHead><TableHead>Descricao</TableHead><TableHead>Conta</TableHead><TableHead>Origem</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Valor</TableHead><TableHead /></TableRow></TableHeader><TableBody>
            {timelineEvents.map((event) => <TableRow key={event.id}><TableCell className="font-mono text-xs">{formatDateBR(event.date)}</TableCell><TableCell><p className="font-medium">{event.description}</p><p className="text-[10px] text-muted-foreground">{event.category || "Sem categoria"}</p></TableCell><TableCell>{workspace.accounts.find((account) => account.id === event.accountId)?.name || "Geral"}</TableCell><TableCell><Badge variant="outline">{event.sourceType}</Badge></TableCell><TableCell><Badge variant={event.status === "reconciled" ? "secondary" : "outline"}>{event.status}</Badge></TableCell><TableCell className={cn("text-right font-mono", event.kind === "income" || event.kind === "transfer_in" ? "text-emerald-500" : "text-destructive")}>{event.kind === "income" || event.kind === "transfer_in" ? "+" : "-"} {fmtCurrency(event.amount)}</TableCell><TableCell>{event.status === "planned" && !event.isScenario && (event.sourceType === "transaction" || event.sourceType === "plan") && <Button size="sm" variant="ghost" onClick={() => confirmEvent(event)}><CheckCircle2 className="h-4 w-4" /></Button>}</TableCell></TableRow>)}
            {!timelineEvents.length && <TableRow><TableCell colSpan={7} className="text-center py-10 text-muted-foreground">Nenhum evento futuro neste filtro.</TableCell></TableRow>}
          </TableBody></Table></CardContent></Card>
        </TabsContent>
      </Tabs>

      <Dialog open={dialog === "transaction"} onOpenChange={(open) => !open && setDialog(null)}><DialogContent><DialogHeader><DialogTitle>Nova {transactionKind === "income" ? "entrada" : "saida"}</DialogTitle></DialogHeader><div className="space-y-4"><div><Label>Descricao</Label><Input value={transactionForm.description} onChange={(e) => setTransactionForm({ ...transactionForm, description: e.target.value })} /></div><div className="grid grid-cols-2 gap-3"><div><Label>Valor</Label><Input type="number" value={transactionForm.amount || ""} onChange={(e) => setTransactionForm({ ...transactionForm, amount: Number(e.target.value) })} /></div><div><Label>Vencimento</Label><Input type="date" value={transactionForm.due_date} onChange={(e) => setTransactionForm({ ...transactionForm, due_date: e.target.value })} /></div></div><div className="grid grid-cols-2 gap-3"><div><Label>Conta</Label><Select value={transactionForm.finance_account_id} onValueChange={(value) => setTransactionForm({ ...transactionForm, finance_account_id: value })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{workspace.selectedAccounts.map((account) => <SelectItem key={account.id} value={account.id}>{account.name}</SelectItem>)}</SelectContent></Select></div><div><Label>Status</Label><Select value={transactionForm.status} onValueChange={(value) => setTransactionForm({ ...transactionForm, status: value })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="planned">Falta pagar/receber</SelectItem><SelectItem value="confirmed">Confirmado</SelectItem><SelectItem value="reconciled">Conciliado</SelectItem></SelectContent></Select></div></div><div><Label>Categoria</Label><Input value={transactionForm.category} onChange={(e) => setTransactionForm({ ...transactionForm, category: e.target.value })} /></div></div><DialogFooter><Button variant="outline" onClick={() => setDialog(null)}>Cancelar</Button><Button onClick={saveTransaction} disabled={!transactionForm.description || !transactionForm.amount || !transactionForm.finance_account_id}>Salvar</Button></DialogFooter></DialogContent></Dialog>

      <Dialog open={dialog === "account"} onOpenChange={(open) => !open && setDialog(null)}><DialogContent><DialogHeader><DialogTitle>Nova conta financeira</DialogTitle></DialogHeader><div className="space-y-4"><div><Label>Titular</Label><Select value={accountForm.entity_id} onValueChange={(value) => setAccountForm({ ...accountForm, entity_id: value })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{workspace.entities.map((entity) => <SelectItem key={entity.id} value={entity.id}>{entity.name} ({entity.entity_type.toUpperCase()})</SelectItem>)}</SelectContent></Select></div><div><Label>Nome</Label><Input value={accountForm.name} onChange={(e) => setAccountForm({ ...accountForm, name: e.target.value })} /></div><div className="grid grid-cols-2 gap-3"><div><Label>Tipo</Label><Select value={accountForm.account_type} onValueChange={(value) => setAccountForm({ ...accountForm, account_type: value })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="checking">Conta corrente</SelectItem><SelectItem value="savings">Reserva/Poupanca</SelectItem><SelectItem value="cash">Caixa</SelectItem><SelectItem value="investment">Investimento</SelectItem><SelectItem value="credit_card">Cartao de credito</SelectItem></SelectContent></Select></div><div><Label>Saldo inicial</Label><Input type="number" value={accountForm.opening_balance || ""} onChange={(e) => setAccountForm({ ...accountForm, opening_balance: Number(e.target.value) })} /></div></div>{accountForm.account_type === "credit_card" && <div className="grid grid-cols-3 gap-3"><div><Label>Limite</Label><Input type="number" value={accountForm.credit_limit || ""} onChange={(e) => setAccountForm({ ...accountForm, credit_limit: Number(e.target.value) })} /></div><div><Label>Fecha dia</Label><Input type="number" value={accountForm.closing_day} onChange={(e) => setAccountForm({ ...accountForm, closing_day: Number(e.target.value) })} /></div><div><Label>Vence dia</Label><Input type="number" value={accountForm.due_day} onChange={(e) => setAccountForm({ ...accountForm, due_day: Number(e.target.value) })} /></div></div>}</div><DialogFooter><Button variant="outline" onClick={() => setDialog(null)}>Cancelar</Button><Button onClick={() => workspace.saveAccountMutation.mutate(accountForm as Partial<FinanceAccount>, { onSuccess: () => setDialog(null) })} disabled={!accountForm.name || !accountForm.entity_id}>Salvar conta</Button></DialogFooter></DialogContent></Dialog>

      <Dialog open={dialog === "transfer"} onOpenChange={(open) => !open && setDialog(null)}><DialogContent><DialogHeader><DialogTitle>Transferir entre contas</DialogTitle></DialogHeader><div className="space-y-4"><div className="grid grid-cols-2 gap-3"><div><Label>Origem</Label><Select value={transferForm.from_account_id} onValueChange={(value) => setTransferForm({ ...transferForm, from_account_id: value })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{workspace.accounts.filter((account) => account.account_type !== "credit_card").map((account) => <SelectItem key={account.id} value={account.id}>{account.name}</SelectItem>)}</SelectContent></Select></div><div><Label>Destino</Label><Select value={transferForm.to_account_id} onValueChange={(value) => setTransferForm({ ...transferForm, to_account_id: value })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{workspace.accounts.map((account) => <SelectItem key={account.id} value={account.id}>{account.name}</SelectItem>)}</SelectContent></Select></div></div><div className="grid grid-cols-2 gap-3"><div><Label>Valor</Label><Input type="number" value={transferForm.amount || ""} onChange={(e) => setTransferForm({ ...transferForm, amount: Number(e.target.value) })} /></div><div><Label>Data</Label><Input type="date" value={transferForm.transfer_date} onChange={(e) => setTransferForm({ ...transferForm, transfer_date: e.target.value })} /></div></div><div><Label>Descricao</Label><Input value={transferForm.description} onChange={(e) => setTransferForm({ ...transferForm, description: e.target.value })} /></div></div><DialogFooter><Button variant="outline" onClick={() => setDialog(null)}>Cancelar</Button><Button onClick={() => workspace.saveTransferMutation.mutate(transferForm as never, { onSuccess: () => setDialog(null) })} disabled={!transferForm.amount || !transferForm.from_account_id || !transferForm.to_account_id || transferForm.from_account_id === transferForm.to_account_id}>Transferir</Button></DialogFooter></DialogContent></Dialog>

      <Dialog open={dialog === "invoice"} onOpenChange={(open) => !open && setDialog(null)}><DialogContent><DialogHeader><DialogTitle>Nova fatura</DialogTitle></DialogHeader><div className="space-y-4"><div><Label>Cartao</Label><Select value={invoiceForm.card_account_id} onValueChange={(value) => setInvoiceForm({ ...invoiceForm, card_account_id: value })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{workspace.cardAccounts.map((card) => <SelectItem key={card.id} value={card.id}>{card.name}</SelectItem>)}</SelectContent></Select></div><div className="grid grid-cols-2 gap-3"><div><Label>Valor</Label><Input type="number" value={invoiceForm.amount || ""} onChange={(e) => setInvoiceForm({ ...invoiceForm, amount: Number(e.target.value) })} /></div><div><Label>Vencimento</Label><Input type="date" value={invoiceForm.due_date} onChange={(e) => setInvoiceForm({ ...invoiceForm, due_date: e.target.value })} /></div><div><Label>Inicio</Label><Input type="date" value={invoiceForm.period_start} onChange={(e) => setInvoiceForm({ ...invoiceForm, period_start: e.target.value })} /></div><div><Label>Fim</Label><Input type="date" value={invoiceForm.period_end} onChange={(e) => setInvoiceForm({ ...invoiceForm, period_end: e.target.value })} /></div></div></div><DialogFooter><Button variant="outline" onClick={() => setDialog(null)}>Cancelar</Button><Button onClick={() => workspace.saveInvoiceMutation.mutate(invoiceForm as Partial<FinanceCardInvoice>, { onSuccess: () => setDialog(null) })} disabled={!invoiceForm.card_account_id || !invoiceForm.amount}>Criar fatura</Button></DialogFooter></DialogContent></Dialog>
    </div>
  );
};

const Metric = ({ label, value, hint, icon: Icon, tone }: { label: string; value: string; hint?: string; icon: typeof Wallet; tone: "positive" | "negative" | "warning" | "primary" }) => (
  <Card><CardContent className="p-4"><div className="flex items-start justify-between"><div><p className="text-xs text-muted-foreground">{label}</p><p className={cn("text-lg xl:text-xl font-bold font-mono mt-1", tone === "positive" && "text-emerald-500", tone === "negative" && "text-destructive", tone === "warning" && "text-amber-500", tone === "primary" && "text-primary")}>{value}</p>{hint && <p className="text-[10px] text-muted-foreground mt-1">{hint}</p>}</div><Icon className="h-5 w-5 text-muted-foreground" /></div></CardContent></Card>
);

const AccountIcon = ({ account }: { account: FinanceAccount }) => account.account_type === "credit_card" ? <CreditCard className="h-5 w-5 text-primary" /> : account.account_type === "cash" ? <Wallet className="h-5 w-5 text-primary" /> : account.account_type === "investment" ? <Building2 className="h-5 w-5 text-primary" /> : <Landmark className="h-5 w-5 text-primary" />;

export default FinanceFutureFlow;
