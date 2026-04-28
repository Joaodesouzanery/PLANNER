import { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard, Gauge, Clock,
  Building2,
  FolderKanban,
  BookOpen,
  TrendingUp,
  Settings,
  ChevronLeft,
  ChevronRight,
  FileText,
  Moon,
  Sun,
  Target,
  Users,
  ListTodo,
  MapPinned,
  StickyNote,
  CalendarDays,
  Menu,
  X,
  ChevronDown,
  Briefcase,
  LogOut,
  GraduationCap,
  User as UserIcon,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme } from "./ThemeProvider";
import { DueDateNotifications } from "./DueDateNotifications";
import { ColorPicker } from "./ColorPicker";
import { useIsMobile } from "@/hooks/use-mobile";
import { CompanySelector } from "./CompanySelector";
import { supabase } from "@/integrations/supabase/client";
import hiveLogo from "@/assets/hive-logo.jpg";

interface MenuGroup {
  label: string;
  items: { icon: React.ElementType; label: string; path: string }[];
}

const menuGroups: MenuGroup[] = [
  {
    label: "Principal",
    items: [
      { icon: LayoutDashboard, label: "Dashboard", path: "/ems" },
      { icon: Gauge, label: "Executivo", path: "/ems/executive" },
      { icon: FolderKanban, label: "Projetos", path: "/ems/projects" },
      { icon: ListTodo, label: "Tarefas", path: "/ems/tasks" },
      { icon: TrendingUp, label: "Finanças", path: "/ems/finance" },
      { icon: FileText, label: "Relatórios", path: "/ems/reports" },
    ],
  },
  {
    label: "Gestão",
    items: [
      { icon: Briefcase, label: "Comercial", path: "/ems/comercial" },
      { icon: ShieldCheck, label: "Conferência", path: "/ems/conferencia" },
      { icon: MapPinned, label: "Rotas de Visita", path: "/ems/rotas-visita" },
      { icon: Target, label: "Planejamento", path: "/ems/planning" },
      { icon: Users, label: "Organograma", path: "/ems/orgchart" },
    ],
  },
  {
    label: "Ferramentas",
    items: [
      { icon: Clock, label: "Timesheet", path: "/ems/timesheet" },
      { icon: CalendarDays, label: "Calendário", path: "/ems/calendar" },
      { icon: StickyNote, label: "Notas Rápidas", path: "/ems/quick-notes" },
      { icon: BookOpen, label: "Knowledge Base", path: "/ems/knowledge" },
      { icon: GraduationCap, label: "Faculdade", path: "/ems/faculdade" },
    ],
  },
  {
    label: "Configuração",
    items: [
      { icon: Settings, label: "Configurações", path: "/ems/settings" },
      { icon: Building2, label: "Empresas", path: "/ems/companies" },
    ],
  },
];

const allMenuItems = menuGroups.flatMap((g) => g.items);

