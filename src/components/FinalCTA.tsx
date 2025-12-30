import { Button } from "@/components/ui/button";
import { ArrowRight, Sparkles } from "lucide-react";
import { motion } from "framer-motion";

const FinalCTA = () => {
  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <section 
      className="py-20 md:py-32 relative overflow-hidden bg-card border-y border-border"
    >
      {/* Background decoration */}
      <motion.div 
        className="absolute inset-0 opacity-5"
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 0.05 }}
        viewport={{ once: true }}
        transition={{ duration: 1 }}
      >
        <motion.div 
          className="absolute top-20 left-20 w-96 h-96 bg-primary rounded-full blur-3xl"
          animate={{ 
            scale: [1, 1.2, 1],
            x: [0, 20, 0],
          }}
          transition={{ 
            duration: 6, 
            repeat: Infinity,
            ease: "easeInOut"
          }}
        />
        <motion.div 
          className="absolute bottom-20 right-20 w-96 h-96 bg-primary rounded-full blur-3xl"
          animate={{ 
            scale: [1.2, 1, 1.2],
            x: [0, -20, 0],
          }}
          transition={{ 
            duration: 8, 
            repeat: Infinity,
            ease: "easeInOut"
          }}
        />
      </motion.div>

      <div className="container mx-auto px-4 relative z-10">
        <div className="max-w-4xl mx-auto text-center">
          {/* Icon */}
          <motion.div 
            className="flex justify-center mb-6"
            initial={{ opacity: 0, scale: 0 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ 
              type: "spring",
              stiffness: 200,
              damping: 15
            }}
          >
            <motion.div 
              className="bg-primary/10 backdrop-blur-sm p-4 rounded-2xl border border-primary/20"
              whileHover={{ 
                scale: 1.1,
                rotate: [0, -5, 5, 0],
                transition: { duration: 0.4 }
              }}
            >
              <Sparkles className="w-12 h-12 text-primary" />
            </motion.div>
          </motion.div>

          {/* Heading */}
          <motion.h2 
            className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-heading font-bold text-foreground mb-4 md:mb-6 leading-tight px-4"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.1 }}
          >
            Da Ineficiência ao Lucro:
            <br className="hidden sm:block" />
            Sua Transformação Começa Agora
          </motion.h2>

          {/* Subheading */}
          <motion.p 
            className="text-base sm:text-lg md:text-xl lg:text-2xl text-muted-foreground mb-6 md:mb-8 leading-relaxed px-4"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            Agende sua Análise Estratégica gratuita e descubra como otimizar sua operação com tecnologia focada.
          </motion.p>

          {/* CTA Button */}
          <motion.div 
            className="px-4"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.3 }}
          >
            <motion.div
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.98 }}
            >
              <Button
                variant="hero"
                size="xl"
                onClick={() => scrollToSection("calendly")}
                className="group w-full sm:w-auto text-sm sm:text-base animate-glow"
              >
                <span className="hidden sm:inline">Agendar Análise Estratégica</span>
                <span className="sm:hidden">Análise Estratégica</span>
                <ArrowRight className="group-hover:translate-x-1 transition-transform ml-2" />
              </Button>
            </motion.div>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default FinalCTA;
