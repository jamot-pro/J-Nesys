import type { LeadProvider, LeadProviderServices } from "./types.js";
import { createApolloProvider } from "./providers/apollo.js";
import { createComposioLeadProvider } from "./providers/composio.js";
import { createMcpLeadProvider } from "./providers/mcp.js";

export interface LeadProviderRegistry {
  list(): LeadProvider[];
  get(id: string): LeadProvider | null;
  register(provider: LeadProvider): void;
}

export function createLeadProviderRegistry(
  services: LeadProviderServices,
  seed: LeadProvider[] = [],
): LeadProviderRegistry {
  const providers = new Map<string, LeadProvider>();

  function install(provider: LeadProvider) {
    providers.set(provider.id, provider);
  }

  // Modular default sources — adding a provider is a registration, not a fork.
  install(createApolloProvider(services));
  install(createComposioLeadProvider(services));
  install(createMcpLeadProvider(services));

  for (const provider of seed) install(provider);

  return {
    list() {
      return [...providers.values()].sort((a, b) => a.id.localeCompare(b.id));
    },
    get(id) {
      return providers.get(id) ?? null;
    },
    register(provider) {
      install(provider);
    },
  };
}