import { lazy, Suspense } from "react";
import { useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { BrainCircuit, Heart, StickyNote } from "lucide-react";
import { EMSLayout } from "@/components/ems/EMSLayout";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

// Módulo "Pessoal" — junta Persuasão, Gratidão e Notas/Knowledge em abas (cada página
// renderizada via prop `embedded`, sem duplicar o EMSLayout). Deep-links antigos redirecionam
// pra /ems/pessoal?tab=… (ver App.tsx).
const Persuasion = lazy(() => import("./Persuasion"));
const Gratitude = lazy(() => import("./Gratitude"));
const QuickNotes = lazy(() => import("./QuickNotes"));

const Fallback = () => <div className="p-8 text-center text-sm text-muted-foreground">Carregando…</div>;
const trig = "rounded-lg gap-1.5 data-[state=active]:bg-primary/15 data-[state=active]:text-primary";

const Pessoal = () => {
  const [params, setParams] = useSearchParams();
  const tab = params.get("tab") || "persuasao";
  const setTab = (v: string) =>
    setParams((p) => { const n = new URLSearchParams(p); if (v === "persuasao") n.delete("tab"); else n.set("tab", v); return n; }, { replace: true });

  return (
    <EMSLayout>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-heading font-bold flex items-center gap-2">
            <div className="p-2 rounded-xl bg-primary/10"><StickyNote className="h-6 w-6 text-primary" /></div>
            Pessoal
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">Persuasão, gratidão e suas notas/knowledge num lugar só.</p>
        </div>

        <Tabs value={tab} onValueChange={setTab} className="space-y-4">
          <TabsList className="bg-card/80 border border-border/50 rounded-xl">
            <TabsTrigger value="persuasao" className={trig}><BrainCircuit className="h-4 w-4" />Persuasão</TabsTrigger>
            <TabsTrigger value="gratidao" className={trig}><Heart className="h-4 w-4" />Gratidão</TabsTrigger>
            <TabsTrigger value="notas" className={trig}><StickyNote className="h-4 w-4" />Notas & Knowledge</TabsTrigger>
          </TabsList>
          <TabsContent value="persuasao" className="mt-0"><Suspense fallback={<Fallback />}><Persuasion embedded /></Suspense></TabsContent>
          <TabsContent value="gratidao" className="mt-0"><Suspense fallback={<Fallback />}><Gratitude embedded /></Suspense></TabsContent>
          <TabsContent value="notas" className="mt-0"><Suspense fallback={<Fallback />}><QuickNotes embedded /></Suspense></TabsContent>
        </Tabs>
      </motion.div>
    </EMSLayout>
  );
};

export default Pessoal;
