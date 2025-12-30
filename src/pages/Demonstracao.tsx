import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { CheckCircle, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import step1Image from "@/assets/demo/step1-sketch.png";
import step2Image from "@/assets/demo/step2-feature-card.jpg";
import step3Image from "@/assets/demo/step3-form.jpg";
import step4Image from "@/assets/demo/step4-report.jpg";
import step5Image from "@/assets/demo/step5-dashboard.jpg";

const Demonstracao = () => {
  const navigate = useNavigate();

  const steps = [
    {
      number: 1,
      title: "Cliente Explica a Funcionalidade",
      description: "O cliente nos conta qual funcionalidade ele precisa e como ela deve funcionar. Ouvimos atentamente cada detalhe.",
      image: step1Image,
      alt: "Esboço da funcionalidade desejada pelo cliente"
    },
    {
      number: 2,
      title: "Criamos a Funcionalidade no Sistema",
      description: "Desenvolvemos a funcionalidade dentro do sistema, como o Relatório de Ligações, seguindo as especificações do cliente.",
      image: step2Image,
      alt: "Card da funcionalidade Relatório de Ligações"
    },
    {
      number: 3,
      title: "Testamos e Otimizamos",
      description: "Criamos, testamos e otimizamos a funcionalidade para garantir que fique exatamente do agrado do cliente.",
      image: step3Image,
      alt: "Formulário de criação de relatório"
    },
    {
      number: 4,
      title: "Resultado Final",
      description: "O Relatório saiu exatamente como o cliente quis, com todas as informações necessárias organizadas e acessíveis.",
      image: step4Image,
      alt: "Relatório de ligação finalizado"
    },
    {
      number: 5,
      title: "Integração ao Sistema Completo",
      description: "A funcionalidade é adicionada no sistema, somando com todas as outras que já existem, tornando um sistema completo e poderoso.",
      image: step5Image,
      alt: "Dashboard completo do sistema ConstruData"
    }
  ];

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="pt-24 pb-20">
        <div className="container mx-auto px-4">
          {/* Hero Section */}
          <div className="text-center mb-16 animate-fade-in">
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-heading font-bold text-foreground mb-6">
              Como Criamos Suas Funcionalidades
            </h1>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
              Um processo transparente e colaborativo em 5 etapas
            </p>
          </div>

          {/* Steps */}
          <div className="max-w-6xl mx-auto space-y-20">
            {steps.map((step, index) => (
              <div 
                key={step.number}
                className={`flex flex-col ${
                  index % 2 === 0 ? 'lg:flex-row' : 'lg:flex-row-reverse'
                } gap-8 lg:gap-12 items-center animate-fade-in`}
                style={{ animationDelay: `${index * 100}ms` }}
              >
                {/* Image */}
                <div className="w-full lg:w-1/2">
                  <div className="relative rounded-2xl overflow-hidden shadow-2xl border border-border">
                    <img 
                      src={step.image} 
                      alt={step.alt}
                      className="w-full h-auto object-cover"
                    />
                  </div>
                </div>

                {/* Content */}
                <div className="w-full lg:w-1/2 space-y-6">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center justify-center w-16 h-16 rounded-full bg-primary text-primary-foreground text-2xl font-bold shadow-lg">
                      {step.number}
                    </div>
                    <h2 className="text-3xl md:text-4xl font-heading font-bold text-foreground">
                      {step.title}
                    </h2>
                  </div>
                  
                  <p className="text-lg text-muted-foreground leading-relaxed">
                    {step.description}
                  </p>

                  {step.number < steps.length && (
                    <div className="flex items-center gap-3 text-primary">
                      <ArrowRight className="w-6 h-6" />
                      <span className="font-semibold">Próxima etapa</span>
                    </div>
                  )}

                  {step.number === steps.length && (
                    <div className="flex items-center gap-3 text-secondary">
                      <CheckCircle className="w-6 h-6" />
                      <span className="font-semibold">Processo concluído!</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* CTA Section */}
          <div className="mt-20 text-center space-y-8 animate-fade-in">
            <div className="max-w-3xl mx-auto">
              <h2 className="text-3xl md:text-4xl font-heading font-bold text-foreground mb-4">
                Pronto para Criar Seu Sistema Personalizado?
              </h2>
              <p className="text-lg text-muted-foreground mb-8">
                Transformamos suas necessidades em funcionalidades reais, seguindo esse processo comprovado.
              </p>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button 
                size="lg"
                onClick={() => navigate('/#contact')}
                className="text-lg"
              >
                Começar Agora
              </Button>
              <Button 
                size="lg"
                variant="outline"
                onClick={() => navigate('/')}
                className="text-lg"
              >
                Voltar ao Início
              </Button>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default Demonstracao;
