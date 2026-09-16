import type { RawPlaceResult } from "../types.js";

/**
 * Validates and coerces provider output before it reaches normalization.
 * Kept separate from MapsProvider so a provider swap only has to satisfy
 * RawPlaceResult's shape — this is where "the shape was right but the values
 * were garbage" gets caught (empty name, non-finite coordinates, etc).
 */
export interface ParseResult {
  valid: RawPlaceResult[];
  invalid: { reason: string; row: unknown }[];
}

export function parseResults(rows: RawPlaceResult[]): ParseResult {
  const valid: RawPlaceResult[] = [];
  const invalid: { reason: string; row: unknown }[] = [];

  for (const row of rows) {
    if (!row.name || row.name.trim().length === 0) {
      invalid.push({ reason: "missing_name", row });
      continue;
    }
    if (row.latitude != null && !Number.isFinite(row.latitude)) {
      invalid.push({ reason: "invalid_latitude", row });
      continue;
    }
    if (row.longitude != null && !Number.isFinite(row.longitude)) {
      invalid.push({ reason: "invalid_longitude", row });
      continue;
    }
    valid.push(row);
  }

  return { valid, invalid };
}
