import { useMemo } from "react";
import { divIcon } from "leaflet";
import { renderToStaticMarkup } from "react-dom/server";
import { MapContainer, Marker, Popup, TileLayer, Tooltip } from "react-leaflet";
import { BookOpen, BriefcaseBusiness, FolderKanban, ListTodo, MapPin as MapPinIcon } from "lucide-react";
import "leaflet/dist/leaflet.css";
import { cn } from "@/lib/utils";

export type MapPinKind = "project" | "client" | "task" | "faculdade" | "default";

export interface MapPin {
  id: string;
  name: string;
  subtitle?: string;
  lat: number;
  lng: number;
  kind?: MapPinKind;
  alert?: boolean;
  onClick?: () => void;
}

interface LocationMapProps {
  pins: MapPin[];
  height?: number | string;
  className?: string;
  fallbackCenter?: [number, number];
  fallbackZoom?: number;
}

const TILE_URL = "https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png";
const LABELS_URL = "https://{s}.basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}{r}.png";
const TILE_ATTR =
  '&copy; <a href="https://carto.com/">CARTO</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';

const PIN_STYLE: Record<MapPinKind, { bg: string; fg: string; Icon: typeof MapPinIcon; label: string }> = {
  project: { bg: "hsl(262 78% 58%)", fg: "white", Icon: FolderKanban, label: "Projeto" },
  client: { bg: "hsl(158 64% 42%)", fg: "white", Icon: BriefcaseBusiness, label: "Cliente" },
  task: { bg: "hsl(37 92% 50%)", fg: "hsl(24 10% 10%)", Icon: ListTodo, label: "Tarefa" },
  faculdade: { bg: "hsl(190 86% 45%)", fg: "white", Icon: BookOpen, label: "Faculdade" },
  default: { bg: "hsl(28 100% 55%)", fg: "white", Icon: MapPinIcon, label: "Ponto" },
};

const groupPinOffsets = (pins: MapPin[]) => {
  const groups = new Map<string, MapPin[]>();
  pins.forEach((pin) => {
    const key = `${pin.lat.toFixed(5)},${pin.lng.toFixed(5)}`;
    groups.set(key, [...(groups.get(key) || []), pin]);
  });

  const offsets = new Map<string, { x: number; y: number }>();
  groups.forEach((items) => {
    if (items.length === 1) {
      offsets.set(items[0].id, { x: 0, y: 0 });
      return;
    }

    items.forEach((item, index) => {
      const ring = Math.floor(index / 8);
      const positionInRing = index % 8;
      const itemsInRing = Math.min(8, items.length - ring * 8);
      const radius = 24 + ring * 18;
      const angle = (Math.PI * 2 * positionInRing) / itemsInRing - Math.PI / 2;
      offsets.set(item.id, {
        x: Math.round(Math.cos(angle) * radius),
        y: Math.round(Math.sin(angle) * radius),
      });
    });
  });

  return offsets;
};

const buildPinIcon = (kind: MapPinKind = "default", alert = false, offset = { x: 0, y: 0 }) => {
  const style = PIN_STYLE[kind] || PIN_STYLE.default;
  const Icon = style.Icon;
  const html = renderToStaticMarkup(
    <div
      style={{
        width: 120,
        height: 120,
        position: "relative",
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          width: 30,
          height: 30,
          left: 45 + offset.x,
          top: 45 + offset.y,
          position: "absolute",
          borderRadius: 999,
          display: "grid",
          placeItems: "center",
          color: style.fg,
          background: alert ? "hsl(0 75% 55%)" : style.bg,
          border: "2px solid rgba(255,255,255,.92)",
          boxShadow: alert
            ? "0 0 0 6px rgba(239,68,68,.22), 0 10px 24px rgba(0,0,0,.35)"
            : "0 10px 24px rgba(0,0,0,.35)",
          pointerEvents: "auto",
        }}
      >
        <Icon size={15} strokeWidth={2.4} />
      </div>
    </div>
  );

  return divIcon({
    html,
    className: "ems-map-pin",
    iconSize: [120, 120],
    iconAnchor: [60, 60],
    popupAnchor: [offset.x, offset.y - 18],
  });
};

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
  const visualOffsets = useMemo(() => groupPinOffsets(valid), [valid]);

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-xl border border-border/40 bg-[hsl(220_14%_13%)] [&_.leaflet-tile]:brightness-[1.16] [&_.leaflet-tile]:contrast-[0.95]",
        "[&_.leaflet-container]:z-0 [&_.leaflet-control-container]:relative [&_.leaflet-control-container]:z-[1] [&_.leaflet-pane]:z-0 [&_.leaflet-top]:z-[2] [&_.leaflet-bottom]:z-[2]",
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
        {valid.map((p) => {
          const kind = p.kind || "default";
          const offset = visualOffsets.get(p.id) || { x: 0, y: 0 };
          return (
            <Marker
              key={p.id}
              position={[p.lat, p.lng]}
              icon={buildPinIcon(kind, p.alert, offset)}
              eventHandlers={p.onClick ? { click: () => p.onClick?.() } : undefined}
            >
              <Tooltip direction="top" offset={[offset.x, offset.y - 6]} opacity={0.95}>
                <div className="text-xs">
                  <div className="text-[10px] uppercase tracking-wide opacity-60">{PIN_STYLE[kind]?.label || "Ponto"}</div>
                  <div className="font-medium">{p.name}</div>
                  {p.subtitle && <div className="text-[10px] opacity-70">{p.subtitle}</div>}
                  {p.alert && <div className="text-[10px] text-red-400 mt-0.5">Atividades pendentes</div>}
                </div>
              </Tooltip>
              <Popup>
                <div className="text-xs">
                  <div className="text-[10px] uppercase tracking-wide opacity-60">{PIN_STYLE[kind]?.label || "Ponto"}</div>
                  <div className="font-medium">{p.name}</div>
                  {p.subtitle && <div className="opacity-70">{p.subtitle}</div>}
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>

      {!valid.length && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-background/40 backdrop-blur-[1px]">
          <p className="rounded-md border border-border/40 bg-card/90 px-3 py-1.5 text-xs text-muted-foreground">
            Cadastre latitude/longitude em contatos, clientes ou projetos para vê-los no mapa.
          </p>
        </div>
      )}
    </div>
  );
};
