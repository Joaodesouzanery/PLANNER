import { Toaster as Sonner, toast } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  // Get theme from localStorage or document class
  const getTheme = (): "dark" | "light" | "system" => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("ems-theme");
      if (stored === "dark" || stored === "light") return stored;
      return document.documentElement.classList.contains("dark") ? "dark" : "light";
    }
    return "system";
  };

  return (
    <Sonner
      theme={getTheme() as ToasterProps["theme"]}
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg",
          description: "group-[.toast]:text-muted-foreground",
          actionButton: "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton: "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
        },
      }}
      {...props}
    />
  );
};

export { Toaster, toast };
