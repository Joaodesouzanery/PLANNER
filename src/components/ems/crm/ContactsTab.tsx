import { useMemo, useState } from "react";
import { Search, Phone, Mail, Building2, Link2, Link2Off } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { useCrm } from "./useCrm";

const NONE = "__none__";

// Aba Contatos do CRM: as pessoas (mesma tabela `contacts`, inclui as vindas do Comercial),
// cada uma com um SELETOR DE CLIENTE (customer_id → finance_clientes). Sem isso, contato novo
// não entra no Customer 360. Essa é a lacuna que a Fase 4 fecha.
export const ContactsTab = ({ crm, onSelectCustomer }: { crm: ReturnType<typeof useCrm>; onSelectCustomer: (id: string) => void }) => {
  const [search, setSearch] = useState("");
  const [onlyUnlinked, setOnlyUnlinked] = useState(false);

  const customerName = useMemo(() => new Map(crm.customers.map((c) => [c.id, c.nome])), [crm.customers]);
  const unlinked = crm.contacts.filter((c) => !c.customer_id).length;

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
        </div>
        <p className="text-[11px] text-muted-foreground pt-1">Ligue cada contato a um cliente pra ele aparecer no 360. {crm.contacts.length} contato(s){unlinked > 0 ? ` · ${unlinked} sem cliente` : ""}.</p>
      </CardHeader>
      <CardContent className="p-0">
        <div className="divide-y divide-border/50 max-h-[72vh] overflow-y-auto">
          {rows.map((c) => (
            <div key={c.id} className="flex items-center gap-3 px-3 py-2.5">
              <span className={cn("h-2 w-2 rounded-full shrink-0", c.customer_id ? "bg-emerald-500" : "bg-muted-foreground/40")} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate">{c.name || "Sem nome"}</p>
                <p className="text-[11px] text-muted-foreground flex items-center gap-2 truncate">
                  {c.company && <span className="flex items-center gap-1"><Building2 className="h-3 w-3" />{c.company}</span>}
                  {c.phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{c.phone}</span>}
                  {c.email && <span className="flex items-center gap-1 truncate"><Mail className="h-3 w-3" />{c.email}</span>}
                </p>
              </div>
              <Select
                value={c.customer_id || NONE}
                onValueChange={(v) => crm.linkContact.mutate({ contactId: c.id, customerId: v === NONE ? null : v })}
              >
                <SelectTrigger className="h-8 w-[190px] text-xs shrink-0"><SelectValue placeholder="Ligar a cliente" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>— nenhum —</SelectItem>
                  {crm.customers.map((cust) => <SelectItem key={cust.id} value={cust.id}>{cust.nome}</SelectItem>)}
                </SelectContent>
              </Select>
              {c.customer_id && (
                <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0" title={`Abrir ${customerName.get(c.customer_id) || "cliente"}`} onClick={() => onSelectCustomer(c.customer_id!)}>
                  <Link2 className="h-3.5 w-3.5" />
                </Button>
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
