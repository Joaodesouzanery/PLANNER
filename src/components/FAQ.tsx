import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { motion, Variants } from "framer-motion";

const FAQ = () => {
  const faqs = [
    {
      question: "Qual o custo dos serviços da TheHiveTech?",
      answer:
        "Nosso investimento é focado em ROI (Retorno sobre Investimento). Começamos com uma Análise Estratégica Gratuita para identificar o ponto de otimização de maior impacto. Você só investe no desenvolvimento depois que apresentarmos a projeção de resultados e o plano de implementação completo.",
    },
    {
      question: "Quanto tempo leva para implementar uma solução?",
      answer:
        "Com foco em MVP (Produto Mínimo Viável), entregamos a primeira versão funcional em semanas, não meses. O prazo exato depende da complexidade do problema identificado, mas garantimos agilidade sem comprometer a qualidade.",
    },
    {
      question: "A TheHiveTech é um ERP ou sistema all-in-one?",
      answer:
        "Não. Somos o oposto de sistemas genéricos. Criamos Software Sob Medida (MVP) focado em resolver um problema específico do seu negócio, e implementamos Soluções com IA para otimizar processos pontuais. Complementamos ou substituímos módulos ineficientes de sistemas maiores.",
    },
    {
      question: "Como funciona a Análise Estratégica?",
      answer:
        "Em 30 minutos de reunião, mapeamos seus processos, identificamos gargalos críticos e apresentamos oportunidades de otimização com IA e software focado. É 100% gratuito e sem compromisso. Ao final, você terá clareza sobre como podemos gerar impacto no seu resultado.",
    },
    {
      question: "Que tipos de problemas vocês resolvem?",
      answer:
        "Resolvemos problemas operacionais que geram ineficiência: processos manuais repetitivos, falta de integração entre sistemas, ausência de automação inteligente, controles em planilhas complexas, e qualquer gargalo que está impedindo sua empresa de escalar.",
    },
    {
      question: "Vocês oferecem suporte após a implementação?",
      answer:
        "Sim! Oferecemos acompanhamento contínuo com alinhamentos semanais para garantir que a solução esteja sempre evoluindo e entregando máxima eficiência. Seu sucesso é nossa métrica, e mantemos uma parceria de longo prazo.",
    },
    {
      question: "Preciso ter conhecimento técnico para usar as soluções?",
      answer:
        "Não! Desenvolvemos soluções pensadas para o seu fluxo de trabalho atual. Fornecemos treinamento completo para sua equipe e garantimos que a interface seja intuitiva. A tecnologia trabalha para você, não o contrário.",
    },
    {
      question: "Quais tecnologias vocês utilizam?",
      answer:
        "Utilizamos tecnologias modernas e escaláveis, incluindo Inteligência Artificial para automação, linguagens como Python e JavaScript, cloud computing para garantir disponibilidade, e frameworks ágeis. A escolha da stack é baseada no que resolve melhor o seu problema.",
    },
  ];

  const containerVariants: Variants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
      },
    },
  };

  const itemVariants: Variants = {
    hidden: { 
      opacity: 0, 
      y: 20,
    },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        type: "spring" as const,
        stiffness: 100,
        damping: 15,
      },
    },
  };

  return (
    <section className="py-20 md:py-32 bg-background overflow-hidden">
      <div className="container mx-auto px-4">
        <div className="max-w-4xl mx-auto">
          {/* Section Header */}
          <motion.div 
            className="text-center mb-12 px-4"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.6 }}
          >
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-heading font-bold text-foreground mb-6">
              Perguntas Frequentes
            </h2>
            <p className="text-lg sm:text-xl text-muted-foreground">
              Suas Dúvidas, Nossas Respostas
            </p>
          </motion.div>

          {/* FAQ Accordion */}
          <motion.div
            variants={containerVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-50px" }}
          >
            <Accordion type="single" collapsible className="space-y-4">
              {faqs.map((faq, index) => (
                <motion.div key={index} variants={itemVariants}>
                  <AccordionItem
                    value={`item-${index}`}
                    className="bg-card border border-border rounded-xl px-6 shadow-md hover:shadow-lg transition-shadow"
                  >
                    <AccordionTrigger className="text-left font-semibold text-foreground hover:text-primary py-6">
                      {faq.question}
                    </AccordionTrigger>
                    <AccordionContent className="text-muted-foreground pb-6 leading-relaxed">
                      {faq.answer}
                    </AccordionContent>
                  </AccordionItem>
                </motion.div>
              ))}
            </Accordion>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default FAQ;
