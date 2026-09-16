/**
 * Shared types for the Google Maps worker. This service is intentionally
 * standalone — it does not import from @jamot/core or @jamot/contracts, so it
 * can be deployed, versioned, and replaced independently of Jamot Core. It
 * talks to the rest of Jamot only through the HTTP API in src/api and the
 * PostgreSQL tables in src/db/schema.sql.
 */

export type JobStatus =
  | "queued"
  | "running"
  | "paused"
  | "completed"
  | "partial"
  | "failed"
  | "cancelled";

export type JobType = "google_maps_discovery" | "google_maps_refresh";

export interface ScrapeJob {
  jobId: string;
  jobType: JobType;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  status: JobStatus;
  query: string;
  country: string;
  region: string | null;
  province: string | null;
  city: string | null;
  category: string | null;
  geoCellId: string | null;
  resultsFound: number;
  newRecords: number;
  duplicateRecords: number;
  errors: string[];
  workerId: string | null;
}

export type CoverageStatus =
  | "not_scanned"
  | "queued"
  | "scanning"
  | "partial"
  | "complete"
  | "needs_subdivision";

export interface GeoCell {
  geoCellId: string;
  centerLat: number;
  centerLng: number;
  radiusKm: number;
  country: string;
  region: string | null;
  province: string | null;
  city: string | null;
  category: string | null;
  lastScannedAt: string | null;
  coverageStatus: CoverageStatus;
}

/** A single business record as returned by a provider, before normalization. */
export interface RawPlaceResult {
  placeId: string | null;
  name: string;
  address: string | null;
  street: string | null;
  city: string | null;
  province: string | null;
  postalCode: string | null;
  country: string | null;
  latitude: number | null;
  longitude: number | null;
  phone: string | null;
  website: string | null;
  category: string | null;
  rating: number | null;
  reviewCount: number | null;
  openingHours: unknown;
  raw: Record<string, unknown>;
}

export interface Company {
  companyId: string;
  name: string;
  website: string | null;
  domain: string | null;
  phone: string | null;
  email: string | null;
  companyType: string | null;
  createdAt: string;
  updatedAt: string;
}

export type PosPotential = "unknown" | "likely" | "verified";

export interface Location {
  locationId: string;
  companyId: string;
  googlePlaceId: string | null;
  name: string;
  address: string | null;
  street: string | null;
  city: string | null;
  province: string | null;
  postalCode: string | null;
  country: string | null;
  latitude: number | null;
  longitude: number | null;
  phone: string | null;
  website: string | null;
  category: string | null;
  rating: number | null;
  reviewCount: number | null;
  openingHours: unknown;
  firstSeenAt: string;
  lastSeenAt: string;
  source: string;
  possibleDuplicate: boolean;
  posPotential: PosPotential;
  posStatus: string | null;
  posStatusSource: string | null;
  posStatusConfidence: number | null;
}
