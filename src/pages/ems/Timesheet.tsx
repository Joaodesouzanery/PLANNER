import { useState, useMemo } from "react";
import { useCompany } from "@/contexts/CompanyContext";
import { EMSLayout } from "@/components/ems/EMSLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Clock, Trash2, Calendar, Download, FileText, BarChart3, Edit2 } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { format, startOfWeek, endOfWeek, addDays, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const Timesheet = () => {
  const { selectedCompanyId, companies } = useCompany();
  const queryClient = useQueryClient();

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formDate, setFormDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [formHours, setFormHours] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formProjectId, setFormProjectId] = useState<string>("none");
  const [formTaskId, setFormTaskId] = useState<string>("none");

  const [filterFrom, setFilterFrom] = useState(() => format(startOfWeek(new Date(), { weekStartsOn: 1 }), "yyyy-MM-dd"));
  const [filterTo, setFilterTo] = useState(() => format(endOfWeek(new Date(), { weekStartsOn: 1 }), "yyyy-MM-dd"));

  // Fetch projects for selector
  const { data: projects = [] } = useQuery({
    queryKey: ["projects-list", selectedCompanyId],
    queryFn: async () => {
      let q = supabase.from("projects").select("id, title, company_id").order("title");
      if (selectedCompanyId !== "all") q = q.eq("company_id", selectedCompanyId);
      const { data } = await q;
      return data || [];
    },
  });

  // Fetch tasks for selector
  const { data: tasks = [] } = useQuery({
    queryKey: ["tasks-list", selectedCompanyId],
    queryFn: async () => {
      let q = supabase.from("tasks").select("id, title, company_id").eq("status", "pending").order("title");
      if (selectedCompanyId !== "all") q = q.eq("company_id", selectedCompanyId);
      const { data } = await q;
      return data || [];
    },
  });

  // Fetch time entries
  const { data: entries = [] } = useQuery({
    queryKey: ["time-entries", selectedCompanyId, filterFrom, filterTo],
    queryFn: async () => {
      let q = supabase
        .from("time_entries")
        .select("*, projects(title), tasks(title)")
        .gte("date", filterFrom)
        .lte("date", filterTo)
        .order("date", { ascending: false });
      if (selectedCompanyId !== "all") q = q.eq("company_id", selectedCompanyId);
      const { data } = await q;
      return data || [];
    },
  });

  const createEntry = useMutation({
    mutationFn: async () => {
      const payload: any = {
        date: formDate,
        hours: parseFloat(formHours),
        description: formDescription || null,
        project_id: formProjectId !== "none" ? formProjectId : null,
        task_id: formTaskId !== "none" ? formTaskId : null,
        company_id: selectedCompanyId !== "all" ? selectedCompanyId : null,
      };

      if (editingId) {
        const { error } = await supabase.from("time_entries").update(payload).eq("id", editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("time_entries").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["time-entries"] });
      resetForm();
      toast({ title: editingId ? "Registro atualizado" : "Horas registradas" });
    },
    onError: () => toast({ title: "Erro ao salvar", variant: "destructive" }),
  });

  const deleteEntry = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("time_entries").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["time-entries"] });
      toast({ title: "Registro removido" });
    },
  });

  const resetForm = () => {
    setShowForm(false);
    setEditingId(null);
    setFormDate(format(new Date(), "yyyy-MM-dd"));
    setFormHours("");
    setFormDescription("");
    setFormProjectId("none");
    setFormTaskId("none");
  };

  const openEdit = (entry: any) => {
    setEditingId(entry.id);
    setFormDate(entry.date);
    setFormHours(String(entry.hours));
    setFormDescription(entry.description || "");
    setFormProjectId(entry.project_id || "none");
    setFormTaskId(entry.task_id || "none");
    setShowForm(true);
  };

  const totalHours = useMemo(() => entries.reduce((s: number, e: any) => s + Number(e.hours), 0), [entries]);

  // Chart: hours by project
  const chartData = useMemo(() => {
    const map: Record<string, number> = {};
    entries.forEach((e: any) => {
      const label = e.projects?.title || "Sem projeto";
      map[label] = (map[label] || 0) + Number(e.hours);
    });
    return Object.entries(map).map(([name, hours]) => ({ name, hours }));
  }, [entries]);

  const generateCSV = () => {
    const rows = entries.map((e: any) => [e.date, e.hours, e.projects?.title || "", e.tasks?.title || "", e.description || ""].join(","));
    const csv = ["Data,Horas,Projeto,Tarefa,Descrição", ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `timesheet-${filterFrom}-${filterTo}.csv`;
    a.click();
  };

  const generatePDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text("Relatório de Horas", 14, 22);
    doc.setFontSize(10);
    doc.text(`Período: ${filterFrom} a ${filterTo} | Total: ${totalHours.toFixed(1)}h`, 14, 30);
    autoTable(doc, {
      startY: 36,
      head: [["Data", "Horas", "Projeto", "Tarefa", "Descrição"]],
      body: entries.map((e: any) => [e.date, e.hours, e.projects?.title || "-", e.tasks?.title || "-", e.description || "-"]),
    });
    doc.save(`timesheet-${filterFrom}-${filterTo}.pdf`);
  };

  return (
    <EMSLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-foreground">Gestão de Tempo</h1>
            <p className="text-sm text-muted-foreground">Registre e acompanhe horas por projeto e tarefa</p>
          </div>
          <Button onClick={() => { resetForm(); setShowForm(true); }} size="sm">
            <Plus className="h-4 w-4 mr-1" /> Registrar Horas
          </Button>
        </div>

        {/* Stats + Filters */}
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
          <Card className="flex-1">
            <CardContent className="p-4 flex items-center gap-3">
              <Clock className="h-8 w-8 text-primary" />
              <div>
                <p className="text-2xl font-bold">{totalHours.toFixed(1)}h</p>
                <p className="text-xs text-muted-foreground">no período</p>
              </div>
            </CardContent>
          </Card>
          <div className="flex items-center gap-2">
            <Input type="date" value={filterFrom} onChange={(e) => setFilterFrom(e.target.value)} className="w-36 text-xs" />
            <span className="text-muted-foreground text-xs">até</span>
            <Input type="date" value={filterTo} onChange={(e) => setFilterTo(e.target.value)} className="w-36 text-xs" />
          </div>
          <div className="flex gap-1">
            <Button variant="outline" size="sm" onClick={generateCSV}><Download className="h-3 w-3 mr-1" /> CSV</Button>
            <Button variant="outline" size="sm" onClick={generatePDF}><FileText className="h-3 w-3 mr-1" /> PDF</Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Chart */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <BarChart3 className="h-4 w-4" /> Horas por Projeto
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis type="number" className="text-xs fill-muted-foreground" />
                    <YAxis dataKey="name" type="category" width={120} className="text-xs fill-muted-foreground" />
                    <Tooltip formatter={(v: number) => `${v.toFixed(1)}h`} />
                    <Bar dataKey="hours" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Entries list */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Registros ({entries.length})</CardTitle>
            </CardHeader>
            <CardContent className="max-h-72 overflow-y-auto">
              <div className="space-y-2">
                <AnimatePresence>
                  {entries.map((entry: any) => (
                    <motion.div
                      key={entry.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="flex items-center gap-2 p-2 rounded-md border border-border bg-card text-sm"
                    >
                      <Badge variant="outline" className="text-[10px] shrink-0">
                        {format(parseISO(entry.date), "dd/MM", { locale: ptBR })}
                      </Badge>
                      <Badge className="shrink-0">{Number(entry.hours).toFixed(1)}h</Badge>
                      <div className="flex-1 min-w-0">
                        <p className="truncate text-xs">{entry.projects?.title || "Sem projeto"}</p>
                        {entry.description && <p className="truncate text-[10px] text-muted-foreground">{entry.description}</p>}
                      </div>
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => openEdit(entry)}>
                        <Edit2 className="h-3 w-3" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => deleteEntry.mutate(entry.id)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </motion.div>
                  ))}
                </AnimatePresence>
                {entries.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">Nenhum registro no período</p>}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Form Dialog */}
        <Dialog open={showForm} onOpenChange={(o) => !o && resetForm()}>
          <DialogContent className="max-w-[95vw] sm:max-w-md">
            <DialogHeader>
              <DialogTitle>{editingId ? "Editar Registro" : "Registrar Horas"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Data</Label>
                  <Input type="date" value={formDate} onChange={(e) => setFormDate(e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs">Horas</Label>
                  <Input type="number" step="0.25" min="0" placeholder="1.5" value={formHours} onChange={(e) => setFormHours(e.target.value)} />
                </div>
              </div>
              <div>
                <Label className="text-xs">Projeto</Label>
                <Select value={formProjectId} onValueChange={setFormProjectId}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhum</SelectItem>
                    {projects.map((p: any) => (
                      <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Tarefa</Label>
                <Select value={formTaskId} onValueChange={setFormTaskId}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhuma</SelectItem>
                    {tasks.map((t: any) => (
                      <SelectItem key={t.id} value={t.id}>{t.title}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Descrição</Label>
                <Textarea placeholder="O que foi feito..." value={formDescription} onChange={(e) => setFormDescription(e.target.value)} rows={2} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={resetForm}>Cancelar</Button>
              <Button onClick={() => createEntry.mutate()} disabled={!formHours || parseFloat(formHours) <= 0}>
                {editingId ? "Salvar" : "Registrar"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </EMSLayout>
  );
};

export default Timesheet;
