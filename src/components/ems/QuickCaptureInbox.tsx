import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Inbox, Plus, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { toast } from "@/hooks/use-toast";

const emptyForm = { title: "", content: "", priority: "medium", due_date: "" };

export const QuickCaptureInbox = () => {
  const { selectedCompanyId } = useCompany();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await (supabase as any).from("unified_inbox").insert({
        title: form.title,
        content: form.content || null,
        priority: form.priority,
        due_date: form.due_date || null,
        source: "manual",
        status: "new",
        company_id: selectedCompanyId !== "all" ? selectedCompanyId : null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["unified-inbox"] });
      toast({ title: "Capturado no Inbox" });
      setForm(emptyForm);
      setOpen(false);
    },
    onError: (error: any) => toast({ title: "Erro ao capturar", description: error?.message, variant: "destructive" }),
  });

  return (
    <>
      <Button variant="outline" size="sm" className="h-9 gap-1.5" onClick={() => setOpen(true)}>
        <Inbox className="h-4 w-4" />
        <span className="hidden sm:inline">Inbox</span>
        <Plus className="h-3.5 w-3.5" />
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Captura rápida</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input placeholder="O que entrou?" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            <Textarea placeholder="Contexto, link, origem, detalhes..." value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} className="min-h-28" />
            <div className="grid grid-cols-2 gap-2">
              <Select value={form.priority} onValueChange={(value) => setForm({ ...form, priority: value })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Baixa</SelectItem>
                  <SelectItem value="medium">Média</SelectItem>
                  <SelectItem value="high">Alta</SelectItem>
                  <SelectItem value="critical">Crítica</SelectItem>
                </SelectContent>
              </Select>
              <Input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={() => save.mutate()} disabled={!form.title.trim() || save.isPending}>
              <Save className="h-4 w-4 mr-2" /> Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
