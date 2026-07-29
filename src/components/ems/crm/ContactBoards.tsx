import { useMemo, useState } from "react";
import { DragDropContext, Draggable, Droppable, type DropResult } from "@hello-pangea/dnd";
import { format } from "date-fns";
import {
  Plus, Trash2, Pencil, ChevronDown, ChevronRight, GripVertical, Layers, Check, X,
  Mail, Phone, Search, FileDown, Sheet as SheetIcon, Building2, Briefcase, MoveRight,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { useCompany } from "@/contexts/CompanyContext";
import { exportCsv, exportTablePdf } from "@/lib/exportPdf";
import { toast } from "@/hooks/use-toast";
import type { useCrm } from "./useCrm";
import { useCrmBoards, type CrmBoard, type BoardCard } from "./useCrmBoards";
import { groupContactsForExport } from "./contactBoardExport";

const slug = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || `etapa-${Date.now()}`;

type Filters = { search: string; empresaId: string | null; clienteId: string | null; etapa: string | null };

const BoardBlock = ({
  board, boards, crm, filterFn, etapa, onOpenDetail,
}: {
  board: CrmBoard;
  boards: ReturnType<typeof useCrmBoards>;
  crm: ReturnType<typeof useCrm>;
  filterFn: (contactId: string) => boolean;
  etapa: string | null;
  onOpenDetail: (card: BoardCard, boardName: string, stageTitle: string) => void;
}) => {
  const [open, setOpen] = useState(true);
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(board.name);
  const [segment, setSegment] = useState(board.segment ?? "");
  const [newStage, setNewStage] = useState("");
  const [addTo, setAddTo] = useState<string | null>(null);
  const [pick, setPick] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [moveTo, setMoveTo] = useState("");

  const cards = boards.cardsByBoard.get(board.id) ?? [];
  const contactById = useMemo(() => new Map(crm.contacts.map((c) => [c.id, c])), [crm.contacts]);
  const usedIds = useMemo(() => new Set(cards.map((c) => c.contact_id)), [cards]);
  const available = crm.contacts.filter((c) => !usedIds.has(c.id));
  const visibleStages = board.stages.filter((s) => !etapa || s.title === etapa);

  const byStage = useMemo(() => {
    const map: Record<string, BoardCard[]> = {};
    board.stages.forEach((s) => { map[s.id] = []; });
    for (const c of cards) if (filterFn(c.contact_id)) (map[c.stage_id] ?? map[board.stages[0]?.id] ?? []).push(c);
    Object.values(map).forEach((l) => l.sort((a, b) => a.order_index - b.order_index));
    return map;
  }, [cards, board.stages, filterFn]);

  const onDragEnd = (r: DropResult) => {
    if (!r.destination) return;
    boards.moveCard.mutate({ id: r.draggableId, stage_id: r.destination.droppableId, order_index: r.destination.index });
  };

  const toggle = (id: string) => setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const moveSelected = () => {
    if (!moveTo) return;
    [...selected].forEach((id, i) => boards.moveCard.mutate({ id, stage_id: moveTo, order_index: i }));
    setSelected(new Set());
    setMoveTo("");
  };

  const saveHeader = () => {
    boards.updateBoard.mutate({ id: board.id, patch: { name: name.trim() || board.name, segment: segment.trim() || null } });
    setRenaming(false);
  };
  const addStage = () => {
    const title = newStage.trim(); if (!title) return;
    // id único: se o slug colidir com uma etapa existente, sufixa (droppableId/draggableId não podem repetir).
    const existing = new Set(board.stages.map((s) => s.id));
    let id = slug(title);
    if (existing.has(id)) { let i = 2; while (existing.has(`${id}-${i}`)) i++; id = `${id}-${i}`; }
    boards.updateBoard.mutate({ id: board.id, patch: { stages: [...board.stages, { id, title }] } });
    setNewStage("");
  };
  const removeStage = (id: string) => {
    if (board.stages.length <= 1) return;
    const stages = board.stages.filter((s) => s.id !== id);
    boards.updateBoard.mutate({ id: board.id, patch: { stages } });
    (byStage[id] ?? []).forEach((c) => boards.moveCard.mutate({ id: c.id, stage_id: stages[0].id, order_index: 0 }));
  };

  return (
    <Card className="border-border/60">
      <div className="flex flex-wrap items-center gap-2 border-b border-border/50 p-3">
        <button onClick={() => setOpen((v) => !v)} className="text-muted-foreground hover:text-foreground">
          {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </button>
        {renaming ? (
          <>
            <Input value={name} onChange={(e) => setName(e.target.value)} className="h-8 w-44" placeholder="Empresa" />
            <Input value={segment} onChange={(e) => setSegment(e.target.value)} className="h-8 w-40" placeholder="Segmento" />
            <Button size="sm" variant="ghost" onClick={saveHeader}><Check className="h-4 w-4" /></Button>
            <Button size="sm" variant="ghost" onClick={() => setRenaming(false)}><X className="h-4 w-4" /></Button>
          </>
        ) : (
          <>
            <h3 className="font-semibold text-sm">{board.name}</h3>
            {board.segment && <Badge variant="outline" className="text-[10px]">{board.segment}</Badge>}
            <Badge variant="secondary" className="text-[10px]">{cards.length} contato{cards.length === 1 ? "" : "s"}</Badge>
            <Button size="sm" variant="ghost" onClick={() => setRenaming(true)}><Pencil className="h-3.5 w-3.5" /></Button>
          </>
        )}
        <div className="ml-auto flex items-center gap-1.5">
          <Input value={newStage} onChange={(e) => setNewStage(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addStage()} placeholder="+ etapa" className="h-8 w-28" />
          <Button size="sm" variant="ghost" onClick={() => boards.deleteBoard.mutate(board.id)} title="Excluir quadro"><Trash2 className="h-3.5 w-3.5 text-red-400" /></Button>
        </div>
      </div>

      {open && (
        <CardContent className="p-3">
          {selected.size > 0 && (
            <div className="mb-2 flex flex-wrap items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 p-2 text-xs">
              <span className="font-medium">{selected.size} selecionado{selected.size > 1 ? "s" : ""}</span>
              <Select value={moveTo} onValueChange={setMoveTo}>
                <SelectTrigger className="h-7 w-[150px] text-xs"><SelectValue placeholder="Mover para…" /></SelectTrigger>
                <SelectContent>{board.stages.map((s) => <SelectItem key={s.id} value={s.id}>{s.title}</SelectItem>)}</SelectContent>
              </Select>
              <Button size="sm" className="h-7 gap-1 text-xs" disabled={!moveTo} onClick={moveSelected}><MoveRight className="h-3.5 w-3.5" />Mover</Button>
              <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setSelected(new Set())}>limpar</Button>
            </div>
          )}
          <DragDropContext onDragEnd={onDragEnd}>
            <div className="flex gap-3 overflow-x-auto pb-2">
              {visibleStages.map((stage) => (
                <Droppable droppableId={stage.id} key={stage.id}>
                  {(provided, snapshot) => (
                    <div ref={provided.innerRef} {...provided.droppableProps} className={cn("w-[230px] shrink-0 rounded-xl border bg-card/40 transition-colors", snapshot.isDraggingOver && "border-primary/50 bg-primary/5")}>
                      <div className="flex items-center gap-1.5 border-b border-border/50 p-2">
                        <span className="text-xs font-semibold">{stage.title}</span>
                        <Badge variant="secondary" className="text-[10px]">{(byStage[stage.id] ?? []).length}</Badge>
                        <button onClick={() => removeStage(stage.id)} className="ml-auto text-muted-foreground hover:text-red-400" title="Remover etapa"><X className="h-3 w-3" /></button>
                      </div>
                      <div className="min-h-[80px] space-y-1.5 p-2">
                        {(byStage[stage.id] ?? []).map((card, index) => {
                          const ct = contactById.get(card.contact_id);
                          return (
                            <Draggable draggableId={card.id} index={index} key={card.id}>
                              {(dp, ds) => (
                                <div ref={dp.innerRef} {...dp.draggableProps} className={cn("rounded-lg border border-border/60 bg-card p-2 text-xs", ds.isDragging && "border-primary/40 shadow-lg", selected.has(card.id) && "ring-1 ring-primary/50")}>
                                  <div className="flex items-start gap-1.5">
                                    <Checkbox checked={selected.has(card.id)} onCheckedChange={() => toggle(card.id)} className="mt-0.5" onClick={(e) => e.stopPropagation()} />
                                    <span {...dp.dragHandleProps} className="mt-0.5 shrink-0 cursor-grab text-muted-foreground/40"><GripVertical className="h-3.5 w-3.5" /></span>
                                    <button className="flex-1 truncate text-left font-medium hover:text-primary" onClick={() => onOpenDetail(card, board.name, stage.title)}>
                                      {ct?.name ?? "Contato removido"}
                                    </button>
                                    <button onClick={() => boards.removeCard.mutate(card.id)} className="text-muted-foreground hover:text-red-400" title="Tirar do quadro"><X className="h-3 w-3" /></button>
                                  </div>
                                  {ct?.company && <p className="pl-9 text-[10px] text-muted-foreground truncate">{ct.company}</p>}
                                  <div className="flex items-center gap-2 pl-9 pt-1 text-[10px] text-muted-foreground">
                                    {ct?.email && <span className="flex items-center gap-1 truncate"><Mail className="h-3 w-3" />{ct.email}</span>}
                                    {ct?.phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{ct.phone}</span>}
                                  </div>
                                </div>
                              )}
                            </Draggable>
                          );
                        })}
                        {provided.placeholder}

                        {addTo === stage.id ? (
                          <div className="space-y-1.5">
                            <Select value={pick} onValueChange={(v) => { boards.addCard.mutate({ board_id: board.id, contact_id: v, stage_id: stage.id }); setPick(""); setAddTo(null); }}>
                              <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Escolher contato" /></SelectTrigger>
                              <SelectContent>{available.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}{c.company ? ` · ${c.company}` : ""}</SelectItem>)}</SelectContent>
                            </Select>
                            <Button size="sm" variant="ghost" className="h-7 w-full text-[11px]" onClick={() => setAddTo(null)}>cancelar</Button>
                          </div>
                        ) : (
                          <button onClick={() => setAddTo(stage.id)} className="w-full rounded-lg border border-dashed border-border/60 py-1.5 text-[11px] text-muted-foreground hover:border-primary/40 hover:text-foreground">+ contato</button>
                        )}
                      </div>
                    </div>
                  )}
                </Droppable>
              ))}
            </div>
          </DragDropContext>
        </CardContent>
      )}
    </Card>
  );
};

