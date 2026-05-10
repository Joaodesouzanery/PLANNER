import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MapContainer, TileLayer, useMap, useMapEvents } from "react-leaflet";
import { AlertTriangle, BookOpen, BriefcaseBusiness, ExternalLink, FolderKanban, ListTodo, MapPin as MapPinIcon } from "lucide-react";
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
  x: number;
  y: number;
}

const TILE_URL = "https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png";
const LABELS_URL = "https://{s}.basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}{r}.png";
const TILE_ATTR =
  '&copy; <a href="https://carto.com/">CARTO</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';

const PIN_STYLE: Record<MapPinKind, { bg: string; fg: string; borderRadius: string; Icon: typeof MapPinIcon; label: string }> = {
  project: { bg: "hsl(262 78% 58%)", fg: "white", borderRadius: "10px", Icon: FolderKanban, label: "Projeto" },
  client: { bg: "hsl(158 64% 42%)", fg: "white", borderRadius: "999px", Icon: BriefcaseBusiness, label: "Cliente" },
  task: { bg: "hsl(37 92% 50%)", fg: "hsl(24 10% 10%)", borderRadius: "8px", Icon: ListTodo, label: "Tarefa" },
  faculdade: { bg: "hsl(190 86% 45%)", fg: "white", borderRadius: "8px", Icon: BookOpen, label: "Faculdade" },
  default: { bg: "hsl(28 100% 55%)", fg: "white", borderRadius: "999px", Icon: MapPinIcon, label: "Ponto" },
};

const PROJECT_COLORS = [
  "hsl(262 78% 58%)",
  "hsl(217 91% 60%)",
  "hsl(190 86% 45%)",
  "hsl(330 81% 60%)",
  "hsl(45 93% 47%)",
  "hsl(12 76% 56%)",
];

const KIND_ORDER: Record<MapPinKind, number> = {
  project: 0,
  client: 1,
  task: 2,
  faculdade: 3,
  default: 4,
};

const sortPins = (pins: MapPin[]) =>
  [...pins].sort((a, b) => {
    const kindA = a.kind || "default";
    const kindB = b.kind || "default";
    const kindDiff = KIND_ORDER[kindA] - KIND_ORDER[kindB];
    if (kindDiff !== 0) return kindDiff;
    return `${a.name}-${a.id}`.localeCompare(`${b.name}-${b.id}`);
  });

const hashString = (value: string) =>
  value.split("").reduce((hash, char) => ((hash << 5) - hash + char.charCodeAt(0)) | 0, 0);

const projectColor = (id: string) => PROJECT_COLORS[Math.abs(hashString(id)) % PROJECT_COLORS.length];

