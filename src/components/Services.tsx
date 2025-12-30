import { MonitorSmartphone, Link, Wrench, CheckCircle } from "lucide-react";
import { motion, Variants } from "framer-motion";

const Services = () => {
  const services = [
    {
      icon: MonitorSmartphone,
      title: "Plataformas próprias",
      description: "ConstruData e PersonalRH, para problemas recorrentes de operação e gestão.",
      color: "text-primary",
      bgColor: "bg-primary/10",
    },
    {
      icon: Link,
      title: "Unificação de sistemas",
      description: "Quando a empresa já usa várias ferramentas, mas precisa de tudo em um único lugar.",
      color: "text-accent",
      bgColor: "bg-accent/10",
    },
    {
      icon: Wrench,
      title: "Software sob medida",
      description: "Quando a operação exige algo específico, desenhado a partir do processo real.",
      color: "text-secondary-foreground",
      bgColor: "bg-secondary",
    },
  ];

  const containerVariants: Variants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.2,
        delayChildren: 0.1,
      },
    },
  };

  const cardVariants: Variants = {
    hidden: { 
      opacity: 0, 
      y: 60,
      scale: 0.9,
    },
    visible: {
      opacity: 1,
      y: 0,
      scale: 1,
      transition: {
        type: "spring" as const,
        stiffness: 100,
        damping: 15,
        duration: 0.6,
      },
    },
  };

  const iconVariants: Variants = {
    hidden: { scale: 0, rotate: -180 },
    visible: {
      scale: 1,
      rotate: 0,
      transition: {
        type: "spring" as const,
        stiffness: 200,
        damping: 15,
        delay: 0.2,
      },
    },
  };

  return (
    <section id="services" className="py-20 md:py-32 bg-background overflow-hidden">
      <div className="container mx-auto px-4">
        <div className="max-w-6xl mx-auto">
          {/* Section Header */}
          <motion.div 
            className="text-center mb-16 px-4"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.6, ease: "easeOut" }}
          >
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-heading font-bold text-foreground mb-6">
              Como ajudamos na prática
            </h2>
          </motion.div>

          {/* Services Grid */}
          <motion.div 
            className="grid md:grid-cols-3 gap-6 lg:gap-8"
            variants={containerVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-50px" }}
          >
            {services.map((service, index) => (
              <motion.div
                key={index}
                variants={cardVariants}
                whileHover={{ 
                  y: -12, 
                  scale: 1.02,
                  transition: { duration: 0.3 } 
                }}
                className="bg-card rounded-2xl p-6 lg:p-8 shadow-lg hover:shadow-xl transition-shadow duration-300 border border-border cursor-pointer"
              >
                <motion.div 
                  className={`${service.bgColor} w-14 h-14 sm:w-16 sm:h-16 rounded-xl flex items-center justify-center mb-5`}
                  variants={iconVariants}
                  whileHover={{ 
                    rotate: [0, -10, 10, 0],
                    transition: { duration: 0.5 }
                  }}
                >
                  <service.icon className={`w-7 h-7 sm:w-8 sm:h-8 ${service.color}`} />
                </motion.div>
                <div className="flex items-start gap-2 mb-3">
                  <motion.div
                    initial={{ scale: 0 }}
                    whileInView={{ scale: 1 }}
                    viewport={{ once: true }}
                    transition={{ 
                      type: "spring",
                      stiffness: 300,
                      delay: 0.3 + index * 0.1 
                    }}
                  >
                    <CheckCircle className="w-5 h-5 text-primary mt-1 flex-shrink-0" />
                  </motion.div>
                  <h3 className="text-xl sm:text-2xl font-heading font-bold text-foreground">{service.title}</h3>
                </div>
                <p className="text-base text-muted-foreground leading-relaxed">{service.description}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default Services;
