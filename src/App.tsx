import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/admin/ProtectedRoute";
import { EMSProtectedRoute } from "@/components/ems/EMSProtectedRoute";
import Index from "./pages/Index";
import Obrigado from "./pages/Obrigado";
import Demonstracao from "./pages/Demonstracao";
import Login from "./pages/admin/Login";
import Dashboard from "./pages/admin/Dashboard";
import NotFound from "./pages/NotFound";

// EMS Pages
import EMSLogin from "./pages/ems/EMSLogin";
import Overview from "./pages/ems/Overview";
import Projects from "./pages/ems/Projects";
import Knowledge from "./pages/ems/Knowledge";
import Finance from "./pages/ems/Finance";
import Settings from "./pages/ems/Settings";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/obrigado" element={<Obrigado />} />
            <Route path="/demonstracao" element={<Demonstracao />} />
            <Route path="/admin/login" element={<Login />} />
            <Route
              path="/admin"
              element={
                <ProtectedRoute>
                  <Dashboard />
                </ProtectedRoute>
              }
            />
            
            {/* EMS Routes */}
            <Route path="/ems/login" element={<EMSLogin />} />
            <Route path="/ems" element={<EMSProtectedRoute><Overview /></EMSProtectedRoute>} />
            <Route path="/ems/projects" element={<EMSProtectedRoute><Projects /></EMSProtectedRoute>} />
            <Route path="/ems/knowledge" element={<EMSProtectedRoute><Knowledge /></EMSProtectedRoute>} />
            <Route path="/ems/finance" element={<EMSProtectedRoute><Finance /></EMSProtectedRoute>} />
            <Route path="/ems/settings" element={<EMSProtectedRoute><Settings /></EMSProtectedRoute>} />
            
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
