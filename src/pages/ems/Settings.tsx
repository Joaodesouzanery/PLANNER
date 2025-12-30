import { EMSLayout } from "@/components/ems/EMSLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { motion } from "framer-motion";
import { User, Bell, Palette, Shield, LogOut } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

const Settings = () => {
  const { user, signOut } = useAuth();

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.1 },
    },
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
          <h1 className="text-3xl font-heading font-bold text-foreground">Configurações</h1>
          <p className="text-muted-foreground mt-1">Gerencie suas preferências e conta</p>
        </motion.div>

        {/* Profile Section */}
        <motion.div variants={itemVariants}>
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <User className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <CardTitle>Perfil</CardTitle>
                  <CardDescription>Informações da sua conta</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Email</Label>
                  <Input value={user?.email || ""} disabled />
                </div>
                <div>
                  <Label>ID do Usuário</Label>
                  <Input value={user?.id || ""} disabled className="font-mono text-xs" />
                </div>
              </div>
            </CardContent>
          </Card>
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
                  <p className="font-medium">Notificações por email</p>
                  <p className="text-sm text-muted-foreground">Receba atualizações sobre seus projetos</p>
                </div>
                <Switch defaultChecked />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Lembretes de tarefas</p>
                  <p className="text-sm text-muted-foreground">Alertas para tarefas próximas do prazo</p>
                </div>
                <Switch defaultChecked />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Relatórios semanais</p>
                  <p className="text-sm text-muted-foreground">Resumo semanal de atividades</p>
                </div>
                <Switch />
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
                <Switch defaultChecked />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Animações</p>
                  <p className="text-sm text-muted-foreground">Habilitar animações de transição</p>
                </div>
                <Switch defaultChecked />
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Security Section */}
        <motion.div variants={itemVariants}>
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Shield className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <CardTitle>Segurança</CardTitle>
                  <CardDescription>Configurações de segurança da conta</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Autenticação em dois fatores</p>
                  <p className="text-sm text-muted-foreground">Adicione uma camada extra de segurança</p>
                </div>
                <Button variant="outline" size="sm">Configurar</Button>
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Alterar senha</p>
                  <p className="text-sm text-muted-foreground">Atualize sua senha de acesso</p>
                </div>
                <Button variant="outline" size="sm">Alterar</Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Logout Section */}
        <motion.div variants={itemVariants}>
          <Card className="border-destructive/20">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-destructive/10">
                    <LogOut className="h-5 w-5 text-destructive" />
                  </div>
                  <div>
                    <p className="font-medium">Sair da conta</p>
                    <p className="text-sm text-muted-foreground">Encerrar sua sessão atual</p>
                  </div>
                </div>
                <Button variant="destructive" onClick={signOut}>
                  Sair
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
