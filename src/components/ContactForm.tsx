import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate } from "react-router-dom";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const formSchema = z.object({
  name: z.string().min(2, "Nome deve ter no mínimo 2 caracteres").max(100, "Nome muito longo"),
  email: z.string().email("E-mail inválido").max(255, "E-mail muito longo"),
  phone: z.string().min(10, "Telefone inválido").max(20, "Telefone muito longo"),
  company: z.string().min(2, "Nome da empresa obrigatório").max(100, "Nome muito longo"),
  segment: z.string().min(2, "Segmento obrigatório"),
  challenge: z.string().min(10, "Descreva seu desafio com mais detalhes").max(1000, "Texto muito longo"),
  message: z.string().max(1000, "Mensagem muito longa").optional(),
});

type FormData = z.infer<typeof formSchema>;

const ContactForm = () => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<FormData>({
    resolver: zodResolver(formSchema),
  });

  const onSubmit = async (data: FormData) => {
    setIsSubmitting(true);
    
    try {
      const { error } = await supabase
        .from('contact_submissions')
        .insert([{
          name: data.name,
          email: data.email,
          phone: data.phone,
          company: data.company,
          segment: data.segment,
          challenge: data.challenge,
          message: data.message || null,
        }]);

      if (error) throw error;

      toast({
        title: "Mensagem Enviada!",
        description: "Redirecionando...",
      });

      reset();
      
      setTimeout(() => {
        navigate("/obrigado");
      }, 1000);
    } catch {
      toast({
        title: "Erro ao Enviar",
        description: "Por favor, tente novamente ou entre em contato por e-mail.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section id="contact" className="py-20 md:py-32 bg-muted/30">
      <div className="container mx-auto px-4">
        <div className="max-w-3xl mx-auto">
          {/* Section Header */}
          <div className="text-center mb-12 animate-fade-in px-4">
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-heading font-bold text-foreground mb-6">
              Pronto para Eliminar os Gargalos e Escalar?
            </h2>
            <p className="text-base sm:text-lg md:text-xl text-muted-foreground">
              Agende uma Análise Estratégica gratuita com nossa equipe. Em 30 minutos, identificaremos o ponto de otimização que pode gerar o maior impacto no seu resultado.
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit(onSubmit)} className="bg-card rounded-2xl shadow-xl border border-border p-4 sm:p-6 md:p-8 space-y-6 animate-fade-in">
            {/* Name */}
            <div>
              <Label htmlFor="name">Nome Completo *</Label>
              <Input
                id="name"
                {...register("name")}
                placeholder="Seu nome completo"
                className="mt-2"
              />
              {errors.name && (
                <p className="text-sm text-destructive mt-1">{errors.name.message}</p>
              )}
            </div>

            {/* Email & Phone */}
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="email">E-mail *</Label>
                <Input
                  id="email"
                  type="email"
                  {...register("email")}
                  placeholder="seu@email.com"
                  className="mt-2"
                />
                {errors.email && (
                  <p className="text-sm text-destructive mt-1">{errors.email.message}</p>
                )}
              </div>
              <div>
                <Label htmlFor="phone">Telefone/WhatsApp *</Label>
                <Input
                  id="phone"
                  {...register("phone")}
                  placeholder="(00) 00000-0000"
                  className="mt-2"
                />
                {errors.phone && (
                  <p className="text-sm text-destructive mt-1">{errors.phone.message}</p>
                )}
              </div>
            </div>

            {/* Company & Segment */}
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="company">Nome da Empresa *</Label>
                <Input
                  id="company"
                  {...register("company")}
                  placeholder="Sua empresa"
                  className="mt-2"
                />
                {errors.company && (
                  <p className="text-sm text-destructive mt-1">{errors.company.message}</p>
                )}
              </div>
              <div>
                <Label htmlFor="segment">Segmento/Ramo *</Label>
                <Input
                  id="segment"
                  {...register("segment")}
                  placeholder="Ex: Construção, Tecnologia..."
                  className="mt-2"
                />
                {errors.segment && (
                  <p className="text-sm text-destructive mt-1">{errors.segment.message}</p>
                )}
              </div>
            </div>

            {/* Challenge */}
            <div>
              <Label htmlFor="challenge">Qual é seu principal desafio operacional? *</Label>
              <Textarea
                id="challenge"
                {...register("challenge")}
                placeholder="Descreva o principal problema ou desafio que você enfrenta no seu negócio..."
                className="mt-2 min-h-[120px]"
              />
              {errors.challenge && (
                <p className="text-sm text-destructive mt-1">{errors.challenge.message}</p>
              )}
            </div>

            {/* Additional Message */}
            <div>
              <Label htmlFor="message">Mensagem Adicional (opcional)</Label>
              <Textarea
                id="message"
                {...register("message")}
                placeholder="Alguma informação adicional que gostaria de compartilhar..."
                className="mt-2"
              />
              {errors.message && (
                <p className="text-sm text-destructive mt-1">{errors.message.message}</p>
              )}
            </div>

            {/* Submit Button */}
            <Button
              type="submit"
              variant="hero"
              size="lg"
              className="w-full text-sm sm:text-base"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                "Enviando..."
              ) : (
                <>
                  <span className="hidden sm:inline">Enviar Meu Pedido</span>
                  <span className="sm:hidden">Enviar</span>
                  <Send className="w-4 h-4 ml-2" />
                </>
              )}
            </Button>
          </form>

          {/* Contact Info */}
          <div className="mt-8 text-center px-4">
            <p className="text-sm sm:text-base text-muted-foreground mb-2">Ou entre em contato diretamente:</p>
            <a
              href="mailto:joaodsouzanery@gmail.com"
              className="text-sm sm:text-base text-primary hover:text-primary-light font-medium transition-colors break-all"
            >
              joaodsouzanery@gmail.com
            </a>
          </div>
        </div>
      </div>
    </section>
  );
};

export default ContactForm;
