import type { RawPlaceResult } from "../types.js";

/**
 * Abstraction the rest of this worker depends on instead of any specific
 * scraper's internals. The active implementation is swappable (env var
 * MAPS_PROVIDER) without touching job management, normalization, dedup, or
 * the database layer.
 */
export interface SearchParams {
  query: string;
  country: string;
  region?: string | null;
  province?: string | null;
  city?: string | null;
  category?: string | null;
  centerLat?: number | null;
  centerLng?: number | null;
  radiusKm?: number | null;
  limit?: number;
}

export interface DetailsParams {
  placeId: string;
}

export interface ReviewsParams {
  placeId: string;
  limit?: number;
}

export interface HealthResult {
  healthy: boolean;
  detail?: string;
}

export interface MapsProvider {
  readonly id: string;
  search(params: SearchParams): Promise<RawPlaceResult[]>;
  getDetails(params: DetailsParams): Promise<RawPlaceResult | null>;
  getReviews(params: ReviewsParams): Promise<unknown[]>;
  healthCheck(): Promise<HealthResult>;
}

export async function createMapsProvider(providerId: string): Promise<MapsProvider> {
  switch (providerId) {
    case "omkarcloud": {
      const { OmkarcloudMapsProvider } = await import("./omkarcloud/index.js");
      return new OmkarcloudMapsProvider();
    }
    default:
      throw new Error(`Unknown MAPS_PROVIDER: ${providerId}`);
  }
}
