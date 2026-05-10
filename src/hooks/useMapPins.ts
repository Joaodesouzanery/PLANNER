import { useQuery } from "@tanstack/react-query";
import { useCompany } from "@/contexts/CompanyContext";
import { supabase } from "@/integrations/supabase/client";
import type { MapPin } from "@/components/ems/LocationMap";

interface GeoContact {
  id: string;
  name: string;
  company: string | null;
  company_id: string | null;
  project_id: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
}

interface GeoProject {
  id: string;
  title: string;
  company_id: string | null;
  client: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  status: string;
}

interface OpenTask {
  id: string;
  title: string;
  priority: string | null;
  due_date: string | null;
  status: string;
  company_id: string | null;
  contact_id: string | null;
  project_id: string | null;
}

interface FaculdadeTask {
  id: string;
  title: string;
  due_date: string | null;
  status: string | null;
  disciplina_id: string | null;
}

interface FaculdadeDisciplina {
  id: string;
  name: string;
  address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
}

export interface MapTaskItem {
  id: string;
  title: string;
  due_date: string | null;
  priority: string | null;
  status: string;
  project_id: string | null;
  project_title: string;
  contact_name?: string | null;
}

export interface MapTaskGroup {
  projectId: string;
  projectTitle: string;
  tasks: MapTaskItem[];
}

