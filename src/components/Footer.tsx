import { Mail, Instagram } from "lucide-react";
import hiveLogo from "@/assets/hive-logo.jpg";

const Footer = () => {
  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <footer className="bg-foreground text-background py-12 md:py-16">
      <div className="container mx-auto px-4">
        <div className="grid md:grid-cols-4 gap-8 mb-8">
          {/* Column 1 - Brand */}
          <div>
            <img src={hiveLogo} alt="Hive Tech" className="h-16 w-auto mb-4" />
            <p className="text-background/80 text-sm leading-relaxed">
              O Fim do Software Genérico
            </p>
          </div>

          {/* Column 2 - Navigation */}
          <div>
            <h4 className="font-heading font-semibold mb-4">Navegação</h4>
            <ul className="space-y-2 text-sm">
              <li>
                <button
                  onClick={() => scrollToSection("hero")}
                  className="text-background/80 hover:text-background transition-colors"
                >
                  Home
                </button>
              </li>
              <li>
                <button
                  onClick={() => scrollToSection("about")}
                  className="text-background/80 hover:text-background transition-colors"
                >
                  Sobre
                </button>
              </li>
              <li>
                <button
                  onClick={() => scrollToSection("services")}
                  className="text-background/80 hover:text-background transition-colors"
                >
                  Serviços
                </button>
              </li>
              <li>
                <button
                  onClick={() => scrollToSection("contact")}
                  className="text-background/80 hover:text-background transition-colors"
                >
                  Contato
                </button>
              </li>
            </ul>
          </div>

          {/* Column 3 - Contact */}
          <div>
            <h4 className="font-heading font-semibold mb-4">Contato</h4>
            <ul className="space-y-2 text-sm">
              <li>
                <a
                  href="mailto:joaodsouzanery@gmail.com"
                  className="text-background/80 hover:text-background transition-colors flex items-center gap-2"
                >
                  <Mail className="w-4 h-4" />
                  joaodsouzanery@gmail.com
                </a>
              </li>
            </ul>
          </div>

          {/* Column 4 - Links */}
          <div>
            <h4 className="font-heading font-semibold mb-4">Links Úteis</h4>
            <ul className="space-y-2 text-sm">
              <li>
                <a
                  href="https://construdata.software"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-background/80 hover:text-background transition-colors"
                >
                  ConstruData
                </a>
              </li>
              <li>
                <a
                  href="https://personalrh.lovable.app"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-background/80 hover:text-background transition-colors"
                >
                  PersonalRH
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Founder Note */}
        <div className="mb-8 p-8 bg-background/10 rounded-2xl border border-background/20">
          <h4 className="font-heading font-bold text-xl mb-4">Sobre a Hive Tech</h4>
          <p className="text-background/90 text-sm leading-relaxed mb-4">
            <span className="font-semibold">A Solução Mais Simples e Eficiente É Sempre a Melhor.</span>
          </p>
          <p className="text-background/80 text-sm leading-relaxed">
            Criamos a Hive Tech porque estávamos cansados de ver empresas presas em softwares que não as serviam. Seu problema é único, e sua solução também deve ser. Nossa missão é devolver o seu foco e o seu tempo, eliminando a dor operacional com a inteligência que se adapta a você. Fale conosco. Vamos resolver isso.
          </p>
        </div>

        {/* Social Links & Copyright */}
        <div className="pt-8 border-t border-background/20">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            {/* Social Links */}
            <div className="flex items-center gap-4">
              <a
                href="#"
                className="text-background/80 hover:text-background transition-colors"
                aria-label="Instagram"
              >
                <Instagram className="w-5 h-5" />
              </a>
            </div>

            {/* Copyright */}
            <p className="text-background/60 text-sm">
              Hive Tech © {new Date().getFullYear()}. Todos os direitos reservados.
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;