import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Megaphone, Plus, Target, BarChart3 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useCompany } from "@/contexts/CompanyContext";
import { format, startOfWeek } from "date-fns";

interface Project { id: string; title: string; }
interface Plan { id: string; project_id: string; week_start: string; posts_target: number; reels_target: number; stories_target: number; videos_target: number; notes: string | null; }
interface Post { id: string; project_id: string; posted_at: string; format: string; title: string; copy: string | null; approach: string | null; reach: number; likes: number; comments: number; shares: number; saves: number; notes: string | null; }

const FORMATS = ["post", "reel", "story", "video", "carrossel"];

export const MediaPlanningPanel = () => {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { selectedCompanyId } = useCompany();
  const [projectId, setProjectId] = useState<string>("");
  const weekStart = useMemo(() => format(startOfWeek(new Date(), { weekStartsOn: 1 }), "yyyy-MM-dd"), []);
  const [planForm, setPlanForm] = useState({ posts_target: 0, reels_target: 0, stories_target: 0, videos_target: 0, notes: "" });
  const [postForm, setPostForm] = useState({ title: "", format: "post", copy: "", approach: "", reach: 0, likes: 0, comments: 0, shares: 0, saves: 0, notes: "" });

  const { data: projects = [] } = useQuery({
    queryKey: ["media-projects", selectedCompanyId],
    queryFn: async () => {
      let q = supabase.from("projects").select("id, title").order("title");
      if (selectedCompanyId !== "all") q = q.eq("company_id", selectedCompanyId);
      const { data } = await q;
      return (data || []) as Project[];
    },
  });

  const { data: plans = [], isLoading: plansLoading } = useQuery({
    queryKey: ["media-plans", projectId],
    enabled: !!projectId,
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("media_plans").select("*").eq("project_id", projectId).order("week_start", { ascending: false });
      if (error) throw error;
      return (data || []) as Plan[];
    },
  });

  const { data: posts = [], isLoading: postsLoading } = useQuery({
    queryKey: ["media-posts", projectId],
    enabled: !!projectId,
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("media_posts").select("*").eq("project_id", projectId).order("posted_at", { ascending: false });
      if (error) throw error;
      return (data || []) as Post[];
    },
  });

  const savePlan = useMutation({
    mutationFn: async () => {
      if (!projectId) throw new Error("Selecione um projeto");
      const payload: any = { project_id: projectId, week_start: weekStart, ...planForm };
      if (selectedCompanyId !== "all") payload.company_id = selectedCompanyId;
      const { error } = await (supabase as any).from("media_plans").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["media-plans"] }); toast({ title: "Meta semanal salva" }); },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const savePost = useMutation({
    mutationFn: async () => {
      if (!projectId) throw new Error("Selecione um projeto");
      if (!postForm.title.trim()) throw new Error("Título é obrigatório");
      const payload: any = { project_id: projectId, posted_at: new Date().toISOString().slice(0, 10), ...postForm };
      if (selectedCompanyId !== "all") payload.company_id = selectedCompanyId;
      const { error } = await (supabase as any).from("media_posts").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["media-posts"] });
      setPostForm({ title: "", format: "post", copy: "", approach: "", reach: 0, likes: 0, comments: 0, shares: 0, saves: 0, notes: "" });
      toast({ title: "Post registrado" });
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const stats = useMemo(() => {
    const byApproach: Record<string, { count: number; eng: number }> = {};
    posts.forEach((p) => {
      const k = (p.approach || "sem abordagem").toLowerCase();
      byApproach[k] ||= { count: 0, eng: 0 };
      byApproach[k].count += 1;
      byApproach[k].eng += (p.likes || 0) + (p.comments || 0) + (p.shares || 0) + (p.saves || 0);
    });
    return Object.entries(byApproach).map(([k, v]) => ({ approach: k, count: v.count, avgEng: v.count ? Math.round(v.eng / v.count) : 0 })).sort((a, b) => b.avgEng - a.avgEng);
  }, [posts]);

  const currentPlan = plans.find((p) => p.week_start === weekStart);
  const weekPosts = posts.filter((p) => p.posted_at >= weekStart);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center"><Megaphone className="h-4 w-4 text-primary" /></div>
        <div>
          <h2 className="text-lg font-heading font-bold">Mídia & Conteúdo</h2>
          <p className="text-xs text-muted-foreground">Planeje metas semanais por projeto e compare o que funciona melhor.</p>
        </div>
      </div>

      <Select value={projectId} onValueChange={setProjectId}>
        <SelectTrigger className="max-w-md"><SelectValue placeholder="Selecione um projeto" /></SelectTrigger>
        <SelectContent>{projects.map((p) => <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>)}</SelectContent>
      </Select>

      {!projectId ? (
        <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">Selecione um projeto para planejar mídia.</CardContent></Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-sm flex items-center gap-2"><Target className="h-4 w-4" />Meta semanal ({weekStart})</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {currentPlan ? (
                <div className="grid grid-cols-2 gap-2 text-xs">
                  {(["posts_target","reels_target","stories_target","videos_target"] as const).map((k) => {
                    const label = k.replace("_target", "");
                    const realized = weekPosts.filter((p) => label.startsWith(p.format)).length;
                    return (
                      <div key={k} className="rounded-lg border border-border/50 p-2">
                        <p className="text-muted-foreground capitalize">{label}</p>
                        <p className="font-semibold text-sm">{realized} / {(currentPlan as any)[k]}</p>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    {(["posts_target","reels_target","stories_target","videos_target"] as const).map((k) => (
                      <div key={k}>
                        <label className="text-[10px] text-muted-foreground capitalize">{k.replace("_target", "")}</label>
                        <Input type="number" min="0" value={(planForm as any)[k]} onChange={(e) => setPlanForm({ ...planForm, [k]: Number(e.target.value) })} />
                      </div>
                    ))}
                  </div>
                  <Textarea placeholder="Notas da semana" value={planForm.notes} onChange={(e) => setPlanForm({ ...planForm, notes: e.target.value })} rows={2} />
                  <Button size="sm" onClick={() => savePlan.mutate()} disabled={savePlan.isPending}>Salvar meta</Button>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-sm flex items-center gap-2"><Plus className="h-4 w-4" />Registrar post</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              <Input placeholder="Título" value={postForm.title} onChange={(e) => setPostForm({ ...postForm, title: e.target.value })} />
              <div className="grid grid-cols-2 gap-2">
                <Select value={postForm.format} onValueChange={(v) => setPostForm({ ...postForm, format: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{FORMATS.map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}</SelectContent>
                </Select>
                <Input placeholder="Abordagem (ex: educativo, prova social)" value={postForm.approach} onChange={(e) => setPostForm({ ...postForm, approach: e.target.value })} />
              </div>
              <Textarea placeholder="Copy / texto principal" value={postForm.copy} onChange={(e) => setPostForm({ ...postForm, copy: e.target.value })} rows={2} />
              <div className="grid grid-cols-5 gap-1">
                {(["reach","likes","comments","shares","saves"] as const).map((k) => (
                  <div key={k}>
                    <label className="text-[9px] text-muted-foreground capitalize">{k}</label>
                    <Input type="number" min="0" value={(postForm as any)[k]} onChange={(e) => setPostForm({ ...postForm, [k]: Number(e.target.value) })} className="h-8 text-xs" />
                  </div>
                ))}
              </div>
              <Button size="sm" onClick={() => savePost.mutate()} disabled={savePost.isPending}>Adicionar post</Button>
            </CardContent>
          </Card>

          <Card className="lg:col-span-2">
            <CardHeader className="pb-3"><CardTitle className="text-sm flex items-center gap-2"><BarChart3 className="h-4 w-4" />Comparativo de abordagens</CardTitle></CardHeader>
            <CardContent>
              {postsLoading ? <Skeleton className="h-20" /> : stats.length === 0 ? (
                <p className="text-xs text-muted-foreground py-4 text-center">Registre posts para comparar resultados.</p>
              ) : (
                <div className="space-y-1.5">
                  {stats.map((s) => (
                    <div key={s.approach} className="flex items-center justify-between rounded-lg border border-border/50 px-3 py-2 text-xs">
                      <span className="capitalize font-medium">{s.approach}</span>
                      <div className="flex gap-3 text-muted-foreground">
                        <span>{s.count} posts</span>
                        <Badge variant="outline" className="text-[10px]">eng. médio: {s.avgEng}</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="lg:col-span-2">
            <CardHeader className="pb-3"><CardTitle className="text-sm">Histórico de posts</CardTitle></CardHeader>
            <CardContent>
              {postsLoading ? <Skeleton className="h-20" /> : posts.length === 0 ? (
                <p className="text-xs text-muted-foreground py-4 text-center">Nenhum post registrado ainda.</p>
              ) : (
                <div className="space-y-2">
                  {posts.slice(0, 12).map((p) => (
                    <div key={p.id} className="rounded-lg border border-border/50 p-2.5 text-xs space-y-1">
                      <div className="flex justify-between items-start gap-2">
                        <span className="font-semibold">{p.title}</span>
                        <Badge variant="outline" className="text-[10px]">{p.format}</Badge>
                      </div>
                      <p className="text-muted-foreground">{p.posted_at} · {p.approach || "sem abordagem"}</p>
                      <div className="flex gap-3 text-[11px] text-muted-foreground">
                        <span>👁 {p.reach}</span><span>❤ {p.likes}</span><span>💬 {p.comments}</span><span>↗ {p.shares}</span><span>🔖 {p.saves}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

export default MediaPlanningPanel;
