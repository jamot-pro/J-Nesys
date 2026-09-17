import type { LeadCriteria, RawLead } from "@jamot/contracts";
import type {
  LeadProvider,
  LeadProviderContext,
  LeadProviderServices,
} from "../types.js";

/**
 * Google Maps places as leads, collected through Apify.
 *
 * Maps has no official API that returns the fields lead generation needs at
 * the volumes it needs them: Places API bills per call, caps what may be
 * stored, and does not expose a result set you can sweep by area. So the
 * practical route is a scraping provider — and this uses a managed one rather
 * than a browser driven from our own servers.
 *
 * That choice is deliberate. A scraper we operate ourselves would need to
 * defeat Google's bot detection to keep working, which is both a losing
 * maintenance race and not something this codebase should contain. Apify runs
 * the actor, owns the egress, and carries the terms for it; we send a query
 * and read a dataset.
 *
 * The actor is `compass/crawler-google-places`, the long-standing Maps scraper
 * on the Apify store.
 */

const APIFY_BASE_URL = "https://api.apify.com/v2";
const ACTOR_ID = "compass~crawler-google-places";
export const APIFY_TOKEN_REF = "leads/apify";

function orgTokenRef(organizationId: string): string {
  return `${APIFY_TOKEN_REF}/${organizationId}`;
}

