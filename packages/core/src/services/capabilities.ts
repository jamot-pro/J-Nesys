import type { Capability } from "@jamot/contracts";
import type {
  JamotRepository,
  NewCapability,
} from "../repository/repository.js";

export interface CapabilityServiceDeps {
  repo: JamotRepository;
}

export interface CapabilityService {
  defineCapability(input: NewCapability): Promise<Capability>;
  listForSpace(spaceId: string): Promise<Capability[]>;
  resolveCapability(spaceId: string, name: string): Promise<Capability | null>;
}

export function createCapabilityService(
  deps: CapabilityServiceDeps,
): CapabilityService {
  const { repo } = deps;

  return {
    defineCapability(input) {
      return repo.createCapability(input);
    },

    listForSpace(spaceId) {
      return repo.listCapabilities({ spaceId });
    },

    async resolveCapability(spaceId, name) {
      const capabilities = await repo.listCapabilities({ spaceId });
      return capabilities.find((c) => c.name === name) ?? null;
    },
  };
}
