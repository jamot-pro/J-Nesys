export { createLeadGenerationService } from "./service.js";
export type { LeadGenerationService } from "./service.js";
export { createLeadProviderRegistry } from "./registry.js";
export type { LeadProviderRegistry } from "./registry.js";
export type {
  LeadProvider,
  LeadProviderContext,
  LeadProviderServices,
} from "./types.js";
export { normalizeLead, mergeLead } from "./normalize.js";
export { rawLeadToPerson, toPersonInput, personToLeadView } from "./person-mapper.js";
export { createApolloProvider, APOLLO_KEY_REF } from "./providers/apollo.js";
export { createComposioLeadProvider } from "./providers/composio.js";
export { createMcpLeadProvider } from "./providers/mcp.js";