import type { Pool } from "pg";
import type { CoverageStatus, GeoCell } from "../types.js";

/**
 * Tracks which geographic cells have been scanned, so discovery never relies
 * on one unbounded "all businesses in country X" query. STUB: cell creation
 * (splitting a city into an initial grid) is not implemented yet — this only
 * covers reading coverage state and reacting to a result count that suggests
 * the provider's per-query cap was hit.
 */
export class CoverageTracker {
  constructor(private readonly pool: Pool) {}

  async listCoverage(filter?: { country?: string; region?: string; city?: string }): Promise<GeoCell[]> {
    const conditions: string[] = [];
    const params: unknown[] = [];
    if (filter?.country) {
      params.push(filter.country);
      conditions.push(`country = $${params.length}`);
    }
    if (filter?.region) {
      params.push(filter.region);
      conditions.push(`region = $${params.length}`);
    }
    if (filter?.city) {
      params.push(filter.city);
      conditions.push(`city = $${params.length}`);
    }
    const where = conditions.length ? `where ${conditions.join(" and ")}` : "";
    const { rows } = await this.pool.query(`select * from maps_geo_cells ${where} order by country, region, city`, params);
    return rows.map(rowToCell);
  }

  async markScanned(geoCellId: string, resultCount: number, providerLimit: number): Promise<void> {
    // A result count near the provider's per-query cap means real coverage is
    // larger than what came back — the cell needs to be split into smaller
    // cells and rescanned rather than treated as fully covered.
    const status: CoverageStatus =
      resultCount >= Math.floor(providerLimit * 0.9) ? "needs_subdivision" : "complete";

    await this.pool.query(
      `update maps_geo_cells set last_scanned_at = now(), coverage_status = $2 where geo_cell_id = $1`,
      [geoCellId, status],
    );
  }

  /**
   * STUB: split a cell into four quadrant sub-cells at half the radius.
   * Real subdivision should account for provider-specific search radius
   * limits and avoid over-subdividing sparse rural areas.
   */
  async subdivide(cell: GeoCell): Promise<GeoCell[]> {
    const halfRadius = cell.radiusKm / 2;
    const offsets = [
      { dLat: 1, dLng: 1 },
      { dLat: 1, dLng: -1 },
      { dLat: -1, dLng: 1 },
      { dLat: -1, dLng: -1 },
    ];
    const kmToDeg = halfRadius / 111; // rough conversion, fine at city scale

    const created: GeoCell[] = [];
    for (const offset of offsets) {
      const { rows } = await this.pool.query(
        `insert into maps_geo_cells (center_lat, center_lng, radius_km, country, region, province, city, category, coverage_status)
         values ($1,$2,$3,$4,$5,$6,$7,$8,'not_scanned')
         returning *`,
        [
          cell.centerLat + offset.dLat * kmToDeg,
          cell.centerLng + offset.dLng * kmToDeg,
          halfRadius,
          cell.country,
          cell.region,
          cell.province,
          cell.city,
          cell.category,
        ],
      );
      created.push(rowToCell(rows[0]));
    }
    return created;
  }
}

function rowToCell(row: Record<string, unknown>): GeoCell {
  return {
    geoCellId: row.geo_cell_id as string,
    centerLat: Number(row.center_lat),
    centerLng: Number(row.center_lng),
    radiusKm: Number(row.radius_km),
    country: row.country as string,
    region: (row.region as string) ?? null,
    province: (row.province as string) ?? null,
    city: (row.city as string) ?? null,
    category: (row.category as string) ?? null,
    lastScannedAt: row.last_scanned_at ? String(row.last_scanned_at) : null,
    coverageStatus: row.coverage_status as CoverageStatus,
  };
}
