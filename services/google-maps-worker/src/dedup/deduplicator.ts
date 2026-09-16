import type { NormalizedPlace } from "../normalize/normalizer.js";
import { normalizeName } from "../normalize/normalizer.js";
import type { Location } from "../types.js";

export type DedupOutcome =
  | { kind: "new" }
  | { kind: "duplicate"; locationId: string; reason: string }
  | { kind: "possible_duplicate"; locationId: string; reason: string };

/** Straight-line distance in meters — good enough for a "probably the same place" check, not for routing. */
function haversineMeters(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const R = 6_371_000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

const NAME_PROXIMITY_METERS = 100;

/**
 * Deterministic priority, per spec: Google Place ID, then normalized phone,
 * then normalized domain, then name + geographic proximity. Never merges on
 * a low-confidence signal — those come back as "possible_duplicate" so both
 * records are kept and a human (or a later pass) can resolve it.
 */
export function findDuplicate(
  candidate: NormalizedPlace,
  existing: Location[],
): DedupOutcome {
  if (candidate.googlePlaceId) {
    const match = existing.find((loc) => loc.googlePlaceId === candidate.googlePlaceId);
    if (match) return { kind: "duplicate", locationId: match.locationId, reason: "google_place_id" };
  }

  if (candidate.phone) {
    const match = existing.find((loc) => loc.phone === candidate.phone);
    if (match) return { kind: "duplicate", locationId: match.locationId, reason: "phone" };
  }

  if (candidate.domain) {
    const match = existing.find(
      (loc) => loc.website && candidate.domain && domainOf(loc.website) === candidate.domain,
    );
    if (match) return { kind: "duplicate", locationId: match.locationId, reason: "domain" };
  }

  if (candidate.latitude != null && candidate.longitude != null) {
    const candidateName = normalizeName(candidate.name);
    const near = existing.find((loc) => {
      if (loc.latitude == null || loc.longitude == null) return false;
      if (normalizeName(loc.name) !== candidateName) return false;
      const distance = haversineMeters(
        { lat: candidate.latitude!, lng: candidate.longitude! },
        { lat: loc.latitude, lng: loc.longitude },
      );
      return distance <= NAME_PROXIMITY_METERS;
    });
    if (near) {
      return {
        kind: "possible_duplicate",
        locationId: near.locationId,
        reason: "name_and_proximity",
      };
    }
  }

  return { kind: "new" };
}

function domainOf(website: string): string | null {
  try {
    const host = new URL(website).hostname.toLowerCase();
    return host.startsWith("www.") ? host.slice(4) : host;
  } catch {
    return null;
  }
}
