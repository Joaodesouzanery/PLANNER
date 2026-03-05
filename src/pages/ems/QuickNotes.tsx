import { useState } from "react";
import { EMSLayout } from "@/components/ems/EMSLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { motion, AnimatePresence } from "framer-motion";
import { StickyNote, Plus, Pin, Trash2, ListTodo, Palette } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface QuickNote {
  id: string;
  content: string;
  color: string;
  pinned: boolean;
  created_at: string;
  updated_at: string;
}

const colorOptions: { value: string; label: string; bg: string; border: string; text: string }[] = [
  { value: "default", label: "Padr\u00e3o", bg: "bg-card", border: "border-border", text: "text-foreground" },
  { value: "yellow", label: "Amarelo", bg: "bg-yellow-500/10", border: "border-yellow-500/30", text: "text-yellow-200" },
  { value: "green", label: "Verde", bg: "bg-green-500/10", border: "border-green-500/30", text: "text-green-200" },
  { value: "blue", label: "Azul", bg: "bg-blue-500/10", border: "border-blue-500/30", text: "text-blue-200" },
  { value: "pink", label: "Rosa", bg: "bg-pink-500/10", border: "border-pink-500/30", text: "text-pink-200" },
  { value: "purple", label: "Roxo", bg: "bg-purple-500/10", border: "border-purple-500/30", text: "text-purple-200" },
];

const colorDots: Record<string, string> = {
  default: "bg-muted-foreground",
  yellow: "bg-yellow-400",
  green: "bg-green-400",
  blue: "bg-blue-400",
  pink: "bg-pink-400",
  purple: "bg-purple-400",
};

const getColorClasses = (color: string) =>
  colorOptions.find((c) => c.value === color) || colorOptions[0];

