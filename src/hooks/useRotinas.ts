import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

export type ChecklistKind = "conferencia" | "tarefa";
export type RoutineTaskStatus = "pending" | "in_progress" | "done";

export interface RoutineSegment {
  id: string;
  name: string;
  color: string | null;
  sort_order: number;
}

export interface RoutineClient {
  id: string;
  segment_id: string | null;
  name: string;
  color: string | null;
  invoice_day: number | null;
  invoice_notes: string | null;
  status: string;
  sort_order: number;
  notes: string | null;
}

export interface RoutineChecklistItem {
  id: string;
  client_id: string;
  kind: ChecklistKind;
  title: string;
  sort_order: number;
  active: boolean;
}

export interface RoutineChecklistLog {
  id: string;
  client_id: string;
  item_id: string;
  log_date: string;
  done: boolean;
}

export interface RoutineTask {
  id: string;
  client_id: string;
  title: string;
  description: string | null;
  status: RoutineTaskStatus;
  priority: string;
  due_date: string | null;
  completed_at: string | null;
  sort_order: number;
}

export interface RoutineClientView {
  client: RoutineClient;
  items: RoutineChecklistItem[];
  conferencias: RoutineChecklistItem[];
  tarefas: RoutineChecklistItem[];
  doneItemIds: Set<string>;
  conferenciaProgress: { done: number; total: number };
  tarefaProgress: { done: number; total: number };
  tasks: RoutineTask[];
  openTasks: RoutineTask[];
  doneTodayTasks: RoutineTask[];
  daysUntilInvoice: number | null;
}

const db = supabase as any;
const todayStr = () => format(new Date(), "yyyy-MM-dd");

/** Dias ate a proxima ocorrencia do dia da NF (ex.: dia 1 de cada mes). */
export const daysUntilInvoice = (invoiceDay: number | null): number | null => {
  if (!invoiceDay) return null;
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const clamp = (year: number, month: number) => {
    const lastDay = new Date(year, month + 1, 0).getDate();
    return new Date(year, month, Math.min(invoiceDay, lastDay));
  };
  let next = clamp(today.getFullYear(), today.getMonth());
  if (next < today) next = clamp(today.getFullYear(), today.getMonth() + 1);
  return Math.round((next.getTime() - today.getTime()) / 86_400_000);
};

