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

export function expandRecurringTransactions<T extends RecurringTx>(rows: T[]): T[] {
  const out: T[] = [];
  const today = new Date();
  for (const tx of rows) {
    out.push(tx);
    if (!tx.is_recurring) continue;
    const interval = (tx.recurrence_interval || "monthly").toLowerCase();
    if (interval !== "monthly" && interval !== "mensal" && interval !== "month") continue;
    const start = new Date(`${String(tx.date).slice(0, 10)}T12:00:00`);
    if (Number.isNaN(start.getTime())) continue;
    const cursor = new Date(start.getFullYear(), start.getMonth() + 1, Math.min(start.getDate(), 28));
    let safety = 0;
    while (cursor <= today && safety < 240) {
      const iso = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}-${String(cursor.getDate()).padStart(2, "0")}`;
      out.push({
        ...tx,
        id: `${tx.id}-r${safety}`,
        date: iso,
        source_id: tx.id,
        is_projected: true,
        projection_index: safety,
        is_recurring: false,
      } as T);
      cursor.setMonth(cursor.getMonth() + 1);
      safety += 1;
    }
  }
  return out;
}
