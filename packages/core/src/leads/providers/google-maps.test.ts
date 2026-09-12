import { describe, expect, it, vi, afterEach } from "vitest";
import { createGoogleMapsProvider } from "./google-maps.js";
import type { LeadProviderContext, LeadProviderServices } from "../types.js";

const ctx: LeadProviderContext = { organizationId: null, spaceId: "s1", config: {} };

function services(token?: string): LeadProviderServices {
  return {
    repo: { getSecret: async () => null } as unknown as LeadProviderServices["repo"],
    secretStore: { decrypt: (v: string) => v } as unknown as LeadProviderServices["secretStore"],
    env: token ? ({ APIFY_TOKEN: token } as NodeJS.ProcessEnv) : ({} as NodeJS.ProcessEnv),
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
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
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init: { body: string }) => {
        sent = JSON.parse(init.body);
        return { ok: true, json: async () => [] } as unknown as Response;
      }),
    );

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
    expect(sent.locationQuery).toBe("Utrecht");
    expect(sent.maxCrawledPlacesPerSearch).toBe(50);
    expect(sent.customGeolocation).toMatchObject({ type: "Point", coordinates: [5.12, 52.09] });
  });

  it("maps a place to a company lead, keeping the payload for provenance", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        ({
          ok: true,
          json: async () => [
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
          ],
        }) as unknown as Response,
      ),
    );

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
});
