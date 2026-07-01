// Lightweight Nominatim geocoder used as save-time fallback.
export interface GeocodeResult {
  label: string;
  lat: number;
  lng: number;
}

export async function geocodeAddress(query: string): Promise<GeocodeResult | null> {
  const q = (query || "").trim();
  if (q.length < 4) return null;
  try {
    const url = new URL("https://nominatim.openstreetmap.org/search");
    url.searchParams.set("format", "jsonv2");
    url.searchParams.set("limit", "1");
    url.searchParams.set("q", q);
    const res = await fetch(url.toString(), { headers: { Accept: "application/json" } });
    if (!res.ok) return null;
    const data = await res.json();
    const first = (data || [])[0];
    if (!first) return null;
    return { label: first.display_name, lat: Number(first.lat), lng: Number(first.lon) };
  } catch {
    return null;
  }
}

export async function ensureCoords(
  address: string,
  lat: string | number | null | undefined,
  lng: string | number | null | undefined,
): Promise<{ latitude: number | null; longitude: number | null }> {
  const hasLat = lat !== null && lat !== undefined && String(lat).trim() !== "";
  const hasLng = lng !== null && lng !== undefined && String(lng).trim() !== "";
  if (hasLat && hasLng) {
    return { latitude: Number(lat), longitude: Number(lng) };
  }
  if (!address?.trim()) return { latitude: null, longitude: null };
  const result = await geocodeAddress(address);
  if (!result) return { latitude: null, longitude: null };
  return { latitude: result.lat, longitude: result.lng };
}

// Expands a list of transactions, projecting recurring (monthly) entries
// across every month from their start date up to "today" so dashboards
// reflect ongoing income/expense correctly.
export interface RecurringTx {
  id: string;
  amount: number | string;
  type: string;
  date: string;
  is_recurring?: boolean | null;
  recurrence_interval?: string | null;
  category?: string | null;
  source_id?: string | null;
  is_projected?: boolean | null;
  projection_index?: number | null;
}

export function parseDateOnly(value: string): Date | null {
  const [year, month, day] = String(value || "").slice(0, 10).split("-").map(Number);
  if (!year || !month || !day) return null;
  const date = new Date(year, month - 1, day, 12, 0, 0, 0);
  return Number.isNaN(date.getTime()) ? null : date;
}

const toIsoDate = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

const lastDayOfMonth = (year: number, monthIndex: number) => new Date(year, monthIndex + 1, 0).getDate();

const addRecurringInterval = (date: Date, interval: string, originalDay: number) => {
  if (interval === "weekly" || interval === "semanal" || interval === "week") {
    const next = new Date(date);
    next.setDate(next.getDate() + 7);
    return next;
  }

  const monthStep = interval === "yearly" || interval === "anual" || interval === "annual" || interval === "year" ? 12 : 1;
  const targetMonthIndex = date.getMonth() + monthStep;
  const targetYear = date.getFullYear() + Math.floor(targetMonthIndex / 12);
  const normalizedMonthIndex = ((targetMonthIndex % 12) + 12) % 12;
  const targetDay = Math.min(originalDay, lastDayOfMonth(targetYear, normalizedMonthIndex));
  return new Date(targetYear, normalizedMonthIndex, targetDay, 12, 0, 0, 0);
};

// `horizon` define ate quando projetar as recorrencias (default: hoje, ou seja,
// so o passado). Passe uma data futura (ex.: 31/12 do ano) para projetar adiante.
export function expandRecurringTransactions<T extends RecurringTx>(rows: T[], horizon?: Date): T[] {
  const out: T[] = [];
  const limit = horizon ? new Date(horizon) : new Date();
  limit.setHours(23, 59, 59, 999);
  for (const tx of rows) {
    out.push(tx);
    if (!tx.is_recurring) continue;
    const interval = (tx.recurrence_interval || "monthly").toLowerCase();
    const supportedIntervals = ["weekly", "semanal", "week", "monthly", "mensal", "month", "yearly", "anual", "annual", "year"];
    if (!supportedIntervals.includes(interval)) continue;

    const start = parseDateOnly(tx.date);
    if (!start) continue;

    const originalDay = start.getDate();
    let cursor = addRecurringInterval(start, interval, originalDay);
    const maxOccurrences = interval === "weekly" || interval === "semanal" || interval === "week" ? 1040 : 240;
    let safety = 0;
    while (cursor <= limit && safety < maxOccurrences) {
      const iso = toIsoDate(cursor);
      out.push({
        ...tx,
        id: `${tx.id}-r${safety}`,
        date: iso,
        source_id: tx.id,
        is_projected: true,
        projection_index: safety,
        is_recurring: false,
      } as T);
      cursor = addRecurringInterval(cursor, interval, originalDay);
      safety += 1;
    }
  }
  return out.sort((a, b) => String(b.date).localeCompare(String(a.date)));
}
