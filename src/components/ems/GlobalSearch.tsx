import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from "@/components/ui/command";
import { BrainCircuit, FolderKanban, ListTodo, Users, StickyNote, CalendarDays, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

interface SearchResult {
  id: string;
  title: string;
  type: "project" | "task" | "contact" | "note" | "event" | "persuasion";
  path: string;
}

const typeConfig = {
  project: { icon: FolderKanban, label: "Projetos", path: "/ems/projects" },
  task: { icon: ListTodo, label: "Tarefas", path: "/ems/tasks" },
  contact: { icon: Users, label: "Contatos", path: "/ems/contacts" },
  note: { icon: StickyNote, label: "Notas", path: "/ems/quick-notes" },
  event: { icon: CalendarDays, label: "Eventos", path: "/ems/calendar" },
  persuasion: { icon: BrainCircuit, label: "Persuasão", path: "/ems/persuasao" },
};

export const GlobalSearch = () => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const navigate = useNavigate();

  // Keyboard shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // Debounced search
  useEffect(() => {
    if (!query || query.length < 2) {
      setResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      const term = `%${query}%`;
      const safe = async (query: any) => {
        try {
          const result = await query;
          if (result.error?.code === "42P01" || result.error?.code === "PGRST205") return { data: [] };
          return result;
        } catch {
          return { data: [] };
        }
      };
      const [projects, tasks, contacts, notes, events, persuasion] = await Promise.all([
        supabase.from("projects").select("id, title").ilike("title", term).limit(5),
        supabase.from("tasks").select("id, title").ilike("title", term).limit(5),
        supabase.from("contacts").select("id, name, email").or(`name.ilike.${term},email.ilike.${term}`).limit(5),
        supabase.from("quick_notes").select("id, content").ilike("content", term).limit(5),
        supabase.from("calendar_events").select("id, title").ilike("title", term).limit(5),
        safe((supabase as any).from("persuasion_notes").select("id, title").ilike("title", term).limit(5)),
      ]);

      const all: SearchResult[] = [
        ...(projects.data || []).map((p) => ({ id: p.id, title: p.title, type: "project" as const, path: "/ems/projects" })),
        ...(tasks.data || []).map((t) => ({ id: t.id, title: t.title, type: "task" as const, path: "/ems/tasks" })),
        ...(contacts.data || []).map((c) => ({ id: c.id, title: `${c.name}${c.email ? ` (${c.email})` : ""}`, type: "contact" as const, path: "/ems/contacts" })),
        ...(notes.data || []).map((n) => ({ id: n.id, title: n.content.substring(0, 60), type: "note" as const, path: "/ems/quick-notes" })),
        ...(events.data || []).map((e) => ({ id: e.id, title: e.title, type: "event" as const, path: "/ems/calendar" })),
        ...(persuasion.data || []).map((p: any) => ({ id: p.id, title: p.title, type: "persuasion" as const, path: "/ems/persuasao" })),
      ];
      setResults(all);
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  const handleSelect = (result: SearchResult) => {
    setOpen(false);
    setQuery("");
    navigate(result.path);
  };

  const grouped = results.reduce<Record<string, SearchResult[]>>((acc, r) => {
    acc[r.type] = acc[r.type] || [];
    acc[r.type].push(r);
    return acc;
  }, {});

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        className="h-8 gap-2 text-xs text-muted-foreground px-3"
      >
        <Search className="h-3 w-3" />
        <span className="hidden sm:inline">Buscar...</span>
        <kbd className="hidden md:inline-flex h-5 items-center gap-0.5 rounded border border-border bg-muted px-1.5 text-[10px] font-medium text-muted-foreground">
          ⌘K
        </kbd>
      </Button>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder="Buscar em todos os módulos..." value={query} onValueChange={setQuery} />
        <CommandList>
          <CommandEmpty>{query.length < 2 ? "Digite pelo menos 2 caracteres" : "Nenhum resultado encontrado"}</CommandEmpty>
          {Object.entries(grouped).map(([type, items]) => {
            const config = typeConfig[type as keyof typeof typeConfig];
            const Icon = config.icon;
            return (
              <CommandGroup key={type} heading={config.label}>
                {items.map((item) => (
                  <CommandItem key={item.id} onSelect={() => handleSelect(item)} className="gap-2">
                    <Icon className="h-4 w-4 text-muted-foreground" />
                    <span className="truncate">{item.title}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            );
          })}
        </CommandList>
      </CommandDialog>
    </>
  );
};
