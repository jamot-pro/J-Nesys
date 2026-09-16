"use client";

import { useMemo, useState, type MouseEvent } from "react";
import { geocodePlace } from "./geocode";
import {
  centeredTileGrid,
  metersPerPixel,
  pixelOffsetToLatLng,
  zoomForRadius,
  type LatLng,
} from "./tileMath";

export interface MapArea {
  place: string;
  center?: LatLng;
  radiusKm?: number;
}

const GRID_TILES = 3; // 3x3 = 768x768px of real map, centered on the target point
const TILE_PX = 256;
const MAP_SIZE = GRID_TILES * TILE_PX;
const DEFAULT_RADIUS_KM = 20;
const MIN_RADIUS_KM = 1;
const MAX_RADIUS_KM = 300;

/**
 * Minimal area picker for Lead Generation: a real OpenStreetMap view (no API
 * key, no billing — same free tile source everywhere), a dot for the search
 * center, and a radius slider. No box-draw, no region/city mode toggle — one
 * flow: search a city, optionally click the map to move the dot, optionally
 * narrow the radius. What's shown is exactly what gets sent to the provider
 * (LeadArea.center + LeadArea.radiusKm), not a decorative approximation.
 *
 * Framework/design-system agnostic (inline styles only) so both apps/console
 * (no Tailwind) and apps/web can use the same component.
 */
