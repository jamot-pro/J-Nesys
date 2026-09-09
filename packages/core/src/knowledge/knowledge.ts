import type { Provenance } from "@jamot/contracts";

export interface KnowledgeEntity {
  id: string;
  type: string;
  name: string;
  properties: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface KnowledgeEdge {
  id: string;
  sourceId: string;
  targetId: string;
  relation: string;
  validFrom: string;
  validTo: string | null;
  provenance: Provenance;
}

export interface KnowledgeStore {
  addEntity(input: {
    type: string;
    name: string;
    properties?: Record<string, unknown>;
  }): Promise<KnowledgeEntity>;
  listEntities(): Promise<KnowledgeEntity[]>;
  addEdge(input: {
    sourceId: string;
    targetId: string;
    relation: string;
    provenance: Provenance;
  }): Promise<KnowledgeEdge>;
  listEdges(filter: { entityId: string; at?: string }): Promise<KnowledgeEdge[]>;
  invalidateEdge(id: string): Promise<void>;
}
