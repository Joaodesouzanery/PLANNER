import { Search, Code, TrendingUp } from "lucide-react";
import { motion, Variants } from "framer-motion";

const HowItWorks = () => {
  const steps = [
    {
      icon: Search,
      number: "1",
      title: "Diagnóstico Estratégico",
      description: "Mapeamento aprofundado dos seus processos para identificar os pontos de dor mais críticos e as oportunidades de automação de maior valor.",
      color: "text-primary",
      bgColor: "bg-primary/10",
    },
    {
      icon: Code,
      number: "2",
      title: "Desenvolvimento Focado (MVP)",
      description: "Criação e implementação rápida da solução de Software Sob Medida ou Automação com IA, focada exclusivamente no problema identificado.",
      color: "text-accent",
      bgColor: "bg-accent/10",
    },
    {
      icon: TrendingUp,
      number: "3",
      title: "Acompanhamento e Evolução",
      description: "Monitoramento contínuo dos resultados e alinhamentos semanais para garantir que a solução esteja sempre entregando o máximo de eficiência e lucro.",
      color: "text-secondary",
      bgColor: "bg-secondary/10",
    },
  ];

  const containerVariants: Variants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.2,
      },
    },
  };

  const cardVariants: Variants = {
    hidden: { 
      opacity: 0, 
      x: -50,
      scale: 0.95,
    },
    visible: {
      opacity: 1,
      x: 0,
      scale: 1,
      transition: {
        type: "spring" as const,
        stiffness: 100,
        damping: 15,
      },
    },
  };

  const iconVariants: Variants = {
    hidden: { scale: 0, rotate: -90 },
    visible: {
      scale: 1,
      rotate: 0,
      transition: {
        type: "spring" as const,
        stiffness: 200,
        damping: 12,
        delay: 0.1,
      },
    },
  };

  return (
    <section className="py-20 md:py-32 bg-background overflow-hidden">
      <div className="container mx-auto px-4">
        <div className="max-w-6xl mx-auto">
          {/* Section Header */}
          <motion.div 
            className="text-center mb-16 px-4"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.6 }}
          >
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-heading font-bold text-foreground mb-6">
              Da Ineficiência ao Lucro: O Caminho TheHiveTech
            </h2>
          </motion.div>

          {/* Steps */}
          <motion.div 
            className="space-y-6 sm:space-y-8"
            variants={containerVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-50px" }}
          >
            {steps.map((step, index) => (
              <motion.div
                key={index}
                variants={cardVariants}
                whileHover={{ 
                  x: 10,
                  scale: 1.01,
                  transition: { duration: 0.2 }
                }}
                className="bg-card rounded-2xl p-4 sm:p-6 md:p-8 shadow-lg border border-border hover:shadow-xl transition-shadow duration-300 cursor-pointer"
              >
                <div className="flex flex-col sm:flex-row gap-4 sm:gap-6 items-start">
                  {/* Step Number & Icon */}
                  <div className="flex items-center gap-3 sm:gap-4">
                    <motion.div 
                      className="text-4xl sm:text-5xl font-heading font-bold text-muted-foreground/20"
                      initial={{ opacity: 0, scale: 0.5 }}
                      whileInView={{ opacity: 1, scale: 1 }}
                      viewport={{ once: true }}
                      transition={{ delay: index * 0.1 }}
                    >
                      {step.number}
                    </motion.div>
                    <motion.div 
                      className={`${step.bgColor} w-12 h-12 sm:w-16 sm:h-16 rounded-xl flex items-center justify-center flex-shrink-0`}
                      variants={iconVariants}
                      whileHover={{ 
                        rotate: [0, -10, 10, 0],
                        transition: { duration: 0.4 }
                      }}
                    >
                      <step.icon className={`w-6 h-6 sm:w-8 sm:h-8 ${step.color}`} />
                    </motion.div>
                  </div>

                  {/* Content */}
                  <div className="flex-1">
                    <h3 className="text-lg sm:text-xl md:text-2xl font-heading font-bold text-foreground mb-2 sm:mb-3">
                      Passo {step.number}: {step.title}
                    </h3>
                    <p className="text-sm sm:text-base md:text-lg text-muted-foreground leading-relaxed">
                      {step.description}
                    </p>
                  </div>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default HowItWorks;
