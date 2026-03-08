import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider } from "@/components/ems/ThemeProvider";
import { CompanyProvider } from "@/contexts/CompanyContext";

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
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            {/* Redirect root to EMS */}
            <Route path="/" element={<Navigate to="/ems" replace />} />
            
            {/* EMS Routes */}
            <Route path="/ems" element={<Overview />} />
            <Route path="/ems/tasks" element={<Tasks />} />
            <Route path="/ems/contacts" element={<Contacts />} />
            <Route path="/ems/projects" element={<Projects />} />
            <Route path="/ems/knowledge" element={<Knowledge />} />
            <Route path="/ems/finance" element={<Finance />} />
            <Route path="/ems/settings" element={<Settings />} />
            <Route path="/ems/reports" element={<Reports />} />
            <Route path="/ems/planning" element={<Planning />} />
            <Route path="/ems/orgchart" element={<OrgChart />} />
            <Route path="/ems/roadmap" element={<RoadMap />} />
            <Route path="/ems/quick-notes" element={<QuickNotes />} />
            <Route path="/ems/calendar" element={<CalendarPage />} />
            <Route path="/ems/comercial" element={<Commercial />} />
            <Route path="/ems/onboarding" element={<Onboarding />} />

            {/* Catch-all */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
