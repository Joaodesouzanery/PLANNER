import { createContext, useContext, useEffect, useState, ReactNode } from "react";

type Theme = "dark" | "light";

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const [theme, setTheme] = useState<Theme>(() => {
    const stored = localStorage.getItem("ems-theme");
    return (stored as Theme) || "dark";
  });

  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove("light", "dark");
    root.classList.add(theme);
    localStorage.setItem("ems-theme", theme);

    // Restore saved color
    const savedColor = localStorage.getItem("ems-color");
    if (savedColor) {
      const [h, s, l] = savedColor.split("-").map(Number);
      root.style.setProperty("--primary", `${h} ${s}% ${l}%`);
      root.style.setProperty("--primary-light", `${h} ${s}% ${l + 10}%`);
      root.style.setProperty("--accent", `${h} ${s}% ${l}%`);
      root.style.setProperty("--accent-light", `${h} ${s}% ${l + 10}%`);
      root.style.setProperty("--ring", `${h} ${s}% ${l}%`);
    }
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
};
