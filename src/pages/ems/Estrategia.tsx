import { useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { Compass, Sparkles, CalendarClock, Building2 } from "lucide-react";
import { EMSLayout } from "@/components/ems/EMSLayout";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import EstrategiaCascade from "@/components/ems/estrategia/EstrategiaCascade";
import EstrategiaCiclos from "@/components/ems/estrategia/EstrategiaCiclos";
import EstrategiaEmpresa from "@/components/ems/estrategia/EstrategiaEmpresa";

// Módulo Estratégia — cockpit próprio da estratégia. Puxa o que já vive nos outros módulos
// (as métricas financeiras reais, DRE/orçamento/fluxo do Finanças) e adiciona o que é dele:
// a cascata BHAG→Objetivo→KR→Ação e os ciclos de revisão.
const trig = "rounded-lg gap-1.5 data-[state=active]:bg-primary/15 data-[state=active]:text-primary";

const Estrategia = () => {
  const [params, setParams] = useSearchParams();
  const tab = params.get("tab") || "cascata";
  const setTab = (v: string) =>
    setParams((p) => { const n = new URLSearchParams(p); if (v === "cascata") n.delete("tab"); else n.set("tab", v); return n; }, { replace: true });

  return (
    <EMSLayout>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-5">
        <div>
          <h1 className="text-2xl md:text-3xl font-heading font-bold flex items-center gap-2">
            <div className="p-2 rounded-xl bg-primary/10"><Compass className="h-6 w-6 text-primary" /></div>
            Estratégia
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">Do sonho grande (BHAG) até a ação de 15 dias — com progresso calculado do dado real dos outros módulos.</p>
        </div>

        <Tabs value={tab} onValueChange={setTab} className="space-y-4">
          <TabsList className="bg-card/80 border border-border/50 rounded-xl">
            <TabsTrigger value="cascata" className={trig}><Sparkles className="h-4 w-4" />Cascata</TabsTrigger>
            <TabsTrigger value="ciclos" className={trig}><CalendarClock className="h-4 w-4" />Ciclos</TabsTrigger>
            <TabsTrigger value="empresa" className={trig}><Building2 className="h-4 w-4" />Empresa</TabsTrigger>
          </TabsList>
          <TabsContent value="cascata" className="mt-0"><EstrategiaCascade /></TabsContent>
          <TabsContent value="ciclos" className="mt-0"><EstrategiaCiclos /></TabsContent>
          <TabsContent value="empresa" className="mt-0"><EstrategiaEmpresa /></TabsContent>
        </Tabs>
      </motion.div>
    </EMSLayout>
  );
};

export default Estrategia;