export function MapAreaPicker({
  value,
  onChange,
  height = 260,
}: {
  value: MapArea | null;
  onChange: (area: MapArea | null) => void;
  height?: number;
}) {
  const [query, setQuery] = useState(value?.place ?? "");
  const [center, setCenter] = useState<LatLng | null>(value?.center ?? null);
  const [radiusKm, setRadiusKm] = useState(value?.radiusKm ?? DEFAULT_RADIUS_KM);
  const [label, setLabel] = useState(value?.place ?? "");
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const zoom = useMemo(
    () => (center ? zoomForRadius(radiusKm, center.lat, MAP_SIZE) : 5),
    [center, radiusKm],
  );

  const grid = useMemo(
    () => (center ? centeredTileGrid(center, zoom, GRID_TILES) : null),
    [center, zoom],
  );

  const radiusPx = useMemo(
    () => (center ? (radiusKm * 1000) / metersPerPixel(center.lat, zoom) : 0),
    [center, radiusKm, zoom],
  );

  async function search() {
    if (!query.trim()) return;
    setSearching(true);
    setError(null);
    try {
      const result = await geocodePlace(query);
      if (!result) {
        setError("Could not find that place.");
        return;
      }
      setCenter(result.center);
      setLabel(result.label);
      onChange({ place: result.label, center: result.center, radiusKm });
    } catch {
      setError("Geocoding failed — try again in a moment.");
    } finally {
      setSearching(false);
    }
  }

  function handleMapClick(event: MouseEvent<HTMLDivElement>) {
    if (!center) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const dx = event.clientX - rect.left - rect.width / 2;
    const dy = event.clientY - rect.top - rect.height / 2;
    const next = pixelOffsetToLatLng(center, zoom, dx, dy);
    setCenter(next);
    onChange({ place: label, center: next, radiusKm });
  }

  function handleRadiusChange(next: number) {
    setRadiusKm(next);
    if (center) onChange({ place: label, center, radiusKm: next });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ display: "flex", gap: 8 }}>
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              void search();
            }
          }}
          placeholder="Search a city, e.g. Milano, Italy"
          style={{
            flex: 1,
            height: 34,
            borderRadius: 6,
            border: "1px solid var(--color-divider, #d0d0d5)",
            background: "var(--color-bg, #fff)",
            color: "var(--color-text, #111)",
            padding: "0 10px",
            fontSize: 13,
          }}
        />
        <button
          type="button"
          onClick={() => void search()}
          disabled={searching || !query.trim()}
          style={{
            height: 34,
            padding: "0 14px",
            borderRadius: 6,
            border: "none",
            background: "var(--color-accent, #e11d48)",
            color: "#fff",
            fontSize: 13,
            fontWeight: 600,
            cursor: searching ? "default" : "pointer",
          }}
        >
          {searching ? "Searching…" : "Search"}
        </button>
      </div>

      <div
        onClick={handleMapClick}
        style={{
          position: "relative",
          width: "100%",
          height,
          overflow: "hidden",
          borderRadius: 8,
          border: "1px solid var(--color-divider, #d0d0d5)",
          cursor: center ? "crosshair" : "default",
          background: "#e8e8ec",
        }}
      >
        {center && grid ? (
          <>
            <div
              style={{
                position: "absolute",
                left: `calc(50% + ${grid.offsetX}px)`,
                top: `calc(50% + ${grid.offsetY}px)`,
                width: MAP_SIZE,
                height: MAP_SIZE,
                display: "grid",
                gridTemplateColumns: `repeat(${GRID_TILES}, ${TILE_PX}px)`,
                gridTemplateRows: `repeat(${GRID_TILES}, ${TILE_PX}px)`,
                filter: "saturate(0.9)",
              }}
            >
              {Array.from({ length: GRID_TILES * GRID_TILES }, (_, i) => {
                const tx = grid.originTileX + (i % GRID_TILES);
                const ty = grid.originTileY + Math.floor(i / GRID_TILES);
                const wrapped = ((tx % 2 ** zoom) + 2 ** zoom) % 2 ** zoom;
                const src = `https://tile.openstreetmap.org/${zoom}/${wrapped}/${ty}.png`;
                return (
                  // eslint-disable-next-line @next/next/no-img-element -- OSM tiles, not a Next asset
                  <img key={i} src={src} alt="" width={TILE_PX} height={TILE_PX} style={{ display: "block" }} />
                );
              })}
            </div>

            {/* Radius circle, to true scale for the current zoom/latitude */}
            <div
              style={{
                position: "absolute",
                left: "50%",
                top: "50%",
                width: radiusPx * 2,
                height: radiusPx * 2,
                transform: "translate(-50%, -50%)",
                borderRadius: "50%",
                border: "2px solid var(--color-accent, #e11d48)",
                background: "color-mix(in srgb, var(--color-accent, #e11d48) 14%, transparent)",
                pointerEvents: "none",
              }}
            />
            {/* Center dot */}
            <div
              style={{
                position: "absolute",
                left: "50%",
                top: "50%",
                width: 12,
                height: 12,
                transform: "translate(-50%, -50%)",
                borderRadius: "50%",
                background: "var(--color-accent, #e11d48)",
                boxShadow: "0 0 0 3px #fff",
                pointerEvents: "none",
              }}
            />
            <span
              style={{
                position: "absolute",
                left: 8,
                bottom: 6,
                fontSize: 10,
                fontFamily: "ui-monospace, monospace",
                color: "rgba(0,0,0,0.55)",
              }}
            >
              © OpenStreetMap
            </span>
          </>
        ) : (
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 13,
              color: "rgba(0,0,0,0.5)",
              textAlign: "center",
              padding: 16,
            }}
          >
            Search a city above to place it on the map.
          </div>
        )}
      </div>

      {center ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <label style={{ fontSize: 12, color: "var(--color-text-muted, #666)" }}>
            Radius — {radiusKm} km
            {radiusKm >= 100 ? " (roughly the whole city and surroundings)" : ""}
          </label>
          <input
            type="range"
            min={MIN_RADIUS_KM}
            max={MAX_RADIUS_KM}
            step={1}
            value={radiusKm}
            onChange={(event) => handleRadiusChange(Number(event.target.value))}
          />
          <p style={{ margin: 0, fontSize: 11, color: "rgba(0,0,0,0.5)" }}>
            Click the map to move the search center. This is exactly the area sent to the search
            provider — nothing is approximated.
          </p>
        </div>
      ) : null}

      {error ? <p style={{ margin: 0, fontSize: 12, color: "#c0293a" }}>{error}</p> : null}
    </div>
  );
}
