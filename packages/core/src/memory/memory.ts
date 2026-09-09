import type { Provenance } from "@jamot/contracts";

export type MemoryScope = "person" | "agent" | "relationship" | "organization";

export interface MemoryEntry {
  id: string;
  scope: MemoryScope;
  ownerId: string;
  content: Record<string, unknown>;
  sourceEventId?: string | null;
  provenance: Provenance;
  createdAt: string;
  updatedAt: string;
}

export interface MemoryProvider {
  store(
    entry: Omit<MemoryEntry, "id" | "createdAt" | "updatedAt">,
  ): Promise<MemoryEntry>;
  get(id: string): Promise<MemoryEntry | null>;
  list(filter: { scope: MemoryScope; ownerId: string }): Promise<MemoryEntry[]>;
  update(
    id: string,
    patch: Partial<Pick<MemoryEntry, "content" | "provenance">>,
  ): Promise<MemoryEntry | null>;
  forget(id: string): Promise<void>;
}
