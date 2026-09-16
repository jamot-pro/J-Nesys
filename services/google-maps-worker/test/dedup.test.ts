import { describe, expect, it } from "vitest";
import { findDuplicate } from "../src/dedup/deduplicator.js";
import type { NormalizedPlace } from "../src/normalize/normalizer.js";
import type { Location } from "../src/types.js";

function place(overrides: Partial<NormalizedPlace> = {}): NormalizedPlace {
  return {
    googlePlaceId: null,
    name: "Pizzeria Napoli",
    address: null,
    street: null,
    city: null,
    province: null,
    postalCode: null,
    country: null,
    latitude: 40.85,
    longitude: 14.27,
    phone: null,
    website: null,
    domain: null,
    category: null,
    rating: null,
    reviewCount: null,
    openingHours: null,
    ...overrides,
  };
}

function location(overrides: Partial<Location> = {}): Location {
  return {
    locationId: "loc-1",
    companyId: "co-1",
    googlePlaceId: null,
    name: "Pizzeria Napoli",
    address: null,
    street: null,
    city: null,
    province: null,
    postalCode: null,
    country: null,
    latitude: 40.85,
    longitude: 14.27,
    phone: null,
    website: null,
    category: null,
    rating: null,
    reviewCount: null,
    openingHours: null,
    firstSeenAt: "2026-01-01",
    lastSeenAt: "2026-01-01",
    source: "google_maps",
    possibleDuplicate: false,
    posPotential: "unknown",
    posStatus: null,
    posStatusSource: null,
    posStatusConfidence: null,
    ...overrides,
  };
}

describe("findDuplicate", () => {
  it("matches on google_place_id first", () => {
    const existing = [location({ googlePlaceId: "abc123" })];
    const result = findDuplicate(place({ googlePlaceId: "abc123" }), existing);
    expect(result).toEqual({ kind: "duplicate", locationId: "loc-1", reason: "google_place_id" });
  });

  it("falls back to phone when no place id matches", () => {
    const existing = [location({ phone: "+15551234567" })];
    const result = findDuplicate(place({ phone: "+15551234567" }), existing);
    expect(result).toEqual({ kind: "duplicate", locationId: "loc-1", reason: "phone" });
  });

  it("falls back to domain", () => {
    const existing = [location({ website: "https://napoli.example.com" })];
    const result = findDuplicate(place({ domain: "napoli.example.com" }), existing);
    expect(result).toEqual({ kind: "duplicate", locationId: "loc-1", reason: "domain" });
  });

  it("flags name + proximity matches as possible_duplicate, never a hard merge", () => {
    const existing = [location()];
    const result = findDuplicate(place(), existing);
    expect(result).toEqual({
      kind: "possible_duplicate",
      locationId: "loc-1",
      reason: "name_and_proximity",
    });
  });

  it("returns new when nothing matches", () => {
    const existing = [location({ name: "Unrelated Shop", latitude: 10, longitude: 10 })];
    const result = findDuplicate(place(), existing);
    expect(result).toEqual({ kind: "new" });
  });
});
