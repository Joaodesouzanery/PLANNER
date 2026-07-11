import { EMSLayout } from "@/components/ems/EMSLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { motion } from "framer-motion";
import { Activity, BarChart3, Calculator, CalendarDays, DollarSign, GitCompare, Landmark, Plane, ShoppingCart, Table2, Target, TrendingUp, Wallet } from "lucide-react";
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
import FinanceBrenoView from "@/components/ems/finance/FinanceBrenoView";
import FinanceTravel from "@/components/ems/finance/travel/FinanceTravel";
import FinanceScenarios from "@/components/ems/finance/FinanceScenarios";
import { FinancePatrimonio } from "@/components/ems/finance/FinancePatrimonio";

const outerTab = "gap-1.5 rounded-lg data-[state=active]:bg-primary/15 data-[state=active]:text-primary";
const innerTab = "gap-1.5 rounded-md text-xs data-[state=active]:bg-primary/10 data-[state=active]:text-primary";

const Finance = () => {
  return (
    <EMSLayout>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-heading font-bold text-foreground flex items-center gap-2">
            <div className="p-2 rounded-xl bg-primary/10"><DollarSign className="h-6 w-6 text-primary" /></div>
            Financas & Estrategia
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">Uma fonte única: tudo — real, previsto, recorrente e simulado — deriva das mesmas contas.</p>
        </div>

        {/* 5 grupos (consolidado de 13 abas). Cada grupo agrupa as telas em sub-abas, sem perder nada. */}
        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 bg-card/80 border border-border/50 rounded-xl p-1 h-auto">
            <TabsTrigger value="overview" className={outerTab}><BarChart3 className="h-4 w-4" /><span className="hidden sm:inline">Visão Geral</span></TabsTrigger>
            <TabsTrigger value="transactions" className={outerTab}><Wallet className="h-4 w-4" /><span className="hidden sm:inline">Transações</span></TabsTrigger>
            <TabsTrigger value="future" className={outerTab}><Activity className="h-4 w-4" /><span className="hidden sm:inline">Futuro & Cenários</span></TabsTrigger>
            <TabsTrigger value="simulators" className={outerTab}><Calculator className="h-4 w-4" /><span className="hidden sm:inline">Simuladores</span></TabsTrigger>
            <TabsTrigger value="goals" className={outerTab}><Target className="h-4 w-4" /><span className="hidden sm:inline">Metas & Patrimônio</span></TabsTrigger>
          </TabsList>

          {/* 1. Visão Geral (Dashboard + Painel CFO já embutido) */}
          <TabsContent value="overview"><FinanceDashboard /></TabsContent>

          {/* 2. Transações — a fonte da verdade */}
          <TabsContent value="transactions"><FinanceTransactions /></TabsContent>

          {/* 3. Futuro & Cenários */}
          <TabsContent value="future">
            <Tabs defaultValue="planilha" className="space-y-4">
              <TabsList className="flex flex-wrap h-auto bg-card/60 border border-border/50 rounded-lg p-1">
                <TabsTrigger value="planilha" className={innerTab}><Table2 className="h-3.5 w-3.5" />Planilha</TabsTrigger>
                <TabsTrigger value="future-flow" className={innerTab}><Activity className="h-3.5 w-3.5" />Fluxo Futuro</TabsTrigger>
                <TabsTrigger value="projections" className={innerTab}><TrendingUp className="h-3.5 w-3.5" />Projeções</TabsTrigger>
                <TabsTrigger value="scenarios" className={innerTab}><GitCompare className="h-3.5 w-3.5" />Cenários</TabsTrigger>
                <TabsTrigger value="planned" className={innerTab}><TrendingUp className="h-3.5 w-3.5" />Previstos</TabsTrigger>
              </TabsList>
              <TabsContent value="planilha"><FinanceBrenoView /></TabsContent>
              <TabsContent value="future-flow"><FinanceFutureFlow /></TabsContent>
              <TabsContent value="projections" className="space-y-6"><FinanceProjections /></TabsContent>
              <TabsContent value="scenarios"><FinanceScenarios /></TabsContent>
              <TabsContent value="planned"><FinancePlannedImpacts /></TabsContent>
            </Tabs>
          </TabsContent>

          {/* 4. Simuladores — "e se eu gastar X?" (todos com Adicionar ao fluxo) */}
          <TabsContent value="simulators">
            <Tabs defaultValue="calculator" className="space-y-4">
              <TabsList className="flex flex-wrap h-auto bg-card/60 border border-border/50 rounded-lg p-1">
                <TabsTrigger value="calculator" className={innerTab}><Calculator className="h-3.5 w-3.5" />Calculadora</TabsTrigger>
                <TabsTrigger value="simulator" className={innerTab}><ShoppingCart className="h-3.5 w-3.5" />Parcelas</TabsTrigger>
                <TabsTrigger value="purchase" className={innerTab}><ShoppingCart className="h-3.5 w-3.5" />Compra à vista×parcelada</TabsTrigger>
                <TabsTrigger value="travel" className={innerTab}><Plane className="h-3.5 w-3.5" />Viagem</TabsTrigger>
              </TabsList>
              <TabsContent value="calculator"><FinanceCalculator /></TabsContent>
              <TabsContent value="simulator"><FinanceSimulator /></TabsContent>
              <TabsContent value="purchase"><PurchaseImpactCalculator /></TabsContent>
              <TabsContent value="travel"><FinanceTravel /></TabsContent>
            </Tabs>
          </TabsContent>

          {/* 5. Metas & Patrimônio */}
          <TabsContent value="goals">
            <Tabs defaultValue="patrimonio" className="space-y-4">
              <TabsList className="flex flex-wrap h-auto bg-card/60 border border-border/50 rounded-lg p-1">
                <TabsTrigger value="patrimonio" className={innerTab}><Landmark className="h-3.5 w-3.5" />Patrimônio</TabsTrigger>
                <TabsTrigger value="metas" className={innerTab}><Target className="h-3.5 w-3.5" />Metas</TabsTrigger>
                <TabsTrigger value="okrs" className={innerTab}><Target className="h-3.5 w-3.5" />OKRs</TabsTrigger>
                <TabsTrigger value="monthly-planning" className={innerTab}><CalendarDays className="h-3.5 w-3.5" />Planejamento</TabsTrigger>
              </TabsList>
              <TabsContent value="patrimonio"><FinancePatrimonio /></TabsContent>
              <TabsContent value="metas"><FinanceMetas /></TabsContent>
              <TabsContent value="okrs"><FinanceOKRs /></TabsContent>
              <TabsContent value="monthly-planning"><FinanceMonthlyPlanning /></TabsContent>
            </Tabs>
          </TabsContent>
        </Tabs>
      </motion.div>
    </EMSLayout>
  );
};

export default Finance;
