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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme } from "./ThemeProvider";
import { DueDateNotifications } from "./DueDateNotifications";
import { ColorPicker } from "./ColorPicker";
import hiveLogo from "@/assets/hive-logo.jpg";

const menuItems = [
  { icon: LayoutDashboard, label: "Overview", path: "/ems" },
  { icon: ListTodo, label: "Tarefas", path: "/ems/tasks" },
  { icon: Contact, label: "Contatos", path: "/ems/contacts" },
  { icon: FolderKanban, label: "Gestão de Projetos", path: "/ems/projects" },
  { icon: Target, label: "Planejamento", path: "/ems/planning" },
  { icon: Users, label: "Organograma", path: "/ems/orgchart" },
  { icon: BookOpen, label: "Knowledge Base", path: "/ems/knowledge" },
  { icon: TrendingUp, label: "Finanças & Estratégia", path: "/ems/finance" },
  { icon: FileText, label: "Relatórios", path: "/ems/reports" },
  { icon: Settings, label: "Configurações", path: "/ems/settings" },
];

export const AppSidebar = () => {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();
  const { theme, setTheme } = useTheme();

  return (
    <motion.aside
      initial={false}
      animate={{ width: collapsed ? 72 : 260 }}
      transition={{ duration: 0.3, ease: "easeInOut" }}
      className="h-screen bg-card border-r border-border flex flex-col fixed left-0 top-0 z-40"
    >
      {/* Logo */}
      <div className="p-4 border-b border-border flex items-center gap-3">
        <img src={hiveLogo} alt="Hive Tech" className="h-10 w-10 rounded-lg object-cover" />
        <AnimatePresence>
          {!collapsed && (
            <motion.span
              initial={{ opacity: 0, width: 0 }}
              animate={{ opacity: 1, width: "auto" }}
              exit={{ opacity: 0, width: 0 }}
              className="text-lg font-heading font-bold text-primary whitespace-nowrap overflow-hidden"
            >
              Hive Tech
            </motion.span>
          )}
        </AnimatePresence>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-1">
        {menuItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                "flex items-center gap-3 px-3 py-3 rounded-lg transition-all duration-200",
                isActive
                  ? "bg-primary/10 text-primary border border-primary/20"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <item.icon className="h-5 w-5 flex-shrink-0" />
              <AnimatePresence>
                {!collapsed && (
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
          collapsed ? "justify-center" : "justify-between px-3"
        )}>
          {!collapsed && (
            <span className="text-sm text-muted-foreground">Alertas</span>
          )}
          <DueDateNotifications />
        </div>
        
        {/* Color Picker */}
        <div className={cn(
          "flex items-center",
          collapsed ? "justify-center" : "justify-between px-3"
        )}>
          {!collapsed && (
            <span className="text-sm text-muted-foreground">Cor</span>
          )}
          <ColorPicker collapsed={collapsed} />
        </div>

        {/* Theme Toggle */}
        <div className={cn(
          "flex items-center",
          collapsed ? "justify-center" : "justify-between px-3"
        )}>
          {!collapsed && (
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
        
        {/* Collapse Button */}
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
      </div>
    </motion.aside>
  );
};
