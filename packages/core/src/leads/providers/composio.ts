import type { LeadCriteria, RawLead } from "@jamot/contracts";
import type {
  LeadProvider,
  LeadProviderContext,
  LeadProviderServices,
} from "../types.js";
import { normalizeLead } from "../normalize.js";

/**
 * Composio provider: runs a lead search through an already-connected Composio
 * toolkit (e.g. LinkedIn, Apollo, Google Maps) using the existing connector
 * + `executeTool` infrastructure. Config on the LeadList:
 *   { connectorId?: string, toolSlug?: string }
 * When connectorId is omitted, the first connected lead-capable connector for
 * the organization is used.
 */

function extractLeads(result: unknown): Record<string, unknown>[] {
  if (result === null || result === undefined) return [];
  if (Array.isArray(result)) {
    return result
      .filter((entry): entry is Record<string, unknown> =>
        entry !== null && typeof entry === "object",
      )
      .flatMap((entry) => {
        if (Array.isArray(entry.people) || Array.isArray(entry.contacts)) {
          return (entry.people ?? entry.contacts) as Record<string, unknown>[];
        }
        if (Array.isArray(entry.results)) return entry.results as Record<string, unknown>[];
        return [entry];
      });
  }
  const record = result as Record<string, unknown>;
  for (const key of ["people", "contacts", "results", "items", "data"]) {
    if (Array.isArray(record[key])) {
      return extractLeads(record[key]);
    }
  }
  return [record];
}

export function createComposioLeadProvider(
  services: LeadProviderServices,
): LeadProvider {
  const composio = services.composio;

  async function resolveConnector(ctx: LeadProviderContext): Promise<{
    connectorId: string;
    toolkit: string;
  } | null> {
    if (!composio) return null;
    const configuredId = String(ctx.config.connectorId ?? "");
    if (configuredId) {
      return { connectorId: configuredId, toolkit: String(ctx.config.toolkit ?? "") };
    }
    const connections = await composio.listConnections({
      actorId: ctx.config.actorId as string,
      organizationId: ctx.organizationId,
      isAdmin: true,
    });
    const leadToolkits = new Set([
      "linkedin",
      "apollo",
      "google_maps",
      "googlemaps",
      "hubspot",
      "salesforce",
      "crm",
    ]);
    const candidate = connections.find((connection) => {
      const t = connection.toolkit.toLowerCase();
      return leadToolkits.has(t) || t.includes("linkedin") || t.includes("apollo");
    });
    if (!candidate) return null;
    return { connectorId: candidate.connector.id, toolkit: candidate.toolkit };
  }

  return {
    id: "composio",
    label: "Composio (LinkedIn / Apollo / Google Maps)",
    kind: "composio",

    async configured(ctx) {
      return Boolean(composio && (await resolveConnector(ctx)));
    },

    async describe(ctx) {
      const conn = await resolveConnector(ctx);
      return conn ? `Connected toolkit: ${conn.toolkit || "any"}` : "No connected lead toolkit";
    },

    async search(criteria: LeadCriteria, ctx) {
      if (!composio) throw new Error("Composio is not configured");
      const conn = await resolveConnector(ctx);
      if (!conn) {
        throw new Error("No connected Composio toolkit available for lead search");
      }
      const toolSlug = String(ctx.config.toolSlug ?? "linkedin_search_people");
      const result = await composio.executeTool({
        connectorId: conn.connectorId,
        toolSlug,
        arguments: {
          keywords: criteria.persona.keywords.join(", "),
          title: criteria.persona.titles.join(", "),
          industry: criteria.persona.industries.join(", "),
          location: criteria.area?.place,
          radius_km: criteria.area?.radiusKm,
          limit: Math.min(criteria.limit, 100),
        },
      });
      const payload =
        result && typeof result === "object" && "data" in result
          ? (result as { data: unknown }).data
          : result;
      return extractLeads(payload).map((entry) => normalizeLead(entry));
    },
  };
}