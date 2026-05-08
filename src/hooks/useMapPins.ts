import { useQuery } from "@tanstack/react-query";
import { useCompany } from "@/contexts/CompanyContext";
import { supabase } from "@/integrations/supabase/client";
import type { MapPin } from "@/components/ems/LocationMap";

interface GeoContact {
  id: string;
  name: string;
  company: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
}
interface GeoProject {
  id: string;
  title: string;
  client: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  status: string;
}
interface OpenTask {
  id: string;
  contact_id: string | null;
  project_id: string | null;
  due_date: string | null;
  status: string;
}

/** Returns pins for clients (contacts) + projects with alert when due-today/overdue tasks exist. */
export function useMapPins() {
  const { selectedCompanyId } = useCompany();
  const cf = selectedCompanyId !== "all";

  return useQuery({
    queryKey: ["map-pins", selectedCompanyId],
    queryFn: async (): Promise<MapPin[]> => {
      const today = new Date();
      today.setHours(23, 59, 59, 999);
      const todayIso = today.toISOString().slice(0, 10);

      let qc = supabase
        .from("contacts")
        .select("id,name,company,address,latitude,longitude")
        .not("latitude", "is", null);
      if (cf) qc = qc.eq("company_id", selectedCompanyId);

      let qp = supabase
        .from("projects")
        .select("id,title,client,address,latitude,longitude,status")
        .not("latitude", "is", null);
      if (cf) qp = qp.eq("company_id", selectedCompanyId);

      let qt = supabase
        .from("tasks")
        .select("id,contact_id,project_id,due_date,status")
        .neq("status", "completed")
        .lte("due_date", todayIso);
      if (cf) qt = qt.eq("company_id", selectedCompanyId);

      const [contactsRes, projectsRes, tasksRes] = await Promise.all([qc, qp, qt]);

      const contacts = (contactsRes.data || []) as GeoContact[];
      const projects = (projectsRes.data || []) as GeoProject[];
      const tasks = (tasksRes.data || []) as OpenTask[];

      const alertContact = new Set(tasks.map((t) => t.contact_id).filter(Boolean) as string[]);
      const alertProject = new Set(tasks.map((t) => t.project_id).filter(Boolean) as string[]);

      const pins: MapPin[] = [];
      for (const c of contacts) {
        if (c.latitude == null || c.longitude == null) continue;
        pins.push({
          id: `c-${c.id}`,
          name: c.name,
          subtitle: c.company || c.address || "Cliente",
          lat: Number(c.latitude),
          lng: Number(c.longitude),
          alert: alertContact.has(c.id),
        });
      }
      for (const p of projects) {
        if (p.latitude == null || p.longitude == null) continue;
        pins.push({
          id: `p-${p.id}`,
          name: p.title,
          subtitle: p.client || p.address || "Projeto",
          lat: Number(p.latitude),
          lng: Number(p.longitude),
          alert: alertProject.has(p.id),
        });
      }
      return pins;
    },
  });
}
