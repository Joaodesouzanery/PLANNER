import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { CheckCircle, Mail, Box, Home } from "lucide-react";

const Obrigado = () => {
  return (
    <div className="min-h-screen">
      <Header />
      
      <main>
        {/* Hero Section */}
        <section className="relative py-20 md:py-32 bg-gradient-to-br from-primary via-primary-light to-accent overflow-hidden">
          <div className="absolute inset-0 opacity-10">
            <div className="absolute top-0 left-0 w-96 h-96 bg-primary-foreground rounded-full blur-3xl" />
            <div className="absolute bottom-0 right-0 w-96 h-96 bg-accent-foreground rounded-full blur-3xl" />
          </div>
          
          <div className="container mx-auto px-4 relative z-10">
            <div className="max-w-3xl mx-auto text-center">
              {/* Success Icon */}
              <div className="mb-8 flex justify-center animate-fade-in">
                <div className="bg-primary-foreground/10 backdrop-blur-sm rounded-full p-6 border border-primary-foreground/20">
                  <CheckCircle className="w-20 h-20 text-primary-foreground" />
                </div>
              </div>

              {/* Title */}
              <h1 className="text-4xl md:text-6xl font-heading font-bold text-primary-foreground mb-6 animate-fade-in">
                Obrigado! Seu Pedido Foi Recebido Com Sucesso! ✓
              </h1>

              {/* Subtitle */}
              <p className="text-lg md:text-xl text-primary-foreground/90 mb-8 animate-fade-in">
                Recebemos suas informações e em breve entraremos em contato para entender melhor suas necessidades e apresentar a melhor solução para seu negócio.
              </p>

              {/* Additional Text */}
              <p className="text-base md:text-lg text-primary-foreground/80 font-medium animate-fade-in">
                Enquanto isso, você pode:
              </p>
            </div>
          </div>
        </section>

        {/* Next Steps Section */}
        <section className="py-16 md:py-24 bg-background">
          <div className="container mx-auto px-4">
            <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
              {/* Card 1: Continue by Email */}
              <div className="bg-card rounded-2xl p-8 shadow-lg border border-border hover:shadow-xl transition-all duration-300 hover:-translate-y-1 animate-fade-in">
                <div className="flex justify-center mb-6">
                  <div className="bg-primary/10 rounded-full p-4">
                    <Mail className="w-8 h-8 text-primary" />
                  </div>
                </div>
                <h3 className="text-xl font-heading font-bold text-foreground mb-3 text-center">
                  Continuar por E-mail
                </h3>
                <p className="text-muted-foreground text-center mb-6">
                  Envie um e-mail diretamente para nossa equipe com detalhes adicionais sobre seu projeto.
                </p>
                <Button
                  variant="accent"
                  className="w-full"
                  asChild
                >
                  <a href="mailto:joaodsouzanery@gmail.com?subject=Novo%20Contato%20Personal%20John&body=Olá%20Personal%20John!%0A%0AEu%20gostaria%20de%20saber%20mais%20sobre%20seus%20serviços.%0A%0AObrigado!">
                    Abrir E-mail
                  </a>
                </Button>
              </div>

              {/* Card 2: Explore Software */}
              <div className="bg-card rounded-2xl p-8 shadow-lg border border-border hover:shadow-xl transition-all duration-300 hover:-translate-y-1 animate-fade-in">
                <div className="flex justify-center mb-6">
                  <div className="bg-secondary/10 rounded-full p-4">
                    <Box className="w-8 h-8 text-secondary" />
                  </div>
                </div>
                <h3 className="text-xl font-heading font-bold text-foreground mb-3 text-center">
                  Explorar Nossos Softwares
                </h3>
                <p className="text-muted-foreground text-center mb-6">
                  Conheça o ConstruData e outras soluções prontas que podem transformar seu negócio.
                </p>
                <Button
                  variant="secondary"
                  className="w-full"
                  asChild
                >
                  <a href="/#softwares">
                    Ver Softwares
                  </a>
                </Button>
              </div>

              {/* Card 3: Back to Home */}
              <div className="bg-card rounded-2xl p-8 shadow-lg border border-border hover:shadow-xl transition-all duration-300 hover:-translate-y-1 animate-fade-in">
                <div className="flex justify-center mb-6">
                  <div className="bg-accent/10 rounded-full p-4">
                    <Home className="w-8 h-8 text-accent" />
                  </div>
                </div>
                <h3 className="text-xl font-heading font-bold text-foreground mb-3 text-center">
                  Voltar ao Início
                </h3>
                <p className="text-muted-foreground text-center mb-6">
                  Explore mais sobre o Personal John e descubra como podemos ajudar seu negócio.
                </p>
                <Button
                  variant="default"
                  className="w-full"
                  asChild
                >
                  <a href="/">
                    Ir para Home
                  </a>
                </Button>
              </div>
            </div>
          </div>
        </section>

        {/* What Happens Now Section */}
        <section className="py-16 md:py-24 bg-muted/30">
          <div className="container mx-auto px-4">
            <div className="max-w-4xl mx-auto">
              <h2 className="text-3xl md:text-4xl font-heading font-bold text-foreground mb-12 text-center animate-fade-in">
                O Que Acontece Agora?
              </h2>

              <div className="space-y-8">
                {/* Step 1 */}
                <div className="flex gap-6 items-start animate-fade-in">
                  <div className="flex-shrink-0">
                    <div className="w-12 h-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-lg">
                      1
                    </div>
                  </div>
                  <div>
                    <h3 className="text-xl font-heading font-bold text-foreground mb-2">
                      Recebemos Seu Contato
                    </h3>
                    <p className="text-muted-foreground">
                      Sua mensagem foi registrada com sucesso em nosso sistema.
                    </p>
                  </div>
                </div>

                {/* Step 2 */}
                <div className="flex gap-6 items-start animate-fade-in">
                  <div className="flex-shrink-0">
                    <div className="w-12 h-12 rounded-full bg-secondary text-secondary-foreground flex items-center justify-center font-bold text-lg">
                      2
                    </div>
                  </div>
                  <div>
                    <h3 className="text-xl font-heading font-bold text-foreground mb-2">
                      Análise de Necessidades
                    </h3>
                    <p className="text-muted-foreground">
                      Nossa equipe analisará suas informações e entenderá melhor seus desafios.
                    </p>
                  </div>
                </div>

                {/* Step 3 */}
                <div className="flex gap-6 items-start animate-fade-in">
                  <div className="flex-shrink-0">
                    <div className="w-12 h-12 rounded-full bg-accent text-accent-foreground flex items-center justify-center font-bold text-lg">
                      3
                    </div>
                  </div>
                  <div>
                    <h3 className="text-xl font-heading font-bold text-foreground mb-2">
                      Proposta Personalizada
                    </h3>
                    <p className="text-muted-foreground">
                      Entraremos em contato (via e-mail ou telefone) com uma proposta customizada.
                    </p>
                  </div>
                </div>

                {/* Step 4 */}
                <div className="flex gap-6 items-start animate-fade-in">
                  <div className="flex-shrink-0">
                    <div className="w-12 h-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-lg">
                      4
                    </div>
                  </div>
                  <div>
                    <h3 className="text-xl font-heading font-bold text-foreground mb-2">
                      Próximos Passos
                    </h3>
                    <p className="text-muted-foreground">
                      Discutiremos os detalhes e agendaremos a implementação.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Final CTA Section */}
        <section className="py-16 md:py-24 bg-background">
          <div className="container mx-auto px-4">
            <div className="max-w-3xl mx-auto text-center">
              <h2 className="text-3xl md:text-4xl font-heading font-bold text-foreground mb-6 animate-fade-in">
                Ficou com Dúvidas?
              </h2>
              <p className="text-lg text-muted-foreground mb-8 animate-fade-in">
                Você pode enviar um e-mail diretamente para nossa equipe ou explorar mais sobre nossos serviços no site.
              </p>
              
              <div className="flex flex-col sm:flex-row gap-4 justify-center animate-fade-in">
                <Button
                  variant="accent"
                  size="lg"
                  asChild
                >
                  <a href="mailto:joaodsouzanery@gmail.com?subject=Novo%20Contato%20Personal%20John&body=Olá%20Personal%20John!%0A%0AEu%20gostaria%20de%20saber%20mais%20sobre%20seus%20serviços.%0A%0AObrigado!">
                    Enviar E-mail
                  </a>
                </Button>
                <Button
                  variant="outline"
                  size="lg"
                  asChild
                >
                  <a href="/">
                    Voltar ao Site
                  </a>
                </Button>
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
};

export default Obrigado;
