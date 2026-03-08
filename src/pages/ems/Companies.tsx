import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { EMSLayout } from "@/components/ems/EMSLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { motion } from "framer-motion";
import { Building2, Plus, Pencil, Trash2, FolderKanban, ListTodo, Contact, TrendingUp } from "lucide-react";
import type { Company } from "@/contexts/CompanyContext";

const COMPANY_COLORS = [
  { value: "primary", label: "Primária", class: "bg-primary" },
  { value: "blue", label: "Azul", class: "bg-blue-500" },
  { value: "green", label: "Verde", class: "bg-green-500" },
  { value: "orange", label: "Laranja", class: "bg-orange-500" },
  { value: "purple", label: "Roxo", class: "bg-purple-500" },
  { value: "red", label: "Vermelho", class: "bg-red-500" },
  { value: "pink", label: "Rosa", class: "bg-pink-500" },
  { value: "cyan", label: "Ciano", class: "bg-cyan-500" },
];

const getColorClass = (color: string | null) => {
  return COMPANY_COLORS.find((c) => c.value === color)?.class || "bg-primary";
};

const Companies = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCompany, setEditingCompany] = useState<Company | null>(null);
  const [form, setForm] = useState({ name: "", description: "", color: "primary" });

  const { data: companies = [], isLoading } = useQuery({
    queryKey: ["companies"],
    queryFn: async () => {
      const { data, error } = await supabase.from("companies").select("*").order("name");
      if (error) throw error;
      return data as Company[];
    },
  });

  // Fetch stats for each company
  const { data: stats = {} } = useQuery({
    queryKey: ["company-stats", companies.map((c) => c.id)],
    enabled: companies.length > 0,
    queryFn: async () => {
      const ids = companies.map((c) => c.id);
      const [projects, tasks, contacts, transactions] = await Promise.all([
        supabase.from("projects").select("id, company_id").in("company_id", ids),
        supabase.from("tasks").select("id, company_id").in("company_id", ids),
        supabase.from("contacts").select("id, company_id").in("company_id", ids),
        supabase.from("financial_transactions").select("id, company_id, amount, type").in("company_id", ids),
      ]);
      const result: Record<string, { projects: number; tasks: number; contacts: number; revenue: number }> = {};
      ids.forEach((id) => {
        result[id] = {
          projects: (projects.data || []).filter((p) => p.company_id === id).length,
          tasks: (tasks.data || []).filter((t) => t.company_id === id).length,
          contacts: (contacts.data || []).filter((c) => c.company_id === id).length,
          revenue: (transactions.data || [])
            .filter((t) => t.company_id === id && t.type === "income")
            .reduce((sum, t) => sum + Number(t.amount), 0),
        };
      });
      return result;
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (editingCompany) {
        const { error } = await supabase.from("companies").update({ name: form.name, description: form.description, color: form.color }).eq("id", editingCompany.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("companies").insert({ name: form.name, description: form.description, color: form.color });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["companies"] });
      setDialogOpen(false);
      setEditingCompany(null);
      setForm({ name: "", description: "", color: "primary" });
      toast({ title: editingCompany ? "Empresa atualizada" : "Empresa criada" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("companies").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["companies"] });
      toast({ title: "Empresa removida" });
    },
  });

  const openEdit = (company: Company) => {
    setEditingCompany(company);
    setForm({ name: company.name, description: company.description || "", color: company.color || "primary" });
    setDialogOpen(true);
  };

  const openNew = () => {
    setEditingCompany(null);
    setForm({ name: "", description: "", color: "primary" });
    setDialogOpen(true);
  };

  return (
    <EMSLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Empresas</h1>
            <p className="text-sm text-muted-foreground">Gerencie seus workspaces por empresa</p>
          </div>
          <Button onClick={openNew}>
            <Plus className="h-4 w-4 mr-2" /> Nova Empresa
          </Button>
        </div>

        {isLoading ? (
          <div className="text-muted-foreground text-center py-12">Carregando...</div>
        ) : companies.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <Building2 className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold text-foreground mb-2">Nenhuma empresa cadastrada</h3>
              <p className="text-sm text-muted-foreground mb-4">Crie sua primeira empresa para organizar seus dados por workspace.</p>
              <Button onClick={openNew}><Plus className="h-4 w-4 mr-2" /> Criar Empresa</Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {companies.map((company, i) => {
              const s = stats[company.id] || { projects: 0, tasks: 0, contacts: 0, revenue: 0 };
              return (
                <motion.div key={company.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                  <Card className="relative overflow-hidden group">
                    <div className={`absolute top-0 left-0 w-1.5 h-full ${getColorClass(company.color)}`} />
                    <CardHeader className="pl-6">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`h-10 w-10 rounded-lg ${getColorClass(company.color)} flex items-center justify-center`}>
                            <Building2 className="h-5 w-5 text-white" />
                          </div>
                          <div>
                            <CardTitle className="text-base">{company.name}</CardTitle>
                            {company.description && <p className="text-xs text-muted-foreground mt-0.5">{company.description}</p>}
                          </div>
                        </div>
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(company)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => deleteMutation.mutate(company.id)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="pl-6">
                      <div className="grid grid-cols-2 gap-3">
                        <div className="flex items-center gap-2 text-sm">
                          <FolderKanban className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="text-muted-foreground">{s.projects} projetos</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          <ListTodo className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="text-muted-foreground">{s.tasks} tarefas</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          <Contact className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="text-muted-foreground">{s.contacts} contatos</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          <TrendingUp className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="text-muted-foreground">R$ {s.revenue.toLocaleString("pt-BR")}</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>

      {/* Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingCompany ? "Editar Empresa" : "Nova Empresa"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-foreground">Nome *</label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Nome da empresa" />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground">Descrição</label>
              <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Descrição opcional" />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground">Cor</label>
              <div className="flex gap-2 mt-2">
                {COMPANY_COLORS.map((c) => (
                  <button
                    key={c.value}
                    onClick={() => setForm({ ...form, color: c.value })}
                    className={`h-8 w-8 rounded-full ${c.class} transition-all ${form.color === c.value ? "ring-2 ring-offset-2 ring-foreground scale-110" : "opacity-60 hover:opacity-100"}`}
                  />
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={() => saveMutation.mutate()} disabled={!form.name.trim() || saveMutation.isPending}>
              {saveMutation.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </EMSLayout>
  );
};

export default Companies;