const QuickNotes = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [newNoteContent, setNewNoteContent] = useState("");
  const [editingNote, setEditingNote] = useState<QuickNote | null>(null);
  const [editContent, setEditContent] = useState("");
  const [colorPickerNoteId, setColorPickerNoteId] = useState<string | null>(null);
  const [convertDialogNote, setConvertDialogNote] = useState<QuickNote | null>(null);

  // Fetch notes
  const { data: notes = [], isLoading } = useQuery({
    queryKey: ["quick_notes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("quick_notes")
        .select("*")
        .order("pinned", { ascending: false })
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return data as QuickNote[];
    },
  });

  // Create note
  const createMutation = useMutation({
    mutationFn: async (content: string) => {
      const { error } = await supabase.from("quick_notes").insert({
        content,
        color: "default",
        pinned: false,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["quick_notes"] });
      setNewNoteContent("");
      toast({ title: "Nota criada!" });
    },
    onError: () => {
      toast({ title: "Erro ao criar nota", variant: "destructive" });
    },
  });

  // Update note
  const updateMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<QuickNote> }) => {
      const { error } = await supabase.from("quick_notes").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["quick_notes"] });
    },
    onError: () => {
      toast({ title: "Erro ao atualizar nota", variant: "destructive" });
    },
  });

  // Delete note
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("quick_notes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["quick_notes"] });
      toast({ title: "Nota removida!" });
    },
    onError: () => {
      toast({ title: "Erro ao remover nota", variant: "destructive" });
    },
  });

  // Convert to task
  const convertToTaskMutation = useMutation({
    mutationFn: async (note: QuickNote) => {
      const { error } = await supabase.from("tasks").insert({
        title: note.content.slice(0, 200),
        description: note.content.length > 200 ? note.content : null,
        priority: "medium",
        status: "pending",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      setConvertDialogNote(null);
      toast({ title: "Tarefa criada a partir da nota!" });
    },
    onError: () => {
      toast({ title: "Erro ao converter em tarefa", variant: "destructive" });
    },
  });

  const handleCreateNote = () => {
    if (!newNoteContent.trim()) return;
    createMutation.mutate(newNoteContent.trim());
  };

  const handleSaveEdit = () => {
    if (!editingNote || !editContent.trim()) return;
    updateMutation.mutate(
      { id: editingNote.id, updates: { content: editContent.trim() } },
      {
        onSuccess: () => {
          setEditingNote(null);
          setEditContent("");
          toast({ title: "Nota atualizada!" });
        },
      }
    );
  };

  const handleTogglePin = (note: QuickNote) => {
    updateMutation.mutate(
      { id: note.id, updates: { pinned: !note.pinned } },
      {
        onSuccess: () => {
          toast({ title: note.pinned ? "Nota desafixada" : "Nota fixada!" });
        },
      }
    );
  };

  const handleChangeColor = (noteId: string, color: string) => {
    updateMutation.mutate({ id: noteId, updates: { color } });
    setColorPickerNoteId(null);
  };

  const startEdit = (note: QuickNote) => {
    setEditingNote(note);
    setEditContent(note.content);
  };

  const pinnedNotes = notes.filter((n) => n.pinned);
  const unpinnedNotes = notes.filter((n) => !n.pinned);

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.05 } },
  };
  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 },
  };

  const renderNoteCard = (note: QuickNote) => {
    const colors = getColorClasses(note.color);
    return (
      <motion.div
        key={note.id}
        layout
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        transition={{ duration: 0.2 }}
      >
        <Card
          className={cn(
            "group relative cursor-pointer transition-all hover:shadow-lg hover:-translate-y-0.5",
            colors.bg,
            colors.border
          )}
          onClick={() => startEdit(note)}
        >
          <CardContent className="p-4">
            {/* Pin indicator */}
            {note.pinned && (
              <div className="absolute top-2 right-2">
                <Pin className="h-3.5 w-3.5 text-primary fill-primary" />
              </div>
            )}

            {/* Content */}
            <p className="text-sm whitespace-pre-wrap break-words min-h-[40px] pr-5">
              {note.content}
            </p>

            {/* Footer */}
            <div className="mt-3 flex items-center justify-between">
              <span className="text-xs text-muted-foreground">
                {format(new Date(note.updated_at), "dd/MM/yy HH:mm", { locale: ptBR })}
              </span>

              {/* Actions - visible on hover */}
              <div
                className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={(e) => e.stopPropagation()}
              >
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => handleTogglePin(note)}
                  title={note.pinned ? "Desafixar" : "Fixar"}
                >
                  <Pin className={cn("h-3.5 w-3.5", note.pinned && "fill-primary text-primary")} />
                </Button>

                <div className="relative">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() =>
                      setColorPickerNoteId(colorPickerNoteId === note.id ? null : note.id)
                    }
                    title="Cor"
                  >
                    <Palette className="h-3.5 w-3.5" />
                  </Button>
                  {colorPickerNoteId === note.id && (
                    <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 z-50 bg-popover border rounded-lg p-2 shadow-lg flex gap-1.5">
                      {colorOptions.map((c) => (
                        <button
                          key={c.value}
                          className={cn(
                            "h-6 w-6 rounded-full border-2 transition-transform hover:scale-110",
                            colorDots[c.value],
                            note.color === c.value ? "border-primary ring-2 ring-primary/30" : "border-transparent"
                          )}
                          onClick={() => handleChangeColor(note.id, c.value)}
                          title={c.label}
                        />
                      ))}
                    </div>
                  )}
                </div>

                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => setConvertDialogNote(note)}
                  title="Converter em tarefa"
                >
                  <ListTodo className="h-3.5 w-3.5" />
                </Button>

                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-muted-foreground hover:text-destructive"
                  onClick={() => deleteMutation.mutate(note.id)}
                  title="Excluir"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    );
  };

  return (
    <EMSLayout>
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="space-y-6"
      >
        {/* Header */}
        <motion.div variants={itemVariants}>
          <h1 className="text-2xl md:text-3xl font-heading font-bold text-foreground">
            Notas R\u00e1pidas
          </h1>
          <p className="text-sm md:text-base text-muted-foreground mt-1">
            Anote ideias e converta em tarefas
          </p>
        </motion.div>

        {/* Quick input */}
        <motion.div variants={itemVariants}>
          <Card>
            <CardContent className="p-4">
              <div className="flex flex-col sm:flex-row gap-3">
                <Textarea
                  value={newNoteContent}
                  onChange={(e) => setNewNoteContent(e.target.value)}
                  placeholder="Escreva uma nota r\u00e1pida..."
                  rows={2}
                  className="flex-1 resize-none"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                      handleCreateNote();
                    }
                  }}
                />
                <Button
                  onClick={handleCreateNote}
                  disabled={!newNoteContent.trim() || createMutation.isPending}
                  className="gap-2 sm:self-end"
                >
                  <Plus className="h-4 w-4" /> Adicionar
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Pressione Ctrl+Enter para salvar rapidamente
              </p>
            </CardContent>
          </Card>
        </motion.div>

        {/* Stats */}
        <motion.div variants={itemVariants} className="flex flex-wrap gap-3">
          <Badge variant="outline" className="gap-1.5 py-1 px-3">
            <StickyNote className="h-3.5 w-3.5" />
            {notes.length} {notes.length === 1 ? "nota" : "notas"}
          </Badge>
          {pinnedNotes.length > 0 && (
            <Badge variant="outline" className="gap-1.5 py-1 px-3">
              <Pin className="h-3.5 w-3.5 fill-primary text-primary" />
              {pinnedNotes.length} {pinnedNotes.length === 1 ? "fixada" : "fixadas"}
            </Badge>
          )}
        </motion.div>

        {/* Loading state */}
        {isLoading && (
          <div className="text-center py-12">
            <p className="text-muted-foreground">Carregando notas...</p>
          </div>
        )}

        {/* Empty state */}
        {!isLoading && notes.length === 0 && (
          <motion.div variants={itemVariants}>
            <Card className="border-dashed">
              <CardContent className="py-12 text-center">
                <StickyNote className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
                <h3 className="font-medium text-foreground mb-2">Nenhuma nota ainda</h3>
                <p className="text-sm text-muted-foreground">
                  Comece escrevendo sua primeira nota acima.
                </p>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Pinned notes */}
        {pinnedNotes.length > 0 && (
          <motion.div variants={itemVariants} className="space-y-3">
            <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-2">
              <Pin className="h-3.5 w-3.5" /> Fixadas
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <AnimatePresence mode="popLayout">
                {pinnedNotes.map(renderNoteCard)}
              </AnimatePresence>
            </div>
          </motion.div>
        )}

        {/* Other notes */}
        {unpinnedNotes.length > 0 && (
          <motion.div variants={itemVariants} className="space-y-3">
            {pinnedNotes.length > 0 && (
              <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                Outras notas
              </h2>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <AnimatePresence mode="popLayout">
                {unpinnedNotes.map(renderNoteCard)}
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </motion.div>

      {/* Edit Dialog */}
      <Dialog
        open={!!editingNote}
        onOpenChange={(open) => {
          if (!open) {
            setEditingNote(null);
            setEditContent("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Nota</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              placeholder="Conte\u00fado da nota..."
              rows={6}
              className="resize-none"
            />
            {editingNote && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Cor:</span>
                <div className="flex gap-1.5">
                  {colorOptions.map((c) => (
                    <button
                      key={c.value}
                      className={cn(
                        "h-6 w-6 rounded-full border-2 transition-transform hover:scale-110",
                        colorDots[c.value],
                        editingNote.color === c.value
                          ? "border-primary ring-2 ring-primary/30"
                          : "border-transparent"
                      )}
                      onClick={() => {
                        updateMutation.mutate({ id: editingNote.id, updates: { color: c.value } });
                        setEditingNote({ ...editingNote, color: c.value });
                      }}
                      title={c.label}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setEditingNote(null);
                setEditContent("");
              }}
            >
              Cancelar
            </Button>
            <Button onClick={handleSaveEdit} disabled={!editContent.trim()}>
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Convert to Task Dialog */}
      <Dialog
        open={!!convertDialogNote}
        onOpenChange={(open) => {
          if (!open) setConvertDialogNote(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Converter em Tarefa</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Deseja criar uma tarefa a partir desta nota?
            </p>
            {convertDialogNote && (
              <Card>
                <CardContent className="p-3">
                  <p className="text-sm whitespace-pre-wrap break-words line-clamp-4">
                    {convertDialogNote.content}
                  </p>
                </CardContent>
              </Card>
            )}
            <p className="text-xs text-muted-foreground">
              A tarefa ser\u00e1 criada com prioridade m\u00e9dia e status pendente.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConvertDialogNote(null)}>
              Cancelar
            </Button>
            <Button
              onClick={() => convertDialogNote && convertToTaskMutation.mutate(convertDialogNote)}
              disabled={convertToTaskMutation.isPending}
              className="gap-2"
            >
              <ListTodo className="h-4 w-4" /> Criar Tarefa
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </EMSLayout>
  );
};

export default QuickNotes;
