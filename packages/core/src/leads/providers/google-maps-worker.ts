import type { LeadCriteria, RawLead } from "@jamot/contracts";
import type {
  LeadProvider,
  LeadProviderContext,
  LeadProviderServices,
} from "../types.js";

/**
 * Google Maps leads via the self-hosted google-maps-worker service
 * (services/google-maps-worker), a second Maps source alongside the
 * Apify-based provider in ./google-maps.ts. Both register under the same
 * "lead-generation" app (packages/core/src/apps/registry.ts) as separate
 * provider ids — this is the "multiple tools, one app" design: adding a
 * source is a registration here, not a new app.
 *
 * The worker is job-based and asynchronous (POST /jobs -> poll -> GET
 * /jobs/:id/results), unlike Apify's synchronous run-and-return call, so
 * this provider polls until the job leaves "queued"/"running" or the poll
 * budget below is exhausted.
 */

export const MAPS_WORKER_TOKEN_REF = "leads/google-maps-worker";
const DEFAULT_POLL_INTERVAL_MS = 3000;
const DEFAULT_POLL_BUDGET_MS = 15 * 60 * 1000; // matches the worker's default MAPS_JOB_TIMEOUT

function orgTokenRef(organizationId: string): string {
  return `${MAPS_WORKER_TOKEN_REF}/${organizationId}`;
}

/** Organization secret first, then the platform one, then the environment — same order as the Apify provider. */
async function resolveToken(
  services: LeadProviderServices,
  ctx: LeadProviderContext,
): Promise<string | null> {
  const refs = [
    ctx.organizationId ? orgTokenRef(ctx.organizationId) : null,
    MAPS_WORKER_TOKEN_REF,
  ].filter((ref): ref is string => ref !== null);

  for (const ref of refs) {
    const secret = await services.repo.getSecret(ref);
    if (!secret) continue;
    try {
      return services.secretStore.decrypt(secret.ciphertext);
    } catch {
      // A secret we cannot decrypt is the same as one we do not have.
    }
  }

  const fromEnv = services.env?.MAPS_WORKER_INTERNAL_TOKEN;
  return typeof fromEnv === "string" && fromEnv.length > 0 ? fromEnv : null;
}

function baseUrl(services: LeadProviderServices, ctx: LeadProviderContext): string | null {
  const fromConfig = ctx.config?.url;
  if (typeof fromConfig === "string" && fromConfig.length > 0) return fromConfig.replace(/\/$/, "");
  const fromEnv = services.env?.MAPS_WORKER_URL;
  return typeof fromEnv === "string" && fromEnv.length > 0 ? fromEnv.replace(/\/$/, "") : null;
}

/** Same query-building logic as the Apify provider — Maps searches by trade, not job title. */
function searchTerms(criteria: LeadCriteria): string[] {
  const persona = criteria.persona ?? {};
  const terms = [...(persona.industries ?? []), ...(persona.keywords ?? [])]
    .map((term) => term.trim())
    .filter(Boolean);
  if (terms.length > 0) return [...new Set(terms)];
  const summary = (persona.summary ?? "").trim();
  return summary ? [summary] : [];
}

interface WorkerJob {
  jobId: string;
  status: "queued" | "running" | "paused" | "completed" | "partial" | "failed" | "cancelled";
  errors: string[];
}

interface WorkerLocation {
  locationId: string;
  companyId: string;
  googlePlaceId: string | null;
  name: string;
  address: string | null;
  city: string | null;
  province: string | null;
  country: string | null;
  latitude: number | null;
  longitude: number | null;
  phone: string | null;
  website: string | null;
  category: string | null;
  rating: number | null;
  reviewCount: number | null;
}

async function request(
  url: string,
  token: string | null,
  init: RequestInit = {},
): Promise<Response> {
  return fetch(url, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(init.headers ?? {}),
    },
  });
}

function toRawLead(location: WorkerLocation): RawLead {
  return {
    firstName: "",
    lastName: "",
    email: null,
    phone: location.phone,
    title: "",
    seniority: "",
    company: location.name,
    industry: location.category ?? "",
    companySize: "",
    location: [location.city, location.country].filter(Boolean).join(", "),
    hqLocation: location.address ?? "",
    linkedinUrl: null,
    website: location.website,
    extra: {
      source: "google-maps-worker",
      placeId: location.googlePlaceId,
      rating: location.rating,
      reviews: location.reviewCount,
      lat: location.latitude,
      lng: location.longitude,
    },
    raw: location as unknown as Record<string, unknown>,
  };
}

export function createGoogleMapsWorkerProvider(
  services: LeadProviderServices,
): LeadProvider {
  async function resolve(ctx: LeadProviderContext) {
    return { url: baseUrl(services, ctx), token: await resolveToken(services, ctx) };
  }

  return {
    id: "google-maps-worker",
    label: "Google Maps (self-hosted worker)",
    kind: "api",

    async configured(ctx) {
      const { url } = await resolve(ctx);
      return url !== null;
    },

    async describe(ctx) {
      const { url } = await resolve(ctx);
      return url ? `Worker configured at ${url}` : "Missing MAPS_WORKER_URL";
    },

    async search(criteria, ctx) {
      const { url, token } = await resolve(ctx);
      if (!url) throw new Error("Google Maps worker provider has no base URL configured");

      const terms = searchTerms(criteria);
      if (terms.length === 0) {
        throw new Error(
          "Google Maps needs something to search for — give the list an industry or a keyword",
        );
      }

      // The worker's job schema requires a country; LeadArea only carries a
      // free-text place label, so that label is the best country signal
      // available here. A caller that wants precise geo targeting should set
      // providerConfig.country explicitly on the LeadList.
      const country =
        (typeof ctx.config?.country === "string" && ctx.config.country) ||
        criteria.area?.place ||
        "unknown";

      const createRes = await request(`${url}/jobs`, token, {
        method: "POST",
        body: JSON.stringify({
          query: terms.join(", "),
          country,
          center_lat: criteria.area?.center?.lat,
          center_lng: criteria.area?.center?.lng,
          radius_km: criteria.area?.radiusKm,
        }),
      });
      if (!createRes.ok) {
        throw new Error(`google-maps-worker returned ${createRes.status} creating job`);
      }
      const { job_id: jobId } = (await createRes.json()) as { job_id: string };

      const deadline = Date.now() + DEFAULT_POLL_BUDGET_MS;
      let job: WorkerJob;
      for (;;) {
        const jobRes = await request(`${url}/jobs/${jobId}`, token);
        if (!jobRes.ok) throw new Error(`google-maps-worker returned ${jobRes.status} polling job`);
        job = (await jobRes.json()) as WorkerJob;
        if (job.status !== "queued" && job.status !== "running") break;
        if (Date.now() > deadline) {
          throw new Error(`google-maps-worker job ${jobId} did not finish within the poll budget`);
        }
        await new Promise((resolve) => setTimeout(resolve, DEFAULT_POLL_INTERVAL_MS));
      }

      if (job.status === "failed" || job.status === "cancelled") {
        throw new Error(
          `google-maps-worker job ${jobId} ended as ${job.status}${job.errors?.length ? `: ${job.errors.join("; ")}` : ""}`,
        );
      }

      const resultsRes = await request(`${url}/jobs/${jobId}/results`, token);
      if (!resultsRes.ok) {
        throw new Error(`google-maps-worker returned ${resultsRes.status} fetching results`);
      }
      const locations = (await resultsRes.json()) as WorkerLocation[];
      return locations.map(toRawLead).slice(0, criteria.limit ?? 100);
    },
  };
}
