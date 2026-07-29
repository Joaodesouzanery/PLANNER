import { useMemo, useState } from "react";
import {
  Plus, Edit2, Trash2, Building2, Phone, Mail, Globe, ChevronDown, ChevronRight,
  Search, FileDown, FileText, X, CheckSquare,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { useCompany } from "@/contexts/CompanyContext";
import { exportCsv, exportTablePdf } from "@/lib/exportPdf";

// Kanban de contatos por etapa do pipeline, com uma raia por EMPRESA (companies).
// Permite mover (drag & drop), criar rápido, editar, excluir, filtrar, selecionar
// vários para mover em lote, ver detalhes num painel lateral e exportar (CSV/PDF).
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
const ALL = "__all__";

export const ContactPipelineKanban = ({ contacts, stages, onMove, onCreate, onEdit, onDelete }: Props) => {
  const { companies, selectedCompanyId } = useCompany();
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [adding, setAdding] = useState<string | null>(null); // `${companyId}:${stage}`
  const [draft, setDraft] = useState("");
  const [dragId, setDragId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [laneFilter, setLaneFilter] = useState<string>(ALL);
  const [stageFilter, setStageFilter] = useState<string>(ALL);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [detailId, setDetailId] = useState<string | null>(null);

  const stageLabel = useMemo(() => new Map(stages.map((s) => [s.key, s.label])), [stages]);
  const companyLabel = useMemo(() => new Map(companies.map((c) => [c.id, c.name])), [companies]);

  const visibleStages = useMemo(
    () => (stageFilter === ALL ? stages : stages.filter((s) => s.key === stageFilter)),
    [stages, stageFilter],
  );

  // Busca por nome, empresa (texto livre), e-mail ou telefone.
  const matches = (c: KanbanContact) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return [c.name, c.company, c.email, c.phone].some((v) => (v || "").toLowerCase().includes(q));
  };

  const lanes = useMemo(() => {
    const visible = selectedCompanyId !== "all" ? companies.filter((c) => c.id === selectedCompanyId) : companies;
    const filtered = contacts.filter(matches);
    const out = visible.map((co) => ({ id: co.id, name: co.name, items: filtered.filter((c) => c.company_id === co.id) }));
    const orphans = filtered.filter((c) => !c.company_id || !companies.some((co) => co.id === c.company_id));
    if (orphans.length && selectedCompanyId === "all") out.push({ id: NO_CO, name: "Sem empresa", items: orphans });
    return laneFilter === ALL ? out : out.filter((l) => l.id === laneFilter);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contacts, companies, selectedCompanyId, laneFilter, search]);

  const selectedIds = useMemo(() => Object.keys(selected).filter((k) => selected[k]), [selected]);
  const detail = useMemo(() => contacts.find((c) => c.id === detailId) || null, [contacts, detailId]);

  const toggleSel = (id: string) => setSelected((s) => ({ ...s, [id]: !s[id] }));
  const clearSel = () => setSelected({});

  const bulkMove = (stage: string) => {
    selectedIds.forEach((id) => onMove(id, stage));
    clearSel();
  };

  // Linhas de exportação: uma por contato, com empresa e etapa resolvidas.
  const exportRows = () =>
    lanes.flatMap((lane) =>
      visibleStages.flatMap((stage) =>
        lane.items
          .filter((c) => (c.pipeline_stage || stages[0]?.key) === stage.key)
          .map((c) => [lane.name, stage.label, c.name, c.company || "", c.email || "", c.phone || ""]),
      ),
    );

  const HEADERS = ["Empresa", "Etapa", "Contato", "Organização", "E-mail", "Telefone"];

  const doExportCsv = () => exportCsv("contatos-kanban.csv", HEADERS, exportRows());
  const doExportPdf = () =>
    exportTablePdf({
      title: "Contatos por empresa e etapa",
      subtitle: `${exportRows().length} contato(s) · gerado em ${new Date().toLocaleDateString("pt-BR")}`,
      filename: "contatos-kanban.pdf",
      orientation: "landscape",
      sections: [{ head: [HEADERS], body: exportRows() }],
    });

  const submit = (companyId: string, stage: string) => {
    if (!draft.trim()) return;
    onCreate({ name: draft.trim(), stage, companyId: companyId === NO_CO ? null : companyId });
    setDraft("");
    setAdding(null);
  };

  const laneOptions = useMemo(() => {
    const base = selectedCompanyId !== "all" ? companies.filter((c) => c.id === selectedCompanyId) : companies;
    return [...base.map((c) => ({ id: c.id, name: c.name })), { id: NO_CO, name: "Sem empresa" }];
  }, [companies, selectedCompanyId]);

  return (
    <div className="space-y-4">
      {/* Barra de busca, filtros e exportação */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por nome, empresa, e-mail ou telefone" className="h-9 pl-8" />
        </div>
        <Select value={laneFilter} onValueChange={setLaneFilter}>
          <SelectTrigger className="h-9 w-[170px] text-xs"><SelectValue placeholder="Empresa" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Todas as empresas</SelectItem>
            {laneOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={stageFilter} onValueChange={setStageFilter}>
          <SelectTrigger className="h-9 w-[150px] text-xs"><SelectValue placeholder="Etapa" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Todas as etapas</SelectItem>
            {stages.map((s) => <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" className="h-9 gap-1.5" onClick={doExportCsv}><FileDown className="h-3.5 w-3.5" /> CSV</Button>
        <Button variant="outline" size="sm" className="h-9 gap-1.5" onClick={doExportPdf}><FileText className="h-3.5 w-3.5" /> PDF</Button>
      </div>

      {/* Ações em lote */}
      {selectedIds.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-primary/30 bg-primary/5 px-3 py-2">
          <CheckSquare className="h-4 w-4 text-primary" />
          <span className="text-xs font-medium">{selectedIds.length} selecionado(s)</span>
          <Select onValueChange={bulkMove}>
            <SelectTrigger className="h-8 w-[190px] text-xs"><SelectValue placeholder="Mover para etapa..." /></SelectTrigger>
            <SelectContent>
              {stages.map((s) => <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button variant="ghost" size="sm" className="h-8 gap-1 text-xs" onClick={clearSel}><X className="h-3.5 w-3.5" /> Limpar</Button>
        </div>
      )}

      {lanes.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">Nenhum contato encontrado para os filtros atuais.</p>
      ) : (
        <div className="space-y-5">
          {lanes.map((lane) => {
            const isCollapsed = collapsed[lane.id];
            return (
              <Card key={lane.id} className="overflow-hidden border border-border/50 bg-card/60">
                <button
                  className="flex w-full items-center gap-2 px-4 py-2.5 text-left transition-colors hover:bg-muted/30"
                  onClick={() => setCollapsed((s) => ({ ...s, [lane.id]: !s[lane.id] }))}
                >
                  {isCollapsed ? <ChevronRight className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                  <Globe className="h-4 w-4 text-primary/70" />
                  <span className="text-sm font-semibold">{lane.name}</span>
                  <Badge variant="secondary" className="ml-auto font-mono text-[10px]">{lane.items.length}</Badge>
                </button>
                {!isCollapsed && (
                  <CardContent className="p-3 pt-0">
                    <div className={cn("grid grid-cols-1 gap-3 sm:grid-cols-2", visibleStages.length > 2 && "xl:grid-cols-4")}>
                      {visibleStages.map((stage) => {
                        const items = lane.items.filter((c) => (c.pipeline_stage || stages[0]?.key) === stage.key);
                        const addKey = `${lane.id}:${stage.key}`;
                        return (
                          <div
                            key={stage.key}
                            onDragOver={(e) => e.preventDefault()}
                            onDrop={() => { if (dragId) onMove(dragId, stage.key); setDragId(null); }}
                            className="flex min-h-[120px] flex-col gap-2 rounded-xl border border-border/50 bg-background/40 p-2"
                          >
                            <div className="flex items-center gap-1.5 px-1">
                              <span className={cn("h-1.5 w-1.5 rounded-full", stage.dot)} />
                              <span className="text-xs font-medium text-foreground/90">{stage.label}</span>
                              <span className="ml-auto font-mono text-[10px] text-muted-foreground">{items.length}</span>
                            </div>
                            {items.map((c) => (
                              <div
                                key={c.id}
                                draggable
                                onDragStart={() => setDragId(c.id)}
                                onDragEnd={() => setDragId(null)}
                                className={cn(
                                  "group cursor-grab rounded-lg border border-border/50 bg-card/80 p-2 transition-colors hover:border-primary/40 active:cursor-grabbing",
                                  dragId === c.id && "opacity-50",
                                  selected[c.id] && "border-primary/60 bg-primary/5",
                                )}
                              >
                                <div className="flex items-start gap-1.5">
                                  <Checkbox
                                    checked={!!selected[c.id]}
                                    onCheckedChange={() => toggleSel(c.id)}
                                    className="mt-0.5 h-3.5 w-3.5 shrink-0"
                                    aria-label={`Selecionar ${c.name}`}
                                  />
                                  <button className="min-w-0 flex-1 text-left" onClick={() => setDetailId(c.id)}>
                                    <p className="truncate text-xs font-medium">{c.name}</p>
                                  </button>
                                  <div className="flex opacity-0 transition-opacity group-hover:opacity-100">
                                    <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => onEdit(c)}><Edit2 className="h-3 w-3" /></Button>
                                    <Button size="icon" variant="ghost" className="h-6 w-6 text-muted-foreground hover:text-destructive" onClick={() => onDelete(c.id)}><Trash2 className="h-3 w-3" /></Button>
                                  </div>
                                </div>
                                <div className="mt-0.5 space-y-0.5 pl-5 text-[10px] text-muted-foreground">
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
                                <Button size="sm" className="h-7 px-2 text-[11px]" onClick={() => submit(lane.id, stage.key)}>OK</Button>
                              </div>
                            ) : (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 justify-start gap-1 text-[11px] text-muted-foreground hover:text-primary"
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
      )}

      {/* Painel lateral de detalhes */}
      <Sheet open={!!detail} onOpenChange={(o) => !o && setDetailId(null)}>
        <SheetContent className="w-full sm:max-w-md">
          {detail && (
            <>
              <SheetHeader>
                <SheetTitle className="text-base">{detail.name}</SheetTitle>
              </SheetHeader>
              <div className="mt-4 space-y-4 text-sm">
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline" className="gap-1"><Globe className="h-3 w-3" />{detail.company_id ? companyLabel.get(detail.company_id) || "Sem empresa" : "Sem empresa"}</Badge>
                  <Badge variant="secondary">{stageLabel.get(detail.pipeline_stage || "") || "Sem etapa"}</Badge>
                </div>
                <Separator />
                <dl className="space-y-2 text-xs">
                  <div className="flex items-center gap-2"><Building2 className="h-3.5 w-3.5 text-muted-foreground" /><span className="text-muted-foreground">Organização:</span><span>{detail.company || "—"}</span></div>
                  <div className="flex items-center gap-2"><Phone className="h-3.5 w-3.5 text-muted-foreground" /><span className="text-muted-foreground">Telefone:</span><span>{detail.phone || "—"}</span></div>
                  <div className="flex items-center gap-2"><Mail className="h-3.5 w-3.5 text-muted-foreground" /><span className="text-muted-foreground">E-mail:</span><span className="truncate">{detail.email || "—"}</span></div>
                </dl>
                <Separator />
                <div>
                  <p className="mb-1.5 text-xs font-medium text-muted-foreground">Mover para etapa</p>
                  <Select value={detail.pipeline_stage || stages[0]?.key} onValueChange={(v) => onMove(detail.id, v)}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {stages.map((s) => <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex gap-2 pt-2">
                  <Button size="sm" variant="outline" className="gap-1.5" onClick={() => onEdit(detail)}><Edit2 className="h-3.5 w-3.5" /> Editar</Button>
                  <Button size="sm" variant="ghost" className="gap-1.5 text-muted-foreground hover:text-destructive" onClick={() => { onDelete(detail.id); setDetailId(null); }}><Trash2 className="h-3.5 w-3.5" /> Excluir</Button>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
};

export default ContactPipelineKanban;
