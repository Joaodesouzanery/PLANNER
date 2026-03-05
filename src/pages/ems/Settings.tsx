import { useState } from "react";
import { EMSLayout } from "@/components/ems/EMSLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { motion } from "framer-motion";
import { Bell, Palette, Database, Download, Trash2, CheckCircle2 } from "lucide-react";
import { useTheme } from "@/components/ems/ThemeProvider";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const Settings = () => {
  const { theme, setTheme } = useTheme();
  const { toast } = useToast();
  const [exporting, setExporting] = useState(false);
  const [clearing, setClearing] = useState(false);

  const handleExportData = async () => {
    setExporting(true);
    try {
      const tables = [
        "projects", "tasks", "contacts", "financial_transactions",
        "okrs", "planning_goals", "planning_milestones", "org_chart_nodes",
        "execution_records", "strategic_pillars", "monthly_focus",
        "kanban_columns", "roadmaps", "quick_notes",
      ] as const;

      const allData: Record<string, any[]> = {};

      for (const table of tables) {
        const { data } = await supabase.from(table).select("*");
        if (data) allData[table] = data;
      }

      const blob = new Blob([JSON.stringify(allData, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `hive-tech-backup-${new Date().toISOString().split("T")[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast({ title: "Dados exportados com sucesso!" });
    } catch {
      toast({ title: "Erro ao exportar dados", variant: "destructive" });
    } finally {
      setExporting(false);
    }
  };

  const handleClearCache = () => {
    setClearing(true);
    try {
      // Clear localStorage except auth
      const authKeys: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith("sb-")) authKeys.push(key);
      }
      const savedAuth: Record<string, string> = {};
      authKeys.forEach((key) => {
        const val = localStorage.getItem(key);
        if (val) savedAuth[key] = val;
      });
      localStorage.clear();
      Object.entries(savedAuth).forEach(([key, val]) => localStorage.setItem(key, val));

      // Clear sessionStorage
      sessionStorage.clear();

      toast({ title: "Cache limpo com sucesso!" });
    } catch {
      toast({ title: "Erro ao limpar cache", variant: "destructive" });
    } finally {
      setClearing(false);
    }
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.1 } },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 },
  };

  return (
    <EMSLayout>
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="space-y-6 max-w-4xl"
      >
        {/* Header */}
        <motion.div variants={itemVariants}>
          <h1 className="text-2xl md:text-3xl font-heading font-bold text-foreground">Configurações</h1>
          <p className="text-muted-foreground mt-1">Gerencie suas preferências do sistema</p>
        </motion.div>

        {/* Notifications Section */}
        <motion.div variants={itemVariants}>
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Bell className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <CardTitle>Notificações</CardTitle>
                  <CardDescription>Configure suas preferências de notificação</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Lembretes de tarefas</p>
                  <p className="text-sm text-muted-foreground">Alertas para tarefas próximas do prazo</p>
                </div>
                <Switch
                  defaultChecked={localStorage.getItem("setting-task-reminders") !== "false"}
                  onCheckedChange={(checked) => localStorage.setItem("setting-task-reminders", String(checked))}
                />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Resumo semanal</p>
                  <p className="text-sm text-muted-foreground">Relatório semanal de atividades</p>
                </div>
                <Switch
                  defaultChecked={localStorage.getItem("setting-weekly-summary") === "true"}
                  onCheckedChange={(checked) => localStorage.setItem("setting-weekly-summary", String(checked))}
                />
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Appearance Section */}
        <motion.div variants={itemVariants}>
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Palette className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <CardTitle>Aparência</CardTitle>
                  <CardDescription>Personalize a interface do sistema</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Tema escuro</p>
                  <p className="text-sm text-muted-foreground">Usar tema escuro na interface</p>
                </div>
                <Switch
                  checked={theme === "dark"}
                  onCheckedChange={(checked) => setTheme(checked ? "dark" : "light")}
                />
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Data Section */}
        <motion.div variants={itemVariants}>
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Database className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <CardTitle>Dados</CardTitle>
                  <CardDescription>Gerenciamento de dados do sistema</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Exportar dados</p>
                  <p className="text-sm text-muted-foreground">Baixe todos os seus dados em JSON</p>
                </div>
                <Button variant="outline" size="sm" onClick={handleExportData} disabled={exporting}>
                  <Download className="h-4 w-4 mr-2" />
                  {exporting ? "Exportando..." : "Exportar"}
                </Button>
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Limpar cache</p>
                  <p className="text-sm text-muted-foreground">Remove dados temporários do navegador</p>
                </div>
                <Button variant="outline" size="sm" onClick={handleClearCache} disabled={clearing}>
                  <Trash2 className="h-4 w-4 mr-2" />
                  {clearing ? "Limpando..." : "Limpar"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </motion.div>
    </EMSLayout>
  );
};

export default Settings;
