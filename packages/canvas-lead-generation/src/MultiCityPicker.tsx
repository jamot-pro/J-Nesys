"use client";

import { useMemo, useState } from "react";
import { geocodePlace } from "./geocode";
import {
  centeredTileGrid,
  fitBounds,
  latLngToPixelOffset,
  metersPerPixel,
  type LatLng,
} from "./tileMath";

export interface CityArea {
  place: string;
  center: LatLng;
  radiusKm: number;
}

const GRID_TILES = 5; // wider than the single-point picker — needs margin for spread-out pins
const TILE_PX = 256;
const MAP_SIZE = GRID_TILES * TILE_PX;
const DEFAULT_RADIUS_KM = 20;
const MIN_RADIUS_KM = 1;
const MAX_RADIUS_KM = 300;

/**
 * Pick several cities for one search: type a city, add it to the list, see
 * every added city highlighted on the same map. No box tool, no draw mode —
 * search, add, adjust radius, repeat. What is shown on the map is exactly
 * what gets searched (one run per city against the same LeadArea shape
 * search already used), never an approximation.
 */
export function MultiCityPicker({
  value,
  onChange,
  height = 280,
}: {
  value: CityArea[];
  onChange: (cities: CityArea[]) => void;
  height?: number;
}) {
  const [query, setQuery] = useState("");
  const [pending, setPending] = useState<{ label: string; center: LatLng } | null>(null);
  const [radiusKm, setRadiusKm] = useState(DEFAULT_RADIUS_KM);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const points = useMemo(
    () => [...value.map((c) => c.center), ...(pending ? [pending.center] : [])],
    [value, pending],
  );

  const { center, zoom } = useMemo(() => fitBounds(points, MAP_SIZE), [points]);
  const grid = useMemo(
    () => (points.length > 0 ? centeredTileGrid(center, zoom, GRID_TILES) : null),
    [center, zoom, points.length],
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
      setPending({ label: result.label, center: result.center });
    } catch {
      setError("Geocoding failed — try again in a moment.");
    } finally {
      setSearching(false);
    }
  }

  function addPending() {
    if (!pending) return;
    if (value.some((c) => c.place === pending.label)) {
      setPending(null);
      setQuery("");
      return;
    }
    onChange([...value, { place: pending.label, center: pending.center, radiusKm }]);
    setPending(null);
    setQuery("");
  }

  function removeCity(place: string) {
    onChange(value.filter((c) => c.place !== place));
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
          placeholder="Search a city, e.g. Napoli, Italy"
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
            border: "1px solid var(--color-divider, #d0d0d5)",
            background: "transparent",
            color: "var(--color-text, #111)",
            fontSize: 13,
            cursor: searching ? "default" : "pointer",
          }}
        >
          {searching ? "…" : "Find"}
        </button>
        <button
          type="button"
          onClick={addPending}
          disabled={!pending}
          style={{
            height: 34,
            padding: "0 14px",
            borderRadius: 6,
            border: "none",
            background: pending ? "var(--color-accent, #e11d48)" : "var(--color-divider, #d0d0d5)",
            color: "#fff",
            fontSize: 13,
            fontWeight: 600,
            cursor: pending ? "pointer" : "default",
          }}
        >
          Add
        </button>
      </div>

      {pending ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <label style={{ fontSize: 12, color: "var(--color-text-muted, #666)" }}>
            Radius for {pending.label} — {radiusKm} km
          </label>
          <input
            type="range"
            min={MIN_RADIUS_KM}
            max={MAX_RADIUS_KM}
            step={1}
            value={radiusKm}
            onChange={(event) => setRadiusKm(Number(event.target.value))}
          />
        </div>
      ) : null}

      <div
        style={{
          position: "relative",
          width: "100%",
          height,
          overflow: "hidden",
          borderRadius: 8,
          border: "1px solid var(--color-divider, #d0d0d5)",
          background: "#e8e8ec",
        }}
      >
        {grid ? (
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

            {value.map((city) => {
              const { dx, dy } = latLngToPixelOffset(center, zoom, city.center);
              const radiusPx = (city.radiusKm * 1000) / metersPerPixel(city.center.lat, zoom);
              return (
                <div key={city.place}>
                  <div
                    style={{
                      position: "absolute",
                      left: `calc(50% + ${dx}px)`,
                      top: `calc(50% + ${dy}px)`,
                      width: radiusPx * 2,
                      height: radiusPx * 2,
                      transform: "translate(-50%, -50%)",
                      borderRadius: "50%",
                      border: "2px solid var(--color-accent, #e11d48)",
                      background: "color-mix(in srgb, var(--color-accent, #e11d48) 14%, transparent)",
                      pointerEvents: "none",
                    }}
                  />
                  <div
                    style={{
                      position: "absolute",
                      left: `calc(50% + ${dx}px)`,
                      top: `calc(50% + ${dy}px)`,
                      width: 12,
                      height: 12,
                      transform: "translate(-50%, -50%)",
                      borderRadius: "50%",
                      background: "var(--color-accent, #e11d48)",
                      boxShadow: "0 0 0 3px #fff",
                      pointerEvents: "none",
                    }}
                  />
                </div>
              );
            })}

            {pending
              ? (() => {
                  const { dx, dy } = latLngToPixelOffset(center, zoom, pending.center);
                  return (
                    <div
                      style={{
                        position: "absolute",
                        left: `calc(50% + ${dx}px)`,
                        top: `calc(50% + ${dy}px)`,
                        width: 14,
                        height: 14,
                        transform: "translate(-50%, -50%)",
                        borderRadius: "50%",
                        border: "2px dashed var(--color-accent, #e11d48)",
                        background: "#fff",
                        pointerEvents: "none",
                      }}
                    />
                  );
                })()
              : null}

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
            Search a city and click Add to place it on the map.
          </div>
        )}
      </div>

      {value.length > 0 ? (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {value.map((city) => (
            <span
              key={city.place}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 7,
                padding: "6px 8px 6px 12px",
                background: "var(--color-surface, #f2f2f5)",
                borderRadius: 999,
                fontSize: 13,
              }}
            >
              {city.place.split(",")[0]}
              <span style={{ fontSize: 11, opacity: 0.6 }}>· {city.radiusKm}km</span>
              <button
                type="button"
                onClick={() => removeCity(city.place)}
                title="Remove"
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 18,
                  height: 18,
                  background: "none",
                  border: "none",
                  borderRadius: 999,
                  color: "inherit",
                  cursor: "pointer",
                }}
              >
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round">
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            </span>
          ))}
        </div>
      ) : null}

      {error ? <p style={{ margin: 0, fontSize: 12, color: "#c0293a" }}>{error}</p> : null}
    </div>
  );
}