export const ContactBoards = ({ crm }: { crm: ReturnType<typeof useCrm> }) => {
  const boards = useCrmBoards();
  const { companies } = useCompany();
  const [name, setName] = useState("");
  const [segment, setSegment] = useState("");
  const [f, setF] = useState<Filters>({ search: "", empresaId: null, clienteId: null, etapa: null });
  const [detail, setDetail] = useState<{ card: BoardCard; boardName: string; stageTitle: string } | null>(null);

  const contactById = useMemo(() => new Map(crm.contacts.map((c) => [c.id, c])), [crm.contacts]);
  const companyName = (id?: string | null) => (id ? companies.find((c) => c.id === id)?.name || "—" : "—");
  const customerName = (id?: string | null) => (id ? crm.customers.find((c) => c.id === id)?.nome || "—" : "—");

  // Empresas presentes nos contatos + clientes + títulos de etapa (pra os filtros).
  const empresaOpts = useMemo(() => {
    const ids = new Set(crm.contacts.map((c) => c.company_id).filter(Boolean) as string[]);
    return companies.filter((c) => ids.has(c.id));
  }, [crm.contacts, companies]);
  const stageTitles = useMemo(() => {
    const set = new Set<string>();
    boards.boards.forEach((b) => b.stages.forEach((s) => set.add(s.title)));
    return [...set];
  }, [boards.boards]);

  const filterFn = (contactId: string) => {
    const ct = contactById.get(contactId);
    if (!ct) return false;
    if (f.empresaId && ct.company_id !== f.empresaId) return false;
    if (f.clienteId && ct.customer_id !== f.clienteId) return false;
    if (f.search) {
      const q = f.search.toLowerCase();
      if (!`${ct.name} ${ct.company || ""} ${ct.email || ""}`.toLowerCase().includes(q)) return false;
    }
    return true;
  };

  const buildGroups = () =>
    groupContactsForExport(
      boards.boards.map((b) => ({ id: b.id, name: b.name, stages: b.stages })),
      boards.cardsByBoard,
      contactById as any,
      filterFn,
      f.etapa,
    );

  const exportSheet = () => {
    const groups = buildGroups();
    if (!groups.length) { toast({ title: "Nada para exportar com os filtros atuais" }); return; }
    const rows = groups.flatMap((g) => g.contatos.map((c) => [g.empresa, g.etapa, c.nome, c.empresa, c.email, c.telefone]));
    exportCsv(`contatos-${format(new Date(), "yyyy-MM-dd")}.csv`, ["Empresa", "Etapa", "Nome", "Org", "Email", "Telefone"], rows);
  };
  const exportPdf = async () => {
    const groups = buildGroups();
    if (!groups.length) { toast({ title: "Nada para exportar com os filtros atuais" }); return; }
    await exportTablePdf({
      title: "Contatos por empresa e etapa",
      subtitle: `Gerado em ${format(new Date(), "dd/MM/yyyy HH:mm")}`,
      filename: `contatos-${format(new Date(), "yyyy-MM-dd")}.pdf`,
      sections: groups.map((g) => ({ heading: `${g.empresa} · ${g.etapa}`, head: [["Nome", "Org", "Email", "Telefone"]], body: g.contatos.map((c) => [c.nome, c.empresa, c.email, c.telefone]) })),
    });
  };

  const create = () => { if (!name.trim()) return; boards.createBoard.mutate({ name, segment }); setName(""); setSegment(""); };

  const detailContact = detail ? contactById.get(detail.card.contact_id) : null;
  const detailDeals = detail && detailContact ? (crm.deals as any[]).filter((d) => d.contact_id === detailContact.id).length : 0;

  return (
    <div className="space-y-3">
      {/* Toolbar de filtros + export */}
      <Card className="border-border/60">
        <CardContent className="flex flex-wrap items-center gap-2 p-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input value={f.search} onChange={(e) => setF((s) => ({ ...s, search: e.target.value }))} placeholder="Buscar nome/empresa/email" className="h-8 w-56 pl-7 text-xs" />
          </div>
          <Select value={f.empresaId ?? "all"} onValueChange={(v) => setF((s) => ({ ...s, empresaId: v === "all" ? null : v }))}>
            <SelectTrigger className="h-8 w-[150px] text-xs"><SelectValue placeholder="Empresa" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as empresas</SelectItem>
              {empresaOpts.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={f.clienteId ?? "all"} onValueChange={(v) => setF((s) => ({ ...s, clienteId: v === "all" ? null : v }))}>
            <SelectTrigger className="h-8 w-[150px] text-xs"><SelectValue placeholder="Cliente" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os clientes</SelectItem>
              {crm.customers.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
            </SelectContent>
          </Select>
          {stageTitles.length > 0 && (
            <Select value={f.etapa ?? "all"} onValueChange={(v) => setF((s) => ({ ...s, etapa: v === "all" ? null : v }))}>
              <SelectTrigger className="h-8 w-[130px] text-xs"><SelectValue placeholder="Etapa" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as etapas</SelectItem>
                {stageTitles.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
          {(f.search || f.empresaId || f.clienteId || f.etapa) && (
            <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => setF({ search: "", empresaId: null, clienteId: null, etapa: null })}>limpar</Button>
          )}
          <div className="ml-auto flex items-center gap-1.5">
            <Button size="sm" variant="outline" className="h-8 gap-1.5 text-xs" onClick={exportSheet}><SheetIcon className="h-3.5 w-3.5" />CSV</Button>
            <Button size="sm" variant="outline" className="h-8 gap-1.5 text-xs" onClick={exportPdf}><FileDown className="h-3.5 w-3.5" />PDF</Button>
          </div>
        </CardContent>
      </Card>

      {/* Novo quadro */}
      <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
        <CardContent className="flex flex-wrap items-center gap-2 p-3">
          <Layers className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium">Novo quadro</span>
          <Input value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && create()} placeholder="Empresa" className="h-9 w-48" />
          <Input value={segment} onChange={(e) => setSegment(e.target.value)} onKeyDown={(e) => e.key === "Enter" && create()} placeholder="Segmento (opcional)" className="h-9 w-48" />
          <Button size="sm" onClick={create} disabled={!name.trim()}><Plus className="mr-1 h-4 w-4" /> Criar kanban</Button>
        </CardContent>
      </Card>

      {boards.isLoading ? (
        <p className="p-6 text-center text-sm text-muted-foreground">Carregando…</p>
      ) : boards.boards.length === 0 ? (
        <p className="p-6 text-center text-sm text-muted-foreground">Nenhum quadro ainda — crie um por empresa/segmento e arraste os contatos entre as etapas.</p>
      ) : (
        boards.boards.map((b) => <BoardBlock key={b.id} board={b} boards={boards} crm={crm} filterFn={filterFn} etapa={f.etapa} onOpenDetail={(card, boardName, stageTitle) => setDetail({ card, boardName, stageTitle })} />)
      )}

      {/* Painel lateral de detalhe */}
      <Sheet open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <SheetContent className="w-[340px] sm:w-[380px]">
          <SheetHeader><SheetTitle>{detailContact?.name ?? "Contato"}</SheetTitle></SheetHeader>
          {detailContact && (
            <div className="mt-4 space-y-3 text-sm">
              <div className="rounded-lg border border-border/50 p-2.5 space-y-1.5">
                <p className="flex items-center gap-2"><Building2 className="h-3.5 w-3.5 text-muted-foreground" />Empresa/produto: <b>{companyName(detailContact.company_id)}</b></p>
                <p className="flex items-center gap-2"><Briefcase className="h-3.5 w-3.5 text-muted-foreground" />Cliente: <b>{customerName(detailContact.customer_id)}</b></p>
                <p className="flex items-center gap-2"><Layers className="h-3.5 w-3.5 text-muted-foreground" />Quadro/etapa: <b>{detail?.boardName} · {detail?.stageTitle}</b></p>
              </div>
              <div className="rounded-lg border border-border/50 p-2.5 space-y-1.5">
                {detailContact.company && <p className="text-muted-foreground">Org: {detailContact.company}</p>}
                {detailContact.email && <p className="flex items-center gap-2"><Mail className="h-3.5 w-3.5 text-muted-foreground" />{detailContact.email}</p>}
                {detailContact.phone && <p className="flex items-center gap-2"><Phone className="h-3.5 w-3.5 text-muted-foreground" />{detailContact.phone}</p>}
              </div>
              <div className="rounded-lg border border-border/50 p-2.5">
                <p className="text-xs text-muted-foreground">Deals ligados</p>
                <p className="font-mono text-lg font-bold">{detailDeals}</p>
              </div>
              {detailContact.customer_id && (
                <Button size="sm" variant="outline" className="w-full" onClick={() => { setDetail(null); }}>Fechar</Button>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
};

export default ContactBoards;
