import Header from "@/components/Header";
import Hero from "@/components/Hero";
import SocialProof from "@/components/SocialProof";
import Services from "@/components/Services";
import ProblemSolution from "@/components/ProblemSolution";
import WhyChoose from "@/components/WhyChoose";
import HowItWorks from "@/components/HowItWorks";
import SoftwareExamples from "@/components/SoftwareExamples";
import ClientLogos from "@/components/ClientLogos";
import FAQ from "@/components/FAQ";
import FinalCTA from "@/components/FinalCTA";
import ContactForm from "@/components/ContactForm";
import Footer from "@/components/Footer";

const Index = () => {
  return (
    <div className="min-h-screen">
      <Header />
      <main>
        <Hero />
        <SocialProof />
        <Services />
        <ProblemSolution />
        <WhyChoose />
        <HowItWorks />
        <SoftwareExamples />
        <ClientLogos />
        <FAQ />
        <FinalCTA />
        <ContactForm />
      </main>
      <Footer />
    </div>
  );
};

export default Index;
