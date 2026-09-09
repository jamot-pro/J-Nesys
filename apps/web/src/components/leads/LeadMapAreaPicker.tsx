"use client";

import { useEffect, useRef, useState } from "react";
import { Loader } from "@googlemaps/js-api-loader";
import { MapPin } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { LeadArea } from "@/lib/api-client";

const GOOGLE_MAPS_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

declare global {
  var __leadMapInstance: google.maps.Map | undefined;
  var __leadDrawManager: google.maps.drawing.DrawingManager | undefined;
  var __leadCircle: google.maps.Circle | undefined;
  var __leadPolygon: google.maps.Polygon | undefined;
}

function toArea(circle?: google.maps.Circle, polygon?: google.maps.Polygon, place = ""): LeadArea | null {
  if (circle) {
    const center = circle.getCenter();
    const radiusM = circle.getRadius();
    return {
      place,
      center: center ? { lat: center.lat(), lng: center.lng() } : undefined,
      radiusKm: radiusM ? Math.round((radiusM / 1000) * 100) / 100 : undefined,
    };
  }
  if (polygon) {
    const path = polygon.getPath();
    const pts: { lat: number; lng: number }[] = [];
    for (let i = 0; i < path.getLength(); i++) {
      const p = path.getAt(i);
      pts.push({ lat: p.lat(), lng: p.lng() });
    }
    if (pts.length >= 3) {
      return { place, polygon: pts };
    }
  }
  return null;
}

export function LeadMapAreaPicker({
  value,
  onChange,
}: {
  value: LeadArea | null;
  onChange: (area: LeadArea | null) => void;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [placeQuery, setPlaceQuery] = useState("");
  const [placeLabel, setPlaceLabel] = useState("");
  const [error, setError] = useState<string | null>(null);
  const circleRef = useRef<google.maps.Circle | undefined>(undefined);
  const polygonRef = useRef<google.maps.Polygon | undefined>(undefined);

  useEffect(() => {
    if (!containerRef.current) return;
    if (!GOOGLE_MAPS_KEY) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- surface missing config once on mount
      setError("NEXT_PUBLIC_GOOGLE_MAPS_API_KEY is not configured. Add a Google Maps JS API key to draw an area.");
      return;
    }

    let cancelled = false;
    const loader = new Loader({
      apiKey: GOOGLE_MAPS_KEY,
      version: "weekly",
      libraries: ["drawing", "places"],
    });

    loader
      .load()
      .then(() => {
        if (cancelled || !containerRef.current) return;
        const map = new google.maps.Map(containerRef.current, {
          center: { lat: 48.8566, lng: 2.3522 },
          zoom: 11,
          mapTypeId: "roadmap",
          mapTypeControl: false,
          fullscreenControl: false,
          streetViewControl: false,
        });
        setMap(map);

        // DrawingManager was deprecated in the Maps API 3.65 types; the stub
        // omits its constructor and setMap overloads, so cast through unknown.
        type DrawManagerLike = google.maps.drawing.DrawingManager & {
          setMap(map: google.maps.Map | null): void;
        };
        const drawManager = new (google.maps.drawing.DrawingManager as unknown as new (
          options: object,
        ) => DrawManagerLike)({
          drawingMode: null,
          drawingControl: true,
          drawingControlOptions: {
            position: google.maps.ControlPosition.TOP_CENTER,
            drawingModes: ["circle", "polygon"],
          },
          circleOptions: {
            fillColor: "#10b981",
            fillOpacity: 0.25,
            strokeColor: "#10b981",
            strokeWeight: 2,
          },
          polygonOptions: {
            fillColor: "#10b981",
            fillOpacity: 0.25,
            strokeColor: "#10b981",
            strokeWeight: 2,
          },
        });
        drawManager.setMap(map);

        drawManager.addListener("circlecomplete", (circle: google.maps.Circle) => {
          if (circleRef.current) circleRef.current.setMap(null);
          if (polygonRef.current) polygonRef.current.setMap(null);
          circleRef.current = circle;
          polygonRef.current = undefined;
          onChange(toArea(circle, undefined, placeLabel));
        });

        drawManager.addListener("polygoncomplete", (polygon: google.maps.Polygon) => {
          if (circleRef.current) circleRef.current.setMap(null);
          if (polygonRef.current) polygonRef.current.setMap(null);
          polygonRef.current = polygon;
          circleRef.current = undefined;
          onChange(toArea(undefined, polygon, placeLabel));
        });
      })
      .catch(() => {
        if (!cancelled) setError("Failed to load Google Maps. Check the API key and billing.");
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const geocode = async () => {
    const q = placeQuery.trim();
    if (!q || !map) return;
    try {
      const geocoder = new google.maps.Geocoder();
      const result = await (geocoder as unknown as {
        geocode: (request: { address: string }) => Promise<{
          results: Array<{
            geometry: { location: { lat: () => number; lng: () => number } };
            formatted_address: string;
          }>;
        }>;
      }).geocode({ address: q });
      if (result.results.length > 0) {
        const loc = result.results[0]!.geometry.location;
        const label = result.results[0]!.formatted_address;
        map.setCenter({ lat: loc.lat(), lng: loc.lng() });
        map.setZoom(12);
        setPlaceLabel(label);
        if (circleRef.current) {
          onChange(toArea(circleRef.current, undefined, label));
        } else if (polygonRef.current) {
          onChange(toArea(undefined, polygonRef.current, label));
        }
      }
    } catch {
      setError("Could not find that place.");
    }
  };

  return (
    <div className="flex flex-col gap-2">
      {GOOGLE_MAPS_KEY ? (
        <div className="flex gap-2">
          <div className="relative flex-1">
            <MapPin className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={placeQuery}
              onChange={(event) => setPlaceQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  void geocode();
                }
              }}
              placeholder="Search a city or address…"
              className="h-9 pl-8"
            />
          </div>
          <Button size="sm" variant="secondary" onClick={() => void geocode()}>
            Go
          </Button>
        </div>
      ) : null}
      <div
        ref={containerRef}
        className="h-56 w-full overflow-hidden rounded-lg border border-border"
      />
      {value ? (
        <p className="text-xs text-muted-foreground">
          Selected area:{" "}
          {value.place || (value.radiusKm ? `radius ${value.radiusKm} km` : "polygon")}
        </p>
      ) : null}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}