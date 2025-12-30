import { CheckCircle, TrendingDown, Target } from "lucide-react";

const SocialProof = () => {
  return (
    <section className="py-20 md:py-32 bg-background">
      <div className="container mx-auto px-4">
        <div className="max-w-5xl mx-auto">
          {/* Section Header */}
          <div className="text-center mb-12 animate-fade-in px-4">
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-heading font-bold text-foreground mb-6">
              Como Sei Que Isso É Verdade?
              <br className="hidden sm:block" />
              <span className="text-primary">A Prova Está no Foco.</span>
            </h2>
          </div>

          {/* Proof Content */}
          <div className="bg-card rounded-2xl shadow-xl border border-border overflow-hidden animate-fade-in">
            <div className="bg-primary/10 p-8">
              <div className="flex items-center gap-4 mb-4">
                <div className="bg-primary/20 p-3 rounded-xl">
                  <Target className="w-8 h-8 text-primary" />
                </div>
                <h3 className="text-2xl font-heading font-bold text-foreground">
                  ConstruData: Prova Real de Resultados
                </h3>
              </div>
            </div>

            <div className="p-4 sm:p-6 md:p-8 space-y-6">
              <p className="text-base sm:text-lg text-muted-foreground leading-relaxed">
                Não pedimos que você acredite em promessas vazias. Nossa prova está na ação focada: O <span className="font-semibold text-foreground">ConstruData</span>, nossa solução para gestão de obras, trouxe resultados concretos para nossos clientes do setor de construção civil.
              </p>

              <div className="grid sm:grid-cols-2 gap-4 sm:gap-6 mt-8">
                <div className="bg-muted/50 rounded-xl p-6">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="bg-secondary/20 p-2 rounded-lg">
                      <TrendingDown className="w-6 h-6 text-secondary" />
                    </div>
                    <h4 className="text-xl font-heading font-bold text-foreground">90% Menos Retrabalho</h4>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Eliminação quase total de retrabalho através de controle preciso e RDO digital com validação GPS.
                  </p>
                </div>

                <div className="bg-muted/50 rounded-xl p-6">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="bg-accent/20 p-2 rounded-lg">
                      <TrendingDown className="w-6 h-6 text-accent" />
                    </div>
                    <h4 className="text-xl font-heading font-bold text-foreground">15% Redução de Custos</h4>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Redução significativa no custo de materiais através do controle inteligente de requisições vs consumo real.
                  </p>
                </div>
              </div>

              <div className="mt-8 p-6 bg-primary/5 rounded-xl border-l-4 border-primary">
                <div className="flex items-start gap-3">
                  <CheckCircle className="w-6 h-6 text-primary flex-shrink-0 mt-1" />
                  <p className="text-foreground leading-relaxed">
                    <span className="font-semibold">Resultados reais, focados no seu problema.</span> Não são promessas. São dados concretos de empresas que confiaram em soluções laser-focadas.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default SocialProof;
