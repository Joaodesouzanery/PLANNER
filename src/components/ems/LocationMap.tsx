import { useMemo, useState } from "react";
import { divIcon } from "leaflet";
import { renderToStaticMarkup } from "react-dom/server";
import { MapContainer, Marker, Popup, TileLayer, Tooltip, useMapEvents } from "react-leaflet";
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

interface VisiblePin extends MapPin {
  offsetX: number;
  offsetY: number;
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

const spreadOffset = (index: number, count: number) => {
  if (count === 2) return { x: index === 0 ? -22 : 22, y: 0 };
  if (count === 3) {
    const positions = [{ x: 0, y: -24 }, { x: -24, y: 18 }, { x: 24, y: 18 }];
    return positions[index];
  }

  const ring = Math.floor(index / 8);
  const positionInRing = index % 8;
  const itemsInRing = Math.min(8, count - ring * 8);
  const radius = 26 + ring * 20;
  const angle = (Math.PI * 2 * positionInRing) / itemsInRing - Math.PI / 2;
  return {
    x: Math.round(Math.cos(angle) * radius),
    y: Math.round(Math.sin(angle) * radius),
  };
};

const buildPinIcon = (kind: MapPinKind = "default", alert = false, offsetX = 0, offsetY = 0) => {
  const style = PIN_STYLE[kind] || PIN_STYLE.default;
  const Icon = style.Icon;
  const html = renderToStaticMarkup(
    <div
      style={{
        width: 30,
        height: 30,
        borderRadius: 999,
        display: "grid",
        placeItems: "center",
        color: style.fg,
        background: alert ? "hsl(0 75% 55%)" : style.bg,
        border: "2px solid rgba(255,255,255,.92)",
        boxShadow: alert
          ? "0 0 0 6px rgba(239,68,68,.22), 0 10px 24px rgba(0,0,0,.35)"
          : "0 10px 24px rgba(0,0,0,.35)",
        transform: `translate(${offsetX}px, ${offsetY}px)`,
      }}
    >
      <Icon size={15} strokeWidth={2.4} />
    </div>
  );

  return divIcon({
    html,
    className: "ems-map-pin",
    iconSize: [30, 30],
    iconAnchor: [15, 15],
    popupAnchor: [offsetX, offsetY - 14],
  });
};

const MapMarkers = ({ pins }: { pins: MapPin[] }) => {
  const [viewTick, setViewTick] = useState(0);
  const map = useMapEvents({
    moveend: () => setViewTick((tick) => tick + 1),
    zoomend: () => setViewTick((tick) => tick + 1),
    resize: () => setViewTick((tick) => tick + 1),
  });

  const visiblePins = useMemo<VisiblePin[]>(() => {
    const projected = pins.map((pin) => ({
      pin,
      point: map.latLngToContainerPoint([pin.lat, pin.lng]),
    }));
    const groups: Array<{ items: typeof projected; x: number; y: number }> = [];
    const threshold = 42;

    projected.forEach((item) => {
      const group = groups.find((candidate) => {
        const dx = candidate.x - item.point.x;
        const dy = candidate.y - item.point.y;
        return Math.sqrt(dx * dx + dy * dy) <= threshold;
      });

      if (!group) {
        groups.push({ items: [item], x: item.point.x, y: item.point.y });
        return;
      }

      group.items.push(item);
      group.x = group.items.reduce((sum, entry) => sum + entry.point.x, 0) / group.items.length;
      group.y = group.items.reduce((sum, entry) => sum + entry.point.y, 0) / group.items.length;
    });

    return groups.flatMap((group) => {
      if (group.items.length === 1) {
        const item = group.items[0];
        return [{ ...item.pin, offsetX: 0, offsetY: 0 }];
      }

      return group.items.map((item, index) => {
        const offset = spreadOffset(index, group.items.length);
        return { ...item.pin, offsetX: offset.x, offsetY: offset.y };
      });
    });
  }, [map, pins, viewTick]);

  return (
    <>
      {visiblePins.map((pin, index) => {
        const kind = pin.kind || "default";
        return (
          <Marker
            key={pin.id}
            position={[pin.lat, pin.lng]}
            icon={buildPinIcon(kind, pin.alert, pin.offsetX, pin.offsetY)}
            zIndexOffset={1000 + index}
            eventHandlers={pin.onClick ? { click: () => pin.onClick?.() } : undefined}
          >
            <Tooltip direction="top" offset={[pin.offsetX, pin.offsetY - 6]} opacity={0.95}>
              <div className="text-xs">
                <div className="text-[10px] uppercase tracking-wide opacity-60">{PIN_STYLE[kind]?.label || "Ponto"}</div>
                <div className="font-medium">{pin.name}</div>
                {pin.subtitle && <div className="text-[10px] opacity-70">{pin.subtitle}</div>}
                {pin.alert && <div className="text-[10px] text-red-400 mt-0.5">Atividades pendentes</div>}
              </div>
            </Tooltip>
            <Popup>
              <div className="text-xs">
                <div className="text-[10px] uppercase tracking-wide opacity-60">{PIN_STYLE[kind]?.label || "Ponto"}</div>
                <div className="font-medium">{pin.name}</div>
                {pin.subtitle && <div className="opacity-70">{pin.subtitle}</div>}
              </div>
            </Popup>
          </Marker>
        );
      })}
    </>
  );
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
        <MapMarkers pins={valid} />
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
