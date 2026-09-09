import { randomUUID } from "node:crypto";
import type { MemoryEntry, MemoryProvider } from "./memory.js";

const now = () => new Date().toISOString();

export function createInMemoryMemoryProvider(): MemoryProvider {
  const entries = new Map<string, MemoryEntry>();

  return {
    async store(input) {
      const entry: MemoryEntry = {
        id: randomUUID(),
        scope: input.scope,
        ownerId: input.ownerId,
        content: input.content,
        sourceEventId: input.sourceEventId ?? null,
        provenance: input.provenance,
        createdAt: now(),
        updatedAt: now(),
      };
      entries.set(entry.id, entry);
      return entry;
    },

    async get(id) {
      return entries.get(id) ?? null;
    },

    async list(filter) {
      return [...entries.values()].filter(
        (e) => e.scope === filter.scope && e.ownerId === filter.ownerId,
      );
    },

    async update(id, patch) {
      const existing = entries.get(id);
      if (!existing) return null;
      const updated: MemoryEntry = {
        ...existing,
        ...(patch.content !== undefined ? { content: patch.content } : {}),
        ...(patch.provenance !== undefined
          ? { provenance: patch.provenance }
          : {}),
        updatedAt: now(),
      };
      entries.set(id, updated);
      return updated;
    },

    async forget(id) {
      entries.delete(id);
    },
  };
}
