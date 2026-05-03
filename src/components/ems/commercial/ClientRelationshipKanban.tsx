import { useMemo, useState } from "react";
import { DragDropContext, Draggable, Droppable, DropResult } from "@hello-pangea/dnd";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  Building2,
  CalendarClock,
  DollarSign,
  GripVertical,
  HeartPulse,
  Search,
  Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import { AttachmentManager } from "@/components/ems/AttachmentManager";

type ClientStage = "new" | "onboarding" | "active" | "expansion" | "risk" | "recovery";

interface ClientCompany {
  id: string;
  name: string;
  description: string | null;
  color: string | null;
  relationship_stage: ClientStage | null;
  relationship_priority: string | null;
  relationship_health: string | null;
  relationship_next_action_date: string | null;
  relationship_notes: string | null;
}

interface ContactRow {
  id: string;
  company_id: string | null;
  last_contact_date?: string | null;
  next_action_date?: string | null;
}

const CLIENT_STAGES: Array<{ id: ClientStage; title: string; hint: string; color: string }> = [
  { id: "new", title: "Novo Cliente", hint: "Conta criada ou recém-fechada", color: "from-blue-500/15 border-blue-500/30" },
  { id: "onboarding", title: "Onboarding", hint: "Implantação e primeiros passos", color: "from-amber-500/15 border-amber-500/30" },
  { id: "active", title: "Ativo", hint: "Relacionamento em operação", color: "from-emerald-500/15 border-emerald-500/30" },
  { id: "expansion", title: "Expansão", hint: "Upsell, cross-sell ou indicação", color: "from-purple-500/15 border-purple-500/30" },
  { id: "risk", title: "Risco", hint: "Atenção executiva necessária", color: "from-red-500/15 border-red-500/30" },
  { id: "recovery", title: "Recuperação", hint: "Plano de retomada ativo", color: "from-cyan-500/15 border-cyan-500/30" },
];

const HEALTH_CONFIG: Record<string, { label: string; className: string }> = {
  green: { label: "Saudável", className: "bg-emerald-500/10 text-emerald-500 border-emerald-500/30" },
  yellow: { label: "Atenção", className: "bg-amber-500/10 text-amber-500 border-amber-500/30" },
  red: { label: "Crítico", className: "bg-red-500/10 text-red-500 border-red-500/30" },
};

const PRIORITY_CONFIG: Record<string, { label: string; className: string }> = {
  low: { label: "Baixa", className: "text-blue-500 border-blue-500/30" },
  medium: { label: "Média", className: "text-amber-500 border-amber-500/30" },
  high: { label: "Alta", className: "text-red-500 border-red-500/30" },
};

const money = (value: number) => value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const dateLabel = (date?: string | null) => {
  if (!date) return "Sem data";
  const [year, month, day] = date.slice(0, 10).split("-");
  return `${day}/${month}/${year}`;
};

