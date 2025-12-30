import rerLogo from "@/assets/clients/rer-engenharia.jpg";
import luisaLogo from "@/assets/clients/luisa-souto.png";
import reveillonLogo from "@/assets/clients/reveillon-no-lago.png";
import catalisaLogo from "@/assets/clients/catalisa.jpg";
import zadaLogo from "@/assets/clients/zada.jpg";
import { motion } from "framer-motion";

const ClientLogos = () => {
  const clients = [
    { name: "R&R Engenharia", logo: rerLogo },
    { name: "Luisa Souto", logo: luisaLogo },
    { name: "Reveillon no Lago", logo: reveillonLogo },
    { name: "Catalisa", logo: catalisaLogo },
    { name: "Zada", logo: zadaLogo },
  ];

  return (
    <section className="py-16 md:py-24 bg-muted/30 overflow-hidden">
      <div className="container mx-auto px-4">
        <div className="max-w-6xl mx-auto">
          {/* Section Header */}
          <motion.div 
            className="text-center mb-12"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.6 }}
          >
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-heading font-bold text-foreground mb-4">
              Quem Confia na TheHiveTech
            </h2>
            <p className="text-base sm:text-lg text-muted-foreground">
              Empresas que escolheram otimização sobre complexidade
            </p>
          </motion.div>

          {/* Logos Carousel */}
          <motion.div 
            className="relative overflow-hidden"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            <div className="flex animate-scroll">
              {/* First set of logos */}
              {clients.map((client, index) => (
                <motion.div
                  key={`first-${index}`}
                  className="flex-shrink-0 w-48 h-32 mx-8 flex items-center justify-center grayscale hover:grayscale-0 transition-all duration-300"
                  initial={{ opacity: 0, scale: 0.8 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.1, duration: 0.4 }}
                  whileHover={{ scale: 1.1 }}
                >
                  <img
                    src={client.logo}
                    alt={client.name}
                    className="max-w-full max-h-full object-contain"
                  />
                </motion.div>
              ))}
              {/* Duplicate set for seamless loop */}
              {clients.map((client, index) => (
                <motion.div
                  key={`second-${index}`}
                  className="flex-shrink-0 w-48 h-32 mx-8 flex items-center justify-center grayscale hover:grayscale-0 transition-all duration-300"
                  whileHover={{ scale: 1.1 }}
                >
                  <img
                    src={client.logo}
                    alt={client.name}
                    className="max-w-full max-h-full object-contain"
                  />
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default ClientLogos;
