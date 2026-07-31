import { useMemo, useState } from "react";
import { Search, Phone, Mail, Building2, Link2, Link2Off, Plus, Pencil, Trash2, Check, X, Globe, Layers } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useCompany } from "@/contexts/CompanyContext";
import { useCrmBoards } from "./useCrmBoards";
import type { useCrm } from "./useCrm";

const NONE = "__none__";
const EMPTY = { name: "", email: "", phone: "", company: "", customerId: NONE };

// Aba Contatos do CRM — a LISTA (o Kanban é o de Quadros, no nível acima). Mesma fonte única:
// a etapa de cada contato vem do quadro (crm_board_contacts), mostrada aqui como "Quadro · Etapa".
// Cada linha liga o contato a um cliente (customer_id → finance_clientes) p/ entrar no 360.
export const ContactsTab = ({ crm, onSelectCustomer }: { crm: ReturnType<typeof useCrm>; onSelectCustomer: (id: string) => void }) => {
  const [search, setSearch] = useState("");
  const [onlyUnlinked, setOnlyUnlinked] = useState(false);
  const boards = useCrmBoards();
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [edit, setEdit] = useState({ name: "", email: "", phone: "", company: "" });
  const { companies } = useCompany();
  const startEdit = (c: any) => { setEditingId(c.id); setEdit({ name: c.name || "", email: c.email || "", phone: c.phone || "", company: c.company || "" }); };
  const saveEdit = () => { if (!editingId) return; crm.updateContact.mutate({ id: editingId, patch: { name: edit.name.trim(), email: edit.email.trim() || null, phone: edit.phone.trim() || null, company: edit.company.trim() || null } }, { onSuccess: () => setEditingId(null) }); };

  const companyName = useMemo(() => new Map(companies.map((c) => [c.id, c.name])), [companies]);
  const customerName = useMemo(() => new Map(crm.customers.map((c) => [c.id, c.nome])), [crm.customers]);
  const customerById = useMemo(() => new Map(crm.customers.map((c) => [c.id, c])), [crm.customers]);
  // Clientes agrupados por empresa — assim o seletor mostra de qual empresa cada cliente é.
  const grouped = useMemo(() => {
    const groups: { id: string; label: string; items: typeof crm.customers }[] = [];
    for (const co of companies) {
      const items = crm.customers.filter((c) => c.company_id === co.id);
      if (items.length) groups.push({ id: co.id, label: co.name, items });
    }
    const orphans = crm.customers.filter((c) => !c.company_id || !companyName.has(c.company_id));
    if (orphans.length) groups.push({ id: "__no_co__", label: "Sem empresa", items: orphans });
    return groups;
  }, [crm.customers, companies, companyName]);
  const unlinked = crm.contacts.filter((c) => !c.customer_id).length;
  // Quadro · Etapa de cada contato (fonte única = crm_board_contacts). Se está em >1 quadro, mostra o 1º + "+N".
  const boardOf = useMemo(() => {
    const map = new Map<string, { board: string; stage: string; extra: number }>();
    for (const b of boards.boards) {
      const cards = boards.cardsByBoard.get(b.id) ?? [];
      const stageTitle = new Map(b.stages.map((s) => [s.id, s.title]));
      for (const c of cards) {
        const cur = map.get(c.contact_id);
        if (!cur) map.set(c.contact_id, { board: b.name, stage: stageTitle.get(c.stage_id) || "—", extra: 0 });
        else cur.extra += 1;
      }
    }
    return map;
  }, [boards.boards, boards.cardsByBoard]);


  const submitNew = () => {
    if (!form.name.trim()) return;
    crm.createContact.mutate(
      { name: form.name, email: form.email, phone: form.phone, company: form.company, customerId: form.customerId === NONE ? null : form.customerId },
      { onSuccess: () => { setForm(EMPTY); setShowNew(false); } },
    );
  };

  const rows = useMemo(() =>
    crm.contacts
      .filter((c) => (!onlyUnlinked || !c.customer_id) && (!search || (c.name || "").toLowerCase().includes(search.toLowerCase()) || (c.company || "").toLowerCase().includes(search.toLowerCase())))
      .sort((a, b) => (a.name || "").localeCompare(b.name || "")),
    [crm.contacts, search, onlyUnlinked],
  );

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar contato ou empresa" className="pl-8 h-9" />
          </div>
          <Button variant={onlyUnlinked ? "default" : "outline"} size="sm" className="h-9 gap-1.5" onClick={() => setOnlyUnlinked((v) => !v)}>
            <Link2Off className="h-3.5 w-3.5" /> Sem cliente {unlinked > 0 && <Badge variant="secondary" className="text-[10px] ml-0.5">{unlinked}</Badge>}
          </Button>
          <Button size="sm" className="h-9 gap-1.5" onClick={() => setShowNew((v) => !v)}><Plus className="h-3.5 w-3.5" /> Novo</Button>
        </div>

        <p className="text-[11px] text-muted-foreground pt-1">Ligue cada contato a um cliente pra ele aparecer no 360. {crm.contacts.length} contato(s){unlinked > 0 ? ` · ${unlinked} sem cliente` : ""}.</p>
        {showNew && (
          <div className="rounded-lg border border-primary/20 bg-primary/5 p-2.5 mt-2 space-y-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Nome *" className="h-8 text-xs" />
              <Input value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} placeholder="Empresa" className="h-8 text-xs" />
              <Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="E-mail" className="h-8 text-xs" />
              <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="Telefone" className="h-8 text-xs" />
            </div>
            <div className="flex items-center gap-2">
              <Select value={form.customerId} onValueChange={(v) => setForm({ ...form, customerId: v })}>
                <SelectTrigger className="h-8 text-xs flex-1"><SelectValue placeholder="Ligar a cliente" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>— sem cliente —</SelectItem>
                  {grouped.map((g) => (
                    <SelectGroup key={g.id}>
                      <SelectLabel className="text-[10px] uppercase tracking-wide text-muted-foreground">{g.label}</SelectLabel>
                      {g.items.map((cust) => <SelectItem key={cust.id} value={cust.id}>{cust.nome}</SelectItem>)}
                    </SelectGroup>
                  ))}
                </SelectContent>
              </Select>
              <Button size="sm" className="h-8 text-xs" disabled={!form.name.trim() || crm.createContact.isPending} onClick={submitNew}>Salvar</Button>
              <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => { setShowNew(false); setForm(EMPTY); }}>Cancelar</Button>
            </div>
          </div>
        )}
      </CardHeader>
      <CardContent className="p-0">
        <div className="divide-y divide-border/50 xl:max-h-[72vh] xl:overflow-y-auto">

          {rows.map((c) => (
            <div key={c.id} className="flex items-center gap-2 px-3 py-2.5">
              <span className={cn("h-2 w-2 rounded-full shrink-0", c.customer_id ? "bg-emerald-500" : "bg-muted-foreground/40")} />
              {editingId === c.id ? (
                <>
                  <div className="min-w-0 flex-1 grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                    <Input value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} placeholder="Nome" className="h-7 text-xs" />
                    <Input value={edit.company} onChange={(e) => setEdit({ ...edit, company: e.target.value })} placeholder="Empresa" className="h-7 text-xs" />
                    <Input value={edit.email} onChange={(e) => setEdit({ ...edit, email: e.target.value })} placeholder="E-mail" className="h-7 text-xs" />
                    <Input value={edit.phone} onChange={(e) => setEdit({ ...edit, phone: e.target.value })} placeholder="Telefone" className="h-7 text-xs" />
                  </div>
                  <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0 text-emerald-500" disabled={!edit.name.trim() || crm.updateContact.isPending} onClick={saveEdit}><Check className="h-3.5 w-3.5" /></Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0" onClick={() => setEditingId(null)}><X className="h-3.5 w-3.5" /></Button>
                </>
              ) : (
                <>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate flex items-center gap-2">
                      <span className="truncate">{c.name || "Sem nome"}</span>
                      {(() => {
                        const bo = boardOf.get(c.id);
                        return bo
                          ? <Badge variant="outline" className="shrink-0 gap-1 text-[9px] font-normal"><Layers className="h-2.5 w-2.5" />{bo.board} · {bo.stage}{bo.extra > 0 ? ` +${bo.extra}` : ""}</Badge>
                          : <span className="shrink-0 flex items-center gap-1 text-[9px] text-muted-foreground/60"><Layers className="h-2.5 w-2.5" />sem quadro</span>;
                      })()}
                    </p>
                    <p className="text-[11px] text-muted-foreground flex items-center gap-2 truncate">
                      {c.company && <span className="flex items-center gap-1"><Building2 className="h-3 w-3" />{c.company}</span>}
                      {c.phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{c.phone}</span>}
                      {c.email && <span className="flex items-center gap-1 truncate"><Mail className="h-3 w-3" />{c.email}</span>}
                    </p>
                  </div>
                  <Select value={c.customer_id || NONE} onValueChange={(v) => crm.linkContact.mutate({ contactId: c.id, customerId: v === NONE ? null : v })}>
                    <SelectTrigger className="h-8 w-[130px] sm:w-[160px] text-xs shrink-0"><SelectValue placeholder="Ligar a cliente" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE}>— nenhum —</SelectItem>
                      {grouped.map((g) => (
                        <SelectGroup key={g.id}>
                          <SelectLabel className="text-[10px] uppercase tracking-wide text-muted-foreground">{g.label}</SelectLabel>
                          {g.items.map((cust) => <SelectItem key={cust.id} value={cust.id}>{cust.nome}</SelectItem>)}
                        </SelectGroup>
                      ))}
                    </SelectContent>
                  </Select>
                  {/* Empresa do cliente ligado — visível e editável direto daqui. */}
                  {c.customer_id && (
                    <Select
                      value={customerById.get(c.customer_id)?.company_id || NONE}
                      onValueChange={(v) => crm.updateCustomer.mutate({ id: c.customer_id!, patch: { company_id: v === NONE ? null : v } as any })}
                    >
                      <SelectTrigger className="h-8 w-[120px] sm:w-[150px] text-xs shrink-0 hidden md:flex" title="Empresa do cliente">
                        <Globe className="h-3 w-3 mr-1 text-muted-foreground" />
                        <SelectValue placeholder="Empresa" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NONE}>— sem empresa —</SelectItem>
                        {companies.map((co) => <SelectItem key={co.id} value={co.id}>{co.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  )}
                  {c.customer_id && (
                    <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0 hidden sm:flex" title={`Abrir ${customerName.get(c.customer_id) || "cliente"}`} onClick={() => onSelectCustomer(c.customer_id!)}><Link2 className="h-3.5 w-3.5" /></Button>
                  )}
                  <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0" onClick={() => startEdit(c)}><Pencil className="h-3.5 w-3.5" /></Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive" onClick={() => crm.deleteContact.mutate(c.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                </>
              )}
            </div>
          ))}
          {rows.length === 0 && <p className="p-6 text-center text-sm text-muted-foreground">Nenhum contato.</p>}
        </div>
      </CardContent>

    </Card>
  );
};

export default ContactsTab;
