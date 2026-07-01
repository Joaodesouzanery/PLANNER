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

/** Valor sentinela do seletor "lista geral (Pessoal)" no diálogo de colar texto. */
export const GENERAL_TARGET = "__general__";

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

  const reorderTasks = useMutation({
    mutationFn: async (orderedIds: string[]) => {
      await Promise.all(
        orderedIds.map((id, index) =>
          db.from("routine_tasks").update({ sort_order: index }).eq("id", id),
        ),
      );
    },
    onSuccess: invalidate,
    onError,
  });

  /** Reordena segmentos (ordem = importância definida pelo usuário via drag). */
  const reorderSegments = useMutation({
    mutationFn: async (orderedIds: string[]) => {
      await Promise.all(orderedIds.map((id, index) => db.from("routine_segments").update({ sort_order: index }).eq("id", id)));
    },
    onSuccess: invalidate,
    onError,
  });

  /** Reordena clientes/empresas dentro de um segmento (ordem = importância). */
  const reorderClients = useMutation({
    mutationFn: async (orderedIds: string[]) => {
      await Promise.all(orderedIds.map((id, index) => db.from("routine_clients").update({ sort_order: index }).eq("id", id)));
    },
    onSuccess: invalidate,
    onError,
  });

  /** Garante a seção "Geral" (segmento fixo no topo) para rotinas não vinculadas a empresa. */
  const ensureGeneralSection = useMutation({
    mutationFn: async () => {
      const { data: segs, error: sErr } = await db.from("routine_segments").select("id,name");
      if (sErr) throw sErr;
      let segId = (segs ?? []).find((s: any) => String(s.name).toLowerCase() === "geral")?.id;
      if (!segId) {
        const { data: newSeg, error } = await db.from("routine_segments").insert({ name: "Geral", color: "#f59e0b", sort_order: -1 }).select().single();
        if (error) throw error;
        segId = newSeg.id;
      }
      const { data: clients, error: cErr } = await db.from("routine_clients").select("id,segment_id");
      if (cErr) throw cErr;
      if (!(clients ?? []).some((c: any) => c.segment_id === segId)) {
        const { error } = await db.from("routine_clients").insert({ segment_id: segId, name: "Pessoal", sort_order: 0 });
        if (error) throw error;
      }
    },
    onSuccess: () => { invalidate(); toast({ title: "Seção Geral pronta", description: "Adicione rotinas gerais na empresa 'Pessoal'." }); },
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

  /** Quebra um texto colado em varias tarefas e adiciona a um cliente (ou a lista geral "Pessoal"). */
  const pasteTasks = useMutation({
    mutationFn: async ({ target, text }: { target: string; text: string }) => {
      const lines = text
        .split(/\r?\n/)
        .map((line) => line.replace(/^\s*[-*•]\s*/, "").trim())
        .filter(Boolean);
      if (!lines.length) throw new Error("Nenhuma tarefa encontrada no texto.");

      let clientId = target;
      if (target === GENERAL_TARGET) {
        const { data: clients, error: cErr } = await db.from("routine_clients").select("id,name");
        if (cErr) throw cErr;
        const general = (clients ?? []).find((c: any) => String(c.name).toLowerCase() === "pessoal");
        if (general) {
          clientId = general.id;
        } else {
          const { data: segs, error: sErr } = await db.from("routine_segments").select("id,name");
          if (sErr) throw sErr;
          let segId = (segs ?? []).find((s: any) => String(s.name).toLowerCase() === "geral")?.id;
          if (!segId) {
            const { data: newSeg, error: nsErr } = await db.from("routine_segments").insert({ name: "Geral", sort_order: (segs?.length ?? 0) }).select().single();
            if (nsErr) throw nsErr;
            segId = newSeg.id;
          }
          const { data: newClient, error: ncErr } = await db.from("routine_clients").insert({ segment_id: segId, name: "Pessoal", sort_order: 0 }).select().single();
          if (ncErr) throw ncErr;
          clientId = newClient.id;
        }
      }

      const { data: existing, error: exErr } = await db.from("routine_tasks").select("id").eq("client_id", clientId);
      if (exErr) throw exErr;
      const base = existing?.length ?? 0;
      const rows = lines.map((title, index) => ({ client_id: clientId, title, status: "pending", priority: "medium", sort_order: base + index }));
      const { error } = await db.from("routine_tasks").insert(rows);
      if (error) throw error;
      return lines.length;
    },
    onSuccess: (count) => {
      invalidate();
      toast({ title: `${count} tarefa(s) adicionada(s)`, description: "Disponíveis na aba Tarefas do cliente." });
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
    reorderTasks,
    reorderSegments,
    reorderClients,
    ensureGeneralSection,
    seedInitialStructure,
    pasteTasks,
  };
};
