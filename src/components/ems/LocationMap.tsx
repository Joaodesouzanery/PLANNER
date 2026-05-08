import { useMemo } from "react";
import { MapContainer, TileLayer, CircleMarker, Tooltip, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { cn } from "@/lib/utils";

export interface MapPin {
  id: string;
  name: string;
  subtitle?: string;
  lat: number;
  lng: number;
  /** When true, renders a pulsing red marker (overdue tasks). */
  alert?: boolean;
  /** Optional click handler */
  onClick?: () => void;
}

interface LocationMapProps {
  pins: MapPin[];
  height?: number | string;
  className?: string;
  /** Center fallback when no pins. Defaults to Brasil (Brasília). */
  fallbackCenter?: [number, number];
  fallbackZoom?: number;
}

// Dark CARTO basemap — same family as Régate's reference UI
const TILE_URL =
  "https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png";
const LABELS_URL =
  "https://{s}.basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}{r}.png";
const TILE_ATTR =
  '&copy; <a href="https://carto.com/">CARTO</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';

export const LocationMap = ({
  pins,
  height = 360,
  className,
  fallbackCenter = [-15.78, -47.93],
  fallbackZoom = 4,
}: LocationMapProps) => {
  const valid = useMemo(
    () => pins.filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng)),
    [pins]
  );

  const center: [number, number] = useMemo(() => {
    if (!valid.length) return fallbackCenter;
    const lat = valid.reduce((a, p) => a + p.lat, 0) / valid.length;
    const lng = valid.reduce((a, p) => a + p.lng, 0) / valid.length;
    return [lat, lng];
  }, [valid, fallbackCenter]);

  const zoom = valid.length ? (valid.length === 1 ? 11 : 5) : fallbackZoom;

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-xl border border-border/40 bg-[hsl(220_14%_13%)] [&_.leaflet-tile]:brightness-[1.16] [&_.leaflet-tile]:contrast-[0.95]",
        className
      )}
      style={{ height }}
    >
      <MapContainer
        center={center}
        zoom={zoom}
        scrollWheelZoom
        className="h-full w-full"
        style={{ background: "hsl(220 14% 13%)" }}
      >
        <TileLayer url={TILE_URL} attribution={TILE_ATTR} />
        <TileLayer url={LABELS_URL} />
        {valid.map((p) => (
          <CircleMarker
            key={p.id}
            center={[p.lat, p.lng]}
            radius={p.alert ? 9 : 7}
            pathOptions={{
              color: p.alert ? "hsl(0 75% 60%)" : "hsl(28 100% 60%)",
              fillColor: p.alert ? "hsl(0 75% 55%)" : "hsl(28 100% 55%)",
              fillOpacity: 0.85,
              weight: 2,
            }}
            eventHandlers={p.onClick ? { click: () => p.onClick?.() } : undefined}
          >
            <Tooltip direction="top" offset={[0, -6]} opacity={0.95}>
              <div className="text-xs">
                <div className="font-medium">{p.name}</div>
                {p.subtitle && <div className="text-[10px] opacity-70">{p.subtitle}</div>}
                {p.alert && <div className="text-[10px] text-red-400 mt-0.5">⚠ Atividades pendentes</div>}
              </div>
            </Tooltip>
            <Popup>
              <div className="text-xs">
                <div className="font-medium">{p.name}</div>
                {p.subtitle && <div className="opacity-70">{p.subtitle}</div>}
              </div>
            </Popup>
          </CircleMarker>
        ))}
      </MapContainer>

      {!valid.length && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-background/40 backdrop-blur-[1px]">
          <p className="text-xs text-muted-foreground bg-card/90 border border-border/40 rounded-md px-3 py-1.5">
            Cadastre latitude/longitude em contatos ou projetos para vê-los no mapa.
          </p>
        </div>
      )}
    </div>
  );
};
