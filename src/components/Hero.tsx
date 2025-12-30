import { Button } from "@/components/ui/button";
import { ArrowRight, Play } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { motion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";

// Honeycomb SVG pattern component
const HoneycombPattern = () => (
  <svg className="absolute inset-0 w-full h-full" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <pattern id="honeycomb" width="56" height="100" patternUnits="userSpaceOnUse" patternTransform="scale(2)">
        <path 
          d="M28 66L0 50L0 16L28 0L56 16L56 50L28 66L28 100" 
          fill="none" 
          stroke="currentColor" 
          strokeWidth="1"
          className="text-primary/10"
        />
        <path 
          d="M28 0L28 34L0 50L0 84L28 100L56 84L56 50L28 34" 
          fill="none" 
          stroke="currentColor" 
          strokeWidth="0.5"
          className="text-primary/5"
        />
      </pattern>
    </defs>
    <rect width="100%" height="100%" fill="url(#honeycomb)" />
  </svg>
);

const Hero = () => {
  const navigate = useNavigate();
  const containerRef = useRef<HTMLElement>(null);
  
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end start"]
  });
  
  const backgroundY = useTransform(scrollYProgress, [0, 1], ["0%", "50%"]);
  const honeycombScale = useTransform(scrollYProgress, [0, 1], [1, 1.2]);
  const honeycombOpacity = useTransform(scrollYProgress, [0, 0.5], [1, 0]);
  
  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <section
      ref={containerRef}
      id="hero"
      className="relative min-h-screen flex items-center justify-center overflow-hidden pt-20 bg-background"
    >
      {/* Parallax Honeycomb Background */}
      <motion.div 
        className="absolute inset-0 pointer-events-none"
        style={{ 
          y: backgroundY,
          scale: honeycombScale,
          opacity: honeycombOpacity
        }}
      >
        <HoneycombPattern />
      </motion.div>

      {/* Animated gradient blobs */}
      <motion.div 
        className="absolute inset-0 opacity-10"
        style={{ y: backgroundY }}
      >
        <motion.div 
          className="absolute top-20 left-20 w-96 h-96 bg-primary rounded-full blur-3xl"
          animate={{ 
            scale: [1, 1.2, 1],
            x: [0, 30, 0],
            y: [0, -20, 0]
          }}
          transition={{ 
            duration: 8, 
            repeat: Infinity,
            ease: "easeInOut"
          }}
        />
        <motion.div 
          className="absolute bottom-20 right-20 w-96 h-96 bg-primary rounded-full blur-3xl"
          animate={{ 
            scale: [1.2, 1, 1.2],
            x: [0, -30, 0],
            y: [0, 20, 0]
          }}
          transition={{ 
            duration: 10, 
            repeat: Infinity,
            ease: "easeInOut"
          }}
        />
      </motion.div>

      <div className="container mx-auto px-4 relative z-10">
        <div className="max-w-5xl mx-auto text-center">
          {/* Main Headline */}
          <motion.h1 
            className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-heading font-bold text-foreground mb-4 md:mb-6 leading-tight px-2"
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
          >
            Software que organiza a operação da sua empresa.
          </motion.h1>

          {/* Subtitle */}
          <motion.p 
            className="text-base sm:text-lg md:text-xl lg:text-2xl text-muted-foreground mb-6 md:mb-8 max-w-3xl mx-auto leading-relaxed px-4"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2, ease: "easeOut" }}
          >
            Criamos sistemas a partir de problemas reais: unificamos ferramentas existentes ou desenvolvemos soluções sob medida para simplificar a gestão.
          </motion.p>

          {/* CTA Button */}
          <motion.div 
            className="flex flex-col sm:flex-row gap-4 justify-center px-4"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.4, ease: "easeOut" }}
          >
            <Button
              variant="outline"
              size="xl"
              onClick={() => navigate("/demonstracao")}
              className="w-full sm:w-auto text-sm sm:text-base border-primary text-primary hover:bg-primary hover:text-primary-foreground"
            >
              <Play className="mr-2 h-5 w-5" />
              Ver Demonstração
            </Button>
            <Button
              variant="outline"
              size="xl"
              onClick={() => scrollToSection("services")}
              className="w-full sm:w-auto text-sm sm:text-base border-foreground text-foreground hover:bg-foreground hover:text-background"
            >
              Ver Soluções
            </Button>
            <Button
              variant="hero"
              size="xl"
              onClick={() => scrollToSection("contact")}
              className="group w-full sm:w-auto text-sm sm:text-base animate-glow"
            >
              Fale Conosco
              <ArrowRight className="group-hover:translate-x-1 transition-transform ml-2" />
            </Button>
          </motion.div>
        </div>
      </div>

      {/* Scroll Indicator */}
      <motion.div 
        className="absolute bottom-8 left-1/2 transform -translate-x-1/2"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1, duration: 0.5 }}
      >
        <motion.div 
          className="w-6 h-10 border-2 border-muted-foreground/30 rounded-full flex justify-center"
          animate={{ y: [0, 8, 0] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
        >
          <div className="w-1 h-3 bg-primary rounded-full mt-2"></div>
        </motion.div>
      </motion.div>
    </section>
  );
};

export default Hero;
