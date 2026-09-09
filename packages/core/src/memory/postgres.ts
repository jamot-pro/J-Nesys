import { and, eq } from "drizzle-orm";
import type { Db } from "../db.js";
import { memories } from "../schema/index.js";
import type { MemoryEntry, MemoryProvider } from "./memory.js";

function toEntry(row: typeof memories.$inferSelect): MemoryEntry {
  return {
    id: row.id,
    scope: row.scope as MemoryEntry["scope"],
    ownerId: row.ownerId,
    content: row.content,
    sourceEventId: row.sourceEventId ?? null,
    provenance: row.provenance,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function createPostgresMemoryProvider(db: Db): MemoryProvider {
  const client = db.db;

  return {
    async store(input) {
      const [row] = await client
        .insert(memories)
        .values({
          scope: input.scope,
          ownerId: input.ownerId,
          content: input.content,
          sourceEventId: input.sourceEventId ?? null,
          provenance: input.provenance,
        })
        .returning();
      return toEntry(row!);
    },

    async get(id) {
      const [row] = await client
        .select()
        .from(memories)
        .where(eq(memories.id, id))
        .limit(1);
      return row ? toEntry(row) : null;
    },

    async list(filter) {
      const rows = await client
        .select()
        .from(memories)
        .where(
          and(
            eq(memories.scope, filter.scope),
            eq(memories.ownerId, filter.ownerId),
          ),
        );
      return rows.map(toEntry);
    },

    async update(id, patch) {
      const [row] = await client
        .update(memories)
        .set({
          ...(patch.content !== undefined ? { content: patch.content } : {}),
          ...(patch.provenance !== undefined
            ? { provenance: patch.provenance }
            : {}),
          updatedAt: new Date().toISOString(),
        })
        .where(eq(memories.id, id))
        .returning();
      return row ? toEntry(row) : null;
    },

    async forget(id) {
      await client.delete(memories).where(eq(memories.id, id));
    },
  };
}
