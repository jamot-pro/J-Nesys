import type { RawPlaceResult } from "../types.js";
import { normalizeDomain } from "./domain.js";
import { normalizePhone } from "./phone.js";

export interface NormalizedPlace {
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
  domain: string | null;
  category: string | null;
  rating: number | null;
  reviewCount: number | null;
  openingHours: unknown;
}

export function normalizeName(raw: string): string {
  return raw.trim().replace(/\s+/g, " ").toLowerCase();
}

export function normalizePlace(place: RawPlaceResult): NormalizedPlace {
  return {
    googlePlaceId: place.placeId,
    name: place.name.trim(),
    address: place.address,
    street: place.street,
    city: place.city,
    province: place.province,
    postalCode: place.postalCode,
    country: place.country,
    latitude: place.latitude,
    longitude: place.longitude,
    phone: normalizePhone(place.phone),
    website: place.website,
    domain: normalizeDomain(place.website),
    category: place.category,
    rating: place.rating,
    reviewCount: place.reviewCount,
    openingHours: place.openingHours,
  };
}
