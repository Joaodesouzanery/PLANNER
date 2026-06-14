import { EMSLayout } from "@/components/ems/EMSLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { motion } from "framer-motion";
import { Activity, BarChart3, Calculator, CalendarDays, DollarSign, ShoppingCart, Target, TrendingUp, Wallet } from "lucide-react";
import FinanceDashboard from "@/components/ems/finance/FinanceDashboard";
import FinanceOKRs from "@/components/ems/finance/FinanceOKRs";
import FinanceTransactions from "@/components/ems/finance/FinanceTransactions";
import FinanceMonthlyPlanning from "@/components/ems/finance/FinanceMonthlyPlanning";
import FinanceProjections from "@/components/ems/finance/FinanceProjections";
import FinanceCalculator from "@/components/ems/finance/FinanceCalculator";
import FinanceSimulator from "@/components/ems/finance/FinanceSimulator";
import FinanceMetas from "@/components/ems/finance/FinanceMetas";
import FinancePlannedImpacts from "@/components/ems/finance/FinancePlannedImpacts";
import PurchaseImpactCalculator from "@/components/ems/finance/PurchaseImpactCalculator";
import FinanceFutureFlow from "@/components/ems/finance/FinanceFutureFlow";

const Finance = () => {
  return (
    <EMSLayout>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-heading font-bold text-foreground flex items-center gap-2">
            <div className="p-2 rounded-xl bg-primary/10"><DollarSign className="h-6 w-6 text-primary" /></div>
            Financas & Estrategia
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">Dashboard financeiro detalhado com planejamento mensal e projecoes</p>
        </div>

        <Tabs defaultValue="dashboard" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3 md:grid-cols-5 xl:grid-cols-10 bg-card/80 border border-border/50 rounded-xl p-1 h-auto">
            <TabsTrigger value="dashboard" className="gap-1.5 rounded-lg data-[state=active]:bg-primary/15 data-[state=active]:text-primary"><BarChart3 className="h-4 w-4" /><span className="hidden sm:inline">Dashboard</span></TabsTrigger>
            <TabsTrigger value="future-flow" className="gap-1.5 rounded-lg data-[state=active]:bg-primary/15 data-[state=active]:text-primary"><Activity className="h-4 w-4" /><span className="hidden sm:inline">Fluxo Futuro</span></TabsTrigger>
            <TabsTrigger value="okrs" className="gap-1.5 rounded-lg data-[state=active]:bg-primary/15 data-[state=active]:text-primary"><Target className="h-4 w-4" /><span className="hidden sm:inline">OKRs</span></TabsTrigger>
            <TabsTrigger value="transactions" className="gap-1.5 rounded-lg data-[state=active]:bg-primary/15 data-[state=active]:text-primary"><Wallet className="h-4 w-4" /><span className="hidden sm:inline">Transacoes</span></TabsTrigger>
            <TabsTrigger value="monthly-planning" className="gap-1.5 rounded-lg data-[state=active]:bg-primary/15 data-[state=active]:text-primary"><CalendarDays className="h-4 w-4" /><span className="hidden sm:inline">Planejamento</span></TabsTrigger>
            <TabsTrigger value="projections" className="gap-1.5 rounded-lg data-[state=active]:bg-primary/15 data-[state=active]:text-primary"><TrendingUp className="h-4 w-4" /><span className="hidden sm:inline">Projecoes</span></TabsTrigger>
            <TabsTrigger value="calculator" className="gap-1.5 rounded-lg data-[state=active]:bg-primary/15 data-[state=active]:text-primary"><Calculator className="h-4 w-4" /><span className="hidden sm:inline">Calculadora</span></TabsTrigger>
            <TabsTrigger value="simulator" className="gap-1.5 rounded-lg data-[state=active]:bg-primary/15 data-[state=active]:text-primary"><ShoppingCart className="h-4 w-4" /><span className="hidden sm:inline">Parcelas</span></TabsTrigger>
            <TabsTrigger value="metas" className="gap-1.5 rounded-lg data-[state=active]:bg-primary/15 data-[state=active]:text-primary"><Target className="h-4 w-4" /><span className="hidden sm:inline">Metas</span></TabsTrigger>
            <TabsTrigger value="planned" className="gap-1.5 rounded-lg data-[state=active]:bg-primary/15 data-[state=active]:text-primary"><TrendingUp className="h-4 w-4" /><span className="hidden sm:inline">Previstos</span></TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard"><FinanceDashboard /></TabsContent>
          <TabsContent value="future-flow"><FinanceFutureFlow /></TabsContent>
          <TabsContent value="okrs"><FinanceOKRs /></TabsContent>
          <TabsContent value="transactions"><FinanceTransactions /></TabsContent>
          <TabsContent value="monthly-planning"><FinanceMonthlyPlanning /></TabsContent>
          <TabsContent value="projections" className="space-y-6"><FinanceProjections /><PurchaseImpactCalculator /></TabsContent>
          <TabsContent value="calculator"><FinanceCalculator /></TabsContent>
          <TabsContent value="simulator"><FinanceSimulator /></TabsContent>
          <TabsContent value="metas"><FinanceMetas /></TabsContent>
          <TabsContent value="planned"><FinancePlannedImpacts /></TabsContent>
        </Tabs>
      </motion.div>
    </EMSLayout>
  );
};

export default Finance;
