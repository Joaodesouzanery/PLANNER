import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MapContainer, TileLayer, useMap, useMapEvents } from "react-leaflet";
import { AlertTriangle, ExternalLink } from "lucide-react";
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

// Marcador uniforme: cada tipo é uma COR (sem ícones lucide amontoados). Aglomerados viram uma bolha
// com a contagem que abre (spiderfy) no clique — resolve os pins "colados" na mesma coordenada.
const KIND_COLOR: Record<MapPinKind, string> = {
  project: "hsl(262 78% 58%)",
  client: "hsl(158 64% 42%)",
  task: "hsl(37 92% 50%)",
  faculdade: "hsl(190 86% 45%)",
  default: "hsl(28 100% 55%)",
};
const KIND_LABEL: Record<MapPinKind, string> = {
  project: "Projeto",
  client: "Cliente",
  task: "Tarefa",
  faculdade: "Faculdade",
  default: "Ponto",
};

const PROJECT_COLORS = [
  "hsl(262 78% 58%)",
  "hsl(217 91% 60%)",
  "hsl(190 86% 45%)",
  "hsl(330 81% 60%)",
  "hsl(45 93% 47%)",
  "hsl(12 76% 56%)",
];

const KIND_ORDER: Record<MapPinKind, number> = { project: 0, client: 1, task: 2, faculdade: 3, default: 4 };

const sortPins = (pins: MapPin[]) =>
  [...pins].sort((a, b) => {
    const diff = KIND_ORDER[a.kind || "default"] - KIND_ORDER[b.kind || "default"];
    if (diff !== 0) return diff;
    return `${a.name}-${a.id}`.localeCompare(`${b.name}-${b.id}`);
  });

const hashString = (value: string) =>
  value.split("").reduce((hash, char) => ((hash << 5) - hash + char.charCodeAt(0)) | 0, 0);
const projectColor = (id: string) => PROJECT_COLORS[Math.abs(hashString(id)) % PROJECT_COLORS.length];
const dotColor = (pin: MapPin) => (pin.kind === "project" ? projectColor(pin.id) : KIND_COLOR[pin.kind || "default"]);

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);
const dist = (ax: number, ay: number, bx: number, by: number) => Math.hypot(ax - bx, ay - by);

// Posições em círculo (spiderfy) ao redor do centroide; o raio cresce com a contagem.
const spiderPositions = (cx: number, cy: number, n: number) => {
  const R = 24 + Math.min(n, 14) * 6;
  return Array.from({ length: n }, (_, i) => {
    const a = (2 * Math.PI * i) / n - Math.PI / 2;
    return { x: cx + Math.cos(a) * R, y: cy + Math.sin(a) * R };
  });
};

interface Cluster {
  id: string;
  x: number;
  y: number;
  items: MapPin[];
}

