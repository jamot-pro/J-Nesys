import { randomUUID } from "node:crypto";
import type {
  KnowledgeEdge,
  KnowledgeEntity,
  KnowledgeStore,
} from "./knowledge.js";

const now = () => new Date().toISOString();

export function createInMemoryKnowledgeStore(): KnowledgeStore {
  const entities = new Map<string, KnowledgeEntity>();
  const edges = new Map<string, KnowledgeEdge>();

  return {
    async addEntity(input) {
      const entity: KnowledgeEntity = {
        id: randomUUID(),
        type: input.type,
        name: input.name,
        properties: input.properties ?? {},
        createdAt: now(),
        updatedAt: now(),
      };
      entities.set(entity.id, entity);
      return entity;
    },

    async listEntities() {
      return [...entities.values()];
    },

    async addEdge(input) {
      const edge: KnowledgeEdge = {
        id: randomUUID(),
        sourceId: input.sourceId,
        targetId: input.targetId,
        relation: input.relation,
        validFrom: now(),
        validTo: null,
        provenance: input.provenance,
      };
      edges.set(edge.id, edge);
      return edge;
    },

    async listEdges(filter) {
      const at = filter.at ? new Date(filter.at).getTime() : null;
      return [...edges.values()].filter((e) => {
        if (e.sourceId !== filter.entityId && e.targetId !== filter.entityId) {
          return false;
        }
        if (at == null) return true;
        const from = new Date(e.validFrom).getTime();
        const to = e.validTo ? new Date(e.validTo).getTime() : null;
        return from <= at && (to == null || to >= at);
      });
    },

    async invalidateEdge(id) {
      const existing = edges.get(id);
      if (existing) edges.set(id, { ...existing, validTo: now() });
    },
  };
}
