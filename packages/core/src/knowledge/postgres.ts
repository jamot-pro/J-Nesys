import { and, eq, gte, isNull, lte, or } from "drizzle-orm";
import type { Db } from "../db.js";
import { knowledgeEdges, knowledgeEntities } from "../schema/index.js";
import type { KnowledgeEdge, KnowledgeEntity, KnowledgeStore } from "./knowledge.js";

function toEntity(row: typeof knowledgeEntities.$inferSelect): KnowledgeEntity {
  return {
    id: row.id,
    type: row.type,
    name: row.name,
    properties: row.properties,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function toEdge(row: typeof knowledgeEdges.$inferSelect): KnowledgeEdge {
  return {
    id: row.id,
    sourceId: row.sourceId,
    targetId: row.targetId,
    relation: row.relation,
    validFrom: row.validFrom,
    validTo: row.validTo,
    provenance: row.provenance,
  };
}

export function createPostgresKnowledgeStore(db: Db): KnowledgeStore {
  const client = db.db;

  return {
    async addEntity(input) {
      const [row] = await client
        .insert(knowledgeEntities)
        .values({
          type: input.type,
          name: input.name,
          properties: input.properties ?? {},
        })
        .returning();
      return toEntity(row!);
    },

    async listEntities() {
      const rows = await client.select().from(knowledgeEntities);
      return rows.map(toEntity);
    },

    async addEdge(input) {
      const [row] = await client
        .insert(knowledgeEdges)
        .values({
          sourceId: input.sourceId,
          targetId: input.targetId,
          relation: input.relation,
          provenance: input.provenance,
        })
        .returning();
      return toEdge(row!);
    },

    async listEdges(filter) {
      const at = filter.at ?? new Date().toISOString();
      const rows = await client
        .select()
        .from(knowledgeEdges)
        .where(
          and(
            or(
              eq(knowledgeEdges.sourceId, filter.entityId),
              eq(knowledgeEdges.targetId, filter.entityId),
            ),
            lte(knowledgeEdges.validFrom, at),
            or(isNull(knowledgeEdges.validTo), gte(knowledgeEdges.validTo, at)),
          ),
        );
      return rows.map(toEdge);
    },

    async invalidateEdge(id) {
      await client
        .update(knowledgeEdges)
        .set({ validTo: new Date().toISOString() })
        .where(eq(knowledgeEdges.id, id));
    },
  };
}