const normalizeStatus = (status?: string | null) =>
  (status || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();

const isOpenStatus = (status?: string | null) => {
  const normalized = normalizeStatus(status);
  return normalized !== "completed" && normalized !== "done" && normalized !== "concluido" && normalized !== "concluida";
};

export function useMapPins(projectId?: string) {
  const { selectedCompanyId } = useCompany();
  const cf = selectedCompanyId !== "all";

  return useQuery({
    queryKey: ["map-pins", selectedCompanyId, projectId || "all-projects"],
    queryFn: async (): Promise<MapPin[]> => {
      const todayIso = new Date().toISOString().slice(0, 10);

      let qc = supabase
        .from("contacts")
        .select("id,name,company,company_id,project_id,address,latitude,longitude")
        .not("latitude", "is", null)
        .not("longitude", "is", null);
      if (cf) qc = qc.eq("company_id", selectedCompanyId);

      let qp = supabase
        .from("projects")
        .select("id,title,company_id,client,address,latitude,longitude,status")
        .not("latitude", "is", null)
        .not("longitude", "is", null);
      if (cf) qp = qp.eq("company_id", selectedCompanyId);

      let qt = supabase
        .from("tasks")
        .select("id,title,priority,company_id,contact_id,project_id,due_date,status")
        .neq("status", "completed")
        .neq("status", "done");

      const qDisciplines = (supabase as any)
        .from("faculdade_disciplinas")
        .select("id,name,address,latitude,longitude")
        .not("latitude", "is", null)
        .not("longitude", "is", null);
      const qFaculdadeTasks = (supabase as any)
        .from("faculdade_tarefas")
        .select("id,title,disciplina_id,due_date,status")
        .neq("status", "done")
        .neq("status", "completed");

      const [contactsRes, projectsRes, tasksRes, disciplinasRes, faculdadeTasksRes] = await Promise.all([
        qc,
        qp,
        qt,
        qDisciplines,
        qFaculdadeTasks,
      ]);

      const allContacts = (contactsRes.data || []) as GeoContact[];
      const allProjects = (projectsRes.data || []) as GeoProject[];
      const selectedProject = projectId ? allProjects.find((item) => item.id === projectId) : null;
      const projects = projectId ? allProjects.filter((item) => item.id === projectId) : allProjects;
      const projectIds = new Set(projects.map((item) => item.id));
      const contacts = projectId
        ? allContacts.filter((item) => item.project_id === projectId || (!!selectedProject?.company_id && item.company_id === selectedProject.company_id))
        : allContacts;
      const contactIds = new Set(contacts.map((item) => item.id));
      const tasks = ((tasksRes.data || []) as OpenTask[]).filter((task) => {
        if (!isOpenStatus(task.status)) return false;
        if (!projectId && cf) {
          return task.company_id === selectedCompanyId || (!!task.project_id && projectIds.has(task.project_id)) || (!!task.contact_id && contactIds.has(task.contact_id));
        }
        if (!projectId) return true;
        if (task.project_id === projectId) return true;
        return !!task.contact_id && contacts.some((contact) => contact.id === task.contact_id);
      });
      const disciplinas = (disciplinasRes.data || []) as FaculdadeDisciplina[];
      const faculdadeTasks = ((faculdadeTasksRes.data || []) as FaculdadeTask[]).filter((task) => isOpenStatus(task.status));

      const contactsById = new Map(contacts.map((item) => [item.id, item]));
      const projectsById = new Map(projects.map((item) => [item.id, item]));
      const disciplinasById = new Map(disciplinas.map((item) => [item.id, item]));
      const alertContact = new Set(tasks.filter((t) => t.due_date && t.due_date <= todayIso).map((t) => t.contact_id).filter(Boolean) as string[]);
      const alertProject = new Set(tasks.filter((t) => t.due_date && t.due_date <= todayIso).map((t) => t.project_id).filter(Boolean) as string[]);
      const alertDisciplina = new Set(
        faculdadeTasks.filter((t) => t.due_date && t.due_date <= todayIso).map((t) => t.disciplina_id).filter(Boolean) as string[]
      );

      const pins: MapPin[] = [];

      for (const c of contacts) {
        pins.push({
          id: `c-${c.id}`,
          name: c.name,
          subtitle: c.company || c.address || "Cliente",
          lat: Number(c.latitude),
          lng: Number(c.longitude),
          kind: "client",
          alert: alertContact.has(c.id),
        });
      }

      for (const p of projects) {
        pins.push({
          id: `p-${p.id}`,
          name: p.title,
          subtitle: p.client || p.address || "Projeto",
          lat: Number(p.latitude),
          lng: Number(p.longitude),
          kind: "project",
          alert: alertProject.has(p.id),
        });
      }

      tasks.forEach((task) => {
        const project = task.project_id ? projectsById.get(task.project_id) : null;
        const contact = task.contact_id ? contactsById.get(task.contact_id) : null;
        const source = project?.latitude != null && project.longitude != null ? project : contact;
        if (!source?.latitude || !source.longitude) return;
        pins.push({
          id: `t-${task.id}`,
          name: task.title,
          subtitle: project?.title || contact?.name || "Tarefa vinculada",
          lat: Number(source.latitude),
          lng: Number(source.longitude),
          kind: "task",
          alert: !!task.due_date && task.due_date <= todayIso,
        });
      });

      for (const disciplina of disciplinas) {
        if (disciplina.latitude == null || disciplina.longitude == null) continue;
        pins.push({
          id: `f-${disciplina.id}`,
          name: disciplina.name,
          subtitle: disciplina.address || "Faculdade",
          lat: Number(disciplina.latitude),
          lng: Number(disciplina.longitude),
          kind: "faculdade",
          alert: alertDisciplina.has(disciplina.id),
        });
      }

      faculdadeTasks.forEach((task) => {
        const disciplina = task.disciplina_id ? disciplinasById.get(task.disciplina_id) : null;
        if (!disciplina?.latitude || !disciplina.longitude) return;
        pins.push({
          id: `ft-${task.id}`,
          name: task.title,
          subtitle: disciplina.name,
          lat: Number(disciplina.latitude),
          lng: Number(disciplina.longitude),
          kind: "faculdade",
          alert: !!task.due_date && task.due_date <= todayIso,
        });
      });

      return pins;
    },
  });
}

export function useMapTaskGroups(projectId?: string) {
  const { selectedCompanyId } = useCompany();
  const cf = selectedCompanyId !== "all";

  return useQuery({
    queryKey: ["map-task-groups", selectedCompanyId, projectId || "all-projects"],
    queryFn: async (): Promise<MapTaskGroup[]> => {
      let q = supabase
        .from("tasks")
        .select("id,title,priority,due_date,status,company_id,project_id,contact_id,projects(id,title,company_id),contacts(id,name,company_id)")
        .neq("status", "completed")
        .neq("status", "done")
        .order("due_date", { ascending: true, nullsFirst: false });
      if (projectId) q = q.eq("project_id", projectId);
      const { data, error } = await q;
      if (error) throw error;

      const grouped = new Map<string, MapTaskGroup>();
      (data || []).forEach((row: any) => {
        if (!isOpenStatus(row.status)) return;
        if (!projectId && cf && row.company_id !== selectedCompanyId && row.projects?.company_id !== selectedCompanyId && row.contacts?.company_id !== selectedCompanyId) return;
        const projectId = row.project_id || "sem-projeto";
        const projectTitle = row.projects?.title || "Sem projeto";
        if (!grouped.has(projectId)) grouped.set(projectId, { projectId, projectTitle, tasks: [] });
        grouped.get(projectId)!.tasks.push({
          id: row.id,
          title: row.title,
          due_date: row.due_date,
          priority: row.priority,
          status: row.status,
          project_id: row.project_id,
          project_title: projectTitle,
          contact_name: row.contacts?.name || null,
        });
      });

      return Array.from(grouped.values()).sort((a, b) => {
        if (a.projectId === "sem-projeto") return 1;
        if (b.projectId === "sem-projeto") return -1;
        return a.projectTitle.localeCompare(b.projectTitle);
      });
    },
  });
}
