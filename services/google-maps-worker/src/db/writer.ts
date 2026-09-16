import type { Pool } from "pg";
import type { NormalizedPlace } from "../normalize/normalizer.js";
import { findDuplicate } from "../dedup/deduplicator.js";
import type { Location } from "../types.js";

/**
 * All writes to the merchant tables. Kept behind one class so job manager /
 * API code never hand-writes SQL against maps_companies / maps_locations —
 * that keeps the dedup rule (src/dedup/deduplicator.ts) as the single place
 * that decides "new vs. duplicate vs. possible_duplicate".
 */
export class DatabaseWriter {
  constructor(private readonly pool: Pool) {}

  async recordRawResult(params: {
    jobId: string;
    provider: string;
    providerVersion?: string | null;
    rawPayload: unknown;
  }): Promise<void> {
    await this.pool.query(
      `insert into maps_raw_scrape_results (job_id, provider, provider_version, raw_payload)
       values ($1, $2, $3, $4)`,
      [params.jobId, params.provider, params.providerVersion ?? null, params.rawPayload],
    );
  }

  private async findLocationsNear(place: NormalizedPlace): Promise<Location[]> {
    // STUB: a real implementation restricts this to a bounding box around
    // place.latitude/longitude (and the same country/city) before pulling
    // rows into JS — comparing against every row in the table does not scale.
    const { rows } = await this.pool.query(`select * from maps_locations limit 5000`);
    return rows.map(rowToLocation);
  }

  /** Returns whether the place was new, a duplicate, or a possible duplicate. */
  async upsertPlace(
    place: NormalizedPlace,
    jobId: string,
  ): Promise<{ outcome: "new" | "duplicate" | "possible_duplicate"; locationId: string }> {
    const candidates = await this.findLocationsNear(place);
    const outcome = findDuplicate(place, candidates);

    if (outcome.kind === "duplicate") {
      await this.pool.query(
        `update maps_locations set last_seen_at = now() where location_id = $1`,
        [outcome.locationId],
      );
      await this.linkJobResult(jobId, outcome.locationId, "duplicate");
      return { outcome: "duplicate", locationId: outcome.locationId };
    }

    const company = await this.upsertCompany(place);

    if (outcome.kind === "possible_duplicate") {
      const locationId = await this.insertLocation(place, company.companyId, true);
      await this.linkJobResult(jobId, locationId, "possible_duplicate");
      return { outcome: "possible_duplicate", locationId };
    }

    const locationId = await this.insertLocation(place, company.companyId, false);
    await this.linkJobResult(jobId, locationId, "new");
    return { outcome: "new", locationId };
  }

  private async linkJobResult(
    jobId: string,
    locationId: string,
    outcome: "new" | "duplicate" | "possible_duplicate",
  ): Promise<void> {
    await this.pool.query(
      `insert into maps_job_results (job_id, location_id, outcome)
       values ($1, $2, $3)
       on conflict (job_id, location_id) do nothing`,
      [jobId, locationId, outcome],
    );
  }

  async resultsForJob(jobId: string): Promise<Location[]> {
    const { rows } = await this.pool.query(
      `select l.* from maps_locations l
       join maps_job_results r on r.location_id = l.location_id
       where r.job_id = $1
       order by l.name`,
      [jobId],
    );
    return rows.map(rowToLocation);
  }

  private async upsertCompany(place: NormalizedPlace): Promise<{ companyId: string }> {
    if (place.domain) {
      const { rows } = await this.pool.query(
        `select company_id from maps_companies where domain = $1`,
        [place.domain],
      );
      if (rows[0]) return { companyId: rows[0].company_id };
    }

    const { rows } = await this.pool.query(
      `insert into maps_companies (name, website, domain, phone)
       values ($1, $2, $3, $4)
       returning company_id`,
      [place.name, place.website, place.domain, place.phone],
    );
    return { companyId: rows[0].company_id };
  }

  private async insertLocation(
    place: NormalizedPlace,
    companyId: string,
    possibleDuplicate: boolean,
  ): Promise<string> {
    const { rows } = await this.pool.query(
      `insert into maps_locations
        (company_id, google_place_id, name, address, street, city, province, postal_code,
         country, latitude, longitude, phone, website, category, rating, review_count,
         opening_hours, possible_duplicate)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
       returning location_id`,
      [
        companyId,
        place.googlePlaceId,
        place.name,
        place.address,
        place.street,
        place.city,
        place.province,
        place.postalCode,
        place.country,
        place.latitude,
        place.longitude,
        place.phone,
        place.website,
        place.category,
        place.rating,
        place.reviewCount,
        JSON.stringify(place.openingHours ?? null),
        possibleDuplicate,
      ],
    );
    return rows[0].location_id;
  }
}

function rowToLocation(row: Record<string, unknown>): Location {
  return {
    locationId: row.location_id as string,
    companyId: row.company_id as string,
    googlePlaceId: (row.google_place_id as string) ?? null,
    name: row.name as string,
    address: (row.address as string) ?? null,
    street: (row.street as string) ?? null,
    city: (row.city as string) ?? null,
    province: (row.province as string) ?? null,
    postalCode: (row.postal_code as string) ?? null,
    country: (row.country as string) ?? null,
    latitude: (row.latitude as number) ?? null,
    longitude: (row.longitude as number) ?? null,
    phone: (row.phone as string) ?? null,
    website: (row.website as string) ?? null,
    category: (row.category as string) ?? null,
    rating: (row.rating as number) ?? null,
    reviewCount: (row.review_count as number) ?? null,
    openingHours: row.opening_hours ?? null,
    firstSeenAt: String(row.first_seen_at),
    lastSeenAt: String(row.last_seen_at),
    source: row.source as string,
    possibleDuplicate: Boolean(row.possible_duplicate),
    posPotential: row.pos_potential as Location["posPotential"],
    posStatus: (row.pos_status as string) ?? null,
    posStatusSource: (row.pos_status_source as string) ?? null,
    posStatusConfidence: (row.pos_status_confidence as number) ?? null,
  };
}
