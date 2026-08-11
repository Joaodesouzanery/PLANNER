import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { BrainCircuit, Building2, ExternalLink, FileSearch, Layers, Loader2, Plus, Search, Sparkles, Trash2 } from "lucide-react";
import { useCompany } from "@/contexts/CompanyContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

// Prospecção de Interesse — laboratório de ESTUDO. Você cola links de vagas (ex.: IA) e o mesmo motor
// (linkedin-job-parser, agora com extractSkills) extrai as COMPETÊNCIAS pedidas. A tabela é a mesma
// (commercial_prospects, area='interesse'); aqui não há diagnóstico ConstruData nem conversão comercial.

interface InterestJob {
  id: string;
  company_name: string;
  location: string | null;
  linkedin_job_url: string | null;
  job_title: string | null;
  job_about: string | null;
  extracted_tasks: string[] | null; // aqui = as competências extraídas da vaga
  area?: string | null;
  created_at: string;
}

interface ImportForm {
  linkedin_job_url: string;
  paste: string;
  company_name: string;
  location: string;
  job_title: string;
  job_about: string;
  skills: string[];
}

const emptyForm: ImportForm = { linkedin_job_url: "", paste: "", company_name: "", location: "", job_title: "", job_about: "", skills: [] };

const normalize = (v: string) =>
  v.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
const extractLinkedInJobId = (url: string) => (url.match(/jobs\/view\/(\d+)/i) || url.match(/[?&]currentJobId=(\d+)/i))?.[1] || "";
const stableHash = (v: string) => {
  let h = 0;
  for (let i = 0; i < v.length; i += 1) { h = (h << 5) - h + v.charCodeAt(i); h |= 0; }
  return Math.abs(h).toString(36);
};
const buildFingerprint = (f: Pick<ImportForm, "linkedin_job_url" | "company_name" | "job_title" | "job_about">) => {
  const id = extractLinkedInJobId(f.linkedin_job_url || "");
  if (id) return `linkedin:${id}`;
  const n = [normalize(f.company_name || ""), normalize(f.job_title || ""), normalize((f.job_about || "").slice(0, 700))].join("|");
  return n.replace(/\|/g, "").trim() ? `manual:${stableHash(n)}` : "";
};
const fmtDate = (iso: string) => new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" });