/** Organization secret first, then the platform one, then the environment. */
async function resolveToken(
  services: LeadProviderServices,
  ctx: LeadProviderContext,
): Promise<string | null> {
  const refs = [
    ctx.organizationId ? orgTokenRef(ctx.organizationId) : null,
    APIFY_TOKEN_REF,
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

  const fromEnv = services.env?.APIFY_TOKEN;
  return typeof fromEnv === "string" && fromEnv.length > 0 ? fromEnv : null;
}

/**
 * What to type into Maps' search box.
 *
 * Maps searches by trade, not by job title, so industries and keywords carry
 * the query and titles are ignored — a person's seniority is not something a
 * place listing knows.
 */
function searchTerms(criteria: LeadCriteria): string[] {
  const persona = criteria.persona ?? {};
  const terms = [
    ...(persona.industries ?? []),
    ...(persona.keywords ?? []),
  ]
    .map((term) => term.trim())
    .filter(Boolean);

  if (terms.length > 0) return [...new Set(terms)];
  const summary = (persona.summary ?? "").trim();
  return summary ? [summary] : [];
}

/** Splits the free-text "what not to search" prompt into lowercase terms. */
function excludeTermsFrom(raw: unknown): string[] {
  if (typeof raw !== "string") return [];
  return raw
    .split(/[,\n]/)
    .map((term) => term.trim().toLowerCase())
    .filter(Boolean);
}

function matchesExcludeTerms(lead: RawLead, terms: string[]): boolean {
  if (terms.length === 0) return false;
  const haystack = [lead.company, lead.industry, ...((lead.extra.categories as string[] | undefined) ?? [])]
    .join(" ")
    .toLowerCase();
  return terms.some((term) => haystack.includes(term));
}

const text = (value: unknown): string => (value == null ? "" : String(value).trim());

const httpUrl = (value: unknown): string | null => {
  const raw = text(value);
  if (!raw) return null;
  const candidate = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  try {
    return new URL(candidate).href;
  } catch {
    return null;
  }
};

/** RawLead rejects a malformed address, so anything doubtful becomes null. */
const email = (value: unknown): string | null => {
  const raw = text(value);
  return /^[^@\s]+@[^@\s.]+\.[^@\s]+$/.test(raw) ? raw : null;
};

interface MapsPlace {
  title?: unknown;
  categoryName?: unknown;
  categories?: unknown;
  address?: unknown;
  street?: unknown;
  city?: unknown;
  state?: unknown;
  countryCode?: unknown;
  postalCode?: unknown;
  website?: unknown;
  phone?: unknown;
  phoneUnformatted?: unknown;
  emails?: unknown;
  totalScore?: unknown;
  reviewsCount?: unknown;
  placeId?: unknown;
  url?: unknown;
  location?: unknown;
  permanentlyClosed?: unknown;
  temporarilyClosed?: unknown;
}

/**
 * A place is a business, not a person, so the person fields stay empty and the
 * company fields carry everything. The lead mapper downstream creates a person
 * only when a provider supplies one; a Maps lead is a company to approach.
 */
function toLead(place: MapsPlace): RawLead {
  const emails = Array.isArray(place.emails) ? place.emails : [];
  const categories = Array.isArray(place.categories) ? place.categories.map(text) : [];
  const location = (place.location ?? {}) as { lat?: unknown; lng?: unknown };

  return {
    firstName: "",
    lastName: "",
    email: email(emails[0]),
    phone: text(place.phone) || text(place.phoneUnformatted) || null,
    title: "",
    seniority: "",
    company: text(place.title),
    industry: text(place.categoryName) || categories[0] || "",
    companySize: "",
    location: text(place.address) || [text(place.city), text(place.countryCode)].filter(Boolean).join(", "),
    hqLocation: text(place.address),
    linkedinUrl: null,
    website: httpUrl(place.website),
    extra: {
      source: "google-maps",
      categories,
      rating: typeof place.totalScore === "number" ? place.totalScore : null,
      reviews: typeof place.reviewsCount === "number" ? place.reviewsCount : null,
      placeId: text(place.placeId) || null,
      mapsUrl: httpUrl(place.url),
      lat: typeof location.lat === "number" ? location.lat : null,
      lng: typeof location.lng === "number" ? location.lng : null,
      closed: Boolean(place.permanentlyClosed) || Boolean(place.temporarilyClosed),
    },
    raw: place as Record<string, unknown>,
  };
}

export function createGoogleMapsProvider(
  services: LeadProviderServices,
): LeadProvider {
  async function token(ctx: LeadProviderContext): Promise<string | null> {
    return resolveToken(services, ctx);
  }

  return {
    id: "google-maps",
    label: "Google Maps (via Apify)",
    kind: "api",

    async configured(ctx) {
      return (await token(ctx)) !== null;
    },

    async describe(ctx) {
      return (await token(ctx))
        ? "Apify token configured — searches Maps by area and trade"
        : "Missing Apify token";
    },

    async search(criteria, ctx, onProgress) {
      const apifyToken = await token(ctx);
      if (!apifyToken) throw new Error("Google Maps provider has no Apify token");

      const terms = searchTerms(criteria);
      if (terms.length === 0) {
        throw new Error(
          "Google Maps needs something to search for — give the list an industry or a keyword",
        );
      }

      const area = criteria.area;
      const limit = Math.min(criteria.limit ?? 100, 1000);

      const input: Record<string, unknown> = {
        searchStringsArray: terms,
        /* Split the cap across the search terms so one trade cannot consume
           the whole run and leave the others empty. */
        maxCrawledPlacesPerSearch: Math.max(1, Math.ceil(limit / terms.length)),
        language: "en",
        skipClosedPlaces: true,
      };

      /* The actor's own docs: "Location settings always take priority over
         Geolocation, so use either section but not both at the same time" —
         setting locationQuery alongside customGeolocation doesn't combine
         them, it silently discards the radius/polygon entirely. So this
         picks exactly one: an explicit shape (radius circle, then polygon)
         takes precedence over the free-text place, since a shape is a
         deliberate narrowing the place string can't express. */
      if (area?.center && area.radiusKm) {
        input.customGeolocation = {
          type: "Point",
          coordinates: [area.center.lng, area.center.lat],
          radiusKm: area.radiusKm,
        };
      } else if (area?.polygon && area.polygon.length >= 3) {
        input.customGeolocation = {
          type: "Polygon",
          coordinates: [
            [...area.polygon, area.polygon[0]!].map((point) => [point.lng, point.lat]),
          ],
        };
      } else if (area?.place) {
        input.locationQuery = area.place;
      }

      /* Started as an async run (not run-sync-get-dataset-items) specifically
         so progress is observable: the run's dataset accumulates items while
         the actor is still working, and Apify's dataset GET endpoint reports
         itemCount for it in real time. A single blocking sync call has no
         equivalent — it returns everything at once, at the end, with nothing
         to poll in between. */
      const startResponse = await fetch(
        `${APIFY_BASE_URL}/acts/${ACTOR_ID}/runs?token=${encodeURIComponent(apifyToken)}`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(input),
          signal: AbortSignal.timeout(30_000),
        },
      );
      if (!startResponse.ok) {
        const detail = await startResponse.text().catch(() => "");
        throw new Error(
          `Apify returned ${startResponse.status} starting the run${detail ? `: ${detail.slice(0, 200)}` : ""}`,
        );
      }
      const started = (await startResponse.json()) as {
        data: { id: string; defaultDatasetId: string; status: string };
      };
      const runId = started.data.id;
      const datasetId = started.data.defaultDatasetId;

      const TERMINAL = new Set(["SUCCEEDED", "FAILED", "TIMED-OUT", "ABORTED"]);
      const deadline = Date.now() + 10 * 60 * 1000; // same overall budget as before
      let status = started.data.status;

      while (!TERMINAL.has(status)) {
        if (Date.now() > deadline) throw new Error("Apify run timed out after 10 minutes");
        await new Promise((resolve) => setTimeout(resolve, 3000));

        const [runRes, datasetRes] = await Promise.all([
          fetch(`${APIFY_BASE_URL}/actor-runs/${runId}?token=${encodeURIComponent(apifyToken)}`, {
            signal: AbortSignal.timeout(15_000),
          }),
          fetch(`${APIFY_BASE_URL}/datasets/${datasetId}?token=${encodeURIComponent(apifyToken)}`, {
            signal: AbortSignal.timeout(15_000),
          }),
        ]);
        if (runRes.ok) {
          const runJson = (await runRes.json()) as { data: { status: string } };
          status = runJson.data.status;
        }
        if (datasetRes.ok && onProgress) {
          const datasetJson = (await datasetRes.json()) as { data: { itemCount: number } };
          onProgress(datasetJson.data.itemCount);
        }
      }

      if (status !== "SUCCEEDED") {
        throw new Error(`Apify run ended as ${status}`);
      }

      const itemsResponse = await fetch(
        `${APIFY_BASE_URL}/datasets/${datasetId}/items?token=${encodeURIComponent(apifyToken)}`,
        { signal: AbortSignal.timeout(60_000) },
      );
      if (!itemsResponse.ok) {
        const detail = await itemsResponse.text().catch(() => "");
        throw new Error(
          `Apify returned ${itemsResponse.status} fetching results${detail ? `: ${detail.slice(0, 200)}` : ""}`,
        );
      }

      const rows = (await itemsResponse.json()) as unknown;
      if (!Array.isArray(rows)) return [];

      /* "What not to search" is free text, not a filter DSL Apify
         understands, so it can't be sent as part of the actor input — it's
         applied here instead, as a simple case-insensitive substring check
         against the business name and its category. Good enough for "skip
         fast food chains" style exclusions without needing an LLM call. */
      const excludeTerms = excludeTermsFrom(ctx.config?.exclude);

      return rows
        .map((row) => toLead(row as MapsPlace))
        .filter((lead) => lead.company.length > 0)
        .filter((lead) => !matchesExcludeTerms(lead, excludeTerms))
        .slice(0, limit);
    },
  };
}
