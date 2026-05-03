import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider } from "@/components/ems/ThemeProvider";
import { CompanyProvider } from "@/contexts/CompanyContext";
import { ProtectedEMSRoute } from "@/components/ems/ProtectedEMSRoute";
import { Skeleton } from "@/components/ui/skeleton";

// Lazy-loaded EMS Pages
const Overview = lazy(() => import("./pages/ems/Overview"));
const Companies = lazy(() => import("./pages/ems/Companies"));
const Projects = lazy(() => import("./pages/ems/Projects"));
const Finance = lazy(() => import("./pages/ems/Finance"));
const Settings = lazy(() => import("./pages/ems/Settings"));
const Reports = lazy(() => import("./pages/ems/Reports"));
const Planning = lazy(() => import("./pages/ems/Planning"));
const Tasks = lazy(() => import("./pages/ems/Tasks"));
const Contacts = lazy(() => import("./pages/ems/Contacts"));
const RoadMap = lazy(() => import("./pages/ems/RoadMap"));
const QuickNotes = lazy(() => import("./pages/ems/QuickNotes"));
const CalendarPage = lazy(() => import("./pages/ems/Calendar"));
const Commercial = lazy(() => import("./pages/ems/Commercial"));
const Onboarding = lazy(() => import("./pages/ems/Onboarding"));
const CommercialStructure = lazy(() => import("./pages/ems/CommercialStructure"));
const CommercialComparison = lazy(() => import("./pages/ems/CommercialComparison"));
const Faculdade = lazy(() => import("./pages/ems/Faculdade"));
const ComercialAutomatizado = lazy(() => import("./pages/ems/ComercialAutomatizado"));
const AgileImplementation = lazy(() => import("./pages/ems/AgileImplementation"));
const DailyReport = lazy(() => import("./pages/ems/DailyReport"));
const BoardCouncil = lazy(() => import("./pages/ems/BoardCouncil"));
const EMSLogin = lazy(() => import("./pages/ems/Login"));
const ResetPassword = lazy(() => import("./pages/ems/ResetPassword"));
const NotFound = lazy(() => import("./pages/NotFound"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 min stale time for fewer page-change refetches
      gcTime: 1000 * 60 * 20, // keep warm data around longer during navigation
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

const PageLoader = () => (
  <div className="min-h-screen bg-background flex items-center justify-center">
    <div className="space-y-4 w-64">
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-4 w-1/2" />
    </div>
  </div>
);

const ProtectedPage = ({ children }: { children: React.ReactNode }) => (
  <ProtectedEMSRoute>{children}</ProtectedEMSRoute>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <CompanyProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Suspense fallback={<PageLoader />}>
            <Routes>
              {/* Redirect root to EMS */}
              <Route path="/" element={<Navigate to="/ems" replace />} />
              
              {/* EMS Login (public) */}
              <Route path="/ems/login" element={<EMSLogin />} />
              <Route path="/ems/reset-password" element={<ResetPassword />} />

              {/* EMS Routes (protected) */}
              <Route path="/ems" element={<ProtectedPage><Overview /></ProtectedPage>} />
              <Route path="/ems/tasks" element={<ProtectedPage><Tasks /></ProtectedPage>} />
              <Route path="/ems/contacts" element={<ProtectedPage><Contacts /></ProtectedPage>} />
              <Route path="/ems/projects" element={<ProtectedPage><Projects /></ProtectedPage>} />
              <Route path="/ems/knowledge" element={<Navigate to="/ems/quick-notes" replace />} />
              <Route path="/ems/finance" element={<ProtectedPage><Finance /></ProtectedPage>} />
              <Route path="/ems/settings" element={<ProtectedPage><Settings /></ProtectedPage>} />
              <Route path="/ems/reports" element={<ProtectedPage><Reports /></ProtectedPage>} />
              <Route path="/ems/planning" element={<ProtectedPage><Planning /></ProtectedPage>} />
              <Route path="/ems/orgchart" element={<Navigate to="/ems/projects" replace />} />
              <Route path="/ems/roadmap" element={<ProtectedPage><RoadMap /></ProtectedPage>} />
              <Route path="/ems/quick-notes" element={<ProtectedPage><QuickNotes /></ProtectedPage>} />
              <Route path="/ems/calendar" element={<ProtectedPage><CalendarPage /></ProtectedPage>} />
              <Route path="/ems/daily-report" element={<ProtectedPage><DailyReport /></ProtectedPage>} />
              <Route path="/ems/conselho" element={<ProtectedPage><BoardCouncil /></ProtectedPage>} />
              <Route path="/ems/comercial" element={<ProtectedPage><Commercial /></ProtectedPage>} />
              <Route path="/ems/comercial/contatos" element={<ProtectedPage><Contacts /></ProtectedPage>} />
              <Route path="/ems/comercial/estrutura" element={<ProtectedPage><CommercialStructure /></ProtectedPage>} />
              <Route path="/ems/comercial/comparativo" element={<ProtectedPage><CommercialComparison /></ProtectedPage>} />
              <Route path="/ems/comercial/onboarding" element={<ProtectedPage><Onboarding /></ProtectedPage>} />
              <Route path="/ems/comercial/implementacao-agil" element={<ProtectedPage><AgileImplementation /></ProtectedPage>} />
              <Route path="/ems/estrutura-comercial" element={<ProtectedPage><CommercialStructure /></ProtectedPage>} />
              <Route path="/ems/comparativo-comercial" element={<ProtectedPage><CommercialComparison /></ProtectedPage>} />
              <Route path="/ems/onboarding" element={<ProtectedPage><Onboarding /></ProtectedPage>} />
              <Route path="/ems/executive" element={<Navigate to="/ems" replace />} />
              <Route path="/ems/timesheet" element={<Navigate to="/ems" replace />} />
              <Route path="/ems/companies" element={<ProtectedPage><Companies /></ProtectedPage>} />
              <Route path="/ems/faculdade" element={<ProtectedPage><Faculdade /></ProtectedPage>} />
              <Route path="/ems/comercial-automatizado" element={<ProtectedPage><ComercialAutomatizado /></ProtectedPage>} />
              <Route path="/ems/implementacao-agil" element={<ProtectedPage><AgileImplementation /></ProtectedPage>} />
              <Route path="/ems/conferencia" element={<Navigate to="/ems/projects" replace />} />
              <Route path="/ems/rotas-visita" element={<Navigate to="/ems/comercial" replace />} />

              {/* Catch-all */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </TooltipProvider>
      </CompanyProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