interface AppSidebarProps {
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

export const AppSidebar = ({ mobileOpen, onMobileClose }: AppSidebarProps) => {
  const [collapsed, setCollapsed] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const location = useLocation();
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();
  const isMobile = useIsMobile();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUserEmail(session?.user?.email ?? null);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => {
      setUserEmail(s?.user?.email ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/ems/login");
  };

  const handleNavClick = () => {
    if (isMobile && onMobileClose) onMobileClose();
  };

  const sidebarContent = (
    <div className="h-screen bg-sidebar flex flex-col border-r border-sidebar-border">
      {/* Logo Header */}
      <div className="p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center overflow-hidden">
            <img src={hiveLogo} alt="Hive Tech" className="h-10 w-10 rounded-xl object-cover" />
          </div>
          {(!collapsed || isMobile) && (
            <div className="flex flex-col">
              <span className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground font-medium">
                EMS
              </span>
              <span className="text-sm font-semibold text-foreground whitespace-nowrap leading-tight">
                Hive Tech
              </span>
            </div>
          )}
        </div>
        {isMobile && (
          <Button variant="ghost" size="icon" onClick={onMobileClose} className="h-9 w-9 text-muted-foreground">
            <X className="h-5 w-5" />
          </Button>
        )}
      </div>

      {/* Company Selector */}
      <div className="px-3 py-1">
        <CompanySelector collapsed={collapsed && !isMobile} />
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-2 overflow-y-auto space-y-5">
        {menuGroups.map((group) => (
          <div key={group.label}>
            {(!collapsed || isMobile) && (
              <p className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground font-semibold px-3 mb-2">
                {group.label}
              </p>
            )}
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const isActive = location.pathname === item.path;
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={handleNavClick}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group relative",
                      isActive
                        ? "text-primary"
                        : "text-sidebar-foreground hover:text-foreground hover:bg-sidebar-hover"
                    )}
                  >
                    {isActive && (
                      <motion.div
                        layoutId="activeTab"
                        className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full bg-primary"
                        transition={{ type: "spring", stiffness: 500, damping: 30 }}
                      />
                    )}
                    <item.icon className={cn(
                      "h-[18px] w-[18px] flex-shrink-0 transition-colors",
                      isActive ? "text-primary" : "text-sidebar-foreground group-hover:text-foreground"
                    )} />
                    <AnimatePresence>
                      {(!collapsed || isMobile) && (
                        <motion.span
                          initial={{ opacity: 0, width: 0 }}
                          animate={{ opacity: 1, width: "auto" }}
                          exit={{ opacity: 0, width: 0 }}
                          className={cn(
                            "text-[13px] font-medium whitespace-nowrap overflow-hidden",
                            isActive ? "text-primary" : ""
                          )}
                        >
                          {item.label}
                        </motion.span>
                      )}
                    </AnimatePresence>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="px-3 py-3 border-t border-sidebar-border space-y-1.5">
        <div className={cn("flex items-center", collapsed && !isMobile ? "justify-center" : "justify-between px-3")}>
          {(!collapsed || isMobile) && <span className="text-[11px] text-muted-foreground">Alertas</span>}
          <DueDateNotifications />
        </div>
        <div className={cn("flex items-center", collapsed && !isMobile ? "justify-center" : "justify-between px-3")}>
          {(!collapsed || isMobile) && <span className="text-[11px] text-muted-foreground">Cor</span>}
          <ColorPicker collapsed={collapsed && !isMobile} />
        </div>
        <div className={cn("flex items-center", collapsed && !isMobile ? "justify-center" : "justify-between px-3")}>
          {(!collapsed || isMobile) && <span className="text-[11px] text-muted-foreground">Tema</span>}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
          >
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
        </div>
        {/* User info + Logout */}
        {userEmail && (
          <div className={cn("flex items-center gap-2 px-3 py-2 rounded-lg", collapsed && !isMobile ? "justify-center" : "")}>
            {(!collapsed || isMobile) && (
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <UserIcon className="h-3 w-3 text-primary" />
                </div>
                <span className="text-[11px] text-muted-foreground truncate">{userEmail}</span>
              </div>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={handleLogout}
              className="h-8 w-8 text-muted-foreground hover:text-destructive flex-shrink-0"
              title="Sair"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        )}
        {!isMobile && (
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-muted-foreground hover:bg-sidebar-hover hover:text-foreground transition-colors"
          >
            {collapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <>
                <ChevronLeft className="h-4 w-4" />
                <span className="text-[11px]">Recolher</span>
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );

  if (isMobile) {
    return (
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={onMobileClose}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
            />
            <motion.aside
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ duration: 0.3, ease: "easeInOut" }}
              className="fixed left-0 top-0 w-[280px] z-50"
            >
              {sidebarContent}
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    );
  }

  return (
    <motion.aside
      initial={false}
      animate={{ width: collapsed ? 72 : 260 }}
      transition={{ duration: 0.3, ease: "easeInOut" }}
      className="h-screen fixed left-0 top-0 z-40"
    >
      {sidebarContent}
    </motion.aside>
  );
};

export const MobileHeader = ({ onMenuClick }: { onMenuClick: () => void }) => {
  const location = useLocation();
  const currentPage = allMenuItems.find((item) => item.path === location.pathname);

  return (
    <div className="sticky top-0 z-30 bg-sidebar/95 backdrop-blur-xl border-b border-sidebar-border px-4 py-3 flex items-center gap-3 md:hidden">
      <Button variant="ghost" size="icon" onClick={onMenuClick} className="h-10 w-10 text-muted-foreground">
        <Menu className="h-5 w-5" />
      </Button>
      <div className="flex items-center gap-2">
        <img src={hiveLogo} alt="Hive Tech" className="h-8 w-8 rounded-lg object-cover" />
        <span className="font-semibold text-foreground">
          {currentPage?.label || "Hive Tech"}
        </span>
      </div>
    </div>
  );
};
