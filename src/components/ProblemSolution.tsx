import { motion } from "framer-motion";

const ProblemSolution = () => {
  return (
    <section id="about" className="py-20 md:py-32 bg-muted/30">
      <div className="container mx-auto px-4">
        <div className="max-w-6xl mx-auto">
          {/* Identification Block */}
          <motion.div 
            className="text-center mb-12 px-4"
            initial={{ opacity: 0, y: 40, scale: 0.95 }}
            whileInView={{ opacity: 1, y: 0, scale: 1 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ 
              duration: 0.7, 
              ease: "easeOut",
              type: "spring",
              stiffness: 100
            }}
          >
            <motion.p 
              className="text-lg sm:text-xl md:text-2xl text-muted-foreground leading-relaxed max-w-4xl mx-auto bg-primary/5 border border-primary/20 rounded-2xl p-6 md:p-8"
              whileHover={{ 
                scale: 1.02,
                borderColor: "hsl(var(--primary) / 0.4)",
                transition: { duration: 0.3 }
              }}
            >
              Se sua empresa já usa vários sistemas, planilhas e processos manuais, mas ainda sente falta de{" "}
              <motion.span 
                className="text-primary font-semibold"
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
              >
                clareza
              </motion.span>
              ,{" "}
              <motion.span 
                className="text-primary font-semibold"
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
              >
                controle
              </motion.span>
              {" "}e{" "}
              <motion.span 
                className="text-primary font-semibold"
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                transition={{ delay: 0.7 }}
              >
                padronização
              </motion.span>
              {" "}— é aqui que entramos.
            </motion.p>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default ProblemSolution;
