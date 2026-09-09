import { z } from "zod";
import type { FastifyInstance } from "fastify";
import { Id } from "@jamot/contracts";
import type { Provenance } from "@jamot/contracts";
import type {
  ReputationEvidence,
  ReputationService,
} from "@jamot/core/reputation";
import { requireAuth } from "../rbac.js";
import { parse } from "../util.js";

export interface ReputationRoutesOptions {
  reputation: ReputationService;
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

const EvidenceInput = z.object({
  taskId: Id.optional(),
  outcome: z.record(z.string(), z.unknown()),
  feedback: z.number().optional(),
  verified: z.boolean().default(false),
  provenance: ProvenanceInput.optional(),
});

const RecordBody = z.object({
  capability: z.string().min(1),
  evidence: EvidenceInput,
});

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

export default async function reputationRoutes(
  app: FastifyInstance,
  opts: ReputationRoutesOptions,
): Promise<void> {
  const { reputation } = opts;

  app.get(
    "/reputation/:actorId",
    { preHandler: requireAuth },
    async (request, reply) => {
      const params = request.params as { actorId?: string };
      const actorId = parse(Id, params.actorId, reply);
      if (!actorId) return;
      return await reputation.scores(actorId);
    },
  );

  app.post(
    "/reputation/:actorId",
    { preHandler: requireAuth },
    async (request, reply) => {
      const params = request.params as { actorId?: string };
      const actorId = parse(Id, params.actorId, reply);
      if (!actorId) return;
      const body = parse(RecordBody, request.body, reply);
      if (!body) return;

      const evidence: ReputationEvidence = {
        taskId: body.evidence.taskId,
        outcome: body.evidence.outcome,
        feedback: body.evidence.feedback,
        verified: body.evidence.verified,
        provenance: buildProvenance(body.evidence.provenance),
      };

      const score = await reputation.record(actorId, body.capability, evidence);
      reply.code(201);
      return { capability: body.capability, score };
    },
  );
}
