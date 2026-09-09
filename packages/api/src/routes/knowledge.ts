import { z } from "zod";
import type { FastifyInstance } from "fastify";
import { Id } from "@jamot/contracts";
import type { Provenance } from "@jamot/contracts";
import type { KnowledgeStore } from "@jamot/core/knowledge";
import { requireAuth } from "../rbac.js";
import { fail, parse } from "../util.js";

export interface KnowledgeRoutesOptions {
  knowledgeStore: KnowledgeStore;
}

const ProvenanceInput = z.object({
  source: z
    .enum([
      "self_declared",
      "assessment",
      "observed",
      "manager_feedback",
      "inferred",
      "system",
    ])
    .optional(),
  confidence: z.number().min(0).max(1).optional(),
});

const CreateEntityBody = z.object({
  type: z.string().min(1),
  name: z.string().min(1),
  properties: z.record(z.string(), z.unknown()).optional(),
});

const CreateEdgeBody = z.object({
  sourceId: Id,
  targetId: Id,
  relation: z.string().min(1),
  provenance: ProvenanceInput.optional(),
});

const AtInput = z.string().datetime({ offset: true });

function buildProvenance(
  input: z.infer<typeof ProvenanceInput> | undefined,
): Provenance {
  const ts = new Date().toISOString();
  return {
    source: input?.source ?? "self_declared",
    confidence: input?.confidence ?? 0.5,
    createdAt: ts,
    updatedAt: ts,
  };
}

export default async function knowledgeRoutes(
  app: FastifyInstance,
  opts: KnowledgeRoutesOptions,
): Promise<void> {
  const { knowledgeStore } = opts;

  app.post(
    "/knowledge/entities",
    { preHandler: requireAuth },
    async (request, reply) => {
      const body = parse(CreateEntityBody, request.body, reply);
      if (!body) return;
      const entity = await knowledgeStore.addEntity({
        type: body.type,
        name: body.name,
        properties: body.properties,
      });
      reply.code(201);
      return entity;
    },
  );

  app.get(
    "/knowledge/entities",
    { preHandler: requireAuth },
    async () => ({ items: await knowledgeStore.listEntities() }),
  );

  app.post(
    "/knowledge/edges",
    { preHandler: requireAuth },
    async (request, reply) => {
      const body = parse(CreateEdgeBody, request.body, reply);
      if (!body) return;
      const edge = await knowledgeStore.addEdge({
        sourceId: body.sourceId,
        targetId: body.targetId,
        relation: body.relation,
        provenance: buildProvenance(body.provenance),
      });
      reply.code(201);
      return edge;
    },
  );

  app.get(
    "/knowledge/edges",
    { preHandler: requireAuth },
    async (request, reply) => {
      const query = request.query as { entityId?: string; at?: string };
      const entityId = parse(Id, query.entityId, reply);
      if (!entityId) return;
      let at: string | undefined;
      if (query.at) {
        const parsed = parse(AtInput, query.at, reply);
        if (!parsed) return;
        at = parsed;
      }
      return { items: await knowledgeStore.listEdges({ entityId, at }) };
    },
  );
}