export const ProspectingInteresse = () => {
  const queryClient = useQueryClient();
  const { selectedCompanyId } = useCompany();
  const [searchQuery, setSearchQuery] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<ImportForm>(emptyForm);
  const [selected, setSelected] = useState<InterestJob | null>(null);

  const { data: jobs = [], isLoading } = useQuery({
    queryKey: ["interest-prospects", selectedCompanyId],
    queryFn: async () => {
      let query = (supabase as any).from("commercial_prospects").select("*").order("created_at", { ascending: false });
      if (selectedCompanyId !== "all") query = query.eq("company_id", selectedCompanyId);
      const { data, error } = await query;
      if (error) throw error;
      // Só a área "interesse" (a coluna pode não existir ainda → nenhuma linha de interesse, lista vazia).
      return (data || []).filter((j: any) => j.area === "interesse") as InterestJob[];
    },
  });

  const filteredJobs = useMemo(() => {
    const q = normalize(searchQuery);
    if (!q) return jobs;
    return jobs.filter((j) =>
      [j.company_name, j.job_title, j.location, j.job_about, ...(j.extracted_tasks || [])]
        .filter(Boolean)
        .some((v) => normalize(String(v)).includes(q)),
    );
  }, [jobs, searchQuery]);

  // O agregado principal: competências mais pedidas nas vagas coletadas (cada vaga conta uma skill 1×).
  const skillReport = useMemo(() => {
    const totalJobs = jobs.length || 1;
    const counts = new Map<string, { label: string; count: number }>();
    jobs.forEach((j) => {
      const seen = new Set<string>();
      (j.extracted_tasks || []).forEach((raw) => {
        const key = normalize(String(raw));
        if (!key || seen.has(key)) return;
        seen.add(key);
        const cur = counts.get(key) || { label: String(raw), count: 0 };
        cur.count += 1;
        counts.set(key, cur);
      });
    });
    return Array.from(counts.values())
      .map((x) => ({ ...x, percent: Math.round((x.count / totalJobs) * 100) }))
      .sort((a, b) => b.count - a.count);
  }, [jobs]);

  const importMutation = useMutation({
    mutationFn: async () => {
      const url = form.linkedin_job_url.trim();
      const text = form.paste.trim();
      if (!url && !text) throw new Error("Informe a URL da vaga ou cole o texto antes de importar.");
      const body = url ? { url, text: text || undefined, extractSkills: true } : { text, extractSkills: true };
      const { data, error } = await supabase.functions.invoke("linkedin-job-parser", { body });
      if (error) {
        let detail = error.message;
        try {
          const ctx: any = (error as any).context;
          if (ctx?.json) { const j = await ctx.json(); if (j?.error) detail = j.error; }
          else if (ctx?.text) detail = await ctx.text();
        } catch { /* ignore */ }
        throw new Error(detail || "Falha ao ler a vaga.");
      }
      if (data?.error) throw new Error(data.error);
      return data as { companyName?: string; location?: string; jobTitle?: string; about?: string; skills?: string[] };
    },
    onSuccess: (data) => {
      setForm((prev) => ({
        ...prev,
        company_name: data.companyName || prev.company_name,
        location: data.location || prev.location,
        job_title: data.jobTitle || prev.job_title,
        job_about: data.about || prev.job_about,
        skills: Array.isArray(data.skills) && data.skills.length ? data.skills : prev.skills,
      }));
      const n = data.skills?.length || 0;
      toast({ title: "Vaga lida", description: n ? `${n} competências extraídas. Revise e salve.` : "Revise os dados e salve." });
    },
    onError: (e: any) => toast({ title: "Não consegui ler a vaga", description: `${e?.message} Se exigir login, cole o texto da vaga.`, variant: "destructive" }),
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const nome = form.company_name.trim();
      if (!nome) throw new Error("Informe o nome da empresa (ou importe a vaga primeiro).");
      const fingerprint = buildFingerprint(form);
      if (fingerprint && jobs.some((j: any) => (j.job_fingerprint || "") === fingerprint)) {
        throw new Error("Essa vaga já está na sua lista de interesse.");
      }
      const payload = {
        company_name: nome,
        location: form.location.trim() || null,
        linkedin_job_url: form.linkedin_job_url.trim() || null,
        job_title: form.job_title.trim() || null,
        job_about: form.job_about.trim() || null,
        extracted_tasks: form.skills,
        job_fingerprint: fingerprint || null,
        area: "interesse",
        company_id: selectedCompanyId !== "all" ? selectedCompanyId : null,
      };
      const { error } = await (supabase as any).from("commercial_prospects").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["interest-prospects"] });
      setDialogOpen(false);
      setForm(emptyForm);
      toast({ title: "Vaga salva no estudo!" });
    },
    onError: (e: any) => toast({ title: "Erro ao salvar", description: e?.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("commercial_prospects").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["interest-prospects"] });
      setSelected(null);
      toast({ title: "Vaga removida do estudo" });
    },
    onError: (e: any) => toast({ title: "Erro ao remover", description: e?.message, variant: "destructive" }),
  });

  const totalSkills = skillReport.length;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
        <div>
          <h2 className="text-xl font-heading font-bold flex items-center gap-2">
            <BrainCircuit className="h-5 w-5 text-primary" />
            Prospecção de Interesse
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Cole links de vagas (ex.: IA) só pra estudar. O motor extrai as competências pedidas e consolida o que o mercado mais cobra.
          </p>
        </div>
        <Button className="gap-2 rounded-xl shadow-lg shadow-primary/20" onClick={() => { setForm(emptyForm); setDialogOpen(true); }}>
          <Plus className="h-4 w-4" />Adicionar vaga
        </Button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        {[
          { label: "Vagas coletadas", value: jobs.length, icon: Building2, className: "text-primary bg-primary/10 border-primary/20" },
          { label: "Competências únicas", value: totalSkills, icon: Layers, className: "text-emerald-500 bg-emerald-500/10 border-emerald-500/20" },
          { label: "Mais pedida", value: skillReport[0]?.label || "—", icon: Sparkles, className: "text-amber-600 bg-amber-500/10 border-amber-500/20" },
        ].map((stat) => (
          <Card key={stat.label} className={cn("border", stat.className.split(" ").find((i) => i.startsWith("border-")))}>
            <CardContent className="p-4 flex items-center gap-3">
              <div className={cn("p-2 rounded-lg shrink-0", stat.className)}><stat.icon className="h-4 w-4" /></div>
              <div className="min-w-0">
                <p className="text-2xl font-bold truncate">{stat.value}</p>
                <p className="text-xs text-muted-foreground">{stat.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Consolidado — o coração do estudo */}
      <Card className="border-border/50 bg-card/60">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-1.5"><Layers className="h-4 w-4 text-primary" />Competências mais pedidas</CardTitle>
        </CardHeader>
        <CardContent>
          {skillReport.length === 0 ? (
            <p className="text-xs text-muted-foreground py-4 text-center">Ainda sem competências. Adicione vagas pra começar o mapa do que estão cobrando.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {skillReport.map((s) => (
                <Badge key={s.label} variant="outline" className="gap-1.5 text-xs py-1">
                  {s.label}
                  <span className="font-mono text-[10px] text-primary">{s.count}× · {s.percent}%</span>
                </Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Lista das vagas */}
      <Card className="border-border/50 bg-card/60">
        <CardHeader className="pb-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="text-sm flex items-center gap-1.5"><FileSearch className="h-4 w-4 text-primary" />Vagas coletadas</CardTitle>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Buscar…" className="h-8 w-48 pl-8 text-xs" />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-xs text-muted-foreground py-6 text-center">Carregando…</p>
          ) : filteredJobs.length === 0 ? (
            <p className="text-xs text-muted-foreground py-6 text-center">Nenhuma vaga ainda.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Empresa</TableHead>
                    <TableHead>Vaga</TableHead>
                    <TableHead className="text-center">Competências</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead className="w-8"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredJobs.map((j) => (
                    <TableRow key={j.id} className="cursor-pointer hover:bg-muted/30" onClick={() => setSelected(j)}>
                      <TableCell className="font-medium">{j.company_name}</TableCell>
                      <TableCell className="max-w-[240px]">
                        <span className="flex items-center gap-1.5 truncate">
                          <span className="truncate">{j.job_title || "—"}</span>
                          {j.linkedin_job_url && (
                            <a href={j.linkedin_job_url} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="text-primary shrink-0"><ExternalLink className="h-3 w-3" /></a>
                          )}
                        </span>
                      </TableCell>
                      <TableCell className="text-center"><Badge variant="outline" className="text-[10px]">{j.extracted_tasks?.length || 0}</Badge></TableCell>
                      <TableCell className="text-xs text-muted-foreground">{fmtDate(j.created_at)}</TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={(e) => { e.stopPropagation(); deleteMutation.mutate(j.id); }}><Trash2 className="h-3.5 w-3.5" /></Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Detalhe da vaga selecionada */}
      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-primary" />{selected?.company_name}
            </DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-3">
              <p className="text-sm font-medium">{selected.job_title || "—"}{selected.location ? <span className="text-muted-foreground font-normal"> · {selected.location}</span> : null}</p>
              <div>
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold mb-1.5">Competências pedidas</p>
                {selected.extracted_tasks?.length ? (
                  <div className="flex flex-wrap gap-1.5">{selected.extracted_tasks.map((s, i) => <Badge key={`${s}-${i}`} variant="outline" className="text-xs">{s}</Badge>)}</div>
                ) : <p className="text-xs text-muted-foreground">Nenhuma competência extraída (importe de novo pela URL ou cole o texto).</p>}
              </div>
              {selected.job_about && (
                <div>
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold mb-1.5">Sobre a vaga</p>
                  <p className="text-xs text-muted-foreground whitespace-pre-line max-h-64 overflow-y-auto">{selected.job_about}</p>
                </div>
              )}
              {selected.linkedin_job_url && (
                <a href={selected.linkedin_job_url} target="_blank" rel="noreferrer" className="text-xs text-primary inline-flex items-center gap-1"><ExternalLink className="h-3 w-3" />Abrir no LinkedIn</a>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Adicionar/importar vaga */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Adicionar vaga pra estudo</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <label className="text-[11px] text-muted-foreground">Link da vaga no LinkedIn</label>
              <div className="flex gap-2">
                <Input value={form.linkedin_job_url} onChange={(e) => setForm((f) => ({ ...f, linkedin_job_url: e.target.value }))} placeholder="https://www.linkedin.com/jobs/view/…" className="h-9" />
                <Button variant="secondary" onClick={() => importMutation.mutate()} disabled={importMutation.isPending || (!form.linkedin_job_url.trim() && !form.paste.trim())} className="h-9 gap-1 shrink-0">
                  {importMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileSearch className="h-3.5 w-3.5" />}Importar
                </Button>
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-[11px] text-muted-foreground">Texto colado da vaga (se a URL exigir login)</label>
              <Textarea rows={3} value={form.paste} onChange={(e) => setForm((f) => ({ ...f, paste: e.target.value }))} placeholder="Cole aqui o 'Sobre a vaga'…" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1"><label className="text-[11px] text-muted-foreground">Empresa</label><Input value={form.company_name} onChange={(e) => setForm((f) => ({ ...f, company_name: e.target.value }))} className="h-9" /></div>
              <div className="space-y-1"><label className="text-[11px] text-muted-foreground">Vaga</label><Input value={form.job_title} onChange={(e) => setForm((f) => ({ ...f, job_title: e.target.value }))} className="h-9" /></div>
            </div>
            {form.skills.length > 0 && (
              <div className="space-y-1">
                <label className="text-[11px] text-muted-foreground">Competências extraídas ({form.skills.length})</label>
                <div className="flex flex-wrap gap-1.5 rounded-lg border border-border/50 bg-background/40 p-2 max-h-32 overflow-y-auto">
                  {form.skills.map((s, i) => <Badge key={`${s}-${i}`} variant="outline" className="text-xs">{s}</Badge>)}
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || !form.company_name.trim()}>Salvar no estudo</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
};

export default ProspectingInteresse;
