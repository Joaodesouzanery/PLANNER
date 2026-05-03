import { useMemo, useState } from "react";
import { EMSLayout } from "@/components/ems/EMSLayout";
import { useCompany } from "@/contexts/CompanyContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Building2, MapPinned, Navigation, Plus, Route, Mail, Phone, Edit2, Trash2 } from "lucide-react";

interface VisitCompany {
  id: string;
  name: string;
  contact_name: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  status: string;
  priority: string;
  notes: string | null;
  company_id: string | null;
}

const statuses = [
  { key: "prospect", label: "Prospect", color: "border-blue-500/30 bg-blue-500/10 text-blue-400" },
  { key: "scheduled", label: "Agendada", color: "border-amber-500/30 bg-amber-500/10 text-amber-400" },
  { key: "visited", label: "Visitada", color: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400" },
  { key: "follow_up", label: "Follow-up", color: "border-purple-500/30 bg-purple-500/10 text-purple-400" },
];

const priorities = [
  { key: "high", label: "Alta" },
  { key: "medium", label: "Média" },
  { key: "low", label: "Baixa" },
];

const emptyForm = {
  name: "",
  contact_name: "",
  phone: "",
  email: "",
  address: "",
  latitude: "",
  longitude: "",
  status: "prospect",
  priority: "medium",
  notes: "",
};

const toRad = (value: number) => (value * Math.PI) / 180;

const distanceKm = (a: { lat: number; lng: number }, b: { lat: number; lng: number }) => {
  const r = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * r * Math.asin(Math.sqrt(h));
};

export const VisitRoutesContent = ({ embedded = false }: { embedded?: boolean }) => {
  const { selectedCompanyId } = useCompany();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<VisitCompany | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [origin, setOrigin] = useState({ address: "", latitude: "", longitude: "" });
  const [routeResult, setRouteResult] = useState<{ companies: VisitCompany[]; distance: number | null } | null>(null);

  const { data: companies = [] } = useQuery({
    queryKey: ["visit-route-companies", selectedCompanyId],
    queryFn: async () => {
      let q = (supabase as any).from("visit_route_companies").select("*").order("created_at", { ascending: false });
      if (selectedCompanyId !== "all") q = q.eq("company_id", selectedCompanyId);
      const { data, error } = await q;
      if (error) throw error;
      return data as VisitCompany[];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        name: form.name,
        contact_name: form.contact_name || null,
        phone: form.phone || null,
        email: form.email || null,
        address: form.address || null,
        latitude: form.latitude ? Number(form.latitude) : null,
        longitude: form.longitude ? Number(form.longitude) : null,
        status: form.status,
        priority: form.priority,
        notes: form.notes || null,
        company_id: selectedCompanyId !== "all" ? selectedCompanyId : null,
      };
      if (editing) {
        const { error } = await (supabase as any).from("visit_route_companies").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await (supabase as any).from("visit_route_companies").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["visit-route-companies"] });
      setDialogOpen(false);
      setEditing(null);
      setForm(emptyForm);
      toast({ title: editing ? "Empresa atualizada!" : "Empresa cadastrada!" });
    },
    onError: (error: any) => toast({ title: "Erro ao salvar", description: error?.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("visit_route_companies").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["visit-route-companies"] });
      toast({ title: "Empresa removida" });
    },
  });

  const openEdit = (company: VisitCompany) => {
    setEditing(company);
    setForm({
      name: company.name,
      contact_name: company.contact_name || "",
      phone: company.phone || "",
      email: company.email || "",
      address: company.address || "",
      latitude: company.latitude?.toString() || "",
      longitude: company.longitude?.toString() || "",
      status: company.status,
      priority: company.priority,
      notes: company.notes || "",
    });
    setDialogOpen(true);
  };

  const toggleSelected = (id: string) => {
    setSelectedIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  };

  const selectedCompanies = useMemo(() => companies.filter((company) => selectedIds.includes(company.id)), [companies, selectedIds]);

  const calculateRoute = () => {
    const withCoords = selectedCompanies.filter((company) => company.latitude != null && company.longitude != null);
    if (withCoords.length !== selectedCompanies.length || !origin.latitude || !origin.longitude) {
      setRouteResult({ companies: selectedCompanies, distance: null });
      return;
    }

    const ordered: VisitCompany[] = [];
    const remaining = [...withCoords];
    let current = { lat: Number(origin.latitude), lng: Number(origin.longitude) };
    let total = 0;

    while (remaining.length > 0) {
      let bestIndex = 0;
      let bestDistance = Infinity;
      remaining.forEach((company, index) => {
        const distance = distanceKm(current, { lat: Number(company.latitude), lng: Number(company.longitude) });
        if (distance < bestDistance) {
          bestDistance = distance;
          bestIndex = index;
        }
      });
      const [next] = remaining.splice(bestIndex, 1);
      ordered.push(next);
      total += bestDistance;
      current = { lat: Number(next.latitude), lng: Number(next.longitude) };
    }

    setRouteResult({ companies: ordered, distance: total });
  };

  const routePlaces = routeResult?.companies
    .map((company) => company.address || (company.latitude != null && company.longitude != null ? `${company.latitude},${company.longitude}` : company.name))
    .filter(Boolean) || [];
  const mapsUrl = routePlaces.length > 0
    ? `https://www.google.com/maps/dir/${[origin.address, ...routePlaces].filter(Boolean).map(encodeURIComponent).join("/")}`
    : "";

  const body = (
    <>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl md:text-3xl font-heading font-bold text-foreground flex items-center gap-2">
              <MapPinned className="h-7 w-7 text-primary" /> Rotas de Visita
            </h1>
            <p className="text-sm text-muted-foreground mt-1">Cadastre empresas, acompanhe status e calcule uma sequência de visitas.</p>
          </div>
          <Button onClick={() => { setEditing(null); setForm(emptyForm); setDialogOpen(true); }}>
            <Plus className="h-4 w-4" /> Empresa
          </Button>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-[1fr_360px] gap-4">
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
              {statuses.map((status) => {
                const columnCompanies = companies.filter((company) => company.status === status.key);
                return (
                  <Card key={status.key} className="overflow-hidden">
                    <CardHeader className="p-3 border-b border-border/50">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Badge variant="outline" className={cn("text-[10px]", status.color)}>{status.label}</Badge>
                        <span className="ml-auto text-xs text-muted-foreground">{columnCompanies.length}</span>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-3 space-y-2 min-h-[180px]">
                      {columnCompanies.map((company) => (
                        <div key={company.id} className="rounded-lg border border-border/50 bg-card p-3 space-y-2">
                          <div className="flex items-start gap-2">
                            <Checkbox checked={selectedIds.includes(company.id)} onCheckedChange={() => toggleSelected(company.id)} />
                            <div className="min-w-0 flex-1">
                              <p className="font-medium text-sm truncate">{company.name}</p>
                              {company.address && <p className="text-xs text-muted-foreground truncate">{company.address}</p>}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                            {company.contact_name && <span className="truncate flex-1"><Building2 className="h-3 w-3 inline mr-1" />{company.contact_name}</span>}
                            {company.phone && <Phone className="h-3 w-3" />}
                            {company.email && <Mail className="h-3 w-3" />}
                          </div>
                          <div className="flex items-center justify-between">
                            <Badge variant="outline" className="text-[10px]">{priorities.find((p) => p.key === company.priority)?.label || company.priority}</Badge>
                            <div className="flex">
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(company)}><Edit2 className="h-3.5 w-3.5" /></Button>
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteMutation.mutate(company.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                            </div>
                          </div>
                        </div>
                      ))}
                      {columnCompanies.length === 0 && <p className="text-xs text-muted-foreground text-center py-8">Sem empresas</p>}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2"><Route className="h-4 w-4 text-primary" /> Planejador</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Origem</Label>
                <Input value={origin.address} onChange={(e) => setOrigin({ ...origin, address: e.target.value })} placeholder="Endereço de saída" />
                <div className="grid grid-cols-2 gap-2">
                  <Input value={origin.latitude} onChange={(e) => setOrigin({ ...origin, latitude: e.target.value })} placeholder="Latitude" />
                  <Input value={origin.longitude} onChange={(e) => setOrigin({ ...origin, longitude: e.target.value })} placeholder="Longitude" />
                </div>
              </div>
              <div className="rounded-lg border border-border/50 p-3">
                <p className="text-sm font-medium">{selectedCompanies.length} empresa(s) selecionada(s)</p>
                <p className="text-xs text-muted-foreground mt-1">Com coordenadas, a ordem é otimizada por distância aproximada.</p>
              </div>
              <Button className="w-full" onClick={calculateRoute} disabled={selectedCompanies.length === 0}>
                <Navigation className="h-4 w-4" /> Calcular rota
              </Button>
              {routeResult && (
                <div className="space-y-3">
                  {routeResult.distance != null && <Badge variant="outline" className="text-xs">Distância aproximada: {routeResult.distance.toFixed(1)} km</Badge>}
                  <div className="space-y-2">
                    {routeResult.companies.map((company, index) => (
                      <div key={company.id} className="flex items-center gap-2 text-sm">
                        <span className="h-6 w-6 rounded-full bg-primary/10 text-primary text-xs flex items-center justify-center">{index + 1}</span>
                        <span className="truncate">{company.name}</span>
                      </div>
                    ))}
                  </div>
                  {mapsUrl && (
                    <a href={mapsUrl} target="_blank" rel="noopener noreferrer">
                      <Button variant="outline" className="w-full">Abrir no Google Maps</Button>
                    </a>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) { setEditing(null); setForm(emptyForm); } }}>
          <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
            <DialogHeader><DialogTitle>{editing ? "Editar empresa" : "Nova empresa para visita"}</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Empresa *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Contato</Label><Input value={form.contact_name} onChange={(e) => setForm({ ...form, contact_name: e.target.value })} /></div>
                <div><Label>Telefone</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
              </div>
              <div><Label>Email</Label><Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
              <div><Label>Localização / endereço</Label><Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Latitude</Label><Input value={form.latitude} onChange={(e) => setForm({ ...form, latitude: e.target.value })} /></div>
                <div><Label>Longitude</Label><Input value={form.longitude} onChange={(e) => setForm({ ...form, longitude: e.target.value })} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Status</Label>
                  <Select value={form.status} onValueChange={(value) => setForm({ ...form, status: value })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{statuses.map((status) => <SelectItem key={status.key} value={status.key}>{status.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Prioridade</Label>
                  <Select value={form.priority} onValueChange={(value) => setForm({ ...form, priority: value })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{priorities.map((priority) => <SelectItem key={priority.key} value={priority.key}>{priority.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div><Label>Observações</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={3} /></div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
              <Button onClick={() => saveMutation.mutate()} disabled={!form.name.trim() || saveMutation.isPending}>{saveMutation.isPending ? "Salvando..." : "Salvar"}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </>
  );

  return embedded ? body : <EMSLayout>{body}</EMSLayout>;
};

const VisitRoutes = () => <VisitRoutesContent />;

export default VisitRoutes;