const ClientRelationshipKanban = ({ enabled = true }: { enabled?: boolean }) => {
  const { selectedCompanyId } = useCompany();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [health, setHealth] = useState("all");
  const [editing, setEditing] = useState<ClientCompany | null>(null);
  const [form, setForm] = useState({ priority: "medium", health: "green", nextAction: "", notes: "" });
  const hasCompanyFilter = selectedCompanyId !== "all";

  const { data: companies = [] } = useQuery({
    queryKey: ["client-kanban-companies", selectedCompanyId],
    enabled,
    staleTime: 1000 * 60 * 5,
    queryFn: async () => {
      let q = (supabase as any)
        .from("companies")
        .select("id, name, description, color, relationship_stage, relationship_priority, relationship_health, relationship_next_action_date, relationship_notes")
        .order("name");
      if (hasCompanyFilter) q = q.eq("id", selectedCompanyId);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as ClientCompany[];
    },
  });

  const companyIds = useMemo(() => companies.map((c) => c.id), [companies]);

  const { data: contacts = [] } = useQuery({
    queryKey: ["client-kanban-contacts", companyIds],
    enabled: enabled && companyIds.length > 0,
    staleTime: 1000 * 60 * 3,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("contacts")
        .select("id, company_id")
        .in("company_id", companyIds);
      if (error) throw error;
      const rows = (data || []) as Array<{ id: string; company_id: string | null }>;
      const contactIds = rows.map((row) => row.id);
      let metaByContact: Record<string, { last_contact_date: string | null; next_action_date: string | null }> = {};
      if (contactIds.length > 0) {
        const { data: meta, error: metaError } = await (supabase as any)
          .from("commercial_contact_meta")
          .select("contact_id, last_contact_date, next_action_date")
          .in("contact_id", contactIds);
        if (metaError) throw metaError;
        metaByContact = Object.fromEntries((meta || []).map((item: any) => [item.contact_id, item]));
      }
      return rows.map((row: any) => ({
        id: row.id,
        company_id: row.company_id,
        last_contact_date: metaByContact[row.id]?.last_contact_date || null,
        next_action_date: metaByContact[row.id]?.next_action_date || null,
      })) as ContactRow[];
    },
  });

  const { data: projects = [] } = useQuery({
    queryKey: ["client-kanban-projects", companyIds],
    enabled: enabled && companyIds.length > 0,
    staleTime: 1000 * 60 * 3,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("projects")
        .select("id, company_id, status, next_invoice_date")
        .in("company_id", companyIds);
      if (error) throw error;
      return data || [];
    },
  });

  const { data: tasks = [] } = useQuery({
    queryKey: ["client-kanban-tasks", companyIds],
    enabled: enabled && companyIds.length > 0,
    staleTime: 1000 * 60 * 2,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("tasks")
        .select("id, company_id, status")
        .in("company_id", companyIds)
        .neq("status", "completed")
        .neq("status", "done");
      if (error) throw error;
      return data || [];
    },
  });

  const { data: transactions = [] } = useQuery({
    queryKey: ["client-kanban-transactions", companyIds],
    enabled: enabled && companyIds.length > 0,
    staleTime: 1000 * 60 * 5,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("financial_transactions")
        .select("id, company_id, amount, type")
        .in("company_id", companyIds);
      if (error) throw error;
      return data || [];
    },
  });

  const statsByCompany = useMemo(() => {
    const stats: Record<string, {
      contacts: number;
      projects: number;
      openTasks: number;
      revenue: number;
      nextInvoice: string | null;
      lastContact: string | null;
      nextContact: string | null;
    }> = {};
    companies.forEach((c) => {
      const companyContacts = contacts.filter((item) => item.company_id === c.id);
      const companyProjects = projects.filter((item: any) => item.company_id === c.id);
      const nextInvoice = companyProjects
        .map((item: any) => item.next_invoice_date)
        .filter(Boolean)
        .sort()[0] || null;
      stats[c.id] = {
        contacts: companyContacts.length,
        projects: companyProjects.length,
        openTasks: tasks.filter((item: any) => item.company_id === c.id).length,
        revenue: transactions
          .filter((item: any) => item.company_id === c.id && item.type === "income")
          .reduce((sum: number, item: any) => sum + Number(item.amount || 0), 0),
        nextInvoice,
        lastContact: companyContacts.map((item) => item.last_contact_date).filter(Boolean).sort().pop() || null,
        nextContact: companyContacts.map((item) => item.next_action_date).filter(Boolean).sort()[0] || null,
      };
    });
    return stats;
  }, [companies, contacts, projects, tasks, transactions]);

  const filteredCompanies = useMemo(() => {
    return companies.filter((company) => {
      const matchesSearch = !search || company.name.toLowerCase().includes(search.toLowerCase());
      const matchesHealth = health === "all" || (company.relationship_health || "green") === health;
      return matchesSearch && matchesHealth;
    });
  }, [companies, search, health]);

  const companiesByStage = useMemo(() => {
    const map: Record<string, ClientCompany[]> = {};
    CLIENT_STAGES.forEach((stage) => { map[stage.id] = []; });
    filteredCompanies.forEach((company) => {
      const stage = company.relationship_stage || "new";
      map[stage]?.push(company);
    });
    return map;
  }, [filteredCompanies]);

  const updateCompany = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Record<string, any> }) => {
      const { error } = await (supabase as any).from("companies").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["client-kanban-companies"] });
      queryClient.invalidateQueries({ queryKey: ["companies"] });
      toast({ title: "Cliente atualizado" });
    },
    onError: (error: any) => toast({ title: "Erro ao atualizar cliente", description: error?.message, variant: "destructive" }),
  });

  const onDragEnd = (result: DropResult) => {
    if (!result.destination || result.source.droppableId === result.destination.droppableId) return;
    updateCompany.mutate({
      id: result.draggableId,
      patch: { relationship_stage: result.destination.droppableId },
    });
  };

  const openEdit = (company: ClientCompany) => {
    setEditing(company);
    setForm({
      priority: company.relationship_priority || "medium",
      health: company.relationship_health || "green",
      nextAction: company.relationship_next_action_date || "",
      notes: company.relationship_notes || "",
    });
  };

  const saveEdit = () => {
    if (!editing) return;
    updateCompany.mutate({
      id: editing.id,
      patch: {
        relationship_priority: form.priority,
        relationship_health: form.health,
        relationship_next_action_date: form.nextAction || null,
        relationship_notes: form.notes || null,
      },
    });
    setEditing(null);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="text-lg font-heading font-bold text-foreground flex items-center gap-2">
            <HeartPulse className="h-5 w-5 text-primary" /> Clientes
          </h2>
          <p className="text-sm text-muted-foreground">Controle relacionamento, riscos e próximas ações por conta.</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar cliente..." className="pl-8 sm:w-64" />
          </div>
          <Select value={health} onValueChange={setHealth}>
            <SelectTrigger className="sm:w-44">
              <SelectValue placeholder="Saúde" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as saúdes</SelectItem>
              <SelectItem value="green">Saudável</SelectItem>
              <SelectItem value="yellow">Atenção</SelectItem>
              <SelectItem value="red">Crítico</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <DragDropContext onDragEnd={onDragEnd}>
        <div className="flex gap-3 overflow-x-auto pb-4 min-h-[430px]">
          {CLIENT_STAGES.map((stage, idx) => (
            <Droppable droppableId={stage.id} key={stage.id}>
              {(provided, snapshot) => (
                <div
                  ref={provided.innerRef}
                  {...provided.droppableProps}
                  className={cn(
                    "flex-shrink-0 w-[250px] rounded-xl border bg-card/50 transition-colors",
                    snapshot.isDraggingOver && "border-primary/50 bg-primary/5"
                  )}
                >
                  <div className={cn("p-3 rounded-t-xl bg-gradient-to-r to-transparent border-b", stage.color)}>
                    <div className="flex items-center justify-between gap-2">
                      <Badge variant="outline" className="text-[10px]">Etapa {idx + 1}</Badge>
                      <Badge variant="secondary" className="text-[10px]">{companiesByStage[stage.id]?.length || 0}</Badge>
                    </div>
                    <h3 className="font-semibold text-sm mt-1">{stage.title}</h3>
                    <p className="text-[11px] text-muted-foreground mt-0.5">{stage.hint}</p>
                  </div>

                  <div className="p-2 space-y-2 min-h-[120px]">
                    {(companiesByStage[stage.id] || []).map((company, index) => {
                      const stats: any = statsByCompany[company.id] || {};
                      const healthConfig = HEALTH_CONFIG[company.relationship_health || "green"];
                      const priorityConfig = PRIORITY_CONFIG[company.relationship_priority || "medium"];
                      return (
                        <Draggable draggableId={company.id} index={index} key={company.id}>
                          {(dragProvided, dragSnapshot) => (
                            <Card
                              ref={dragProvided.innerRef}
                              {...dragProvided.draggableProps}
                              {...dragProvided.dragHandleProps}
                              className={cn(
                                "cursor-grab active:cursor-grabbing transition-shadow",
                                dragSnapshot.isDragging && "shadow-lg shadow-primary/10 border-primary/40"
                              )}
                              onClick={() => openEdit(company)}
                            >
                              <CardContent className="p-3 space-y-3">
                                <div className="flex items-start gap-2">
                                  <GripVertical className="h-4 w-4 text-muted-foreground/30 shrink-0 mt-0.5" />
                                  <div className="min-w-0 flex-1">
                                    <p className="font-semibold text-sm truncate">{company.name}</p>
                                    {company.description && <p className="text-[11px] text-muted-foreground line-clamp-2 mt-0.5">{company.description}</p>}
                                  </div>
                                </div>

                                <div className="flex flex-wrap gap-1.5">
                                  <Badge variant="outline" className={cn("text-[10px]", healthConfig.className)}>{healthConfig.label}</Badge>
                                  <Badge variant="outline" className={cn("text-[10px]", priorityConfig.className)}>{priorityConfig.label}</Badge>
                                </div>

                                <div className="grid grid-cols-2 gap-2 text-[11px] text-muted-foreground">
                                  <span className="flex items-center gap-1"><Users className="h-3 w-3" />{stats.contacts || 0} contatos</span>
                                  <span className="flex items-center gap-1"><Building2 className="h-3 w-3" />{stats.projects || 0} projetos</span>
                                  <span className="flex items-center gap-1"><AlertTriangle className="h-3 w-3" />{stats.openTasks || 0} tarefas</span>
                                  <span className="flex items-center gap-1"><DollarSign className="h-3 w-3" />{money(stats.revenue || 0)}</span>
                                </div>

                                <div className="space-y-1 text-[11px] text-muted-foreground border-t pt-2">
                                  <p className="flex items-center gap-1"><CalendarClock className="h-3 w-3" />Próxima ação: {dateLabel(company.relationship_next_action_date || stats.nextContact)}</p>
                                  <p>Próxima NF: {dateLabel(stats.nextInvoice)}</p>
                                  <p>Último contato: {dateLabel(stats.lastContact)}</p>
                                </div>
                              </CardContent>
                            </Card>
                          )}
                        </Draggable>
                      );
                    })}
                    {provided.placeholder}
                  </div>
                </div>
              )}
            </Droppable>
          ))}
        </div>
      </DragDropContext>

      <Dialog open={!!editing} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium">Prioridade</label>
                <Select value={form.priority} onValueChange={(value) => setForm({ ...form, priority: value })}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Baixa</SelectItem>
                    <SelectItem value="medium">Média</SelectItem>
                    <SelectItem value="high">Alta</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium">Saúde</label>
                <Select value={form.health} onValueChange={(value) => setForm({ ...form, health: value })}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="green">Saudável</SelectItem>
                    <SelectItem value="yellow">Atenção</SelectItem>
                    <SelectItem value="red">Crítico</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">Próxima ação/revisão</label>
              <Input type="date" value={form.nextAction} onChange={(e) => setForm({ ...form, nextAction: e.target.value })} className="mt-1" />
            </div>
            <div>
              <label className="text-sm font-medium">Observações de relacionamento</label>
              <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="mt-1 min-h-28" />
            </div>
            {editing && (
              <AttachmentManager
                entityType="client"
                entityId={editing.id}
                companyId={editing.id}
                clientCompanyId={editing.id}
                documentType="contract"
                title="Documentos do cliente"
                accept="application/pdf"
                showMetadata
              />
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancelar</Button>
            <Button onClick={saveEdit}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ClientRelationshipKanban;
