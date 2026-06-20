import { useSearchParams } from "react-router-dom";
import {
  AlertTriangle, Archive, BookOpen, CalendarClock, Compass, FileText,
  Gavel, LayoutDashboard, ListChecks, Scale, ShieldCheck, Users, Wrench,
} from "lucide-react";
import { EMSLayout } from "@/components/ems/EMSLayout";
import { RotinasPanel } from "@/components/ems/rotinas/RotinasPanel";
import { AutomationRulesPanel } from "@/components/ems/AutomationRulesPanel";
import { DocumentLibrary } from "@/components/ems/DocumentLibrary";
import { BoardHealthScoreBar } from "@/components/ems/conselho/BoardHealthScoreBar";
import { BoardCockpitPanel } from "@/components/ems/conselho/BoardCockpitPanel";
import { RiskMatrixPanel } from "@/components/ems/conselho/RiskMatrixPanel";
import { ObligationsCalendarPanel } from "@/components/ems/conselho/ObligationsCalendarPanel";
import { StackBackupPanel } from "@/components/ems/conselho/StackBackupPanel";
import { StrategyMemoryPanel } from "@/components/ems/conselho/StrategyMemoryPanel";
import { DecisionsTimelinePanel } from "@/components/ems/conselho/DecisionsTimelinePanel";
import { MeetingsPanel } from "@/components/ems/conselho/MeetingsPanel";
import { BoardDomainPanel } from "@/components/ems/conselho/BoardDomainPanel";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const TABS = [
  { id: "cockpit", label: "Visão 360", icon: LayoutDashboard },
  { id: "rotinas", label: "Rotinas", icon: ListChecks },
  { id: "risks", label: "Riscos", icon: AlertTriangle },
  { id: "obligations", label: "Obrigações", icon: CalendarClock },
  { id: "stack", label: "Backup & Stack", icon: Archive },
  { id: "strategy", label: "Estratégia", icon: Compass },
  { id: "decisions", label: "Memória", icon: Scale },
  { id: "legal", label: "Jurídico", icon: Gavel },
  { id: "accounting", label: "Contábil", icon: BookOpen },
  { id: "documents", label: "Documentos", icon: FileText },
  { id: "automation", label: "Automação", icon: Wrench },
  { id: "meetings", label: "Reuniões", icon: Users },
];
const VALID = new Set(TABS.map((t) => t.id));
// Compat com links antigos por categoria do governance_items.
const LEGACY_MAP: Record<string, string> = {
  optimization: "legal", marketing: "legal", crisis: "legal", admin: "accounting",
  stack_backup: "stack", monthly_review: "meetings",
};

const BoardCouncil = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const raw = searchParams.get("tab") || "cockpit";
  const tab = VALID.has(raw) ? raw : (LEGACY_MAP[raw] || "cockpit");
  const setTab = (value: string) => setSearchParams({ tab: value }, { replace: true });

  return (
    <EMSLayout>
      <div className="space-y-5">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <ShieldCheck className="h-6 w-6 text-primary" /> Conselho de Administração
          </h1>
          <p className="text-sm text-muted-foreground">Visão 360 do negócio: governança, riscos, obrigações, estratégia, memória executiva, contabilidade, stack e backup.</p>
        </div>

        <BoardHealthScoreBar />

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="grid w-full grid-cols-2 md:grid-cols-4 xl:grid-cols-6 h-auto">
            {TABS.map((t) => (
              <TabsTrigger key={t.id} value={t.id} className="gap-1.5">
                <t.icon className="h-3.5 w-3.5" />
                <span className="truncate">{t.label}</span>
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="cockpit" className="mt-4"><BoardCockpitPanel onNavigate={setTab} /></TabsContent>
          <TabsContent value="rotinas" className="mt-4"><RotinasPanel /></TabsContent>
          <TabsContent value="risks" className="mt-4"><RiskMatrixPanel /></TabsContent>
          <TabsContent value="obligations" className="mt-4"><ObligationsCalendarPanel /></TabsContent>
          <TabsContent value="stack" className="mt-4"><StackBackupPanel /></TabsContent>
          <TabsContent value="strategy" className="mt-4"><StrategyMemoryPanel /></TabsContent>
          <TabsContent value="decisions" className="mt-4"><DecisionsTimelinePanel /></TabsContent>
          <TabsContent value="legal" className="mt-4"><BoardDomainPanel category="legal" /></TabsContent>
          <TabsContent value="accounting" className="mt-4"><BoardDomainPanel category="accounting" /></TabsContent>
          <TabsContent value="documents" className="mt-4"><DocumentLibrary /></TabsContent>
          <TabsContent value="automation" className="mt-4"><AutomationRulesPanel /></TabsContent>
          <TabsContent value="meetings" className="mt-4"><MeetingsPanel /></TabsContent>
        </Tabs>
      </div>
    </EMSLayout>
  );
};

export default BoardCouncil;
