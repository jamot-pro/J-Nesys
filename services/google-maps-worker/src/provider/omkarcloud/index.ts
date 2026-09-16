import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type {
  DetailsParams,
  HealthResult,
  MapsProvider,
  ReviewsParams,
  SearchParams,
} from "../MapsProvider.js";
import type { RawPlaceResult } from "../../types.js";

/**
 * Wraps the vendored omkarcloud/google-maps-scraper (Python, Botasaurus-based)
 * as a subprocess. See VENDORED_COMMIT.md for the pinned commit and license.
 *
 * STUB: the upstream scraper is not vendored into this repo yet. The vendored
 * copy belongs under `vendor/google-maps-scraper/` (untouched upstream code,
 * MIT license file preserved) and this file translates between our
 * MapsProvider contract and its CLI/output format. Nothing here should assume
 * a specific upstream API beyond "reads a query, writes JSON results" — the
 * exact invocation gets filled in once the source is vendored per
 * VENDORED_COMMIT.md.
 */

const VENDOR_DIR = process.env.MAPS_SCRAPER_VENDOR_DIR ?? "./vendor/google-maps-scraper";
const PYTHON_BIN = process.env.MAPS_SCRAPER_PYTHON ?? "python3";
const REQUEST_TIMEOUT_MS = Number(process.env.MAPS_REQUEST_TIMEOUT_MS ?? 120_000);

export class OmkarcloudMapsProvider implements MapsProvider {
  readonly id = "omkarcloud";

  async search(params: SearchParams): Promise<RawPlaceResult[]> {
    const outDir = await mkdtemp(join(tmpdir(), "maps-worker-"));
    try {
      const outputFile = join(outDir, "results.json");
      await this.runScraper(
        [
          "--query",
          params.query,
          ...(params.centerLat != null && params.centerLng != null
            ? ["--lat", String(params.centerLat), "--lng", String(params.centerLng)]
            : []),
          ...(params.radiusKm != null ? ["--radius-km", String(params.radiusKm)] : []),
          "--limit",
          String(params.limit ?? 100),
          "--output",
          outputFile,
        ],
        REQUEST_TIMEOUT_MS,
      );
      const raw = await readFile(outputFile, "utf8");
      const rows = JSON.parse(raw) as Record<string, unknown>[];
      return rows.map(mapUpstreamRow);
    } finally {
      await rm(outDir, { recursive: true, force: true });
    }
  }

  async getDetails(params: DetailsParams): Promise<RawPlaceResult | null> {
    const results = await this.search({
      query: params.placeId,
      country: "",
      limit: 1,
    });
    return results[0] ?? null;
  }

  async getReviews(_params: ReviewsParams): Promise<unknown[]> {
    // Upstream review extraction is not wired up yet — jobs that request
    // reviews should fail loudly rather than silently return nothing useful.
    throw new Error("omkarcloud provider: getReviews is not implemented yet");
  }

  async healthCheck(): Promise<HealthResult> {
    try {
      await this.runScraper(["--version"], 10_000);
      return { healthy: true };
    } catch (err) {
      return { healthy: false, detail: (err as Error).message };
    }
  }

  private runScraper(args: string[], timeoutMs: number): Promise<void> {
    return new Promise((resolve, reject) => {
      const child = spawn(PYTHON_BIN, ["-m", "google_maps_scraper", ...args], {
        cwd: VENDOR_DIR,
        stdio: ["ignore", "pipe", "pipe"],
      });

      const timer = setTimeout(() => {
        child.kill("SIGKILL");
        reject(new Error(`scraper process timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      let stderr = "";
      child.stderr.on("data", (chunk) => {
        stderr += chunk.toString();
      });

      child.on("error", (err) => {
        clearTimeout(timer);
        reject(err);
      });

      child.on("exit", (code) => {
        clearTimeout(timer);
        if (code === 0) resolve();
        else reject(new Error(`scraper exited with code ${code}: ${stderr.slice(-2000)}`));
      });
    });
  }
}

function mapUpstreamRow(row: Record<string, unknown>): RawPlaceResult {
  const str = (v: unknown): string | null => (v == null ? null : String(v).trim() || null);
  const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);

  return {
    placeId: str(row.place_id ?? row.placeId),
    name: str(row.name) ?? "",
    address: str(row.full_address ?? row.address),
    street: str(row.street),
    city: str(row.city),
    province: str(row.state ?? row.province),
    postalCode: str(row.postal_code ?? row.zip),
    country: str(row.country),
    latitude: num(row.latitude ?? row.lat),
    longitude: num(row.longitude ?? row.lng),
    phone: str(row.phone_number ?? row.phone),
    website: str(row.website),
    category: str(row.category ?? row.type),
    rating: num(row.rating),
    reviewCount: num(row.reviews_count ?? row.review_count),
    openingHours: row.opening_hours ?? null,
    raw: row,
  };
}
