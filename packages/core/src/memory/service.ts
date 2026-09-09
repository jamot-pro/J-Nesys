import type { MemoryEntry, MemoryProvider, MemoryScope } from "./memory.js";

export type MemoryInput = Omit<MemoryEntry, "id" | "createdAt" | "updatedAt">;

export interface MemoryEventBus {
  publish(e: unknown): Promise<unknown>;
}

export interface MemoryServiceDeps {
  provider: MemoryProvider;
  eventBus?: MemoryEventBus;
}

export interface MemoryService {
  remember(entry: MemoryInput): Promise<MemoryEntry>;
  recall(scope: MemoryScope, ownerId: string): Promise<MemoryEntry[]>;
  forget(id: string): Promise<void>;
}

export function createMemoryService(deps: MemoryServiceDeps): MemoryService {
  const { provider, eventBus } = deps;

  return {
    async remember(entry) {
      const stored = await provider.store(entry);
      if (eventBus) {
        await eventBus.publish({
          type: "memory.created",
          idempotencyKey: `memory:${stored.id}`,
          payload: {
            id: stored.id,
            scope: stored.scope,
            ownerId: stored.ownerId,
          },
        });
      }
      return stored;
    },

    recall(scope, ownerId) {
      return provider.list({ scope, ownerId });
    },

    forget(id) {
      return provider.forget(id);
    },
  };
}
