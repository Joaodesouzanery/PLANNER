import { Shield, Award, Target } from "lucide-react";

const Credibility = () => {
  return (
    <section className="py-20 md:py-32 bg-background">
      <div className="container mx-auto px-4">
        <div className="max-w-5xl mx-auto">
          {/* Section Header */}
          <div className="text-center mb-16 animate-fade-in px-4">
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-heading font-bold text-foreground mb-6">
              Por Que Eu Deveria Confiar em Você?
            </h2>
          </div>

          {/* Credibility Content */}
          <div className="bg-card rounded-2xl shadow-xl border border-border overflow-hidden animate-fade-in">
            <div className="bg-primary/10 p-8">
              <div className="flex items-center gap-4">
                <div className="bg-primary/20 p-3 rounded-xl">
                  <Shield className="w-8 h-8 text-primary" />
                </div>
                <h3 className="text-2xl font-heading font-bold text-foreground">
                  Expertise em Ação, Não em Promessas
                </h3>
              </div>
            </div>

            <div className="p-8 space-y-8">
              <p className="text-lg text-muted-foreground leading-relaxed">
                Minha credibilidade não está em ser um "guru", mas em ser um <span className="font-semibold text-foreground">especialista que entende a dor do empresário</span>.
              </p>

              <div className="grid md:grid-cols-2 gap-6">
                {/* Point 1 */}
                <div className="bg-muted/50 rounded-xl p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="bg-primary/20 p-2 rounded-lg">
                      <Target className="w-6 h-6 text-primary" />
                    </div>
                    <h4 className="text-lg font-heading font-bold text-foreground">Foco no Problema Real</h4>
                  </div>
                  <p className="text-muted-foreground leading-relaxed">
                    Meu foco é em construir o elo perdido entre o problema e a solução ideal. Não vendo produtos, vendo resultados.
                  </p>
                </div>

                {/* Point 2 */}
                <div className="bg-muted/50 rounded-xl p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="bg-secondary/20 p-2 rounded-lg">
                      <Award className="w-6 h-6 text-secondary" />
                    </div>
                    <h4 className="text-lg font-heading font-bold text-foreground">Expertise Comprovada</h4>
                  </div>
                  <p className="text-muted-foreground leading-relaxed">
                    Especialista em identificar e eliminar gargalos operacionais com tecnologia sob medida.
                  </p>
                </div>
              </div>

              <div className="bg-primary/5 rounded-xl p-6 border-l-4 border-primary">
                <p className="text-lg text-foreground leading-relaxed">
                  <span className="font-semibold">Eu não vendo um produto;</span> eu vendo a minha expertise em identificar e eliminar o seu gargalo operacional com tecnologia sob medida.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Credibility;
