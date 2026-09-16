import type { LatLng } from "./tileMath.js";

export interface GeocodeResult {
  label: string;
  center: LatLng;
}

/**
 * Free, keyless geocoding via OpenStreetMap's Nominatim, paired with the
 * free OSM tiles the map already renders — no Google Maps API key, no
 * billing. Nominatim's usage policy caps this at ~1 request/second, which is
 * fine for a manual "search a city" button; do not call this in a loop.
 * https://operations.osmfoundation.org/policies/nominatim/
 */
export async function geocodePlace(query: string): Promise<GeocodeResult | null> {
  const trimmed = query.trim();
  if (!trimmed) return null;

  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${encodeURIComponent(trimmed)}`;
  const response = await fetch(url, {
    headers: { Accept: "application/json" },
  });
  if (!response.ok) throw new Error(`Geocoding failed (${response.status})`);

  const rows = (await response.json()) as Array<{ lat: string; lon: string; display_name: string }>;
  const first = rows[0];
  if (!first) return null;

  return {
    label: first.display_name,
    center: { lat: Number(first.lat), lng: Number(first.lon) },
  };
}
