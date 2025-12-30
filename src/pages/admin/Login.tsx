import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Shield, Loader2, Mail } from "lucide-react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";

const formSchema = z.object({
  email: z.string().email({ message: "Email inválido" }),
  password: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;

const Login = () => {
  const [isSignUp, setIsSignUp] = useState(false);
  const [isMagicLink, setIsMagicLink] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { user, isAdmin, loading, signIn, signUp, signInWithMagicLink } = useAuth();
  const navigate = useNavigate();

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  useEffect(() => {
    if (!loading && user && isAdmin) {
      navigate("/admin");
    }
  }, [user, isAdmin, loading, navigate]);

  const onSubmit = async (values: FormData) => {
    setIsSubmitting(true);
    
    try {
      if (isMagicLink) {
        await signInWithMagicLink(values.email);
        form.reset();
      } else if (isSignUp) {
        const { error } = await signUp(values.email, values.password || "");
        if (!error) {
          setIsSignUp(false);
          form.reset();
        }
      } else {
        const { error } = await signIn(values.email, values.password || "");
        if (!error) {
          navigate("/admin");
        }
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="flex items-center justify-center w-16 h-16 rounded-full bg-primary/10">
              <Shield className="h-8 w-8 text-primary" />
            </div>
          </div>
          <CardTitle className="text-2xl">Área Administrativa</CardTitle>
          <CardDescription>
            {isMagicLink
              ? "Enviaremos um link de acesso para seu email"
              : isSignUp
              ? "Crie sua conta de administrador"
              : "Entre com suas credenciais"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        placeholder="seu@email.com"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {!isMagicLink && (
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Senha</FormLabel>
                      <FormControl>
                        <Input
                          type="password"
                          placeholder="••••••••"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              <Button
                type="submit"
                className="w-full"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processando...
                  </>
                ) : isMagicLink ? (
                  <>
                    <Mail className="mr-2 h-4 w-4" />
                    Enviar Link de Acesso
                  </>
                ) : (
                  <>{isSignUp ? "Cadastrar" : "Entrar"}</>
                )}
              </Button>

              {!isMagicLink && (
                <div className="text-center text-sm">
                  <button
                    type="button"
                    onClick={() => setIsSignUp(!isSignUp)}
                    className="text-primary hover:underline"
                  >
                    {isSignUp
                      ? "Já tem uma conta? Faça login"
                      : "Não tem conta? Cadastre-se"}
                  </button>
                </div>
              )}

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-card px-2 text-muted-foreground">ou</span>
                </div>
              </div>

              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => {
                  setIsMagicLink(!isMagicLink);
                  if (!isMagicLink) setIsSignUp(false);
                }}
              >
                <Mail className="mr-2 h-4 w-4" />
                {isMagicLink ? "Voltar ao login tradicional" : "Entrar via Email (sem senha)"}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
};

export default Login;
