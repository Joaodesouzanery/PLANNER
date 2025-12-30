import { useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Mail, Phone, Search, Copy, CheckCheck } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Contact {
  id: string;
  created_at: string;
  name: string;
  email: string;
  phone: string;
  company: string;
  segment: string;
  challenge: string;
  model: string;
  message: string | null;
}

interface ContactsTableProps {
  contacts: Contact[];
}

export const ContactsTable = ({ contacts }: ContactsTableProps) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const { toast } = useToast();

  const filteredContacts = contacts.filter((contact) => {
    const search = searchTerm.toLowerCase();
    return (
      contact.name.toLowerCase().includes(search) ||
      contact.email.toLowerCase().includes(search) ||
      contact.company.toLowerCase().includes(search) ||
      contact.segment.toLowerCase().includes(search)
    );
  });

  const copyToClipboard = (text: string, id: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    toast({
      title: "Copiado!",
      description: `${label} copiado para a área de transferência.`,
    });
    setTimeout(() => setCopiedId(null), 2000);
  };

  const getModelBadgeColor = (model: string) => {
    switch (model) {
      case "Modelo 1":
        return "bg-primary/10 text-primary border-primary/20";
      case "Modelo 2":
        return "bg-secondary/10 text-secondary border-secondary/20";
      case "Modelo 3":
        return "bg-accent/10 text-accent border-accent/20";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, email, empresa ou segmento..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Desktop Table */}
      <div className="hidden md:block rounded-lg border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Data</TableHead>
              <TableHead>Nome / Empresa</TableHead>
              <TableHead>Contato</TableHead>
              <TableHead>Segmento</TableHead>
              <TableHead>Modelo</TableHead>
              <TableHead>Desafio</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredContacts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                  Nenhum contato encontrado
                </TableCell>
              </TableRow>
            ) : (
              filteredContacts.map((contact) => (
                <TableRow key={contact.id}>
                  <TableCell className="whitespace-nowrap">
                    {format(new Date(contact.created_at), "dd/MM/yyyy HH:mm", {
                      locale: ptBR,
                    })}
                  </TableCell>
                  <TableCell>
                    <div>
                      <p className="font-medium">{contact.name}</p>
                      <p className="text-sm text-muted-foreground">{contact.company}</p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Mail className="h-3 w-3 text-muted-foreground" />
                        <span className="text-sm">{contact.email}</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0"
                          onClick={() => copyToClipboard(contact.email, `email-${contact.id}`, "Email")}
                        >
                          {copiedId === `email-${contact.id}` ? (
                            <CheckCheck className="h-3 w-3 text-secondary" />
                          ) : (
                            <Copy className="h-3 w-3" />
                          )}
                        </Button>
                      </div>
                      <div className="flex items-center gap-2">
                        <Phone className="h-3 w-3 text-muted-foreground" />
                        <span className="text-sm">{contact.phone}</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0"
                          onClick={() => copyToClipboard(contact.phone, `phone-${contact.id}`, "Telefone")}
                        >
                          {copiedId === `phone-${contact.id}` ? (
                            <CheckCheck className="h-3 w-3 text-secondary" />
                          ) : (
                            <Copy className="h-3 w-3" />
                          )}
                        </Button>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{contact.segment}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge className={getModelBadgeColor(contact.model)}>
                      {contact.model}
                    </Badge>
                  </TableCell>
                  <TableCell className="max-w-xs">
                    <p className="text-sm line-clamp-2">{contact.challenge}</p>
                    {contact.message && (
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
                        Msg: {contact.message}
                      </p>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Mobile Cards */}
      <div className="md:hidden space-y-4">
        {filteredContacts.length === 0 ? (
          <div className="text-center text-muted-foreground py-8 bg-card rounded-lg border border-border">
            Nenhum contato encontrado
          </div>
        ) : (
          filteredContacts.map((contact) => (
            <div key={contact.id} className="bg-card rounded-lg border border-border p-4 space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold">{contact.name}</h3>
                  <p className="text-sm text-muted-foreground">{contact.company}</p>
                </div>
                <Badge className={getModelBadgeColor(contact.model)}>
                  {contact.model}
                </Badge>
              </div>

              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <span className="flex-1 truncate">{contact.email}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0"
                    onClick={() => copyToClipboard(contact.email, `email-mobile-${contact.id}`, "Email")}
                  >
                    {copiedId === `email-mobile-${contact.id}` ? (
                      <CheckCheck className="h-4 w-4 text-secondary" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>

                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <span className="flex-1">{contact.phone}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0"
                    onClick={() => copyToClipboard(contact.phone, `phone-mobile-${contact.id}`, "Telefone")}
                  >
                    {copiedId === `phone-mobile-${contact.id}` ? (
                      <CheckCheck className="h-4 w-4 text-secondary" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>

              <div>
                <Badge variant="outline" className="mb-2">{contact.segment}</Badge>
                <p className="text-sm text-muted-foreground">{contact.challenge}</p>
                {contact.message && (
                  <p className="text-xs text-muted-foreground mt-2">
                    Mensagem: {contact.message}
                  </p>
                )}
              </div>

              <div className="text-xs text-muted-foreground pt-2 border-t border-border">
                {format(new Date(contact.created_at), "dd/MM/yyyy 'às' HH:mm", {
                  locale: ptBR,
                })}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
