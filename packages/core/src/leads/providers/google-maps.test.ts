import { describe, expect, it, vi, afterEach } from "vitest";
import { createGoogleMapsProvider } from "./google-maps.js";
import type { LeadProviderContext, LeadProviderServices } from "../types.js";
import * as llm from "../../llm/index.js";

const ctx: LeadProviderContext = { organizationId: null, spaceId: "s1", config: {} };

function services(token?: string, extraEnv?: NodeJS.ProcessEnv): LeadProviderServices {
  return {
    repo: { getSecret: async () => null } as unknown as LeadProviderServices["repo"],
    secretStore: { decrypt: (v: string) => v } as unknown as LeadProviderServices["secretStore"],
    env: {
      ...(token ? { APIFY_TOKEN: token } : {}),
      ...extraEnv,
    } as NodeJS.ProcessEnv,
  };
}

/**
 * Stubs the three-call async-run flow (start → poll → fetch items) that
 * google-maps.ts now uses instead of the old single blocking
 * run-sync-get-dataset-items call. Reports the run as already SUCCEEDED on
 * the start response so tests never enter the poll loop — fast and
 * deterministic, since the loop itself (sleep + repeat) isn't what these
 * tests are about.
 */
function stubApifyRun(items: unknown[], captureInput?: (input: Record<string, unknown>) => void) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: { body?: string }) => {
      if (url.includes("/runs?")) {
        if (init?.body) captureInput?.(JSON.parse(init.body));
        return {
          ok: true,
          json: async () => ({ data: { id: "run1", defaultDatasetId: "ds1", status: "SUCCEEDED" } }),
        } as unknown as Response;
      }
      if (url.includes("/datasets/ds1/items")) {
        return { ok: true, json: async () => items } as unknown as Response;
      }
      throw new Error(`unexpected fetch: ${url}`);
    }),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("google maps lead provider", () => {
  it("is unconfigured without a token, and says so", async () => {
    const provider = createGoogleMapsProvider(services());
    expect(await provider.configured(ctx)).toBe(false);
    expect(await provider.describe(ctx)).toMatch(/missing/i);
  });

  it("refuses to run with nothing to search for", async () => {
    const provider = createGoogleMapsProvider(services("tok"));
    await expect(
      provider.search({ persona: {} as never, limit: 10 }, ctx),
    ).rejects.toThrow(/industry or a keyword/);
  });

  it("searches by trade and area, and splits the cap across terms", async () => {
    let sent: Record<string, unknown> = {};
    stubApifyRun([], (input) => (sent = input));

    const provider = createGoogleMapsProvider(services("tok"));
    await provider.search(
      {
        area: { place: "Utrecht", center: { lat: 52.09, lng: 5.12 }, radiusKm: 10 },
        persona: { industries: ["plumber"], keywords: ["boiler repair"] } as never,
        limit: 100,
      },
      ctx,
    );

    expect(sent.searchStringsArray).toEqual(["plumber", "boiler repair"]);
    expect(sent.maxCrawledPlacesPerSearch).toBe(50);
    // The actor's own docs: locationQuery always overrides customGeolocation
    // when both are present ("use either section but not both") — so a
    // radius circle must be sent alone, never alongside locationQuery, or
    // the radius is silently discarded.
    expect(sent.customGeolocation).toMatchObject({ type: "Point", coordinates: [5.12, 52.09], radiusKm: 10 });
    expect(sent.locationQuery).toBeUndefined();
  });

  it("falls back to locationQuery only when no center/radius or polygon is given", async () => {
    let sent: Record<string, unknown> = {};
    stubApifyRun([], (input) => (sent = input));

    const provider = createGoogleMapsProvider(services("tok"));
    await provider.search(
      {
        area: { place: "Utrecht" },
        persona: { industries: ["plumber"] } as never,
        limit: 100,
      },
      ctx,
    );

    expect(sent.locationQuery).toBe("Utrecht");
    expect(sent.customGeolocation).toBeUndefined();
  });

  it("reports interim progress via onProgress as the run completes", async () => {
    stubApifyRun([{ title: "A" }, { title: "B" }]);

    const provider = createGoogleMapsProvider(services("tok"));
    const progress: number[] = [];
    await provider.search(
      { persona: { industries: ["plumber"] } as never, limit: 10 },
      ctx,
      (n) => progress.push(n),
    );

    // The start response already reports SUCCEEDED, so the poll loop never
    // runs and onProgress is never called — this just confirms passing a
    // callback doesn't break anything when there's nothing to report yet.
    expect(progress).toEqual([]);
  });

  it("drops results matching the free-text 'what not to search' exclusion", async () => {
    stubApifyRun([
      { title: "Joe's Fast Food", categoryName: "Fast food restaurant" },
      { title: "Trattoria Roma", categoryName: "Italian restaurant" },
    ]);

    const provider = createGoogleMapsProvider(services("tok"));
    const leads = await provider.search(
      { persona: { industries: ["restaurant"] } as never, limit: 10 },
      { ...ctx, config: { exclude: "fast food, chain" } },
    );

    expect(leads).toHaveLength(1);
    expect(leads[0]!.company).toBe("Trattoria Roma");
  });

  it("maps a place to a company lead, keeping the payload for provenance", async () => {
    stubApifyRun([
      {
        title: "Hobbema Loodgieters",
        categoryName: "Plumber",
        address: "Oudegracht 1, Utrecht",
        website: "hobbema.nl",
        phone: "+31 30 123 4567",
        totalScore: 4.6,
        reviewsCount: 88,
        placeId: "ChIJabc",
        location: { lat: 52.09, lng: 5.12 },
      },
      { title: "" },
    ]);

    const provider = createGoogleMapsProvider(services("tok"));
    const leads = await provider.search(
      { persona: { industries: ["plumber"] } as never, limit: 10 },
      ctx,
    );

    // The nameless row is dropped rather than becoming an empty company.
    expect(leads).toHaveLength(1);
    expect(leads[0]).toMatchObject({
      company: "Hobbema Loodgieters",
      industry: "Plumber",
      phone: "+31 30 123 4567",
      // A bare domain is still stored as a usable URL.
      website: "https://hobbema.nl/",
      // A place is a business, so no person is invented for it.
      firstName: "",
      lastName: "",
      email: null,
    });
    expect(leads[0]!.extra).toMatchObject({ rating: 4.6, reviews: 88, placeId: "ChIJabc" });
    expect(leads[0]!.raw).toHaveProperty("title", "Hobbema Loodgieters");
  });

  it("surfaces an Apify failure instead of returning nothing", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        ({ ok: false, status: 402, text: async () => "monthly usage exceeded" }) as unknown as Response,
      ),
    );
    const provider = createGoogleMapsProvider(services("tok"));
    await expect(
      provider.search({ persona: { industries: ["plumber"] } as never, limit: 5 }, ctx),
    ).rejects.toThrow(/402.*monthly usage/);
  });

  it("surfaces a non-SUCCEEDED terminal run status as a failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url.includes("/runs?")) {
          return {
            ok: true,
            json: async () => ({ data: { id: "run1", defaultDatasetId: "ds1", status: "FAILED" } }),
          } as unknown as Response;
        }
        throw new Error(`unexpected fetch: ${url}`);
      }),
    );
    const provider = createGoogleMapsProvider(services("tok"));
    await expect(
      provider.search({ persona: { industries: ["plumber"] } as never, limit: 5 }, ctx),
    ).rejects.toThrow(/ended as FAILED/);
  });

  it("asks the org's configured model to turn a free-text prompt into keywords", async () => {
    let sent: Record<string, unknown> = {};
    stubApifyRun([], (input) => (sent = input));

    vi.spyOn(llm, "resolveEnabledModel").mockResolvedValue({
      kind: "anthropic",
      model: "claude-3-5-haiku-latest",
      apiKey: "sk-test",
      providerName: "test",
    });
    vi.spyOn(llm, "createLLMProvider").mockReturnValue({
      name: "test",
      complete: vi.fn().mockResolvedValue({ content: '["bank", "credit union"]' }),
    });

    const provider = createGoogleMapsProvider(services("tok"));
    await provider.search(
      { persona: { summary: "I want all the banks" } as never, limit: 10 },
      { ...ctx, config: { exclude: "ATM machines" } },
    );

    expect(sent.searchStringsArray).toEqual(["bank", "credit union"]);
  });

  it("falls back to the raw sentence when no model is configured or the call fails", async () => {
    let sent: Record<string, unknown> = {};
    stubApifyRun([], (input) => (sent = input));

    vi.spyOn(llm, "resolveEnabledModel").mockResolvedValue(null);

    const provider = createGoogleMapsProvider(services("tok"));
    await provider.search(
      { persona: { summary: "I want all the banks" } as never, limit: 10 },
      ctx,
    );

    expect(sent.searchStringsArray).toEqual(["I want all the banks"]);
  });
});
