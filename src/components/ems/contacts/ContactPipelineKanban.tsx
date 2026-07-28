import { useMemo, useState } from "react";
import { Plus, Edit2, Trash2, Building2, Phone, Mail, Globe, ChevronDown, ChevronRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useCompany } from "@/contexts/CompanyContext";

// Kanban de contatos por etapa do pipeline, com uma raia por EMPRESA (companies).
// Permite mover (drag & drop), criar rápido, editar e excluir direto do quadro.
export interface KanbanContact {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  company?: string | null;
  pipeline_stage?: string | null;
  company_id?: string | null;
}

export interface KanbanStage {
  key: string;
  label: string;
  color: string;
  dot: string;
}

interface Props {
  contacts: KanbanContact[];
  stages: KanbanStage[];
  onMove: (id: string, stage: string) => void;
  onCreate: (data: { name: string; stage: string; companyId: string | null }) => void;
  onEdit: (contact: KanbanContact) => void;
  onDelete: (id: string) => void;
}

const NO_CO = "__no_company__";

export const ContactPipelineKanban = ({ contacts, stages, onMove, onCreate, onEdit, onDelete }: Props) => {
  const { companies, selectedCompanyId } = useCompany();
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [adding, setAdding] = useState<string | null>(null); // `${companyId}:${stage}`
  const [draft, setDraft] = useState("");
  const [dragId, setDragId] = useState<string | null>(null);

  const lanes = useMemo(() => {
    const visible = selectedCompanyId !== "all" ? companies.filter((c) => c.id === selectedCompanyId) : companies;
    const out = visible.map((co) => ({ id: co.id, name: co.name, items: contacts.filter((c) => c.company_id === co.id) }));
    const orphans = contacts.filter((c) => !c.company_id || !companies.some((co) => co.id === c.company_id));
    if (orphans.length && selectedCompanyId === "all") out.push({ id: NO_CO, name: "Sem empresa", items: orphans });
    return out;
  }, [contacts, companies, selectedCompanyId]);

  const submit = (companyId: string, stage: string) => {
    if (!draft.trim()) return;
    onCreate({ name: draft.trim(), stage, companyId: companyId === NO_CO ? null : companyId });
    setDraft("");
    setAdding(null);
  };

  if (lanes.length === 0) {
    return <p className="text-sm text-muted-foreground py-10 text-center">Cadastre empresas para organizar o Kanban por empresa.</p>;
  }

  return (
    <div className="space-y-5">
      {lanes.map((lane) => {
        const isCollapsed = collapsed[lane.id];
        return (
          <Card key={lane.id} className="border border-border/50 bg-card/60 overflow-hidden">
            <button
              className="w-full flex items-center gap-2 px-4 py-2.5 hover:bg-muted/30 transition-colors text-left"
              onClick={() => setCollapsed((s) => ({ ...s, [lane.id]: !s[lane.id] }))}
            >
              {isCollapsed ? <ChevronRight className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
              <Globe className="h-4 w-4 text-primary/70" />
              <span className="text-sm font-semibold">{lane.name}</span>
              <Badge variant="secondary" className="ml-auto font-mono text-[10px]">{lane.items.length}</Badge>
            </button>
            {!isCollapsed && (
              <CardContent className="p-3 pt-0">
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
                  {stages.map((stage) => {
                    const items = lane.items.filter((c) => (c.pipeline_stage || "lead") === stage.key);
                    const addKey = `${lane.id}:${stage.key}`;
                    return (
                      <div
                        key={stage.key}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={() => { if (dragId) onMove(dragId, stage.key); setDragId(null); }}
                        className="rounded-xl border border-border/50 bg-background/40 p-2 min-h-[120px] flex flex-col gap-2"
                      >
                        <div className="flex items-center gap-1.5 px-1">
                          <span className={cn("h-1.5 w-1.5 rounded-full", stage.dot)} />
                          <span className="text-xs font-medium text-foreground/90">{stage.label}</span>
                          <span className="ml-auto text-[10px] font-mono text-muted-foreground">{items.length}</span>
                        </div>
                        {items.map((c) => (
                          <div
                            key={c.id}
                            draggable
                            onDragStart={() => setDragId(c.id)}
                            onDragEnd={() => setDragId(null)}
                            className={cn(
                              "group rounded-lg border border-border/50 bg-card/80 p-2 cursor-grab active:cursor-grabbing hover:border-primary/40 transition-colors",
                              dragId === c.id && "opacity-50",
                            )}
                          >
                            <div className="flex items-start gap-1">
                              <p className="text-xs font-medium truncate flex-1">{c.name}</p>
                              <div className="flex opacity-0 group-hover:opacity-100 transition-opacity">
                                <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => onEdit(c)}><Edit2 className="h-3 w-3" /></Button>
                                <Button size="icon" variant="ghost" className="h-6 w-6 text-muted-foreground hover:text-destructive" onClick={() => onDelete(c.id)}><Trash2 className="h-3 w-3" /></Button>
                              </div>
                            </div>
                            <div className="mt-0.5 space-y-0.5 text-[10px] text-muted-foreground">
                              {c.company && <p className="flex items-center gap-1 truncate"><Building2 className="h-2.5 w-2.5 shrink-0" />{c.company}</p>}
                              {c.phone && <p className="flex items-center gap-1 truncate"><Phone className="h-2.5 w-2.5 shrink-0" />{c.phone}</p>}
                              {c.email && <p className="flex items-center gap-1 truncate"><Mail className="h-2.5 w-2.5 shrink-0" />{c.email}</p>}
                            </div>
                          </div>
                        ))}
                        {adding === addKey ? (
                          <div className="flex gap-1">
                            <Input
                              autoFocus
                              value={draft}
                              onChange={(e) => setDraft(e.target.value)}
                              onKeyDown={(e) => { if (e.key === "Enter") submit(lane.id, stage.key); if (e.key === "Escape") { setAdding(null); setDraft(""); } }}
                              placeholder="Nome do contato"
                              className="h-7 text-xs"
                            />
                            <Button size="sm" className="h-7 text-[11px] px-2" onClick={() => submit(lane.id, stage.key)}>OK</Button>
                          </div>
                        ) : (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-[11px] text-muted-foreground justify-start gap-1 hover:text-primary"
                            onClick={() => { setAdding(addKey); setDraft(""); }}
                          >
                            <Plus className="h-3 w-3" /> Adicionar
                          </Button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            )}
          </Card>
        );
      })}
    </div>
  );
};

export default ContactPipelineKanban;
