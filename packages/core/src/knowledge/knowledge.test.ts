import { describe, expect, it } from "vitest";
import type { Provenance } from "@jamot/contracts";
import type { KnowledgeEdge, KnowledgeEntity, KnowledgeStore } from "./knowledge.js";

const T1 = "2024-01-01T00:00:00.000Z";
const T2 = "2024-01-15T00:00:00.000Z";
const T3 = "2024-02-01T00:00:00.000Z";
const T4 = "2024-03-01T00:00:00.000Z";

function provenance(): Provenance {
  return {
    source: "inferred",
    confidence: 0.7,
    createdAt: T1,
    updatedAt: T1,
  };
}

interface FakeKnowledgeStore extends KnowledgeStore {
  _setNow(t: string): void;
}

function fakeStore(): FakeKnowledgeStore {
  const entities = new Map<string, KnowledgeEntity>();
  const edges = new Map<string, KnowledgeEdge>();
  let current = T1;
  let seq = 0;
  const now = () => current;
  const uuid = () =>
    `00000000-0000-4000-8000-${String(++seq).padStart(12, "0")}`;

  return {
    _setNow(t) {
      current = t;
    },

    async addEntity(input) {
      const entity: KnowledgeEntity = {
        id: uuid(),
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
        id: uuid(),
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
      const at = filter.at ? new Date(filter.at).getTime() : Infinity;
      return [...edges.values()].filter((e) => {
        if (e.sourceId !== filter.entityId && e.targetId !== filter.entityId) {
          return false;
        }
        if (new Date(e.validFrom).getTime() > at) return false;
        if (e.validTo && new Date(e.validTo).getTime() < at) return false;
        return true;
      });
    },

    async invalidateEdge(id) {
      const edge = edges.get(id);
      if (edge) edges.set(id, { ...edge, validTo: now() });
    },
  };
}

describe("knowledge store (temporal edges)", () => {
  it("an edge is valid at t1 but not after invalidation", async () => {
    const store = fakeStore();
    store._setNow(T1);

    const ada = await store.addEntity({ type: "person", name: "Ada" });
    const jamot = await store.addEntity({ type: "organization", name: "Jamot" });
    const edge = await store.addEdge({
      sourceId: ada.id,
      targetId: jamot.id,
      relation: "member_of",
      provenance: provenance(),
    });

    expect(
      await store.listEdges({ entityId: ada.id, at: T2 }),
    ).toHaveLength(1);

    store._setNow(T3);
    await store.invalidateEdge(edge.id);

    expect(
      await store.listEdges({ entityId: ada.id, at: T4 }),
    ).toHaveLength(0);
    expect(
      await store.listEdges({ entityId: ada.id, at: T2 }),
    ).toHaveLength(1);
  });

  it("matches edges where the entity is the target as well", async () => {
    const store = fakeStore();
    store._setNow(T1);

    const ada = await store.addEntity({ type: "person", name: "Ada" });
    const jamot = await store.addEntity({ type: "organization", name: "Jamot" });
    await store.addEdge({
      sourceId: ada.id,
      targetId: jamot.id,
      relation: "member_of",
      provenance: provenance(),
    });

    expect(
      await store.listEdges({ entityId: jamot.id, at: T2 }),
    ).toHaveLength(1);
  });
});