const compactOffset = (index: number, count: number) => {
  if (count === 1) return { x: 0, y: 0 };

  const columns = count <= 4 ? 2 : count <= 9 ? 3 : 4;
  const gap = 34;
  const rows = Math.ceil(count / columns);
  const row = Math.floor(index / columns);
  const col = index % columns;
  const itemsInRow = row === rows - 1 ? count - row * columns : columns;
  const rowWidth = (itemsInRow - 1) * gap;
  const gridHeight = (rows - 1) * gap;

  return {
    x: Math.round(col * gap - rowWidth / 2),
    y: Math.round(row * gap - gridHeight / 2),
  };
};

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const PinGlyph = ({ id, kind = "default", alert = false }: { id: string; kind?: MapPinKind; alert?: boolean }) => {
  const style = PIN_STYLE[kind] || PIN_STYLE.default;
  const Icon = style.Icon;
  const background = kind === "project" ? projectColor(id) : style.bg;
  const projectInitial = kind === "project" ? id.replace(/^p-/, "").slice(0, 1).toUpperCase() : null;

  return (
    <div
      className="relative grid h-[30px] w-[30px] place-items-center border-2 border-white/90 shadow-[0_10px_24px_rgba(0,0,0,.35)]"
      style={{
        color: style.fg,
        background,
        borderRadius: style.borderRadius,
        boxShadow: alert
          ? "0 0 0 5px rgba(239,68,68,.22), 0 10px 24px rgba(0,0,0,.35)"
          : "0 10px 24px rgba(0,0,0,.35)",
      }}
    >
      <Icon size={15} strokeWidth={2.4} />
      {projectInitial && (
        <span className="absolute -right-1 -top-1 grid h-3.5 min-w-3.5 place-items-center rounded-full border border-white/80 bg-background px-0.5 text-[8px] font-bold text-foreground">
          {projectInitial}
        </span>
      )}
      {alert && <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border border-white bg-red-500" />}
    </div>
  );
};

const MapPinOverlay = ({ pins }: { pins: MapPin[] }) => {
  const map = useMap();
  const rafRef = useRef<number>();
  const [visiblePins, setVisiblePins] = useState<VisiblePin[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const calculatePins = useCallback(() => {
    const sortedPins = sortPins(pins);
    const size = map.getSize();
    const projected = sortedPins.map((pin) => ({
      pin,
      point: map.latLngToContainerPoint([pin.lat, pin.lng]),
    }));
    const groups: Array<{ items: typeof projected; x: number; y: number }> = [];
    const threshold = 44;

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

    const margin = 18;
    setVisiblePins(
      groups.flatMap((group) =>
        group.items.map((item, index) => {
          const offset = group.items.length > 1 ? compactOffset(index, group.items.length) : { x: 0, y: 0 };
          const x = clamp(group.x + offset.x, margin, Math.max(margin, size.x - margin));
          const y = clamp(group.y + offset.y, margin, Math.max(margin, size.y - margin));
          return {
            ...item.pin,
            x,
            y,
          };
        })
      )
    );
  }, [map, pins]);

  const scheduleUpdate = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(calculatePins);
  }, [calculatePins]);

  useMapEvents({
    move: scheduleUpdate,
    zoom: scheduleUpdate,
    moveend: scheduleUpdate,
    zoomend: scheduleUpdate,
    resize: scheduleUpdate,
  });

  useEffect(() => {
    scheduleUpdate();
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [scheduleUpdate]);

  useEffect(() => {
    if (activeId && !pins.some((pin) => pin.id === activeId)) setActiveId(null);
    if (hoveredId && !pins.some((pin) => pin.id === hoveredId)) setHoveredId(null);
  }, [activeId, hoveredId, pins]);

  const activePin = visiblePins.find((pin) => pin.id === activeId);
  const hoveredPin = visiblePins.find((pin) => pin.id === hoveredId && pin.id !== activeId);
  const detailPin = activePin || hoveredPin;

  return (
    <div className="pointer-events-none absolute inset-0 z-[700]">
      {visiblePins.map((pin, index) => {
        const kind = pin.kind || "default";
        const style = PIN_STYLE[kind] || PIN_STYLE.default;
        return (
          <button
            key={pin.id}
            type="button"
            className="pointer-events-auto absolute grid h-[34px] w-[34px] place-items-center outline-none transition-transform hover:scale-110 focus-visible:ring-2 focus-visible:ring-white/80"
            style={{
              left: pin.x,
              top: pin.y,
              zIndex: 800 + index,
              transform: "translate(-50%, -50%)",
            }}
            aria-label={`${style.label}: ${pin.name}`}
            onMouseEnter={() => setHoveredId(pin.id)}
            onMouseLeave={() => setHoveredId((current) => (current === pin.id ? null : current))}
            onMouseDown={(event) => event.stopPropagation()}
            onClick={(event) => {
              event.stopPropagation();
              setActiveId((current) => (current === pin.id ? null : pin.id));
            }}
          >
            <PinGlyph id={pin.id} kind={kind} alert={pin.alert} />
          </button>
        );
      })}

      {detailPin && (
        <div
          className="pointer-events-auto absolute w-[260px] max-w-[calc(100%-24px)] overflow-hidden rounded-md border border-white/10 bg-popover text-xs text-popover-foreground shadow-xl backdrop-blur animate-in fade-in-0 zoom-in-95"
          style={{
            left: detailPin.x,
            top: detailPin.y - 22,
            zIndex: 1200,
            transform: "translate(-50%, -100%)",
          }}
          onMouseDown={(event) => event.stopPropagation()}
        >
          <div className="h-1.5" style={{ background: detailPin.kind === "project" ? projectColor(detailPin.id) : PIN_STYLE[detailPin.kind || "default"]?.bg }} />
          <div className="space-y-2 p-3">
            <div>
              <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                {PIN_STYLE[detailPin.kind || "default"]?.label || "Ponto"}
              </div>
              <div className="mt-0.5 font-semibold leading-tight text-foreground">{detailPin.name}</div>
              {detailPin.subtitle && <div className="mt-1 text-[11px] text-muted-foreground">{detailPin.subtitle}</div>}
            </div>
            {detailPin.alert && (
              <div className="flex items-center gap-1.5 rounded-md bg-red-500/10 px-2 py-1.5 text-[11px] text-red-400">
                <AlertTriangle className="h-3.5 w-3.5" />
                Atividades pendentes
              </div>
            )}
            {detailPin.onClick && (
              <button
                type="button"
                className="inline-flex h-8 w-full items-center justify-center gap-1.5 rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90"
                onClick={(event) => {
                  event.stopPropagation();
                  detailPin.onClick?.();
                }}
              >
                Abrir <ExternalLink className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>
      )}
    </div>
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
        "[&_.leaflet-container]:z-0 [&_.leaflet-control-container]:relative [&_.leaflet-control-container]:z-[2] [&_.leaflet-pane]:z-0 [&_.leaflet-top]:z-[3] [&_.leaflet-bottom]:z-[3]",
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
        <MapPinOverlay pins={valid} />
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
