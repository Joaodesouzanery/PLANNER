import { ReactNode, useState, useEffect } from "react";
import { AppSidebar, MobileHeader } from "./AppSidebar";
import { motion } from "framer-motion";
import { useIsMobile } from "@/hooks/use-mobile";

interface EMSLayoutProps {
  children: ReactNode;
}

export const EMSLayout = ({ children }: EMSLayoutProps) => {
  const [sidebarWidth, setSidebarWidth] = useState(260);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const isMobile = useIsMobile();

  useEffect(() => {
    if (isMobile) return;

    const checkSidebarWidth = () => {
      const sidebar = document.querySelector('aside');
      if (sidebar) {
        setSidebarWidth(sidebar.getBoundingClientRect().width);
      }
    };

    const observer = new ResizeObserver(checkSidebarWidth);
    const sidebar = document.querySelector('aside');
    if (sidebar) {
      observer.observe(sidebar);
    }

    return () => observer.disconnect();
  }, [isMobile]);

  return (
    <div className="min-h-screen bg-background">
      <AppSidebar
        mobileOpen={mobileMenuOpen}
        onMobileClose={() => setMobileMenuOpen(false)}
      />

      {isMobile && (
        <MobileHeader onMenuClick={() => setMobileMenuOpen(true)} />
      )}

      {isMobile ? (
        <main className="min-h-[calc(100vh-57px)]">
          <div className="p-4">
            {children}
          </div>
        </main>
      ) : (
        <motion.main
          initial={false}
          animate={{ marginLeft: sidebarWidth }}
          transition={{ duration: 0.3, ease: "easeInOut" }}
          className="min-h-screen"
        >
          <div className="p-6 lg:p-8">
            {children}
          </div>
        </motion.main>
      )}
    </div>
  );
};
