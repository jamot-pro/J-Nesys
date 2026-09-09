import { createMcpClient, assertSafeMcpUrl } from "../../mcp/index.js";
import type { LeadCriteria, RawLead } from "@jamot/contracts";
import type {
  LeadProvider,
  LeadProviderContext,
  LeadProviderServices,
} from "../types.js";
import { normalizeLead } from "../normalize.js";

/**
 * MCP provider: calls a configured MCP server's tool (default `leads.search`)
 * and normalizes the returned records. Config on the LeadList:
 *   { url?: string, headers?: Record<string,string>, tool?: string }
 * The URL is validated with the same SSRF guard used by agent imports unless
 * it is an operator-supplied internal endpoint (see GRAPHITI_MCP_URL).
 */
export function createMcpLeadProvider(
  services: LeadProviderServices,
): LeadProvider {
  return {
    id: "mcp",
    label: "MCP server",
    kind: "mcp",

    async configured(ctx) {
      const url = String(ctx.config.url ?? "");
      if (!url) return false;
      if (ctx.config.allowPrivate) return true;
      try {
        assertSafeMcpUrl(url);
        return true;
      } catch {
        return false;
      }
    },

    async describe(ctx) {
      return String(ctx.config.url ?? "");
    },

    async search(criteria: LeadCriteria, ctx) {
      const url = String(ctx.config.url ?? "");
      if (!url) throw new Error("MCP server URL is not configured");
      if (!ctx.config.allowPrivate) assertSafeMcpUrl(url);
      const headers = (ctx.config.headers ?? {}) as Record<string, string>;
      const client = createMcpClient(url, headers);
      const tool = String(ctx.config.tool ?? "leads.search");

      const result = await client.callTool(tool, {
        criteria: {
          area: criteria.area ?? null,
          persona: criteria.persona,
          limit: criteria.limit,
        },
      });

      const records = extractRecords(result);
      return records.map((entry) => normalizeLead(entry));
    },
  };
}

function extractRecords(result: unknown): Record<string, unknown>[] {
  if (result === null || result === undefined) return [];
  if (Array.isArray(result)) {
    return result
      .filter((entry): entry is Record<string, unknown> =>
        entry !== null && typeof entry === "object",
      )
      .flatMap((entry) => {
        if (Array.isArray(entry.leads)) return entry.leads as Record<string, unknown>[];
        if (Array.isArray(entry.people)) return entry.people as Record<string, unknown>[];
        if (Array.isArray(entry.results)) return entry.results as Record<string, unknown>[];
        return [entry];
      });
  }
  const record = result as Record<string, unknown>;
  for (const key of ["leads", "people", "results", "items", "data"]) {
    if (Array.isArray(record[key])) return extractRecords(record[key]);
  }
  return [record];
}