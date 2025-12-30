import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Building, Users, Shield, ExternalLink, CheckCircle, PlayCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";

const SoftwareExamples = () => {
  const [activeTab, setActiveTab] = useState(0);
  const navigate = useNavigate();

  const softwares = [
    {
      icon: Building,
      title: "ConstruData",
      subtitle: "Resolve o Problema de Gestão de Obras",
      problem: "Obras desorganizadas, falta de controle de produção, materiais perdidos, equipe sem direcionamento claro, retrabalho constante.",
      solution:
        "Um software que centraliza toda a gestão operacional da obra em um único lugar.",
      features: [
        "Gestão de Projetos: Controle completo de obras com status e acompanhamento em tempo real",
        "Controle de Produção Avançado: Metas diárias, semanais e mensais com análise instantânea e gráficos de desempenho",
        "RDO Digital com GPS: Relatórios detalhados com fotos, clima e validação por localização",
        "Sistema de Pedidos de Material: Requisições com rastreamento completo e controle de status",
        "Controle Inteligente de Material: Comparação automática entre requisições e consumo real",
        "Gestão Completa de Equipe: Cadastro de funcionários, perfis de acesso e controle de permissões",
        "Alertas Inteligentes: Notificações automáticas com obrigatoriedade de justificativas para desvios",
        "Dashboard Analítico: Visão consolidada de todos os indicadores da obra",
        "Relatórios Customizáveis: Geração de relatórios personalizados por período e projeto",
      ],
      result:
        "Aumento de produtividade, redução de custos, melhor controle operacional, equipe mais organizada, retrabalho eliminado.",
      status: "live",
      link: "https://construdata.software",
      color: "text-primary",
      bgColor: "bg-primary/10",
    },
    {
      icon: Users,
      title: "Personal RH",
      subtitle: "Resolve o Problema de Gestão de Pessoal",
      problem:
        "Gestão de pessoal manual, folha de pagamento complexa, falta de visibilidade sobre desempenho, documentação desorganizada, erros administrativos.",
      solution:
        "Um software que centraliza toda a gestão de recursos humanos.",
      features: [
        "Gestão de pessoal e dados de funcionários",
        "Folha de pagamento automatizada",
        "Controle de ponto e frequência",
        "Avaliações de desempenho",
        "Documentação digital segura",
        "Relatórios de RH",
      ],
      result:
        "Redução de tempo administrativo, melhor controle de custos, dados de pessoal organizados, decisões mais informadas, erros eliminados.",
      status: "live",
      link: "https://personalrh.lovable.app",
      color: "text-secondary",
      bgColor: "bg-secondary/10",
    },
    {
      icon: Shield,
      title: "Sistema de Segurança Digital",
      subtitle: "Resolve o Problema de Segurança",
      problem:
        "Falta de visibilidade sobre acessos, riscos de segurança, auditoria manual e complexa, dados vulneráveis, conformidade incerta.",
      solution:
        "Um software que monitora, controla e auditoria todos os acessos digitais.",
      features: [
        "Monitoramento de acessos em tempo real",
        "Gestão de permissões por perfil",
        "Auditoria completa de atividades",
        "Alertas de segurança automáticos",
        "Relatórios de conformidade",
        "Backup e recuperação de dados",
      ],
      result:
        "Empresa mais segura, conformidade garantida, riscos reduzidos, equipe protegida, dados seguros.",
      status: "development",
      color: "text-accent",
      bgColor: "bg-accent/10",
    },
  ];

  const activeSoftware = softwares[activeTab];

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, x: -20 },
    visible: {
      opacity: 1,
      x: 0,
      transition: {
        type: "spring" as const,
        stiffness: 100,
        damping: 15,
      },
    },
  };

  return (
    <section className="py-20 md:py-32 bg-muted/30 overflow-hidden">
      <div className="container mx-auto px-4">
        <div className="max-w-6xl mx-auto">
          {/* Section Header */}
          <motion.div 
            className="text-center mb-12 px-4"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.6 }}
          >
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-heading font-bold text-foreground mb-6">
              Exemplos de Softwares
            </h2>
            <p className="text-lg sm:text-xl text-muted-foreground">
              Cada Um Resolve Um Problema
            </p>
          </motion.div>

          {/* Tabs */}
          <motion.div 
            className="flex flex-wrap justify-center gap-2 sm:gap-4 mb-12 px-4"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            {softwares.map((software, index) => (
              <motion.button
                key={index}
                onClick={() => setActiveTab(index)}
                className={`flex items-center gap-2 px-3 sm:px-4 md:px-6 py-2 sm:py-3 rounded-xl font-medium transition-all duration-300 text-xs sm:text-sm ${
                  activeTab === index
                    ? `${software.bgColor} ${software.color} shadow-lg scale-105`
                    : "bg-card text-muted-foreground hover:bg-muted"
                }`}
                whileHover={{ scale: activeTab === index ? 1.05 : 1.08 }}
                whileTap={{ scale: 0.95 }}
              >
                <software.icon className="w-4 h-4 sm:w-5 sm:h-5" />
                <span className="text-xs sm:text-sm">{software.title}</span>
              </motion.button>
            ))}
          </motion.div>

          {/* Active Software Content */}
          <AnimatePresence mode="wait">
            <motion.div 
              key={activeTab}
              className="bg-card rounded-2xl shadow-xl border border-border overflow-hidden"
              initial={{ opacity: 0, y: 30, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.98 }}
              transition={{ duration: 0.4, ease: "easeOut" }}
            >
              <motion.div 
                className={`${activeSoftware.bgColor} p-4 sm:p-6 md:p-8`}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.1 }}
              >
                <div className="flex flex-col sm:flex-row items-start justify-between gap-4 mb-4">
                  <div className="flex items-center gap-3 sm:gap-4 w-full sm:w-auto">
                    <motion.div 
                      className={`${activeSoftware.color}`}
                      initial={{ scale: 0, rotate: -180 }}
                      animate={{ scale: 1, rotate: 0 }}
                      transition={{ type: "spring", stiffness: 200, damping: 15 }}
                    >
                      <activeSoftware.icon className="w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12" />
                    </motion.div>
                    <div className="flex-1">
                      <h3 className="text-xl sm:text-2xl md:text-3xl font-heading font-bold text-foreground">
                        {activeSoftware.title}
                      </h3>
                      <p className="text-xs sm:text-sm text-muted-foreground">{activeSoftware.subtitle}</p>
                    </div>
                  </div>
                  <motion.span 
                    className={activeSoftware.status === "live" 
                      ? "bg-secondary text-secondary-foreground px-4 py-2 rounded-full text-sm font-semibold"
                      : "bg-muted text-muted-foreground px-4 py-2 rounded-full text-sm font-semibold"
                    }
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.2 }}
                  >
                    {activeSoftware.status === "live" ? "Disponível" : "Em Desenvolvimento"}
                  </motion.span>
                </div>
              </motion.div>

              <div className="p-4 sm:p-6 md:p-8 space-y-6 sm:space-y-8">
                {/* Problem */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.15 }}
                >
                  <h4 className="text-lg sm:text-xl font-heading font-bold text-foreground mb-3">
                    O Problema
                  </h4>
                  <p className="text-muted-foreground leading-relaxed">
                    {activeSoftware.problem}
                  </p>
                </motion.div>

                {/* Solution */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.25 }}
                >
                  <h4 className="text-xl font-heading font-bold text-foreground mb-3">
                    A Solução
                  </h4>
                  <p className="text-muted-foreground leading-relaxed mb-4">
                    {activeSoftware.solution}
                  </p>
                  <motion.div 
                    className="grid sm:grid-cols-2 gap-3"
                    variants={containerVariants}
                    initial="hidden"
                    animate="visible"
                  >
                    {activeSoftware.features.map((feature, index) => (
                      <motion.div 
                        key={index} 
                        className="flex items-center gap-2"
                        variants={itemVariants}
                      >
                        <CheckCircle className={`w-5 h-5 ${activeSoftware.color} flex-shrink-0`} />
                        <span className="text-sm text-foreground">{feature}</span>
                      </motion.div>
                    ))}
                  </motion.div>
                </motion.div>

                {/* Result */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.35 }}
                >
                  <h4 className="text-xl font-heading font-bold text-foreground mb-3">
                    Resultado
                  </h4>
                  <p className="text-muted-foreground leading-relaxed">
                    {activeSoftware.result}
                  </p>
                </motion.div>

                {/* CTA */}
                <motion.div 
                  className="pt-4 border-t border-border flex flex-col sm:flex-row gap-4"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.45 }}
                >
                  <Button
                    variant="default"
                    size="lg"
                    onClick={() => navigate('/demonstracao')}
                    className="group"
                  >
                    Ver Demonstração
                    <PlayCircle className="w-4 h-4 group-hover:scale-110 transition-transform" />
                  </Button>
                  {activeSoftware.status === "live" && (
                    <Button
                      variant="outline"
                      size="lg"
                      onClick={() => window.open(activeSoftware.link, "_blank")}
                      className="group"
                    >
                      Ver {activeSoftware.title} ao Vivo
                      <ExternalLink className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                    </Button>
                  )}
                </motion.div>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </section>
  );
};

export default SoftwareExamples;