export const useRotinas = () => {
  const queryClient = useQueryClient();
  const day = todayStr();

  const query = useQuery({
    queryKey: ["rotinas", day],
    queryFn: async () => {
      const [segments, clients, items, logs, tasks] = await Promise.all([
        db.from("routine_segments").select("*").order("sort_order", { ascending: true }),
        db.from("routine_clients").select("*").order("sort_order", { ascending: true }),
        db.from("routine_checklist_items").select("*").eq("active", true).order("sort_order", { ascending: true }),
        db.from("routine_checklist_logs").select("*").eq("log_date", day),
        db.from("routine_tasks").select("*").order("sort_order", { ascending: true }),
      ]);
      for (const res of [segments, clients, items, logs, tasks]) {
        if (res.error) throw res.error;
      }
      return {
        segments: (segments.data ?? []) as RoutineSegment[],
        clients: (clients.data ?? []) as RoutineClient[],
        items: (items.data ?? []) as RoutineChecklistItem[],
        logs: (logs.data ?? []) as RoutineChecklistLog[],
        tasks: (tasks.data ?? []) as RoutineTask[],
      };
    },
  });

  const data = query.data;

  /** Visao por cliente com checklists, tasks e contagem de NF. */
  const clientViews = useMemo(() => {
    const map = new Map<string, RoutineClientView>();
    if (!data) return map;
    const doneByClient = new Set(data.logs.map((log) => log.item_id));
    for (const client of data.clients) {
      const items = data.items.filter((item) => item.client_id === client.id);
      const conferencias = items.filter((item) => item.kind === "conferencia");
      const tarefas = items.filter((item) => item.kind === "tarefa");
      const doneItemIds = new Set(items.filter((item) => doneByClient.has(item.id)).map((item) => item.id));
      const tasks = data.tasks.filter((task) => task.client_id === client.id);
      map.set(client.id, {
        client,
        items,
        conferencias,
        tarefas,
        doneItemIds,
        conferenciaProgress: { done: conferencias.filter((i) => doneItemIds.has(i.id)).length, total: conferencias.length },
        tarefaProgress: { done: tarefas.filter((i) => doneItemIds.has(i.id)).length, total: tarefas.length },
        tasks,
        openTasks: tasks
          .filter((task) => task.status !== "done")
          .sort((a, b) => (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999")),
        doneTodayTasks: tasks.filter((task) => task.status === "done" && (task.completed_at ?? "").slice(0, 10) === day),
        daysUntilInvoice: daysUntilInvoice(client.invoice_day),
      });
    }
    return map;
  }, [data, day]);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["rotinas"] });
  const onError = (error: any) => toast({ variant: "destructive", title: "Erro", description: error?.message ?? "Falha ao salvar." });

  const toggleChecklist = useMutation({
    mutationFn: async ({ item, done }: { item: RoutineChecklistItem; done: boolean }) => {
      if (done) {
        const { error } = await db.from("routine_checklist_logs").insert({ client_id: item.client_id, item_id: item.id, log_date: day });
        if (error && error.code !== "23505") throw error; // ignora duplicidade
      } else {
        const { error } = await db.from("routine_checklist_logs").delete().eq("item_id", item.id).eq("log_date", day);
        if (error) throw error;
      }
    },
    onSuccess: invalidate,
    onError,
  });

  const saveSegment = useMutation({
    mutationFn: async (form: Partial<RoutineSegment>) => {
      const { error } = form.id
        ? await db.from("routine_segments").update(form).eq("id", form.id)
        : await db.from("routine_segments").insert(form);
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError,
  });

  const deleteSegment = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db.from("routine_segments").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError,
  });

  const saveClient = useMutation({
    mutationFn: async (form: Partial<RoutineClient>) => {
      const { error } = form.id
        ? await db.from("routine_clients").update(form).eq("id", form.id)
        : await db.from("routine_clients").insert(form);
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError,
  });

  const deleteClient = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db.from("routine_clients").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError,
  });

  const saveChecklistItem = useMutation({
    mutationFn: async (form: Partial<RoutineChecklistItem>) => {
      const { error } = form.id
        ? await db.from("routine_checklist_items").update(form).eq("id", form.id)
        : await db.from("routine_checklist_items").insert(form);
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError,
  });

  const deleteChecklistItem = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db.from("routine_checklist_items").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError,
  });

  const saveTask = useMutation({
    mutationFn: async (form: Partial<RoutineTask>) => {
      const payload = { ...form };
      if (payload.status === "done" && !payload.completed_at) payload.completed_at = new Date().toISOString();
      if (payload.status && payload.status !== "done") payload.completed_at = null;
      const { error } = payload.id
        ? await db.from("routine_tasks").update(payload).eq("id", payload.id)
        : await db.from("routine_tasks").insert(payload);
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError,
  });

  const deleteTask = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db.from("routine_tasks").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError,
  });

  const seedInitialStructure = useMutation({
    mutationFn: async () => {
      const blueprint: Array<{ segment: string; clients: Array<{ name: string; invoice_day?: number }> }> = [
        { segment: "Construção", clients: [{ name: "Compizzo", invoice_day: 1 }, { name: "WCR" }, { name: "CSLNR" }] },
        { segment: "Regulação", clients: [{ name: "IRIS", invoice_day: 1 }, { name: "Circle", invoice_day: 1 }, { name: "Raoni", invoice_day: 1 }, { name: "Lince" }] },
        { segment: "CONAB", clients: [{ name: "CONAB" }] },
        { segment: "Nery Agro", clients: [{ name: "Nery Agro" }] },
      ];
      let segOrder = 0;
      for (const block of blueprint) {
        const { data: seg, error: segError } = await db
          .from("routine_segments")
          .insert({ name: block.segment, sort_order: segOrder++ })
          .select()
          .single();
        if (segError) throw segError;
        let clientOrder = 0;
        for (const client of block.clients) {
          const { data: created, error: clientError } = await db
            .from("routine_clients")
            .insert({ segment_id: seg.id, name: client.name, invoice_day: client.invoice_day ?? null, sort_order: clientOrder++ })
            .select()
            .single();
          if (clientError) throw clientError;
          const { error: itemsError } = await db.from("routine_checklist_items").insert([
            { client_id: created.id, kind: "conferencia", title: "Conferir lançamentos do dia", sort_order: 0 },
            { client_id: created.id, kind: "tarefa", title: "Atualizar pendências", sort_order: 0 },
          ]);
          if (itemsError) throw itemsError;
        }
      }
    },
    onSuccess: () => {
      invalidate();
      toast({ title: "Estrutura criada", description: "Segmentos e clientes iniciais adicionados." });
    },
    onError,
  });

  return {
    isLoading: query.isLoading,
    error: query.error,
    segments: data?.segments ?? [],
    clients: data?.clients ?? [],
    clientViews,
    today: day,
    toggleChecklist,
    saveSegment,
    deleteSegment,
    saveClient,
    deleteClient,
    saveChecklistItem,
    deleteChecklistItem,
    saveTask,
    deleteTask,
    seedInitialStructure,
  };
};
