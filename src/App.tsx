import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider } from "@/components/ems/ThemeProvider";
import { CompanyProvider } from "@/contexts/CompanyContext";
import { ProtectedEMSRoute } from "@/components/ems/ProtectedEMSRoute";

// EMS Pages
import Overview from "./pages/ems/Overview";
import Companies from "./pages/ems/Companies";
import Projects from "./pages/ems/Projects";
import Knowledge from "./pages/ems/Knowledge";
import Finance from "./pages/ems/Finance";
import Settings from "./pages/ems/Settings";
import Reports from "./pages/ems/Reports";
import Planning from "./pages/ems/Planning";
import OrgChart from "./pages/ems/OrgChart";
import Tasks from "./pages/ems/Tasks";
import Contacts from "./pages/ems/Contacts";
import RoadMap from "./pages/ems/RoadMap";
import QuickNotes from "./pages/ems/QuickNotes";
import CalendarPage from "./pages/ems/Calendar";
import Commercial from "./pages/ems/Commercial";
import Onboarding from "./pages/ems/Onboarding";
import Executive from "./pages/ems/Executive";
import Timesheet from "./pages/ems/Timesheet";
import EMSLogin from "./pages/ems/Login";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

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
          <Routes>
            {/* Redirect root to EMS */}
            <Route path="/" element={<Navigate to="/ems" replace />} />
            
            {/* EMS Login (public) */}
            <Route path="/ems/login" element={<EMSLogin />} />

            {/* EMS Routes (protected) */}
            <Route path="/ems" element={<ProtectedPage><Overview /></ProtectedPage>} />
            <Route path="/ems/tasks" element={<ProtectedPage><Tasks /></ProtectedPage>} />
            <Route path="/ems/contacts" element={<ProtectedPage><Contacts /></ProtectedPage>} />
            <Route path="/ems/projects" element={<ProtectedPage><Projects /></ProtectedPage>} />
            <Route path="/ems/knowledge" element={<ProtectedPage><Knowledge /></ProtectedPage>} />
            <Route path="/ems/finance" element={<ProtectedPage><Finance /></ProtectedPage>} />
            <Route path="/ems/settings" element={<ProtectedPage><Settings /></ProtectedPage>} />
            <Route path="/ems/reports" element={<ProtectedPage><Reports /></ProtectedPage>} />
            <Route path="/ems/planning" element={<ProtectedPage><Planning /></ProtectedPage>} />
            <Route path="/ems/orgchart" element={<ProtectedPage><OrgChart /></ProtectedPage>} />
            <Route path="/ems/roadmap" element={<ProtectedPage><RoadMap /></ProtectedPage>} />
            <Route path="/ems/quick-notes" element={<ProtectedPage><QuickNotes /></ProtectedPage>} />
            <Route path="/ems/calendar" element={<ProtectedPage><CalendarPage /></ProtectedPage>} />
            <Route path="/ems/comercial" element={<ProtectedPage><Commercial /></ProtectedPage>} />
            <Route path="/ems/onboarding" element={<ProtectedPage><Onboarding /></ProtectedPage>} />
            <Route path="/ems/executive" element={<ProtectedPage><Executive /></ProtectedPage>} />
            <Route path="/ems/timesheet" element={<ProtectedPage><Timesheet /></ProtectedPage>} />
            <Route path="/ems/companies" element={<ProtectedPage><Companies /></ProtectedPage>} />

            {/* Catch-all */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
      </CompanyProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
