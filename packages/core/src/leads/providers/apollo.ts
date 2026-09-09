import type { LeadCriteria, RawLead } from "@jamot/contracts";
import type {
  LeadProvider,
  LeadProviderContext,
  LeadProviderServices,
} from "../types.js";
import { normalizeLead } from "../normalize.js";

const APOLLO_BASE_URL = "https://api.apollo.io/v1";
export const APOLLO_KEY_REF = "leads/apollo";

function orgKeyRef(organizationId: string): string {
  return `${APOLLO_KEY_REF}/${organizationId}`;
}

async function resolveApiKey(
  services: LeadProviderServices,
  ctx: LeadProviderContext,
): Promise<string | null> {
  if (ctx.organizationId) {
    const orgSecret = await services.repo.getSecret(orgKeyRef(ctx.organizationId));
    if (orgSecret) {
      try {
        return services.secretStore.decrypt(orgSecret.ciphertext);
      } catch {
        // fall through to global/env
      }
    }
  }
  const global = await services.repo.getSecret(APOLLO_KEY_REF);
  if (global) {
    try {
      return services.secretStore.decrypt(global.ciphertext);
    } catch {
      // fall through to env
    }
  }
  const envKey = services.env?.APOLLO_API_KEY;
  return typeof envKey === "string" && envKey.length > 0 ? envKey : null;
}

export function createApolloProvider(
  services: LeadProviderServices,
): LeadProvider {
  async function apiKey(ctx: LeadProviderContext): Promise<string | null> {
    return resolveApiKey(services, ctx);
  }

  return {
    id: "apollo",
    label: "Apollo.io",
    kind: "api",

    async configured(ctx) {
      return (await apiKey(ctx)) !== null;
    },

    async describe(ctx) {
      return (await apiKey(ctx)) ? "API key configured" : "Missing API key";
    },

    async search(criteria: LeadCriteria, ctx) {
      const key = await apiKey(ctx);
      if (!key) throw new Error("Apollo API key is not configured");

      const persona = criteria.persona;
      const limit = Math.min(criteria.limit, 100);

      const body: Record<string, unknown> = {
        page: 1,
        per_page: limit,
        reveal_personal_emails: true,
      };
      if (persona.titles.length > 0) body.person_titles = persona.titles;
      if (persona.seniority.length > 0) body.person_seniorities = persona.seniority;
      if (persona.industries.length > 0) body.organization_industries = persona.industries;
      if (persona.companySizes.length > 0) {
        body.organization_num_employees_ranges = persona.companySizes;
      }
      if (persona.keywords.length > 0) body.q_keywords = persona.keywords;
      const location = criteria.area?.place;
      if (location) {
        body.organization_locations = [location];
        body.person_locations = [location];
      }

      const res = await fetch(`${APOLLO_BASE_URL}/people/search`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Api-Key": key,
        },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        throw new Error(
          `Apollo people search failed (${res.status}): ${(await res.text()).slice(0, 200)}`,
        );
      }
      const data = (await res.json()) as { people?: unknown[] };
      if (!Array.isArray(data.people)) return [];

      return data.people
        .filter(
          (entry): entry is Record<string, unknown> =>
            entry !== null && typeof entry === "object",
        )
        .map((entry) => normalizeLead(entry));
    },

    async enrich(lead: RawLead, ctx) {
      const key = await apiKey(ctx);
      if (!key) return lead;

      const body: Record<string, unknown> = {
        reveal_personal_emails: true,
      };
      if (lead.email) body.email = lead.email;
      if (lead.firstName) body.first_name = lead.firstName;
      if (lead.lastName) body.last_name = lead.lastName;
      if (lead.company) body.organization_name = lead.company;

      const res = await fetch(`${APOLLO_BASE_URL}/people/match`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Api-Key": key,
        },
        body: JSON.stringify(body),
      });
      if (!res.ok) return lead;
      const data = (await res.json()) as { person?: unknown };
      if (!data.person || typeof data.person !== "object") return lead;

      const enriched = normalizeLead(data.person as Record<string, unknown>);
      return {
        ...lead,
        ...enriched,
        raw: { ...lead.raw, apolloMatch: data.person },
      };
    },
  };
}