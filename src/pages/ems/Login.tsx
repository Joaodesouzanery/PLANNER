import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { LogIn, UserPlus, Loader2, Eye, EyeOff, Mail, ArrowLeft } from "lucide-react";
import hiveLogo from "@/assets/hive-logo.jpg";

const Login = () => {
  const [mode, setMode] = useState<"login" | "signup" | "forgot">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    if (mode === "forgot") {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/ems/reset-password`,
      });
      if (error) {
        toast({ variant: "destructive", title: "Erro", description: error.message });
      } else {
        toast({ title: "Email enviado!", description: "Verifique sua caixa de entrada para redefinir a senha." });
        setMode("login");
      }
    } else if (mode === "signup") {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: `${window.location.origin}/ems` },
      });
      if (error) {
        toast({ variant: "destructive", title: "Erro no cadastro", description: error.message });
      } else {
        toast({ title: "Conta criada!", description: "Você já pode acessar o sistema." });
        navigate("/ems");
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        toast({ variant: "destructive", title: "Erro no login", description: "Email ou senha incorretos." });
      } else {
        navigate("/ems");
      }
    }

    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center space-y-3">
          <div className="mx-auto h-14 w-14 rounded-xl overflow-hidden border border-border">
            <img src={hiveLogo} alt="Hive Tech" className="h-full w-full object-cover" />
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground font-medium">EMS</p>
            <CardTitle className="text-xl">
              {mode === "forgot" ? "Recuperar Senha" : "Hive Tech"}
            </CardTitle>
            {mode === "forgot" && (
              <p className="text-sm text-muted-foreground mt-1">
                Enviaremos um link para redefinir sua senha.
              </p>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            {mode !== "forgot" && (
              <div className="space-y-2">
                <Label htmlFor="password">Senha</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            )}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : mode === "forgot" ? (
                <>
                  <Mail className="h-4 w-4 mr-2" />
                  Enviar Link de Recuperação
                </>
              ) : mode === "signup" ? (
                <>
                  <UserPlus className="h-4 w-4 mr-2" />
                  Criar Conta
                </>
              ) : (
                <>
                  <LogIn className="h-4 w-4 mr-2" />
                  Entrar
                </>
              )}
            </Button>

            {mode === "login" && (
              <button
                type="button"
                onClick={() => setMode("forgot")}
                className="w-full text-center text-sm text-primary hover:underline transition-colors"
              >
                Esqueceu sua senha?
              </button>
            )}

            {mode === "forgot" ? (
              <button
                type="button"
                onClick={() => setMode("login")}
                className="w-full text-center text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center justify-center gap-1"
              >
                <ArrowLeft className="h-3 w-3" />
                Voltar ao login
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setMode(mode === "signup" ? "login" : "signup")}
                className="w-full text-center text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                {mode === "signup" ? "Já tem conta? Faça login" : "Não tem conta? Cadastre-se"}
              </button>
            )}
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default Login;
