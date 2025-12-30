import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Code, Package, Users, ChevronDown, ChevronUp } from "lucide-react";

const WorkModels = () => {
  const [expandedCards, setExpandedCards] = useState<Set<number>>(new Set());

  const scrollToSection = (sectionId: string) => {
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  const models = [
    {
      icon: Code,
      title: "Software Personalizado",
      subtitle: "Solução Para o Seu Problema Específico",
      color: "text-primary",
      bgColor: "bg-primary/10",
      borderColor: "border-primary/20",
      shadowColor: "hover:shadow-primary",
      intro: "Você tem um desafio operacional específico? Desenvolvemos um software exclusivamente para resolver aquele problema, otimizando aquele processo e aumentando a produtividade naquela área.",
      features: [
        "Análise detalhada do seu problema específico",
        "Desenvolvimento de software customizado para aquela solução",
        "Implementação e treinamento completo",
        "Suporte inicial incluído",
      ],
      idealFor: "Empresas com desafios operacionais específicos que buscam soluções focadas e eficientes.",
      examples: [
        "Gestão desorganizada de obras → ConstruData",
        "Controle de pessoal manual e complexo → Sistema de RH",
        "Falta de visibilidade sobre acessos digitais → Sistema de Segurança",
        "Seu problema específico → Sua solução customizada",
      ],
    },
    {
      icon: Package,
      title: "Software Pronto e Replicável",
      subtitle: "Solução Testada Para Problemas Comuns",
      color: "text-secondary",
      bgColor: "bg-secondary/10",
      borderColor: "border-secondary/20",
      shadowColor: "hover:shadow-secondary",
      intro: "Já desenvolvemos softwares que resolvem problemas comuns a diversas empresas. Se seu desafio é um desses, você pode implementar rapidamente e começar a colher os benefícios.",
      features: [
        "Implementação rápida",
        "Três opções de planos",
        "Suporte contínuo",
        "Atualizações incluídas",
      ],
      softwares: [
        "ConstruData - Gestão de Obras",
        "Sistema Integrado de RH (Em desenvolvimento)",
        "Sistema de Segurança Digital (Em desenvolvimento)",
      ],
      idealFor: "Implementação rápida e receita previsível",
    },
    {
      icon: Users,
      title: "Gestor de IAs & Consultoria Contínua",
      subtitle: "Sua Equipe Estendida Para Resolver Problemas Continuamente",
      color: "text-accent",
      bgColor: "bg-accent/10",
      borderColor: "border-accent/20",
      shadowColor: "hover:shadow-accent",
      intro: "Vá além de uma solução. Integre o Personal John como parte estratégica da sua equipe. Identificamos problemas, desenvolvemos soluções e otimizamos continuamente.",
      features: [
        "Consultoria estratégica para identificar seus maiores desafios",
        "Desenvolvimento contínuo de softwares para cada problema",
        "Otimização de processos existentes",
        "Suporte e evolução constante",
      ],
      idealFor: "Empresas que buscam expertise contínua e um relacionamento de longo prazo.",
    },
  ];

  const toggleCard = (index: number) => {
    setExpandedCards(prev => {
      const newSet = new Set(prev);
      if (newSet.has(index)) {
        newSet.delete(index);
      } else {
        newSet.add(index);
      }
      return newSet;
    });
  };

  return (
    <section id="services" className="py-20 md:py-32 bg-background">
      <div className="container mx-auto px-4">
        <div className="max-w-6xl mx-auto">
          {/* Section Header */}
          <div className="text-center mb-16 animate-fade-in px-4">
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-heading font-bold text-foreground mb-6">
              Meus Três Modelos de Trabalho
            </h2>
            <p className="text-lg sm:text-xl text-muted-foreground">
              Como Trabalho Com Você
            </p>
          </div>

          {/* Model Cards */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {models.map((model, index) => (
              <div
                key={index}
                className={`bg-card rounded-2xl border-2 ${model.borderColor} shadow-lg ${model.shadowColor} transition-all duration-300 hover:-translate-y-1 overflow-hidden animate-fade-in`}
                style={{ animationDelay: `${index * 0.1}s` }}
              >
                {/* Card Header */}
                <div className={`${model.bgColor} p-4 sm:p-6`}>
                  <div className="flex items-center gap-3 sm:gap-4 mb-4">
                    <div className={`${model.color}`}>
                      <model.icon className="w-8 h-8 sm:w-10 sm:h-10" />
                    </div>
                  </div>
                  <h3 className="text-xl sm:text-2xl font-heading font-bold text-foreground mb-2">{model.title}</h3>
                  <p className="text-xs sm:text-sm text-muted-foreground">{model.subtitle}</p>
                </div>

                {/* Card Content */}
                <div className="p-4 sm:p-6">
                  {/* Intro */}
                  {model.intro && (
                    <p className="text-sm text-muted-foreground mb-4 leading-relaxed">{model.intro}</p>
                  )}

                  {/* Features */}
                  <div className="mb-6">
                    <h4 className="font-semibold text-foreground mb-3">Como funciona:</h4>
                    <ul className="space-y-2">
                      {model.features.map((feature, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                          <span className={`${model.color} mt-1`}>•</span>
                          <span>{feature}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Softwares (only for model 2) */}
                  {model.softwares && (
                    <div className="mb-6">
                      <h4 className="font-semibold text-foreground mb-3">Softwares Disponíveis:</h4>
                      <ul className="space-y-2">
                        {model.softwares.map((software, i) => (
                          <li key={i} className="text-sm text-muted-foreground">
                            • {software}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Examples (only for model 1) */}
                  {model.examples && (
                    <div className="mb-6">
                      <h4 className="font-semibold text-foreground mb-3">Exemplos:</h4>
                      <ul className="space-y-2">
                        {model.examples.map((example, i) => (
                          <li key={i} className="text-xs text-muted-foreground">
                            • {example}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Expandable Section */}
                  <button
                    onClick={() => toggleCard(index)}
                    className={`w-full flex items-center justify-between p-3 rounded-lg ${model.bgColor} ${model.color} font-medium text-sm transition-colors hover:opacity-80 mb-4`}
                  >
                    <span>Ver {expandedCards.has(index) ? "Menos" : "Mais"} Detalhes</span>
                    {expandedCards.has(index) ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>

                  {/* Expanded Content */}
                  {expandedCards.has(index) && (
                    <div className="mt-4 pt-4 border-t border-border space-y-4 animate-fade-in">
                      <div>
                        <h4 className="font-semibold text-foreground mb-2 text-sm">Ideal Para:</h4>
                        <p className="text-sm text-muted-foreground">{model.idealFor}</p>
                      </div>
                    </div>
                  )}

                  {/* CTA for Free Diagnosis */}
                  <Button
                    onClick={() => scrollToSection("contact")}
                    className={`w-full mt-4 ${model.color} ${model.bgColor} border-2 ${model.borderColor} hover:opacity-90 transition-all text-sm font-semibold py-5`}
                    variant="outline"
                  >
                    Solicitar Diagnóstico Gratuito
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default WorkModels;
