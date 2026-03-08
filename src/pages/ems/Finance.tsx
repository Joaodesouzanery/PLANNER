import { EMSLayout } from "@/components/ems/EMSLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { motion } from "framer-motion";
import { DollarSign, Target, Wallet, TrendingUp, Calculator, ShoppingCart, BarChart3 } from "lucide-react";
import FinanceDashboard from "@/components/ems/finance/FinanceDashboard";
import FinanceOKRs from "@/components/ems/finance/FinanceOKRs";
import FinanceTransactions from "@/components/ems/finance/FinanceTransactions";
import FinanceProjections from "@/components/ems/finance/FinanceProjections";
import FinanceCalculator from "@/components/ems/finance/FinanceCalculator";
import FinanceSimulator from "@/components/ems/finance/FinanceSimulator";

const Finance = () => {
  return (
    <EMSLayout>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-heading font-bold text-foreground flex items-center gap-2">
            <div className="p-2 rounded-xl bg-primary/10"><DollarSign className="h-6 w-6 text-primary" /></div>
            Finanças & Estratégia
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">Dashboard financeiro detalhado com projeções</p>
        </div>

        <Tabs defaultValue="dashboard" className="space-y-6">
          <TabsList className="grid w-full grid-cols-6 bg-card/80 border border-border/50 rounded-xl p-1">
            <TabsTrigger value="dashboard" className="gap-1.5 rounded-lg data-[state=active]:bg-primary/15 data-[state=active]:text-primary"><BarChart3 className="h-4 w-4" /><span className="hidden sm:inline">Dashboard</span></TabsTrigger>
            <TabsTrigger value="okrs" className="gap-1.5 rounded-lg data-[state=active]:bg-primary/15 data-[state=active]:text-primary"><Target className="h-4 w-4" /><span className="hidden sm:inline">OKRs</span></TabsTrigger>
            <TabsTrigger value="transactions" className="gap-1.5 rounded-lg data-[state=active]:bg-primary/15 data-[state=active]:text-primary"><Wallet className="h-4 w-4" /><span className="hidden sm:inline">Transações</span></TabsTrigger>
            <TabsTrigger value="projections" className="gap-1.5 rounded-lg data-[state=active]:bg-primary/15 data-[state=active]:text-primary"><TrendingUp className="h-4 w-4" /><span className="hidden sm:inline">Projeções</span></TabsTrigger>
            <TabsTrigger value="calculator" className="gap-1.5 rounded-lg data-[state=active]:bg-primary/15 data-[state=active]:text-primary"><Calculator className="h-4 w-4" /><span className="hidden sm:inline">Calculadora</span></TabsTrigger>
            <TabsTrigger value="simulator" className="gap-1.5 rounded-lg data-[state=active]:bg-primary/15 data-[state=active]:text-primary"><ShoppingCart className="h-4 w-4" /><span className="hidden sm:inline">Parcelas</span></TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard"><FinanceDashboard /></TabsContent>
          <TabsContent value="okrs"><FinanceOKRs /></TabsContent>
          <TabsContent value="transactions"><FinanceTransactions /></TabsContent>
          <TabsContent value="projections"><FinanceProjections /></TabsContent>
          <TabsContent value="calculator"><FinanceCalculator /></TabsContent>
          <TabsContent value="simulator"><FinanceSimulator /></TabsContent>
        </Tabs>
      </motion.div>
    </EMSLayout>
  );
};

export default Finance;
