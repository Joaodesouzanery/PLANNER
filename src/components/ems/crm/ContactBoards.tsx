import { useMemo, useState } from "react";
import { DragDropContext, Draggable, Droppable, type DropResult } from "@hello-pangea/dnd";
import {
  Plus,
  Trash2,
  Pencil,
  ChevronDown,
  ChevronRight,
  GripVertical,
  Layers,
  Check,
  X,
  Mail,
  Phone,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { useCrm } from "./useCrm";
import { useCrmBoards, type BoardStage, type CrmBoard } from "./useCrmBoards";

// Quadros de contatos por empresa/segmento: vários kanbans empilhados (um embaixo do outro),
// cada um com etapas editáveis e contatos arrastáveis entre elas.
const slug = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "") || `etapa-${Date.now()}`;

const BoardBlock = ({
  board,
  boards,
  crm,
}: {
  board: CrmBoard;
  boards: ReturnType<typeof useCrmBoards>;
  crm: ReturnType<typeof useCrm>;
}) => {
  const [open, setOpen] = useState(true);
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(board.name);
  const [segment, setSegment] = useState(board.segment ?? "");
  const [newStage, setNewStage] = useState("");
  const [addTo, setAddTo] = useState<string | null>(null);
  const [pick, setPick] = useState("");

  const cards = boards.cardsByBoard.get(board.id) ?? [];
  const contactById = useMemo(() => new Map(crm.contacts.map((c) => [c.id, c])), [crm.contacts]);
  const usedIds = useMemo(() => new Set(cards.map((c) => c.contact_id)), [cards]);
  const available = crm.contacts.filter((c) => !usedIds.has(c.id));

  const byStage = useMemo(() => {
    const map: Record<string, typeof cards> = {};
    board.stages.forEach((s) => {
      map[s.id] = [];
    });
    for (const c of cards) (map[c.stage_id] ?? map[board.stages[0]?.id] ?? []).push(c);
    Object.values(map).forEach((l) => l.sort((a, b) => a.order_index - b.order_index));
    return map;
  }, [cards, board.stages]);

  const onDragEnd = (r: DropResult) => {
    if (!r.destination) return;
    boards.moveCard.mutate({
      id: r.draggableId,
      stage_id: r.destination.droppableId,
      order_index: r.destination.index,
    });
  };

  const saveHeader = () => {
    boards.updateBoard.mutate({
      id: board.id,
      patch: { name: name.trim() || board.name, segment: segment.trim() || null },
    });
    setRenaming(false);
  };

  const addStage = () => {
    const title = newStage.trim();
    if (!title) return;
    const stages: BoardStage[] = [...board.stages, { id: slug(title), title }];
    boards.updateBoard.mutate({ id: board.id, patch: { stages } });
    setNewStage("");
  };
  const removeStage = (id: string) => {
    if (board.stages.length <= 1) return;
    const stages = board.stages.filter((s) => s.id !== id);
    boards.updateBoard.mutate({ id: board.id, patch: { stages } });
    (byStage[id] ?? []).forEach((c) =>
      boards.moveCard.mutate({ id: c.id, stage_id: stages[0].id, order_index: 0 }),
    );
  };

  return (
    <Card className="border-border/60">
      <div className="flex flex-wrap items-center gap-2 border-b border-border/50 p-3">
        <button
          onClick={() => setOpen((v) => !v)}
          className="text-muted-foreground hover:text-foreground"
        >
          {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </button>
        {renaming ? (
          <>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-8 w-44"
              placeholder="Empresa"
            />
            <Input
              value={segment}
              onChange={(e) => setSegment(e.target.value)}
              className="h-8 w-40"
              placeholder="Segmento"
            />
            <Button size="sm" variant="ghost" onClick={saveHeader}>
              <Check className="h-4 w-4" />
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setRenaming(false)}>
              <X className="h-4 w-4" />
            </Button>
          </>
        ) : (
          <>
            <h3 className="font-semibold text-sm">{board.name}</h3>
            {board.segment && (
              <Badge variant="outline" className="text-[10px]">
                {board.segment}
              </Badge>
            )}
            <Badge variant="secondary" className="text-[10px]">
              {cards.length} contato{cards.length === 1 ? "" : "s"}
            </Badge>
            <Button size="sm" variant="ghost" onClick={() => setRenaming(true)}>
              <Pencil className="h-3.5 w-3.5" />
            </Button>
          </>
        )}
        <div className="ml-auto flex items-center gap-1.5">
          <Input
            value={newStage}
            onChange={(e) => setNewStage(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addStage()}
            placeholder="+ etapa"
            className="h-8 w-28"
          />
          <Button
            size="sm"
            variant="ghost"
            onClick={() => boards.deleteBoard.mutate(board.id)}
            title="Excluir quadro"
          >
            <Trash2 className="h-3.5 w-3.5 text-red-400" />
          </Button>
        </div>
      </div>

      {open && (
        <CardContent className="p-3">
          <DragDropContext onDragEnd={onDragEnd}>
            <div className="flex gap-3 overflow-x-auto pb-2">
              {board.stages.map((stage) => (
                <Droppable droppableId={stage.id} key={stage.id}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className={cn(
                        "w-[230px] shrink-0 rounded-xl border bg-card/40 transition-colors",
                        snapshot.isDraggingOver && "border-primary/50 bg-primary/5",
                      )}
                    >
                      <div className="flex items-center gap-1.5 border-b border-border/50 p-2">
                        <span className="text-xs font-semibold">{stage.title}</span>
                        <Badge variant="secondary" className="text-[10px]">
                          {(byStage[stage.id] ?? []).length}
                        </Badge>
                        <button
                          onClick={() => removeStage(stage.id)}
                          className="ml-auto text-muted-foreground hover:text-red-400"
                          title="Remover etapa"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                      <div className="min-h-[80px] space-y-1.5 p-2">
                        {(byStage[stage.id] ?? []).map((card, index) => {
                          const ct = contactById.get(card.contact_id);
                          return (
                            <Draggable draggableId={card.id} index={index} key={card.id}>
                              {(dp, ds) => (
                                <div
                                  ref={dp.innerRef}
                                  {...dp.draggableProps}
                                  {...dp.dragHandleProps}
                                  className={cn(
                                    "rounded-lg border border-border/60 bg-card p-2 text-xs",
                                    ds.isDragging && "border-primary/40 shadow-lg",
                                  )}
                                >
                                  <div className="flex items-start gap-1.5">
                                    <GripVertical className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground/40" />
                                    <span className="flex-1 truncate font-medium">
                                      {ct?.name ?? "Contato removido"}
                                    </span>
                                    <button
                                      onClick={() => boards.removeCard.mutate(card.id)}
                                      className="text-muted-foreground hover:text-red-400"
                                      title="Tirar do quadro"
                                    >
                                      <X className="h-3 w-3" />
                                    </button>
                                  </div>
                                  {ct?.company && (
                                    <p className="pl-5 text-[10px] text-muted-foreground truncate">
                                      {ct.company}
                                    </p>
                                  )}
                                  <div className="flex items-center gap-2 pl-5 pt-1 text-[10px] text-muted-foreground">
                                    {ct?.email && (
                                      <span className="flex items-center gap-1 truncate">
                                        <Mail className="h-3 w-3" />
                                        {ct.email}
                                      </span>
                                    )}
                                    {ct?.phone && (
                                      <span className="flex items-center gap-1">
                                        <Phone className="h-3 w-3" />
                                        {ct.phone}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              )}
                            </Draggable>
                          );
                        })}
                        {provided.placeholder}

                        {addTo === stage.id ? (
                          <div className="space-y-1.5">
                            <Select
                              value={pick}
                              onValueChange={(v) => {
                                boards.addCard.mutate({
                                  board_id: board.id,
                                  contact_id: v,
                                  stage_id: stage.id,
                                });
                                setPick("");
                                setAddTo(null);
                              }}
                            >
                              <SelectTrigger className="h-8 text-xs">
                                <SelectValue placeholder="Escolher contato" />
                              </SelectTrigger>
                              <SelectContent>
                                {available.map((c) => (
                                  <SelectItem key={c.id} value={c.id}>
                                    {c.name}
                                    {c.company ? ` · ${c.company}` : ""}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 w-full text-[11px]"
                              onClick={() => setAddTo(null)}
                            >
                              cancelar
                            </Button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setAddTo(stage.id)}
                            className="w-full rounded-lg border border-dashed border-border/60 py-1.5 text-[11px] text-muted-foreground hover:border-primary/40 hover:text-foreground"
                          >
                            + contato
                          </button>
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
  const [name, setName] = useState("");
  const [segment, setSegment] = useState("");

  const create = () => {
    if (!name.trim()) return;
    boards.createBoard.mutate({ name, segment });
    setName("");
    setSegment("");
  };

  return (
    <div className="space-y-3">
      <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
        <CardContent className="flex flex-wrap items-center gap-2 p-3">
          <Layers className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium">Novo quadro</span>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && create()}
            placeholder="Empresa"
            className="h-9 w-48"
          />
          <Input
            value={segment}
            onChange={(e) => setSegment(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && create()}
            placeholder="Segmento (opcional)"
            className="h-9 w-48"
          />
          <Button size="sm" onClick={create} disabled={!name.trim()}>
            <Plus className="mr-1 h-4 w-4" /> Criar kanban
          </Button>
        </CardContent>
      </Card>

      {boards.isLoading ? (
        <p className="p-6 text-center text-sm text-muted-foreground">Carregando…</p>
      ) : boards.boards.length === 0 ? (
        <p className="p-6 text-center text-sm text-muted-foreground">
          Nenhum quadro ainda — crie um por empresa/segmento e arraste os contatos entre as etapas.
        </p>
      ) : (
        boards.boards.map((b) => <BoardBlock key={b.id} board={b} boards={boards} crm={crm} />)
      )}
    </div>
  );
};

export default ContactBoards;
