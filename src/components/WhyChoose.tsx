import { Target, Minimize, TrendingUp, Sparkles, Shield } from "lucide-react";

const WhyChoose = () => {
  const reasons = [
    {
      icon: Target,
      title: "Foco no ROI",
      description: "Cada solução é projetada com um único objetivo: maximizar o Retorno sobre o Investimento (ROI), eliminando custos e aumentando a produtividade.",
      color: "text-primary",
      bgColor: "bg-primary/10",
    },
    {
      icon: TrendingUp,
      title: "Implementação Ágil (MVP)",
      description: "Entregamos a solução mais rápido. Nosso foco em MVP garante que você comece a colher os benefícios da otimização em semanas, não em meses.",
      color: "text-accent",
      bgColor: "bg-accent/10",
    },
    {
      icon: Shield,
      title: "Parceria de Longo Prazo",
      description: "Seu sucesso é a nossa métrica. Oferecemos acompanhamento contínuo para garantir que a tecnologia evolua junto com as necessidades do seu mercado.",
      color: "text-secondary",
      bgColor: "bg-secondary/10",
    },
  ];

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <section className="py-20 md:py-32 bg-muted/30">
      <div className="container mx-auto px-4">
        <div className="max-w-6xl mx-auto">
          {/* Section Header */}
          <div className="text-center mb-12 animate-fade-in px-4">
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-heading font-bold text-foreground mb-6">
              Não Apenas Tecnologia. Estratégia de Negócios.
            </h2>
            <p className="text-lg sm:text-xl text-muted-foreground max-w-4xl mx-auto mb-8">
              Nossa equipe une a visão estratégica de quem já construiu e escalou operações de alta eficiência com a capacidade técnica de implementar IA e Software Sob Medida. Entendemos o seu fluxo de trabalho e entregamos a otimização que gera lucro.
            </p>
          </div>

          {/* Reasons Grid */}
          <div className="grid md:grid-cols-3 gap-6 sm:gap-8">
            {reasons.map((reason, index) => (
              <div
                key={index}
                className="bg-card rounded-2xl p-6 sm:p-8 shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-2 border border-border animate-fade-in"
                style={{ animationDelay: `${index * 0.1}s` }}
              >
                <div className={`${reason.bgColor} w-12 h-12 sm:w-16 sm:h-16 rounded-xl flex items-center justify-center mb-4 sm:mb-6`}>
                  <reason.icon className={`w-6 h-6 sm:w-8 sm:h-8 ${reason.color}`} />
                </div>
                <h3 className="text-xl sm:text-2xl font-heading font-bold text-foreground mb-3 sm:mb-4">{reason.title}</h3>
                <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">{reason.description}</p>
              </div>
            ))}
          </div>

          {/* CTA Button */}
          <div className="text-center mt-12 animate-fade-in">
            <button
              onClick={() => scrollToSection("calendly")}
              className="inline-flex items-center justify-center px-8 py-4 text-lg font-semibold text-primary-foreground bg-primary rounded-xl hover:bg-primary/90 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105"
            >
              Fale com um Especialista
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};

export default WhyChoose;
