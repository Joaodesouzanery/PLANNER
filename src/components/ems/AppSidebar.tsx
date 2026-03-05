import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard,
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
  Contact,
  Route,
  Menu,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme } from "./ThemeProvider";
import { DueDateNotifications } from "./DueDateNotifications";
import { ColorPicker } from "./ColorPicker";
import { useIsMobile } from "@/hooks/use-mobile";
import hiveLogo from "@/assets/hive-logo.jpg";

const menuItems = [
  { icon: LayoutDashboard, label: "Overview", path: "/ems" },
  { icon: ListTodo, label: "Tarefas", path: "/ems/tasks" },
  { icon: Contact, label: "Contatos", path: "/ems/contacts" },
  { icon: FolderKanban, label: "Projetos", path: "/ems/projects" },
  { icon: Target, label: "Planejamento", path: "/ems/planning" },
  { icon: Route, label: "RoadMap", path: "/ems/roadmap" },
  { icon: Users, label: "Organograma", path: "/ems/orgchart" },
  { icon: BookOpen, label: "Knowledge", path: "/ems/knowledge" },
  { icon: TrendingUp, label: "Finanças", path: "/ems/finance" },
  { icon: FileText, label: "Relatórios", path: "/ems/reports" },
  { icon: Settings, label: "Configurações", path: "/ems/settings" },
];

interface AppSidebarProps {
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

export const AppSidebar = ({ mobileOpen, onMobileClose }: AppSidebarProps) => {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();
  const { theme, setTheme } = useTheme();
  const isMobile = useIsMobile();

  const handleNavClick = () => {
    if (isMobile && onMobileClose) {
      onMobileClose();
    }
  };

  const sidebarContent = (
    <div className="h-screen bg-card border-r border-border flex flex-col">
      {/* Logo */}
      <div className="p-4 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img src={hiveLogo} alt="Hive Tech" className="h-10 w-10 rounded-lg object-cover" />
          {(!collapsed || isMobile) && (
            <span className="text-lg font-heading font-bold text-primary whitespace-nowrap">
              Hive Tech
            </span>
          )}
        </div>
        {isMobile && (
          <Button variant="ghost" size="icon" onClick={onMobileClose} className="h-9 w-9">
            <X className="h-5 w-5" />
          </Button>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {menuItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              onClick={handleNavClick}
              className={cn(
                "flex items-center gap-3 px-3 py-3 rounded-lg transition-all duration-200",
                isActive
                  ? "bg-primary/10 text-primary border border-primary/20"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <item.icon className="h-5 w-5 flex-shrink-0" />
              <AnimatePresence>
                {(!collapsed || isMobile) && (
                  <motion.span
                    initial={{ opacity: 0, width: 0 }}
                    animate={{ opacity: 1, width: "auto" }}
                    exit={{ opacity: 0, width: 0 }}
                    className="text-sm font-medium whitespace-nowrap overflow-hidden"
                  >
                    {item.label}
                  </motion.span>
                )}
              </AnimatePresence>
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="p-3 border-t border-border space-y-2">
        {/* Notifications */}
        <div className={cn(
          "flex items-center",
          collapsed && !isMobile ? "justify-center" : "justify-between px-3"
        )}>
          {(!collapsed || isMobile) && (
            <span className="text-sm text-muted-foreground">Alertas</span>
          )}
          <DueDateNotifications />
        </div>

        {/* Color Picker */}
        <div className={cn(
          "flex items-center",
          collapsed && !isMobile ? "justify-center" : "justify-between px-3"
        )}>
          {(!collapsed || isMobile) && (
            <span className="text-sm text-muted-foreground">Cor</span>
          )}
          <ColorPicker collapsed={collapsed && !isMobile} />
        </div>

        {/* Theme Toggle */}
        <div className={cn(
          "flex items-center",
          collapsed && !isMobile ? "justify-center" : "justify-between px-3"
        )}>
          {(!collapsed || isMobile) && (
            <span className="text-sm text-muted-foreground">Tema</span>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className="h-9 w-9"
          >
            {theme === "dark" ? (
              <Sun className="h-4 w-4" />
            ) : (
              <Moon className="h-4 w-4" />
            )}
          </Button>
        </div>

        {/* Collapse Button - desktop only */}
        {!isMobile && (
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            {collapsed ? (
              <ChevronRight className="h-5 w-5" />
            ) : (
              <>
                <ChevronLeft className="h-5 w-5" />
                <motion.span
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-sm"
                >
                  Recolher
                </motion.span>
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );

  // Mobile: overlay drawer
  if (isMobile) {
    return (
      <AnimatePresence>
        {mobileOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={onMobileClose}
              className="fixed inset-0 bg-black/50 z-40"
            />
            {/* Drawer */}
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

  // Desktop: fixed sidebar with collapse
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
  const currentPage = menuItems.find((item) => item.path === location.pathname);

  return (
    <div className="sticky top-0 z-30 bg-card/95 backdrop-blur-sm border-b border-border px-4 py-3 flex items-center gap-3 md:hidden">
      <Button variant="ghost" size="icon" onClick={onMenuClick} className="h-10 w-10">
        <Menu className="h-5 w-5" />
      </Button>
      <div className="flex items-center gap-2">
        <img src={hiveLogo} alt="Hive Tech" className="h-8 w-8 rounded-lg object-cover" />
        <span className="font-heading font-semibold text-foreground">
          {currentPage?.label || "Hive Tech"}
        </span>
      </div>
    </div>
  );
};
