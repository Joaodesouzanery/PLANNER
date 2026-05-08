import { useEffect, useMemo, useState } from "react";
import { Loader2, MapPin } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface GeocodeResult {
  label: string;
  lat: number;
  lng: number;
}

interface AddressAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  onResolved: (result: GeocodeResult) => void;
  placeholder?: string;
  className?: string;
}

const searchAddress = async (query: string): Promise<GeocodeResult[]> => {
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("limit", "5");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("q", query);

  const response = await fetch(url.toString(), {
    headers: { Accept: "application/json" },
  });
  if (!response.ok) throw new Error("Falha ao buscar endereco.");
  const data = await response.json();
  return (data || []).map((item: any) => ({
    label: item.display_name,
    lat: Number(item.lat),
    lng: Number(item.lon),
  }));
};

export const AddressAutocomplete = ({ value, onChange, onResolved, placeholder, className }: AddressAutocompleteProps) => {
  const [options, setOptions] = useState<GeocodeResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const query = useMemo(() => value.trim(), [value]);

  useEffect(() => {
    if (query.length < 6) {
      setOptions([]);
      return;
    }

    const timeout = window.setTimeout(async () => {
      try {
        setLoading(true);
        const results = await searchAddress(query);
        setOptions(results);
        setOpen(results.length > 0);
      } catch {
        setOptions([]);
      } finally {
        setLoading(false);
      }
    }, 450);

    return () => window.clearTimeout(timeout);
  }, [query]);

  const resolveCurrentAddress = async () => {
    if (query.length < 4) return;
    setLoading(true);
    try {
      const [first] = await searchAddress(query);
      if (first) {
        onChange(first.label);
        onResolved(first);
        setOptions([]);
        setOpen(false);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={cn("relative", className)}>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <MapPin className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={value}
            onChange={(event) => {
              onChange(event.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(options.length > 0)}
            placeholder={placeholder || "Endereco completo"}
            className="pl-9 rounded-xl"
          />
        </div>
        <Button type="button" variant="outline" className="rounded-xl gap-2" onClick={resolveCurrentAddress} disabled={loading || query.length < 4}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <MapPin className="h-4 w-4" />}
          Geocodificar
        </Button>
      </div>
      {open && options.length > 0 && (
        <div className="absolute z-50 mt-1 max-h-56 w-full overflow-y-auto rounded-xl border bg-popover p-1 text-popover-foreground shadow-lg">
          {options.map((option) => (
            <button
              key={`${option.lat}-${option.lng}-${option.label}`}
              type="button"
              className="w-full rounded-lg px-3 py-2 text-left text-xs hover:bg-accent"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                onChange(option.label);
                onResolved(option);
                setOptions([]);
                setOpen(false);
              }}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default AddressAutocomplete;
