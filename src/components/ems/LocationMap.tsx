import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MapContainer, TileLayer, useMap, useMapEvents } from "react-leaflet";
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
  baseX: number;
  baseY: number;
  x: number;
  y: number;
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

const spreadOffset = (index: number, count: number) => {
  if (count === 2) return { x: index === 0 ? -25 : 25, y: 0 };
  if (count === 3) {
    const positions = [{ x: 0, y: -28 }, { x: -28, y: 20 }, { x: 28, y: 20 }];
    return positions[index];
  }

  const ring = Math.floor(index / 8);
  const positionInRing = index % 8;
  const itemsInRing = Math.min(8, count - ring * 8);
  const radius = 34 + ring * 24;
  const angle = (Math.PI * 2 * positionInRing) / itemsInRing - Math.PI / 2;
  return {
    x: Math.round(Math.cos(angle) * radius),
    y: Math.round(Math.sin(angle) * radius),
  };
};

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const PinGlyph = ({ kind = "default", alert = false }: { kind?: MapPinKind; alert?: boolean }) => {
  const style = PIN_STYLE[kind] || PIN_STYLE.default;
  const Icon = style.Icon;

  return (
    <div
      className="grid h-[30px] w-[30px] place-items-center rounded-full border-2 border-white/90 shadow-[0_10px_24px_rgba(0,0,0,.35)]"
      style={{
        color: style.fg,
        background: alert ? "hsl(0 75% 55%)" : style.bg,
        boxShadow: alert
          ? "0 0 0 6px rgba(239,68,68,.22), 0 10px 24px rgba(0,0,0,.35)"
          : "0 10px 24px rgba(0,0,0,.35)",
      }}
    >
      <Icon size={15} strokeWidth={2.4} />
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
          const offset = group.items.length > 1 ? spreadOffset(index, group.items.length) : { x: 0, y: 0 };
          const x = clamp(item.point.x + offset.x, margin, Math.max(margin, size.x - margin));
          const y = clamp(item.point.y + offset.y, margin, Math.max(margin, size.y - margin));
          return {
            ...item.pin,
            baseX: item.point.x,
            baseY: item.point.y,
            x,
            y,
            offsetX: x - item.point.x,
            offsetY: y - item.point.y,
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
      <svg className="absolute inset-0 h-full w-full overflow-visible" aria-hidden>
        {visiblePins.map((pin) => {
          if (Math.abs(pin.offsetX) < 2 && Math.abs(pin.offsetY) < 2) return null;
          return (
            <g key={`line-${pin.id}`}>
              <line x1={pin.baseX} y1={pin.baseY} x2={pin.x} y2={pin.y} stroke="rgba(255,255,255,.42)" strokeWidth="1" />
              <circle cx={pin.baseX} cy={pin.baseY} r="2" fill="rgba(255,255,255,.62)" />
            </g>
          );
        })}
      </svg>

      {visiblePins.map((pin, index) => {
        const kind = pin.kind || "default";
        const style = PIN_STYLE[kind] || PIN_STYLE.default;
        return (
          <button
            key={pin.id}
            type="button"
            className="pointer-events-auto absolute grid h-[34px] w-[34px] place-items-center rounded-full outline-none transition-transform hover:scale-110 focus-visible:ring-2 focus-visible:ring-white/80"
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
              pin.onClick?.();
            }}
          >
            <PinGlyph kind={kind} alert={pin.alert} />
          </button>
        );
      })}

      {detailPin && (
        <div
          className="pointer-events-auto absolute min-w-[170px] max-w-[240px] rounded-lg border border-white/10 bg-popover/95 px-3 py-2 text-xs text-popover-foreground shadow-xl backdrop-blur"
          style={{
            left: detailPin.x,
            top: detailPin.y - 22,
            zIndex: 1200,
            transform: "translate(-50%, -100%)",
          }}
          onMouseDown={(event) => event.stopPropagation()}
        >
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{PIN_STYLE[detailPin.kind || "default"]?.label || "Ponto"}</div>
          <div className="font-medium">{detailPin.name}</div>
          {detailPin.subtitle && <div className="mt-0.5 text-[10px] text-muted-foreground">{detailPin.subtitle}</div>}
          {detailPin.alert && <div className="mt-1 text-[10px] text-red-400">Atividades pendentes</div>}
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
