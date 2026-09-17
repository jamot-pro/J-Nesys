import type { ComposioService } from "../composio/index.js";
import type { JamotRepository } from "../repository/repository.js";
import type { SecretStore } from "../secrets/secret-store.js";
import type { LeadCriteria, RawLead } from "@jamot/contracts";

/** Everything a provider needs at call time. */
export interface LeadProviderContext {
  organizationId: string | null;
  spaceId: string;
  /** Provider-specific config stored on the LeadList (e.g. apiKeyRef, connectorId, url). */
  config: Record<string, unknown>;
}

/** Shared services handed to providers when the registry is built. */
export interface LeadProviderServices {
  repo: JamotRepository;
  secretStore: SecretStore;
  composio?: ComposioService;
  env?: NodeJS.ProcessEnv;
}

/**
 * A modular lead source. Any provider (Apollo.io API, a Composio-connected
 * toolkit such as LinkedIn/Google Maps/Apollo, an MCP server, or a future
 * source) implements this interface; adding a source is one file + a registry
 * registration.
 */
export interface LeadProvider {
  id: string;
  label: string;
  kind: "api" | "composio" | "mcp";
  /** Returns true when the provider can be used for the given context. */
  configured(ctx: LeadProviderContext): Promise<boolean>;
  /** Detail string surfaced in the UI (e.g. the connected toolkit). */
  describe(ctx: LeadProviderContext): Promise<string>;
  /**
   * Search the provider for leads matching the criteria. `onProgress`, when
   * given, is called as results accumulate (real interim counts, not a
   * heuristic) so a caller can show progress on a run that can take minutes.
   * A provider with no way to report interim progress (a single blocking
   * call) may simply never call it — the run still completes normally.
   */
  search(
    criteria: LeadCriteria,
    ctx: LeadProviderContext,
    onProgress?: (foundSoFar: number) => void,
  ): Promise<RawLead[]>;
  /** Optionally enrich a previously collected lead with more firmographics. */
  enrich?(lead: RawLead, ctx: LeadProviderContext): Promise<RawLead>;
}