const MapPinOverlay = ({ pins }: { pins: MapPin[] }) => {
  const map = useMap();
  const rafRef = useRef<number>();
  const [clusters, setClusters] = useState<Cluster[]>([]);
  const [openClusterId, setOpenClusterId] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  // Agrupa por proximidade em PIXELS no zoom atual. Pins na mesma coordenada caem num grupo só (bolha);
  // ao aproximar o zoom, pins vizinhos se afastam em pixels e o grupo se desfaz naturalmente.
  const calculatePins = useCallback(() => {
    const size = map.getSize();
    const threshold = 42;
    const margin = 20;
    const groups: { items: MapPin[]; sx: number; sy: number; x: number; y: number }[] = [];
    sortPins(pins).forEach((pin) => {
      const pt = map.latLngToContainerPoint([pin.lat, pin.lng]);
      const g = groups.find((c) => dist(c.x, c.y, pt.x, pt.y) <= threshold);
      if (!g) {
        groups.push({ items: [pin], sx: pt.x, sy: pt.y, x: pt.x, y: pt.y });
      } else {
        g.items.push(pin);
        g.sx += pt.x;
        g.sy += pt.y;
        g.x = g.sx / g.items.length;
        g.y = g.sy / g.items.length;
      }
    });
    setClusters(
      groups.map((g) => ({
        id: g.items[0].id,
        x: clamp(g.x, margin, Math.max(margin, size.x - margin)),
        y: clamp(g.y, margin, Math.max(margin, size.y - margin)),
        items: g.items,
      })),
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
    click: () => {
      setOpenClusterId(null);
      setActiveId(null);
    },
  });

  useEffect(() => {
    scheduleUpdate();
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [scheduleUpdate]);

  // Limpa estado morto quando os pins/clusters mudam.
  useEffect(() => {
    if (activeId && !pins.some((p) => p.id === activeId)) setActiveId(null);
    if (hoveredId && !pins.some((p) => p.id === hoveredId)) setHoveredId(null);
    if (openClusterId && !clusters.some((c) => c.id === openClusterId)) setOpenClusterId(null);
  }, [activeId, hoveredId, openClusterId, pins, clusters]);

  // Monta o que renderizar: singles + membros do cluster aberto (spiderfy) + bolhas + pernas.
  const size = map.getSize();
  const markers: { pin: MapPin; x: number; y: number }[] = [];
  const bubbles: { cl: Cluster; open: boolean; s: number }[] = [];
  const legs: { x1: number; y1: number; x2: number; y2: number }[] = [];
  for (const cl of clusters) {
    if (cl.items.length === 1) {
      markers.push({ pin: cl.items[0], x: cl.x, y: cl.y });
      continue;
    }
    const open = openClusterId === cl.id;
    bubbles.push({ cl, open, s: open ? 24 : Math.round(30 + Math.min(cl.items.length, 30) * 0.7) });
    if (open) {
      const pos = spiderPositions(cl.x, cl.y, cl.items.length);
      cl.items.forEach((p, i) => {
        const x = clamp(pos[i].x, 12, Math.max(12, size.x - 12));
        const y = clamp(pos[i].y, 12, Math.max(12, size.y - 12));
        markers.push({ pin: p, x, y });
        legs.push({ x1: cl.x, y1: cl.y, x2: x, y2: y });
      });
    }
  }

  const detail =
    markers.find((mk) => mk.pin.id === activeId) ||
    markers.find((mk) => mk.pin.id === hoveredId && mk.pin.id !== activeId);

  return (
    <div className="pointer-events-none absolute inset-0 z-[700]">
      {legs.length > 0 && (
        <svg className="absolute inset-0 h-full w-full" style={{ zIndex: 750 }}>
          {legs.map((l, i) => (
            <line key={i} x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2} stroke="rgba(255,255,255,.35)" strokeWidth={1.5} strokeDasharray="2 3" />
          ))}
        </svg>
      )}

      {bubbles.map(({ cl, open, s }) => (
        <button
          key={cl.id}
          type="button"
          className="pointer-events-auto absolute grid place-items-center rounded-full border-2 border-white/90 font-bold text-white outline-none transition-transform hover:scale-105 focus-visible:ring-2 focus-visible:ring-white/80"
          style={{
            left: cl.x,
            top: cl.y,
            width: s,
            height: s,
            transform: "translate(-50%, -50%)",
            zIndex: open ? 810 : 800,
            fontSize: open ? 10 : 12,
            background: open ? "rgba(30,41,59,.72)" : "rgba(30,41,59,.94)",
            boxShadow: "0 6px 16px rgba(0,0,0,.4)",
          }}
          aria-label={`${cl.items.length} pontos agrupados`}
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            setActiveId(null);
            setOpenClusterId((c) => (c === cl.id ? null : cl.id));
          }}
        >
          {cl.items.length}
        </button>
      ))}

      {markers.map((mk, index) => (
        <button
          key={mk.pin.id}
          type="button"
          className="pointer-events-auto absolute grid h-[26px] w-[26px] place-items-center outline-none transition-transform hover:scale-110 focus-visible:ring-2 focus-visible:ring-white/80"
          style={{ left: mk.x, top: mk.y, zIndex: 820 + index, transform: "translate(-50%, -50%)" }}
          aria-label={`${KIND_LABEL[mk.pin.kind || "default"]}: ${mk.pin.name}`}
          onMouseEnter={() => setHoveredId(mk.pin.id)}
          onMouseLeave={() => setHoveredId((c) => (c === mk.pin.id ? null : c))}
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            setActiveId((c) => (c === mk.pin.id ? null : mk.pin.id));
          }}
        >
          <span
            className="block rounded-full border-2 border-white/90"
            style={{
              width: 16,
              height: 16,
              background: dotColor(mk.pin),
              boxShadow: mk.pin.alert
                ? "0 0 0 4px rgba(239,68,68,.25), 0 4px 10px rgba(0,0,0,.4)"
                : "0 4px 10px rgba(0,0,0,.4)",
            }}
          />
        </button>
      ))}

      {detail && (
        <div
          className="pointer-events-auto absolute w-[260px] max-w-[calc(100%-24px)] overflow-hidden rounded-md border border-white/10 bg-popover text-xs text-popover-foreground shadow-xl backdrop-blur animate-in fade-in-0 zoom-in-95"
          style={{ left: detail.x, top: detail.y - 20, zIndex: 1200, transform: "translate(-50%, -100%)" }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <div className="h-1.5" style={{ background: dotColor(detail.pin) }} />
          <div className="space-y-2 p-3">
            <div>
              <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                {KIND_LABEL[detail.pin.kind || "default"]}
              </div>
              <div className="mt-0.5 font-semibold leading-tight text-foreground">{detail.pin.name}</div>
              {detail.pin.subtitle && <div className="mt-1 text-[11px] text-muted-foreground">{detail.pin.subtitle}</div>}
            </div>
            {detail.pin.alert && (
              <div className="flex items-center gap-1.5 rounded-md bg-red-500/10 px-2 py-1.5 text-[11px] text-red-400">
                <AlertTriangle className="h-3.5 w-3.5" />
                Atividades pendentes
              </div>
            )}
            {detail.pin.onClick && (
              <button
                type="button"
                className="inline-flex h-8 w-full items-center justify-center gap-1.5 rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90"
                onClick={(e) => {
                  e.stopPropagation();
                  detail.pin.onClick?.();
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
  const valid = useMemo(() => pins.filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng)), [pins]);

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
        className,
      )}
      style={{ height }}
    >
      <MapContainer center={center} zoom={zoom} scrollWheelZoom className="h-full w-full" style={{ background: "hsl(220 14% 13%)" }}>
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
