import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Palette } from "lucide-react";
import { cn } from "@/lib/utils";

const THEME_COLORS = [
  { name: "Amarelo Hive", hue: 56, saturation: 100, lightness: 45 },
  { name: "Azul Royal", hue: 220, saturation: 90, lightness: 56 },
  { name: "Esmeralda", hue: 160, saturation: 84, lightness: 39 },
  { name: "Violeta", hue: 270, saturation: 76, lightness: 55 },
  { name: "Rosa", hue: 330, saturation: 80, lightness: 55 },
  { name: "Laranja", hue: 25, saturation: 95, lightness: 53 },
  { name: "Ciano", hue: 190, saturation: 90, lightness: 50 },
  { name: "Vermelho", hue: 0, saturation: 84, lightness: 55 },
];

function applyThemeColor(hue: number, saturation: number, lightness: number) {
  const root = document.documentElement;
  root.style.setProperty("--primary", `${hue} ${saturation}% ${lightness}%`);
  root.style.setProperty("--primary-light", `${hue} ${saturation}% ${lightness + 10}%`);
  root.style.setProperty("--accent", `${hue} ${saturation}% ${lightness}%`);
  root.style.setProperty("--accent-light", `${hue} ${saturation}% ${lightness + 10}%`);
  root.style.setProperty("--ring", `${hue} ${saturation}% ${lightness}%`);
}

export const ColorPicker = ({ collapsed }: { collapsed?: boolean }) => {
  const [selected, setSelected] = useState(() => {
    return localStorage.getItem("ems-color") || "56-100-45";
  });

  useEffect(() => {
    const [h, s, l] = selected.split("-").map(Number);
    applyThemeColor(h, s, l);
  }, [selected]);

  const handleSelect = (hue: number, saturation: number, lightness: number) => {
    const key = `${hue}-${saturation}-${lightness}`;
    setSelected(key);
    localStorage.setItem("ems-color", key);
    applyThemeColor(hue, saturation, lightness);
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="h-9 w-9">
          <Palette className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent side="right" align="end" className="w-48 p-3">
        <p className="text-xs font-medium text-muted-foreground mb-2">Cor do tema</p>
        <div className="grid grid-cols-4 gap-2">
          {THEME_COLORS.map((color) => {
            const key = `${color.hue}-${color.saturation}-${color.lightness}`;
            return (
              <button
                key={key}
                onClick={() => handleSelect(color.hue, color.saturation, color.lightness)}
                className={cn(
                  "w-8 h-8 rounded-full border-2 transition-transform hover:scale-110",
                  selected === key ? "border-foreground scale-110" : "border-transparent"
                )}
                style={{ backgroundColor: `hsl(${color.hue} ${color.saturation}% ${color.lightness}%)` }}
                title={color.name}
              />
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
};
