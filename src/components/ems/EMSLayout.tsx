import { ReactNode, useState, useEffect } from "react";
import { AppSidebar } from "./AppSidebar";
import { motion } from "framer-motion";

interface EMSLayoutProps {
  children: ReactNode;
}

export const EMSLayout = ({ children }: EMSLayoutProps) => {
  const [sidebarWidth, setSidebarWidth] = useState(260);

  useEffect(() => {
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
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <AppSidebar />
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
    </div>
  );
};
