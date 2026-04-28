import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CalendarClock, Download, FileText, Filter, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { cn } from "@/lib/utils";

const DOCUMENT_TYPES = [
  { value: "all", label: "Todos os tipos" },
  { value: "contract", label: "Contratos" },
  { value: "invoice", label: "Notas fiscais" },
  { value: "legal", label: "Jurídico" },
  { value: "accounting", label: "Contábil" },
  { value: "admin", label: "Administrativo" },
  { value: "backup", label: "Backup" },
  { value: "marketing", label: "Marketing" },
  { value: "crisis", label: "Crise" },
  { value: "governance", label: "Governança" },
  { value: "other", label: "Outro" },
];

const MODULES = [
  { value: "all", label: "Todos os módulos" },
  { value: "project_contract", label: "Projetos - contratos" },
  { value: "project_invoice", label: "Projetos - NFs" },
  { value: "project", label: "Projetos - anexos" },
  { value: "client", label: "Clientes" },
  { value: "governance", label: "Conselho" },
  { value: "task", label: "Tarefas" },
  { value: "contact", label: "Contatos" },
];

const dateLabel = (date?: string | null) => {
  if (!date) return "Sem vencimento";
  const [year, month, day] = date.slice(0, 10).split("-");
  return year && month && day ? `${day}/${month}/${year}` : date;
};

const daysUntil = (date?: string | null) => {
  if (!date) return null;
  const now = new Date();
  const target = new Date(`${date}T12:00:00`);
  return Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
};

export const DocumentLibrary = () => {
  const { selectedCompanyId } = useCompany();
  const [search, setSearch] = useState("");
  const [type, setType] = useState("all");
  const [module, setModule] = useState("all");
  const [clientId, setClientId] = useState("all");
  const [projectId, setProjectId] = useState("all");
  const [expiresIn, setExpiresIn] = useState("all");
  const hasCompanyFilter = selectedCompanyId !== "all";

  const { data: documents = [] } = useQuery({
    queryKey: ["document-library", selectedCompanyId],
    staleTime: 1000 * 60 * 2,
    queryFn: async () => {
      let q = (supabase as any)
        .from("attachments")
        .select("*")
        .order("created_at", { ascending: false });
      if (hasCompanyFilter) q = q.or(`company_id.eq.${selectedCompanyId},client_company_id.eq.${selectedCompanyId}`);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []).filter((item: any) =>
        item.content_type?.includes("pdf") || item.file_name?.toLowerCase().endsWith(".pdf")
      );
    },
  });

  const { data: companies = [] } = useQuery({
    queryKey: ["document-library-companies"],
    staleTime: 1000 * 60 * 10,
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("companies").select("id,name").order("name");
      if (error) throw error;
      return data || [];
    },
  });

  const { data: projects = [] } = useQuery({
    queryKey: ["document-library-projects", selectedCompanyId],
    staleTime: 1000 * 60 * 5,
    queryFn: async () => {
      let q = (supabase as any).from("projects").select("id,title,company_id").order("title");
      if (hasCompanyFilter) q = q.eq("company_id", selectedCompanyId);
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
  });

  const companyName = (id?: string | null) => companies.find((c: any) => c.id === id)?.name || "Sem cliente";
  const projectName = (id?: string | null) => projects.find((p: any) => p.id === id)?.title || "Sem projeto";

  const filtered = useMemo(() => {
    return documents.filter((doc: any) => {
      const matchesSearch = !search || `${doc.file_name} ${doc.notes || ""}`.toLowerCase().includes(search.toLowerCase());
      const matchesType = type === "all" || (doc.document_type || "other") === type;
      const matchesModule = module === "all" || doc.entity_type === module;
      const matchesClient = clientId === "all" || doc.client_company_id === clientId || doc.company_id === clientId;
      const matchesProject = projectId === "all" || doc.project_id === projectId;
      const due = daysUntil(doc.expires_at);
      const matchesExpiry = expiresIn === "all" || (due !== null && due >= 0 && due <= Number(expiresIn));
      return matchesSearch && matchesType && matchesModule && matchesClient && matchesProject && matchesExpiry;
    });
  }, [documents, search, type, module, clientId, projectId, expiresIn]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2"><FileText className="h-5 w-5 text-primary" /> Documentos</h2>
          <p className="text-sm text-muted-foreground">Contratos, notas fiscais e PDFs de clientes, projetos e Conselho em uma visão única.</p>
        </div>
        <Badge variant="secondary">{filtered.length} PDFs</Badge>
      </div>

      <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-6">
        <div className="relative xl:col-span-2">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input className="pl-8" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar documento..." />
        </div>
        <Select value={type} onValueChange={setType}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>{DOCUMENT_TYPES.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={module} onValueChange={setModule}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>{MODULES.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={clientId} onValueChange={setClientId}>
          <SelectTrigger><SelectValue placeholder="Cliente" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os clientes</SelectItem>
            {companies.map((company: any) => <SelectItem key={company.id} value={company.id}>{company.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={projectId} onValueChange={setProjectId}>
          <SelectTrigger><SelectValue placeholder="Projeto" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os projetos</SelectItem>
            {projects.map((project: any) => <SelectItem key={project.id} value={project.id}>{project.title}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <Filter className="h-4 w-4 text-muted-foreground" />
        {["7", "15", "30"].map((days) => (
          <Button key={days} variant={expiresIn === days ? "default" : "outline"} size="sm" className="h-8" onClick={() => setExpiresIn(expiresIn === days ? "all" : days)}>
            Vence em {days}d
          </Button>
        ))}
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {filtered.length === 0 ? (
          <Card className="md:col-span-2 xl:col-span-3 border-dashed">
            <CardContent className="py-12 text-center text-sm text-muted-foreground">Nenhum PDF encontrado para os filtros atuais.</CardContent>
          </Card>
        ) : filtered.map((doc: any) => {
          const due = daysUntil(doc.expires_at);
          const isRisk = due !== null && due >= 0 && due <= (doc.alert_days || 30);
          return (
            <Card key={doc.id} className={cn(isRisk && "border-amber-500/40 bg-amber-500/5")}>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-primary/10 text-primary"><FileText className="h-5 w-5" /></div>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-sm truncate">{doc.file_name}</p>
                    <p className="text-xs text-muted-foreground">{companyName(doc.client_company_id || doc.company_id)} · {projectName(doc.project_id)}</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <Badge variant="outline" className="text-[10px]">{doc.document_type || "other"}</Badge>
                  <Badge variant="secondary" className="text-[10px]">{doc.entity_type}</Badge>
                  {doc.expires_at && (
                    <Badge variant="outline" className={cn("text-[10px] gap-1", isRisk && "text-amber-600 border-amber-500/40")}>
                      <CalendarClock className="h-3 w-3" /> {dateLabel(doc.expires_at)}
                    </Badge>
                  )}
                </div>
                {doc.notes && <p className="text-xs text-muted-foreground line-clamp-2">{doc.notes}</p>}
                <a href={doc.file_url} target="_blank" rel="noopener noreferrer">
                  <Button variant="outline" size="sm" className="w-full h-8"><Download className="h-3.5 w-3.5 mr-1" /> Abrir PDF</Button>
                </a>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
};
